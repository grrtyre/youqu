# -*- coding: utf-8 -*-
"""表情管家便携版 · 主程序
输入法式 emoji 选择器：全局热键唤起、光标处弹出、点击复制、失焦隐藏、托盘常驻
苹果白高端风格 —— 白底浅灰、细腻阴影、系统字体、蓝色 #007aff 强调
"""
import sys
import os
import ctypes
from ctypes import wintypes

from PySide6.QtCore import Qt, QTimer, QEvent, QAbstractNativeEventFilter, QSize, Signal
from PySide6.QtGui import (
    QIcon, QFont, QFontDatabase, QColor, QPainter, QPen, QCursor,
)
from PySide6.QtWidgets import (
    QApplication, QWidget, QVBoxLayout, QHBoxLayout, QLabel, QLineEdit,
    QFrame, QSystemTrayIcon, QMenu, QListWidget, QListWidgetItem,
    QScrollArea, QPushButton, QSizePolicy, QGraphicsDropShadowEffect,
)
from PySide6.QtGui import QClipboard

# 引入核心与存储
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import emoji_core as core  # noqa: E402
import store as store_mod  # noqa: E402

# ============ Windows API 常量 ============
MOD_ALT = 0x0001
MOD_CONTROL = 0x0002
MOD_SHIFT = 0x0004
MOD_NOREPEAT = 0x4000
VK_E = 0x45
WM_HOTKEY = 0x0312
HOTKEY_ID = 9102

user32 = ctypes.windll.user32


def register_hotkey() -> bool:
    """注册全局热键 Ctrl+Shift+E"""
    return bool(user32.RegisterHotKey(None, HOTKEY_ID, MOD_CONTROL | MOD_SHIFT | MOD_NOREPEAT, VK_E))


def unregister_hotkey():
    user32.UnregisterHotKey(None, HOTKEY_ID)


class HotkeyFilter(QAbstractNativeEventFilter):
    """捕获 Windows 原生 WM_HOTKEY 消息"""

    def __init__(self, callback):
        super().__init__()
        self._callback = callback

    def nativeEventFilter(self, eventType, message):
        if eventType == b"windows_generic_MSG":
            try:
                msg = wintypes.MSG.from_address(int(message))
                if msg.message == WM_HOTKEY and msg.wParam == HOTKEY_ID:
                    self._callback()
                    return True, 0
            except Exception:
                pass
        return False, 0


# ============ 苹果白样式 ============
APPLE_QSS = """
QWidget#root {
    background: #ffffff;
    border-radius: 18px;
}
QLabel#title {
    color: #1d1d1f;
    font-size: 15px;
    font-weight: 700;
    letter-spacing: 0.3px;
}
QLabel#accentDot {
    color: #007aff;
    font-size: 16px;
    font-weight: 700;
}
QLabel#shortcutKey {
    color: #6e6e73;
    font-size: 11px;
    font-weight: 500;
    background: #f0f0f5;
    border-radius: 9px;
    padding: 3px 9px;
}
QFrame#searchCard {
    background: #f5f5f7;
    border-radius: 12px;
}
QLineEdit#search {
    background: transparent;
    border: none;
    padding: 10px 12px;
    color: #1d1d1f;
    font-size: 14px;
    selection-background-color: #007aff;
    selection-color: #ffffff;
}
QFrame#catBar {
    background: #f5f5f7;
    border-radius: 11px;
}
QPushButton#catBtn {
    background: transparent;
    border: none;
    border-radius: 9px;
    padding: 0;
    margin: 0;
    font-size: 20px;
    color: #3d3d42;
}
QPushButton#catBtn:hover {
    background: #e8e8ee;
}
QPushButton#catBtn:checked {
    background: #e8f0fe;
    color: #007aff;
    font-weight: 600;
}
QListWidget#grid {
    background: transparent;
    border: none;
    outline: none;
}
QListWidget#grid::item {
    border-radius: 8px;
    margin: 0;
}
QLabel#footer {
    color: #6e6e73;
    font-size: 12px;
    font-weight: 500;
}
QPushButton#star {
    background: transparent;
    border: none;
    font-size: 15px;
    color: #6e6e73;
    padding: 0;
}
QPushButton#star:hover { color: #ff9500; }
QPushButton#star:on { color: #ff9500; }
"""


# ============ emoji 单元格（自定义 widget）============
class EmojiCell(QWidget):
    """单行 emoji 卡片：emoji + 名称 + 关键词 + 收藏星
    紧凑布局，hover 高亮，点击复制
    """

    clicked_copy = Signal(dict)

    def __init__(self, item: dict, is_fav: bool, parent=None):
        super().__init__(parent)
        self._item = item
        self._is_fav = is_fav
        self.setObjectName("cell")
        self._build()
        self.setFixedHeight(42)

    def _build(self):
        lay = QHBoxLayout(self)
        lay.setContentsMargins(12, 0, 8, 0)
        lay.setSpacing(10)
        # emoji 字符
        self._lab_char = QLabel(self._item.get("c", ""))
        self._lab_char.setStyleSheet(
            "font-size:22px; color:#1d1d1f; background:transparent;"
        )
        self._lab_char.setFixedWidth(30)
        self._lab_char.setAlignment(Qt.AlignCenter)
        lay.addWidget(self._lab_char)
        # 名称
        self._lab_name = QLabel(self._item.get("n", ""))
        self._lab_name.setStyleSheet(
            "color:#1d1d1f; font-size:13px; font-weight:500; background:transparent;"
        )
        lay.addWidget(self._lab_name)
        lay.addStretch(1)
        # 收藏星
        self._star = QPushButton("★" if self._is_fav else "☆", self)
        self._star.setObjectName("star")
        self._star.setCheckable(True)
        self._star.setChecked(self._is_fav)
        self._star.setFixedSize(22, 22)
        self._star.setCursor(Qt.PointingHandCursor)
        self._star.setFocusPolicy(Qt.NoFocus)
        lay.addWidget(self._star)
        # 行底分割线（清晰但克制）
        self.setStyleSheet(
            "QWidget#cell { background: transparent; border-bottom: 1px solid #ececf0; border-radius: 0; }"
            "QWidget#cell:hover { background: #f5f5f7; border-bottom-color: transparent; }"
        )

    def mousePressEvent(self, event):
        if event.button() == Qt.LeftButton:
            self.clicked_copy.emit(self._item)
        super().mousePressEvent(event)

    def set_fav(self, fav: bool):
        self._is_fav = fav
        self._star.setText("★" if fav else "☆")
        self._star.setChecked(fav)


# ============ 主窗口 ============
class EmojiWindow(QWidget):
    GRID_PAGE = 80  # 每页最多渲染数（性能保护）

    def __init__(self, store: store_mod.EmojiStore):
        super().__init__()
        self._store = store
        self._all_cats = core.list_categories()
        # 当前视图状态
        self._cur_cat = "recommend"  # 默认推荐
        self._cur_keyword = ""
        self._render_count = self.GRID_PAGE
        self._suppress_hide = True
        self._shot_mode = os.environ.get("PORTABLE_SHOT_MODE") == "1"

        self.setWindowTitle("表情管家便携版")
        self.setWindowFlags(
            Qt.FramelessWindowHint | Qt.Tool | Qt.WindowStaysOnTopHint
        )
        self.setAttribute(Qt.WA_TranslucentBackground, True)
        self.setFixedSize(380, 460)

        self._build_ui()
        self._apply_shadow()
        # 截图模式：预置示例收藏与历史，展示收藏态视觉差异
        if self._shot_mode:
            self._seed_demo_data()
        # 预加载第一屏
        QTimer.singleShot(0, self._refresh)

    def _seed_demo_data(self):
        """截图模式：预置几个收藏和历史项，让界面有真实数据感"""
        from emoji_data import get_all_emojis
        all_items = get_all_emojis()
        # 选 3 个加入收藏
        for char in ("😀", "❤️", "🎉"):
            it = next((e for e in all_items if e["c"] == char), None)
            if it and not self._store.is_favorite(char):
                self._store.toggle_favorite(it)
        # 选 5 个加入历史
        for char in ("😂", "👍", "🐱", "☕", "🎵"):
            it = next((e for e in all_items if e["c"] == char), None)
            if it:
                self._store.add_history(it)

    # ---- UI ----
    def _build_ui(self):
        root = QFrame(self)
        root.setObjectName("root")
        root.setGeometry(0, 0, 380, 460)
        lay = QVBoxLayout(root)
        lay.setContentsMargins(18, 14, 18, 12)
        lay.setSpacing(12)

        # 顶部标题行（蓝色点缀 + 标题 + 热键徽章）
        top = QHBoxLayout()
        top.setSpacing(6)
        self._accent = QLabel("●")
        self._accent.setObjectName("accentDot")
        top.addWidget(self._accent)
        self._title = QLabel("表情管家")
        self._title.setObjectName("title")
        top.addWidget(self._title)
        top.addStretch()
        self._badge = QLabel("Ctrl+Shift+E")
        self._badge.setObjectName("shortcutKey")
        top.addWidget(self._badge)
        lay.addLayout(top)

        # 搜索框卡片
        search_card = QFrame()
        search_card.setObjectName("searchCard")
        sl = QHBoxLayout(search_card)
        sl.setContentsMargins(12, 0, 10, 0)
        sl.setSpacing(6)
        self._search_icon = QLabel("🔍")
        self._search_icon.setStyleSheet(
            "color:#8e8e93; font-size:15px; background:transparent;"
        )
        sl.addWidget(self._search_icon)
        self._search = QLineEdit()
        self._search.setObjectName("search")
        self._search.setPlaceholderText("搜索表情…")
        self._search.setAttribute(Qt.WA_MacShowFocusRect, 0)
        self._search.textChanged.connect(self._on_search_changed)
        sl.addWidget(self._search, 1)
        lay.addWidget(search_card)

        # 分类条
        cat_bar = QFrame()
        cat_bar.setObjectName("catBar")
        cat_bar.setFixedHeight(42)
        cl = QHBoxLayout(cat_bar)
        cl.setContentsMargins(4, 4, 4, 4)
        cl.setSpacing(3)
        # 推荐按钮
        self._cat_btns = []
        rec_btn = QPushButton("⭐")
        rec_btn.setObjectName("catBtn")
        rec_btn.setCheckable(True)
        rec_btn.setChecked(True)
        rec_btn.setToolTip("收藏与历史")
        rec_btn.setFixedSize(34, 34)
        rec_btn.clicked.connect(lambda _=False, cid="recommend": self._on_cat_clicked(cid))
        cl.addWidget(rec_btn)
        self._cat_btns.append((rec_btn, "recommend"))
        # 各分类图标按钮
        for cat in self._all_cats:
            btn = QPushButton(cat["icon"])
            btn.setObjectName("catBtn")
            btn.setCheckable(True)
            btn.setToolTip(cat["name"])
            btn.setFixedSize(34, 34)
            btn.clicked.connect(lambda _=False, cid=cat["id"]: self._on_cat_clicked(cid))
            cl.addWidget(btn)
            self._cat_btns.append((btn, cat["id"]))
        # 让分类条可滚动（11+1 个图标 32px = 384px，略超 348px 内容区，加滚动）
        cat_scroll = QScrollArea()
        cat_scroll.setWidget(cat_bar)
        cat_scroll.setWidgetResizable(True)
        cat_scroll.setFixedHeight(42)
        cat_scroll.setHorizontalScrollBarPolicy(Qt.ScrollBarAlwaysOff)
        cat_scroll.setVerticalScrollBarPolicy(Qt.ScrollBarAlwaysOff)
        cat_scroll.setStyleSheet(
            "QScrollArea { background: transparent; border: none; }"
            "QScrollBar { height: 0px; }"
        )
        lay.addWidget(cat_scroll)

        # emoji 列表
        self._grid = QListWidget()
        self._grid.setObjectName("grid")
        self._grid.setViewMode(QListWidget.ListMode)
        self._grid.setResizeMode(QListWidget.Adjust)
        self._grid.setMovement(QListWidget.Static)
        self._grid.setUniformItemSizes(True)
        self._grid.setSpacing(0)
        self._grid.setContentsMargins(0, 0, 0, 0)
        self._grid.setHorizontalScrollBarPolicy(Qt.ScrollBarAlwaysOff)
        self._grid.itemSelectionChanged.connect(self._on_item_selected)
        # 自定义滚动条样式
        self._grid.setStyleSheet(
            """
            QListWidget#grid { background: transparent; border: none; }
            QScrollBar:vertical { background: transparent; width: 6px; margin: 0; }
            QScrollBar::handle:vertical { background: #d8d8de; border-radius: 3px; min-height: 24px; }
            QScrollBar::handle:vertical:hover { background: #b8b8be; }
            QScrollBar::add-line:vertical, QScrollBar::sub-line:vertical { height: 0; }
            """
        )
        lay.addWidget(self._grid, 1)

        # 底部提示
        self._footer = QLabel("Ctrl+Shift+E 隐藏")
        self._footer.setObjectName("footer")
        self._footer.setAlignment(Qt.AlignCenter)
        lay.addWidget(self._footer)

        root.setStyleSheet(APPLE_QSS)
        self._root = root

        # 滚动到底部自动加载更多
        vbar = self._grid.verticalScrollBar()
        vbar.valueChanged.connect(self._on_scroll)

    def _apply_shadow(self):
        shadow = QGraphicsDropShadowEffect(self._root)
        shadow.setBlurRadius(38)
        shadow.setColor(QColor(0, 0, 0, 45))
        shadow.setOffset(0, 8)
        self._root.setGraphicsEffect(shadow)

    # ---- 数据加载 ----
    def _current_items(self) -> list:
        """根据当前分类/关键词计算要展示的列表"""
        if self._cur_keyword:
            return core.search(self._cur_keyword)
        if self._cur_cat == "recommend":
            fav = self._store.get_favorites()
            hist = self._store.get_history()
            return core.merge_results(fav, hist, [], limit=80)
        return core.filter_by_category(self._cur_cat)

    def _refresh(self):
        items = self._current_items()
        # 限制渲染数量（性能保护，分页加载）
        page = items[: self._render_count]
        self._grid.clear()
        for it in page:
            list_item = QListWidgetItem(self._grid)
            list_item.setSizeHint(QSize(344, 42))
            cell = EmojiCell(it, self._store.is_favorite(it.get("c", "")), self._grid)
            cell.clicked_copy.connect(self._on_cell_copy)
            self._grid.setItemWidget(list_item, cell)
        # 提示数量
        total = len(items)
        shown = len(page)
        if total > shown:
            self._footer.setText(f"已显示 {shown} / {total}　·　滚动加载更多")
        else:
            self._footer.setText(f"共 {total} 个　·　Ctrl+Shift+E 隐藏")

    def _on_scroll(self, val):
        vbar = self._grid.verticalScrollBar()
        if vbar.maximum() - val < 30:
            # 加载更多
            items = self._current_items()
            if self._render_count < len(items):
                self._render_count = min(self._render_count + 60, len(items))
                self._refresh()

    # ---- 交互 ----
    def _on_cat_clicked(self, cid: str):
        self._cur_cat = cid
        self._cur_keyword = ""
        self._render_count = self.GRID_PAGE
        # 切换按钮选中态
        for btn, b_cid in self._cat_btns:
            btn.setChecked(b_cid == cid)
        # 清空搜索框
        self._search.blockSignals(True)
        self._search.clear()
        self._search.blockSignals(False)
        self._refresh()

    def _on_search_changed(self, text: str):
        self._cur_keyword = text.strip()
        self._render_count = self.GRID_PAGE
        # 搜索时取消分类按钮选中
        if self._cur_keyword:
            for btn, _ in self._cat_btns:
                btn.setChecked(False)
        self._refresh()

    def _on_item_selected(self):
        pass  # 不用选中态，靠单元格点击信号

    def _on_cell_copy(self, item: dict):
        """点击单元格：复制到剪贴板 + 加入历史 + 隐藏"""
        char = item.get("c", "")
        if not char:
            return
        QApplication.clipboard().setText(char)
        self._store.add_history(item)
        # 复制后视觉反馈：短暂闪一下（可选）
        # 在推荐视图下立即刷新
        if self._cur_cat == "recommend" and not self._cur_keyword:
            self._refresh()
        # 失焦自动隐藏会处理关闭；截图模式下保持显示
        if not self._shot_mode:
            self.hide()

    # ---- 失焦自动隐藏 ----
    def changeEvent(self, event):
        if event.type() == QEvent.ActivationChange and self.isVisible():
            if not self.isActiveWindow() and not self._suppress_hide and not self._shot_mode:
                QTimer.singleShot(150, self._maybe_hide)
        super().changeEvent(event)

    def _maybe_hide(self):
        if self.isVisible() and not self.isActiveWindow():
            self.hide()

    # ---- 显示/隐藏 ----
    def toggle(self):
        if self.isVisible():
            self.hide()
        else:
            self._show_at_cursor_or_center()

    def _show_at_cursor_or_center(self):
        self._suppress_hide = True
        # 截图模式：默认显示推荐视图（含预置收藏/历史），展示收藏态视觉差异
        if self._shot_mode:
            self._cur_cat = "recommend"
            self._cur_keyword = ""
            self._render_count = self.GRID_PAGE
            self._refresh()
        self.show()
        self.raise_()
        self.activateWindow()
        self._search.setFocus()
        self._search.selectAll()
        # 定位到光标附近（输入法式）：避免超出屏幕
        self._place_near_cursor()
        QTimer.singleShot(600, self._release_suppress)

    def _place_near_cursor(self):
        cur = QCursor.pos()
        x = cur.x() + 12
        y = cur.y() + 18
        # 屏幕边界保护
        screen = QApplication.primaryScreen().availableGeometry()
        if x + self.width() > screen.right() - 8:
            x = cur.x() - self.width() - 12
        if y + self.height() > screen.bottom() - 8:
            y = max(screen.top() + 8, cur.y() - self.height() - 12)
        if x < screen.left() + 8:
            x = screen.left() + 8
        if y < screen.top() + 8:
            y = screen.top() + 8
        self.move(x, y)

    def _release_suppress(self):
        self._suppress_hide = False

    def showEvent(self, event):
        super().showEvent(event)
        self.raise_()
        self.activateWindow()

    # ---- 键盘 ----
    def keyPressEvent(self, event):
        key = event.key()
        if key == Qt.Key_Escape:
            self.hide(); return
        # 回车：复制当前选中项（如有）
        if key in (Qt.Key_Return, Qt.Key_Enter):
            cur = self._grid.currentRow()
            if cur >= 0:
                it = self._grid.item(cur)
                if it:
                    cell = self._grid.itemWidget(it)
                    if isinstance(cell, EmojiCell) and cell._item:
                        self._on_cell_copy(cell._item)
            return
        super().keyPressEvent(event)

    # ---- 系统托盘 ----
    def setup_tray(self, app_icon: QIcon):
        self._tray = QSystemTrayIcon(app_icon, self)
        self._tray.setToolTip("表情管家便携版 · Ctrl+Shift+E 唤起")
        menu = QMenu()
        act_show = menu.addAction("显示表情面板")
        act_show.triggered.connect(self._show_at_cursor_or_center)
        menu.addSeparator()
        act_clear = menu.addAction("清空使用历史")
        act_clear.triggered.connect(self._on_clear_history)
        menu.addSeparator()
        act_quit = menu.addAction("退出")
        act_quit.triggered.connect(QApplication.quit)
        self._tray.setContextMenu(menu)
        self._tray.activated.connect(self._on_tray_activated)
        self._tray.show()

    def _on_tray_activated(self, reason):
        if reason == QSystemTrayIcon.Trigger:
            self._show_at_cursor_or_center()

    def _on_clear_history(self):
        self._store.clear_history()
        if self._cur_cat == "recommend" and not self._cur_keyword:
            self._refresh()


def main():
    app = QApplication(sys.argv)
    app.setQuitOnLastWindowClosed(False)
    app.setApplicationName("表情管家便携版")

    # 字体（系统字体优先）
    QFontDatabase.addApplicationFont("C:/Windows/Fonts/segoeui.ttf")
    QFontDatabase.addApplicationFont("C:/Windows/Fonts/msyh.ttc")
    font = QFont("Segoe UI", 10)
    # emoji 渲染需要支持彩色字体的字体回退，Segoe UI Emoji 是 Windows 内置
    font.setStyleHint(QFont.SansSerif)
    app.setFont(font)

    # 图标（兼容 PyInstaller onefile：优先 sys._MEIPASS）
    base_dir = getattr(sys, "_MEIPASS", os.path.dirname(os.path.abspath(__file__)))
    icon_path = os.path.join(base_dir, "assets", "icon.ico")
    if not os.path.exists(icon_path):
        icon_path = os.path.join(base_dir, "icon.ico")
    if not os.path.exists(icon_path):
        icon_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets", "icon.ico")
    app_icon = QIcon(icon_path) if os.path.exists(icon_path) else QIcon()
    app.setWindowIcon(app_icon)

    # 初始化存储（截图模式用临时路径，避免污染用户数据）
    shot_mode = os.environ.get("PORTABLE_SHOT_MODE") == "1"
    if shot_mode:
        import tempfile
        tmp_path = os.path.join(tempfile.mkdtemp(), "data.json")
        emoji_store = store_mod.EmojiStore(tmp_path)
    else:
        emoji_store = store_mod.EmojiStore()

    win = EmojiWindow(emoji_store)
    win.setup_tray(app_icon)

    # 注册全局热键
    register_hotkey()
    hotkey_filter = HotkeyFilter(win.toggle)
    app.installNativeEventFilter(hotkey_filter)

    # 首次显示
    print("[main] starting event loop", flush=True)
    QTimer.singleShot(300, win._show_at_cursor_or_center)

    code = app.exec()
    print(f"[main] event loop exited code={code}", flush=True)
    unregister_hotkey()
    sys.exit(code)


if __name__ == "__main__":
    main()
