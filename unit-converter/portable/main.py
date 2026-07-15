# -*- coding: utf-8 -*-
"""单位转换器 · 便携小组件版
像输入法一样的体验：全局热键唤起、失焦自动隐藏、托盘常驻、小界面（≤400×500）。
原生 PySide6 实现，苹果白高端风格。禁止 Electron / 网页套壳。
"""

from __future__ import annotations
import os
import sys
import math
import ctypes
from ctypes import wintypes

from PySide6.QtCore import (
    Qt, QEvent, QPoint, QRect, QSize, QTimer, QAbstractNativeEventFilter,
)
from PySide6.QtGui import (
    QFont, QIcon, QPixmap, QPainter, QColor, QBrush, QPainterPath, QCursor,
    QAction, QKeySequence, QShortcut, QPalette, QPen,
)
from PySide6.QtWidgets import (
    QApplication, QWidget, QLabel, QLineEdit, QComboBox, QPushButton,
    QVBoxLayout, QHBoxLayout, QFrame, QScrollArea, QSizePolicy,
    QSystemTrayIcon, QMenu, QGraphicsDropShadowEffect, QToolButton,
)

import conversions as C

# ---- 常量 ------------------------------------------------------------------
WIN_W, WIN_H = 372, 490
ACCENT = "#007aff"
ACCENT_SOFT = "#e8f1ff"
TEXT_PRIMARY = "#1d1d1f"
TEXT_SECOND = "#86868b"
BG_PAGE = "#00000000"          # 透明，由卡片承载
BG_CARD = "#ffffff"
BG_FILL = "#f5f5f7"
BORDER = "#d2d2d7"
HOTKEY_ID = 9001
WM_HOTKEY = 0x0312
MOD_CONTROL = 0x0002
MOD_SHIFT = 0x0004
MOD_ALT = 0x0001
VK_U = 0x55

# 各类别默认 (from, to) 单位对，选常用组合，结果更直观
DEFAULT_PAIRS = {
    "length": ("m", "cm"),
    "weight": ("kg", "g"),
    "temperature": ("C", "F"),
    "area": ("m2", "ft2"),
    "volume": ("L", "mL"),
    "speed": ("kmh", "mps"),
    "data": ("MB", "KB"),
    "time": ("min", "s"),
    "pressure": ("atm", "kPa"),
    "energy": ("kWh", "J"),
    "power": ("kW", "hp"),
    "angle": ("deg", "rad"),
    "frequency": ("MHz", "Hz"),
    "datarate": ("Mbps", "KBps"),
}


def make_title_icon(size=20):
    """绘制扁平单色「双向转换」图标，与界面风格统一（避免彩色 emoji）。"""
    pm = QPixmap(size, size)
    pm.fill(Qt.transparent)
    p = QPainter(pm)
    p.setRenderHint(QPainter.Antialiasing, True)
    pen = QColor(ACCENT)
    p.setPen(QPen(pen, 1.8))
    p.setBrush(Qt.NoBrush)
    # 上箭头（向右）
    p.drawLine(4, 7, size - 5, 7)
    p.drawLine(size - 5, 7, size - 8, 4)
    p.drawLine(size - 5, 7, size - 8, 10)
    # 下箭头（向左）
    p.drawLine(size - 5, size - 7, 4, size - 7)
    p.drawLine(4, size - 7, 7, size - 10)
    p.drawLine(4, size - 7, 7, size - 4)
    p.end()
    return pm


def resource_path(name: str) -> str:
    """资源路径：PyInstaller onefile 时从 _MEIPASS 取，否则从源码目录取。"""
    if getattr(sys, "frozen", False):
        base = getattr(sys, "_MEIPASS", os.path.dirname(sys.executable))
    else:
        base = os.path.dirname(os.path.abspath(__file__))
    return os.path.join(base, name)


def app_dir() -> str:
    """返回程序所在目录（兼容 PyInstaller onefile 解包目录）"""
    if getattr(sys, "frozen", False):
        return os.path.dirname(sys.executable)
    return os.path.dirname(os.path.abspath(__file__))


def icon_path() -> str:
    return resource_path("icon.ico")


# ---- 全局热键（Win32 RegisterHotKey + Qt 原生事件过滤）------------------------
class HotkeyFilter(QAbstractNativeEventFilter):
    def __init__(self, callback):
        super().__init__()
        self._cb = callback

    def nativeEventFilter(self, eventType, message):
        if eventType == b"windows_generic_MSG":
            try:
                msg = wintypes.MSG.from_address(int(message))
            except Exception:
                return False, 0
            if msg.message == WM_HOTKEY and int(msg.wParam) == HOTKEY_ID:
                self._cb()
                return True, 0
        return False, 0


def register_hotkey() -> bool:
    """注册全局热键，失败则尝试备用组合。"""
    combos = [
        (MOD_CONTROL | MOD_SHIFT, VK_U, "Ctrl+Shift+U"),
        (MOD_ALT | MOD_SHIFT, VK_U, "Alt+Shift+U"),
    ]
    for mod, vk, desc in combos:
        if ctypes.windll.user32.RegisterHotKey(None, HOTKEY_ID, mod, vk):
            return desc
        ctypes.windll.user32.UnregisterHotKey(None, HOTKEY_ID)
    return None


def unregister_hotkey():
    try:
        ctypes.windll.user32.UnregisterHotKey(None, HOTKEY_ID)
    except Exception:
        pass


# ---- 卡片容器（圆角 + 阴影）-------------------------------------------------
class CardFrame(QFrame):
    def __init__(self):
        super().__init__()
        self.setObjectName("card")

    def paintEvent(self, _):
        p = QPainter(self)
        p.setRenderHint(QPainter.Antialiasing, True)
        path = QPainterPath()
        path.addRoundedRect(QRectF_local(self.rect()), 16, 16)
        p.fillPath(path, QColor(BG_CARD))


def QRectF_local(r):
    from PySide6.QtCore import QRectF
    return QRectF(r.x(), r.y(), r.width(), r.height())


# ---- 主窗口 ----------------------------------------------------------------
class ConverterWindow(QWidget):
    def __init__(self):
        super().__init__()
        self._hotkey_desc = ""
        self._building_refs = False
        self._bg = os.environ.get("UNITCONV_NOACTIVATE") == "1"
        self.setWindowFlags(
            Qt.FramelessWindowHint | Qt.Tool | Qt.WindowStaysOnTopHint
        )
        if self._bg:
            # 后台截图模式：纯白实底背景，PrintWindow 捕获干净（透明边距会变黑）
            self.setAttribute(Qt.WA_TranslucentBackground, False)
            self.setAutoFillBackground(True)
            pal = self.palette()
            pal.setColor(QPalette.Window, QColor("#ffffff"))
            self.setPalette(pal)
        else:
            self.setAttribute(Qt.WA_TranslucentBackground, True)
        self.setAttribute(Qt.WA_DeleteOnClose, False)
        self.setFixedSize(WIN_W, WIN_H)
        self.setFocusPolicy(Qt.StrongFocus)

        self._build_ui()
        self._apply_style()
        self._load_categories()
        self._connect_signals()

        # 失焦隐藏计时器
        self._hide_timer = QTimer(self)
        self._hide_timer.setSingleShot(True)
        self._hide_timer.timeout.connect(self._maybe_hide)

        # 托盘
        self._build_tray()

    # ---------- UI 构建 ----------
    def _build_ui(self):
        root = QVBoxLayout(self)
        root.setContentsMargins(14, 14, 14, 14)
        root.setSpacing(0)

        self.card = CardFrame()
        root.addWidget(self.card)

        shadow = QGraphicsDropShadowEffect(self.card)
        shadow.setBlurRadius(28)
        shadow.setColor(QColor(0, 0, 0, 38))
        shadow.setOffset(0, 6)
        self.card.setGraphicsEffect(shadow)

        card_lay = QVBoxLayout(self.card)
        card_lay.setContentsMargins(0, 0, 0, 0)
        card_lay.setSpacing(0)

        # 标题栏
        title_bar = QFrame()
        title_bar.setObjectName("titleBar")
        title_bar.setFixedHeight(44)
        tb = QHBoxLayout(title_bar)
        tb.setContentsMargins(16, 0, 12, 0)
        tb.setSpacing(8)
        icon_lbl = QLabel()
        icon_lbl.setPixmap(make_title_icon(20))
        icon_lbl.setObjectName("titleIcon")
        title = QLabel("单位转换")
        title.setObjectName("titleLabel")
        tb.addWidget(icon_lbl)
        tb.addWidget(title)
        tb.addStretch()
        self.btn_hide = QToolButton()
        self.btn_hide.setObjectName("btnMin")
        self.btn_hide.setText("—")
        self.btn_hide.setFixedSize(28, 28)
        self.btn_close = QToolButton()
        self.btn_close.setObjectName("btnClose")
        self.btn_close.setText("×")
        self.btn_close.setFixedSize(28, 28)
        tb.addWidget(self.btn_hide)
        tb.addWidget(self.btn_close)
        card_lay.addWidget(title_bar)

        # 分隔线
        sep = QFrame()
        sep.setFixedHeight(1)
        sep.setObjectName("sep")
        card_lay.addWidget(sep)

        # 主体
        body = QWidget()
        body.setObjectName("body")
        bl = QVBoxLayout(body)
        bl.setContentsMargins(18, 16, 18, 14)
        bl.setSpacing(10)

        # 类别
        lbl_cat = QLabel("类别")
        lbl_cat.setObjectName("caption")
        bl.addWidget(lbl_cat)
        self.cmb_cat = QComboBox()
        self.cmb_cat.setObjectName("combo")
        bl.addWidget(self.cmb_cat)

        # 输入
        lbl_in = QLabel("输入")
        lbl_in.setObjectName("caption")
        bl.addWidget(lbl_in)
        in_row = QHBoxLayout()
        in_row.setSpacing(8)
        self.edt_input = QLineEdit()
        self.edt_input.setObjectName("input")
        self.edt_input.setPlaceholderText("输入数值…")
        self.cmb_from = QComboBox()
        self.cmb_from.setObjectName("unitCombo")
        self.cmb_from.setSizeAdjustPolicy(QComboBox.AdjustToContents)
        in_row.addWidget(self.edt_input, 1)
        in_row.addWidget(self.cmb_from, 0)
        bl.addLayout(in_row)

        # 交换按钮
        swap_row = QHBoxLayout()
        swap_row.addStretch()
        self.btn_swap = QToolButton()
        self.btn_swap.setObjectName("btnSwap")
        self.btn_swap.setText("⇅")
        self.btn_swap.setFixedSize(44, 34)
        swap_sh = QGraphicsDropShadowEffect(self.btn_swap)
        swap_sh.setBlurRadius(12)
        swap_sh.setColor(QColor(0, 0, 0, 18))
        swap_sh.setOffset(0, 2)
        self.btn_swap.setGraphicsEffect(swap_sh)
        swap_row.addWidget(self.btn_swap)
        swap_row.addStretch()
        bl.addLayout(swap_row)

        # 结果
        lbl_out = QLabel("结果")
        lbl_out.setObjectName("caption")
        bl.addWidget(lbl_out)
        out_row = QHBoxLayout()
        out_row.setSpacing(8)
        self.edt_output = QLineEdit()
        self.edt_output.setObjectName("output")
        self.edt_output.setReadOnly(True)
        self.edt_output.setText("—")
        self.cmb_to = QComboBox()
        self.cmb_to.setObjectName("unitCombo")
        self.cmb_to.setSizeAdjustPolicy(QComboBox.AdjustToContents)
        self.btn_copy = QToolButton()
        self.btn_copy.setObjectName("btnCopy")
        self.btn_copy.setText("复制")
        self.btn_copy.setFixedHeight(38)
        out_row.addWidget(self.edt_output, 1)
        out_row.addWidget(self.cmb_to, 0)
        out_row.addWidget(self.btn_copy, 0)
        bl.addLayout(out_row)

        # 全部单位参考
        ref_sep = QFrame()
        ref_sep.setFixedHeight(1)
        ref_sep.setObjectName("refSep")
        bl.addWidget(ref_sep)
        ref_lbl = QLabel("全部单位参考")
        ref_lbl.setObjectName("caption")
        bl.addWidget(ref_lbl)

        self.scroll = QScrollArea()
        self.scroll.setObjectName("scroll")
        self.scroll.setWidgetResizable(True)
        self.scroll.setFrameShape(QFrame.NoFrame)
        self.scroll.setHorizontalScrollBarPolicy(Qt.ScrollBarAlwaysOff)
        inner = QWidget()
        inner.setObjectName("refInner")
        self.ref_lay = QVBoxLayout(inner)
        self.ref_lay.setContentsMargins(2, 2, 2, 2)
        self.ref_lay.setSpacing(8)
        self.ref_lay.addStretch()
        self.scroll.setWidget(inner)
        bl.addWidget(self.scroll, 1)

        # 底部提示
        self.hint = QLabel("")
        self.hint.setObjectName("hint")
        self.hint.setAlignment(Qt.AlignCenter)
        bl.addWidget(self.hint)

        card_lay.addWidget(body, 1)

    def _apply_style(self):
        self.setStyleSheet("""
        #card { background: transparent; }
        #titleBar { background: transparent; }
        #titleLabel {
            color: #1d1d1f; font-size: 14px; font-weight: 600;
            font-family: "Microsoft YaHei UI", "PingFang SC", "Segoe UI", sans-serif;
        }
        #titleIcon { font-size: 15px; }
        #btnMin, #btnClose {
            border: none; border-radius: 6px;
            color: #86868b; font-size: 15px; font-weight: 600;
            background: transparent;
        }
        #btnMin:hover { background: #eaeaec; color: #1d1d1f; }
        #btnClose:hover { background: #ff3b30; color: #ffffff; }
        #sep { background: #e5e5ea; }
        #body { background: transparent; }
        #caption {
            color: #86868b; font-size: 11px; font-weight: 600;
            font-family: "Microsoft YaHei UI", "Segoe UI", sans-serif;
            padding-left: 2px;
        }
        #combo, #unitCombo {
            background: #f5f5f7; border: 1px solid #e5e5ea; border-radius: 10px;
            padding: 9px 30px 9px 12px; min-height: 20px;
            color: #1d1d1f; font-size: 13px;
            font-family: "Microsoft YaHei UI", "Segoe UI", sans-serif;
        }
        #combo:hover, #unitCombo:hover { border-color: #c7c7cc; }
        #combo::drop-down, #unitCombo::drop-down {
            border: none; width: 26px;
        }
        #combo::down-arrow, #unitCombo::down-arrow {
            image: none; width: 0; height: 0;
            border-left: 4px solid transparent;
            border-right: 4px solid transparent;
            border-top: 5px solid #86868b;
            margin-right: 10px;
        }
        QComboBox QAbstractItemView {
            background: #ffffff; border: 1px solid #e5e5ea; border-radius: 8px;
            selection-background-color: #007aff; selection-color: #ffffff;
            outline: none; padding: 4px;
        }
        #input, #output {
            background: #f5f5f7; border: 1px solid #e5e5ea; border-radius: 10px;
            padding: 9px 12px; min-height: 20px; color: #1d1d1f; font-size: 15px;
            font-family: "Microsoft YaHei UI", "Segoe UI", sans-serif;
            selection-background-color: #007aff; selection-color: #ffffff;
        }
        #input:focus { border: 2px solid #007aff; background: #ffffff; padding: 8px 11px; }
        #output { color: #1d1d1f; font-weight: 600; }
        #btnSwap {
            border: 1px solid #e5e5ea; border-radius: 10px; background: #ffffff;
            color: #007aff; font-size: 17px; font-weight: 700;
        }
        #btnSwap:hover { background: #f5f5f7; border-color: #d1d1d6; }
        #btnSwap:pressed { background: #e8f1ff; }
        #btnCopy {
            border: 1px solid #007aff; border-radius: 10px; background: #ffffff;
            color: #007aff; font-size: 12px; font-weight: 600;
            padding: 0 14px;
            font-family: "Microsoft YaHei UI", "Segoe UI", sans-serif;
        }
        #btnCopy:hover { background: #f0f6ff; }
        #btnCopy:pressed { background: #e0efff; }
        #scroll { background: #fbfbfd; border: 1px solid #f0f0f2; border-radius: 10px; }
        #refSep { background: #ececef; }
        #refInner { background: transparent; }
        #hint {
            color: #6e6e73; font-size: 11px;
            font-family: "Microsoft YaHei UI", "Segoe UI", sans-serif;
            border-top: 1px solid #f0f0f2; padding: 7px 0 0 0; margin-top: 6px;
        }
        QScrollBar:vertical {
            background: transparent; width: 6px; margin: 8px 2px;
        }
        QScrollBar::handle:vertical {
            background: #e3e3e8; border-radius: 3px; min-height: 30px;
        }
        QScrollBar::handle:vertical:hover { background: #cfcfd4; }
        QScrollBar::add-line, QScrollBar::sub-line { height: 0; }
        """)

    def _load_categories(self):
        self.cmb_cat.blockSignals(True)
        self.cmb_cat.clear()
        for key, icon, name in C.category_list():
            self.cmb_cat.addItem(name, key)
        self.cmb_cat.blockSignals(False)
        self._on_category_changed(0)

    def _connect_signals(self):
        self.cmb_cat.currentIndexChanged.connect(self._on_category_changed)
        self.cmb_from.currentIndexChanged.connect(self._recompute)
        self.cmb_to.currentIndexChanged.connect(self._recompute)
        self.edt_input.textChanged.connect(self._recompute)
        self.btn_swap.clicked.connect(self._swap)
        self.btn_copy.clicked.connect(self._copy_result)
        self.btn_hide.clicked.connect(self.hide)
        self.btn_close.clicked.connect(self.hide)
        # Enter 复制
        QShortcut(QKeySequence(Qt.Key_Return), self, activated=self._copy_result)
        QShortcut(QKeySequence(Qt.Key_Enter), self, activated=self._copy_result)

    # ---------- 业务逻辑 ----------
    def _current_category(self):
        return self.cmb_cat.currentData()

    def _on_category_changed(self, _idx):
        cat = self._current_category()
        units = C.CATEGORIES[cat]["units"]
        self.cmb_from.blockSignals(True)
        self.cmb_to.blockSignals(True)
        self.cmb_from.clear()
        self.cmb_to.clear()
        keys = list(units.keys())
        for k in keys:
            self.cmb_from.addItem(units[k][0], k)
            self.cmb_to.addItem(units[k][0], k)
        # 默认选择常用单位对（结果更直观）
        pair = DEFAULT_PAIRS.get(cat, (keys[0], keys[1] if len(keys) > 1 else keys[0]))
        fi = keys.index(pair[0]) if pair[0] in keys else 0
        ti = keys.index(pair[1]) if pair[1] in keys else (1 if len(keys) > 1 else 0)
        if fi == ti:
            ti = (fi + 1) % len(keys)
        self.cmb_from.setCurrentIndex(fi)
        self.cmb_to.setCurrentIndex(ti)
        self.cmb_from.blockSignals(False)
        self.cmb_to.blockSignals(False)
        self._recompute()

    def _parse_value(self):
        t = self.edt_input.text().strip()
        if t == "":
            return None
        t = t.replace(",", "")
        try:
            return float(t)
        except ValueError:
            return None

    def _recompute(self):
        cat = self._current_category()
        fu = self.cmb_from.currentData()
        tu = self.cmb_to.currentData()
        val = self._parse_value()
        if val is None:
            self.edt_output.setText("—")
            self._build_refs(cat, fu, None)
            return
        try:
            res = C.convert(cat, val, fu, tu)
            self.edt_output.setText(C.format_number(res))
        except Exception:
            self.edt_output.setText("—")
        self._build_refs(cat, fu, val)

    def _build_refs(self, cat, fu, val):
        # 清空旧的
        self._building_refs = True
        while self.ref_lay.count() > 1:
            it = self.ref_lay.takeAt(0)
            w = it.widget()
            if w:
                w.deleteLater()
        units = C.CATEGORIES[cat]["units"]
        for k, (name, *_) in units.items():
            row = QFrame()
            row.setObjectName("refRow")
            row.setMinimumHeight(32)
            lay = QHBoxLayout(row)
            lay.setContentsMargins(10, 6, 10, 6)
            lay.setSpacing(8)
            n_lbl = QLabel(name)
            n_lbl.setObjectName("refName")
            n_lbl.setMinimumWidth(96)
            v_lbl = QLabel("—" if val is None else C.format_number(
                C.convert(cat, val, fu, k)))
            v_lbl.setObjectName("refVal")
            v_lbl.setAlignment(Qt.AlignRight | Qt.AlignVCenter)
            if k == fu:
                n_lbl.setStyleSheet("color: #007aff; font-weight: 600;")
                v_lbl.setStyleSheet("color: #007aff; font-weight: 600;")
            lay.addWidget(n_lbl)
            lay.addStretch()
            lay.addWidget(v_lbl)
            self.ref_lay.insertWidget(self.ref_lay.count() - 1, row)
        self._building_refs = False
        # 动态应用 ref 行样式
        for i in range(self.ref_lay.count() - 1):
            w = self.ref_lay.itemAt(i).widget()
            if w:
                base = w.styleSheet()
                if "refRow" not in base:
                    w.setStyleSheet(base + """
                    #refRow { background: transparent; border-radius: 6px; min-height: 30px; }
                    #refRow:hover { background: #f5f5f7; }
                    #refName { color: #1d1d1f; font-size: 12px;
                        font-family: "Microsoft YaHei UI","Segoe UI",sans-serif; }
                    #refVal { color: #1d1d1f; font-size: 12px;
                        font-family: "Microsoft YaHei UI","Segoe UI",sans-serif; }
                    """)

    def _swap(self):
        fi = self.cmb_from.currentIndex()
        self.cmb_from.setCurrentIndex(self.cmb_to.currentIndex())
        self.cmb_to.setCurrentIndex(fi)

    def _copy_result(self):
        txt = self.edt_output.text()
        if txt and txt != "—":
            QApplication.clipboard().setText(txt)
            old = self.btn_copy.text()
            self.btn_copy.setText("已复制")
            QTimer.singleShot(900, lambda: self.btn_copy.setText(old))

    # ---------- 显示 / 隐藏 ----------
    def show_near_cursor(self):
        # 靠近鼠标，约束在屏幕内
        cursor = QCursor.pos()
        screen = QApplication.screenAt(cursor)
        if screen is None:
            screen = QApplication.primaryScreen()
        sg = screen.availableGeometry()
        x = cursor.x() + 16
        y = cursor.y() + 16
        if x + WIN_W > sg.right():
            x = cursor.x() - WIN_W - 16
        if y + WIN_H > sg.bottom():
            y = cursor.y() - WIN_H - 16
        x = max(sg.left(), min(x, sg.right() - WIN_W))
        y = max(sg.top(), min(y, sg.bottom() - WIN_H))
        self.move(x, y)

    def toggle_visibility(self):
        if self.isVisible() and self.isActiveWindow():
            self.hide()
        else:
            self.show_near_cursor()
            self.show()
            self.raise_()
            self.activateWindow()
            self.edt_input.setFocus()
            self.edt_input.selectAll()

    # ---------- 失焦自动隐藏 ----------
    def changeEvent(self, event):
        if event.type() == QEvent.Type.ActivationChange:
            if not self.isActiveWindow():
                self._hide_timer.start(220)
        super().changeEvent(event)

    def _maybe_hide(self):
        if not self.isActiveWindow() and QApplication.activePopupWidget() is None:
            self.hide()

    def closeEvent(self, event):
        # 关闭即最小化到托盘
        event.ignore()
        self.hide()

    # ---------- 托盘 ----------
    def _build_tray(self):
        self.tray = QSystemTrayIcon(self)
        if os.path.exists(icon_path()):
            self.tray.setIcon(QIcon(icon_path()))
        else:
            # 临时用像素图标
            pm = QPixmap(32, 32)
            pm.fill(Qt.transparent)
            p = QPainter(pm)
            p.setRenderHint(QPainter.Antialiasing)
            p.setBrush(QColor(ACCENT))
            p.setPen(Qt.NoPen)
            p.drawRoundedRect(0, 0, 32, 32, 8, 8)
            p.setPen(QColor("#ffffff"))
            f = QFont("Microsoft YaHei UI", 13, QFont.Bold)
            p.setFont(f)
            p.drawText(pm.rect(), Qt.AlignCenter, "换")
            p.end()
            self.tray.setIcon(QIcon(pm))
        self.tray.setToolTip("单位转换 · 便携版")
        menu = QMenu()
        act_show = QAction("显示 / 隐藏", menu)
        act_show.triggered.connect(self.toggle_visibility)
        act_quit = QAction("退出", menu)
        act_quit.triggered.connect(self._quit)
        menu.addAction(act_show)
        menu.addSeparator()
        menu.addAction(act_quit)
        self.tray.setContextMenu(menu)
        self.tray.activated.connect(self._on_tray_activated)
        self.tray.show()

    def _on_tray_activated(self, reason):
        if reason in (QSystemTrayIcon.Trigger, QSystemTrayIcon.DoubleClick):
            self.toggle_visibility()

    def _quit(self):
        unregister_hotkey()
        self.tray.hide()
        QApplication.quit()

    def set_hotkey_desc(self, desc):
        self._hotkey_desc = desc or ""
        if self._hotkey_desc:
            self.hint.setText("%s 唤起  ·  失焦自动隐藏" % self._hotkey_desc)
        else:
            self.hint.setText("失焦自动隐藏  ·  托盘常驻")


# ---- 程序入口 --------------------------------------------------------------
def main():
    # 高 DPI 适配
    QApplication.setHighDpiScaleFactorRoundingPolicy(
        Qt.HighDpiScaleFactorRoundingPolicy.PassThrough
    )
    app = QApplication(sys.argv)
    app.setQuitOnLastWindowClosed(False)
    app.setApplicationName("单位转换便携版")

    win = ConverterWindow()

    # 注册全局热键
    desc = register_hotkey()
    win.set_hotkey_desc(desc or "（热键注册失败，请用托盘）")
    if desc:
        hk = HotkeyFilter(win.toggle_visibility)
        app.installNativeEventFilter(hk)

    # 后台无激活模式：用于 PrintWindow 截图，不抢焦点不打扰用户
    bg = os.environ.get("UNITCONV_NOACTIVATE") == "1"
    if bg:
        # 固定到主屏左上角偏移处渲染，便于后台截取
        sg = QApplication.primaryScreen().geometry()
        win.move(sg.left() + 40, sg.top() + 40)
        win.show()
        win.edt_input.setText("1")
        # 切到长度类，米->厘米，呈现有内容的画面
        win.cmb_cat.setCurrentIndex(0)
    else:
        # 启动即显示一次，让用户感知
        win.show_near_cursor()
        win.show()
        win.raise_()
        win.activateWindow()
        win.edt_input.setFocus()
        win.edt_input.setText("1")

    code = app.exec()
    unregister_hotkey()
    sys.exit(code)


if __name__ == "__main__":
    main()
