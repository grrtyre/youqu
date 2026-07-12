# 思维导图管家

> Windows 上优雅的本地思维导图工具——多文档管理、键盘流操作、自动布局、折叠展开、导出 PNG/JSON，数据不出本机。

## 简介

思维导图管家是一款专注本地体验的思维导图桌面软件，基于 Electron 构建。它摒弃了在线工具的账号绑定与云端同步，让您的想法始终留在本机。支持多文档管理、键盘快捷操作、自动树形布局、节点折叠展开、彩色分支标识，以及导出为 PNG 图片 / JSON 数据 / Markdown / 大纲文本。

## 功能特点

- **多文档管理**：左侧边栏统一管理多份思维导图，支持搜索、新建、删除
- **键盘流操作**：Tab 添加子节点、Enter 添加兄弟节点、F2 编辑文本、Delete 删除、空格折叠/展开
- **自动树形布局**：右展开树形结构，自动计算节点位置与子树高度，支持平移与缩放
- **彩色分支**：为一级分支设置颜色，叶子节点继承父级色彩，左侧色条统一视觉语言
- **折叠展开**：任意节点可折叠/展开子树，聚焦当前思路
- **撤销重做**：支持 50 步撤销/重做，随时回退
- **自动保存**：文档修改后自动保存到本地，无需手动操作
- **多格式导出**：支持导出为 PNG 图片、JSON 数据、Markdown 文档、大纲文本
- **导入 JSON**：支持从 JSON 文件导入思维导图
- **本地优先**：所有数据存储在本地文件系统，不上传任何服务器

## 使用方式

### 直接下载

| 平台 | 下载 |
|------|------|
| Windows 安装版 | [mind-map-manager-setup-1.0.0.exe](https://github.com/grrtyre/youqu/releases/download/mind-map-manager-v1.0.0/mind-map-manager-setup-1.0.0.exe) |
| Windows 便携版 | [mind-map-manager-1.0.0-portable.exe](https://github.com/grrtyre/youqu/releases/download/mind-map-manager-v1.0.0/mind-map-manager-1.0.0-portable.exe) |

### 从源码运行

```bash
# 安装依赖
npm install

# 开发模式运行
npm start

# 运行测试
npm test

# 打包
npm run dist
```

## 快捷键

| 快捷键 | 功能 |
|--------|------|
| Tab | 添加子节点 |
| Enter | 添加兄弟节点 |
| F2 | 编辑节点文本 |
| Delete | 删除节点 |
| 空格 | 折叠/展开 |
| Ctrl+Z | 撤销 |
| Ctrl+Y | 重做 |
| Ctrl+S | 保存 |
| 滚轮 | 缩放画布 |

## 技术栈

- Electron 28 - 跨平台桌面应用框架
- 原生 SVG - 思维导图渲染
- 原生 JavaScript - 无前端框架依赖
- electron-builder - 打包工具

## 数据存储

所有思维导图文档以 JSON 格式存储在本地：
- Windows: `%APPDATA%\mind-map-manager\docs\`

## ☕ 支持我们

如果这个项目对你有帮助，欢迎支持我们持续开发：

[爱发电支持](https://www.ifdian.net/a/giquwei)

## 🙏 鸣谢

感谢以下朋友的支持（按支持时间排序）：

_暂无，期待第一个支持者的出现。_

## License

MIT
