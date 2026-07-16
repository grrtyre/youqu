<div align="center">

# 🧮 计算器管家

**苹果白高端风格的桌面科学计算器**

<img alt="version" src="https://img.shields.io/badge/%E7%89%88%E6%9C%AC-v1.1.0-007aff?style=flat-square">
<img alt="platform" src="https://img.shields.io/badge/%E5%B9%B3%E5%8F%B0-Windows%20x64-007aff?style=flat-square">
<img alt="license" src="https://img.shields.io/badge/License-MIT-34c759?style=flat-square">
<img alt="tests" src="https://img.shields.io/badge/%E6%B5%8B%E8%AF%95-173%20%E7%94%A8%E4%BE%8B-007aff?style=flat-square">

<em>表达式求值 · 变量定义 · 程序员模式 · 单位转换 · 历史记录</em>

</div>

> 纯本地隐私优先 · 自研表达式引擎 · 四种计算模式 · 零网络请求 · 即开即用

---

## 🖼 效果展示

<p align="center">
  <img src="./preview.png" alt="计算器管家主界面预览" width="760">
</p>

## ⬇️ 直接下载

<table align="center" width="100%">
<tr>
<td align="center" valign="middle" style="padding:16px;border:1px solid #e1e4e8;border-radius:12px;background:#ffffff;box-shadow:0 2px 10px rgba(0,0,0,0.05);">
<h4 align="center">🪟 Windows x64</h4>
<p align="center"><a href="../../releases/download/calculator-manager-v1.1.0/calculator-manager-1.1.0-setup.exe"><b>⬇ 计算器管家 1.1.0 Setup.exe</b></a><br><em>约 73 MB · 一键安装</em></p>
</td>
</tr>
</table>

> 也可在 [Releases 页面](../../releases) 查看所有版本。

---

## ✨ 功能特性

### 四种计算模式

<table align="center" width="100%">
<tr>
<td width="50%" align="center" valign="top" style="padding:14px;border:1px solid #e6e8eb;border-radius:10px;background:#fbfcfd;">
<h4 align="center">🧮 基础模式</h4>
<p align="center"><em>简洁的四则运算键盘<br>类似 iOS 计算器</em></p>
</td>
<td width="50%" align="center" valign="top" style="padding:14px;border:1px solid #e6e8eb;border-radius:10px;background:#fbfcfd;">
<h4 align="center">🔬 科学模式</h4>
<p align="center"><em>三角函数 · 对数 · 指数<br>阶乘 · 幂 · 根号 · 绝对值</em></p>
</td>
</tr>
<tr>
<td width="50%" align="center" valign="top" style="padding:14px;border:1px solid #e6e8eb;border-radius:10px;background:#fbfcfd;">
<h4 align="center">💻 程序员模式</h4>
<p align="center"><em>二/八/十/十六进制实时转换<br>位运算 AND/OR/XOR/NOT/SHL/SHR</em></p>
</td>
<td width="50%" align="center" valign="top" style="padding:14px;border:1px solid #e6e8eb;border-radius:10px;background:#fbfcfd;">
<h4 align="center">🔄 转换模式</h4>
<p align="center"><em>十大类单位互转<br>长度/重量/温度/面积/体积/速度/数据/时间/角度/压力</em></p>
</td>
</tr>
</table>

### 自研表达式引擎（无第三方依赖）

- 完整词法 + Shunting Yard 语法分析 + RPN 求值
- 支持括号嵌套、运算优先级、一元负号、后缀阶乘
- 支持常量 `pi`、`e`、`tau`、`phi`
- 支持多参数函数：`pow(2,10)`、`gcd(12,18)`、`max(3,7)` 等

<details>
<summary><b>支持的 20+ 函数（点击展开）</b></summary>

| 类别 | 函数 |
|:---:|---|
| 三角函数 | `sin` `cos` `tan` `asin` `acos` `atan` |
| 双曲函数 | `sinh` `cosh` `tanh` |
| 对数指数 | `log` `ln` `log2` `exp` |
| 根号取整 | `sqrt` `cbrt` `floor` `ceil` `round` `abs` `sign` |
| 多参数 | `pow` `atan2` `max` `min` `gcd` `lcm` `rand` |

</details>

### 变量系统

在表达式区输入 `x = 5` 即可定义变量，可在后续计算中引用，变量持久化存储、重启后保留。

```
x = 5                  → 已设置 x = 5
x * x + 2 * x + 1      → 36
```

### 其他亮点

- **历史记录** —— 所有计算自动保存到本地，可点击复用、删除、清空
- **程序员模式特性** —— 实时显示 HEX / DEC / OCT / BIN 四种进制，支持 `0xFF`、`0b1010`、`0o17` 进制前缀输入，一键复制任一进制结果
- **苹果白高端风格** —— 参考 macOS/iOS 原生设计，浅灰白底、细腻阴影、系统字体、蓝色强调（#007aff），圆角按钮、平滑过渡动画

---

## 🚀 快速开始

### 方式一：下载可执行文件
1. 在上方「⬇️ 直接下载」章节下载 `.exe` 安装包
2. 双击运行安装，从开始菜单或桌面快捷方式启动

### 方式二：从源码运行
```bash
# 安装依赖
npm install

# 开发模式启动
npm start

# 运行核心逻辑测试
npm test
```

---

## ⌨️ 快捷键

| 快捷键 | 功能 | 适用模式 |
|:---:|---|:---:|
| `Enter` | 执行计算 | 全部 |
| `Esc` | 清空输入 | 全部 |
| `↑` / `↓` | 浏览历史记录 | 全部 |
| `Tab` / `Shift+Tab` | 切换计算模式 | 全部 |
| 直接输入 | 数字与运算符 | 全部 |
| `0xFF` / `0b1010` / `0o17` | 进制前缀输入 | 程序员 |
| 点击进制结果 | 一键复制对应进制 | 程序员 |
| 点击历史项 | 复用历史表达式 | 全部 |

---

## 📐 操作示例

### 基础计算
```
2 + 3 * 4              → 14
(2 + 3) * 4            → 20
15 / 4                 → 3.75
2 ^ 10                 → 1024
10 % 3                 → 1
```

### 科学计算
```
sin(pi/4)^2 + cos(pi/4)^2   → 1
log(1000)                    → 3
sqrt(16)                     → 4
5!                           → 120
2^0.5                        → 1.414213562373
```

### 变量定义
```
x = 5                        → 已设置 x = 5
x * x + 2 * x + 1            → 36
y = x + 10                   → 已设置 y = 15
y * 2                        → 30
```

### 程序员模式
```
0xFF + 0x01                  → 256
0b1010 and 0b0011            → 2
0xF0 or 0x0F                 → 255
1 shl 4                      → 16
not 0                        → -1
```

---

## 🛠 技术栈

- **Electron 28** —— 跨平台桌面应用框架
- **原生 JavaScript** —— 无框架依赖（无 React/Vue）
- **自研表达式引擎** —— 词法分析 + Shunting Yard + RPN 求值
- **electron-builder** —— 打包发布
- **苹果白高端风格** —— 参考 macOS/iOS 设计

---

## 📁 项目结构

```
calculator-manager/
├── src/
│   ├── core/
│   │   ├── calc-engine.js    # 计算引擎（词法+语法+求值）
│   │   └── history-store.js  # 历史与变量持久化
│   ├── renderer/
│   │   ├── index.html        # 主界面
│   │   ├── styles.css        # 苹果白风格样式
│   │   └── renderer.js       # 渲染逻辑
│   ├── main.js               # 主进程
│   └── preload.js            # 预加载脚本
├── test/
│   └── test.js               # 核心逻辑测试
├── build/
│   ├── icon.ico              # 应用图标
│   ├── icon-source.png       # 图标源文件
│   └── make_icon.py          # 图标生成脚本
└── package.json
```

---

## 🔒 隐私说明

- **完全本地** —— 所有计算、历史记录、变量仅保存在你的本地电脑
- **无网络请求** —— 不上传任何数据
- **存储位置** —— 用户数据目录（如 `%APPDATA%/calculator-manager/`）

---

## 🧪 测试覆盖

核心计算引擎与单位转换有 **173 个自动化测试用例**，覆盖：
- 基础四则运算、运算优先级、括号嵌套
- 小数与科学计数法
- 三角函数、对数指数、根号、绝对值、取整
- 阶乘（含 Gamma 函数）、多参数函数
- 常量、变量、赋值
- 错误处理（除零、模零、未知标识符、括号不匹配等）
- 进制前缀（0x/0b/0o）、程序员模式位运算
- 进制转换 API、格式化输出、边界情况
- 单位转换（长度、重量、温度、面积、体积、速度、数据、时间、角度、压力、容错）

运行测试：
```bash
npm test
```

---

## 📝 更新日志

### v1.1.0（2026-07-13）

- **新增「转换」模式** —— 十大类单位实时互转（长度/重量/温度/面积/体积/速度/数据/时间/角度/压力）
- **新增「常见换算参考」网格** —— 点击即填入，一键查看 1 个单位换算为其他单位的值
- **新增 68 个单位转换测试用例** —— 测试总数从 105 增至 173，全部通过
- **UI 优化** —— Tab 改为分段控件风格（白底+蓝色文字激活态），结果区加左侧蓝色竖条强调，交换按钮改为蓝色实心圆角矩形，历史卡片增强阴影层次，参考卡片改为单行紧凑布局
- **新增 `getCommonConversions` API** —— 暴露常用换算对给前端，支持点击填入

### v1.0.0

- 首个正式版本：科学/基础/程序员三模式、变量系统、历史记录、自研表达式引擎

---

## ☕ 支持我们

如果这个工具帮到了你，欢迎在爱发电请我们喝杯咖啡：

👉 [https://www.ifdian.net/a/giquwei](https://www.ifdian.net/a/giquwei)

你的支持是我们持续做下去的动力。

## 🙏 鸣谢

感谢以下朋友的支持（按支持时间排序）：

<!-- 鸣谢名单占位：有了支持者后在这里添加，格式：- [@用户名](主页链接) -->

_暂无，期待第一个支持者的出现。_

---

## 📄 License

[MIT License](./LICENSE) © youqu
