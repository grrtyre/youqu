# 🎬 剧集管家

> 本地追剧进度管理桌面工具 —— 记录剧集进度、状态、评分、统计，纯本地存储不联网。

## ⬇️ 直接下载

| 平台 | 下载 | 说明 |
|---|---|---|
| Windows x64 | [watching-manager-setup-1.0.0.exe](https://github.com/grrtyre/youqu/releases/download/watching-manager-v1.0.0/watching-manager-setup-1.0.0.exe) | 安装版，自动创建快捷方式 |
| Windows x64 | [watching-manager-portable-1.0.0.exe](https://github.com/grrtyre/youqu/releases/download/watching-manager-v1.0.0/watching-manager-portable-1.0.0.exe) | 便携版，双击即用 |

## ✨ 功能特点

- **剧集档案** —— 记录剧名、类型（电视剧/动漫/综艺/电影/纪录片）、状态（观看中/想看/已看完/弃剧）、季集进度、总季总集
- **一键推进** —— 「＋ 下一集」按钮快速标记看了下一集，到最终集自动标记已看完，跨季自动 +1
- **评分标签** —— 0-10 分评分、自定义标签、备注，多维度管理你的追剧档案
- **统计概览** —— 剧集总数、各状态分布、累计观看集数、平均评分、类型分布条形图、热门标签云
- **追剧提醒** —— 自动列出 3 天以上未更新进度的剧集，桌面通知提醒该追下一集了
- **搜索筛选** —— 关键词搜索（剧名/标签/备注）、按状态/类型筛选、5 种排序方式（最近更新/添加时间/上次观看/剧名/评分）
- **数据导入导出** —— JSON 格式备份迁移，同 ID 覆盖、不同 ID 追加，安全不丢失
- **海报管理** —— 自定义海报图片，或使用内置的抽象风格占位图
- **纯本地存储** —— 所有数据存储在本机，不联网、不上传、不收集任何信息
- **苹果白高端风格** —— 参考 macOS/iOS 原生设计，白色背景、细腻阴影、蓝色强调

## 🚀 使用方式

### 安装版
1. 下载 `剧集管家 Setup 1.0.0.exe`
2. 双击运行，按提示安装
3. 开始菜单或桌面快捷方式启动

### 便携版
1. 下载 `剧集管家 1.0.0.exe`
2. 双击运行，无需安装

### 基本操作
- 点击「＋ 添加剧集」创建新剧集档案
- 点击卡片可编辑详细信息
- 点击「＋ 下一集」快速推进进度
- 左侧导航切换：剧集库 / 统计 / 提醒 / 设置
- 设置页可导出/导入数据、支持我们

## 🛠️ 技术栈

- **Electron 28** —— 跨平台桌面应用框架
- **原生 JS** —— 无前端框架依赖，轻量高效
- **electron-store** —— 本地 JSON 持久化存储
- **contextBridge** —— 安全的 IPC 通信
- **苹果白高端风格** —— CSS 变量主题系统

## 📁 项目结构

```
watching-manager/
├── src/
│   ├── core/store.js        # 核心纯函数（可测试）
│   ├── main.js              # Electron 主进程
│   ├── preload.js           # 安全 IPC 桥接
│   └── renderer/            # 渲染层
│       ├── index.html
│       ├── styles.css
│       └── app.js
├── test/test.js             # 30 个单元测试
├── build/
│   ├── icon.ico             # 应用图标
│   ├── make_icon.py         # 图标生成脚本
│   ├── make_posters_local.py # Demo 海报生成
│   └── shot-bg.ps1          # 后台截图脚本
└── package.json
```

## 🧪 测试

```bash
node test/test.js
```

30 个测试用例覆盖：创建/更新/删除、进度推进、跨季逻辑、最终集标记、统计、筛选、排序、导入导出、端到端流程。

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
