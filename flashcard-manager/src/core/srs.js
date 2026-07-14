'use strict';
// 复习调度层：计算到期卡片、复习队列、统计

// 判断卡片是否到期（基于 due 时间戳）
function isDue(card, now) {
  now = now || Date.now();
  return (card.due || 0) <= now;
}

// 取某卡组到期卡片（按 due 升序，新卡 due=now 优先）
function dueCards(cards, now) {
  now = now || Date.now();
  return cards
    .filter((c) => (c.due || 0) <= now)
    .sort((a, b) => (a.due || 0) - (b.due || 0));
}

// 取某卡组新卡（reps===0 且未到期也算可学，但复习时优先到期）
function newCards(cards) {
  return cards.filter((c) => (c.reps || 0) === 0);
}

// 构建一次复习会话队列：到期卡 + 新卡上限
function buildQueue(cards, opts, now) {
  opts = opts || {};
  const newPerSession = opts.newPerSession || 20;
  now = now || Date.now();
  const due = dueCards(cards, now);
  // 新卡：尚未到期但 reps===0 的，也纳入今日学习（受上限）
  const freshNotDue = cards
    .filter((c) => (c.reps || 0) === 0 && (c.due || 0) > now)
    .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
    .slice(0, newPerSession);
  return due.concat(freshNotDue);
}

// 统计：今日到期数、新卡数、已学（reps>0）数、总数
function stats(cards, now) {
  now = now || Date.now();
  let due = 0, fresh = 0, learned = 0, total = cards.length;
  cards.forEach((c) => {
    if ((c.reps || 0) === 0) fresh++;
    else learned++;
    if ((c.due || 0) <= now) due++;
  });
  return { total, due, fresh, learned };
}

module.exports = { isDue, dueCards, newCards, buildQueue, stats };
