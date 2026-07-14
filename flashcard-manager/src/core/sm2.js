'use strict';
// SM-2 间隔重复算法（SuperMemo 2）
// Anki 同款经典算法：根据回忆质量动态调整易度因子 EF 与复习间隔

// 默认参数
const DEFAULT_EF = 2.5;
const MIN_EF = 1.3;

/**
 * 根据回忆质量 q（0-5）计算卡片下次复习参数
 * @param {object} card - { ef, interval, reps, due }
 * @param {number} q - 回忆质量 0..5
 * @param {number} now - 时间戳（毫秒），可选，默认 Date.now()
 * @returns {object} 更新后的卡片调度字段 { ef, interval, reps, due, lastReview }
 */
function schedule(card, q, now) {
  if (typeof q !== 'number' || q < 0 || q > 5) {
    throw new Error('quality must be 0..5, got ' + q);
  }
  now = now || Date.now();
  const ef = typeof card.ef === 'number' && card.ef >= MIN_EF ? card.ef : DEFAULT_EF;
  const reps = typeof card.reps === 'number' && card.reps >= 0 ? card.reps : 0;
  let interval = typeof card.interval === 'number' && card.interval >= 0 ? card.interval : 0;

  let newReps;
  if (q >= 3) {
    // 回忆成功
    if (reps === 0) {
      interval = 1;
    } else if (reps === 1) {
      interval = 6;
    } else {
      interval = Math.round(interval * ef);
    }
    newReps = reps + 1;
  } else {
    // 回忆失败：重置
    interval = 1;
    newReps = 0;
  }

  // 更新易度因子 EF
  let newEf = ef + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
  if (newEf < MIN_EF) newEf = MIN_EF;
  // 浮点修正，保留 3 位小数
  newEf = Math.round(newEf * 1000) / 1000;

  const due = now + interval * 24 * 60 * 60 * 1000;
  return {
    ef: newEf,
    interval: interval,
    reps: newReps,
    due: due,
    lastReview: now
  };
}

// 评分按钮 → 质量映射（与 UI 对齐）
const GRADE = {
  AGAIN: 1, // 忘了
  HARD: 3,  // 困难
  GOOD: 4,  // 良好
  EASY: 5   // 简单
};

// 创建新卡片的初始调度字段
function initialSchedule(now) {
  now = now || Date.now();
  return {
    ef: DEFAULT_EF,
    interval: 0,
    reps: 0,
    due: now, // 新卡立即可复习
    lastReview: 0
  };
}

module.exports = { schedule, initialSchedule, GRADE, DEFAULT_EF, MIN_EF };
