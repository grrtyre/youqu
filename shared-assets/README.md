# youqu/shared-assets · 共享视觉资源库

> 全仓库统一的视觉资源中心。所有项目应优先引用此处的通用资源，保证 youqu 整体视觉一致性。

## 🎨 设计规范（苹果白高端风格）

所有资源必须遵循以下规范，不得自行其是：

### 配色
- 主色：`#007AFF`（苹果系统蓝）
- 文字主色：`#1D1D1F`
- 文字次色：`#6E6E73`
- 背景：`#FFFFFF`（纯白）/ `#F5F5F7`（浅灰）
- 分隔线：`#E5E5EA`
- 成功 `#34C759` / 警告 `#FF9500` / 危险 `#FF3B30`

### 图标规范
- **源尺寸**：`1024 × 1024`（统一，禁止 1832/512/256 等混用）
- **线条粗细**：主线 `2px`（@1024 尺度下为 `16px`），次线 `1px`
- **圆角**：外框 `22%` 圆角（iOS 应用图标规范）
- **视觉重心**：图形居中，四周留白 `≥ 15%`
- **光学矫正**：圆形图形向上偏移 `2%`，避免视觉下沉
- **背景**：纯白 `#FFFFFF`，禁止渐变/玻璃/阴影
- **风格**：扁平、极简线条、单色（主色蓝），禁止拟物/霓虹/赛博朋克

### 文件命名
- 项目图标源：`icon-source.png`（1024×1024）
- 多尺寸：`icon-16.png` / `icon-32.png` / `icon-64.png` / `icon-128.png` / `icon-256.png` / `icon-512.png`
- ICO：`icon.ico`（含 16/32/48/64/128/256）
- 通用图标：`<功能>.png`（如 `settings.png`、`search.png`）

## 📁 目录结构

```
shared-assets/
├── icons/           # 通用功能图标集（设置/搜索/关闭/最小化等）
├── illustrations/   # 空状态/引导插画
├── patterns/        # 背景纹理（浅色渐变、网格）
├── templates/       # 图标源模板（PSD/PIL 脚本）
├── README.md        # 本文件
└── CHANGELOG.md     # 资源变更日志
```

## 📦 资源清单

### icons/（通用功能图标）
已生成（1024×1024 源 + 多尺寸 + ICO，统一 frame 外框，线宽归一 16px）：
- `settings`（设置：齿轮）
- `search`（搜索：放大镜）
- `close`（关闭：X）
- `minimize`（最小化：双横线）
- `add`（添加：加号）
- `maximize`（最大化：外方框 + 四角 L 标）
- `delete`（删除：垃圾桶）
- `edit`（编辑：铅笔 -60° + 下划线）

文件命名：`<name>-source.png`（1024 源）/ `<name>-16.png` ... `<name>-512.png` / `<name>.ico`

后续规划：save / share / refresh / filter

### illustrations/（空状态插画）
> 待生成。规划：empty-list / no-result / error / success / loading

### patterns/（背景纹理）
> 待生成。规划：apple-white-gradient / subtle-grid / dotted

## 🔧 使用方法

### 项目引用通用图标
直接在项目里引用相对路径：
```html
<img src="../../shared-assets/icons/search.png" alt="搜索">
```

### 项目自有图标
项目自有图标保留在 `<project>/build/icon-source.png`，但必须遵守本规范的尺寸与配色。可用 `shared-assets/templates/make_icon.py` 统一处理为多尺寸 + ICO。

## 📝 变更日志

### 2026-07-13 · 首次建立
- 建立 shared-assets/ 共享资源库基础结构
- 定义苹果白高端风格视觉规范（配色/图标/命名）
- 重新生成 5 个项目图标源（clipboard/accounting/countdown/habit/qr），统一为 1024×1024 + #007AFF 主色
