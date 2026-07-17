<div align="center">

# 🔐 密码生成器 · Password Generator

**苹果白高端风格的本地密码生成与管理工具**

[![License: MIT](https://img.shields.io/badge/License-MIT-007aff.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![Platform: Windows](https://img.shields.io/badge/Platform-Windows-007aff.svg?style=flat-square)]()
[![Version](https://img.shields.io/badge/Version-1.1.0-007aff.svg?style=flat-square)]()
[![Style: Apple White](https://img.shields.io/badge/Style-苹果白-007aff.svg?style=flat-square)]()

</div>

---

> 🔒 **所有密码均在本地生成，不会上传或留存云端。** 基于 Node.js `crypto` 模块的密码学安全随机数生成器（CSPRNG），拒绝采样消除模偏置。

## ✨ 功能特性

| 模块 | 说明 |
| --- | --- |
| 🎲 **随机密码** | 4-64 位自定义长度，支持大小写、数字、符号，可排除易混字符 `il1Lo0O` |
| ⚡ **快速预设** | 内置 PIN / WiFi / 标准 / 高强 / 极强 五种场景预设，一键套用配置并生成 |
| 🌈 **字符高亮** | 密码展示区按字符类型上色（数字蓝 / 符号橙 / 字母默认），提升可读性 |
| 🧠 **记忆口令** | 3-8 词英文单词组合（80 词词库），可选分隔符、首字母大写、附加数字 |
| 📊 **强度检测** | 基于 Shannon 熵的实时评估，估算离线破解耗时，给出改进建议 |
| 📋 **批量生成** | 一次生成 5-50 个密码，一键复制全部 |
| 🕐 **历史记录** | 本地保存最近 50 条记录（localStorage），可随时清空 |

## 🖼️ 效果截图

<div align="center">

![密码生成器主界面](screenshots/password-generator-main.png)

*苹果白风格主界面 · 蓝色强调 #007aff · 细腻阴影*

</div>

## ⬇️ 下载安装

### 方式一：便携版（推荐）
- 前往 [GitHub Releases](https://github.com/grrtyre/youqu/releases) 下载 `PasswordGenerator-1.0.0-x64.exe`
- 双击即可运行，无需安装

### 方式二：安装版
- 下载 `PasswordGenerator-Setup-1.0.0-x64.exe`
- 运行安装程序，可选安装路径、创建桌面快捷方式

### 方式三：源码运行
```bash
# 安装依赖（建议使用淘宝镜像加速）
npm install --registry=https://registry.npmmirror.com

# 启动应用
npm start

# 运行测试
npm test

# 打包
npm run build
```

## ⌨️ 快捷键

| 快捷键 | 功能 |
| --- | --- |
| `Enter` | 生成密码 / 口令 |
| `Ctrl + C` | 复制当前密码（在显示区域） |
| `Tab` | 切换 Tab 标签页 |
| `Esc` | 清空强度检测输入 |

## 🎨 设计规范

- **配色**：苹果白 `#f5f5f7` 背景 / `#ffffff` 卡片 / `#007aff` 蓝色强调
- **阴影**：蓝色微调阴影 `0 2px 12px rgba(0,0,0,0.04), 0 1px 3px rgba(0,122,255,0.03)`
- **字体**：系统字体栈 `-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC"`
- **圆角**：8px / 12px / 16px 三级圆角体系
- **风格**：禁止赛博朋克霓虹、深色毛玻璃

## 📁 项目结构

```
password-generator/
├── main.js              # Electron 主进程 + 密码生成核心逻辑
├── preload.js           # 预加载脚本（contextBridge 安全桥接）
├── package.json         # 项目配置 + electron-builder 打包配置
├── src/
│   ├── index.html       # 渲染进程 HTML（5 个 Tab 面板）
│   ├── styles.css       # 苹果白风格样式表
│   └── renderer.js      # 渲染进程逻辑 + 截图回退 mock
├── test/
│   └── test.js          # 16 个单元测试（Node assert）
├── assets/
│   ├── icon.png         # 应用图标（256×256）
│   └── icon.ico         # Windows 多尺寸图标
├── LICENSE              # MIT 许可证
└── README.md            # 项目说明
```

## 🔬 安全实现

### 密码学安全随机数
```javascript
// 使用 Node.js crypto 模块，非 Math.random()
function secureRandomInt(max) {
  const maxUint32 = 0xFFFFFFFF;
  const limit = maxUint32 - (maxUint32 % max);
  const buf = crypto.randomBytes(4);
  let val = buf.readUInt32BE(0);
  while (val >= limit) {
    val = crypto.randomBytes(4).readUInt32BE(0);
  }
  return val % max;
}
```

### 强度评估算法
- **熵值计算**：`entropy = length × log2(poolSize)`
- **评分等级**：0-6 分（无 / 极弱 / 弱 / 一般 / 强 / 很强 / 极强）
- **破解估算**：假设离线攻击速度 10¹⁰ 次/秒

## 📝 更新日志

### v1.1.0 (2026-07-17)
- ⚡ 新增「快速预设」：PIN / WiFi / 标准 / 高强 / 极强 五种场景一键套用
- 🌈 新增密码字符高亮：数字蓝色、符号橙色，提升可读性与高级感
- 📊 密码卡片新增元信息行（长度 / 字符池 / 熵值 / 破解耗时）
- 🔤 等宽字体精修：扩展字体栈（JetBrains Mono / Cascadia Code），关闭连字，启用 tabular-nums
- 🎚️ 滑块精修：thumb 居中修正、hover 环扩展、active 反馈、Firefox 兼容
- 📈 强度条语义色精修：六阶平滑渐变 + 同色微光，语义更清晰

### v1.0.0 (2026-07-15)
- 🎉 首次发布
- ✅ 随机密码生成（4-64 位，支持字符类型与易混字符排除）
- ✅ 记忆口令生成（3-8 词，80 词词库）
- ✅ 强度检测（熵值 + 破解耗时估算）
- ✅ 批量生成（5-50 个）
- ✅ 本地历史记录（最多 50 条）
- ✅ 苹果白高端风格 UI

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

[MIT License](LICENSE) · Copyright (c) 2026 youqu

</div>
