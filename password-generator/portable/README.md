<div align="center">

# 🔐 密码生成器 · 便携版

**原生 PySide6 重写 · 像输入法一样的小组件**

按热键秒级唤起 · 失焦自动隐藏 · 系统托盘常驻 · 单 EXE 便携 · 苹果白高端风格

</div>

---

> 这是 [password-generator](../README.md) 的**原生便携版**，用 Python + PySide6 重写，不是 Electron 套壳。
> 理念：像输入法一样——需要时出现，不需要时隐藏，融入系统，不占桌面。

## ✨ 便携版特性

| 特性 | 说明 |
| --- | --- |
| 🎯 **全局热键唤起** | `Ctrl+Shift+P` 随时唤起，回退到 `F8`（Win32 RegisterHotKey，无注入式钩子，不触发杀软） |
| 👻 **失焦自动隐藏** | 输入法式行为，点到别处即隐藏，不抢焦点、不挡视线 |
| 📌 **系统托盘常驻** | 关闭即藏，托盘菜单：唤起 / 生成 / 退出 |
| 🪟 **小界面** | 380×460（≤400×500），鼠标附近弹出，不挡当前工作 |
| 🔐 **密码学安全** | Python `secrets` 模块（OS CSPRNG），无 `random()` 弱随机 |
| 🎨 **苹果白风格** | 白色卡片 · 细腻阴影 · #007aff 蓝色强调 · 系统字体 |
| 🌈 **字符高亮** | 数字蓝色 · 符号橙色，提升可读性 |
| ⚡ **快速预设** | PIN / WiFi / 标准 / 高强 / 极高 五种场景一键套用 |
| 🧠 **记忆口令** | 3-8 词英文组合，可选分隔符、首字母大写、附加数字 |
| 📊 **强度检测** | Shannon 熵 + 离线破解耗时估算 |
| 🕐 **本地历史** | 最近 50 条，点击复制，纯本地不联网 |
| 💾 **设置记忆** | 上次配置自动还原 |

## ⬇️ 下载

| 版本 | 说明 |
| --- | --- |
| 便携版单 EXE | 双击即用，不写注册表，数据存 `%APPDATA%/PasswordGeneratorPortable/` |

前往 [Releases](../../../../releases) 下载 `PasswordGeneratorPortable.exe`。

## ⌨️ 快捷键

| 快捷键 | 功能 |
| --- | --- |
| `Ctrl + Shift + P` | 全局唤起 / 隐藏 |
| `Enter` | 重新生成 |
| `Ctrl + C` | 复制当前密码 |
| `Esc` | 隐藏窗口 |
| 点击历史项 | 复制该项 |

## 🚀 从源码运行

```bash
cd portable
pip install -r requirements.txt
python main.py
```

## 🔨 构建

```bash
cd portable
# 先确保 build/icon.ico 存在（resources.py 会用 PIL 自动生成）
python -c "import resources; print(resources.ensure_icon())"
pyinstaller password_generator_portable.spec --noconfirm --clean
# 产物：dist/PasswordGeneratorPortable.exe
```

## 🧪 测试

```bash
cd portable
python -m pytest tests/test_core.py -v
# 或
python tests/test_core.py
```

## 📁 目录结构

```
portable/
├── main.py                            # PySide6 主程序（窗口 + 托盘 + 热键 + 失焦隐藏）
├── pg_core.py                         # 密码生成核心逻辑（secrets 模块）
├── store.py                           # 历史与设置持久化（%APPDATA% JSON）
├── resources.py                       # PIL 生成苹果白图标（运行时兜底）
├── tests/
│   └── test_core.py                   # 核心逻辑单元测试
├── build/
│   ├── icon.ico                       # 多尺寸图标（16-256）
│   └── icon.png                       # 256 预览
├── requirements.txt                   # PySide6 + Pillow
├── password_generator_portable.spec   # PyInstaller 单文件打包配置
└── README.md                          # 本文件
```

## 🎨 设计规范

- **配色**：背景 `#f5f5f7` / 卡片 `#ffffff` / 强调 `#007aff`
- **阴影**：细腻微调阴影，禁止深色毛玻璃
- **字体**：Segoe UI / PingFang SC / -apple-system；密码区 Consolas / Cascadia Code 等宽
- **圆角**：8 / 12 / 14 三级
- **风格**：禁止赛博朋克霓虹

## 🔬 安全

- 使用 Python 标准库 `secrets`（基于 Windows BCryptGenRandom / CryptGenRandom）
- 无 `random.random()` 等弱随机
- 所有密码仅本地生成，不联网不上传
- 历史记录存 `%APPDATA%`，可随时清空

## ☕ 支持我们

如果这个工具对你有帮助，欢迎请我们喝杯咖啡 ☕

<div align="center">

**[💖 爱发电支持我们](https://www.ifdian.net/a/giquwei)**

</div>

## 🙏 鸣谢

感谢以下朋友的支持（按支持时间排序）：

<!-- 鸣谢名单占位 -->

_暂无，期待第一个支持者的出现。_

## 📄 许可证

[MIT License](../LICENSE) · Copyright (c) 2026 youqu
