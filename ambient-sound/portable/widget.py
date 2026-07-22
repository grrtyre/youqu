# -*- coding: utf-8 -*-
"""widget.py - PySide6 无边框苹果白小组件界面

像输入法一样的体验：需要时出现，不需要时隐藏。
无边框圆角窗口、系统托盘常驻、失焦自动隐藏、全局热键唤起。
"""
import os
import sys
import time
from PySide6.QtCore import Qt, QTimer, QRect, QPoint, QSize, QPropertyAnimation, Property
from PySide6.QtGui import (
    QPainter, QColor, QPixmap, QIcon, QPainterPath, QFont, QPen, QBrush,
    QLinearGradient
)
from PySide6.QtWidgets import (
    QApplication, QWidget, QLabel, QPushButton, QSlider, QFrame,
    QVBoxLayout, QHBoxLayout, QGridLayout, QToolButton, QGraphicsDropShadowEffect,
    QButtonGroup, QSizePolicy
)

import synth
import store

# 音频图标 SVG（统一线性描边风格）
SOUND_ICONS = {
    "white": '<svg viewBox="0 0 24 24" fill="none" stroke="#86868b" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="2.5"/><circle cx="12" cy="12" r="6.5"/><circle cx="12" cy="12" r="10.5"/></svg>',
    "pink": '<svg viewBox="0 0 24 24" fill="none" stroke="#86868b" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 18 0"/><path d="M3 12a9 9 0 0 0 9 9" stroke-dasharray="2 2.5"/></svg>',
    "brown": '<svg viewBox="0 0 24 24" fill="none" stroke="#86868b" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 14c1.5-3 3-3 4.5 0s3 3 4.5 0 3-3 4.5 0 3 3 4.5 0"/></svg>',
    "rain": '<svg viewBox="0 0 24 24" fill="none" stroke="#86868b" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M7 14a4 4 0 0 1 .5-7.97 5 5 0 0 1 9.4 1.4A3.5 3.5 0 0 1 16.5 14"/><path d="M9 17l-1 3.5M13 17l-1 3.5M16 17l-1 3.5"/></svg>',
    "waves": '<svg viewBox="0 0 24 24" fill="none" stroke="#86868b" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M2 8c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/><path d="M2 14c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/><path d="M2 20c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/></svg>',
    "wind": '<svg viewBox="0 0 24 24" fill="none" stroke="#86868b" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8h11a2.5 2.5 0 1 0-2.5-2.5"/><path d="M3 14h15a2.5 2.5 0 1 1-2.5 2.5"/><path d="M3 20h8"/></svg>',
    "fire": '<svg viewBox="0 0 24 24" fill="none" stroke="#86868b" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3c.6 2.4 2.8 3.8 2.8 7.2 0 1.4-.6 2.6-1.6 3.3.3-1.4-.2-2.8-1.2-3.6-.2 1.6-1 2.4-1.6 3-.4-1.2-.1-2.4.4-3.4-1.2.6-2 2-2 3.6 0 .3 0 .6.1.9-1.2-.7-2-2-2-3.6 0-3.4 2.3-5 3.1-7.4z"/><path d="M7 19h10"/><path d="M9 19l-1 2M15 19l1 2"/></svg>',
    "stream": '<svg viewBox="0 0 24 24" fill="none" stroke="#86868b" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3c2 2.8 4.5 5.2 4.5 8.5"/><path d="M12 3c-2 2.8-4.5 5.2-4.5 8.5"/><path d="M7 14c1.5 1.5 3.5 1.5 5 0s3.5-1.5 5 0"/><path d="M7 18c1.5 1.5 3.5 1.5 5 0s3.5-1.5 5 0"/></svg>',
}

# 激活态图标（白色）
SOUND_ICONS_ACTIVE = {
    k: v.replace('stroke="#86868b"', 'stroke="#ffffff"')
    for k, v in SOUND_ICONS.items()
}


def svg_to_pixmap(svg_str, size=36):
    """将 SVG 字符串转为 QPixmap"""
    from PySide6.QtSvg import QSvgRenderer
    from PySide6.QtGui import QImage
    renderer = QSvgRenderer(svg_str.encode("utf-8"))
    image = QImage(size, size, QImage.Format_ARGB32)
    image.fill(Qt.transparent)
    painter = QPainter(image)
    renderer.render(painter)
    painter.end()
    return QPixmap.fromImage(image)


class SoundCard(QFrame):
    """单个声音卡片：图标 + 名称 + 音量滑块"""

    def __init__(self, sound_info, engine, on_toggle=None, parent=None):
        super().__init__(parent)
        self.sound_id = sound_info["id"]
        self.name = sound_info["name"]
        self.desc = sound_info["desc"]
        self.engine = engine
        self.on_toggle = on_toggle
        self.active = False

        self.setObjectName("soundCard")
        self.setFixedHeight(78)
        self._build_ui()

    def _build_ui(self):
        layout = QHBoxLayout(self)
        layout.setContentsMargins(10, 10, 10, 10)
        layout.setSpacing(10)

        # 图标
        self.icon_label = QLabel()
        self.icon_label.setFixedSize(36, 36)
        self.icon_label.setAlignment(Qt.AlignCenter)
        self.icon_label.setObjectName("soundIcon")
        self._icon_normal = svg_to_pixmap(SOUND_ICONS[self.sound_id], 22)
        self._icon_active = svg_to_pixmap(SOUND_ICONS_ACTIVE[self.sound_id], 22)
        self.icon_label.setPixmap(self._icon_normal)
        layout.addWidget(self.icon_label, 0, Qt.AlignVCenter)

        # 文字 + 滑块
        right = QVBoxLayout()
        right.setSpacing(3)

        name_row = QHBoxLayout()
        name_row.setSpacing(6)
        self.name_label = QLabel(self.name)
        self.name_label.setObjectName("soundName")
        name_row.addWidget(self.name_label)
        name_row.addStretch()

        # 播放/停止切换按钮
        self.toggle_btn = QPushButton()
        self.toggle_btn.setFixedSize(22, 22)
        self.toggle_btn.setCursor(Qt.PointingHandCursor)
        self.toggle_btn.setStyleSheet("""
            QPushButton {
                background: #eef4ff;
                border: 1px solid #d1e3ff;
                border-radius: 11px;
                font-size: 9px;
                color: #007aff;
            }
            QPushButton:hover {
                background: #007aff;
                border: 1px solid #007aff;
                color: #ffffff;
            }
        """)
        self.toggle_btn.setText("▶")
        self.toggle_btn.clicked.connect(self._on_toggle)
        name_row.addWidget(self.toggle_btn)

        right.addLayout(name_row)

        # 音量滑块
        self.slider = QSlider(Qt.Horizontal)
        self.slider.setRange(0, 100)
        self.slider.setValue(int(store.get_volumes().get(self.sound_id, 0.6) * 100))
        self.slider.valueChanged.connect(self._on_volume)
        right.addWidget(self.slider)

        layout.addLayout(right, 1)

    def _on_toggle(self):
        self.active = not self.active
        if self.active:
            self.engine.play(self.sound_id)
            self.toggle_btn.setText("■")
            self.icon_label.setPixmap(self._icon_active)
            self.icon_label.setObjectName("soundIconActive")
            self.setObjectName("soundCardActive")
        else:
            self.engine.stop(self.sound_id)
            self.toggle_btn.setText("▶")
            self.icon_label.setPixmap(self._icon_normal)
            self.icon_label.setObjectName("soundIcon")
            self.setObjectName("soundCard")
        # 触发样式刷新
        self.style().unpolish(self)
        self.style().polish(self)
        self.icon_label.style().unpolish(self.icon_label)
        self.icon_label.style().polish(self.icon_label)
        if self.on_toggle:
            self.on_toggle()

    def _on_volume(self, val):
        self.engine.set_volume(self.sound_id, val / 100.0)

    def set_active(self, on):
        if on and not self.active:
            self._on_toggle()
        elif not on and self.active:
            self._on_toggle()


class AmbientWidget(QWidget):
    """环境音便携版主界面 —— 无边框圆角小组件"""

    WIDTH = 380
    HEIGHT = 480

    def __init__(self, engine, tray=None):
        super().__init__()
        self.engine = engine
        self.tray = tray
        self.timer_end = None
        self.timer_duration = 0
        self.timer_active_preset = -1
        self._drag_pos = None
        self._auto_hide = True  # 失焦自动隐藏开关（演示模式关闭）

        self.setWindowFlags(
            Qt.FramelessWindowHint | Qt.Window | Qt.Tool
        )
        self.setAttribute(Qt.WA_TranslucentBackground, True)
        self.setFixedSize(self.WIDTH, self.HEIGHT)

        self._build_ui()
        self._apply_shadow()
        self._init_timer()

    def _build_ui(self):
        # 根容器（白色圆角背景）
        self.root = QFrame(self)
        self.root.setObjectName("root")
        self.root.setGeometry(0, 0, self.WIDTH, self.HEIGHT)
        # 不在 root 上设置独立 stylesheet，让全局 APPLE_WHITE_QSS（设在 self.widget 上）级联生效

        main_layout = QVBoxLayout(self.root)
        main_layout.setContentsMargins(0, 0, 0, 0)
        main_layout.setSpacing(2)

        # 1. 标题栏
        title_bar = self._build_title_bar()
        main_layout.addWidget(title_bar)

        # 2. 问候语
        greeting = QLabel(self._greeting_text())
        greeting.setObjectName("greetingLabel")
        greeting.setContentsMargins(14, 4, 14, 6)
        main_layout.addWidget(greeting)

        # 3. 声音卡片网格
        cards_container = QWidget()
        cards_layout = QVBoxLayout(cards_container)
        cards_layout.setContentsMargins(12, 2, 12, 4)
        cards_layout.setSpacing(8)

        self.cards = {}
        grid = QGridLayout()
        grid.setSpacing(8)
        # 设置两列等宽，避免左右卡片宽度不一致
        grid.setColumnStretch(0, 1)
        grid.setColumnStretch(1, 1)
        for i, s in enumerate(synth.SOUNDS):
            card = SoundCard(s, self.engine, on_toggle=self._update_status)
            self.cards[s["id"]] = card
            row = i // 2
            col = i % 2
            grid.addWidget(card, row, col)
        cards_layout.addLayout(grid)
        main_layout.addWidget(cards_container, 1)

        # 4. 预设按钮
        preset_row = self._build_presets()
        main_layout.addLayout(preset_row)

        # 5. 底部控制区
        footer = self._build_footer()
        main_layout.addWidget(footer)

    def _build_title_bar(self):
        bar = QFrame()
        bar.setObjectName("titleBar")
        bar.setFixedHeight(40)
        bar_layout = QHBoxLayout(bar)
        bar_layout.setContentsMargins(14, 8, 10, 4)

        # 蓝色声波小图标
        icon_label = QLabel()
        icon_label.setFixedSize(22, 22)
        icon_label.setAlignment(Qt.AlignCenter)
        icon_svg = '<svg viewBox="0 0 24 24" fill="none" stroke="#007aff" stroke-width="2" stroke-linecap="round"><path d="M3 12c3-6 6-6 9 0s6 6 9 0"/><path d="M3 8c3-6 6-6 9 0s6 6 9 0"/></svg>'
        icon_label.setPixmap(svg_to_pixmap(icon_svg, 20))
        bar_layout.addWidget(icon_label)

        title = QLabel("环境音")
        title.setObjectName("titleLabel")
        bar_layout.addWidget(title)
        bar_layout.addStretch()

        # 正在播放徽章
        self.badge = QLabel("0")
        self.badge.setFixedSize(20, 20)
        self.badge.setAlignment(Qt.AlignCenter)
        self.badge.setStyleSheet("""
            QLabel {
                background: #e5e5ea;
                border-radius: 10px;
                font-size: 10px;
                color: #86868b;
                font-weight: 600;
            }
        """)
        bar_layout.addWidget(self.badge)

        close_btn = QPushButton("×")
        close_btn.setObjectName("closeBtn")
        close_btn.setCursor(Qt.PointingHandCursor)
        close_btn.clicked.connect(self._hide_to_tray)
        bar_layout.addWidget(close_btn)

        return bar

    def _build_presets(self):
        layout = QHBoxLayout()
        layout.setContentsMargins(14, 6, 14, 6)
        layout.setSpacing(5)

        label = QLabel("预设")
        label.setObjectName("masterLabel")
        layout.addWidget(label)

        self.preset_btns = []
        for i, preset in enumerate(store.DEFAULT_PRESETS):
            btn = QPushButton(preset["name"])
            btn.setObjectName("presetBtn")
            btn.setCursor(Qt.PointingHandCursor)
            btn.clicked.connect(lambda checked, idx=i: self._apply_preset(idx))
            self.preset_btns.append(btn)
            layout.addWidget(btn)

        layout.addStretch()
        return layout

    def _build_footer(self):
        footer = QFrame()
        footer.setObjectName("footer")
        footer.setFixedHeight(92)
        layout = QVBoxLayout(footer)
        layout.setContentsMargins(14, 8, 14, 10)
        layout.setSpacing(6)

        # 主音量行
        vol_row = QHBoxLayout()
        vol_row.setSpacing(8)
        vol_label = QLabel("主音量")
        vol_label.setObjectName("masterLabel")
        vol_label.setFixedWidth(40)
        vol_row.addWidget(vol_label)

        self.master_slider = QSlider(Qt.Horizontal)
        self.master_slider.setRange(0, 100)
        self.master_slider.setValue(int(store.get_master() * 100))
        self.master_slider.valueChanged.connect(
            lambda v: self.engine.set_master(v / 100.0))
        vol_row.addWidget(self.master_slider, 1)
        layout.addLayout(vol_row)

        # 定时器 + 状态行
        bottom_row = QHBoxLayout()
        bottom_row.setSpacing(6)

        timer_label = QLabel("定时")
        timer_label.setObjectName("masterLabel")
        bottom_row.addWidget(timer_label)

        self.timer_btns = []
        for label, mins in [("15", 15), ("30", 30), ("60", 60), ("90", 90)]:
            btn = QPushButton(f"{label}分")
            btn.setObjectName("timerBtn")
            btn.setCursor(Qt.PointingHandCursor)
            btn.setFixedHeight(24)
            btn.clicked.connect(lambda checked, m=mins, b=btn: self._set_timer(m, b))
            self.timer_btns.append((btn, mins))
            bottom_row.addWidget(btn)

        bottom_row.addStretch()

        # 全部停止按钮（蓝色填充主操作按钮）
        stop_all = QPushButton("全部停止")
        stop_all.setCursor(Qt.PointingHandCursor)
        stop_all.setFixedHeight(24)
        stop_all.setStyleSheet("""
            QPushButton {
                background: #007aff;
                border: none;
                border-radius: 12px;
                padding: 2px 12px;
                font-size: 11px;
                color: #ffffff;
                font-weight: 500;
            }
            QPushButton:hover {
                background: #0066d6;
            }
        """)
        stop_all.clicked.connect(self._stop_all)
        bottom_row.addWidget(stop_all)

        layout.addLayout(bottom_row)

        # 状态栏
        self.status_label = QLabel("就绪 · 按 Ctrl+Shift+A 唤起")
        self.status_label.setObjectName("statusLabel")
        layout.addWidget(self.status_label)

        return footer

    def _apply_shadow(self):
        shadow = QGraphicsDropShadowEffect(self.root)
        shadow.setBlurRadius(30)
        shadow.setColor(QColor(0, 0, 0, 40))
        shadow.setOffset(0, 4)
        self.root.setGraphicsEffect(shadow)

    def _greeting_text(self):
        h = time.localtime().tm_hour
        if 5 <= h < 11:
            return "早安 · 开启专注的一天"
        elif 11 <= h < 14:
            return "午安 · 短暂休憩"
        elif 14 <= h < 18:
            return "下午好 · 保持专注"
        elif 18 <= h < 23:
            return "晚安 · 放松身心"
        else:
            return "深夜 · 助眠模式"

    # ---- 交互 ----

    def _hide_to_tray(self):
        self.hide()
        if self.tray:
            self.tray.showMessage("环境音便携版", "已隐藏到托盘，按 Ctrl+Shift+A 唤起")

    def _apply_preset(self, idx):
        preset = store.DEFAULT_PRESETS[idx]
        # 先停止所有
        self._stop_all()
        # 应用预设
        for sid, vol in preset["sounds"].items():
            card = self.cards.get(sid)
            if card:
                card.slider.setValue(int(vol * 100))
                self.engine.set_volume(sid, vol)
                if not card.active:
                    card._on_toggle()
        self.timer_active_preset = idx
        self._refresh_preset_styles()
        self._update_status()

    def _refresh_preset_styles(self):
        for i, btn in enumerate(self.preset_btns):
            if i == self.timer_active_preset:
                btn.setObjectName("presetBtnChecked")
            else:
                btn.setObjectName("presetBtn")
            btn.style().unpolish(btn)
            btn.style().polish(btn)

    def _set_timer(self, minutes, btn):
        # 取消之前的定时器
        self.timer_end = None
        for b, _ in self.timer_btns:
            b.setObjectName("timerBtn")
            b.style().unpolish(b)
            b.style().polish(b)
        btn.setObjectName("timerBtnChecked")
        btn.style().unpolish(btn)
        btn.style().polish(btn)

        import datetime
        self.timer_end = time.time() + minutes * 60
        self.timer_duration = minutes * 60
        self._update_status()

    def _stop_all(self):
        for card in self.cards.values():
            if card.active:
                card._on_toggle()
        self.timer_active_preset = -1
        self._refresh_preset_styles()

    def _update_status(self):
        count = self.engine.active_count()
        self.badge.setText(str(count))
        if count > 0:
            active = self.engine.active_ids()
            names = "、".join(
                next((s["name"] for s in synth.SOUNDS if s["id"] == sid), sid)
                for sid in active
            )
            self.status_label.setText(f"播放中 · {names}")
            self.status_label.setObjectName("statusPlaying")
            self.badge.setStyleSheet("""
                QLabel {
                    background: #007aff;
                    border-radius: 10px;
                    font-size: 10px;
                    color: #ffffff;
                    font-weight: 600;
                }
            """)
        else:
            self.status_label.setText("就绪 · 按 Ctrl+Shift+A 唤起")
            self.status_label.setObjectName("statusLabel")
            self.badge.setStyleSheet("""
                QLabel {
                    background: #e5e5ea;
                    border-radius: 10px;
                    font-size: 10px;
                    color: #86868b;
                    font-weight: 600;
                }
            """)
        self.status_label.style().unpolish(self.status_label)
        self.status_label.style().polish(self.status_label)

    def _init_timer(self):
        self._timer = QTimer(self)
        self._timer.timeout.connect(self._tick)
        self._timer.start(1000)

    def _tick(self):
        # 定时器检查
        if self.timer_end and time.time() >= self.timer_end:
            self._stop_all()
            self.timer_end = None
            for b, _ in self.timer_btns:
                b.setObjectName("timerBtn")
                b.style().unpolish(b)
                b.style().polish(b)
            if self.tray:
                self.tray.showMessage("环境音便携版", "定时结束，已停止播放")

    # ---- 窗口拖动 ----

    def mousePressEvent(self, event):
        if event.button() == Qt.LeftButton:
            self._drag_pos = event.globalPosition().toPoint() - self.pos()
            event.accept()

    def mouseMoveEvent(self, event):
        if self._drag_pos and event.buttons() & Qt.LeftButton:
            self.move(event.globalPosition().toPoint() - self._drag_pos)
            event.accept()

    def mouseReleaseEvent(self, event):
        self._drag_pos = None

    # ---- 失焦自动隐藏 ----

    def changeEvent(self, event):
        super().changeEvent(event)
        if event.type() == event.Type.ActivationChange:
            if not self.isActiveWindow() and self.isVisible() and self._auto_hide:
                QTimer.singleShot(200, self._check_hide)

    def _check_hide(self):
        if not self.isActiveWindow():
            self.hide()

    # ---- 演示模式 ----

    def set_demo_mode(self, demo_ids=None):
        """演示模式：激活指定卡片但不真正播放（用于截图）"""
        if demo_ids is None:
            demo_ids = ["rain", "fire", "waves"]
        for sid in demo_ids:
            card = self.cards.get(sid)
            if card:
                card.active = True
                card.toggle_btn.setText("■")
                card.icon_label.setPixmap(card._icon_active)
                card.icon_label.setObjectName("soundIconActive")
                card.setObjectName("soundCardActive")
                card.style().unpolish(card)
                card.style().polish(card)
                card.icon_label.style().unpolish(card.icon_label)
                card.icon_label.style().polish(card.icon_label)
        self._update_status()
