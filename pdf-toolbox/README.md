# 📖 PDF管家

> Windows 上最纯净的本地 PDF 工具箱 —— 合并 / 拆分 / 压缩 / 加密 / 解密 / 加水印 / 图片转 PDF，全部离线处理，文件不上传任何服务器。

## ⬇️ 直接下载

| 平台 | 下载 | 说明 |
|------|------|------|
| Windows x64 | [PDF管家 Setup 1.0.0.exe](https://github.com/grrtyre/youqu/releases/download/pdf-toolbox-v1.0.0/PDFManager-Setup-1.0.0.exe) | 安装版（推荐） |
| Windows x64 | [PDF管家 1.0.0.exe](https://github.com/grrtyre/youqu/releases/download/pdf-toolbox-v1.0.0/PDFManager-1.0.0.exe) | 免安装便携版 |

> 下载链接在 Release 发布后自动可用。如显示 404，请稍候片刻等待 GitHub 处理。

---

## ✨ 功能

| 功能 | 说明 |
|------|------|
| 🔗 合并 PDF | 多个 PDF 按顺序合并为一个 |
| ✂️ 拆分 PDF | 每页一份 / 按范围拆分 / 抽取指定页 |
| 📦 压缩 PDF | 对象流重写 + 元数据清理，减小体积 |
| 🔒 加密 PDF | 设置打开密码，可选权限（打印/复制/修改/注释） |
| 🔓 解密 PDF | 输入正确密码去除保护 |
| 💧 加水印 | 文字水印，可调字号/不透明度/角度/密度/颜色 |
| 🖼 图片转 PDF | JPG/PNG 合成 PDF，支持 A4/Letter/适应图片 |

## 🔒 隐私

**所有 PDF 处理完全在本地进行**，不联网、不上传、不收集任何数据。你的文件只属于你。

## 🎨 设计

采用苹果白高端风格：白/浅灰背景、细腻多层阴影、系统字体（-apple-system, PingFang SC）、#007aff 蓝色强调。参考 macOS 原生应用设计语言。

## 🚀 使用

### 方式一：直接下载（推荐普通用户）
下载上方 exe，双击运行即可。

### 方式二：源码运行（开发者）
```bash
cd pdf-toolbox
npm install
npm start
```

## 🛠 技术栈

- Electron 28（桌面应用框架）
- @cantoo/pdf-lib（PDF 处理，支持 RC4/AES 真加密）
- 原生 JavaScript + CSS（无前端框架，极致轻量）

## 🧪 测试

```bash
npm test
```

包含 12 个测试用例、38 个断言，覆盖合并/拆分/压缩/加密/解密/水印/图片转 PDF 全部核心逻辑。

## 📁 项目结构

```
pdf-toolbox/
├── src/
│   ├── core/pdf-ops.js   # 核心 PDF 操作模块
│   ├── main.js           # Electron 主进程
│   ├── preload.js        # 预加载脚本（contextBridge）
│   └── renderer/         # 渲染进程
│       ├── index.html
│       ├── styles.css
│       └── renderer.js
├── build/
│   ├── icon.ico          # 应用图标
│   └── make_icon.py      # 图标生成脚本
├── test/test.js          # 测试
└── package.json
```

## ☕ 支持我们

如果这个工具对你有帮助，欢迎请我们喝杯咖啡 ❤️

👉 [爱发电 · giquwei](https://www.ifdian.net/a/giquwei)

## 🙏 鸣谢

感谢以下朋友的支持（按支持时间排序）：

<!-- 鸣谢名单占位 -->

_暂无，期待第一个支持者的出现。_

## 📄 License

MIT © grrtyre
