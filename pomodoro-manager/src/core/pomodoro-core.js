// 番茄管家核心逻辑 - 纯函数模块，可在 Node 中独立测试
// 负责计时状态机、任务管理、统计、连续打卡

'use strict';

class PomodoroCore {
  constructor(config = {}) {
    this.config = {
      workDuration: 25,        // 工作时长（分钟）
      shortBreak: 5,           // 短休息（分钟）
      longBreak: 15,           // 长休息（分钟）
      longBreakInterval: 4,    // 每完成 N 个番茄进入长休息
      dailyGoal: 8,            // 每日目标番茄数
      weeklyGoal: 30,          // 每周目标番茄数
      strictMode: false,       // 严格模式：不可跳过休息
      autoStartBreak: true,    // 工作结束自动进入休息
      autoStartWork: false,    // 休息结束自动进入工作
      soundEnabled: true,      // 提示音
      whiteNoise: false        // 白噪音
    };
    Object.assign(this.config, config);

    // 状态：idle | working | short_break | long_break | paused
    this.state = 'idle';
    this.pausedState = null;
    this.remainingMs = this.phaseDuration('working');
    this.cycleCount = 0;       // 当前周期内已完成的工作番茄数

    this.tasks = [];
    this.currentTaskId = null;

    this.stats = {};           // 日期键 -> { workSessions, totalMinutes }
    this.streak = 0;
    this.lastGoalMetDate = null;
  }

  // 指定阶段的时长（毫秒）
  phaseDuration(phase) {
    const map = {
      working: this.config.workDuration,
      short_break: this.config.shortBreak,
      long_break: this.config.longBreak
    };
    return (map[phase] || this.config.workDuration) * 60 * 1000;
  }

  start() {
    if (this.state === 'idle') {
      this.state = 'working';
      this.remainingMs = this.phaseDuration('working');
      return true;
    }
    if (this.state === 'paused') {
      return this.resume();
    }
    return false;
  }

  // 推进计时，返回 null 或事件对象（阶段切换时）
  tick(seconds = 1) {
    if (this.state === 'idle' || this.state === 'paused') return null;
    this.remainingMs -= seconds * 1000;
    if (this.remainingMs <= 0) {
      this.remainingMs = 0;
      return this._advancePhase();
    }
    return null;
  }

  _advancePhase() {
    const event = { completedWork: false };
    if (this.state === 'working') {
      this.cycleCount++;
      const dateKey = this._todayKey();
      this._ensureStat(dateKey);
      this.stats[dateKey].workSessions++;
      this.stats[dateKey].totalMinutes += this.config.workDuration;
      event.completedWork = true;
      event.workSessionsToday = this.stats[dateKey].workSessions;

      // 当前任务进度 +1
      if (this.currentTaskId) {
        const task = this.tasks.find(t => t.id === this.currentTaskId);
        if (task) task.pomodoros = (task.pomodoros || 0) + 1;
      }

      // 决定下一个休息阶段
      if (this.cycleCount % this.config.longBreakInterval === 0) {
        this.state = 'long_break';
      } else {
        this.state = 'short_break';
      }
      this.remainingMs = this.phaseDuration(this.state);
      event.nextPhase = this.state;
      event.remainingMs = this.remainingMs;
      this._updateStreak();
      return event;
    } else {
      // 休息结束 -> 工作
      this.state = 'working';
      this.remainingMs = this.phaseDuration('working');
      event.nextPhase = 'working';
      event.remainingMs = this.remainingMs;
      return event;
    }
  }

  pause() {
    if (this.state === 'working' || this.state === 'short_break' || this.state === 'long_break') {
      this.pausedState = this.state;
      this.state = 'paused';
      return true;
    }
    return false;
  }

  resume() {
    if (this.state === 'paused' && this.pausedState) {
      this.state = this.pausedState;
      this.pausedState = null;
      return true;
    }
    return false;
  }

  reset() {
    this.state = 'idle';
    this.pausedState = null;
    this.remainingMs = this.phaseDuration('working');
  }

  skip() {
    // 严格模式下不可跳过休息
    if (this.config.strictMode && (this.state === 'short_break' || this.state === 'long_break')) {
      return null;
    }
    if (this.state === 'idle' || this.state === 'paused') return null;
    if (this.state === 'working') {
      // 跳过专注 = 放弃当前番茄，不计入统计、不增加任务番茄数、不推进周期
      // 直接进入短休息（未完成不应获得长休息）
      this.state = 'short_break';
      this.remainingMs = this.phaseDuration('short_break');
      return { completedWork: false, skipped: true, nextPhase: 'short_break', remainingMs: this.remainingMs };
    }
    // 跳过休息 -> 进入工作（不涉及统计计数）
    this.remainingMs = 0;
    return this._advancePhase();
  }

  // 手动切换到指定阶段（用于阶段标签页点击），立即开始该阶段计时
  switchPhase(phase) {
    if (!['working', 'short_break', 'long_break'].includes(phase)) return false;
    this.state = phase;
    this.pausedState = null;
    this.remainingMs = this.phaseDuration(phase);
    return true;
  }

  // ---- 任务管理 ----
  addTask(title, estimate = 1) {
    const task = {
      id: this._genId(),
      title: String(title).trim(),
      estimate: Math.max(1, parseInt(estimate, 10) || 1),
      pomodoros: 0,
      completed: false,
      createdAt: Date.now()
    };
    this.tasks.push(task);
    return task;
  }

  // 以原始对象恢复任务（撤销删除用），保留 id/pomodoros/createdAt/estimate
  addTaskRaw(task) {
    if (!task || !task.id || !task.title) return null;
    // 若 id 已存在则不重复添加
    if (this.tasks.some(t => t.id === task.id)) return null;
    const restored = {
      id: task.id,
      title: String(task.title),
      estimate: Math.max(1, parseInt(task.estimate, 10) || 1),
      pomodoros: Math.max(0, parseInt(task.pomodoros, 10) || 0),
      completed: !!task.completed,
      createdAt: task.createdAt || Date.now()
    };
    if (task.completedAt) restored.completedAt = task.completedAt;
    this.tasks.push(restored);
    return restored;
  }

  setCurrentTask(id) {
    if (id === null || this.tasks.some(t => t.id === id)) {
      this.currentTaskId = id;
      return true;
    }
    return false;
  }

  // 编辑任务（标题/预估番茄数）。仅允许修改未完成任务
  updateTask(id, updates) {
    const task = this.tasks.find(t => t.id === id);
    if (!task || task.completed) return false;
    if (Object.prototype.hasOwnProperty.call(updates, 'title')) {
      const title = String(updates.title).trim();
      if (!title) return false;
      task.title = title;
    }
    if (Object.prototype.hasOwnProperty.call(updates, 'estimate')) {
      task.estimate = Math.max(1, parseInt(updates.estimate, 10) || 1);
    }
    return true;
  }

  completeTask(id) {
    const task = this.tasks.find(t => t.id === id);
    if (task && !task.completed) {
      task.completed = true;
      task.completedAt = Date.now();
      if (this.currentTaskId === id) this.currentTaskId = null;
      return true;
    }
    return false;
  }

  // 取消完成任务（恢复为未完成），允许用户纠正误操作
  uncompleteTask(id) {
    const task = this.tasks.find(t => t.id === id);
    if (task && task.completed) {
      task.completed = false;
      delete task.completedAt;
      return true;
    }
    return false;
  }

  deleteTask(id) {
    const idx = this.tasks.findIndex(t => t.id === id);
    if (idx >= 0) {
      this.tasks.splice(idx, 1);
      if (this.currentTaskId === id) this.currentTaskId = null;
      return true;
    }
    return false;
  }

  // ---- 统计 ----
  _todayKey(d = new Date()) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  _ensureStat(dateKey) {
    if (!this.stats[dateKey]) {
      this.stats[dateKey] = { workSessions: 0, totalMinutes: 0 };
    }
  }

  todayStats() {
    const key = this._todayKey();
    return this.stats[key] ? { ...this.stats[key] } : { workSessions: 0, totalMinutes: 0 };
  }

  weekStats() {
    let sessions = 0, minutes = 0;
    const now = new Date();
    for (let i = 0; i < 7; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = this._todayKey(d);
      if (this.stats[key]) {
        sessions += this.stats[key].workSessions;
        minutes += this.stats[key].totalMinutes;
      }
    }
    return { workSessions: sessions, totalMinutes: minutes };
  }

  // 最近 7 天的逐日数组（用于柱状图），最旧到最新
  weekDaily() {
    const arr = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = this._todayKey(d);
      const s = this.stats[key] || { workSessions: 0 };
      arr.push({
        date: key,
        label: `${d.getMonth() + 1}/${d.getDate()}`,
        workSessions: s.workSessions || 0
      });
    }
    return arr;
  }

  totalStats() {
    let sessions = 0, minutes = 0;
    for (const k in this.stats) {
      sessions += this.stats[k].workSessions;
      minutes += this.stats[k].totalMinutes;
    }
    return { workSessions: sessions, totalMinutes: minutes };
  }

  // 本自然周（周一到今天）统计，用于周目标进度
  thisWeekStats() {
    let sessions = 0, minutes = 0;
    const now = new Date();
    const day = now.getDay();
    const offsetToMonday = day === 0 ? 6 : day - 1;
    const monday = new Date(now);
    monday.setHours(0, 0, 0, 0);
    monday.setDate(monday.getDate() - offsetToMonday);
    for (let i = 0; i <= offsetToMonday; i++) {
      const d = new Date(monday);
      d.setDate(d.getDate() + i);
      const key = this._todayKey(d);
      if (this.stats[key]) {
        sessions += this.stats[key].workSessions;
        minutes += this.stats[key].totalMinutes;
      }
    }
    return { workSessions: sessions, totalMinutes: minutes };
  }

  // 最近 weeks 周的专注热力图数据，按自然周（周一起）对齐
  heatmapData(weeks = 13) {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const day = now.getDay();
    const sunday = new Date(now);
    sunday.setDate(sunday.getDate() + (7 - day) % 7);
    const firstMonday = new Date(sunday);
    firstMonday.setDate(firstMonday.getDate() - (weeks * 7 - 1));

    const weeksArr = [];
    const monthLabels = [];
    let totalSessions = 0;
    let maxSessions = 0;

    for (let w = 0; w < weeks; w++) {
      const col = [];
      const weekStart = new Date(firstMonday);
      weekStart.setDate(weekStart.getDate() + w * 7);
      for (let i = 0; i < 7; i++) {
        const d = new Date(weekStart);
        d.setDate(d.getDate() + i);
        const key = this._todayKey(d);
        const s = this.stats[key] || { workSessions: 0 };
        const ws = s.workSessions || 0;
        totalSessions += ws;
        if (ws > maxSessions) maxSessions = ws;
        col.push({
          date: key,
          workSessions: ws,
          level: this._heatLevel(ws),
          isFuture: d.getTime() > now.getTime(),
          isToday: key === this._todayKey(),
          month: d.getMonth() + 1
        });
      }
      weeksArr.push(col);
      const m = weekStart.getMonth() + 1;
      const prev = monthLabels.length ? monthLabels[monthLabels.length - 1].text : null;
      if (prev !== m) monthLabels.push({ col: w, text: m + '月' });
    }

    return { weeks: weeksArr, monthLabels, maxSessions, totalSessions };
  }

  // 热力图色阶：0 空闲；1 1-2个；2 3-4个；3 5-6个；4 7个及以上
  _heatLevel(ws) {
    if (ws <= 0) return 0;
    if (ws <= 2) return 1;
    if (ws <= 4) return 2;
    if (ws <= 6) return 3;
    return 4;
  }

  _updateStreak() {
    const today = this._todayKey();
    const todayStat = this.stats[today];
    if (todayStat && todayStat.workSessions >= this.config.dailyGoal) {
      if (this.lastGoalMetDate !== today) {
        // 检查昨天是否达标（连续）
        const y = new Date();
        y.setDate(y.getDate() - 1);
        const yKey = this._todayKey(y);
        if (this.lastGoalMetDate === yKey) {
          this.streak++;
        } else {
          this.streak = 1;
        }
        this.lastGoalMetDate = today;
      }
    }
  }

  // 重算连续天数（从历史统计重建，用于加载时校准）
  rebuildStreak() {
    const keys = Object.keys(this.stats).sort();
    let streak = 0;
    let lastDate = null;
    const today = this._todayKey();
    // 从今天往回数连续达标天数
    const cursor = new Date();
    for (let i = 0; i < 366; i++) {
      const key = this._todayKey(cursor);
      const s = this.stats[key];
      if (s && s.workSessions >= this.config.dailyGoal) {
        streak++;
        lastDate = key;
      } else if (i > 0) {
        // 今天可能还没达标，允许今天不达标但昨天达标算到昨天
        // 仅当今天未达标时，停止
        break;
      }
      cursor.setDate(cursor.getDate() - 1);
    }
    this.streak = streak;
    this.lastGoalMetDate = lastDate;
    return streak;
  }

  // 进度百分比 0-1
  progress() {
    const total = this.phaseDuration(this.state === 'paused' ? this.pausedState : this.state);
    if (total <= 0) return 0;
    return Math.max(0, Math.min(1, 1 - this.remainingMs / total));
  }

  static formatTime(ms) {
    const total = Math.max(0, Math.ceil(ms / 1000));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  static formatMinutes(min) {
    if (min < 60) return `${min} 分钟`;
    const h = Math.floor(min / 60);
    const m = min % 60;
    return m === 0 ? `${h} 小时` : `${h} 小时 ${m} 分`;
  }

  _genId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  serialize() {
    return {
      config: this.config,
      state: this.state,
      pausedState: this.pausedState,
      remainingMs: this.remainingMs,
      cycleCount: this.cycleCount,
      tasks: this.tasks,
      currentTaskId: this.currentTaskId,
      stats: this.stats,
      streak: this.streak,
      lastGoalMetDate: this.lastGoalMetDate
    };
  }

  static deserialize(data) {
    const core = new PomodoroCore((data && data.config) || {});
    if (data) {
      core.state = data.state || 'idle';
      core.pausedState = data.pausedState || null;
      core.remainingMs = data.remainingMs || core.phaseDuration('working');
      core.cycleCount = data.cycleCount || 0;
      core.tasks = data.tasks || [];
      core.currentTaskId = data.currentTaskId || null;
      core.stats = data.stats || {};
      core.streak = data.streak || 0;
      core.lastGoalMetDate = data.lastGoalMetDate || null;
    }
    return core;
  }
}

module.exports = { PomodoroCore };
