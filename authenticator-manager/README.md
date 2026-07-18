<div align="center">

# 🔐 验证器 · Authenticator Manager

**苹果白风格的本地两步验证（2FA / TOTP）桌面应用**

安全存储 TOTP 密钥 · 一键复制动态验证码 · 系统托盘常驻 · 全局热键唤起

![platform](https://img.shields.io/badge/platform-Windows-blue)
![license](https://img.shields.io/badge/license-MIT-green)
![style](https://img.shields.io/badge/style-苹果白-white)
![electron](https://img.shields.io/badge/Electron-28-47848F)

</div>

---

## ✨ 功能特色

- **本地加密存储** —— 密钥使用系统级 DPAPI（Windows）加密落盘，绝不离开本机
- **一键复制验证码** —— 点击账户卡片即复制 6/7/8 位动态码，复制后可自动隐藏
- **倒计时可视化** —— 圆环倒计时，剩余 ≤10s 黄色提示，≤5s 红色警示
- **全局热键唤起** —— 默认 `Ctrl+Shift+A` 随时唤起/隐藏，按需出现不抢焦点
- **系统托盘常驻** —— 关闭即隐藏到托盘，类似输入法般的存在感
- **失焦自动隐藏** —— 窗口失焦自动收回，保持桌面整洁
- **otpauth:// 解析** —— 粘贴二维码扫码得到的 `otpauth://` 链接自动解析
- **加密备份导入/导出** —— AES-256-GCM 加密备份，一次性口令保护
- **支持 SHA1 / SHA256 / SHA512** —— 兼容主流 2FA 服务
- **苹果白高端风格** —— 白底、#007aff 蓝色强调、系统字体、细腻阴影

## 📥 下载

| 平台 | 形态 | 说明 |
| --- | --- | --- |
| Windows | 便携版 EXE | 单文件免安装，下载即用 |

> 下载地址见 GitHub Release 页面。

## 🎨 效果展示

<div align="center">

**主界面**：账户列表 + 倒计时环 + 一键复制

**添加账户**：支持手动输入或粘贴 `otpauth://` 链接

**设置面板**：热键 / 自动隐藏 / 备份导入导出

</div>

## 🚀 快速开始

### 用户使用

1. 下载便携版 EXE
2. 双击运行，应用自动驻留系统托盘
3. 按 `Ctrl+Shift+A` 唤起窗口
4. 点击右下角 **+** 添加账户
5. 在需要 2FA 的网站扫码后复制 `otpauth://` 链接，粘贴到密钥栏
6. 点击账户卡片即可复制验证码

### 开发者运行

```bash
# 安装依赖（国内推荐使用镜像加速）
npm config set registry https://registry.npmmirror.com
npm config set electron_mirror https://registry.npmmirror.com/-binary/electron/
npm config set electron_builder_binaries_mirror https://registry.npmmirror.com/-binary/electron-builder-binaries/

npm install
npm start          # 启动开发
npm test           # 运行 TOTP 单元测试（RFC 6238 向量）
npm run build      # 打包便携版 EXE
```

## ⌨️ 快捷键

| 快捷键 | 功能 |
| --- | --- |
| `Ctrl+Shift+A` | 全局热键：唤起 / 隐藏验证器窗口（可自定义） |
| `Ctrl+F` | 聚焦搜索框 |
| `Esc` | 关闭对话框 |
| `点击账户卡片` | 复制当前验证码 |
| `点击托盘图标` | 显示窗口 |

## 🗂️ 项目结构

```
authenticator-manager/
├── main.js              # Electron 主进程：托盘 / 热键 / 加密存储 / IPC
├── preload.js           # 预加载脚本：contextBridge 暴露安全 API
├── src/
│   ├── index.html       # 主界面（苹果白）
│   ├── styles.css       # 样式（#007aff 强调 / 系统字体 / 细腻阴影）
│   └── renderer.js      # 渲染进程：TOTP 生成 / 列表渲染 / 增删改查
├── test/
│   └── totp.test.js     # RFC 6238 测试向量验证
├── build/
│   └── icon.ico         # 应用图标（含 16/32/48/64/128/256 多尺寸）
├── package.json
├── LICENSE
└── README.md
```

## 🔒 安全说明

- **密钥加密**：账户密钥使用 Electron `safeStorage`（Windows 上为 DPAPI）加密后存储，绑定当前用户账户
- **内存安全**：渲染进程通过 `contextBridge` 隔离，仅暴露最小化 API；加解密在主进程完成
- **备份加密**：导出备份使用 AES-256-GCM + 一次性随机口令（SHA-256 派生密钥）
- **无网络**：应用不发起任何网络请求，所有数据本地存储
- **单实例**：通过 `requestSingleInstanceLock` 保证仅运行一个实例

> ⚠️ 重要提示：请定期导出加密备份并妥善保存口令。若丢失密钥且无备份，将无法登录对应账户的 2FA。

## 🛠️ 技术栈

- **Electron 28** —— 跨平台桌面应用框架
- **Web Crypto API** —— 浏览器原生 HMAC-SHA1/256/512 实现，零依赖
- **electron-store** —— 加密配置存储
- **原生 TOTP** —— 自实现 RFC 6238，无第三方运行时依赖

## 📝 更新日志

### v1.0.0 (2026-07)

- 🎉 首个正式版本
- TOTP 验证码生成（SHA1/256/512，6/7/8 位）
- 系统托盘常驻 + 全局热键
- 失焦自动隐藏 + 复制后隐藏
- AES-256-GCM 加密备份导入导出
- otpauth:// URI 解析
- 苹果白高端风格 UI

## ☕ 支持我们

如果这个工具对你有帮助，欢迎请我们喝杯咖啡 ☕

**[爱发电支持](https://www.ifdian.net/a/giquwei)**

你的支持是我们持续优化、开发更多实用工具的动力。

## 🙏 鸣谢

感谢以下朋友的支持（按支持时间排序）：

<!-- 鸣谢名单占位 -->

_暂无，期待第一个支持者的出现。_

## 📄 许可证

[MIT License](LICENSE) © 2026 youqu
