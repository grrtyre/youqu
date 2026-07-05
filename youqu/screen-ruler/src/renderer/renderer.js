// 主窗口逻辑
'use strict';

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
