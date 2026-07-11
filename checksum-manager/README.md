# 🛡️ 校验管家

> 苹果白风格的本地文件哈希校验工具 —— 拖放即算，一键校验下载文件完整性。

## ✨ 功能特性

- **五种哈希算法** —— 同时计算 MD5 / SHA1 / SHA256 / SHA512 / CRC32
- **完整性校验** —— 粘贴官方哈希值，自动识别算法并实时比对（绿色通过 / 红色不匹配）
- **拖放即用** —— 文件拖入窗口即可计算，支持任意类型与大小
- **批量处理** —— 多文件同时计算，结果一键导出为纯文本
- **流式计算** —— 大文件分块读取，实时进度条，不撑爆内存
- **智能识别** —— 依据哈希长度自动判断算法（8/32/40/64/128 位）
- **粘贴抽取** —— 粘贴「hash  文件名」格式的校验文本，自动提取哈希
- **历史记录** —— 自动保存最近 50 次计算结果，可随时回看复制
- **纯本地隐私** —— 所有计算在本机完成，文件内容绝不上传

## 📐 算法长度对照

| 算法 | 长度 | 用途 |
|---|---|---|
| CRC32 | 8 位 | 常见于压缩包校验 |
| MD5 | 32 位 | 旧式下载校验 |
| SHA1 | 40 位 | Git 提交校验 |
| SHA256 | 64 位 | 主流下载校验 |
| SHA512 | 128 位 | 高安全场景 |

## 🚀 使用方式

### 直接下载（推荐）

见下方「⬇️ 直接下载」章节，下载 exe 双击运行即可。

### 从源码运行

```bash
cd checksum-manager
npm install
npm start
```

### 基本流程

1. **计算哈希**：打开软件，拖入文件（或点击选择），自动计算五种哈希值
2. **校验完整性**：切换到「哈希校验」视图，在期望哈希值输入框粘贴官方提供的哈希
3. **复制结果**：点击每行右侧「复制」按钮，或将全部结果导出为文本

## 🧪 测试

```bash
npm test
```

核心逻辑覆盖 CRC32 / MD5 / SHA1 / SHA256 / SHA512 已知向量、文件流式计算、算法识别、文本抽取、格式化等。

## 🎨 设计风格

采用 **苹果白高端风格**：白色 / 浅灰背景、细腻阴影、系统字体（-apple-system, "PingFang SC"）、蓝色强调（#007aff），参考 macOS / iOS 原生设计。

## ⬇️ 直接下载

| 平台 | 下载 |
|---|---|
| Windows x64（安装版） | [checksum-manager-setup-1.0.0.exe](https://github.com/grrtyre/youqu/releases/download/checksum-manager-v1.0.0/checksum-manager-setup-1.0.0.exe) |
| Windows x64（便携版） | [checksum-manager-portable-1.0.0.exe](https://github.com/grrtyre/youqu/releases/download/checksum-manager-v1.0.0/checksum-manager-portable-1.0.0.exe) |

## 🛠️ 技术栈

- **Electron 28** —— 跨平台桌面框架
- **Node.js crypto** —— 哈希计算
- **原生 JS** —— 无前端框架依赖
- **electron-builder** —— 打包

## ☕ 支持我们

如果这个工具帮到了你，欢迎在爱发电请我们喝杯咖啡：

👉 [https://www.ifdian.net/a/giquwei](https://www.ifdian.net/a/giquwei)

你的支持是我们持续做下去的动力。

## 🙏 鸣谢

感谢以下朋友的支持（按支持时间排序）：

<!-- 鸣谢名单占位：有了支持者后在这里添加，格式：- [@用户名](主页链接) -->

_暂无，期待第一个支持者的出现。_

## 📄 License

[MIT License](./LICENSE)
