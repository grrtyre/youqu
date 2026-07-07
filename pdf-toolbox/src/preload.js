// preload - 通过 contextBridge 暴露受限 API 给渲染层
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('pdfAPI', {
  // 文件选择
  selectPDFs: () => ipcRenderer.invoke('select-pdfs'),
  selectImages: () => ipcRenderer.invoke('select-images'),
  selectPDF: () => ipcRenderer.invoke('select-pdf'),
  savePDF: (defaultName) => ipcRenderer.invoke('save-pdf', defaultName),
  selectDir: () => ipcRenderer.invoke('select-dir'),
  getFileInfo: (filePath) => ipcRenderer.invoke('get-file-info', filePath),
  getPageCount: (filePath) => ipcRenderer.invoke('get-page-count', filePath),
  openInFolder: (filePath) => ipcRenderer.invoke('open-in-folder', filePath),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  getAfdianUrl: () => ipcRenderer.invoke('get-afdian-url'),

  // 业务操作
  mergePDFs: (filePaths, outputPath) => ipcRenderer.invoke('merge-pdfs', filePaths, outputPath),
  splitPDF: (inputPath, outputDir, opts) => ipcRenderer.invoke('split-pdf', inputPath, outputDir, opts),
  compressPDF: (inputPath, outputPath) => ipcRenderer.invoke('compress-pdf', inputPath, outputPath),
  encryptPDF: (inputPath, outputPath, opts) => ipcRenderer.invoke('encrypt-pdf', inputPath, outputPath, opts),
  decryptPDF: (inputPath, outputPath, password) => ipcRenderer.invoke('decrypt-pdf', inputPath, outputPath, password),
  addWatermark: (inputPath, outputPath, opts) => ipcRenderer.invoke('add-watermark', inputPath, outputPath, opts),
  imagesToPDF: (imagePaths, outputPath, opts) => ipcRenderer.invoke('images-to-pdf', imagePaths, outputPath, opts),

  // 进度回调
  onProgress: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('op-progress', handler);
    return () => ipcRenderer.removeListener('op-progress', handler);
  }
});
