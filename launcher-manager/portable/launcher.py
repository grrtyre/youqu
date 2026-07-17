# -*- coding: utf-8 -*-
"""Launcher Manager 便携版 —— Spotlight 风格 Windows 快速应用启动器
原生 PySide6 实现，无 Electron 依赖。按 Alt+Space 唤起，模糊搜索应用，回车启动。

设计理念：像输入法一样的体验 —— 需要时出现，不需要时隐藏，融入系统。
"""

from __future__ import annotations
import os
import sys
import json
import time
import subprocess
from typing import List, Dict, Optional

from PySide6.QtCore import Qt, QEvent, QObject, QSize, QRect, QTimer, Signal
from PySide6.QtGui import (QIcon, QPixmap, QFont, QColor, QPainter, QPen,
                           QBrush, QLinearGradient, QAction, QPainterPath,
                           QFontDatabase)
from PySide6.QtWidgets import (QApplication, QWidget, QFrame, QLabel,
                               QLineEdit, QVBoxLayout, QHBoxLayout,
                               QScrollArea, QSystemTrayIcon, QMenu,
                               QGraphicsDropShadowEffect, QStyle,
                               QStyleOption, QSizePolicy, QFileIconProvider)
from PySide6.QtCore import QFileInfo

import fuzzy_search
import app_indexer
from global_hotkey import register_alt_space, unregister_alt_space, HotkeyEventFilter


# ===== 配置常量 =====
APP_NAME = 'Launcher Manager'
APP_VERSION = '1.0.0-portable'
HOTKEY_TEXT = 'Alt+Space'

# 苹果白配色（与原 CSS 完全一致）
COLOR_BG = '#ffffff'
COLOR_BG_SOFT = '#f5f5f7'
COLOR_BG_HOVER = '#f0f0f4'
COLOR_TEXT = '#1d1d1f'
COLOR_TEXT_SECONDARY = '#6e6e73'
COLOR_TEXT_TERTIARY = '#8e8e93'
COLOR_TEXT_QUATERNARY = '#a1a1a6'
COLOR_ACCENT = '#007aff'
COLOR_ACCENT_MUTE = '#4a90d9'
COLOR_ACCENT_SOFT = '#e8f0fe'
COLOR_BORDER = 'rgba(0,0,0,0.06)'
COLOR_BORDER_STRONG = 'rgba(0,0,0,0.09)'

# 窗口尺寸（≤400×500 约束）
WIN_W = 400
WIN_H = 460
CARD_MARGIN = 16  # 卡片到窗口边的留白（给阴影渲染空间）

# 最近使用记录文件
RECENT_FILE = os.path.join(os.environ.get('APPDATA', os.path.expanduser('~')),
                           'LauncherManager', 'recent.json')

# 应用图标资源
def _resource_path(name: str) -> str:
    """兼容 PyInstaller 打包后的资源路径。"""
    base = getattr(sys, '_MEIPASS', os.path.dirname(os.path.abspath(__file__)))
    return os.path.join(base, 'assets', name)


# ===== 最近使用记录 =====
class RecentStore:
    """记录应用启动次数与最近时间，用于排序常用应用置顶。"""

    def __init__(self):
        self._data: Dict[str, dict] = {}  # name -> {count, last}
        self._load()

    def _load(self):
        try:
            with open(RECENT_FILE, 'r', encoding='utf-8') as f:
                self._data = json.load(f)
        except Exception:
            self._data = {}

    def _save(self):
        try:
            os.makedirs(os.path.dirname(RECENT_FILE), exist_ok=True)
            with open(RECENT_FILE, 'w', encoding='utf-8') as f:
                json.dump(self._data, f, ensure_ascii=False, indent=2)
        except Exception:
            pass

    def record(self, name: str):
        entry = self._data.get(name, {'count': 0, 'last': 0})
        entry['count'] += 1
        entry['last'] = time.time()
        self._data[name] = entry
        self._save()

    def weight(self, name: str) -> float:
        """返回排序权重：次数 * 10 + 时间衰减（越近权重越高）。"""
        e = self._data.get(name)
        if not e:
            return 0.0
        # 时间衰减：30 天内加分
        days = (time.time() - e.get('last', 0)) / 86400.0
        time_bonus = max(0, 30 - days) * 2
        return e.get('count', 0) * 10 + time_bonus


# ===== 图标缓存 =====
_icon_provider: Optional[QFileIconProvider] = None
_icon_cache: Dict[str, QPixmap] = {}


def get_app_icon(path: str, size: int = 32) -> QPixmap:
    """获取应用图标 QPixmap，带缓存。失败返回占位图。"""
    global _icon_provider
    if path in _icon_cache:
        return _icon_cache[path]
    if _icon_provider is None:
        _icon_provider = QFileIconProvider()
    pm = QPixmap()
    try:
        icon = _icon_provider.icon(QFileInfo(path))
        if not icon.isNull():
            pm = icon.pixmap(QSize(size, size))
    except Exception:
        pass
    if pm.isNull():
        pm = _placeholder_icon(size)
    _icon_cache[path] = pm
    return pm


def _placeholder_icon(size: int) -> QPixmap:
    """生成占位图标：浅灰底 + 首字母。"""
    pm = QPixmap(size, size)
    pm.fill(Qt.transparent)
    p = QPainter(pm)
    p.setRenderHint(QPainter.Antialiasing, True)
    p.setBrush(QColor(COLOR_BG_SOFT))
    p.setPen(Qt.NoPen)
    p.drawRoundedRect(0, 0, size, size, 6, 6)
    p.setPen(QColor(COLOR_TEXT_TERTIARY))
    f = QFont()
    f.setPointSize(size // 3)
    f.setBold(True)
    p.setFont(f)
    p.drawText(pm.rect(), Qt.AlignCenter, '?')
    p.end()
    return pm


# ===== 结果项 Widget =====
class ResultItem(QFrame):
    """单个搜索结果项。"""

    clicked = Signal(int)  # 发送索引

    def __init__(self, index: int, app: dict, positions: List[int],
                 parent=None):
        super().__init__(parent)
        self.index = index
        self.app = app
        self.positions = positions
        self._selected = False
        self.setObjectName('resultItem')
        self._build_ui()
        self.setMouseTracking(True)

    def _build_ui(self):
        layout = QHBoxLayout(self)
        layout.setContentsMargins(18, 11, 16, 11)
        layout.setSpacing(14)

        # 图标（垂直居中）
        icon_lbl = QLabel()
        icon_pm = get_app_icon(self.app['path'], 32)
        icon_lbl.setPixmap(icon_pm)
        icon_lbl.setFixedSize(32, 32)
        icon_lbl.setAlignment(Qt.AlignCenter)
        layout.addWidget(icon_lbl, 0, Qt.AlignVCenter)
        self.setMinimumHeight(58)
        self.setSizePolicy(QSizePolicy.Preferred, QSizePolicy.Fixed)

        # 文本区（垂直居中，两行紧凑）
        text_box = QVBoxLayout()
        text_box.setContentsMargins(0, 0, 0, 0)
        text_box.setSpacing(4)
        text_box.setAlignment(Qt.AlignVCenter)

        # 名称（带高亮）
        name_lbl = QLabel()
        name_lbl.setObjectName('itemName')
        name_lbl.setText(self._highlighted_name())
        layout_q = name_lbl.sizePolicy()
        name_lbl.setSizePolicy(QSizePolicy.Expanding, QSizePolicy.Preferred)
        text_box.addWidget(name_lbl)

        # 路径
        path_lbl = QLabel()
        path_lbl.setObjectName('itemPath')
        path_lbl.setText(self._short_path(self.app['path']))
        path_lbl.setSizePolicy(QSizePolicy.Expanding, QSizePolicy.Preferred)
        text_box.addWidget(path_lbl)

        layout.addLayout(text_box)

    def _highlighted_name(self) -> str:
        """生成带高亮标记的富文本名称。"""
        segs = fuzzy_search.highlight_segments(self.app['name'], self.positions)
        html = ''
        for seg, hit in segs:
            seg_esc = seg.replace('&', '&amp;').replace('<', '&lt;') \
                         .replace('>', '&gt;')
            if hit:
                html += f'<span style="color:{COLOR_ACCENT};font-weight:700;">{seg_esc}</span>'
            else:
                html += seg_esc
        return html

    @staticmethod
    def _short_path(p: str) -> str:
        """缩短路径显示，只保留关键的目录层级。"""
        try:
            # 显示倒数第二级目录 + 文件名
            parts = p.replace('\\', '/').rstrip('/').split('/')
            if len(parts) >= 3:
                return '.../' + '/'.join(parts[-3:])
            return p
        except Exception:
            return p

    def set_selected(self, sel: bool):
        self._selected = sel
        if sel:
            self.setProperty('selected', True)
        else:
            self.setProperty('selected', False)
        # 触发样式刷新
        self.style().unpolish(self)
        self.style().polish(self)
        self.update()

    def paintEvent(self, event):
        """绘制选中项左侧蓝色强调条（对应原 CSS .selected::before）。"""
        super().paintEvent(event)
        if not self._selected:
            return
        p = QPainter(self)
        p.setRenderHint(QPainter.Antialiasing, True)
        # 左侧 3px 宽蓝色条，圆角，垂直居中，高 24px
        bar_h = 22
        bar_w = 3
        x = 5
        y = (self.height() - bar_h) // 2
        path = QPainterPath()
        path.addRoundedRect(float(x), float(y), float(bar_w),
                            float(bar_h), 1.5, 1.5)
        p.fillPath(path, QColor(COLOR_ACCENT_MUTE))

    def mousePressEvent(self, e):
        if e.button() == Qt.LeftButton:
            self.clicked.emit(self.index)
        super().mousePressEvent(e)

    def enterEvent(self, e):
        self.setProperty('hover', True)
        self.style().unpolish(self)
        self.style().polish(self)
        super().enterEvent(e)

    def leaveEvent(self, e):
        self.setProperty('hover', False)
        self.style().unpolish(self)
        self.style().polish(self)
        super().leaveEvent(e)


# ===== 主窗口 =====
class LauncherWindow(QWidget):
    """启动器主窗口：无框透明 + 苹果白卡片 + 多层阴影。"""

    def __init__(self, apps: List[dict], recent: RecentStore):
        super().__init__()
        self.apps = apps
        self.recent = recent
        self.results: List[dict] = []
        self.selected = -1
        self._suppress_deactivate = False

        self._setup_window()
        self._build_ui()
        self._apply_qss()
        self._refresh_results('')

    # ----- 窗口设置 -----
    def _setup_window(self):
        self.setWindowFlags(
            Qt.FramelessWindowHint
            | Qt.WindowStaysOnTopHint
            | Qt.Tool
        )
        self.setAttribute(Qt.WA_TranslucentBackground, True)
        self.setAttribute(Qt.WA_ShowWithoutActivating, False)
        self.setFixedSize(WIN_W, WIN_H)
        self.setFocusPolicy(Qt.StrongFocus)

    # ----- 构建 UI -----
    def _build_ui(self):
        outer = QVBoxLayout(self)
        outer.setContentsMargins(CARD_MARGIN, CARD_MARGIN,
                                 CARD_MARGIN, CARD_MARGIN)
        outer.setSpacing(0)

        # 卡片容器
        card = QFrame()
        card.setObjectName('card')
        outer.addWidget(card)

        card_layout = QVBoxLayout(card)
        card_layout.setContentsMargins(0, 0, 0, 0)
        card_layout.setSpacing(0)

        # 搜索栏
        card_layout.addWidget(self._build_search_bar())

        # 结果列表
        card_layout.addWidget(self._build_results(), 1)

        # 状态栏
        card_layout.addWidget(self._build_status_bar())

        # 卡片多层阴影
        shadow = QGraphicsDropShadowEffect(card)
        shadow.setOffset(0, 6)
        shadow.setBlurRadius(48)
        shadow.setColor(QColor(0, 0, 0, 28))
        card.setGraphicsEffect(shadow)

    def _build_search_bar(self) -> QFrame:
        bar = QFrame()
        bar.setObjectName('searchBar')
        h = QHBoxLayout(bar)
        h.setContentsMargins(24, 22, 20, 18)
        h.setSpacing(12)

        # 搜索图标（用 Unicode 放大镜，免资源依赖）
        icon = QLabel('\U0001F50E')
        icon.setObjectName('searchIcon')
        icon.setFixedSize(22, 22)
        h.addWidget(icon)

        # 输入框
        self.input = QLineEdit()
        self.input.setObjectName('searchInput')
        self.input.setPlaceholderText('搜索应用…')
        self.input.setClearButtonEnabled(False)
        self.input.textChanged.connect(self._on_text_changed)
        self.input.returnPressed.connect(self._on_enter)
        h.addWidget(self.input, 1)

        # 快捷键提示
        hint = QLabel(HOTKEY_TEXT)
        hint.setObjectName('hintKbd')
        hint.setAlignment(Qt.AlignCenter)
        h.addWidget(hint)
        return bar

    def _build_results(self) -> QFrame:
        container = QFrame()
        container.setObjectName('resultsWrap')
        v = QVBoxLayout(container)
        v.setContentsMargins(6, 8, 6, 6)
        v.setSpacing(0)

        self.results_layout = QVBoxLayout()
        self.results_layout.setContentsMargins(0, 0, 0, 0)
        self.results_layout.setSpacing(2)
        v.addLayout(self.results_layout, 1)

        # 空状态（居中显示）
        self.empty = QLabel()
        self.empty.setObjectName('emptyState')
        self.empty.setAlignment(Qt.AlignCenter)
        self.empty.setText('\u65e0\u5339\u914d\u7ed3\u679c')  # 无匹配结果
        self.empty.hide()
        v.addWidget(self.empty, 1)
        return container

    def _build_status_bar(self) -> QFrame:
        bar = QFrame()
        bar.setObjectName('statusBar')
        bar.setFixedHeight(32)
        h = QHBoxLayout(bar)
        h.setContentsMargins(20, 0, 20, 0)
        h.setSpacing(0)

        left = QLabel(f'\u5df2\u7d22\u5f15 {len(self.apps)} \u4e2a\u5e94\u7528')  # 已索引 N 个应用
        left.setObjectName('statusLeft')
        h.addWidget(left)

        h.addStretch(1)

        # 右侧快捷键提示：用独立标签 + 间距分隔，避免中英混排拥挤
        hints = [
            ('\u2191\u2193', '\u9009\u62e9'),    # ↑↓ 选择
            ('Enter', '\u542f\u52a8'),            # Enter 启动
            ('Esc', '\u5173\u95ed'),              # Esc 关闭
        ]
        for i, (key, desc) in enumerate(hints):
            if i > 0:
                sep = QLabel('\u00b7')  # ·
                sep.setObjectName('statusSep')
                h.addWidget(sep)
            lbl = QLabel(
                f'<span style="color:{COLOR_TEXT_SECONDARY};font-weight:500;">'
                f'{key}</span>'
                f'<span style="color:{COLOR_TEXT_QUATERNARY};margin:0 4px;"> '
                f'</span>'
                f'<span style="color:{COLOR_TEXT_TERTIARY};">{desc}</span>'
            )
            lbl.setObjectName('statusRight')
            h.addWidget(lbl)
        return bar

    # ----- 样式 -----
    def _apply_qss(self):
        self.setStyleSheet(f'''
            #card {{
                background: {COLOR_BG};
                border-radius: 14px;
                border: 1px solid {COLOR_BORDER};
            }}
            #searchBar {{
                background: qlineargradient(x1:0, y1:0, x2:0, y2:1,
                    stop:0 {COLOR_BG}, stop:1 rgba(245,245,247,0.6));
                border-bottom: 1px solid {COLOR_BORDER};
                border-top-left-radius: 14px;
                border-top-right-radius: 14px;
            }}
            #searchIcon {{
                color: {COLOR_TEXT_QUATERNARY};
                font-size: 16px;
            }}
            #searchInput {{
                background: transparent;
                border: none;
                color: {COLOR_TEXT};
                font-size: 18px;
                font-weight: 400;
                letter-spacing: 0.1px;
                selection-background-color: {COLOR_ACCENT_SOFT};
                selection-color: {COLOR_ACCENT};
            }}
            #searchInput::placeholder {{
                color: {COLOR_TEXT_QUATERNARY};
                font-weight: 300;
            }}
            #hintKbd {{
                color: {COLOR_TEXT_TERTIARY};
                background: {COLOR_BG_SOFT};
                border: 1px solid {COLOR_BORDER};
                border-radius: 5px;
                padding: 3px 8px;
                font-size: 11px;
                font-weight: 500;
            }}
            #resultsWrap {{
                background: {COLOR_BG};
                border-bottom: 1px solid {COLOR_BORDER};
            }}
            QFrame#resultItem {{
                background: transparent;
                border-radius: 10px;
                border: none;
            }}
            QFrame#resultItem[hover="true"] {{
                background: {COLOR_BG_HOVER};
            }}
            QFrame#resultItem[selected="true"] {{
                background: qlineargradient(x1:0, y1:0, x2:1, y2:0,
                    stop:0 rgba(74,144,217,0.10),
                    stop:0.7 rgba(74,144,217,0.03),
                    stop:1 transparent);
                border: 1px solid rgba(74,144,217,0.12);
            }}
            #itemName {{
                color: {COLOR_TEXT};
                font-size: 14px;
                font-weight: 600;
                background: transparent;
                border: none;
            }}
            QFrame#resultItem[selected="true"] #itemName {{
                color: {COLOR_TEXT};
                font-weight: 700;
            }}
            #itemPath {{
                color: #585860;
                font-size: 11.5px;
                font-weight: 400;
                background: transparent;
                border: none;
            }}
            #statusBar {{
                background: {COLOR_BG_SOFT};
                border-bottom-left-radius: 14px;
                border-bottom-right-radius: 14px;
            }}
            #statusLeft {{
                color: {COLOR_TEXT_TERTIARY};
                font-size: 11px;
                font-weight: 500;
            }}
            #statusSep {{
                color: {COLOR_TEXT_QUATERNARY};
                font-size: 11px;
                margin: 0 10px;
            }}
            #statusRight {{
                font-size: 11px;
            }}
            #emptyState {{
                color: {COLOR_TEXT_QUATERNARY};
                font-size: 14px;
                font-weight: 500;
            }}
        ''')

    # ----- 搜索逻辑 -----
    def _on_text_changed(self, text: str):
        self._refresh_results(text)
        self.input.setFocus()

    def _refresh_results(self, query: str):
        # 清空旧结果
        while self.results_layout.count():
            item = self.results_layout.takeAt(0)
            w = item.widget()
            if w:
                w.deleteLater()

        if query:
            raw = fuzzy_search.fuzzy_search(self.apps, query, key='name',
                                             limit=8)
        else:
            # 无查询：按最近使用排序显示前 8 个
            ranked = sorted(self.apps,
                            key=lambda a: -self.recent.weight(a['name']))
            raw = [{'item': a, 'score': 0.0, 'positions': []}
                   for a in ranked[:8]]

        self.results = raw
        if not raw:
            self.empty.show()
            self.results_layout.parentWidget().update()
        else:
            self.empty.hide()

        for i, r in enumerate(raw):
            widget = ResultItem(i, r['item'], r['positions'], self)
            widget.clicked.connect(self._on_item_clicked)
            self.results_layout.addWidget(widget)

        self.selected = 0 if raw else -1
        self._update_selection()

    def _update_selection(self):
        for i in range(self.results_layout.count()):
            w = self.results_layout.itemAt(i).widget()
            if isinstance(w, ResultItem):
                w.set_selected(w.index == self.selected)

    def _move_selection(self, delta: int):
        if not self.results:
            return
        n = len(self.results)
        self.selected = (self.selected + delta) % n
        self._update_selection()

    # ----- 事件 -----
    def keyPressEvent(self, e):
        k = e.key()
        if k == Qt.Key_Escape:
            self.hide_window()
        elif k == Qt.Key_Down:
            self._move_selection(1)
        elif k == Qt.Key_Up:
            self._move_selection(-1)
        elif k == Qt.Key_Return or k == Qt.Key_Enter:
            self._on_enter()
        else:
            # 让输入框处理其他按键
            self.input.event(e)
            # 但如果输入框已经处理了 text change，这里不重复
            super().keyPressEvent(e)

    def _on_enter(self):
        if 0 <= self.selected < len(self.results):
            self._launch(self.selected)

    def _on_item_clicked(self, idx: int):
        self.selected = idx
        self._update_selection()
        self._launch(idx)

    def _launch(self, idx: int):
        if idx < 0 or idx >= len(self.results):
            return
        app = self.results[idx]['item']
        path = app['path']
        try:
            os.startfile(path)  # type: ignore
        except Exception:
            try:
                subprocess.Popen(['cmd', '/c', 'start', '', path],
                                 shell=False)
            except Exception:
                return
        self.recent.record(app['name'])
        self.hide_window()

    # ----- 显隐控制 -----
    def show_window(self):
        """唤起窗口：定位到屏幕顶部居中（Spotlight 风格）并显示。"""
        self._suppress_deactivate = True
        self._position_top_center()
        self.show()
        self.raise_()
        self.activateWindow()
        self.input.clear()
        self.input.setFocus()
        # 稍后解除抑制，避免立即触发 Deactivated
        QTimer.singleShot(150, self._release_suppress)

    def hide_window(self):
        self._suppress_deactivate = True
        self.hide()
        QTimer.singleShot(150, self._release_suppress)

    def _release_suppress(self):
        self._suppress_deactivate = False

    def _position_top_center(self):
        screen = QApplication.primaryScreen().availableGeometry()
        x = screen.center().x() - self.width() // 2
        y = int(screen.height() * 0.18)  # 屏幕顶部 18% 处
        self.move(x, y)

    def changeEvent(self, event):
        """失焦自动隐藏（输入法式体验）。测试模式可禁用。"""
        if os.environ.get('LAUNCHER_NOHIDE') == '1':
            super().changeEvent(event)
            return
        if event.type() == QEvent.ActivationChange and \
           not self.isActiveWindow() and not self._suppress_deactivate:
            # 延迟一点检查，避免点击结果项时误隐藏
            QTimer.singleShot(80, self._check_hide)
        super().changeEvent(event)

    def _check_hide(self):
        if not self.isActiveWindow() and self.isVisible() and \
           not self._suppress_deactivate:
            self.hide()

    def focusOutEvent(self, e):
        super().focusOutEvent(e)


# ===== 系统托盘 =====
class TrayIcon(QSystemTrayIcon):
    def __init__(self, parent, on_show, on_quit):
        super().__init__(parent)
        icon_path = _resource_path('icon.ico')
        if os.path.exists(icon_path):
            self.setIcon(QIcon(icon_path))
        else:
            # 占位图标
            pm = QPixmap(64, 64)
            pm.fill(QColor(COLOR_ACCENT))
            self.setIcon(QIcon(pm))
        self.setToolTip(f'{APP_NAME} · {HOTKEY_TEXT}')

        menu = QMenu()
        act_show = QAction(f'\u663e\u793a\u542f\u52a8\u5668 ({HOTKEY_TEXT})', menu)  # 显示启动器
        act_show.triggered.connect(on_show)
        menu.addAction(act_show)
        menu.addSeparator()
        act_quit = QAction('\u9000\u51fa', menu)  # 退出
        act_quit.triggered.connect(on_quit)
        menu.addAction(act_quit)
        self.setContextMenu(menu)
        self.activated.connect(lambda r: r == QSystemTrayIcon.Trigger and on_show())


# ===== 主程序 =====
def main():
    app = QApplication(sys.argv)
    app.setApplicationName(APP_NAME)
    app.setQuitOnLastWindowClosed(False)  # 关闭窗口不退出，托盘常驻

    # 字体
    font = QFont()
    for fam in ('Segoe UI', 'PingFang SC', 'Microsoft YaHei', 'Arial'):
        font.setFamily(fam)
        break
    font.setPointSize(9)
    app.setFont(font)

    # 索引应用（后台线程感更轻：直接同步，通常 < 500ms）
    apps = app_indexer.scan_apps()

    # 最近使用
    recent = RecentStore()

    # 主窗口
    window = LauncherWindow(apps, recent)

    # 托盘
    tray = TrayIcon(None, window.show_window, app.quit)
    tray.show()

    # 全局热键
    hotkey_ok = register_alt_space()

    def on_hotkey():
        if window.isVisible():
            window.hide_window()
        else:
            window.show_window()

    hotkey_filter = HotkeyEventFilter(on_hotkey)
    app.installNativeEventFilter(hotkey_filter)

    # 首次显示
    window.show_window()

    # 测试模式：预填搜索查询展示高亮效果
    test_query = os.environ.get('LAUNCHER_TEST_QUERY', '')
    if test_query:
        QTimer.singleShot(300, lambda: window.input.setText(test_query))

    code = app.exec()
    unregister_alt_space()
    sys.exit(code)


if __name__ == '__main__':
    main()
