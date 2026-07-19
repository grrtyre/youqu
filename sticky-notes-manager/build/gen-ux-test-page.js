// 便签管家 - UX 测试 HTML 生成器
// 将 index.html + styles.css + renderer.js 合并为自包含测试页面，
// 注入 mock notesAPI（localStorage 后端），预填充演示数据，用于 Edge headless 截图。
'use strict';
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const indexHtml = fs.readFileSync(path.join(root, 'src/renderer/index.html'), 'utf-8');
const stylesCss = fs.readFileSync(path.join(root, 'src/renderer/styles.css'), 'utf-8');
const rendererJs = fs.readFileSync(path.join(root, 'src/renderer/renderer.js'), 'utf-8');

// === 演示数据：包含便签、回收站、置顶、多种颜色与分类 ===
const now = Date.now();
const min = 60 * 1000;
const hour = 60 * min;
const day = 24 * hour;
const demoData = {
  notes: [
    { id: 'demo1', title: '欢迎使用便签管家', content: '这是一款本地优先的快速便签桌面应用。\n支持分类、颜色标记、置顶、全文搜索。\n所有数据存储在本地，隐私优先，不联网不上传。', color: 'blue', category: '工作', pinned: true, createdAt: now - day, updatedAt: now - 5 * min },
    { id: 'demo2', title: '周会要点', content: '1. 讨论 Q3 产品路线图\n2. 确认新功能上线时间\n3. 分配开发任务\n4. 下周评审设计稿', color: 'green', category: '工作', pinned: false, createdAt: now - day, updatedAt: now - 2 * hour },
    { id: 'demo3', title: '读书笔记 · 原则', content: '极度透明、极度真实。痛苦+反思=进步。\n把原则写下来，反复迭代。做决策时要有可信度加权的创意择优。', color: 'yellow', category: '灵感', pinned: false, createdAt: now - 2 * day, updatedAt: now - 5 * hour },
    { id: 'demo4', title: '购物清单', content: '牛奶 x2\n全麦面包\n鸡蛋一盒\n蓝莓\n三文鱼\n橄榄油', color: 'orange', category: '个人', pinned: false, createdAt: now - 2 * day, updatedAt: now - 8 * hour },
    { id: 'demo5', title: '周末待办', content: '整理书房\n给植物换盆\n预约牙医\n回复邮件', color: 'pink', category: '待办', pinned: false, createdAt: now - 3 * day, updatedAt: now - day },
    { id: 'demo6', title: 'Python 学习计划', content: 'Week 1: 基础语法\nWeek 2: 数据结构\nWeek 3: 面向对象\nWeek 4: 文件与异常', color: 'purple', category: '灵感', pinned: false, createdAt: now - 5 * day, updatedAt: now - 2 * day }
  ],
  trash: [
    { id: 'trash1', title: '旧版会议纪要', content: '已归档到团队 Wiki，本地副本移入回收站。', color: 'default', category: '工作', pinned: false, createdAt: now - 10 * day, updatedAt: now - 9 * day, deletedAt: now - 2 * day },
    { id: 'trash2', title: '过期的优惠券码', content: '2026-06-30 到期，已不可使用。', color: 'orange', category: '其他', pinned: false, createdAt: now - 30 * day, updatedAt: now - 20 * day, deletedAt: now - day }
  ]
};

// === mock notesAPI：基于内存数据，模拟 IPC 行为 ===
const mockApi = `
window.__DEMO_DATA__ = ${JSON.stringify(demoData)};
window.notesAPI = {
  _data: { notes: window.__DEMO_DATA__.notes, trash: window.__DEMO_DATA__.trash },
  load: () => Promise.resolve({ notes: window.notesAPI._data.notes, trash: window.notesAPI._data.trash }),
  save: (notes, trash) => {
    window.notesAPI._data.notes = notes;
    if (trash !== undefined) window.notesAPI._data.trash = trash;
    return Promise.resolve(true);
  },
  exportNotes: (notes) => Promise.resolve({ success: true, path: 'C:/Users/Demo/便签备份.json' }),
  importNotes: () => Promise.resolve({ success: false }),
  onAction: () => {},
  restoreFromTrash: (id) => {
    const t = window.notesAPI._data.trash.find(n => n.id === id);
    if (!t) return Promise.resolve({ success: false });
    const restored = { ...t, pinned: false, updatedAt: Date.now() };
    delete restored.deletedAt;
    window.notesAPI._data.notes = [restored, ...window.notesAPI._data.notes];
    window.notesAPI._data.trash = window.notesAPI._data.trash.filter(n => n.id !== id);
    return Promise.resolve({ success: true, notes: window.notesAPI._data.notes, trash: window.notesAPI._data.trash });
  },
  deleteFromTrash: (id) => {
    window.notesAPI._data.trash = window.notesAPI._data.trash.filter(n => n.id !== id);
    return Promise.resolve({ success: true, trash: window.notesAPI._data.trash });
  },
  emptyTrash: () => {
    window.notesAPI._data.trash = [];
    return Promise.resolve({ success: true, trash: [] });
  }
};
`;

// === 组装最终测试 HTML ===
// 提取 <body> 内部内容（去掉 <script src="renderer.js"></script>，用内联 + mock 替换）
const bodyMatch = indexHtml.match(/<body[^>]*>([\s\S]*)<\/body>/i);
let bodyContent = bodyMatch ? bodyMatch[1] : '';
// 移除原 renderer.js 引用
bodyContent = bodyContent.replace(/<script\s+src="renderer\.js"><\/script>/i, '');

const outHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>便签管家 - UX 测试页</title>
  <style>
${stylesCss}
/* 测试页特殊样式：让 body 显示得像应用窗口 */
body { border: 1px solid #e5e5ea; }
  </style>
</head>
<body>
${bodyContent}
<script>
${mockApi}
</script>
<script>
${rendererJs}
</script>
<script>
// === 测试页状态切换：基于 URL hash 触发不同 UI 状态用于截图 ===
window.__switchState = function(state) {
  try {
    if (state === 'notes') {
      // 默认状态：便签列表视图
      const allItem = document.querySelector('.category-item[data-category="\\u5168\\u90e8"]');
      if (allItem) allItem.click();
    } else if (state === 'trash') {
      // 切换到回收站
      const trashEntry = document.getElementById('trashEntry');
      if (trashEntry) trashEntry.click();
    } else if (state === 'edit') {
      // 打开第一个便签的编辑弹窗
      const firstCard = document.querySelector('.note-card');
      if (firstCard) firstCard.click();
    } else if (state === 'edit-new') {
      // 新建便签弹窗
      const newBtn = document.getElementById('newNoteBtn');
      if (newBtn) newBtn.click();
    } else if (state === 'confirm') {
      // 触发确认弹窗（清空回收站）
      const trashEntry = document.getElementById('trashEntry');
      if (trashEntry) trashEntry.click();
      setTimeout(() => {
        const emptyBtn = document.getElementById('emptyTrashBtn');
        if (emptyBtn) emptyBtn.click();
      }, 100);
    } else if (state === 'search') {
      // 输入搜索关键词
      const searchInput = document.getElementById('searchInput');
      if (searchInput) {
        searchInput.value = 'Python';
        searchInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
    } else if (state === 'category') {
      // 切到「工作」分类
      const workItem = document.querySelector('.category-item[data-category="\\u5de5\\u4f5c"]');
      if (workItem) workItem.click();
    }
  } catch (e) { console.error('switchState error:', e); }
};

// 等待 init() 完成（renderer.js 中 init() 是 async），根据 hash 自动切换状态
window.addEventListener('load', () => {
  setTimeout(() => {
    const hash = (location.hash || '#notes').replace(/^#/, '');
    window.__switchState(hash);
  }, 300);
});
</script>
</body>
</html>`;

const outPath = path.join(__dirname, 'ux-test-page.html');
fs.writeFileSync(outPath, outHtml, 'utf-8');
console.log('UX test page written to: ' + outPath);
console.log('Demo data: ' + demoData.notes.length + ' notes, ' + demoData.trash.length + ' trash items');
