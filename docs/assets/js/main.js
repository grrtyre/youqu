/* ============ youqu 展示站点 · 交互逻辑 ============ */
'use strict';

/* ---------- 项目数据（67 个工具） ---------- */
var G = 'https://github.com/grrtyre/youqu';
var R = 'https://github.com/grrtyre/youqu/releases';
var AF = 'https://www.ifdian.net/a/giquwei';

var PROJECTS = [
  {id:'cron-zh',icon:'⏰',name:'Cron 中文可视化',cat:'dev',stack:'web',ver:'v2.0',
   desc:'中文原生的 Cron 表达式可视化生成器：5/6 字段自动识别（支持 Spring/Quartz 带秒表达式）、? 标记兼容、实时中文解读、字段可视化、下次执行预览、常用预设。',
   tags:['纯 HTML/CSS/JS'],gh:G+'/tree/main/cron-zh',
   features:['5/6 字段自动识别，支持 Quartz/Spring 带秒表达式','? 标记兼容，日/周字段任填其一','实时中文解读，输入即解析','下次 5 次执行预览，精确到秒','20 个高频预设一键填入','暗色/亮色主题，记忆偏好','URL 分享 ?cron= 直接打开配置']},
  {id:'clipboard-manager',icon:'📋',name:'剪贴板管家',cat:'system',stack:'electron',ver:'v1.3.0',
   desc:'Windows 桌面剪贴板历史管理器：苹果白风格、键盘导航、一键粘贴到前台、智能分类、图片剪贴板、纯本地隐私优先。',
   tags:['Electron','原生 JS'],dl:R+'/tag/clipboard-manager-v1.3.0',gh:G+'/tree/main/clipboard-manager',
   features:['自动记录文本与图片，去重存储','全局快捷键 Ctrl+Shift+V 唤起','键盘导航，Enter 一键粘贴到前台窗口','智能分类代码/链接/邮箱/电话/图片','即时搜索 + 关键词高亮','内容预览面板，代码带行号','置顶收藏、系统托盘常驻','最多 500 文本 + 50 图片']},
  {id:'markdown-preview',icon:'📝',name:'Markdown 预览器',cat:'dev',stack:'web',ver:'v2.2',
   desc:'苹果白风格本地 Markdown 预览器：实时编辑、GFM 语法、中文排版优化、保存 .md、阅读时长估算、一键导出 HTML/PDF、PWA 离线可用。',
   tags:['纯 HTML/CSS/JS','PWA'],gh:G+'/tree/main/markdown-preview',
   features:['实时编辑实时预览','GFM 语法支持','中文排版优化','阅读时长估算','一键导出 HTML/PDF','PWA 离线可用']},
  {id:'dev-toolbox',icon:'🧰',name:'开发者工具箱',cat:'dev',stack:'web',ver:'v2.1',
   desc:'苹果白风格 8 合 1 开发者工具：颜色转换 / JSON 格式化 / 时间戳 / 正则测试 / 文本 Diff / Base64 / URL 编解码 / JWT 解码。',
   tags:['纯 HTML/CSS/JS'],gh:G+'/tree/main/dev-toolbox',
   features:['8 合 1 开发者常用工具','颜色转换','JSON 格式化','时间戳转换','正则测试','文本 Diff','Base64 / URL 编解码','JWT 解码']},
  {id:'color-picker',icon:'🎨',name:'拾色管家',cat:'design',stack:'electron',ver:'v1.1.0',
   desc:'苹果白风格屏幕取色器：全局快捷键、放大镜精准取色、多调色板管理、WCAG 对比度检查、调色板多格式导出（CSS/SCSS/JSON/GPL/ASE）、托盘常驻、纯本地隐私。',
   tags:['Electron','原生 JS'],dl:R+'/tag/color-picker-v1.1.0',gh:G+'/tree/main/color-picker',
   features:['全局快捷键唤起','放大镜精准取色','多调色板管理','WCAG 对比度检查','多格式导出 CSS/SCSS/JSON/GPL/ASE','系统托盘常驻','纯本地隐私']},
  {id:'screenshot-manager',icon:'📸',name:'截图管家',cat:'system',stack:'electron',ver:'v1.0',
   desc:'苹果白风格截图标注工具：全局快捷键截图、6 种标注（矩形/箭头/画笔/文字/序号/马赛克）、屏幕贴图、历史回看、纯本地隐私。',
   tags:['Electron','原生 JS'],dl:R,gh:G+'/tree/main/screenshot-manager',
   features:['全局快捷键截图','6 种标注工具：矩形/箭头/画笔/文字/序号/马赛克','屏幕贴图功能','历史回看','纯本地隐私优先']},
  {id:'world-clock',icon:'🌐',name:'世界时钟',cat:'efficiency',stack:'web',ver:'v1.1.0',
   desc:'跨时区协作助手：多时区对比、工作时段重叠可视化、智能会议推荐（按黄金时段打分给出最佳会议时间）、时间戳转换、历史回溯（DST 自动处理）。',
   tags:['纯 HTML/CSS/JS'],gh:G+'/tree/main/world-clock',
   features:['多时区对比','工作时段重叠可视化','智能会议推荐，按黄金时段打分','时间戳转换','历史回溯，DST 自动处理']},
  {id:'file-rename-manager',icon:'📁',name:'重命名管家',cat:'system',stack:'electron',ver:'v1.1.0',
   desc:'Windows 批量重命名工具：拖拽添加、实时预览、7 种规则（替换/正则/序号/日期/EXIF/大小写/插入删除）、组合应用、交换安全、一键撤销、预设管理。',
   tags:['Electron','原生 JS'],dl:R+'/tag/file-rename-manager-v1.1.0',gh:G+'/tree/main/file-rename-manager',
   features:['拖拽添加文件','实时预览改名结果','7 种规则：替换/正则/序号/日期/EXIF/大小写/插入删除','组合应用多规则','交换安全','一键撤销','预设管理','扩展名过滤']},
  {id:'quick-look',icon:'👁',name:'速览管家',cat:'system',stack:'electron',ver:'v1.0',
   desc:'仿 Mac QuickLook 的 Windows 文件极速预览：Alt+Q 一键唤起、资源管理器集成、图片/视频/音频/PDF/代码/Markdown 全格式支持。',
   tags:['Electron','原生 JS'],dl:R,gh:G+'/tree/main/quick-look',
   features:['仿 Mac QuickLook 体验','Alt+Q 一键唤起','资源管理器集成','图片/视频/音频/PDF/代码/Markdown 全格式','极速预览']},
  {id:'text-manager',icon:'📝',name:'文本管家',cat:'efficiency',stack:'electron',ver:'v1.1.0',
   desc:'Windows 批量文本处理工具：替换/分割/提取/大小写/去重/行处理/编码转换/统计、自然排序，苹果白风格、纯本地隐私优先。',
   tags:['Electron','原生 JS'],dl:R+'/tag/text-manager-v1.1.0',gh:G+'/tree/main/text-manager',
   features:['替换/分割/提取','大小写转换','去重','行处理','编码转换','字符统计','自然排序','纯本地隐私优先']},
  {id:'duplicate-finder',icon:'📦',name:'清重管家',cat:'system',stack:'electron',ver:'v1.0.0',
   desc:'Windows 重复文件查找清理工具：三阶段内容哈希算法（按大小→部分哈希→完整 SHA-256）零误报、并排预览对比、智能建议保留、安全移到回收站。',
   tags:['Electron','原生 JS'],dl:R+'/tag/duplicate-finder-v1.0.0',gh:G+'/tree/main/duplicate-finder',
   features:['三阶段内容哈希算法零误报','按大小→部分哈希→完整 SHA-256','并排预览对比','智能建议保留','安全移到回收站']},
  {id:'screen-ruler',icon:'📏',name:'屏幕尺管家',cat:'system',stack:'electron',ver:'v1.1.1',
   desc:'屏幕测量与标注工具：实时坐标与取色、矩形/直线测量、9×9 像素放大镜、历史记录、全局热键唤起、HiDPI 适配、多屏严格匹配，苹果白风格。',
   tags:['Electron','原生 JS'],dl:R+'/tag/screen-ruler-v1.1.1',gh:G+'/tree/main/screen-ruler',
   features:['实时坐标与取色','矩形/直线测量','9×9 像素放大镜','历史记录','全局热键唤起','HiDPI 适配','多屏严格匹配']},
  {id:'font-manager',icon:'🔤',name:'字体管家',cat:'design',stack:'electron',ver:'v1.1.0',
   desc:'本地字体浏览、对比与特性标签管理工具：CJK 过滤修复、分类语义配色、实时计数、苹果白高端风格。',
   tags:['Electron','原生 JS'],dl:R+'/tag/font-manager-v1.1.0',gh:G+'/tree/main/font-manager',
   features:['本地字体浏览','字体对比','特性标签管理','CJK 过滤修复','分类语义配色','实时计数']},
  {id:'pdf-toolbox',icon:'📖',name:'PDF管家',cat:'efficiency',stack:'electron',ver:'v1.1.0',
   desc:'本地PDF工具箱·合并/拆分/压缩/加密/解密/水印/图片转PDF，中文水印修复、全功能拖拽，纯本地隐私优先。',
   tags:['Electron','@cantoo/pdf-lib'],dl:R+'/tag/pdf-toolbox-v1.1.0',gh:G+'/tree/main/pdf-toolbox',
   features:['PDF 合并/拆分','压缩','加密/解密','水印','图片转 PDF','中文水印修复','全功能拖拽','纯本地隐私优先']},
  {id:'diff-checker',icon:'⚖️',name:'文本对比管家',cat:'dev',stack:'web',ver:'v1.0.0',
   desc:'苹果白风格文本对比工具：行级+字符级双 diff、并排/内联/统一格式三视图、忽略大小写/空白、文件拖放、PWA 离线可用。',
   tags:['纯 HTML/CSS/JS','PWA'],gh:G+'/tree/main/diff-checker',
   features:['行级+字符级双 diff','并排/内联/统一格式三视图','忽略大小写/空白','文件拖放','PWA 离线可用']},
  {id:'countdown-manager',icon:'⏳',name:'倒计时管家',cat:'efficiency',stack:'electron',ver:'v1.0.0',
   desc:'优雅的事件倒数日桌面工具：公历+农历双历法、年度重复、分类标签、置顶筛选、系统托盘、本地存储。',
   tags:['Electron','原生 JS'],dl:R+'/tag/countdown-manager-v1.0.0',gh:G+'/tree/main/countdown-manager',
   features:['公历+农历双历法','年度重复','分类标签','置顶筛选','系统托盘','本地存储']},
  {id:'qr-manager',icon:'📱',name:'二维码管家',cat:'efficiency',stack:'electron',ver:'v1.0.0',
   desc:'本地二维码生成与识别工具：WiFi/名片/邮箱模板、截屏识别、历史收藏、PNG/SVG导出。',
   tags:['Electron','原生 JS'],dl:R+'/tag/qr-manager-v1.0.0',gh:G+'/tree/main/qr-manager',
   features:['二维码生成','WiFi/名片/邮箱模板','截屏识别','历史收藏','PNG/SVG 导出']},
  {id:'habit-keeper',icon:'📋',name:'习惯管家',cat:'efficiency',stack:'electron',ver:'v1.0.0',
   desc:'本地优先的每日习惯打卡桌面应用：一键打卡、连续天数、月历补卡、完成率统计、多习惯管理、数据导入导出、完全离线。',
   tags:['Electron','原生 JS'],dl:R+'/tag/habit-keeper-v1.0.0',gh:G+'/tree/main/habit-keeper',
   features:['一键打卡','连续天数','月历补卡','完成率统计','多习惯管理','数据导入导出','完全离线']},
  {id:'accounting-manager',icon:'💰',name:'记账管家',cat:'efficiency',stack:'electron',ver:'v1.1.0',
   desc:'本地优先的极简记账桌面应用：收支记录、仪表盘概览、6月趋势图、分类环形图、日历回看、预算管理、账户余额、资产负债分布、搜索、二次确认防误删、JSON/CSV导出。',
   tags:['Electron','原生 JS'],dl:R+'/tag/accounting-manager-v1.1.0',gh:G+'/tree/main/accounting-manager',
   features:['收支记录','仪表盘概览','6 月趋势图','分类环形图','日历回看','预算管理','账户余额','资产负债分布','二次确认防误删','JSON/CSV 导出']},
  {id:'snippet-manager',icon:'📋',name:'代码片段管家',cat:'dev',stack:'electron',ver:'v1.1.0',
   desc:'本地优先的代码片段管理桌面应用：自研语法高亮引擎（20+语言）、全文搜索、标签分类、收藏置顶、导入导出、全局快捷键、托盘常驻。',
   tags:['Electron','原生 JS'],dl:R+'/tag/snippet-manager-v1.1.0',gh:G+'/tree/main/snippet-manager',
   features:['自研语法高亮引擎（20+ 语言）','全文搜索','标签分类','收藏置顶','导入导出','全局快捷键','托盘常驻']},
  {id:'time-tracker',icon:'⏱️',name:'时间管家',cat:'efficiency',stack:'electron',ver:'v1.1.0',
   desc:'本地优先的时间追踪桌面应用：一键计时、多项目管理、今日记录、统计图表、CSV/JSON 导出导入、系统托盘、迷你进度条、纯本地隐私。',
   tags:['Electron','原生 JS'],dl:R+'/tag/time-tracker-v1.1.0',gh:G+'/tree/main/time-tracker',
   features:['一键计时','多项目管理','今日记录','统计图表','CSV/JSON 导出导入','系统托盘','迷你进度条','纯本地隐私']},
  {id:'port-manager',icon:'🔌',name:'端口管家',cat:'system',stack:'electron',ver:'v1.0.0',
   desc:'本地网络端口监控与管理桌面应用：实时扫描连接、一键结束占用进程、端口收藏、状态筛选、进程详情、CSV/JSON 导出，纯本地隐私优先。',
   tags:['Electron','原生 JS'],dl:R+'/tag/port-manager-v1.0.0',gh:G+'/tree/main/port-manager',
   features:['实时扫描连接','一键结束占用进程','端口收藏','状态筛选','进程详情','CSV/JSON 导出','纯本地隐私优先']},
  {id:'checksum-manager',icon:'🛡️',name:'校验管家',cat:'system',stack:'electron',ver:'v1.0.0',
   desc:'本地文件哈希校验工具：MD5/SHA1/SHA256/SHA512/CRC32 五合一、拖放即算、粘贴哈希自动识别算法实时比对、批量处理、流式计算大文件、历史记录。',
   tags:['Electron','原生 JS'],dl:R+'/tag/checksum-manager-v1.0.0',gh:G+'/tree/main/checksum-manager',
   features:['MD5/SHA1/SHA256/SHA512/CRC32 五合一','拖放即算','粘贴哈希自动识别算法','实时比对','批量处理','流式计算大文件','历史记录']},
  {id:'api-manager',icon:'🔌',name:'API管家',cat:'dev',stack:'electron',ver:'v1.0.0',
   desc:'本地优先的 HTTP API 测试工具：集合管理、环境变量、JSON 语法高亮、历史记录，苹果白高端风格。',
   tags:['Electron','原生 JS'],dl:R+'/tag/api-manager-v1.0.0',gh:G+'/tree/main/api-manager',
   features:['集合管理','环境变量','JSON 语法高亮','历史记录','苹果白高端风格']},
  {id:'topmost-manager',icon:'📌',name:'置顶管家',cat:'system',stack:'electron',ver:'v1.0.0',
   desc:'Windows 窗口置顶管理工具：可视化窗口列表、一键置顶、透明度调节、全局热键、自动置顶规则、托盘常驻，纯本地隐私优先。',
   tags:['Electron','原生 JS'],dl:R+'/tag/topmost-manager-v1.0.0',gh:G+'/tree/main/topmost-manager',
   features:['可视化窗口列表','一键置顶','透明度调节','全局热键','自动置顶规则','托盘常驻','纯本地隐私优先']},
  {id:'eye-rest-manager',icon:'👁',name:'护眼管家',cat:'efficiency',stack:'electron',ver:'v1.1.0',
   desc:'护眼休息提醒桌面管家：20-20-20法则、三级休息周期、眼保健操引导、严格模式、免打扰时段、全屏抑制、本地统计，苹果白高端风格。',
   tags:['Electron','原生 JS'],dl:R+'/tag/eye-rest-manager-v1.1.0',gh:G+'/tree/main/eye-rest-manager',
   features:['20-20-20 法则','三级休息周期','眼保健操引导','严格模式','免打扰时段','全屏抑制','本地统计']},
  {id:'hosts-manager',icon:'🖥️',name:'Hosts管家',cat:'system',stack:'electron',ver:'v1.0.0',
   desc:'hosts 文件编辑与方案管理桌面应用：可视化编辑、一键应用、模板库、方案保存、自动备份。',
   tags:['Electron','原生 JS'],dl:R+'/tag/hosts-manager-v1.0.0',gh:G+'/tree/main/hosts-manager',
   features:['可视化编辑 hosts','一键应用','模板库','方案保存','自动备份']},
  {id:'network-manager',icon:'🌐',name:'网络管家',cat:'system',stack:'electron',ver:'v1.1.0',
   desc:'本地网络诊断一体化桌面应用：Ping/路由追踪/DNS/端口检测/HTTP头/Whois/IP归属 7合1、延迟柱状图、诊断历史、复制结果、系统托盘、单实例锁、历史导出。',
   tags:['Electron','原生 JS'],dl:R+'/tag/network-manager-v1.1.0',gh:G+'/tree/main/network-manager',
   features:['7 合 1：Ping/路由追踪/DNS/端口检测/HTTP头/Whois/IP归属','延迟柱状图','诊断历史','复制结果','系统托盘','单实例锁','历史导出 CSV/JSON']},
  {id:'subscription-manager',icon:'💰',name:'订阅管家',cat:'efficiency',stack:'electron',ver:'v1.1.0',
   desc:'本地优先的订阅服务管理桌面应用：支出概览、续费提醒、分类统计、停用启用、JSON/CSV 导入导出、二次确认防误删、托盘常驻。',
   tags:['Electron','原生 JS'],dl:R+'/tag/subscription-manager-v1.1.0',gh:G+'/tree/main/subscription-manager',
   features:['支出概览','续费提醒','分类统计','停用启用','JSON/CSV 导入导出','二次确认防误删','托盘常驻']},
  {id:'sticky-notes-manager',icon:'📝',name:'便签管家',cat:'efficiency',stack:'electron',ver:'v1.1.0',
   desc:'本地便签桌面应用：快速记录、分类管理、置顶标记、全文搜索、颜色标签、回收站（30天恢复）、导入导出、全局快捷键、托盘常驻，纯本地隐私优先。',
   tags:['Electron','原生 JS'],dl:R+'/tag/sticky-notes-manager-v1.1.0',gh:G+'/tree/main/sticky-notes-manager',
   features:['快速记录','分类管理','置顶标记','全文搜索','颜色标签','回收站 30 天恢复','导入导出','全局快捷键','托盘常驻']},
  {id:'watermark-manager',icon:'💧',name:'水印管家',cat:'system',stack:'electron',ver:'v1.1.0',
   desc:'屏幕水印防泄密工具：透明置顶鼠标穿透、多屏支持、动态变量、6种快捷模板、定时水印（工作时段/星期/跨夜）、智能IP识别过滤虚拟网卡、实时预览、托盘常驻。',
   tags:['Electron','原生 JS'],dl:R+'/tag/watermark-manager-v1.1.0',gh:G+'/tree/main/watermark-manager',
   features:['透明置顶鼠标穿透','多屏支持','动态变量','6 种快捷模板','定时水印：工作时段/星期/跨夜','智能 IP 识别过滤虚拟网卡','实时预览','托盘常驻']},
  {id:'regex-manager',icon:'📐',name:'正则管家',cat:'dev',stack:'electron',ver:'v1.0.0',
   desc:'本地正则表达式测试与调试工具：实时高亮、捕获组详情、替换预览（支持 $1 $2 $&）、30+ 模式库、历史收藏，苹果白高端风格。',
   tags:['Electron','原生 JS'],dl:R+'/tag/regex-manager-v1.0.0',gh:G+'/tree/main/regex-manager',
   features:['实时高亮','捕获组详情','替换预览（支持 $1 $2 $&）','30+ 模式库','历史收藏','苹果白高端风格']},
  {id:'csv-manager',icon:'📊',name:'表格管家',cat:'efficiency',stack:'electron',ver:'v1.1.0',
   desc:'本地 CSV/TSV 数据查看与分析工具：自动识别分隔符、列类型推断、数值统计、排序过滤、图表可视化、虚拟滚动、多格式导出，纯本地隐私优先。',
   tags:['Electron','原生 JS'],dl:R+'/tag/csv-manager-v1.1.0',gh:G+'/tree/main/csv-manager',
   features:['自动识别分隔符','列类型推断','数值统计','排序过滤','图表可视化','虚拟滚动','多格式导出','纯本地隐私优先']},
  {id:'startup-manager',icon:'🚀',name:'启动项管家',cat:'system',stack:'electron',ver:'v1.0.0',
   desc:'Windows 启动项可视化管理桌面应用：注册表+启动文件夹双来源、一键启用/禁用/删除、搜索筛选、统计概览，苹果白高端风格。',
   tags:['Electron','原生 JS'],dl:R+'/tag/startup-manager-v1.0.0',gh:G+'/tree/main/startup-manager',
   features:['注册表+启动文件夹双来源','一键启用/禁用/删除','搜索筛选','统计概览','苹果白高端风格']},
  {id:'pomodoro-manager',icon:'🍅',name:'番茄管家',cat:'efficiency',stack:'electron',ver:'v1.1.0',
   desc:'本地优先的番茄工作法专注桌面应用：专注/短休息/长休息三阶段轮转、任务清单、统计分析、连续打卡、严格模式、键盘快捷键、合成白噪音、托盘常驻。',
   tags:['Electron','原生 JS'],dl:R+'/tag/pomodoro-manager-v1.1.0',gh:G+'/tree/main/pomodoro-manager',
   features:['专注/短休息/长休息三阶段轮转','任务清单','统计分析','连续打卡','严格模式','键盘快捷键','合成白噪音','托盘常驻']},
  {id:'ocr-manager',icon:'👁',name:'识字管家',cat:'efficiency',stack:'electron',ver:'v1.0.1',
   desc:'本地离线 OCR 文字识别工具：中英文识别、全局快捷键截图识别、批量队列、置信度与字数统计、历史记录、自动复制、多语言切换，纯本地隐私优先。',
   tags:['Electron','tesseract.js'],dl:R+'/tag/ocr-manager-v1.0.1',gh:G+'/tree/main/ocr-manager',
   features:['中英文识别','全局快捷键截图识别','批量队列','置信度与字数统计','历史记录','自动复制','多语言切换','纯本地隐私优先']},
  {id:'calculator-manager',icon:'🧮',name:'计算器管家',cat:'efficiency',stack:'electron',ver:'v1.1.0',
   desc:'苹果白高端风格桌面计算器：基础/科学/程序员/转换四模式、自研表达式引擎、十大类单位互转、常见换算参考、变量定义、历史记录、纯本地隐私优先。',
   tags:['Electron','原生 JS'],dl:R+'/tag/calculator-manager-v1.1.0',gh:G+'/tree/main/calculator-manager',
   features:['基础/科学/程序员/转换四模式','自研表达式引擎','十大类单位互转','常见换算参考','变量定义','历史记录','纯本地隐私优先']},
  {id:'mind-map-manager',icon:'🧠',name:'思维导图管家',cat:'efficiency',stack:'electron',ver:'v1.0.0',
   desc:'本地优先的思维导图桌面工具：多文档管理、键盘流操作、自动树形布局、彩色分支、折叠展开、多格式导出（PNG/JSON/Markdown），数据不出本机。',
   tags:['Electron','原生 SVG'],dl:R+'/tag/mind-map-manager-v1.0.0',gh:G+'/tree/main/mind-map-manager',
   features:['多文档管理','键盘流操作','自动树形布局','彩色分支','折叠展开','多格式导出 PNG/JSON/Markdown','数据不出本机']},
  {id:'screen-recorder-manager',icon:'🎬',name:'录屏管家',cat:'system',stack:'electron',ver:'v1.0.0',
   desc:'苹果白高端风格本地屏幕录制工具：屏幕/窗口录制、系统声音+麦克风混音、暂停继续、历史管理、全局快捷键、托盘常驻，纯本地隐私优先。',
   tags:['Electron','原生 JS'],dl:R+'/tag/screen-recorder-manager-v1.0.0',gh:G+'/tree/main/screen-recorder-manager',
   features:['屏幕/窗口录制','系统声音+麦克风混音','暂停继续','历史管理','全局快捷键','托盘常驻','纯本地隐私优先']},
  {id:'wheel-manager',icon:'🎡',name:'抽签转盘管家',cat:'efficiency',stack:'electron',ver:'v1.0.0',
   desc:'苹果白风格桌面随机选择工具：加权随机、多名单管理、批量导入、不重复抽奖、历史记录、音效、自定义设置，纯本地隐私优先。',
   tags:['Electron','原生 JS'],dl:R+'/tag/wheel-manager-v1.0.0',gh:G+'/tree/main/wheel-manager',
   features:['加权随机','多名单管理','批量导入','不重复抽奖','历史记录','音效','自定义设置','纯本地隐私优先']},
  {id:'anniversary-manager',icon:'💌',name:'纪念日管家',cat:'efficiency',stack:'electron',ver:'v1.0.0',
   desc:'本地优先的纪念日管理桌面应用：公历+农历双历法、生日/纪念日/忌日/自定义四类型、生肖星座、倒计时、即将到来侧栏、分类筛选、搜索排序、JSON导入导出。',
   tags:['Electron','原生 JS'],dl:R+'/tag/anniversary-manager-v1.0.0',gh:G+'/tree/main/anniversary-manager',
   features:['公历+农历双历法','四类型：生日/纪念日/忌日/自定义','生肖星座','倒计时','即将到来侧栏','分类筛选','搜索排序','JSON 导入导出','纯本地隐私优先']},
  {id:'alarm-manager',icon:'🔔',name:'闹钟管家',cat:'efficiency',stack:'electron',ver:'v1.0.0',
   desc:'本地优先的多闹钟桌面管家：农历每年/一次性重复、5 种 Web Audio 合成铃声、智能贪睡、渐强音量、托盘常驻、全局快捷键。',
   tags:['Electron','原生 JS'],dl:R+'/tag/alarm-manager-v1.0.0',gh:G+'/tree/main/alarm-manager',
   features:['多闹钟管理，可视化卡片列表','7 种重复模式（含农历每年/一次性）','5 种 Web Audio 合成铃声，零音频文件','智能贪睡 + 渐强音量','全局快捷键 Ctrl+Alt+A','托盘常驻 + 单实例锁','JSON 导入导出 + 自动备份']},
  {id:'disk-manager',icon:'💾',name:'磁盘管家',cat:'system',stack:'electron',ver:'v1.0.0',
   desc:'苹果白风格磁盘空间可视化分析器：Squarified Treemap 占用可视化、分层钻取、大文件排行、类型分布统计，纯本地隐私优先。',
   tags:['Electron','原生 JS'],dl:R+'/tag/disk-manager-v1.0.0',gh:G+'/tree/main/disk-manager',
   features:['Squarified Treemap 可视化磁盘占用','分层钻取 + 面包屑导航','大文件排行，一键定位/移到回收站','按视频/音频/图片/文档类型分布统计','扩展名排行与扫描概览','Treemap 渲染深度可调','纯本地扫描，不联网不上传']},
  {id:'emoji-manager',icon:'😊',name:'表情管家便携版',cat:'efficiency',stack:'python',ver:'v1.0.0',
   desc:'苹果白高端风格的输入法式 emoji 选择器：全局热键唤起、光标处弹出、点击复制、失焦自动隐藏、托盘常驻，原生 PySide6 重写。',
   tags:['Python','PySide6'],dl:R+'/download/emoji-manager-portable-v1.0.0/emoji-portable.exe',gh:G+'/tree/main/emoji-manager',
   features:['全局热键 Ctrl+Shift+E 唤起','失焦自动隐藏，像输入法候选框','跟随光标位置弹出','点击即复制到剪贴板','本地收藏 + 使用历史','关键词搜索（中文名/关键词/字符）','11 大分类，1287 个 emoji','单 exe 便携分发，内存 <60 MB']},
  {id:'flashcard-manager',icon:'🃏',name:'闪卡记忆管家',cat:'efficiency',stack:'electron',ver:'v1.0.0',
   desc:'基于 SM-2 间隔重复算法的本地闪卡学习工具：多卡组管理、四档评分精准调度、离线优先、导入导出，科学记忆。',
   tags:['Electron','原生 JS'],dl:R+'/tag/flashcard-manager-v1.0.0',gh:G+'/tree/main/flashcard-manager',
   features:['SM-2 间隔重复算法（与 Anki 同款）','多卡组管理','四档评分：忘了/困难/良好/简单','本地 JSON 存储，离线可用','导入导出备份/恢复','苹果白风格 UI']},
  {id:'image-converter',icon:'🖼️',name:'图片转换管家',cat:'design',stack:'electron',ver:'v1.0.0',
   desc:'苹果白风格本地图片格式批量转换工具：支持 PNG/JPG/WebP/BMP/GIF 互转、质量调节、批量拖放、保留元数据，纯本地隐私优先。',
   tags:['Electron','原生 JS'],gh:G+'/tree/main/image-converter',
   features:['PNG/JPG/WebP/BMP/GIF 格式互转','批量拖放转换','质量调节与压缩','保留 EXIF 元数据','实时预览转换效果','纯本地处理，不联网']},
  {id:'palette-manager',icon:'🎨',name:'调色板管家',cat:'design',stack:'electron',ver:'v1.0.0',
   desc:'基于色彩理论的桌面调色板生成管理工具：类比/互补/三元/分裂互补等六种理论自动生成、空格随机、锁定微调、图片取色（K-means）、WCAG 对比度检查、CSS/SCSS/JSON/Tailwind 多格式导出、本地收藏、托盘常驻。',
   tags:['Electron','原生 JS'],dl:R+'/tag/palette-manager-v1.0.0',gh:G+'/tree/main/palette-manager',
   features:['六种色彩理论自动生成（类比/互补/三元/四元/分裂互补/同色系）','空格键一键随机生成','锁定满意颜色，其余重新生成','图片取色（K-means 聚类算法）','WCAG 对比度检查 AA/AAA 等级','多格式导出 CSS/SCSS/JSON/Tailwind','本地收藏 + 系统托盘常驻','苹果白高端风格']},
  {id:'json-manager',icon:'🧩',name:'JSON管家',cat:'dev',stack:'electron',ver:'v1.0.0',
   desc:'苹果白高端风格 JSON 深度处理桌面工具：格式化/树形浏览/jq 过滤/JSON 对比/格式转换/Schema 校验，6 合 1 一站搞定。',
   tags:['Electron','原生 JS'],dl:R+'/tag/json-manager-v1.0.0',gh:G+'/tree/main/json-manager',
   features:['格式化（美化/压缩）+ 实时语法高亮','树形浏览，可折叠展开','jq 过滤（简化版 jq 语法）','JSON 对比（逐字段差异）','格式转换 CSV/YAML/XML/Properties','Schema 校验','文件读写 + 历史记录 + 实时统计']},
  {id:'keyboard-tester',icon:'⌨️',name:'键鼠管家',cat:'dev',stack:'electron',ver:'v1.0.0',
   desc:'Windows 上最优雅的键鼠测试工具，5 合 1：键盘测试/NKRO/按键统计热力图/鼠标测试/打字测速，苹果白高端风格。',
   tags:['Electron','原生 JS'],dl:R+'/tag/keyboard-tester-v1.0.0',gh:G+'/tree/main/keyboard-tester',
   features:['键盘测试：虚拟键盘实时高亮','NKRO 测试：多键同按识别数','按键统计：热力图 + Top 8 排行榜','鼠标测试：三键计数/滚轮/移动距离','打字测速：中英文混合 WPM/准确率','按键流水 + 数据持久化与导出']},
  {id:'log-manager',icon:'📜',name:'日志管家',cat:'dev',stack:'electron',ver:'v1.0.0',
   desc:'本地优先的开发者日志查看工具：实时跟踪、级别过滤、全文搜索、大文件虚拟滚动、统计分析，苹果白高端风格。',
   tags:['Electron','原生 JS'],dl:R+'/tag/log-manager-v1.0.0',gh:G+'/tree/main/log-manager',
   features:['实时跟踪日志变化（类似 tail -f）','六级日志级别识别与彩色徽章过滤','全文搜索（正则/大小写敏感）+ 高亮跳转','大文件虚拟滚动 + 多编码识别','统计分析（级别分布条形图）','最近打开 12 个文件 + 拖拽打开','导出筛选结果']},
  {id:'password-generator',icon:'🔐',name:'密码生成器',cat:'dev',stack:'electron',ver:'v1.0.0',
   desc:'苹果白高端风格本地密码生成与管理工具：基于 CSPRNG 密码学安全随机数、随机密码/记忆口令/强度检测/批量生成。',
   tags:['Electron','原生 JS'],dl:R+'/tag/password-generator-v1.0.0',gh:G+'/tree/main/password-generator',
   features:['随机密码（4-64 位，可排除易混字符）','记忆口令（3-8 词英文组合）','强度检测（Shannon 熵 + 破解耗时估算）','批量生成（5-50 个）','历史记录（本地保存最近 50 条）','拒绝采样消除模偏置的 CSPRNG']},
  {id:'unit-converter',icon:'🔄',name:'单位转换器',cat:'efficiency',stack:'electron',ver:'v1.0.0',
   desc:'精致小巧的桌面单位转换工具：支持 14 大类、160+ 单位互转，实时转换、全单位参考、一键复制，苹果白设计。',
   tags:['Electron','原生 JS'],dl:R+'/tag/unit-converter-v1.0.0',gh:G+'/tree/main/unit-converter',
   features:['14 大类单位（长度/重量/温度/面积等）','160+ 单位，涵盖国际/英制/中国市制','实时转换，输入即转换零延迟','全单位参考表','单位互换 + 一键复制','苹果白设计语言']},
  {id:'watching-manager',icon:'🎬',name:'剧集管家',cat:'efficiency',stack:'electron',ver:'v1.0.0',
   desc:'本地追剧进度管理桌面工具：剧集档案、一键推进下一集、评分标签、统计概览、追剧提醒，纯本地存储不联网。',
   tags:['Electron','原生 JS'],dl:R+'/tag/watching-manager-v1.0.0',gh:G+'/tree/main/watching-manager',
   features:['剧集档案（剧名/类型/状态/季集进度）','一键推进下一集，跨季自动 +1','0-10 分评分 + 自定义标签','统计概览（状态分布/类型条形图/标签云）','追剧提醒（3 天未更新自动列表 + 通知）','搜索筛选 + 5 种排序','数据导入导出 + 海报管理']},
  {id:'ambient-sound',icon:'🎵',name:'环境音播放器',cat:'efficiency',stack:'electron',ver:'v1.0.0',
   desc:'专注·放松·助眠的纯程序合成环境音桌面应用：8 种声音（白/粉/棕噪音、雨声、海浪、风声、篝火、溪流）由 Web Audio API 实时数学合成，零音频文件、无版权风险、无缝循环；多通道混音、睡眠定时器、场景预设、实时频谱可视化。',
   tags:['Electron','Web Audio API'],gh:G+'/tree/main/ambient-sound',
   features:['8 种程序合成声音：白/粉/棕噪音、雨声、海浪、风声、篝火、溪流','Web Audio API 实时数学合成，零音频文件','多通道混音，各自独立音量','睡眠定时器 15/30/60/90 分钟平滑淡出','内置场景预设 + 自定义保存','实时频谱可视化，苹果蓝渐变','系统托盘常驻','首尾交叉淡化无缝循环']},
  {id:'diary-manager',icon:'📔',name:'日记本',cat:'efficiency',stack:'electron',ver:'v1.0.0',
   desc:'极简克制的桌面日记应用：日历视图一眼回看、沉浸式衬线字体写作、emoji 心情追踪、标签管理、全文搜索、Markdown 导出，本地存储隐私无忧。',
   tags:['Electron','原生 JS'],dl:R+'/tag/diary-manager-v1.0.0',gh:G+'/tree/main/diary-manager',
   features:['日历视图，点点点选即跳转','沉浸式衬线字体写作','emoji 心情追踪，回看情绪轨迹','标签管理与快速检索','全文搜索：关键词/标签/日期','Markdown 一键导出','Ctrl/⌘+S 快速保存','本地存储，绝不上传']},
  {id:'system-monitor',icon:'📊',name:'系统监控器',cat:'system',stack:'web',ver:'v1.0.0',
   desc:'苹果白风格实时系统资源监控仪表盘：CPU/内存/磁盘/网络/进程实时监控、圆环占比可视化、历史曲线图（含 Y 轴刻度）、Top 进程排行，完全本地运行零数据外传。',
   tags:['Node.js','原生 Canvas'],gh:G+'/tree/main/system-monitor',
   features:['CPU/内存/磁盘/网络/进程实时监控','圆环占比仪表盘，平滑过渡动画','历史曲线图（原生 Canvas，含 Y 轴刻度）','Top 8 进程排行，斑马纹表格','系统信息：CPU/GPU/系统/内核/架构','1.5 秒自动刷新，响应式布局','完全本地运行，零数据外传']},
  {id:'prompt-manager',icon:'💡',name:'提示词管家',cat:'efficiency',stack:'electron',ver:'v1.0.0',
   desc:'AI 用户的提示词管理利器：集中收纳、分类、复用你的 AI 提示词，支持 {{变量}} 占位符表单填写、一键复制到 AI 工具、收藏与最近使用、使用次数统计、全文搜索、JSON 导入导出，纯本地隐私优先。',
   tags:['Electron','原生 JS'],dl:R+'/tag/prompt-manager-v1.0.0',gh:G+'/tree/main/prompt-manager',
   features:['集中管理所有提示词，告别「上次那个提示词去哪了」','分类 + 标签双维度组织','{{变量名}} 占位符，使用时弹表单逐个填写','一键复制到 AI 工具（无变量直接复制）','收藏置顶 + 自动记录最近使用','使用次数与最后使用时间统计','全文搜索：标题/内容/标签/分类','网格 / 列表两种视图随需切换','JSON 导入导出，跨设备同步','Ctrl/Cmd+N 新建、Ctrl/Cmd+F 搜索、Esc 关闭','本地存储，不上传任何服务器']},
  /* 第十六轮：补录 7 个遗漏项目，工具总数 57→64，与 GitHub 仓库实际目录完全对齐 */
  {id:'authenticator-manager',icon:'🔑',name:'验证器管家',cat:'system',stack:'electron',ver:'v1.0.0',
   desc:'本地两步验证（2FA/TOTP）桌面应用：系统级 DPAPI 加密存储密钥、一键复制动态验证码、倒计时圆环可视化、全局热键唤起、系统托盘常驻、otpauth:// 链接解析、AES-256-GCM 加密备份、兼容 SHA1/SHA256/SHA512。',
   tags:['Electron','原生 JS'],gh:G+'/tree/main/authenticator-manager',
   features:['系统级 DPAPI 加密存储，密钥绝不离开本机','一键复制 6/7/8 位动态验证码','圆环倒计时可视化，≤10s 黄色 ≤5s 红色警示','全局热键 Ctrl+Shift+A 唤起/隐藏','系统托盘常驻，失焦自动隐藏','otpauth:// 链接自动解析','AES-256-GCM 加密备份导入导出','兼容 SHA1/SHA256/SHA512 算法']},
  {id:'image-compressor',icon:'🗜️',name:'图片压缩管家',cat:'design',stack:'electron',ver:'v1.0.0',
   desc:'批量图片压缩工具：拖拽导入多张图片、质量滑块调节（1-100）、JPG/PNG/WebP 互转、实时预览原始与压缩后大小及节省比例、极致/均衡/高清预设、本地处理隐私安全。',
   tags:['Electron','sharp'],gh:G+'/tree/main/image-compressor',
   features:['拖拽导入批量压缩','质量滑块 1-100 可调','JPG / PNG / WebP 互转','实时预览节省比例','极致 / 均衡 / 高清三档预设','本地处理，图片不上传云端']},
  {id:'launcher-manager',icon:'🔦',name:'启动器管家',cat:'efficiency',stack:'electron',ver:'v1.0.0',
   desc:'macOS Spotlight 风格的 Windows 快速应用启动器：Alt+Space 全局唤起、自研智能模糊搜索算法（精确/单词边界/前缀/子序列匹配）、自动索引本地应用、最近使用排序置顶、全键盘操作、5 分钟增量索引。',
   tags:['Electron','原生 JS'],gh:G+'/tree/main/launcher-manager',
   features:['Alt+Space 全局热键唤起','智能模糊搜索（精确/单词边界/前缀/子序列）','自动索引开始菜单/桌面/用户目录应用','最近使用排序，常用应用置顶','全键盘操作 ↑↓ 选择 Enter 启动','5 分钟增量索引，内存占用低']},
  {id:'music-player',icon:'🎧',name:'音乐播放器',cat:'efficiency',stack:'electron',ver:'v1.0.0',
   desc:'苹果白风格本地音乐播放器：支持 MP3/WAV/OGG/FLAC/M4A/AAC 多格式、文件/文件夹/拖拽导入、播放列表持久化、动态渐变封面、顺序/随机/列表循环/单曲循环、空格暂停 Shift+←/→ 快进退、轻量纯净无网络请求。',
   tags:['Electron','原生 JS'],gh:G+'/tree/main/music-player',
   features:['本地音乐导入：文件/文件夹/拖拽','多格式 MP3/WAV/OGG/FLAC/M4A/AAC','播放列表自动持久化','动态渐变封面，根据歌名生成','顺序/随机/列表循环/单曲循环','空格暂停 Shift+←/→ 快进退','无广告无遥测无网络请求']},
  {id:'quick-translate',icon:'🗣️',name:'快速翻译管家',cat:'efficiency',stack:'electron',ver:'v1.0.0',
   desc:'系统托盘驻留的快速翻译工具：Ctrl+Shift+T 全局唤起并翻译剪贴板、双引擎翻译（Google gtx + MyMemory 备用）、20 种语言、自动检测源语言、剪贴板监听复制即翻译、历史记录 100 条。',
   tags:['Electron','原生 JS'],gh:G+'/tree/main/quick-translate',
   features:['Ctrl+Shift+T 全局唤起翻译剪贴板','双引擎 Google gtx + MyMemory 备用','20 种语言互译','自动检测源语言','剪贴板监听，复制即翻译','历史记录最近 100 条一键回填','托盘驻留，关闭即最小化']},
  {id:'reading-list-manager',icon:'📚',name:'稍后阅读管家',cat:'efficiency',stack:'electron',ver:'v1.0.0',
   desc:'桌面「稍后阅读」工具，摆脱浏览器标签爆炸：粘贴 URL 自动提取域名与 favicon、状态管理（未读/阅读中/已读/已归档）、标签分类侧栏、Ctrl+Shift+L 全局收藏剪贴板链接、搜索过滤、JSON 导入导出、系统托盘。',
   tags:['Electron','原生 JS'],gh:G+'/tree/main/reading-list-manager',
   features:['粘贴 URL 自动提取域名与 favicon','未读/阅读中/已读/已归档四态管理','标签分类侧栏筛选','Ctrl+Shift+L 全局热键收藏剪贴板链接','即时搜索：标题/URL/笔记/标签','多种排序：添加时间/更新时间/标题','JSON 导入导出','系统托盘常驻，本地存储']},
  {id:'wallpaper-manager',icon:'🌄',name:'壁纸管家',cat:'design',stack:'electron',ver:'v1.0.0',
   desc:'本地壁纸管理工具：多文件夹来源管理、网格瀑布预览缩略图、收藏最爱一键筛选、定时自动轮换（1/2/4/6/12/24 小时）、必应每日壁纸一键设置、全文搜索、系统托盘常驻快速切换。',
   tags:['Electron','原生 JS'],gh:G+'/tree/main/wallpaper-manager',
   features:['多文件夹来源管理，自动扫描图片','网格瀑布预览缩略图','收藏最爱，一键筛选','定时轮换（1/2/4/6/12/24 小时）','必应每日壁纸一键拉取设置','全文搜索按文件名过滤','系统托盘常驻快速切换']},
  /* 第十七轮：补录 2 个遗漏项目，工具总数 64→66，与 GitHub 仓库实际目录完全对齐 */
  {id:'mortgage-manager',icon:'🏠',name:'房贷计算器',cat:'efficiency',stack:'electron',ver:'v1.0.0',
   desc:'苹果白风格本地房贷计算器：商业贷款/公积金贷款/组合贷款三种模式、等额本息与等额本金两种还款方式、提前还款测算（缩短年限/减少月供）、按年折叠还款明细、本金利息饼图与剩余本金曲线、CSV 导出、纯本地隐私优先。',
   tags:['Electron','原生 JS'],gh:G+'/tree/main/mortgage-manager',
   features:['商业贷款 / 公积金贷款 / 组合贷款三种模式','等额本息、等额本金两种还款方式','提前还款两种策略：缩短年限 / 减少月供','按年折叠还款明细，展开查看每月本金/利息/剩余本金','本金-利息构成饼图 + 剩余本金变化曲线','常用本金/利率/年限一键填入','CSV 导出还款计划，Excel 直接打开','16 项核心计算单元测试','所有计算在本地完成，不联网不上传']},
  {id:'voice-memo-manager',icon:'🎙️',name:'语音备忘录',cat:'efficiency',stack:'electron',ver:'v1.0.0',
   desc:'苹果白风格桌面语音备忘录：一键录音、实时波形动画、精确计时、流畅播放（进度条可拖动）、录音列表自动倒序、模糊搜索、重命名/删除、打开目录定位、系统托盘常驻，纯本地隐私优先。',
   tags:['Electron','MediaRecorder API'],gh:G+'/tree/main/voice-memo-manager',
   features:['一键录音，单击开始/再次单击结束','录音时实时波形动画 + 精确到秒计时器','内置播放器，进度条可拖动跳转','录音列表自动按时间倒序','按标题模糊搜索','悬停显示重命名/删除按钮','一键在文件管理器中定位录音','系统托盘常驻，关闭即最小化','空格键开始/停止录音（输入框聚焦时除外）']},
  /* 第十九轮：补录遗漏项目 license-manager，工具总数 66→67，与 GitHub 仓库实际目录完全对齐 */
  {id:'license-manager',icon:'🔑',name:'许可证管理器',cat:'system',stack:'electron',ver:'v1.0.0',
   desc:'苹果白风格软件许可证管理器：AES-256-GCM 加密 + PBKDF2 100k 轮密钥派生、到期提醒（30 天内/已过期/永久授权）、仪表盘统计、全文搜索、7 大分类、密钥脱敏显示、加密备份导入导出、5 分钟自动锁定、纯本地隐私优先。',
   tags:['Electron','Node.js crypto'],gh:G+'/tree/main/license-manager',
   features:['AES-256-GCM 加密 + PBKDF2-SHA512 100k 轮密钥派生','主密码不存储，仅会话内派生密钥','到期提醒：有效 / 即将到期（30 天）/ 已过期 / 永久授权','仪表盘统计：总数、即将到期、总价值','全文搜索：名称、厂商、密钥、备注','7 大分类：生产力 / 开发 / 设计 / 游戏 / 系统 / 安全 / 其他','密钥脱敏显示，一键复制完整密钥','加密备份导出 / 导入（.lmenc 跨设备迁移）','5 分钟无操作自动锁定保险库']}
];

/* Assign screenshot path + score placeholder to each project */
/* shot  = 卡片尺寸小图 (480px wide, ~5KB) 用于卡片首屏 */
/* full  = 大图尺寸 (1200px wide, ~22KB) 用于 lightbox */
/* 仅最近新增的项目标记「新」徽标，保持徽标稀缺性与视觉指引价值 */
/* 第十九轮：新徽标刷新为本次补录的 1 个项目（license-manager），恢复徽标稀缺性 */
var NEW_IDS = ['license-manager'];
PROJECTS.forEach(function(p){
  p.shot = 'assets/img/' + p.id + '.webp';
  p.full = 'assets/img/' + p.id + '-full.webp';
  p.score = 0;
  p.isNew = NEW_IDS.indexOf(p.id) !== -1;
});

/* 卡片背景：精致分类色渐变（低饱和度，统一中有差异） */
var GRAD = {
  /* 统一为单一中性浅蓝渐变：mimo 反馈 4 色背景在网格中视觉杂乱 */
  dev:{emoji_bg:'linear-gradient(135deg,#fafbfd 0%,#f0f4fa 100%)'},
  system:{emoji_bg:'linear-gradient(135deg,#fafbfd 0%,#f0f4fa 100%)'},
  efficiency:{emoji_bg:'linear-gradient(135deg,#fafbfd 0%,#f0f4fa 100%)'},
  design:{emoji_bg:'linear-gradient(135deg,#fafbfd 0%,#f0f4fa 100%)'}
};
var CAT_NAME = {dev:'开发工具',system:'系统工具',efficiency:'效率工具',design:'设计工具'};
var CAT_COLOR = {dev:'#007aff',system:'#34c759',efficiency:'#ff9500',design:'#af52de'};
var STACK_INFO = {web:{icon:'🌐',label:'Web'},electron:{icon:'⚡',label:'Electron'},python:{icon:'🐍',label:'Python'}};

/* 提取项目名首字符作为统一风格图标 */
function monogram(name){
  var s = name.trim();
  /* 英文项目名取首字母大写 */
  if(/^[A-Za-z]/.test(s)) return s.charAt(0).toUpperCase();
  /* 中文项目名取首个汉字 */
  return s.charAt(0);
}

/* ---------- 渲染卡片 ---------- */
var grid = document.getElementById('grid');
var empty = document.getElementById('empty');
var countEl = document.getElementById('count');

/* 搜索关键词高亮：在文本中包裹匹配片段为 <mark>，转义后再匹配避免 XSS */
function escapeHTML(s){ return String(s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
function highlight(text, query){
  var safe = escapeHTML(text);
  if(!query) return safe;
  var q = query.trim();
  if(!q) return safe;
  /* 转义正则特殊字符后构建匹配模式，全局不区分大小写 */
  var pattern = q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  try{
    var re = new RegExp('('+pattern+')','gi');
    return safe.replace(re,'<mark>$1</mark>');
  }catch(e){ return safe; }
}

function cardHTML(p, idx, query){
  var g = GRAD[p.cat];
  var cc = CAT_COLOR[p.cat];
  var si = STACK_INFO[p.stack] || {icon:'⚡',label:p.stack};
  // 第二十三轮：ver 字段兜底，未设置时回退 v1.0，避免版本徽章空缺
  var ver = p.ver || 'v1.0';
  var dlBtn = p.dl
    ? '<a class="btn btn--primary btn--sm card__cta" href="'+p.dl+'" target="_blank" rel="noopener"><span>获取</span><span class="card__cta-arrow" aria-hidden="true">→</span></a>'
    : '<a class="btn btn--primary btn--sm card__cta" href="'+p.gh+'" target="_blank" rel="noopener"><span>获取</span><span class="card__cta-arrow" aria-hidden="true">→</span></a>';
  var scoreBadge = p.score > 0
    ? '<span class="card__score" title="mimo 审美评分">'+p.score+'</span>'
    : '';
  var newBadge = p.isNew ? '<span class="card__new">新</span>' : '';
  var titleHTML = highlight(p.name, query);
  var descHTML = highlight(p.desc, query);
  // 第二十三轮：card__desc 加 data-full 属性供 CSS tooltip 显示完整描述
  var fullDesc = escapeHTML(p.desc || '');
  return ''+
  '<article class="card" data-cat="'+p.cat+'" data-stack="'+p.stack+'" data-id="'+p.id+'" tabindex="0" role="button" aria-label="'+escapeHTML(p.name)+' 详情">'+
    '<span class="card__hint" aria-hidden="true">查看详情</span>'+
    '<div class="card__media" style="background:'+g.emoji_bg+'">'+
      scoreBadge+
      '<span class="card__emoji-glow" aria-hidden="true"></span>'+
      '<span class="card__emoji" aria-hidden="true">'+p.icon+'</span>'+
      '<button class="card__lightbox-btn" aria-label="查看大图" data-lbid="'+p.id+'"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6"/><path d="M9 21H3v-6"/><path d="M21 3l-7 7"/><path d="M3 21l7-7"/></svg></button>'+
    '</div>'+
    '<div class="card__body">'+
      '<div class="card__meta">'+
        '<span class="card__stack">'+si.icon+' '+si.label+'</span>'+
        newBadge+
        '<span class="card__version">'+ver+'</span>'+
      '</div>'+
      '<h3 class="card__title" data-id="'+p.id+'">'+titleHTML+'</h3>'+
      '<p class="card__desc" data-full="'+fullDesc+'" title="'+fullDesc+'">'+descHTML+'</p>'+
      '<div class="card__actions">'+
        dlBtn+
        '<a class="card__src" href="'+p.gh+'" target="_blank" rel="noopener" aria-label="查看源码" title="查看源码"><svg class="card__src-icon" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z"/></svg></a>'+
      '</div>'+
    '</div>'+
  '</article>';
}

var isFirstRender = true;
function render(list){
  var q = currentQuery;
  /* 首次渲染直接出图（确保 headless 截图与首屏可见）；后续筛选才用淡出淡入 */
  if(isFirstRender){
    grid.innerHTML = list.map(function(p, i){ return cardHTML(p, i, q); }).join('');
    countEl.textContent = '共 '+list.length+' 个工具';
    empty.hidden = list.length > 0;
    observeCards();
    isFirstRender = false;
    return;
  }
  /* 筛选切换：先淡出旧卡片，再渲染新卡片并淡入，避免硬切闪烁 */
  grid.classList.add('is-fading');
  setTimeout(function(){
    grid.innerHTML = list.map(function(p, i){ return cardHTML(p, i, q); }).join('');
    countEl.textContent = '共 '+list.length+' 个工具';
    countEl.classList.remove('count-tick'); void countEl.offsetWidth; countEl.classList.add('count-tick');
    empty.hidden = list.length > 0;
    observeCards();
    grid.classList.remove('is-fading');
  }, 160);
}

/* ---------- 卡片出现动画 ---------- */
var io;
function observeCards(){
  if(!('IntersectionObserver' in window)){ document.querySelectorAll('.card').forEach(function(c){c.classList.add('is-visible')}); return; }
  if(io) io.disconnect();
  io = new IntersectionObserver(function(entries){
    entries.forEach(function(e,i){
      if(e.isIntersecting){
        setTimeout(function(){ e.target.classList.add('is-visible'); }, i*40);
        io.unobserve(e.target);
      }
    });
  },{threshold:0.08,rootMargin:'0px 0px -40px 0px'});
  document.querySelectorAll('.card').forEach(function(c){ io.observe(c); });
  /* 兜底：800ms 后仍未出现的卡片直接显示（确保 headless 截图与低性能环境可见） */
  setTimeout(function(){
    document.querySelectorAll('.card:not(.is-visible)').forEach(function(c){ c.classList.add('is-visible'); });
  }, 800);
}

/* ---------- 卡片 hover 鼠标光晕 spotlight ---------- */
/* 鼠标在卡片上移动时，更新 --mx/--my CSS 变量驱动 radial-gradient 光晕 */
grid.addEventListener('mousemove', function(e){
  var card = e.target.closest('.card');
  if(!card) return;
  var r = card.getBoundingClientRect();
  card.style.setProperty('--mx', ((e.clientX - r.left) / r.width * 100) + '%');
  card.style.setProperty('--my', ((e.clientY - r.top) / r.height * 100) + '%');
});

/* 第十五轮：卡片 3D 倾斜跟随鼠标 —— macOS dock 风格微交互（CSS 已预留 preserve-3d/is-tilting） */
var TILT_MAX = 5; /* 最大倾斜角度（度） */
var prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion:reduce)').matches;
if(!prefersReducedMotion){
  grid.addEventListener('mousemove', function(e){
    var card = e.target.closest('.card');
    if(!card) return;
    var r = card.getBoundingClientRect();
    /* 鼠标相对卡片中心的归一化坐标 (-0.5 ~ 0.5) */
    var px = (e.clientX - r.left) / r.width - 0.5;
    var py = (e.clientY - r.top) / r.height - 0.5;
    card.classList.add('is-tilting');
    /* 鼠标在右上角时卡片向右上倾斜：rotateY 跟随 px，rotateX 反向跟随 py */
    card.style.setProperty('--ry', (px * TILT_MAX * 2).toFixed(2) + 'deg');
    card.style.setProperty('--rx', (-py * TILT_MAX * 2).toFixed(2) + 'deg');
  });
  /* 鼠标离开卡片时复位 */
  grid.addEventListener('mouseout', function(e){
    var card = e.target.closest('.card');
    if(!card) return;
    if(e.relatedTarget && card.contains(e.relatedTarget)) return;
    card.classList.remove('is-tilting');
    card.style.setProperty('--rx','0deg');
    card.style.setProperty('--ry','0deg');
  });
}

/* ---------- 筛选 + 搜索 ---------- */
var currentFilter = 'all';
var currentQuery = '';

function applyFilter(){
  var q = currentQuery.toLowerCase().trim();
  var list = PROJECTS.filter(function(p){
    if(currentFilter !== 'all' && p.cat !== currentFilter) return false;
    if(q){
      var hay = (p.name + ' ' + p.desc + ' ' + p.tags.join(' ') + ' ' + p.id).toLowerCase();
      if(hay.indexOf(q) === -1) return false;
    }
    return true;
  });
  render(list);
}

/* 筛选 chips */
document.getElementById('chips').addEventListener('click', function(e){
  var btn = e.target.closest('.chip');
  if(!btn) return;
  document.querySelectorAll('.chip').forEach(function(c){ c.classList.remove('is-active'); c.setAttribute('aria-selected','false'); });
  btn.classList.add('is-active');
  btn.setAttribute('aria-selected','true');
  currentFilter = btn.dataset.filter;
  applyFilter();
});

/* 搜索 */
var searchInput = document.getElementById('search');
var searchClear = document.getElementById('search-clear');
var searchHint = document.querySelector('.search__hint');
var searchTimer;
/* 第十四轮：搜索 "/" kbd 提示呼吸脉冲——用户首次聚焦或按键后停止，引导快捷键发现 */
var searchInteracted = false;
function markSearchInteracted(){
  if(searchInteracted) return;
  searchInteracted = true;
  if(searchHint) searchHint.classList.remove('is-pulsing');
}
searchInput.addEventListener('input', function(e){
  clearTimeout(searchTimer);
  searchTimer = setTimeout(function(){
    currentQuery = e.target.value;
    searchClear.hidden = !currentQuery;
    applyFilter();
  }, 120);
});
searchInput.addEventListener('focus', markSearchInteracted);
searchInput.addEventListener('keydown', markSearchInteracted);
searchClear.addEventListener('click', function(){
  searchInput.value = '';
  currentQuery = '';
  searchClear.hidden = true;
  applyFilter();
  searchInput.focus();
});

/* 重置 */
document.getElementById('reset').addEventListener('click', function(){
  searchInput.value = '';
  currentQuery = '';
  searchClear.hidden = true;
  document.querySelectorAll('.chip').forEach(function(c){ c.classList.remove('is-active'); c.setAttribute('aria-selected','false'); });
  var all = document.querySelector('.chip[data-filter="all"]');
  all.classList.add('is-active');
  all.setAttribute('aria-selected','true');
  currentFilter = 'all';
  applyFilter();
});

/* 第十四轮：空状态搜索建议 chips——高频搜索词点击即填入并筛选 */
var EMPTY_SUGGESTIONS = ['截图','JSON','cron','字体','剪贴板','二维码','Markdown','计时'];
var emptyChipsEl = document.getElementById('empty-chips');
if(emptyChipsEl){
  emptyChipsEl.innerHTML = EMPTY_SUGGESTIONS.map(function(s){
    return '<button class="empty__chip" type="button" data-q="'+escapeHTML(s)+'">'+s+'</button>';
  }).join('');
  emptyChipsEl.addEventListener('click', function(e){
    var btn = e.target.closest('.empty__chip');
    if(!btn) return;
    var q = btn.dataset.q;
    searchInput.value = q;
    currentQuery = q;
    searchClear.hidden = !q;
    markSearchInteracted();
    applyFilter();
    /* 滚动回工具栏让用户看到筛选结果 */
    var tb = document.querySelector('.toolbar');
    if(tb) tb.scrollIntoView({behavior:'smooth',block:'start'});
    searchInput.focus();
  });
}

/* ---------- 详情弹窗 ---------- */
var modal = document.getElementById('modal');
var modalBody = document.getElementById('modal-body');
/* 第十五轮：弹窗项目导航 —— 与 lightbox 体验一致，支持 ←/→ 切换项目 */
var modalCurrentIdx = -1;
var modalPrev = document.getElementById('modal-prev');
var modalNext = document.getElementById('modal-next');
var modalCounter = document.getElementById('modal-counter');

function openModal(id){
  var idx = PROJECTS.findIndex(function(x){return x.id===id;});
  if(idx < 0) return;
  openModalByIdx(idx);
}

function openModalByIdx(idx){
  if(idx < 0 || idx >= PROJECTS.length) return;
  modalCurrentIdx = idx;
  var p = PROJECTS[idx];
  var g = GRAD[p.cat];
  var tags = p.tags.map(function(t){
    var cls = p.stack==='web' ? 'tag tag--web' : 'tag';
    return '<span class="'+cls+'">'+t+'</span>';
  }).join('');
  var si = STACK_INFO[p.stack] || {icon:'⚡',label:p.stack};
  var features = p.features.map(function(f){ return '<li>'+f+'</li>'; }).join('');
  var dlBtn = p.dl
    ? '<a class="btn btn--primary" href="'+p.dl+'" target="_blank" rel="noopener">⬇️ 下载 '+p.ver+'</a>'
    : '';
  /* 媒体区改为渐变 + 大 emoji + 装饰光晕（原引用不存在的 webp 截图已移除） */
  modalBody.innerHTML = ''+
    '<div class="modal__media" style="background:'+g.emoji_bg+'">'+
      '<span class="modal__orb modal__orb--1" aria-hidden="true"></span>'+
      '<span class="modal__orb modal__orb--2" aria-hidden="true"></span>'+
      '<span class="modal__big-emoji" aria-hidden="true">'+p.icon+'</span>'+
      '<span class="modal__media-cat">'+CAT_NAME[p.cat]+'</span>'+
      '<div class="modal__media-badges">'+
        '<span class="modal__badge modal__badge--ver">'+p.ver+'</span>'+
        '<span class="modal__badge modal__badge--stack">'+si.icon+' '+si.label+'</span>'+
        (p.score > 0 ? '<span class="modal__badge modal__badge--score">★ '+p.score+'</span>' : '')+
      '</div>'+
    '</div>'+
    '<div class="modal__body">'+
      '<div class="modal__cat">'+CAT_NAME[p.cat]+'</div>'+
      '<h2 class="modal__title" id="modal-title">'+p.name+'</h2>'+
      '<p class="modal__desc">'+p.desc+'</p>'+
      '<div class="modal__tags">'+tags+'</div>'+
      '<div class="modal__actions">'+
        dlBtn+
        '<a class="btn btn--ghost" href="'+p.gh+'" target="_blank" rel="noopener">📜 查看源码</a>'+
        '<a class="btn btn--ghost" href="'+AF+'" target="_blank" rel="noopener">☕ 支持</a>'+
      '</div>'+
      (features ? '<div class="modal__features"><h4>核心功能</h4><ul>'+features+'</ul></div>' : '')+
    '</div>';
  modal.classList.add('is-open');
  modal.setAttribute('aria-hidden','false');
  document.body.style.overflow = 'hidden';
  /* 第十五轮：更新弹窗导航按钮与计数器状态 */
  if(modalPrev) modalPrev.disabled = (modalCurrentIdx === 0);
  if(modalNext) modalNext.disabled = (modalCurrentIdx === PROJECTS.length - 1);
  if(modalCounter) modalCounter.textContent = (modalCurrentIdx+1)+' / '+PROJECTS.length;
  modal.querySelector('.modal__close').focus();
}

/* 第十五轮：弹窗项目导航 —— 上一个/下一个 */
function modalStep(delta){
  if(modalCurrentIdx < 0) return;
  var next = modalCurrentIdx + delta;
  if(next < 0 || next >= PROJECTS.length) return;
  openModalByIdx(next);
  /* 切换时面板轻微横向位移反馈 */
  var panel = modal.querySelector('.modal__panel');
  if(panel){
    panel.classList.remove('is-nav-left','is-nav-right');
    void panel.offsetWidth;
    panel.classList.add(delta > 0 ? 'is-nav-right' : 'is-nav-left');
  }
}
if(modalPrev) modalPrev.addEventListener('click', function(e){ e.stopPropagation(); modalStep(-1); });
if(modalNext) modalNext.addEventListener('click', function(e){ e.stopPropagation(); modalStep(1); });
function closeModal(){
  modal.classList.remove('is-open');
  modal.setAttribute('aria-hidden','true');
  document.body.style.overflow = '';
}

/* 卡片点击 -> 弹窗（点击下载/源码按钮不触发） */
grid.addEventListener('click', function(e){
  if(e.target.closest('.card__actions a')) return;
  var card = e.target.closest('.card');
  if(card){ openModal(card.dataset.id); }
});
grid.addEventListener('keydown', function(e){
  if(e.key === 'Enter' || e.key === ' '){
    var card = e.target.closest('.card');
    if(card){ e.preventDefault(); openModal(card.dataset.id); }
  }
});

/* 关闭弹窗 */
modal.addEventListener('click', function(e){
  if(e.target.dataset.close !== undefined) closeModal();
});
document.addEventListener('keydown', function(e){
  if(e.key === 'Escape' && modal.classList.contains('is-open')) closeModal();
  /* 第十五轮：弹窗打开时支持 ←/→ 切换项目（与 lightbox 一致） */
  if(modal.classList.contains('is-open')){
    if(e.key === 'ArrowLeft'){ e.preventDefault(); modalStep(-1); }
    else if(e.key === 'ArrowRight'){ e.preventDefault(); modalStep(1); }
  }
});

/* ---------- 导航滚动效果 + 进度条 + 返回顶部（带圆形进度环） ---------- */
var nav = document.getElementById('nav');
var progress = document.getElementById('progress');
var toTop = document.getElementById('to-top');
var toTopRing = document.getElementById('to-top-ring');
var toolbar = document.querySelector('.toolbar');
/* 圆形进度环周长 2πr，r=18 → 周长约 113.1 */
var RING_LEN = 2 * Math.PI * 18;

function onScroll(){
  var y = window.scrollY;
  nav.classList.toggle('is-scrolled', y > 20);
  toTop.hidden = y < 600;
  if(toolbar) toolbar.classList.toggle('is-stuck', y > 520);
  var h = document.documentElement.scrollHeight - window.innerHeight;
  var pct = h > 0 ? (y/h) : 0;
  progress.style.width = (pct*100) + '%';
  /* 圆形进度环：随滚动填充 */
  if(toTopRing){
    toTopRing.style.strokeDashoffset = (RING_LEN * (1 - pct)).toFixed(2);
  }
  /* Hero 滚动暗示：滚动 80px 后淡出 */
  var heroHint = document.getElementById('hero-hint');
  if(heroHint) heroHint.classList.toggle('is-hidden', y > 80);
}
window.addEventListener('scroll', onScroll, {passive:true});
onScroll();

toTop.addEventListener('click', function(){ window.scrollTo({top:0,behavior:'smooth'}); });

/* ---------- 滚动出现动画（段落） ---------- */
var revealIO;
if('IntersectionObserver' in window){
  revealIO = new IntersectionObserver(function(entries){
    entries.forEach(function(e){
      if(e.isIntersecting){ e.target.classList.add('is-visible'); revealIO.unobserve(e.target); }
    });
  },{threshold:0.1,rootMargin:'0px 0px -60px 0px'});
  document.querySelectorAll('.tl__item, .support__text, .support__thanks, .footer__inner').forEach(function(el){
    el.classList.add('reveal');
    revealIO.observe(el);
  });
}

/* ---------- Hero 精选图标预览条（已全局隐藏，移除 JS 渲染降低首屏 DOM 噪声） ---------- */

/* ---------- Hero 统计数字 ---------- */
/* 直接设置最终值，避免 count-up 动画在 headless 截图时捕获中间值 */
var statCount = document.getElementById('stat-count');
var heroCount = document.getElementById('hero-count');
if(statCount) statCount.textContent = PROJECTS.length;
if(heroCount) heroCount.textContent = PROJECTS.length;

/* ---------- 截图 Lightbox ---------- */
var lightbox = document.getElementById('lightbox');
var lightboxImg = document.getElementById('lightbox-img');

/* 生成项目品牌展示 SVG（数据 URI），替代不存在的 webp 截图，苹果白风格 */
function escapeXML(s){ return String(s).replace(/[<>&"']/g,function(c){return {'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;'}[c];}); }
function buildShowcaseSVG(p){
  var cc = CAT_COLOR[p.cat];
  var catName = CAT_NAME[p.cat];
  var si = STACK_INFO[p.stack] || {label:p.stack};
  /* 分类色柔和背景渐变 */
  var bg = {
    dev:['#f5f8ff','#e8f0ff'],
    system:['#f5fbf7','#e8f6ee'],
    efficiency:['#fffaf3','#fff0e0'],
    design:['#faf8ff','#f2ecff']
  }[p.cat] || ['#f5f8ff','#e8f0ff'];
  var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="750" viewBox="0 0 1200 750">'+
    '<defs>'+
      '<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">'+
        '<stop offset="0" stop-color="'+bg[0]+'"/>'+
        '<stop offset="1" stop-color="'+bg[1]+'"/>'+
      '</linearGradient>'+
      '<radialGradient id="glow" cx="50%" cy="42%" r="42%">'+
        '<stop offset="0" stop-color="'+cc+'" stop-opacity="0.16"/>'+
        '<stop offset="1" stop-color="'+cc+'" stop-opacity="0"/>'+
      '</radialGradient>'+
      '<filter id="sh" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="12" stdDeviation="24" flood-color="#000" flood-opacity="0.10"/></filter>'+
    '</defs>'+
    '<rect width="1200" height="750" fill="url(#bg)"/>'+
    '<rect width="1200" height="750" fill="url(#glow)"/>'+
    /* 顶部彩条 */
    '<rect x="0" y="0" width="1200" height="6" fill="'+cc+'"/>'+
    /* 顶部小标 */
    '<text x="600" y="92" text-anchor="middle" font-family="-apple-system,PingFang SC,Segoe UI,sans-serif" font-size="20" font-weight="700" letter-spacing="6" fill="'+cc+'">'+escapeXML(catName.toUpperCase())+'</text>'+
    /* emoji 玻璃容器 */
    '<rect x="540" y="150" width="120" height="120" rx="34" fill="#ffffff" fill-opacity="0.78" filter="url(#sh)"/>'+
    '<text x="600" y="240" text-anchor="middle" font-size="66">'+escapeXML(p.icon)+'</text>'+
    /* 项目名 */
    '<text x="600" y="360" text-anchor="middle" font-family="-apple-system,PingFang SC,Segoe UI,sans-serif" font-size="58" font-weight="700" letter-spacing="-1.5" fill="#1d1d1f">'+escapeXML(p.name)+'</text>'+
    /* 描述（自动截断两行） */
    '<text x="600" y="418" text-anchor="middle" font-family="-apple-system,PingFang SC,Segoe UI,sans-serif" font-size="24" fill="#6e6e73">'+escapeXML((p.desc||'').slice(0,46))+'</text>'+
    /* 徽章组 */
    '<g font-family="-apple-system,PingFang SC,Segoe UI,sans-serif" font-size="22" font-weight="700">'+
      '<rect x="430" y="470" width="120" height="44" rx="22" fill="#ffffff" stroke="#e8e8ed"/><text x="490" y="499" text-anchor="middle" fill="#1d1d1f">'+escapeXML(p.ver)+'</text>'+
      '<rect x="562" y="470" width="146" height="44" rx="22" fill="#ffffff" stroke="#e8e8ed"/><text x="635" y="499" text-anchor="middle" fill="#6e6e73">'+escapeXML(si.label)+'</text>'+
      '<rect x="720" y="470" width="50" height="44" rx="22" fill="'+cc+'"/><text x="745" y="499" text-anchor="middle" fill="#ffffff" font-size="20">'+escapeXML(p.icon)+'</text>'+
    '</g>'+
    /* 底部品牌 */
    '<text x="600" y="690" text-anchor="middle" font-family="-apple-system,PingFang SC,Segoe UI,sans-serif" font-size="18" fill="#86868b">youqu · 实用工具集合</text>'+
  '</svg>';
  return 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);
}

/* 当前 lightbox 展示的项目索引（基于 PROJECTS 数组），-1 表示未打开 */
var lbCurrentIdx = -1;
var lbCaption = document.getElementById('lb-caption');
var lbCounter = document.getElementById('lb-counter');
var lbPrev = document.getElementById('lb-prev');
var lbNext = document.getElementById('lb-next');

function openLightboxByIdx(idx){
  if(idx < 0 || idx >= PROJECTS.length) return;
  lbCurrentIdx = idx;
  var p = PROJECTS[idx];
  lightboxImg.src = buildShowcaseSVG(p);
  lightbox.classList.add('is-open');
  lightbox.setAttribute('aria-hidden','false');
  document.body.style.overflow = 'hidden';
  /* 更新 caption：项目名 + 分类色点 */
  if(lbCaption){
    var cc = CAT_COLOR[p.cat];
    lbCaption.innerHTML = '<span class="lb-caption__dot" style="background:'+cc+'"></span>'+
      '<span class="lb-caption__name">'+p.name+'</span>'+
      '<span class="lb-caption__cat">'+CAT_NAME[p.cat]+'</span>';
  }
  /* 更新计数器：3 / 66 */
  if(lbCounter){
    lbCounter.textContent = (idx+1)+' / '+PROJECTS.length;
  }
  /* 边界态：首项禁用 prev，末项禁用 next */
  if(lbPrev) lbPrev.disabled = (idx === 0);
  if(lbNext) lbNext.disabled = (idx === PROJECTS.length - 1);
  lightbox.querySelector('.lightbox__close').focus();
}
function closeLightbox(){
  lightbox.classList.remove('is-open');
  lightbox.setAttribute('aria-hidden','true');
  document.body.style.overflow = '';
  lightboxImg.src = '';
  lbCurrentIdx = -1;
}
function lbStep(delta){
  if(lbCurrentIdx < 0) return;
  var next = lbCurrentIdx + delta;
  if(next < 0 || next >= PROJECTS.length) return;
  openLightboxByIdx(next);
}

/* lightbox 触发：点击放大按钮，定位项目索引后打开（支持后续导航） */
grid.addEventListener('click', function(e){
  var lbBtn = e.target.closest('.card__lightbox-btn');
  if(lbBtn){
    e.stopPropagation();
    var idx = PROJECTS.findIndex(function(x){ return x.id === lbBtn.dataset.lbid; });
    if(idx >= 0) openLightboxByIdx(idx);
    return;
  }
});

/* lightbox 上一张/下一张按钮 */
if(lbPrev) lbPrev.addEventListener('click', function(e){ e.stopPropagation(); lbStep(-1); });
if(lbNext) lbNext.addEventListener('click', function(e){ e.stopPropagation(); lbStep(1); });

/* 关闭 lightbox */
lightbox.addEventListener('click', function(e){
  if(e.target.dataset.lbClose !== undefined) closeLightbox();
});
document.addEventListener('keydown', function(e){
  if(e.key === 'Escape' && lightbox.classList.contains('is-open')) closeLightbox();
  /* lightbox 打开时支持 ←/→ 切换项目 */
  if(lightbox.classList.contains('is-open')){
    if(e.key === 'ArrowLeft'){ e.preventDefault(); lbStep(-1); }
    else if(e.key === 'ArrowRight'){ e.preventDefault(); lbStep(1); }
  }
});

/* ---------- 加载 mimo 评分 ---------- */
function loadScores(){
  fetch('scores.json', {cache:'no-cache'})
    .then(function(r){ return r.ok ? r.json() : null; })
    .then(function(data){
      if(!data || !Array.isArray(data)) return;
      var map = {};
      data.forEach(function(d){ map[d.id] = d; });
      var updated = false;
      PROJECTS.forEach(function(p){
        if(map[p.id] && map[p.id].score > 0){
          p.score = map[p.id].score;
          updated = true;
        }
      });
      if(updated){
        /* 只更新评分角标，避免整个卡片重渲染 */
        document.querySelectorAll('.card').forEach(function(card){
          var p = PROJECTS.filter(function(x){ return x.id === card.dataset.id; })[0];
          if(!p) return;
          var existing = card.querySelector('.card__score');
          if(p.score > 0){
            var html = '<span class="card__score" title="mimo 审美评分">'+p.score+'</span>';
            if(existing){ existing.outerHTML = html; }
            else { card.querySelector('.card__media').insertAdjacentHTML('afterbegin', html); }
          }
        });
      }
    })
    .catch(function(){ /* silently fail - scores are optional */ });
}

/* ---------- 键盘快捷键：/ 聚焦搜索、Esc 清空 ---------- */
document.addEventListener('keydown', function(e){
  if(e.key === '/' && document.activeElement !== searchInput && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)){
    e.preventDefault();
    searchInput.focus();
    var toolbar = document.querySelector('.toolbar');
    if(toolbar){ toolbar.scrollIntoView({behavior:'smooth',block:'start'}); }
  }
  if(e.key === 'Escape' && document.activeElement === searchInput && searchInput.value){
    searchInput.value = '';
    currentQuery = '';
    searchClear.hidden = true;
    applyFilter();
    searchInput.blur();
  }
});

/* 第十五轮：键盘快捷键帮助浮层 —— 按 ? 唤起，列出全部快捷键，提升发现性 */
var kbdHelp = document.getElementById('kbd-help');
var kbdHelpBackdrop = document.getElementById('kbd-help-backdrop');
function openKbdHelp(){
  if(!kbdHelp) return;
  kbdHelp.classList.add('is-open');
  kbdHelp.setAttribute('aria-hidden','false');
  document.body.style.overflow = 'hidden';
  var closeBtn = kbdHelp.querySelector('.kbd-help__close');
  if(closeBtn) closeBtn.focus();
}
function closeKbdHelp(){
  if(!kbdHelp) return;
  kbdHelp.classList.remove('is-open');
  kbdHelp.setAttribute('aria-hidden','true');
  document.body.style.overflow = '';
}
if(kbdHelp){
  kbdHelp.addEventListener('click', function(e){
    if(e.target.classList.contains('kbd-help__close') || e.target === kbdHelp) closeKbdHelp();
  });
}
/* 第十五轮：左下角帮助入口按钮点击打开面板 */
var kbdTrigger = document.getElementById('kbd-trigger');
if(kbdTrigger){
  kbdTrigger.addEventListener('click', function(){ openKbdHelp(); });
}
document.addEventListener('keydown', function(e){
  /* 输入框中按 ? 不触发（避免与搜索冲突） */
  if(e.key === '?' && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)){
    e.preventDefault();
    if(kbdHelp && kbdHelp.classList.contains('is-open')) closeKbdHelp(); else openKbdHelp();
  }
  if(e.key === 'Escape' && kbdHelp && kbdHelp.classList.contains('is-open')) closeKbdHelp();
});

/* ---------- 分类筛选 chips 数量显示 ---------- */
function updateChipCounts(){
  var counts = {all:PROJECTS.length, dev:0, system:0, efficiency:0, design:0};
  PROJECTS.forEach(function(p){ if(counts[p.cat] !== undefined) counts[p.cat]++; });
  document.querySelectorAll('.chip').forEach(function(chip){
    var f = chip.dataset.filter;
    if(counts[f] !== undefined){
      var label = chip.textContent.replace(/\s*\d+$/,'').trim();
      chip.setAttribute('data-count', counts[f]);
    }
  });
}

/* ---------- 初始化 ---------- */
render(PROJECTS);
updateChipCounts();
loadScores();
/* 第十四轮：搜索 kbd 提示初始呼吸脉冲（用户首次交互前引导快捷键发现） */
if(searchHint && !searchInteracted){
  searchHint.classList.add('is-pulsing');
}

/* ---------- 更新日志折叠：默认仅展示最新 4 条，点击展开/收起 ---------- */
(function(){
  var timeline = document.getElementById('timeline');
  var toggle = document.getElementById('tl-toggle');
  var toggleLabel = toggle ? toggle.querySelector('.tl__toggle-label') : null;
  var toggleCount = document.getElementById('tl-toggle-count');
  if(!timeline || !toggle) return;
  var items = timeline.querySelectorAll('.tl__item');
  var total = items.length;
  var COLLAPSED_COUNT = 4;
  /* 仅当条目超过折叠阈值时启用折叠交互，否则隐藏按钮 */
  if(total <= COLLAPSED_COUNT){
    toggle.parentElement.style.display = 'none';
    timeline.classList.remove('is-collapsed');
    return;
  }
  var hiddenCount = total - COLLAPSED_COUNT;
  if(toggleCount) toggleCount.textContent = '（还有 ' + hiddenCount + ' 条）';
  toggle.addEventListener('click', function(){
    var collapsed = timeline.classList.toggle('is-collapsed');
    toggle.setAttribute('aria-expanded', String(!collapsed));
    if(toggleLabel) toggleLabel.textContent = collapsed ? '展开全部更新' : '收起更新日志';
    if(toggleCount) toggleCount.textContent = collapsed ? '（还有 ' + hiddenCount + ' 条）' : '';
    /* 展开后让新增条目参与滚动出现动画 */
    if(!collapsed){
      items.forEach(function(it, i){
        if(i >= COLLAPSED_COUNT){ it.classList.add('is-visible'); }
      });
    }
  });
})();

/* ---------- 页脚年份动态填充，避免硬编码过期 ---------- */
(function(){
  var y = document.getElementById('footer-year');
  if(y) y.textContent = String(new Date().getFullYear());
})();

/* ============ 第十七轮：滚动监听 / 智能提示 / Hero 视差 / 卡片 CTA 微动画 ============ */

/* ---------- 滚动监听高亮当前 nav 区段（scroll-spy） ---------- */
/* 用户滚动到不同区段时，对应 nav 链接高亮，并加 aria-current="location" 提升无障碍 */
(function(){
  var SECTIONS = ['projects', 'changelog', 'support'];
  var sectionEls = SECTIONS.map(function(id){ return document.getElementById(id); });
  var linkEls = SECTIONS.map(function(id){ return document.querySelector('.nav__link[href="#'+id+'"]'); });
  /* 任一元素缺失则跳过 */
  if(sectionEls.indexOf(null) !== -1 || linkEls.indexOf(null) !== -1) return;
  if(!('IntersectionObserver' in window)) return;
  function clearCurrent(){
    linkEls.forEach(function(l){ l.classList.remove('is-current'); l.removeAttribute('aria-current'); });
  }
  var spy = new IntersectionObserver(function(entries){
    entries.forEach(function(e){
      if(!e.isIntersecting) return;
      var idx = sectionEls.indexOf(e.target);
      if(idx < 0) return;
      clearCurrent();
      linkEls[idx].classList.add('is-current');
      linkEls[idx].setAttribute('aria-current', 'location');
    });
  }, {rootMargin: '-45% 0px -50% 0px', threshold: 0});
  sectionEls.forEach(function(el){ if(el) spy.observe(el); });
})();

/* ---------- 搜索框 placeholder 轮播智能提示 ---------- */
/* 未聚焦且为空时，placeholder 在多个高频搜索词间轮播，引导发现；
   聚焦或输入后停止；失焦且仍为空时恢复轮播；尊重 prefers-reduced-motion */
(function(){
  if(prefersReducedMotion) return;
  var PLACEHOLDERS = [
    '搜索工具名称、功能、关键词…',
    '试试搜索：截图、JSON、cron…',
    '搜索「密码」找密码工具…',
    '搜索「翻译」找翻译工具…',
    '搜索「Markdown」找笔记工具…',
    '搜索「字体」找字体工具…'
  ];
  var idx = 0;
  var timer = null;
  function rotate(){
    idx = (idx + 1) % PLACEHOLDERS.length;
    /* 用 opacity 渐变切换，避免硬切 */
    searchInput.style.transition = 'opacity .3s';
    searchInput.style.opacity = '0.4';
    setTimeout(function(){
      searchInput.placeholder = PLACEHOLDERS[idx];
      searchInput.style.opacity = '1';
    }, 200);
  }
  function start(){
    if(timer) return;
    timer = setInterval(rotate, 3400);
  }
  function stop(){
    if(timer){ clearInterval(timer); timer = null; }
    searchInput.style.opacity = '';
    searchInput.placeholder = PLACEHOLDERS[0];
  }
  start();
  searchInput.addEventListener('focus', stop);
  searchInput.addEventListener('blur', function(){
    if(!searchInput.value) start();
  });
})();

/* ---------- Hero orbs 鼠标视差微交互 ---------- */
/* 鼠标在 Hero 区移动时，orbs 整体柔和偏移，增强首屏空间感；
   离开时平滑回归原位；尊重 prefers-reduced-motion */
(function(){
  if(prefersReducedMotion) return;
  var heroEl = document.querySelector('.hero');
  var heroOrbs = document.getElementById('hero-orbs');
  if(!heroEl || !heroOrbs) return;
  /* 仅桌面端（pointer:fine）启用，触屏设备无鼠标视差意义 */
  if(!window.matchMedia('(pointer:fine)').matches) return;
  heroEl.addEventListener('mousemove', function(e){
    var r = heroEl.getBoundingClientRect();
    var x = (e.clientX - r.left) / r.width - 0.5;
    var y = (e.clientY - r.top) / r.height - 0.5;
    /* 偏移幅度小（24px / 18px），保持柔和 */
    heroOrbs.style.transform = 'translate(' + (x * 24).toFixed(2) + 'px, ' + (y * 18).toFixed(2) + 'px)';
  });
  heroEl.addEventListener('mouseleave', function(){
    heroOrbs.style.transform = '';
  });
})();

/* ---------- chips 点击微反馈：短暂 scale 弹跳 ---------- */
/* 用户点击 chip 时，chip 短暂放大再回弹，增强点击反馈（替代静默切换） */
(function(){
  if(prefersReducedMotion) return;
  var chipsWrap = document.getElementById('chips');
  if(!chipsWrap) return;
  chipsWrap.addEventListener('click', function(e){
    var chip = e.target.closest('.chip');
    if(!chip) return;
    chip.classList.remove('is-bounce');
    void chip.offsetWidth; /* 强制 reflow 以重启动画 */
    chip.classList.add('is-bounce');
    setTimeout(function(){ chip.classList.remove('is-bounce'); }, 400);
  });
})();

/* ---------- 工具栏滚动暗示：滚动 >400px 后淡出 ---------- */
/* 第十九轮：动态绑定 PROJECTS.length 到滚动暗示文本，未来新增项目无需手改 HTML */
(function(){
  var hint = document.getElementById('scroll-hint');
  if(!hint) return;
  var hintText = hint.querySelector('.toolbar__scroll-hint-text');
  if(hintText) hintText.textContent = '向下滚动浏览全部 ' + PROJECTS.length + ' 个工具';
  function onHintScroll(){
    var y = window.scrollY;
    hint.classList.toggle('is-hidden', y > 400);
  }
  window.addEventListener('scroll', onHintScroll, {passive:true});
  onHintScroll();
})();

/* ============ 第十九轮：卡片 hover 鼠标跟随 3D 倾斜 ============ */
/* 仅桌面端 pointer:fine 启用；尊重 prefers-reduced-motion 直接跳过 */
/* 鼠标在卡片内移动时，计算相对中心的偏移驱动 rotateX/rotateY（±3°） */
/* 鼠标离开时 0.5s 缓动复位（移除 is-tilting 类，CSS transition 接管） */
(function(){
  if(!window.matchMedia) return;
  if(!window.matchMedia('(hover:hover) and (pointer:fine)').matches) return;
  if(window.matchMedia('(prefers-reduced-motion:reduce)').matches) return;
  var MAX_TILT = 3; /* 最大倾斜角度 */
  var cards = document.querySelectorAll('.card');
  if(!cards.length) return;
  /* 委托到 grid，避免每张卡片单独绑定 */
  var grid = document.getElementById('grid');
  if(!grid) return;
  var activeCard = null;
  grid.addEventListener('mousemove', function(e){
    var card = e.target.closest('.card');
    if(!card) return;
    if(card !== activeCard){
      if(activeCard) activeCard.classList.remove('is-tilting');
      activeCard = card;
      activeCard.classList.add('is-tilting');
    }
    var rect = card.getBoundingClientRect();
    var cx = rect.left + rect.width / 2;
    var cy = rect.top + rect.height / 2;
    var dx = (e.clientX - cx) / (rect.width / 2);  /* -1 ~ 1 */
    var dy = (e.clientY - cy) / (rect.height / 2); /* -1 ~ 1 */
    /* 鼠标在右侧 → 卡片绕 Y 轴向右倾（右侧远离视线）
       鼠标在下方 → 卡片绕 X 轴向上倾（顶部远离视线）
       这样产生"卡片面向鼠标"的立体感 */
    var ry = (dx * MAX_TILT).toFixed(2);
    var rx = (-dy * MAX_TILT).toFixed(2);
    card.style.setProperty('--rx', rx + 'deg');
    card.style.setProperty('--ry', ry + 'deg');
  });
  grid.addEventListener('mouseleave', function(){
    if(activeCard){
      activeCard.classList.remove('is-tilting');
      activeCard.style.removeProperty('--rx');
      activeCard.style.removeProperty('--ry');
      activeCard = null;
    }
  });
  /* 卡片被点击/聚焦时也移除倾斜，避免交互冲突 */
  document.addEventListener('focusin', function(e){
    if(activeCard && e.target.closest('.card') !== activeCard){
      activeCard.classList.remove('is-tilting');
      activeCard = null;
    }
  });
})();

/* ============================================================ */
/* 第二十九轮 · 五项实质性细节优化（JS 部分）                     */
/* 3. Lightbox 与 Modal 触屏滑动切换                             */
/* 4. Hero 滚动视差（--hero-scroll 变量驱动）                   */
/* 5. 卡片墙结尾徽章（IntersectionObserver 触发显示）            */
/* ============================================================ */

/* ---------- 3. Lightbox 与 Modal 触屏滑动切换 ---------- */
/* 移动端用户在大图和详情弹窗中可通过左右滑动切换项目 */
/* 仅 touch 设备启用，水平滑动 >50px 触发 step */
(function(){
  var SWIPE_THRESHOLD = 50;
  var SWIPE_MAX_VERTICAL = 80; /* 垂直位移过大则视为滚动，不触发 */

  function bindSwipe(el, stepFn){
    if(!el || !stepFn) return;
    var startX = 0, startY = 0, startT = 0, tracking = false;
    el.addEventListener('touchstart', function(e){
      if(e.touches.length !== 1) return;
      tracking = true;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      startT = Date.now();
    }, {passive:true});
    el.addEventListener('touchend', function(e){
      if(!tracking) return;
      tracking = false;
      var t = e.changedTouches[0];
      if(!t) return;
      var dx = t.clientX - startX;
      var dy = t.clientY - startY;
      var dt = Date.now() - startT;
      /* 垂直位移过大视为滚动；时间过长视为长按拖拽；水平位移不足则忽略 */
      if(Math.abs(dy) > SWIPE_MAX_VERTICAL) return;
      if(dt > 800) return;
      if(Math.abs(dx) < SWIPE_THRESHOLD) return;
      /* 仅在弹窗打开时响应 */
      if(!el.classList.contains('is-open')) return;
      if(dx > 0){ stepFn(-1); } /* 右滑 → 上一个 */
      else { stepFn(1); }       /* 左滑 → 下一个 */
    }, {passive:true});
  }
  bindSwipe(lightbox, lbStep);
  bindSwipe(modal, modalStep);
})();

/* ---------- 4. Hero 滚动视差 ---------- */
/* 滚动时设置 --hero-scroll 变量（0~1），驱动 orbs 反向位移与内容渐隐 */
/* 0 = Hero 完全可见，1 = Hero 已完全滚出视口顶部 */
(function(){
  if(prefersReducedMotion) return;
  var heroEl = document.querySelector('.hero');
  if(!heroEl) return;
  var ticking = false;
  function update(){
    ticking = false;
    var rect = heroEl.getBoundingClientRect();
    var h = heroEl.offsetHeight;
    if(h <= 0) return;
    /* 当 Hero 顶部在视口内（rect.top > 0）→ scroll=0 */
    /* 当 Hero 底部到达视口顶部（rect.bottom <= 0）→ scroll=1 */
    /* 中间线性插值 */
    var visible = rect.bottom; /* Hero 底部相对视口顶部的位置 */
    if(visible >= h){
      /* Hero 完全在视口内（顶部还没滚出） */
      heroEl.style.setProperty('--hero-scroll', 0);
    } else if(visible <= 0){
      /* Hero 完全滚出视口 */
      heroEl.style.setProperty('--hero-scroll', 1);
    } else {
      /* 部分滚出：按 (h - visible) / h 计算 0~1 */
      var s = (h - visible) / h;
      if(s > 1) s = 1;
      if(s < 0) s = 0;
      heroEl.style.setProperty('--hero-scroll', s.toFixed(3));
    }
  }
  function onScroll(){
    if(!ticking){
      ticking = true;
      requestAnimationFrame(update);
    }
  }
  window.addEventListener('scroll', onScroll, {passive:true});
  window.addEventListener('resize', onScroll, {passive:true});
  /* 首次设置 */
  update();
})();

/* ---------- 5. 卡片墙结尾徽章 ---------- */
/* 滚动到底部时显示"已展示全部 N 个工具"完成徽章 */
/* 同时根据当前筛选结果更新计数 */
(function(){
  var gridEnd = document.getElementById('grid-end');
  var gridEndCount = document.getElementById('grid-end-count');
  if(!gridEnd) return;
  /* 初始化计数为项目总数 */
  if(gridEndCount) gridEndCount.textContent = PROJECTS.length;

  /* IntersectionObserver：徽章进入视口时淡入显示 */
  if('IntersectionObserver' in window){
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(e){
        if(e.isIntersecting){
          e.target.classList.add('is-visible');
        } else {
          /* 离开视口时移除，让用户再次滚到底部时再次看到淡入 */
          e.target.classList.remove('is-visible');
        }
      });
    }, {threshold:0.1, rootMargin:'0px 0px -40px 0px'});
    io.observe(gridEnd);
  } else {
    gridEnd.classList.add('is-visible');
  }

  /* 筛选时同步更新计数（监听 countEl 文本变化作为信号） */
  if(gridEndCount && countEl){
    var prevCount = PROJECTS.length;
    var syncCount = function(){
      var txt = countEl.textContent;
      var m = txt.match(/\d+/);
      if(m){
        var n = parseInt(m[0], 10);
        if(n !== prevCount){
          prevCount = n;
          gridEndCount.textContent = n;
        }
      }
    };
    /* 用 MutationObserver 监听 countEl 文本变化 */
    if('MutationObserver' in window){
      var mo = new MutationObserver(syncCount);
      mo.observe(countEl, {childList:true, characterData:true, subtree:true});
    }
    /* 初次同步 */
    syncCount();
  }
})();
