// 纪念日提醒核心逻辑（可独立测试，不依赖 Electron）
// 包含：即将到来事件筛选、当天事件、通知文案生成、通知去重键
const { computeEventInfo } = require('./anniversary-core');

// 默认提前提醒天数
const DEFAULT_REMIND_DAYS = 7;

// 获取指定天数内即将到来的事件（按临近天数升序）
// events: 原始事件数组（store.list() 返回值）
// today: 'YYYY-MM-DD' 字符串
// daysAhead: 提前几天
function getUpcomingEvents(events, today, daysAhead = DEFAULT_REMIND_DAYS) {
  if (!Array.isArray(events)) return [];
  const limit = daysAhead >= 0 ? daysAhead : DEFAULT_REMIND_DAYS;
  const list = events
    .map((e) => {
      try {
        return computeEventInfo(e, today);
      } catch (err) {
        return null;
      }
    })
    .filter((e) => e && e.daysUntilNext >= 0 && e.daysUntilNext <= limit);
  list.sort((a, b) => a.daysUntilNext - b.daysUntilNext);
  return list;
}

// 获取当天事件（daysUntilNext === 0）
function getTodayEvents(events, today) {
  return getUpcomingEvents(events, today, 0).filter((e) => e.daysUntilNext === 0);
}

// 生成单条事件的通知文案
// 返回 { title, body }
function buildNotification(event) {
  if (!event || event.daysUntilNext == null) return null;
  const typeLabel = event.eventTypeLabel || '纪念日';
  const emoji = event.eventTypeEmoji || '💌';
  let title;
  let body;
  if (event.daysUntilNext === 0) {
    title = `${emoji} 今天是${event.name}的${typeLabel}`;
    if (event.eventType === 'birthday' && event.age >= 0) {
      body = `${event.name}今天将满 ${event.age + 1} 岁，别忘了送上祝福！`;
    } else {
      body = `今天是${event.name}的${typeLabel}，值得记住的一天。`;
    }
  } else {
    title = `${emoji} ${event.name}的${typeLabel}还有 ${event.daysUntilNext} 天`;
    const dateStr = (event.nextDate || '').replace(/-/g, '/');
    if (event.eventType === 'birthday' && event.age >= 0) {
      body = `将于 ${dateStr}（${event.weekday || ''}）到来，将满 ${event.age + 1} 岁。`;
    } else {
      body = `将于 ${dateStr}（${event.weekday || ''}）到来，提前准备一下吧。`;
    }
  }
  return { title, body };
}

// 生成通知去重键：同一天内同一事件同一提醒等级只通知一次
// key 格式：eventKey_YYYY-MM-DD_daysUntilNext
function notificationKey(event, today) {
  if (!event || !event.id) return null;
  return `${event.id}_${today}_${event.daysUntilNext}`;
}

// 批量生成通知列表（带去重键）
// 返回 [{ key, event, title, body }]
function buildNotifications(events, today, daysAhead = DEFAULT_REMIND_DAYS) {
  const upcoming = getUpcomingEvents(events, today, daysAhead);
  return upcoming
    .map((event) => {
      const n = buildNotification(event);
      if (!n) return null;
      return {
        key: notificationKey(event, today),
        event,
        title: n.title,
        body: n.body,
      };
    })
    .filter(Boolean);
}

module.exports = {
  DEFAULT_REMIND_DAYS,
  getUpcomingEvents,
  getTodayEvents,
  buildNotification,
  notificationKey,
  buildNotifications,
};
