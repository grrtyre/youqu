# -*- coding: utf-8 -*-
"""
代码片段管家 · 便携版
原生 PySide6 重写 —— 像输入法一样的代码片段速取小组件

特性：
- 全局热键 Ctrl+Shift+S 唤起/隐藏
- 失焦自动隐藏（输入法式体验）
- 系统托盘常驻
- 小界面 380×480
- 苹果白高端风格
- 搜索 + 键盘导航 + 点击复制粘贴
- 与原版数据格式完全兼容
"""
import sys
import os
import json
import time
import ctypes
import ctypes.wintypes as wintypes
from pathlib import Path

from PySide6.QtWidgets import (
    QApplication, QWidget, QVBoxLayout, QHBoxLayout, QLineEdit,
    QListWidget, QListWidgetItem, QLabel, QSystemTrayIcon, QMenu,
    QStyle, QTextBrowser, QFrame, QSizePolicy, QToolButton, QPushButton
)
from PySide6.QtCore import (
    Qt, QTimer, QEvent, QSize, Signal, QObject, QBuffer, QIODevice
)
from PySide6.QtGui import (
    QIcon, QPixmap, QColor, QFont, QPalette, QAction, QPainter,
    QFontDatabase, QKeySequence, QShortcut, QPen, QBrush, QImage
)
from PySide6.QtWidgets import QStyleOptionViewItem, QStyledItemDelegate

from snippet_store import SnippetStore
from highlight import highlight, highlight_html

# ========== Windows API 常量 ==========
user32 = ctypes.windll.user32
kernel32 = ctypes.windll.kernel32

MOD_ALT = 0x0001
MOD_CONTROL = 0x0002
MOD_SHIFT = 0x0004
MOD_WIN = 0x0008
MOD_NOREPEAT = 0x4000

VK_CONTROL = 0x11
VK_V = 0x56

WM_HOTKEY = 0x0312

# 输入结构体
class MOUSEINPUT(ctypes.Structure):
    _fields_ = [("dx", wintypes.LONG), ("dy", wintypes.LONG),
                ("mouseData", wintypes.DWORD), ("dwFlags", wintypes.DWORD),
                ("time", wintypes.DWORD), ("dwExtraInfo", ctypes.POINTER(ctypes.c_ulong))]

class KEYBDINPUT(ctypes.Structure):
    _fields_ = [("wVk", wintypes.WORD), ("wScan", wintypes.WORD),
                ("dwFlags", wintypes.DWORD), ("time", wintypes.DWORD),
                ("dwExtraInfo", ctypes.POINTER(ctypes.c_ulong))]

class HARDWAREINPUT(ctypes.Structure):
    _fields_ = [("uMsg", wintypes.DWORD), ("wParamL", wintypes.WORD),
                ("wParamH", wintypes.WORD)]

class INPUT_UNION(ctypes.Union):
    _fields_ = [("ki", KEYBDINPUT), ("mi", MOUSEINPUT), ("hi", HARDWAREINPUT)]

class INPUT(ctypes.Structure):
    class _INPUT(ctypes.Structure):
        _fields_ = [("type", wintypes.DWORD), ("ii", INPUT_UNION)]
        _anonymous_ = ("ii",)
    _fields_ = [("_", _INPUT)]
    _anonymous_ = ("_",)

INPUT_KEYBOARD = 1
KEYEVENTF_KEYUP = 0x0002


def send_ctrl_v():
    """模拟 Ctrl+V 粘贴到前台窗口"""
    inputs = (INPUT * 4)()

    # Ctrl down
    inputs[0].type = INPUT_KEYBOARD
    inputs[0].ki.wVk = VK_CONTROL
    inputs[0].ki.dwFlags = 0

    # V down
    inputs[1].type = INPUT_KEYBOARD
    inputs[1].ki.wVk = VK_V
    inputs[1].ki.dwFlags = 0

    # V up
    inputs[2].type = INPUT_KEYBOARD
    inputs[2].ki.wVk = VK_V
    inputs[2].ki.dwFlags = KEYEVENTF_KEYUP

    # Ctrl up
    inputs[3].type = INPUT_KEYBOARD
    inputs[3].ki.wVk = VK_CONTROL
    inputs[3].ki.dwFlags = KEYEVENTF_KEYUP

    user32.SendInput(4, ctypes.byref(inputs), ctypes.sizeof(INPUT))


def get_foreground_window_title():
    """获取当前前台窗口标题"""
    hwnd = user32.GetForegroundWindow()
    if not hwnd:
        return ""
    length = user32.GetWindowTextLengthW(hwnd)
    if length == 0:
        return ""
    buf = ctypes.create_unicode_buffer(length + 1)
    user32.GetWindowTextW(hwnd, buf, length + 1)
    return buf.value


# ========== 全局热键管理 ==========
class GlobalHotkeyManager(QObject):
    """使用 Windows RegisterHotKey API 注册全局热键"""
    hotkey_triggered = Signal()

    def __init__(self, parent=None):
        super().__init__(parent)
        self._hotkey_id = 0xB001
        self._registered = False

    def register(self, modifiers, vk_code):
        """注册全局热键"""
        if self._registered:
            self.unregister()
        result = user32.RegisterHotKey(None, self._hotkey_id, modifiers | MOD_NOREPEAT, vk_code)
        self._registered = bool(result)
        return self._registered

    def unregister(self):
        """注销全局热键"""
        if self._registered:
            user32.UnregisterHotKey(None, self._hotkey_id)
            self._registered = False

    def native_event_filter(self, eventType, message):
        """拦截 Windows 原生消息，捕获 WM_HOTKEY"""
        try:
            if eventType == b"windows_generic_MSG":
                msg = wintypes.MSG.from_address(int(message))
                if msg.message == WM_HOTKEY and msg.wParam == self._hotkey_id:
                    self.hotkey_triggered.emit()
                    return True, 0
        except Exception:
            pass
        return False, 0


class HotkeyEventFilter:
    """QAbstractNativeEventFilter 的简化实现"""
    def __init__(self, callback):
        self._callback = callback

    def nativeEventFilter(self, eventType, message):
        try:
            if eventType == b"windows_generic_MSG":
                # message 是 sip 包装的 MSG 指针
                msg = wintypes.MSG.from_address(int(message))
                if msg.message == WM_HOTKEY and msg.wParam == 0xB001:
                    self._callback()
                    return True, 0
        except Exception:
            pass
        return False, 0


# ========== 苹果白风格 QSS ==========
APPLE_WHITE_QSS = """
QWidget#popupRoot {
    background: #ffffff;
    border-radius: 14px;
    border: 1px solid rgba(0, 0, 0, 0.06);
}

QFrame#headerFrame {
    background: #f5f7fa;
    border-radius: 10px;
    border: none;
}

QLabel#titleLabel {
    color: #1d1d1f;
    font-size: 14px;
    font-weight: 600;
    padding: 0px;
    border: none;
}

QLabel#countLabel {
    color: #ffffff;
    font-size: 11px;
}

QLineEdit#searchBar {
    background: #f5f5f7;
    border: 1.5px solid transparent;
    border-radius: 10px;
    padding: 9px 14px;
    font-size: 13px;
    color: #1d1d1f;
    selection-background-color: #007aff;
    selection-color: #ffffff;
}

QLineEdit#searchBar:focus {
    border: 1.5px solid #007aff;
    background: #ffffff;
}

QLineEdit#searchBar::placeholder {
    color: #8e8e93;
}

QListWidget#snippetList {
    background: transparent;
    border: none;
    outline: none;
    padding: 2px 0px;
}

QListWidget#snippetList::item {
    background: transparent;
    border-radius: 8px;
    padding: 0px;
    margin: 1px 2px;
}

QFrame#bottomBar {
    background: #fbfbfd;
    border-top: 1px solid rgba(0, 0, 0, 0.08);
    border-bottom-left-radius: 14px;
    border-bottom-right-radius: 14px;
}

QLabel#hintLabel {
    color: #86868b;
    font-size: 12px;
}

QToolButton {
    background: transparent;
    border: none;
    padding: 3px 8px;
    border-radius: 6px;
    font-size: 11px;
}

QToolButton:hover {
    background: rgba(0, 122, 255, 0.06);
}

QMenu {
    background: #ffffff;
    border: 1px solid rgba(0, 0, 0, 0.06);
    border-radius: 8px;
    padding: 4px;
}

QMenu::item {
    padding: 6px 16px 6px 12px;
    border-radius: 6px;
    font-size: 13px;
    color: #1d1d1f;
}

QMenu::item:selected {
    background: #f5f5f7;
}

QMenu::separator {
    height: 1px;
    background: rgba(0, 0, 0, 0.05);
    margin: 4px 8px;
}

/* 滚动条苹果白风格 */
QScrollBar:vertical {
    background: transparent;
    width: 6px;
    margin: 0;
}

QScrollBar::handle:vertical {
    background: #d1d1d6;
    border-radius: 3px;
    min-height: 30px;
}

QScrollBar::handle:vertical:hover {
    background: #aeaeb2;
}

QScrollBar::add-line:vertical, QScrollBar::sub-line:vertical {
    height: 0px;
}

QScrollBar::add-page:vertical, QScrollBar::sub-page:vertical {
    background: transparent;
}
"""


# ========== 片段列表项委托 ==========
from PySide6.QtGui import QTextDocument, QAbstractTextDocumentLayout

class SnippetDelegate(QStyledItemDelegate):
    """自定义列表项绘制 —— 精简两行布局：标题+语言标签 / 语法高亮代码预览"""

    def __init__(self, parent=None):
        super().__init__(parent)
        self._doc_cache = {}  # 缓存 QTextDocument

    def paint(self, painter, option, index):
        painter.save()
        painter.setRenderHint(QPainter.Antialiasing)

        is_selected = bool(option.state & QStyle.State_Selected)
        is_hover = bool(option.state & QStyle.State_MouseOver)

        # 背景：选中用柔和淡蓝色，hover 用淡灰色
        if is_selected:
            painter.setBrush(QBrush(QColor("#eef4ff")))
            painter.setPen(Qt.NoPen)
            painter.drawRoundedRect(option.rect.adjusted(4, 2, -4, -2), 10, 10)
            # 左侧蓝色圆点指示器 - 柔和但明确
            painter.setBrush(QBrush(QColor("#007aff")))
            dot_x = option.rect.x() + 8
            dot_y = option.rect.y() + option.rect.height() // 2 - 8
            painter.drawRoundedRect(QRect(dot_x, dot_y, 2, 16), 1, 1)
        elif is_hover:
            painter.setBrush(QBrush(QColor("#f7f7f9")))
            painter.setPen(Qt.NoPen)
            painter.drawRoundedRect(option.rect.adjusted(4, 2, -4, -2), 10, 10)

        data = index.data(Qt.UserRole)
        if not data:
            painter.restore()
            return

        rect = option.rect.adjusted(18, 10, -14, -10)
        content_x = rect.x()
        content_w = rect.width()

        # === 第一行：标题（左） + 语言标签 + 收藏图标（右固定位置）===

        # 先计算右侧元素宽度，确定标题可用空间
        lang = data.get("language", "text")
        lang_font = QFont()
        lang_font.setPixelSize(11)
        lang_font.setFamilies(["Segoe UI", "PingFang SC"])
        painter.setFont(lang_font)
        lang_text_w = painter.fontMetrics().horizontalAdvance(lang)
        lang_tag_w = lang_text_w + 16
        lang_tag_h = 18

        has_fav = bool(data.get("favorite"))
        fav_space = 16 if has_fav else 0
        right_space = lang_tag_w + 6 + fav_space

        # 标题字体
        title_font = QFont()
        title_font.setPixelSize(13)
        title_font.setWeight(QFont.Medium)
        title_font.setFamilies(["Segoe UI", "PingFang SC", "Microsoft YaHei UI"])

        title = data.get("title", "未命名")
        title_color = QColor("#1d1d1f") if not is_selected else QColor("#007aff")

        # 置顶圆点 - 固定缩进位置，无置顶也保留空间保证左对齐统一
        pin_indent = 11
        if data.get("pinned"):
            painter.setBrush(QBrush(QColor("#ff9500")))
            painter.setPen(Qt.NoPen)
            painter.drawEllipse(QRect(content_x, rect.y() + 6, 5, 5))

        # 标题可用宽度
        max_title_w = content_w - pin_indent - right_space
        painter.setFont(title_font)
        elided_title = painter.fontMetrics().elidedText(title, Qt.ElideRight, max_title_w)

        # 绘制标题
        painter.setFont(title_font)
        painter.setPen(title_color)
        painter.drawText(content_x + pin_indent, rect.y() + 14, elided_title)

        # 绘制语言标签（右对齐固定位置）
        tag_x = content_x + content_w - lang_tag_w - fav_space
        tag_y = rect.y() + 0
        tag_rect = QRect(tag_x, tag_y, lang_tag_w, lang_tag_h)
        painter.setBrush(QBrush(QColor("#dceaff")))
        painter.setPen(Qt.NoPen)
        painter.drawRoundedRect(tag_rect, 6, 6)
        painter.setPen(QColor("#0066d6"))
        painter.setFont(lang_font)
        painter.drawText(tag_rect, Qt.AlignCenter, lang)

        # 收藏星标（最右侧，柔和橙色避免与蓝色冲突，尺寸增大提升视觉重量）
        if has_fav:
            star_cx = content_x + content_w - 4
            star_cy = rect.y() + 9
            self._draw_star(painter, star_cx, star_cy, 6, QColor("#ff9500"))

        # === 第二行：语法高亮代码预览 ===
        content = data.get("content", "")
        preview_line = content.strip().split("\n")[0] if content.strip() else "(empty)"

        lang_for_hl = data.get("language", "text")
        snippet_id = data.get("id", "")

        # 计算预览可用宽度，超出则截断加省略号
        preview_font = QFont("Consolas")
        preview_font.setPixelSize(13)
        painter.setFont(preview_font)
        preview_max_w = content_w - pin_indent - 10
        fm = painter.fontMetrics()
        if fm.horizontalAdvance(preview_line) > preview_max_w:
            # 逐字符截断加省略号
            elided = preview_line
            while elided and fm.horizontalAdvance(elided + "…") > preview_max_w:
                elided = elided[:-1]
            preview_line = elided + "…"

        doc_key = f"{snippet_id}_{preview_line[:50]}"
        if doc_key not in self._doc_cache:
            doc = QTextDocument()
            highlighted = highlight(preview_line, lang_for_hl)
            doc.setHtml(f'<div style="font-family:Consolas,monospace;font-size:13px;color:#6e6e73;">{highlighted}</div>')
            doc.setDocumentMargin(0)
            self._doc_cache[doc_key] = doc
            if len(self._doc_cache) > 50:
                oldest = next(iter(self._doc_cache))
                del self._doc_cache[oldest]

        doc = self._doc_cache[doc_key]

        painter.save()
        painter.translate(content_x + pin_indent, rect.y() + 24)
        clip_w = content_w - pin_indent
        clip_rect = QRect(0, 0, clip_w, 20)
        painter.setClipRect(clip_rect)
        ctx = QAbstractTextDocumentLayout.PaintContext()
        ctx.clip = QRectF(0, 0, clip_w, 20)
        doc.documentLayout().draw(painter, ctx)
        painter.restore()

        # === 底部分隔线 ===
        model = index.model()
        if model and index.row() < model.rowCount() - 1:
            painter.setPen(QPen(QColor(0, 0, 0, 30), 1))
            line_y = option.rect.bottom() - 1
            painter.drawLine(option.rect.x() + 18, line_y, option.rect.right() - 14, line_y)

        painter.restore()

    def _draw_star(self, painter, cx, cy, size, color):
        """绘制小五角星"""
        import math
        painter.setBrush(QBrush(color))
        painter.setPen(Qt.NoPen)
        points = []
        for i in range(10):
            angle = math.pi / 2 + i * math.pi / 5
            r = size if i % 2 == 0 else size * 0.4
            x = cx + r * math.cos(angle)
            y = cy - r * math.sin(angle)
            points.append((x, y))
        poly = QPolygonF([QPointF(x, y) for x, y in points])
        painter.drawPolygon(poly)

    def sizeHint(self, option, index):
        return QSize(348, 64)


# 需要的 Qt 类型
from PySide6.QtCore import QRect, QRectF, QPointF
from PySide6.QtGui import QPolygonF


# ========== 主窗口 ==========
class SnippetPopup(QWidget):
    """代码片段速取弹出窗口"""

    snippet_copied = Signal(str)  # 复制了某片段的内容

    def __init__(self, store, parent=None):
        super().__init__(parent)
        self.store = store
        self.setObjectName("popupRoot")
        self.setWindowFlags(
            Qt.FramelessWindowHint |
            Qt.WindowStaysOnTopHint |
            Qt.Tool |
            Qt.WindowDoesNotAcceptFocus  # 不抢焦点 - 实际上我们需要焦点
        )
        # 修正：需要接受焦点才能输入
        self.setWindowFlags(
            Qt.FramelessWindowHint |
            Qt.WindowStaysOnTopHint |
            Qt.Tool
        )
        self.setAttribute(Qt.WA_TranslucentBackground, False)
        self.setFixedSize(390, 490)
        self._auto_paste = True
        self._hide_timer = QTimer(self)
        self._hide_timer.setSingleShot(True)
        self._hide_timer.timeout.connect(self._do_hide)
        self._current_snippets = []

        self._build_ui()
        self._apply_style()
        self._refresh_list()

    def _build_ui(self):
        layout = QVBoxLayout(self)
        layout.setContentsMargins(10, 10, 10, 6)
        layout.setSpacing(8)

        # 顶部标题栏 - 带柔和背景的独立区域，形成视觉层次
        header_frame = QFrame()
        header_frame.setObjectName("headerFrame")
        header_layout = QHBoxLayout(header_frame)
        header_layout.setContentsMargins(12, 8, 12, 8)
        header_layout.setSpacing(8)
        title = QLabel("代码片段")
        title.setObjectName("titleLabel")
        self.count_label = QLabel("0")
        self.count_label.setObjectName("countLabel")
        self.count_label.setStyleSheet("""
            QLabel {
                background: #007aff;
                color: #ffffff;
                border-radius: 9px;
                padding: 2px 9px;
                font-size: 11px;
                font-weight: 600;
                min-width: 18px;
            }
        """)
        header_layout.addWidget(title)
        header_layout.addWidget(self.count_label)
        header_layout.addStretch()
        layout.addWidget(header_frame)

        # 搜索栏
        self.search_bar = QLineEdit()
        self.search_bar.setObjectName("searchBar")
        self.search_bar.setPlaceholderText("搜索片段...")
        self.search_bar.setClearButtonEnabled(True)
        self.search_bar.textChanged.connect(self._on_search)
        self.search_bar.returnPressed.connect(self._on_enter)
        layout.addWidget(self.search_bar)

        # 片段列表
        self.list_widget = QListWidget()
        self.list_widget.setObjectName("snippetList")
        self.list_widget.setItemDelegate(SnippetDelegate(self.list_widget))
        self.list_widget.setSpacing(2)
        self.list_widget.setUniformItemSizes(True)
        self.list_widget.itemClicked.connect(self._on_item_click)
        self.list_widget.itemDoubleClicked.connect(self._on_item_double_click)
        layout.addWidget(self.list_widget, 1)

        # 底部状态栏
        bottom = QFrame()
        bottom.setObjectName("bottomBar")
        bottom.setFixedHeight(38)
        bottom_layout = QHBoxLayout(bottom)
        bottom_layout.setContentsMargins(14, 0, 14, 0)
        bottom_layout.setSpacing(10)

        hint = QLabel("上下选择    回车复制    Esc隐藏")
        hint.setObjectName("hintLabel")
        hint.setStyleSheet("color: #6e6e73; font-size: 13px; letter-spacing: 0.2px;")
        bottom_layout.addWidget(hint)
        bottom_layout.addStretch()

        # 自动粘贴开关 - 轻量化样式，与其他元素统一
        self.paste_btn = QToolButton()
        self.paste_btn.setText("自动粘贴")
        self.paste_btn.setCheckable(True)
        self.paste_btn.setChecked(True)
        self.paste_btn.setFixedHeight(24)
        self.paste_btn.setCursor(Qt.PointingHandCursor)
        self.paste_btn.clicked.connect(self._toggle_paste)
        self.paste_btn.setStyleSheet("""
            QToolButton {
                background: #eef4ff;
                color: #007aff;
                border: 1px solid #cde0ff;
                border-radius: 7px;
                padding: 4px 14px;
                font-size: 11px;
                font-weight: 500;
            }
            QToolButton:unchecked {
                background: #ffffff;
                color: #86868b;
                border: 1px solid #e5e5ea;
                font-weight: 400;
            }
            QToolButton:hover {
                background: #dceaff;
            }
            QToolButton:unchecked:hover {
                background: #f5f5f7;
            }
        """)
        bottom_layout.addWidget(self.paste_btn)

        layout.addWidget(bottom)

    def _apply_style(self):
        self.setStyleSheet(APPLE_WHITE_QSS)
        # 全局字体
        font = QFont()
        font.setFamilies(["Segoe UI", "PingFang SC", "Microsoft YaHei UI", "Helvetica Neue"])
        font.setPixelSize(13)
        QApplication.instance().setFont(font)

    def _refresh_list(self, query=""):
        self.list_widget.clear()
        snippets = self.store.search(query) if query else self.store.list()
        self._current_snippets = snippets
        self.count_label.setText(str(len(snippets)))

        for s in snippets:
            item = QListWidgetItem()
            item.setData(Qt.UserRole, s)
            item.setData(Qt.UserRole + 1, s.get("id", ""))
            item.setSizeHint(QSize(348, 64))
            self.list_widget.addItem(item)

        if snippets:
            self.list_widget.setCurrentRow(0)

    def _on_search(self, text):
        self._refresh_list(text)

    def _on_item_click(self, item):
        """单击：选中"""
        pass

    def _on_item_double_click(self, item):
        """双击：复制并粘贴"""
        self._copy_and_paste(item)

    def _on_enter(self):
        """回车：复制当前选中项"""
        item = self.list_widget.currentItem()
        if item:
            self._copy_and_paste(item)

    def _copy_and_paste(self, item):
        """复制片段内容到剪贴板，可选自动粘贴"""
        data = item.data(Qt.UserRole)
        if not data:
            return
        content = data.get("content", "")
        if not content:
            return

        # 复制到剪贴板
        clipboard = QApplication.clipboard()
        clipboard.setText(content)

        # 发送信号
        self.snippet_copied.emit(data.get("title", ""))

        # 隐藏窗口
        self.hide()

        # 自动粘贴到前台窗口
        if self._auto_paste:
            QTimer.singleShot(150, self._do_paste)

    def _do_paste(self):
        """延迟粘贴，确保窗口已隐藏"""
        send_ctrl_v()

    def _toggle_paste(self):
        self._auto_paste = self.paste_btn.isChecked()
        self.paste_btn.setText("自动粘贴" if self._auto_paste else "仅复制")

    def keyPressEvent(self, event):
        key = event.key()
        if key == Qt.Key_Escape:
            self.hide()
        elif key == Qt.Key_Up or key == Qt.Key_Down:
            # 让 QListWidget 处理上下导航
            self.list_widget.keyPressEvent(event)
        elif key == Qt.Key_Return or key == Qt.Key_Enter:
            self._on_enter()
        else:
            # 其他按键转发到搜索栏
            if event.text() and not event.modifiers():
                self.search_bar.setFocus()
                self.search_bar.keyPressEvent(event)
            else:
                super().keyPressEvent(event)

    def changeEvent(self, event):
        """失焦自动隐藏"""
        if event.type() == QEvent.ActivationChange:
            if not self.isActiveWindow() and self.isVisible():
                # 延迟隐藏，避免点击列表项时误触
                self._hide_timer.start(200)
        super().changeEvent(event)

    def _do_hide(self):
        """执行隐藏（如果仍然没有焦点）"""
        if not self.isActiveWindow():
            self.hide()

    def show_near_cursor(self):
        """在鼠标附近显示窗口"""
        # 获取鼠标位置
        pos = self.cursor().pos()
        screen = QApplication.screenAt(pos)
        if not screen:
            screen = QApplication.primaryScreen()
        geo = screen.availableGeometry()

        x = pos.x() + 16
        y = pos.y() + 16

        # 确保不超出屏幕
        if x + self.width() > geo.right():
            x = pos.x() - self.width() - 16
        if y + self.height() > geo.bottom():
            y = geo.bottom() - self.height() - 8

        if x < geo.left():
            x = geo.left() + 8
        if y < geo.top():
            y = geo.top() + 8

        self.move(x, y)
        self.show()
        self.raise_()
        self.activateWindow()
        self.search_bar.setFocus()
        self.search_bar.selectAll()

    def toggle_visibility(self):
        """切换窗口可见性"""
        if self.isVisible():
            self.hide()
        else:
            # 记录当前前台窗口（用于粘贴）
            self._show_near_cursor()

    def _show_near_cursor(self):
        self.show_near_cursor()


# ========== 系统托盘图标生成 ==========
def create_tray_icon():
    """用 QPainter 绘制一个简洁的托盘图标"""
    pixmap = QPixmap(64, 64)
    pixmap.fill(Qt.transparent)
    painter = QPainter(pixmap)
    painter.setRenderHint(QPainter.Antialiasing)

    # 背景圆角矩形
    painter.setBrush(QBrush(QColor("#007aff")))
    painter.setPen(Qt.NoPen)
    painter.drawRoundedRect(4, 4, 56, 56, 14, 14)

    # 绘制剪贴板图标
    painter.setBrush(QBrush(QColor("#ffffff")))
    painter.setPen(Qt.NoPen)
    # 主体
    painter.drawRoundedRect(16, 18, 32, 36, 4, 4)
    # 顶部夹子
    painter.drawRoundedRect(24, 12, 16, 10, 3, 3)

    # 代码符号 < >
    painter.setPen(QPen(QColor("#007aff"), 2.5))
    font = QFont()
    font.setPixelSize(14)
    font.setWeight(QFont.Bold)
    font.setFamily("Consolas")
    painter.setFont(font)
    painter.drawText(18, 38, 28, 16, Qt.AlignCenter, "</>")

    painter.end()
    return QIcon(pixmap)


# ========== 主应用 ==========
class SnippetApp(QObject):
    """主应用：管理窗口、托盘、热键"""

    def __init__(self):
        super().__init__()
        self.app = QApplication.instance()

        # 数据存储路径
        data_dir = self._get_data_dir()
        store_path = os.path.join(data_dir, "snippets.json")
        self.store = SnippetStore(store_path)
        self.store.seed_if_empty()

        # 创建主窗口
        self.popup = SnippetPopup(self.store)
        self.popup.snippet_copied.connect(self._on_copied)

        # 系统托盘
        self._create_tray()

        # 全局热键
        self._setup_hotkey()

        # 托盘提示
        self.tray.showMessage(
            "代码片段管家已启动",
            "按 Ctrl+Shift+S 唤起片段速取面板",
            QSystemTrayIcon.Information,
            2000
        )

    def _get_data_dir(self):
        """获取数据目录"""
        # 优先用 %APPDATA%/SnippetManagerPortable
        appdata = os.environ.get("APPDATA", "")
        if appdata:
            d = os.path.join(appdata, "SnippetManagerPortable")
        else:
            d = os.path.join(os.path.expanduser("~"), ".snippet-manager-portable")
        os.makedirs(d, exist_ok=True)
        return d

    def _create_tray(self):
        """创建系统托盘图标"""
        icon = create_tray_icon()
        self.tray = QSystemTrayIcon(icon, self.app)
        self.tray.setToolTip("代码片段管家 · 便携版")

        menu = QMenu()
        menu.setStyleSheet(APPLE_WHITE_QSS)

        action_show = QAction("\U0001F4CB 显示片段面板", menu)
        action_show.setShortcut(QKeySequence("Ctrl+Shift+S"))
        action_show.triggered.connect(self._toggle_popup)
        menu.addAction(action_show)

        menu.addSeparator()

        action_new = QAction("\u2795 新建片段", menu)
        action_new.triggered.connect(self._new_snippet)
        menu.addAction(action_new)

        action_count = QAction(f"\U0001F4CA {self.store.count()} 条片段", menu)
        action_count.setEnabled(False)
        menu.addAction(action_count)

        menu.addSeparator()

        action_quit = QAction("\u274C 退出", menu)
        action_quit.triggered.connect(self._quit)
        menu.addAction(action_quit)

        self.tray.setContextMenu(menu)
        self.tray.activated.connect(self._on_tray_activated)
        self.tray.show()

    def _setup_hotkey(self):
        """注册全局热键 Ctrl+Shift+S"""
        # 注册热键
        modifiers = MOD_CONTROL | MOD_SHIFT
        vk = 0x53  # 'S' 键
        result = user32.RegisterHotKey(None, 0xB001, modifiers | MOD_NOREPEAT, vk)

        if not result:
            # 热键注册失败，尝试用 QShortcut 作为后备
            print("[WARN] 全局热键注册失败，可能被其他程序占用")
        else:
            print("[INFO] 全局热键 Ctrl+Shift+S 注册成功")

        # 安装原生事件过滤器
        self._hotkey_filter = HotkeyEventFilter(self._toggle_popup)
        self.app.installNativeEventFilter(self._hotkey_filter)

    def _toggle_popup(self):
        """切换弹出窗口"""
        if self.popup.isVisible():
            self.popup.hide()
        else:
            self.popup.show_near_cursor()

    def _on_tray_activated(self, reason):
        """托盘点击事件"""
        if reason == QSystemTrayIcon.Trigger:
            # 单击：切换窗口
            self._toggle_popup()

    def _on_copied(self, title):
        """复制成功提示"""
        self.tray.showMessage(
            "已复制到剪贴板",
            f"片段「{title}」已复制" + ("，自动粘贴中..." if self.popup._auto_paste else ""),
            QSystemTrayIcon.Information,
            1500
        )

    def _new_snippet(self):
        """新建片段（简单实现：弹出搜索栏让用户输入）"""
        # 便携版简化：直接显示窗口并聚焦搜索栏
        self.popup.show_near_cursor()
        self.popup.search_bar.setText("")
        self.popup.search_bar.setFocus()

    def _quit(self):
        """退出应用"""
        if hasattr(self, '_hotkey_filter'):
            user32.UnregisterHotKey(None, 0xB001)
        self.tray.hide()
        self.app.quit()


# ========== 截图模式 ==========
SCREENSHOT_MODE = os.environ.get("SM_AUTO_SCREENSHOT", "")


def run_screenshot_mode():
    """截图模式：启动窗口，等待渲染，保存截图后退出"""
    app = QApplication(sys.argv)
    app.setQuitOnLastWindowClosed(True)

    # 不注册全局热键，不创建托盘
    data_dir = os.path.join(os.environ.get("APPDATA", ""), "SnippetManagerPortable")
    os.makedirs(data_dir, exist_ok=True)
    store_path = os.path.join(data_dir, "snippets.json")
    store = SnippetStore(store_path)
    store.seed_if_empty()

    popup = SnippetPopup(store)
    popup._auto_paste = True  # 截图模式显示粘贴开启状态
    popup.paste_btn.setChecked(True)
    popup.show()
    popup.raise_()
    popup.activateWindow()
    popup.search_bar.setFocus()

    # 确保选中第一项
    if popup.list_widget.count() > 0:
        popup.list_widget.setCurrentRow(0)

    # 等待渲染后保存截图
    output_path = SCREENSHOT_MODE

    def capture():
        # 给时间让 QSS 和选中状态渲染完成
        QTimer.singleShot(1200, _do_capture)

    def _do_capture():
        # 处理所有待处理事件确保渲染完成
        app.processEvents()
        # 使用 Qt 自带的 grab 截图（这是窗口自身的渲染，不需要前台，不用 CopyFromScreen）
        pixmap = popup.grab()
        pixmap.save(output_path, "PNG")
        print(f"[screenshot] saved: {output_path} ({pixmap.width()}x{pixmap.height()})")
        app.quit()

    QTimer.singleShot(100, capture)
    app.exec()


def main():
    if SCREENSHOT_MODE:
        run_screenshot_mode()
        return

    # 防止多开
    mutex_name = "Global\\SnippetManagerPortable_Mutex"
    mutex = kernel32.CreateMutexW(None, False, mutex_name)
    if kernel32.GetLastError() == 183:  # ERROR_ALREADY_EXISTS
        print("[INFO] 程序已在运行")
        sys.exit(0)

    app = QApplication(sys.argv)
    app.setQuitOnLastWindowClosed(False)

    snippet_app = SnippetApp()

    sys.exit(app.exec())


if __name__ == "__main__":
    main()
