# 🌟 youqu · 实用工具集合

> 一组由 **Trae + MiMo Code** 人机协作打造的开源实用工具。每个工具都解决一个真实痛点，不是只能看的玩具。

## 📦 项目列表

| 工具 | 简介 | 技术栈 | 状态 |
|---|---|---|---|
| [alarm-manager](./alarm-manager) | 闹钟管家 | 支持农历闹钟、贪睡、系统托盘的桌面闹钟应用 | Electron |
| [⏰ Cron 中文可视化](./cron-zh) | 中文原生的 Cron 表达式可视化生成器：5/6 字段自动识别（支持 Spring/Quartz 带秒表达式）、`?` 标记兼容、实时中文解读、字段可视化、下次执行预览、常用预设、🕐 最近使用历史、📖 语法速查 | 纯 HTML/CSS/JS | ✅ 可用 v2.1 |
| [📋 剪贴板管家](./clipboard-manager) | Windows 桌面剪贴板历史管理器：苹果白风格、键盘导航、一键粘贴到前台、智能分类、纯本地隐私优先 | Electron + 原生 JS | ✅ 可用 |
| [📋 剪贴板管家·便携版](./clipboard-manager/portable) | 输入法式体验的剪贴板历史管理器：原生 Python + PySide6、全局热键 Ctrl+Shift+V、失焦自动隐藏、托盘常驻、380x500 紧凑窗口、单 EXE 便携分发 | Python + PySide6 | ✅ 可用 v1.0.0 |
| [📝 Markdown 预览器](./markdown-preview) | 苹果白风格本地 Markdown 预览器：实时编辑、GFM 语法、中文排版优化、保存 .md、阅读时长估算、一键导出 HTML/PDF、PWA 离线可用 | 纯 HTML/CSS/JS · PWA | ✅ 可用 v2.2 |
| [🧰 开发者工具箱](./dev-toolbox) | 苹果白风格 8 合 1 开发者工具：颜色转换 / JSON 格式化 / 时间戳 / 正则测试 / 文本 Diff / Base64 / URL 编解码 / JWT 解码 | 纯 HTML/CSS/JS | ✅ 可用 v2.1 |
| [🎨 拾色管家](./color-picker) | 苹果白风格屏幕取色器：全局快捷键、放大镜精准取色、多调色板管理、WCAG 对比度检查、调色板多格式导出（CSS/SCSS/JSON/GPL/ASE）、托盘常驻、纯本地隐私 | Electron + 原生 JS | ✅ 可用 v1.1.0 |
| [📸 截图管家](./screenshot-manager) | 苹果白风格截图标注工具：全局快捷键截图、6 种标注（矩形/箭头/画笔/文字/序号/马赛克）、屏幕贴图、历史回看、纯本地隐私 | Electron + 原生 JS | ✅ 可用 |
| [🌐 世界时钟](./world-clock) | 跨时区协作助手：多时区对比、工作时段重叠可视化、**✨ 智能会议推荐**（按黄金时段打分给出最佳会议时间）、时间戳转换、历史回溯（DST 自动处理） | 纯 HTML/CSS/JS | ✅ 可用 v1.1.0 |
| [📁 重命名管家](./file-rename-manager) | Windows 批量重命名工具：拖拽添加、实时预览、7 种规则（替换/正则/序号/日期/EXIF/大小写/插入删除）、组合应用、交换安全、一键撤销、预设管理、扩展名过滤 | Electron + 原生 JS | ✅ 可用 v1.1.0 |
| [👁 速览管家](./quick-look) | 仿 Mac QuickLook 的 Windows 文件极速预览：Alt+Q 一键唤起、资源管理器集成、图片/视频/音频/PDF/代码/Markdown 全格式支持 | Electron + 原生 JS | ✅ 可用 |
| [📝 文本管家](./text-manager) | Windows 批量文本处理工具：替换/分割/提取/大小写/去重/行处理/编码转换/统计、自然排序，苹果白风格、纯本地隐私优先 | Electron + 原生 JS | ✅ 可用 v1.1.0 |
| [📦 清重管家](./duplicate-finder) | Windows 重复文件查找清理工具：三阶段内容哈希算法（按大小→部分哈希→完整 SHA-256）零误报、并排预览对比、智能建议保留、安全移到回收站 | Electron + 原生 JS | ✅ 可用 v1.0.0 |
| [📏 屏幕尺管家](./screen-ruler) | 屏幕测量与标注工具：实时坐标与取色、矩形/直线测量、9×9 像素放大镜、历史记录、全局热键唤起、HiDPI 适配、多屏严格匹配，苹果白风格 | Electron + 原生 JS | ✅ 可用 v1.1.1 |
| [🔤 字体管家](./font-manager) | 本地字体浏览、对比与特性标签管理工具：CJK 过滤修复、分类语义配色、实时计数、苹果白高端风格 | Electron + 原生 JS | ✅ 可用 v1.1.0 |
| [📖 PDF管家](./pdf-toolbox) | 本地PDF工具箱·合并/拆分/压缩/加密/解密/水印/图片转PDF，中文水印修复、全功能拖拽，纯本地隐私优先 | Electron + @cantoo/pdf-lib | ✅ 可用 v1.1.0 |
| [⚖️ 文本对比管家](./diff-checker) | 苹果白风格文本对比工具：行级+字符级双 diff、并排/内联/统一格式三视图、忽略大小写/空白、文件拖放、PWA 离线可用 | 纯 HTML/CSS/JS · PWA | ✅ 可用 v1.0.0 |
| [⏳ 倒计时管家](./countdown-manager) | 优雅的事件倒数日桌面工具：公历+农历双历法、年度重复、分类标签、置顶筛选、系统托盘、本地存储 | Electron + 原生 JS | ✅ 可用 v1.0.0 |
| [📱 二维码管家](./qr-manager) | 本地二维码生成与识别工具：WiFi/名片/邮箱模板、截屏识别、历史收藏、PNG/SVG导出 | Electron + 原生 JS | ✅ 可用 v1.0.0 |
| [📋 习惯管家](./habit-keeper) | 本地优先的每日习惯打卡桌面应用：一键打卡、连续天数、月历补卡、完成率统计、多习惯管理、数据导入导出、完全离线 | Electron + 原生 JS | ✅ 可用 v1.0.0 |
| [💰 记账管家](./accounting-manager) | 本地优先的极简记账桌面应用：收支记录、仪表盘概览、6月趋势图、分类环形图、日历回看、预算管理、账户余额、资产负债分布、搜索、二次确认防误删、JSON/CSV导出 | Electron + 原生 JS | ✅ 可用 v1.1.0 |
| [📋 代码片段管家](./snippet-manager) | 本地优先的代码片段管理桌面应用：自研语法高亮引擎（20+语言）、全文搜索、标签分类、收藏置顶、导入导出、全局快捷键、托盘常驻 | Electron + 原生 JS | ✅ 可用 v1.1.0 |
| [⏱️ 时间管家](./time-tracker) | 本地优先的时间追踪桌面应用：一键计时、多项目管理、今日记录、统计图表、CSV/JSON 导出导入、系统托盘、迷你进度条、纯本地隐私 | Electron + 原生 JS | ✅ 可用 v1.1.0 |
| [🔌 端口管家](./port-manager) | 本地网络端口监控与管理桌面应用：实时扫描连接、一键结束占用进程、端口收藏、状态筛选、进程详情、CSV/JSON 导出，纯本地隐私优先 | Electron + 原生 JS | ✅ 可用 v1.0.0 |
| [🛡️ 校验管家](./checksum-manager) | 本地文件哈希校验工具：MD5/SHA1/SHA256/SHA512/CRC32 五合一、拖放即算、粘贴哈希自动识别算法实时比对、批量处理、流式计算大文件、历史记录 | Electron + 原生 JS | ✅ 可用 v1.0.0 |
| [🔌 API管家](./api-manager) | 本地优先的 HTTP API 测试工具：集合管理、环境变量、JSON 语法高亮、历史记录，苹果白高端风格 | Electron + 原生 JS | ✅ 可用 v1.0.0 |
| [📌 置顶管家](./topmost-manager) | Windows 窗口置顶管理工具：可视化窗口列表、一键置顶、透明度调节、全局热键、自动置顶规则、托盘常驻，纯本地隐私优先 | Electron + 原生 JS | ✅ 可用 v1.0.0 |
| [👁 护眼管家](./eye-rest-manager) | 护眼休息提醒桌面管家：20-20-20法则、三级休息周期、眼保健操引导、🔒严格模式、免打扰时段、全屏抑制、本地统计，苹果白高端风格 | Electron + 原生 JS | ✅ 可用 v1.1.0 |
| [🖥️ Hosts管家](./hosts-manager) | hosts 文件编辑与方案管理桌面应用：可视化编辑、一键应用、模板库、方案保存、自动备份 | Electron + 原生 JS | ✅ 可用 v1.0.0 |
| [🌐 网络管家](./network-manager) | 本地网络诊断一体化桌面应用：Ping/路由追踪/DNS/端口检测/HTTP头/Whois/IP归属 7合1、延迟柱状图、诊断历史、复制结果、系统托盘、单实例锁、历史导出CSV/JSON，苹果白高端风格 | Electron + 原生 JS | ✅ 可用 v1.1.0 |
| [💰 订阅管家](./subscription-manager) | 本地优先的订阅服务管理桌面应用：支出概览、续费提醒、分类统计、停用启用、JSON/CSV 导入导出、二次确认防误删、托盘常驻 | Electron + 原生 JS | ✅ 可用 v1.1.0 |
| [📝 便签管家](./sticky-notes-manager) | 本地便签桌面应用：快速记录、分类管理、置顶标记、全文搜索、颜色标签、回收站（30天恢复）、导入导出、全局快捷键、托盘常驻，纯本地隐私优先 | Electron + 原生 JS | ✅ 可用 v1.1.0 |
| [💧 水印管家](./watermark-manager) | 屏幕水印防泄密工具：透明置顶鼠标穿透、多屏支持、动态变量、6种快捷模板、定时水印（工作时段/星期/跨夜）、智能IP识别过滤虚拟网卡、实时预览、托盘常驻，纯本地隐私优先 | Electron + 原生 JS | ✅ 可用 v1.1.0 |
| [📐 正则管家](./regex-manager) | 本地正则表达式测试与调试工具：实时高亮、捕获组详情、替换预览（支持 $1 $2 $&）、30+ 模式库、历史收藏，苹果白高端风格 | Electron + 原生 JS | ✅ 可用 v1.0.0 |
| [📊 表格管家](./csv-manager) | 本地 CSV/TSV 数据查看与分析工具：自动识别分隔符、列类型推断、数值统计、排序过滤、图表可视化、虚拟滚动、多格式导出，纯本地隐私优先 | Electron + 原生 JS | ✅ 可用 v1.1.0 |
| [🚀 启动项管家](./startup-manager) | Windows 启动项可视化管理桌面应用：注册表+启动文件夹双来源、一键启用/禁用/删除、搜索筛选、统计概览，苹果白高端风格 | Electron + 原生 JS | ✅ 可用 v1.0.0 |
| [🍅 番茄管家](./pomodoro-manager) | 本地优先的番茄工作法专注桌面应用：专注/短休息/长休息三阶段轮转、任务清单、统计分析、连续打卡、严格模式、键盘快捷键、阶段标签切换、自动开始、合成白噪音、托盘常驻 | Electron + 原生 JS | ✅ 可用 v1.1.0 |
| [👁 识字管家](./ocr-manager) | 本地离线 OCR 文字识别工具：中英文识别、全局快捷键截图识别、批量队列、置信度与字数统计、历史记录、自动复制、多语言切换，纯本地隐私优先 | Electron + tesseract.js | ✅ 可用 v1.0.1 |
| [🧮 计算器管家](./calculator-manager) | 苹果白高端风格桌面计算器：基础/科学/程序员/转换四模式、自研表达式引擎、十大类单位互转、常见换算参考、变量定义、历史记录、纯本地隐私优先 | Electron + 原生 JS | ✅ 可用 v1.1.0 |
| [🧠 思维导图管家](./mind-map-manager) | 本地优先的思维导图桌面工具：多文档管理、键盘流操作、自动树形布局、彩色分支、折叠展开、多格式导出（PNG/JSON/Markdown），数据不出本机 | Electron + 原生 SVG | ✅ 可用 v1.0.0 |
| [🎬 录屏管家](./screen-recorder-manager) | 苹果白高端风格本地屏幕录制工具：屏幕/窗口录制、系统声音+麦克风混音、暂停继续、历史管理、全局快捷键、托盘常驻，纯本地隐私优先 | Electron + 原生 JS | ✅ 可用 v1.0.0 |
| [🎡 抽签转盘管家](./wheel-manager) | 苹果白风格桌面随机选择工具：加权随机、多名单管理、批量导入、不重复抽奖、历史记录、音效、自定义设置，纯本地隐私优先 | Electron + 原生 JS | ✅ 可用 v1.0.0 |
| [💌 纪念日管家](./anniversary-manager) | 本地优先的纪念日管理桌面应用：公历+农历双历法、生日/纪念日/忌日/自定义四类型、生肖星座、倒计时、即将到来侧栏、分类筛选、搜索排序、JSON导入导出、**✨ 桌面通知提醒**（每小时检查 7 天内事件）、系统托盘常驻、单实例锁、纯本地隐私优先 | Electron + 原生 JS | ✅ 可用 v1.1.0 |
| [🎬 剧集管家](./watching-manager) | 本地追剧进度管理桌面应用：剧集档案、一键推进下一集（跨季自动+1、终集自动标记已看完）、状态管理、评分标签、统计概览、追剧提醒、搜索筛选、数据导入导出，纯本地存储不联网 | Electron + 原生 JS | ✅ 可用 v1.0.0 |
| [🔄 单位转换器](./unit-converter) | 万能单位转换器：14 大类 160+ 单位互转（长度/重量/温度/面积/体积/速度/数据/时间/压力/能量/功率/角度/频率/传输）、实时换算、全单位参考表、一键复制、单位互换，苹果白高端风格 | Electron + 原生 JS | ✅ 可用 v1.0.0 |
<!-- 新项目在这里追加一行 -->

## 📸 截图墙

> 所有工具的实时截图，由后台 **PrintWindow + Edge headless** 自动截取，不打扰用户。点击图片跳转项目。

<div align="center">

<table>
<tr>
<td align="center"><a href="./cron-zh"><img src="docs/assets/img/cron-zh.webp" width="200" alt="Cron 中文可视化"><br><sub>⏰ Cron 中文可视化</sub></a></td>
<td align="center"><a href="./clipboard-manager"><img src="docs/assets/img/clipboard-manager.webp" width="200" alt="剪贴板管家"><br><sub>📋 剪贴板管家</sub></a></td>
<td align="center"><a href="./markdown-preview"><img src="docs/assets/img/markdown-preview.webp" width="200" alt="Markdown 预览器"><br><sub>📝 Markdown 预览器</sub></a></td>
<td align="center"><a href="./dev-toolbox"><img src="docs/assets/img/dev-toolbox.webp" width="200" alt="开发者工具箱"><br><sub>🧰 开发者工具箱</sub></a></td>
</tr>
<tr>
<td align="center"><a href="./color-picker"><img src="docs/assets/img/color-picker.webp" width="200" alt="拾色管家"><br><sub>🎨 拾色管家</sub></a></td>
<td align="center"><a href="./screenshot-manager"><img src="docs/assets/img/screenshot-manager.webp" width="200" alt="截图管家"><br><sub>📸 截图管家</sub></a></td>
<td align="center"><a href="./world-clock"><img src="docs/assets/img/world-clock.webp" width="200" alt="世界时钟"><br><sub>🌐 世界时钟</sub></a></td>
<td align="center"><a href="./file-rename-manager"><img src="docs/assets/img/file-rename-manager.webp" width="200" alt="重命名管家"><br><sub>📁 重命名管家</sub></a></td>
</tr>
<tr>
<td align="center"><a href="./quick-look"><img src="docs/assets/img/quick-look.webp" width="200" alt="速览管家"><br><sub>👁 速览管家</sub></a></td>
<td align="center"><a href="./text-manager"><img src="docs/assets/img/text-manager.webp" width="200" alt="文本管家"><br><sub>📝 文本管家</sub></a></td>
<td align="center"><a href="./duplicate-finder"><img src="docs/assets/img/duplicate-finder.webp" width="200" alt="清重管家"><br><sub>📦 清重管家</sub></a></td>
<td align="center"><a href="./screen-ruler"><img src="docs/assets/img/screen-ruler.webp" width="200" alt="屏幕尺管家"><br><sub>📏 屏幕尺管家</sub></a></td>
</tr>
<tr>
<td align="center"><a href="./font-manager"><img src="docs/assets/img/font-manager.webp" width="200" alt="字体管家"><br><sub>🔤 字体管家</sub></a></td>
<td align="center"><a href="./pdf-toolbox"><img src="docs/assets/img/pdf-toolbox.webp" width="200" alt="PDF管家"><br><sub>📖 PDF管家</sub></a></td>
<td align="center"><a href="./diff-checker"><img src="docs/assets/img/diff-checker.webp" width="200" alt="文本对比管家"><br><sub>⚖️ 文本对比管家</sub></a></td>
<td align="center"><a href="./countdown-manager"><img src="docs/assets/img/countdown-manager.webp" width="200" alt="倒计时管家"><br><sub>⏳ 倒计时管家</sub></a></td>
</tr>
<tr>
<td align="center"><a href="./qr-manager"><img src="docs/assets/img/qr-manager.webp" width="200" alt="二维码管家"><br><sub>📱 二维码管家</sub></a></td>
<td align="center"><a href="./habit-keeper"><img src="docs/assets/img/habit-keeper.webp" width="200" alt="习惯管家"><br><sub>📋 习惯管家</sub></a></td>
<td align="center"><a href="./accounting-manager"><img src="docs/assets/img/accounting-manager.webp" width="200" alt="记账管家"><br><sub>💰 记账管家</sub></a></td>
<td align="center"><a href="./snippet-manager"><img src="docs/assets/img/snippet-manager.webp" width="200" alt="代码片段管家"><br><sub>📋 代码片段管家</sub></a></td>
</tr>
<tr>
<td align="center"><a href="./time-tracker"><img src="docs/assets/img/time-tracker.webp" width="200" alt="时间管家"><br><sub>⏱️ 时间管家</sub></a></td>
<td align="center"><a href="./port-manager"><img src="docs/assets/img/port-manager.webp" width="200" alt="端口管家"><br><sub>🔌 端口管家</sub></a></td>
<td align="center"><a href="./checksum-manager"><img src="docs/assets/img/checksum-manager.webp" width="200" alt="校验管家"><br><sub>🛡️ 校验管家</sub></a></td>
<td align="center"><a href="./api-manager"><img src="docs/assets/img/api-manager.webp" width="200" alt="API管家"><br><sub>🔌 API管家</sub></a></td>
</tr>
<tr>
<td align="center"><a href="./topmost-manager"><img src="docs/assets/img/topmost-manager.webp" width="200" alt="置顶管家"><br><sub>📌 置顶管家</sub></a></td>
<td align="center"><a href="./eye-rest-manager"><img src="docs/assets/img/eye-rest-manager.webp" width="200" alt="护眼管家"><br><sub>👁 护眼管家</sub></a></td>
<td align="center"><a href="./hosts-manager"><img src="docs/assets/img/hosts-manager.webp" width="200" alt="Hosts管家"><br><sub>🖥️ Hosts管家</sub></a></td>
<td align="center"><a href="./network-manager"><img src="docs/assets/img/network-manager.webp" width="200" alt="网络管家"><br><sub>🌐 网络管家</sub></a></td>
</tr>
<tr>
<td align="center"><a href="./subscription-manager"><img src="docs/assets/img/subscription-manager.webp" width="200" alt="订阅管家"><br><sub>💰 订阅管家</sub></a></td>
<td align="center"><a href="./sticky-notes-manager"><img src="docs/assets/img/sticky-notes-manager.webp" width="200" alt="便签管家"><br><sub>📝 便签管家</sub></a></td>
<td align="center"><a href="./watermark-manager"><img src="docs/assets/img/watermark-manager.webp" width="200" alt="水印管家"><br><sub>💧 水印管家</sub></a></td>
<td align="center"><a href="./regex-manager"><img src="docs/assets/img/regex-manager.webp" width="200" alt="正则管家"><br><sub>📐 正则管家</sub></a></td>
</tr>
<tr>
<td align="center"><a href="./csv-manager"><img src="docs/assets/img/csv-manager.webp" width="200" alt="表格管家"><br><sub>📊 表格管家</sub></a></td>
<td align="center"><a href="./startup-manager"><img src="docs/assets/img/startup-manager.webp" width="200" alt="启动项管家"><br><sub>🚀 启动项管家</sub></a></td>
<td align="center"><a href="./pomodoro-manager"><img src="docs/assets/img/pomodoro-manager.webp" width="200" alt="番茄管家"><br><sub>🍅 番茄管家</sub></a></td>
<td align="center"><a href="./ocr-manager"><img src="docs/assets/img/ocr-manager.webp" width="200" alt="识字管家"><br><sub>👁 识字管家</sub></a></td>
</tr>
<tr>
<td align="center"><a href="./calculator-manager"><img src="docs/assets/img/calculator-manager.webp" width="200" alt="计算器管家"><br><sub>🧮 计算器管家</sub></a></td>
<td align="center"><a href="./mind-map-manager"><img src="docs/assets/img/mind-map-manager.webp" width="200" alt="思维导图管家"><br><sub>🧠 思维导图管家</sub></a></td>
<td align="center"><a href="./screen-recorder-manager"><img src="docs/assets/img/screen-recorder-manager.webp" width="200" alt="录屏管家"><br><sub>🎬 录屏管家</sub></a></td>
<td align="center"><a href="./wheel-manager"><img src="docs/assets/img/wheel-manager.webp" width="200" alt="抽签转盘管家"><br><sub>🎡 抽签转盘管家</sub></a></td>
</tr>
<tr>
<td align="center"><a href="./anniversary-manager"><img src="docs/assets/img/anniversary-manager.webp" width="200" alt="纪念日管家"><br><sub>💌 纪念日管家</sub></a></td>
<td align="center"><a href="./watching-manager"><img src="docs/assets/img/watching-manager.webp" width="200" alt="剧集管家"><br><sub>🎬 剧集管家</sub></a></td>
<td align="center"><a href="./disk-manager"><img src="docs/assets/img/disk-manager.webp" width="200" alt="磁盘管家"><br><sub>💾 磁盘管家</sub></a></td>
<td align="center"><a href="./log-manager"><img src="docs/assets/img/log-manager.webp" width="200" alt="日志管家"><br><sub>📜 日志管家</sub></a></td>
</tr>
<tr>
<td align="center"><a href="./env-manager"><img src="docs/assets/img/env-manager.webp" width="200" alt="环境变量管家"><br><sub>🌍 环境变量管家</sub></a></td>
<td align="center"><a href="./exif-manager"><img src="docs/assets/img/exif-manager.webp" width="200" alt="EXIF管家"><br><sub>📷 EXIF管家</sub></a></td>
<td align="center"><a href="./keyboard-tester"><img src="docs/assets/img/keyboard-tester.webp" width="200" alt="键盘测试管家"><br><sub>⌨️ 键盘测试管家</sub></a></td>
<td align="center"><a href="./image-converter"><img src="docs/assets/img/image-converter.webp" width="200" alt="图片转换管家"><br><sub>🖼️ 图片转换管家</sub></a></td>
</tr>
<tr>
<td align="center"><a href="./json-manager"><img src="docs/assets/img/json-manager.webp" width="200" alt="JSON管家"><br><sub>🔧 JSON管家</sub></a></td>
<td align="center"><a href="./prompt-manager"><img src="docs/assets/img/prompt-manager.webp" width="200" alt="Prompt管家"><br><sub>💬 Prompt管家</sub></a></td>
<td align="center"><a href="./whiteboard-manager"><img src="docs/assets/img/whiteboard-manager.webp" width="200" alt="白板管家"><br><sub>🎨 白板管家</sub></a></td>
<td align="center"><a href="./screenshot-manager"><img src="docs/assets/img/screenshot-manager.webp" width="200" alt="截图管家"><br><sub>📸 截图管家</sub></a></td>
</tr>
</table>

<p><em>💡 截图由 mimo 审美评分，评分角标在 <a href="https://grrtyre.github.io/youqu/">在线展示站</a> 卡片上显示</em></p>

</div>

## 🎯 共同特点

- **实用性优先** —— 每个工具都解决真实痛点，能直接拿来用
- **零门槛** —— 纯前端、双击即用、无需安装后端
- **高度美观** —— 苹果白高端风格、细腻阴影、响应式布局（参考 macOS/iOS 原生设计）
- **测试覆盖** —— 核心逻辑有自动化测试，不是"能跑就行"

## 🤝 协作模式

这些项目由 **[Trae IDE](https://www.trae.cn/)** 与 **[MiMo Code](https://mimo.xiaomi.com/coder)** 协作打造：

- **MiMo Code** —— 核心逻辑编写、UI 审美评估（多模态识图把关）
- **Trae** —— 架构设计、UI 实现、测试编写、项目集成

## ☕ 支持我们

如果这些工具帮到了你，欢迎在爱发电请我们喝杯咖啡：

👉 [https://www.ifdian.net/a/giquwei](https://www.ifdian.net/a/giquwei)

你的支持是我们持续做下去的动力。

## 🙏 鸣谢

感谢以下朋友的支持（按支持时间排序）：

<!-- 鸣谢名单占位：有了支持者后在这里添加，格式：- [@用户名](主页链接) -->

_暂无，期待第一个支持者的出现。_

## 📄 License

所有项目均采用 [MIT License](./LICENSE)，可自由使用。
| [password-generator](./password-generator) | 瀵嗙爜鐢熸垚鍣?| 鍩轰簬 Electron + crypto CSPRNG 鐨勬湰鍦板瘑鐮佺敓鎴愬伐鍏凤紝鏀寔闅忔満瀵嗙爜銆佽蹇嗗彛浠ゃ€佸己搴︽娴嬨€佹壒閲忕敓鎴愪笌鏈湴鍘嗗彶 | Electron | 
