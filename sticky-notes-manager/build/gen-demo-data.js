// 便签管家 - 生成演示数据 JSON（UTF-8 编码，避免 PS1 中文乱码问题）
'use strict';
const fs = require('fs');
const path = require('path');

const now = Date.now();
const min = 60 * 1000;
const hour = 60 * min;
const day = 24 * hour;

const demoNotes = {
  version: 1,
  exportedAt: new Date().toISOString(),
  notes: [
    { id: 'demo1', title: '欢迎使用便签管家', content: '这是一款本地优先的快速便签桌面应用。支持分类、颜色标记、置顶、全文搜索。所有数据存储在本地，隐私优先，不联网不上传。', color: 'blue', category: '工作', pinned: true, createdAt: now - day, updatedAt: now - 5 * min },
    { id: 'demo2', title: '周会要点', content: '1. 讨论 Q3 产品路线图\n2. 确认新功能上线时间\n3. 分配开发任务\n4. 下周评审设计稿', color: 'green', category: '工作', pinned: false, createdAt: now - day, updatedAt: now - 2 * hour },
    { id: 'demo3', title: '读书笔记 · 原则', content: '极度透明、极度真实。痛苦+反思=进步。把原则写下来，反复迭代。做决策时要有可信度加权的创意择优。', color: 'yellow', category: '灵感', pinned: false, createdAt: now - 2 * day, updatedAt: now - 5 * hour },
    { id: 'demo4', title: '购物清单', content: '牛奶 x2\n全麦面包\n鸡蛋一盒\n蓝莓\n三文鱼\n橄榄油', color: 'orange', category: '个人', pinned: false, createdAt: now - 2 * day, updatedAt: now - 8 * hour },
    { id: 'demo5', title: '周末待办', content: '整理书房\n给植物换盆\n预约牙医\n回复邮件\n更新简历', color: 'pink', category: '待办', pinned: false, createdAt: now - 3 * day, updatedAt: now - day },
    { id: 'demo6', title: 'Python 学习计划', content: 'Week 1: 基础语法\nWeek 2: 数据结构\nWeek 3: 面向对象\nWeek 4: 文件与异常', color: 'purple', category: '灵感', pinned: false, createdAt: now - 5 * day, updatedAt: now - 2 * day },
    { id: 'demo7', title: '电影推荐', content: '奥本海默 9.2\n流浪地球2 8.5\n瞬息全宇宙 8.0', color: 'default', category: '其他', pinned: false, createdAt: now - 7 * day, updatedAt: now - 3 * day },
    { id: 'demo8', title: '项目灵感', content: '做一个本地密码强度检测器，支持离线、无追踪。用 zxcvbn 算法评估密码强度，给出改进建议。', color: 'blue', category: '灵感', pinned: false, createdAt: now - 10 * day, updatedAt: now - 4 * day }
  ]
};

const outPath = path.join(__dirname, 'demo-notes.json');
fs.writeFileSync(outPath, JSON.stringify(demoNotes, null, 2), 'utf-8');
console.log('Demo data written to: ' + outPath);
