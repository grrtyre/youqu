# 🔐 验证器便携版 · Authenticator Portable

> 像输入法一样的 2FA 验证器 —— 需要时出现，不需要时隐藏，融入系统，不占桌面。

**authenticator-manager** 的原生便携版，使用 Python + customtkinter + Win32 API 重写，无 Electron 依赖。单文件 EXE，双击即用，托盘常驻，全局热键唤起，失焦自动隐藏。

## ✨ 便携版特性

| 特性 | 说明 |
| --- | --- |
| 🚀 **单文件 EXE** | 31 MB 自包含，无需安装 Python 或任何运行时 |
| 💾 **超低占用** | 运行内存 <50 MB，启动秒开 |
| 🎯 **全局热键** | `Ctrl+Shift+A` 唤起/隐藏，像输入法候选框 |
| 🫥 **失焦自动隐藏** | 窗口失焦立即收回，保持桌面整洁 |
| ☕ **系统托盘常驻** | 关闭即隐藏到托盘，右键菜单退出 |
| 🔒 **DPAPI 加密** | 密钥使用 Windows 系统 DPAPI 加密落盘，绑定用户账户 |
| ⏱ **倒计时环** | 圆环可视化剩余时间，≤10s 黄色、≤5s 红色 |
| 📋 **一键复制** | 点击账户卡片即复制验证码，可自动隐藏 |
| 🔗 **otpauth:// 解析** | 粘贴二维码扫码链接自动填充 |
| 🎨 **苹果白风格** | 白底浅灰、#007aff 蓝色强调、系统字体、细腻阴影 |
| ⌨️ **多算法支持** | SHA1 / SHA256 / SHA512，6/7/8 位 |

## 📥 下载

| 平台 | 下载 | 说明 |
| --- | --- | --- |
| Windows x64 | 见 [Releases](../../../../releases) | 单文件 EXE，双击即用 |

> 下载后双击 `AuthenticatorPortable.exe` 即可。应用自动驻留系统托盘，按 `Ctrl+Shift+A` 唤起。

## 🚀 快速开始

1. 下载 `AuthenticatorPortable.exe`
2. 双击运行，系统托盘出现锁形图标
3. 按 `Ctrl+Shift+A` 唤起窗口
4. 点击右上角 **+** 添加账户
5. 在需要 2FA 的网站扫码后复制 `otpauth://` 链接，粘贴到对话框
6. 点击账户卡片即可复制验证码

## ⌨️ 快捷键

| 快捷键 | 功能 |
| --- | --- |
| `Ctrl+Shift+A` | 全局热键：唤起/隐藏验证器窗口 |
| `点击账户卡片` | 复制当前验证码 |
| `点击托盘图标` | 显示窗口 |
| `Esc` | 关闭对话框 |
| `回车` | 保存对话框 |

## 🛠 技术栈

- **Python 3.12** —— 原生脚本语言
- **customtkinter 6.0** —— 现代化 tkinter 封装，圆角与苹果白风格
- **Win32 API（ctypes）** —— DPAPI 加密、RegisterHotKey 全局热键、Shell_NotifyIconW 托盘、PrintWindow 后台截图
- **Pillow** —— 图标与截图处理
- **PyInstaller** —— 单文件 EXE 打包

## 📁 项目结构

```
portable/
├── main.py                  # 入口：单实例锁 + 托盘热键 + UI 协调
├── totp.py                  # TOTP 核心：RFC 6238 + Base32 + otpauth 解析
├── storage.py               # DPAPI 加密存储 + 账户 CRUD
├── win32_api.py             # Win32 封装：单实例/热键/托盘/截图
├── styles.py                # 苹果白主题：颜色/字体/尺寸
├── ui.py                    # 主窗口 UI（customtkinter + Canvas）
├── test_totp.py             # RFC 6238 测试向量验证（12 项）
├── AuthenticatorPortable.spec  # PyInstaller 打包配置
├── icon.png / icon.ico      # 应用图标
└── README.md                # 本文件
```

## 🔒 安全说明

- **密钥加密**：账户密钥使用 Windows DPAPI 加密后存储，绑定当前用户账户
- **无网络**：应用不发起任何网络请求，所有数据本地存储
- **单实例**：通过命名 Mutex 保证仅运行一个实例
- **数据位置**：`%APPDATA%\AuthenticatorPortable\accounts.dat`

## 🎨 设计规范

- **配色**：苹果白 `#f5f5f7` 背景 / `#ffffff` 卡片 / `#007aff` 蓝色强调
- **字体**：`Segoe UI` / `Cascadia Code`（验证码）
- **圆角**：10-14px 三级圆角体系
- **风格**：禁止赛博朋克霓虹、深色毛玻璃

## 📝 与 Electron 版的区别

| 维度 | Electron 版 | 便携版 |
| --- | --- | --- |
| 体积 | ~150 MB | 31 MB |
| 内存 | ~200 MB | <50 MB |
| 启动 | 1-2s | <1s |
| 依赖 | Node.js + Chromium | 无（单 EXE） |
| 渲染 | Chromium | 原生 Win32 + tkinter |

## ☕ 支持我们

如果这个工具对你有帮助，欢迎支持我们继续开发更多实用工具：

[![爱发电](https://img.shields.io/badge/爱发电-支持我们-ff69b4)](https://www.ifdian.net/a/giquwei)

## 🙏 鸣谢

感谢以下朋友的支持（按支持时间排序）：

<!-- 鸣谢名单占位 -->

_暂无，期待第一个支持者的出现。_

## 📄 许可证

MIT License © 2026 Authenticator Portable
