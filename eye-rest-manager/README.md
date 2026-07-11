# 👁 护眼管家

> Windows 上优雅的护眼休息提醒桌面管家 —— 基于 20-20-20 法则，定时提醒休息、引导眼保健操、本地统计追踪。

## ✨ 功能特性

- **20-20-20 法则** — 每使用电脑 20 分钟，看 20 英尺（约 6 米）外的物体 20 秒
- **三级休息周期** — 微休息（20秒）/ 短休息（3分钟）/ 长休息（10分钟），可自定义间隔和时长
- **眼保健操引导** — 6 种护眼动作（眨眼、远眺、旋转、捂眼、焦点切换、喝水），休息时引导完成
- **休息覆盖层** — 全屏休息引导界面，圆环倒计时 + 动作演示 + 进度指示
- **本地统计** — 今日完成/跳过次数、累计护眼时长、连续达标天数、近 7 天柱状图
- **智能调度** — 免打扰时段、全屏自动推迟、休息前预警通知、系统托盘常驻
- **数据导入导出** — JSON 格式备份恢复，纯本地存储，不联网不上传

## 📸 截图

![护眼管家主界面](./build/screenshot.png)

## 🚀 下载使用

### 方式一：安装版（推荐）

下载 `护眼管家.Setup.1.0.1.exe`，双击安装后即可使用。

👉 [前往 GitHub Releases 下载](https://github.com/grrtyre/youqu/releases)

### 方式二：便携版

下载 `护眼管家.Portable.1.0.1.exe`，无需安装，双击即用。

## 🛠 技术栈

- **Electron 28** — 跨平台桌面应用框架
- **原生 JavaScript** — 无前端框架依赖，轻量高效
- **SVG 圆环倒计时** — 纯 CSS 动画驱动
- **JSON 持久化** — 原子写入 + 滚动淘汰历史记录

## 📁 项目结构

```
eye-rest-manager/
├── src/
│   ├── main.js              # 主进程：窗口/托盘/调度/IPC
│   ├── preload.js           # IPC 安全桥
│   ├── core/
│   │   ├── break-engine.js  # 休息调度引擎
│   │   ├── exercises.js     # 眼保健操动作库
│   │   ├── store.js         # 数据持久化
│   │   └── stats-utils.js   # 统计聚合
│   └── renderer/
│       ├── index.html       # 主仪表盘
│       ├── overlay.html     # 休息覆盖层
│       ├── styles.css       # 苹果白高端风格
│       ├── renderer.js      # 主界面逻辑
│       └── overlay.js       # 覆盖层逻辑
├── test/
│   └── test.js              # 24 个单元测试
├── build/
│   ├── icon.ico             # 应用图标
│   └── screenshot.ps1       # PrintWindow 后台截图脚本
└── package.json
```

## 🧪 测试

```bash
npm test
```

24 个单元测试覆盖：break-engine（11）、stats-utils（7）、exercises（3）、store（4）。

## ☕ 支持我们

如果这个工具帮到了你，欢迎在爱发电请我们喝杯咖啡：

👉 [https://www.ifdian.net/a/giquwei](https://www.ifdian.net/a/giquwei)

## 🙏 鸣谢

感谢以下朋友的支持（按支持时间排序）：

<!-- 鸣谢名单占位：有了支持者后在这里添加 -->

_暂无，期待第一个支持者的出现。_

## 📄 License

[MIT License](./LICENSE)
