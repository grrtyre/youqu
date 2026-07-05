// 主窗口逻辑
'use strict';

// ── 自定义标题栏窗口控制 ──
const dots = document.querySelectorAll('.titlebar .dot');
dots.forEach(dot => {
  dot.addEventListener('click', (e) => {
    e.stopPropagation();
    const action = dot.dataset.action;
    if (action === 'close') window.ruler.close();
    else if (action === 'minimize') window.ruler.minimize();
    else if (action === 'maximize') window.ruler.maximizeToggle();
  });
});

// 双击标题栏切换最大化
document.querySelector('.titlebar').addEventListener('dblclick', (e) => {
  if (e.target.closest('.dot')) return;
  window.ruler.maximizeToggle();
});

// ── 工具卡片选择 ──
const startBtn = document.getElementById('startBtn');
const toolCards = document.querySelectorAll('.tool-card');
let selectedTool = 'ruler';

toolCards.forEach(card => {
  card.addEventListener('click', () => {
    selectedTool = card.dataset.tool;
    toolCards.forEach(c => c.classList.remove('active'));
    card.classList.add('active');
  });
});

startBtn.addEventListener('click', async () => {
  await window.ruler.openOverlay();
});

// 接收截图并通过 storage 转发（实际由 main 直接发到 overlay，这里仅同步状态）
