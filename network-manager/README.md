# 🌐 网络管家

> 本地优先的网络诊断一体化桌面应用：Ping / 路由追踪 / DNS 查询 / 端口检测 / HTTP 头分析 / Whois / IP 归属，7 合 1，苹果白高端风格，纯本地隐私优先。

一个窗口搞定日常网络诊断。无需记忆命令行参数，可视化结果一目了然，历史记录随时回看。

## ✨ 功能特性

- **7 大诊断工具** —— 一个应用集成 Ping、路由追踪、DNS 查询、端口检测、HTTP 头分析、Whois 域名信息、IP 归属查询
- **Ping 探测** —— 延迟柱状图 + 统计卡片（发送/接收/丢包/平均），明细表（IP/延迟/TTL/字节），延迟颜色分级（极优/良好/一般/较差）
- **路由追踪** —— 逐跳可视化，三次探测时间，超时标记，主机名与 IP 分离显示
- **DNS 查询** —— 支持 A / AAAA / MX / NS / TXT / CNAME / SOA 七种记录类型，类型色彩区分
- **端口检测** —— TCP 连接测试，开放/不可达状态卡片，超时可调（2-8 秒），精确到毫秒
- **HTTP 头分析** —— 状态码色彩分级（2xx 绿/3xx 橙/4xx+ 红），全部响应头键值列表，响应耗时
- **Whois 域名信息** —— 注册商、注册/到期/更新时间、域名服务器、域名状态，原始数据可展开
- **IP 归属查询** —— 国家/省/市/邮编/经纬度/时区/运营商/AS 信息，留空查询本机公网 IP，一键查看本机网络配置
- **诊断历史** —— 自动记录每次诊断（工具/目标/摘要/时间），最多 100 条，一键清空
- **回车快捷** —— 所有输入框支持回车直接执行
- **苹果白高端风格** —— 参考 macOS 原生设计，白底浅灰、细腻多层阴影、系统字体、蓝色 `#007aff` 强调

## 📥 直接下载

| 平台 | 下载 | 说明 |
|------|------|------|
| Windows x64 | [网络管家 Setup 1.0.0.exe](https://github.com/grrtyre/youqu/releases/download/network-manager-v1.0.0/网络管家.Setup.1.0.0.exe) | 安装版，自动创建快捷方式 |
| Windows x64 | [网络管家 1.0.0.exe](https://github.com/grrtyre/youqu/releases/download/network-manager-v1.0.0/网络管家.1.0.0.exe) | 便携版，双击即用 |

> 前往 [Releases 页面](https://github.com/grrtyre/youqu/releases/tag/network-manager-v1.0.0) 查看所有版本。

## 🚀 使用方式

### 方式一：直接下载（推荐）
前往 [Releases](https://github.com/grrtyre/youqu/releases) 下载「网络管家 Setup 1.0.0.exe」安装版，或「网络管家 1.0.0.exe」便携版双击即用。

### 方式二：源码运行
```bash
npm install
npm start
```

### 打包
```bash
npm run dist
```
产物在 `dist/` 目录。

环境要求：Node.js 16+，Windows 10/11 x64。

## 🛠 诊断工具说明

| 工具 | 用途 | 示例输入 |
|------|------|----------|
| Ping 探测 | 测试连通性与延迟 | `baidu.com` 或 `8.8.8.8` |
| 路由追踪 | 追踪数据包经过的每一跳 | `github.com` |
| DNS 查询 | 查询域名 DNS 记录 | `example.com`，类型选 MX |
| 端口检测 | 判断远程端口是否开放 | 主机 `baidu.com`，端口 `443` |
| HTTP 头分析 | 获取 URL 响应状态与响应头 | `https://www.baidu.com` |
| Whois 域名 | 查询域名注册商与到期时间 | `google.com` |
| IP 归属 | 查询 IP 地理位置与运营商 | 留空查本机，或输入 `8.8.8.8` |

所有输入框支持 **回车快捷执行**。

## 🧱 技术栈

- **Electron 31** —— 跨平台桌面应用框架
- **原生 JavaScript** —— 零运行时框架依赖，核心逻辑纯函数实现
- **electron-builder** —— 打包成 Windows 安装包与便携版
- **PIL (Python)** —— 图标生成

项目结构：

```
network-manager/
├── src/
│   ├── core/
│   │   └── net-core.js       # 核心纯函数（输入校验、命令输出解析、格式化）
│   ├── main.js                # Electron 主进程（窗口、IPC、系统命令调用）
│   ├── preload.js             # 安全 IPC 桥
│   └── renderer/
│       ├── index.html         # 界面结构
│       ├── styles.css         # 苹果白高端风格样式
│       └── renderer.js        # 渲染层逻辑（7 大工具交互、历史、演示模式）
├── test/test.js               # 核心逻辑测试（116 项断言）
├── build/                     # 图标资源
└── package.json
```

## 🧪 测试

核心逻辑（输入校验、Ping/Tracert/DNS/Whois/HTTP 输出解析、延迟分级、字节格式化、相对时间）均有自动化测试覆盖：

```bash
npm test
```

共 **116 项断言**，覆盖纯函数逻辑，无外部依赖。

## 📐 设计理念

- **隐私优先** —— Whois 与 IP 查询走公开 API，不收集不上传任何用户数据，诊断历史纯本地存储
- **苹果白高端风格** —— 参考 macOS 原生设计：白底浅灰、细腻多层阴影、系统字体（-apple-system / PingFang SC）、蓝色 `#007aff` 强调，拒绝赛博朋克霓虹与深色毛玻璃
- **纯函数核心** —— 所有命令输出解析与校验逻辑为纯函数，便于测试与维护
- **零框架依赖** —— 渲染层原生 JS，启动快、体积小

## 📝 更新日志

### v1.0.0
- 🎉 首个发布版本
- 7 大网络诊断工具：Ping / 路由追踪 / DNS / 端口检测 / HTTP 头 / Whois / IP 归属
- 诊断历史记录（最多 100 条）
- 苹果白高端风格 UI

## 🔒 隐私

- 诊断历史全部保存在本地，不联网、不上传、不收集任何信息
- Whois 与 IP 归属查询需联网（调用公开 API），仅用于获取域名/IP 的公开信息

## ☕ 支持我们

如果这个工具帮到了你，欢迎在爱发电请我们喝杯咖啡：

👉 [https://www.ifdian.net/a/giquwei](https://www.ifdian.net/a/giquwei)

你的支持是我们持续做下去的动力。

## 🙏 鸣谢

感谢以下朋友的支持（按支持时间排序）：

<!-- 鸣谢名单占位 -->

_暂无，期待第一个支持者的出现。_

## 📄 License

[MIT License](./LICENSE)，可自由使用。
