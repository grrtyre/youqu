# 表情管家 😊

> 一款苹果白高端风格的本地表情符号管理工具，告别 Windows 自带面板的简陋。

## ✨ 功能特性

- **完整 emoji 库**：内置 600+ 表情符号，覆盖笑脸、手势、动物、食物、活动、旅行、物品、符号、旗帜等 9 大分类
- **颜文字 & 特殊符号**：内置 50+ 经典颜文字 `(´・ω・`)` `(╯°□°)╯︵ ┻━┻` 与常用特殊符号
- **一键复制**：点击即复制到剪贴板，无需二次操作
- **本地收藏**：常用表情加入收藏，橙色标记一目了然
- **使用历史**：自动记录最近使用的 50 个表情
- **关键词搜索**：支持中文名、关键词、字符三种搜索方式
- **详情面板**：展示大图、名称、分类、Unicode 码点
- **全局快捷键**：`Ctrl+Shift+E` 一键唤出/隐藏
- **托盘驻留**：关闭窗口后驻留系统托盘，随时可用

## 📦 下载安装

| 平台 | 下载 | 说明 |
| --- | --- | --- |
| Windows x64 | 表情管家 Setup 1.0.0.exe | 安装版，含开始菜单与桌面快捷方式 |
| Windows x64 | 表情管家 1.0.0.exe | 免安装绿色版 |

> 详见本页 [Releases](../../releases) 区。

## 🚀 使用方式

### 普通用户
1. 下载上方任一 Windows 安装包
2. 双击运行，按提示安装（绿色版直接解压运行即可）
3. 启动后通过左侧分类浏览表情
4. 点击表情立即复制到剪贴板
5. 按 `Ctrl+Shift+E` 可随时唤出或隐藏窗口

### 开发者
```bash
# 安装依赖（国内推荐使用镜像）
npm install

# 启动应用
npm start

# 运行测试
npm test

# 打包
npm run dist

# 生成图标
npm run icon
```

## 🎨 设计风格

采用苹果白高端设计语言：
- 白色/浅灰背景，细腻阴影层次
- 系统字体 `-apple-system, PingFang SC`
- 蓝色强调 `#007aff`（iOS 系统蓝）
- 毛玻璃半透明标题栏
- macOS 风格三色窗口控制按钮

## 🛠 技术栈

- **Electron 28** — 桌面应用框架
- **原生 JS + CSS** — 无前端框架依赖，启动快
- **electron-store** — 本地收藏与历史持久化
- **globalShortcut & Tray** — 系统级集成
- **electron-builder** — 跨平台打包

## 📂 项目结构

```
emoji-manager/
├── src/
│   ├── core/
│   │   ├── emoji-data.js          # 笑脸/手势/动物/食物
│   │   ├── emoji-data-extra.js    # 活动/旅行/物品/符号/旗帜
│   │   ├── emoji-data-kao.js      # 颜文字与特殊符号
│   │   └── store.js               # electron-store 收藏与历史
│   ├── renderer/
│   │   ├── index.html             # 主界面
│   │   ├── styles.css             # 苹果白样式
│   │   └── app.js                 # 渲染层逻辑
│   ├── main.js                    # Electron 主进程
│   └── preload.js                 # IPC 安全桥接
├── build/
│   ├── make_icon.py               # 图标生成脚本
│   └── icon.ico                   # 应用图标
├── test/test.js                   # 核心逻辑测试
├── .gitignore
├── LICENSE
├── package.json
└── README.md
```

## ☕ 支持我们

如果这个工具对你有帮助，欢迎请我们喝杯咖啡支持持续维护：

- 💝 爱发电：[https://www.ifdian.net/a/giquwei](https://www.ifdian.net/a/giquwei)

## 🙏 鸣谢

感谢以下朋友的支持（按支持时间排序）：
<!-- 鸣谢名单占位 -->
_暂无，期待第一个支持者的出现。_

## 📄 License

MIT © youqu
