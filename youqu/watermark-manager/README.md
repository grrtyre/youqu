# 💧 水印管家

> 苹果白高端风格的屏幕水印防泄密桌面工具。透明置顶、鼠标穿透、多屏支持，适用于内部资料防扩散、版权标识、办公溯源场景。

## ⬇️ 直接下载

| 平台 | 下载 | 说明 |
|---|---|---|
| Windows x64 | [水印管家 1.0.0.exe](https://github.com/grrtyre/youqu/releases/tag/watermark-manager-v1.0.0) | 便携版，双击即用 |
| Windows x64 | [水印管家 Setup 1.0.0.exe](https://github.com/grrtyre/youqu/releases/tag/watermark-manager-v1.0.0) | 安装版，自动创建快捷方式 |

## ✨ 功能特点

- **透明置顶水印** —— 水印层覆盖全屏，始终置顶于所有窗口之上（屏幕保护级别）
- **鼠标穿透** —— 水印层完全不阻挡任何鼠标操作，用户无感知
- **多屏支持** —— 自动识别所有显示器，每个屏幕独立渲染水印
- **动态变量** —— 支持 `{USERNAME}` `{IP}` `{TIME}` `{DATE}` `{MACHINE}` 变量插入
- **6 种快捷模板** —— 机密文件 / 公司名称 / 工号溯源 / IP溯源 / 草稿 / 版权标识
- **完全自定义** —— 字号、颜色、透明度、旋转角度、水平/垂直间距均可调节
- **实时预览** —— 所见即所得，调整参数立即看到效果
- **系统托盘** —— 关闭窗口时最小化到托盘，后台持续运行
- **开机自启** —— 可选开机自动启动
- **纯本地隐私** —— 所有数据保存在本地，不联网不上传

## 🎨 设计风格

- 苹果白高端风格，参考 macOS/iOS 原生设计
- 白色/浅灰背景、细腻阴影、系统字体
- 蓝色强调色（#007aff）
- iOS 风格开关、圆形颜色选择器、编号步骤引导

## 📖 使用方式

1. **输入水印文字** —— 在"水印文字"输入框输入内容，或点击下方变量标签插入动态变量
2. **选择快捷模板** —— 点击模板卡片快速应用预设样式
3. **调整样式** —— 在右侧调整字号、颜色、透明度、旋转角度、间距
4. **开启水印** —— 打开右上角开关，水印立即覆盖全屏
5. **水印运行中** —— 水印层鼠标穿透，不影响任何操作；关闭窗口自动最小化到托盘

## 🛠 技术栈

- **Electron 28** —— 跨平台桌面应用框架
- **原生 JavaScript** —— 无前端框架依赖
- **Canvas API** —— 水印渲染引擎
- **electron-builder** —— 打包工具

## 📂 项目结构

```
watermark-manager/
├── src/
│   ├── core/
│   │   └── watermark-core.js    # 核心逻辑（配置、模板、变量替换）
│   ├── renderer/
│   │   ├── index.html           # 控制面板
│   │   ├── overlay.html         # 透明水印层
│   │   ├── renderer.js          # 控制面板逻辑
│   │   └── styles.css           # 苹果白风格样式
│   ├── main.js                  # Electron 主进程
│   └── preload.js               # 预加载脚本
├── test/
│   └── test.js                  # 核心逻辑测试（29 用例）
├── build/
│   ├── icon.ico                 # 应用图标
│   ├── make_icon.py             # 图标生成脚本
│   └── screenshot.ps1           # 后台截图脚本
└── package.json
```

## 🧪 测试

```bash
node test/test.js
```

覆盖 DEFAULT_CONFIG、resolveVariables、mergeConfig、validateConfig、formatTime、TEMPLATES 共 29 个测试用例。

## ☕ 支持我们

如果这个工具帮到了你，欢迎在爱发电请我们喝杯咖啡：

👉 [https://www.ifdian.net/a/giquwei](https://www.ifdian.net/a/giquwei)

你的支持是我们持续做下去的动力。

## 🙏 鸣谢

感谢以下朋友的支持（按支持时间排序）：

<!-- 鸣谢名单占位 -->

_暂无，期待第一个支持者的出现。_

## 📄 License

[MIT License](./LICENSE)
