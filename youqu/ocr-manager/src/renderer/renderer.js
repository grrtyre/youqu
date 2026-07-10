// src/renderer/renderer.js — 识字管家渲染层逻辑
(function(){
  'use strict';
  const ocr = window.ocr;
  // 内联一份语言列表（与 core.SUPPORTED_LANGS 一致），避免渲染层 require
  const LANGS = [
    { code: 'chi_sim+eng', label: '中文 + 英文' },
    { code: 'chi_sim', label: '简体中文' },
    { code: 'eng', label: '英文' },
    { code: 'chi_tra+eng', label: '繁体 + 英文' },
    { code: 'jpn', label: '日文' },
    { code: 'kor', label: '韩文' }
  ];

  // ===== DOM =====
  const $ = (id) => document.getElementById(id);
  const dropzone = $('dropzone');
  const dzInner = $('dzInner');
  const preview = $('preview');
  const imgMeta = $('imgMeta');
  const fileInput = $('fileInput');
  const langSelect = $('langSelect');
  const result = $('result');
  const resultEmpty = $('resultEmpty');
  const progress = $('progress');
  const progressFill = $('progressFill');
  const progressText = $('progressText');
  const queueBox = $('queue');
  const queueList = $('queueList');
  const queueCount = $('queueCount');
  const historyList = $('historyList');
  const historyPanel = $('history');
  const toastEl = $('toast');
  const autoCopy = $('autoCopy');

  // ===== 状态 =====
  let queue = [];          // [{ id, name, dataUrl }]
  let currentId = null;    // 当前选中的队列项 id
  let currentDataUrl = null;
  let recognizing = false;
  let settings = { lang: 'chi_sim+eng', autoCopy: false };
  let history = [];
  let unregProgress = null;

  // ===== 工具 =====
  function toast(msg, ms){
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => toastEl.classList.remove('show'), ms || 1600);
  }
  function fmtTime(iso){
    try{
      const d = new Date(iso);
      const p = (n) => String(n).padStart(2,'0');
      return `${d.getMonth()+1}月${d.getDate()}日 ${p(d.getHours())}:${p(d.getMinutes())}`;
    }catch(e){ return ''; }
  }
  function uid(){ return 'q_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2,6); }

  // 读取 File 为 dataURL
  function fileToDataUrl(file){
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = () => reject(r.error);
      r.readAsDataURL(file);
    });
  }

  function setProgress(visible, pct, text){
    progress.style.display = visible ? 'block' : 'none';
    if(visible){
      progressFill.style.width = (pct||0) + '%';
      progressText.textContent = text || '准备中…';
    }
  }

  function updateStats(text, confidence){
    const t = text || result.value;
    const hasText = !!t;
    // 有文本时显示详细统计，无文本时显示"就绪"
    $('statReady').style.display = hasText ? 'none' : '';
    $('statConf').style.display = hasText ? '' : 'none';
    $('statChars').style.display = hasText ? '' : 'none';
    $('statCjk').style.display = hasText ? '' : 'none';
    $('statWords').style.display = hasText ? '' : 'none';
    if(!hasText) return;
    const chars = t.replace(/\n/g,'').length;
    const cjk = (t.match(/[\u4e00-\u9fff]/g)||[]).length;
    const words = (t.match(/[A-Za-z]+(?:'[A-Za-z]+)?/g)||[]).length;
    $('statChars').textContent = '字数 ' + chars;
    $('statCjk').textContent = '汉字 ' + cjk;
    $('statWords').textContent = '单词 ' + words;
    if(typeof confidence === 'number'){
      $('statConf').textContent = '置信度 ' + confidence.toFixed(1) + '%';
    }else{
      $('statConf').textContent = '置信度 暂无';
    }
  }

  function setResult(text, confidence){
    result.value = text || '';
    if(text){ resultEmpty.classList.add('hidden'); }
    else { resultEmpty.classList.remove('hidden'); }
    updateStats(text, confidence);
  }

  // ===== 队列渲染 =====
  function renderQueue(){
    if(queue.length === 0){
      queueBox.style.display = 'none';
      return;
    }
    queueBox.style.display = 'block';
    queueCount.textContent = queue.length;
    queueList.innerHTML = '';
    queue.forEach(item => {
      const div = document.createElement('div');
      div.className = 'queue-item' + (item.id === currentId ? ' active' : '');
      const img = document.createElement('img');
      img.src = item.dataUrl;
      div.appendChild(img);
      const del = document.createElement('button');
      del.className = 'qi-del';
      del.textContent = '×';
      del.title = '移除';
      del.addEventListener('click', (e) => {
        e.stopPropagation();
        queue = queue.filter(q => q.id !== item.id);
        if(currentId === item.id){
          currentId = null;
          currentDataUrl = null;
          showEmptySource();
        }
        renderQueue();
      });
      div.appendChild(del);
      div.addEventListener('click', () => selectQueueItem(item.id));
      queueList.appendChild(div);
    });
  }

  function selectQueueItem(id){
    const item = queue.find(q => q.id === id);
    if(!item) return;
    currentId = id;
    currentDataUrl = item.dataUrl;
    preview.src = item.dataUrl;
    preview.style.display = 'block';
    dzInner.style.display = 'none';
    imgMeta.style.display = 'block';
    imgMeta.textContent = item.name || '图像';
    renderQueue();
  }

  function showEmptySource(){
    preview.style.display = 'none';
    preview.src = '';
    imgMeta.style.display = 'none';
    dzInner.style.display = 'block';
  }

  // 添加图片到队列（单/多）
  async function addImages(files, source){
    const imgs = Array.from(files).filter(f => /^image\//.test(f.type) || /\.(png|jpe?g|bmp|webp|gif|tiff?)$/i.test(f.name));
    if(imgs.length === 0){ toast('未识别到图片文件'); return; }
    for(const f of imgs){
      try{
        const dataUrl = await fileToDataUrl(f);
        queue.push({ id: uid(), name: f.name, dataUrl });
      }catch(e){}
    }
    // 选中最后一张
    if(queue.length){
      selectQueueItem(queue[queue.length-1].id);
    }
    renderQueue();
  }

  // 直接使用 dataUrl（截图/粘贴）
  function addDataUrl(dataUrl, name, w, h){
    const item = { id: uid(), name: name || '图像', dataUrl };
    queue.push(item);
    if(w && h){
      imgMeta.textContent = `${name||'图像'} · ${w}×${h}`;
    }
    selectQueueItem(item.id);
    renderQueue();
  }

  // ===== 识别 =====
  async function recognize(){
    if(recognizing){ toast('正在识别中…'); return; }
    if(!currentDataUrl){ toast('请先添加图片'); return; }
    recognizing = true;
    $('btnRecognize').disabled = true;
    $('btnRecognize').textContent = '识别中…';
    setProgress(true, 0, '初始化引擎…');
    unregProgress = ocr.onProgress((m) => {
      const pct = Math.round((m.progress||0)*100);
      setProgress(true, pct, m.status || '识别中…');
    });
    try{
      const res = await ocr.recognize({ lang: langSelect.value, image: currentDataUrl });
      if(res && res.error){ toast('识别失败：' + res.error); setResult(''); }
      else{
        setResult(res.text, res.confidence);
        $('statLang').textContent = res.lang || langSelect.value;
        // 写入历史
        saveHistory(res.text, currentName(), res.confidence);
        if(settings.autoCopy && res.text){
          await ocr.writeClipboardText(res.text);
          toast('已识别并复制到剪贴板');
        }else{
          toast('识别完成');
        }
      }
    }catch(e){
      toast('识别异常：' + (e.message||e));
    }finally{
      recognizing = false;
      $('btnRecognize').disabled = false;
      $('btnRecognize').textContent = '开始识别';
      setProgress(false);
      if(unregProgress){ unregProgress(); unregProgress = null; }
    }
  }

  function currentName(){
    const item = queue.find(q => q.id === currentId);
    return item ? (item.name || '图像') : '图像';
  }

  // ===== 历史 =====
  async function loadHistory(){
    history = await ocr.getHistory() || [];
    renderHistory();
  }
  function renderHistory(){
    if(!history.length){
      historyList.innerHTML = '<div class="history-empty">暂无历史记录</div>';
      return;
    }
    historyList.innerHTML = '';
    history.forEach(h => {
      const div = document.createElement('div');
      div.className = 'history-item';
      const time = document.createElement('div');
      time.className = 'hi-time';
      time.innerHTML = `<span>${fmtTime(h.time)}</span>`;
      const del = document.createElement('button');
      del.className = 'hi-del';
      del.textContent = '✕';
      del.title = '删除';
      del.addEventListener('click', (e) => { e.stopPropagation(); deleteHistory(h.id); });
      time.appendChild(del);
      const prev = document.createElement('div');
      prev.className = 'hi-preview';
      prev.textContent = h.preview || h.text || '(空)';
      div.appendChild(time);
      div.appendChild(prev);
      div.addEventListener('click', () => {
        setResult(h.text, h.confidence);
        historyPanel.classList.remove('open');
        toast('已载入历史结果');
      });
      historyList.appendChild(div);
    });
  }
  async function saveHistory(text, source, confidence){
    const entry = {
      id: 'h_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2,7),
      time: new Date().toISOString(),
      source: source || 'image',
      preview: (text||'').replace(/\n+/g,' ').slice(0,40) + ((text||'').length>40?'…':''),
      text: (text||'').replace(/\r\n?/g,'\n').replace(/[ \t]+$/gm,'').replace(/\n{3,}/g,'\n\n').replace(/^\s+|\s+$/g,''),
      confidence: typeof confidence === 'number' ? Math.round(confidence*10)/10 : null
    };
    history = [entry].concat(history).slice(0,50);
    await ocr.setHistory(history);
    renderHistory();
  }
  async function deleteHistory(id){
    history = history.filter(h => h.id !== id);
    await ocr.setHistory(history);
    renderHistory();
  }
  async function clearHistory(){
    if(!history.length){ toast('暂无历史'); return; }
    history = [];
    await ocr.setHistory(history);
    renderHistory();
    toast('历史已清空');
  }

  // ===== 设置 =====
  async function loadSettings(){
    settings = await ocr.getSettings() || { lang:'chi_sim+eng', autoCopy:false };
    langSelect.value = settings.lang || 'chi_sim+eng';
    autoCopy.checked = !!settings.autoCopy;
  }
  async function saveSettings(){
    settings.lang = langSelect.value;
    settings.autoCopy = autoCopy.checked;
    await ocr.setSettings(settings);
  }

  // ===== 事件绑定 =====
  function bind(){
    // 窗口控制
    $('btnMin').addEventListener('click', () => ocr.minimize());
    $('btnClose').addEventListener('click', () => ocr.close());

    // 选择文件
    $('btnFile').addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
      if(e.target.files.length) addImages(e.target.files, 'file');
      fileInput.value = '';
    });

    // 粘贴
    $('btnPaste').addEventListener('click', async () => {
      const img = await ocr.readClipboardImage();
      if(img.empty){ toast('剪贴板中没有图片'); return; }
      if(img.error){ toast('读取失败：' + img.error); return; }
      addDataUrl(img.dataUrl, '剪贴板图片', img.width, img.height);
      toast('已粘贴图片');
    });
    // Ctrl+V 粘贴
    document.addEventListener('keydown', (e) => {
      if((e.ctrlKey||e.metaKey) && e.key === 'v' && document.activeElement !== result){
        $('btnPaste').click();
      }
    });

    // 截图识别
    $('btnShot').addEventListener('click', doScreenshot);
    ocr.onTriggerScreenshot(() => doScreenshot());

    // 拖放
    ['dragenter','dragover'].forEach(ev => dropzone.addEventListener(ev, (e) => {
      e.preventDefault(); e.stopPropagation();
      dropzone.classList.add('dragover');
    }));
    ['dragleave','dragend'].forEach(ev => dropzone.addEventListener(ev, (e) => {
      e.preventDefault(); e.stopPropagation();
      dropzone.classList.remove('dragover');
    }));
    dropzone.addEventListener('drop', (e) => {
      e.preventDefault(); e.stopPropagation();
      dropzone.classList.remove('dragover');
      if(e.dataTransfer && e.dataTransfer.files.length){
        addImages(e.dataTransfer.files, 'drop');
      }
    });
    // 整窗拖放
    document.body.addEventListener('dragover', (e) => { e.preventDefault(); });
    document.body.addEventListener('drop', (e) => {
      e.preventDefault();
      if(e.dataTransfer && e.dataTransfer.files.length){
        addImages(e.dataTransfer.files, 'drop');
      }
    });

    // 识别
    $('btnRecognize').addEventListener('click', recognize);

    // 复制
    $('btnCopy').addEventListener('click', async () => {
      const t = result.value;
      if(!t){ toast('没有可复制的内容'); return; }
      const ok = await ocr.writeClipboardText(t);
      toast(ok ? '已复制' : '复制失败');
    });
    // 清空
    $('btnClear').addEventListener('click', () => { setResult(''); });
    // 导出
    $('btnExport').addEventListener('click', async () => {
      if(!result.value){ toast('没有可导出的内容'); return; }
      const r = await ocr.exportText({ text: result.value, name: currentName() });
      if(r && r.ok) toast('已导出');
      else if(r && r.error) toast('导出失败：' + r.error);
    });

    // 队列清空
    $('btnClearQueue').addEventListener('click', () => {
      queue = []; currentId = null; currentDataUrl = null;
      showEmptySource(); renderQueue();
    });

    // 历史
    $('btnHistory').addEventListener('click', () => historyPanel.classList.toggle('open'));
    $('btnClearHistory').addEventListener('click', clearHistory);

    // 语言/自动复制变更
    langSelect.addEventListener('change', saveSettings);
    autoCopy.addEventListener('change', saveSettings);

    // 结果输入实时统计
    result.addEventListener('input', () => { resultEmpty.classList.add('hidden'); updateStats(); });

    // 快捷键 Enter 识别（在非结果区聚焦时）
    document.addEventListener('keydown', (e) => {
      if(e.key === 'Enter' && (e.ctrlKey||e.metaKey)){ e.preventDefault(); recognize(); }
    });
  }

  async function doScreenshot(){
    toast('正在截取屏幕…', 1200);
    const r = await ocr.captureScreen();
    if(!r) return;
    if(r.cancelled){ return; }
    if(r.error){ toast('截图失败：' + r.error); return; }
    addDataUrl(r.dataUrl, '截图区域', r.width, r.height);
    // 截图后自动开始识别
    setTimeout(recognize, 120);
  }

  // ===== 初始化 =====
  function initLangSelect(){
    LANGS.forEach(l => {
      const opt = document.createElement('option');
      opt.value = l.code; opt.textContent = l.label;
      langSelect.appendChild(opt);
    });
  }
  async function init(){
    initLangSelect();
    bind();
    await loadSettings();
    await loadHistory();
    updateStats();
  }
  init();
})();
