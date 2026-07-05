// 速览管家 - 渲染进程
// 处理 UI 交互、预览渲染、文件加载、历史

'use strict';

const $ = (sel) => document.querySelector(sel);
const els = {
  titleText: $('#title-text'),
  btnClose: $('#btn-close'),
  btnMin: $('#btn-min'),
  btnMax: $('#btn-max'),
  btnOpen: $('#btn-open'),
  btnHistory: $('#btn-history'),
  welcome: $('#welcome'),
  preview: $('#preview'),
  stage: $('#stage'),
  metaBar: $('#meta-bar'),
  metaName: $('#meta-name'),
  metaInfo: $('#meta-info'),
  btnFolder: $('#btn-folder'),
  btnOpenExt: $('#btn-open-ext'),
  btnCopyPath: $('#btn-copy-path'),
  dropzone: $('#dropzone'),
  historyPanel: $('#history-panel'),
  historyList: $('#history-list'),
  btnClearHistory: $('#btn-clear-history'),
  toast: $('#toast'),
};

let currentMeta = null;

// ===== 工具函数 =====
function showToast(msg, duration = 1600) {
  els.toast.textContent = msg;
  els.toast.hidden = false;
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => {
    els.toast.hidden = true;
  }, duration);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function formatTime(iso) {
  try {
    const d = new Date(iso);
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  } catch { return ''; }
}

// ===== 窗口控制 =====
els.btnClose.addEventListener('click', () => window.api.window.close());
els.btnMin.addEventListener('click', () => window.api.window.minimize());
els.btnMax.addEventListener('click', () => window.api.window.toggleMax());

// ===== 打开文件选择 =====
els.btnOpen.addEventListener('click', async () => {
  const p = await window.api.dialog.pickFile();
  if (p) await loadPreview(p);
});

els.dropzone.addEventListener('click', async () => {
  const p = await window.api.dialog.pickFile();
  if (p) await loadPreview(p);
});

// ===== 拖拽支持 =====
['dragenter', 'dragover'].forEach(ev => {
  els.dropzone.addEventListener(ev, e => {
    e.preventDefault();
    els.dropzone.classList.add('dragover');
  });
});
['dragleave', 'drop'].forEach(ev => {
  els.dropzone.addEventListener(ev, e => {
    e.preventDefault();
    els.dropzone.classList.remove('dragover');
  });
});
els.dropzone.addEventListener('drop', async (e) => {
  const files = e.dataTransfer && e.dataTransfer.files;
  if (files && files.length > 0) {
    await loadPreview(files[0].path);
  }
});
// 整窗口拖拽支持
['dragenter', 'dragover', 'drop'].forEach(ev => {
  document.addEventListener(ev, e => e.preventDefault());
});

// ===== 历史抽屉 =====
els.btnHistory.addEventListener('click', async () => {
  if (els.historyPanel.hidden) {
    await renderHistory();
    els.historyPanel.hidden = false;
  } else {
    els.historyPanel.hidden = true;
  }
});
els.btnClearHistory.addEventListener('click', async () => {
  await window.api.history.clear();
  await renderHistory();
  showToast('历史已清空');
});

async function renderHistory() {
  const list = await window.api.history.list();
  els.historyList.innerHTML = '';
  if (!list || list.length === 0) {
    els.historyList.innerHTML = '<li class="empty">暂无记录</li>';
    return;
  }
  // 用 basename 显示
  for (const item of list) {
    const li = document.createElement('li');
    const sep = item.path.lastIndexOf(/[\\/]/);
    const name = sep >= 0 ? item.path.slice(sep + 1) : item.path;
    li.innerHTML = `<span class="h-name">${escapeHtml(name)}</span><span class="h-path">${escapeHtml(item.path)}</span>`;
    li.addEventListener('click', () => {
      els.historyPanel.hidden = true;
      loadPreview(item.path);
    });
    els.historyList.appendChild(li);
  }
}

// ===== Meta 操作 =====
els.btnFolder.addEventListener('click', () => {
  if (currentMeta) window.api.shell.showInFolder(currentMeta.path);
});
els.btnOpenExt.addEventListener('click', () => {
  if (currentMeta) window.api.shell.open(currentMeta.path);
});
els.btnCopyPath.addEventListener('click', async () => {
  if (currentMeta) {
    await window.api.clipboard.copyText(currentMeta.path);
    showToast('路径已复制');
  }
});

// ===== 主进程动作 =====
window.api.preview.onAction((action, payload) => {
  if (action === 'preview') {
    loadPreview(payload);
  } else if (action === 'show-welcome') {
    showWelcome();
  }
});

// ===== 显示欢迎页 =====
function showWelcome() {
  els.welcome.hidden = false;
  els.preview.hidden = true;
  els.titleText.textContent = '速览管家';
  currentMeta = null;
}

// ===== 加载预览 =====
async function loadPreview(filePath) {
  if (!filePath) return;
  const result = await window.api.preview.load(filePath);
  if (!result || result.error) {
    showError(result ? result.error : '加载失败');
    return;
  }
  currentMeta = result.meta;
  renderPreview(result);
}

function showError(msg) {
  els.welcome.hidden = true;
  els.preview.hidden = false;
  els.metaBar.style.display = 'none';
  els.stage.innerHTML = `
    <div class="preview-error">
      <div class="err-icon">⚠</div>
      <h3>无法预览</h3>
      <p>${escapeHtml(msg || '未知错误')}</p>
    </div>
  `;
}

// ===== 渲染预览主体 =====
async function renderPreview(result) {
  const { meta, decision, content, language } = result;
  els.welcome.hidden = true;
  els.preview.hidden = false;
  els.metaBar.style.display = '';
  els.titleText.textContent = meta.name;
  els.metaName.textContent = meta.name;
  els.metaInfo.textContent = `${meta.sizeText} · ${formatTime(meta.mtime)} · ${meta.ext.toUpperCase() || '文件'}`;
  els.stage.innerHTML = '';

  const kind = decision.kind;
  try {
    if (kind === 'image') {
      await renderImage(meta);
    } else if (kind === 'video') {
      renderVideo(meta);
    } else if (kind === 'audio') {
      renderAudio(meta);
    } else if (kind === 'pdf') {
      renderPdf(meta);
    } else if (kind === 'markdown') {
      renderMarkdown(content, meta);
    } else if (kind === 'json') {
      renderJson(content, meta);
    } else if (kind === 'text' || kind === 'code') {
      renderText(content, meta, language, kind === 'code');
    } else if (kind === 'font') {
      renderFont(meta);
    } else if (kind === 'archive') {
      renderArchive(meta);
    } else if (kind === 'office') {
      renderOffice(meta);
    } else {
      showError('暂不支持此文件格式');
    }
  } catch (e) {
    showError(e.message);
  }
}

async function renderImage(meta) {
  const url = await window.api.preview.readBinaryDataUrl(meta.path);
  const img = document.createElement('img');
  img.className = 'preview-image';
  img.src = url;
  img.alt = meta.name;
  els.stage.appendChild(img);
}

function renderVideo(meta) {
  const url = `file://${meta.path.replace(/\\/g, '/')}`;
  const v = document.createElement('video');
  v.className = 'preview-video';
  v.src = url;
  v.controls = true;
  els.stage.appendChild(v);
}

function renderAudio(meta) {
  const url = `file://${meta.path.replace(/\\/g, '/')}`;
  const wrap = document.createElement('div');
  wrap.className = 'preview-audio';
  wrap.innerHTML = `
    <div class="audio-icon">🎵</div>
    <div style="font-weight:600">${escapeHtml(meta.name)}</div>
    <div style="color:var(--text-mute);font-size:12px;margin-top:4px">${meta.sizeText}</div>
  `;
  const audio = document.createElement('audio');
  audio.src = url;
  audio.controls = true;
  wrap.appendChild(audio);
  els.stage.appendChild(wrap);
}

function renderPdf(meta) {
  const url = `file://${meta.path.replace(/\\/g, '/')}`;
  const iframe = document.createElement('iframe');
  iframe.className = 'preview-iframe';
  iframe.src = url;
  els.stage.appendChild(iframe);
}

function renderText(content, meta, language, isCode) {
  const pre = document.createElement('pre');
  pre.className = 'preview-text' + (isCode ? ' code' : '');
  pre.textContent = content;
  if (language) pre.setAttribute('data-lang', language);
  els.stage.appendChild(pre);
}

function renderMarkdown(content, meta) {
  const div = document.createElement('div');
  div.className = 'preview-text';
  div.innerHTML = simpleMarkdown(content);
  els.stage.appendChild(div);
}

function renderJson(content, meta) {
  let pretty = content;
  try {
    pretty = JSON.stringify(JSON.parse(content), null, 2);
  } catch {}
  const pre = document.createElement('pre');
  pre.className = 'preview-text code';
  pre.textContent = pretty;
  pre.setAttribute('data-lang', 'json');
  els.stage.appendChild(pre);
}

function renderFont(meta) {
  const url = `file://${meta.path.replace(/\\/g, '/')}`;
  const wrap = document.createElement('div');
  wrap.style.cssText = 'text-align:center;padding:24px;';
  const fontFamily = `previewFont-${Date.now()}`;
  // 注入 @font-face
  const style = document.createElement('style');
  style.textContent = `@font-face{font-family:"${fontFamily}";src:url("${url}");}`;
  document.head.appendChild(style);
  wrap.innerHTML = `
    <div style="font-family:'${fontFamily}';font-size:64px;color:var(--text);margin-bottom:16px">速览管家 ABC abc 123</div>
    <div style="color:var(--text-soft);font-size:13px">字体预览 · ${escapeHtml(meta.ext.toUpperCase())}</div>
  `;
  els.stage.appendChild(wrap);
}

function renderArchive(meta) {
  const div = document.createElement('div');
  div.className = 'preview-text';
  div.innerHTML = `<div style="text-align:center;padding:20px;color:var(--text-soft)">
    <div style="font-size:36px;margin-bottom:8px">📦</div>
    <div style="font-weight:600;color:var(--text)">${escapeHtml(meta.name)}</div>
    <div style="margin-top:6px">压缩包文件 · ${meta.sizeText}</div>
    <div style="margin-top:12px;font-size:12px;color:var(--text-mute)">出于安全考虑不直接解压，请用系统应用打开</div>
  </div>`;
  els.stage.appendChild(div);
}

function renderOffice(meta) {
  const div = document.createElement('div');
  div.className = 'preview-text';
  div.innerHTML = `<div style="text-align:center;padding:20px;color:var(--text-soft)">
    <div style="font-size:36px;margin-bottom:8px">📄</div>
    <div style="font-weight:600;color:var(--text)">${escapeHtml(meta.name)}</div>
    <div style="margin-top:6px">Office 文档 · ${meta.sizeText}</div>
    <div style="margin-top:12px;font-size:12px;color:var(--text-mute)">点击下方"系统打开"用 Word/Excel/PowerPoint 查看</div>
  </div>`;
  els.stage.appendChild(div);
}

// ===== 极简 Markdown 渲染（无依赖） =====
function simpleMarkdown(src) {
  let html = escapeHtml(src);
  // 代码块
  html = html.replace(/```([\s\S]*?)```/g, (_, c) => `<pre class="md-code">${c.trim()}</pre>`);
  // 标题
  html = html.replace(/^###### (.*)$/gm, '<h6>$1</h6>')
             .replace(/^##### (.*)$/gm, '<h5>$1</h5>')
             .replace(/^#### (.*)$/gm, '<h4>$1</h4>')
             .replace(/^### (.*)$/gm, '<h3>$1</h3>')
             .replace(/^## (.*)$/gm, '<h2>$1</h2>')
             .replace(/^# (.*)$/gm, '<h1>$1</h1>');
  // 粗体、斜体、行内代码
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
             .replace(/\*([^*]+)\*/g, '<em>$1</em>')
             .replace(/`([^`]+)`/g, '<code>$1</code>');
  // 链接
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  // 列表
  html = html.replace(/^[\-\*] (.*)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>[\s\S]*?<\/li>)/g, '<ul>$1</ul>');
  // 段落（连续非空行）
  html = html.split(/\n\n+/).map(block => {
    if (/^<(h\d|ul|pre|p|div)/.test(block.trim())) return block;
    if (block.trim() === '') return '';
    return `<p>${block.replace(/\n/g, '<br>')}</p>`;
  }).join('\n');
  return html;
}

// ===== 启动初始化 =====
(async function init() {
  // 默认显示欢迎页
  showWelcome();
})();

// 键盘快捷键（应用内）
document.addEventListener('keydown', async (e) => {
  // Esc 关闭预览
  if (e.key === 'Escape') {
    if (!els.historyPanel.hidden) {
      els.historyPanel.hidden = true;
    } else {
      window.api.window.close();
    }
  }
});
