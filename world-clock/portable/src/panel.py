# -*- coding: utf-8 -*-
"""
世界时钟·便携版 —— 主面板 UI（380×500）
像输入法候选框一样：需要时出现，不需要时隐藏
"""
from __future__ import annotations

import os
import sys
import json
import copy
from datetime import datetime, timezone
from typing import List, Tuple, Optional

from PySide6.QtCore import Qt, QTimer, QEvent, Signal, QSize
from PySide6.QtGui import QFont, QCursor, QClipboard, QPixmap, QIcon, QColor
from PySide6.QtWidgets import (
    QApplication, QWidget, QLabel, QPushButton, QFrame, QVBoxLayout, QHBoxLayout,
    QScrollArea, QLineEdit, QListWidget, QListWidgetItem, QStackedWidget,
    QSizePolicy, QSpacerItem,
)

# 同目录导入（frozen 模式下 PyInstaller 已处理路径，无需手动 insert）
if not getattr(sys, "frozen", False):
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import tz_core as tz
from styles import APP_QSS, COLORS


# 配置文件路径（便携版自身目录）
def _config_path() -> str:
    base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    return os.path.join(base, "config.json")


def load_config() -> dict:
    """读取配置文件"""
    path = _config_path()
    if os.path.exists(path):
        try:
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
        except (json.JSONDecodeError, OSError):
            pass
    return {
        "zones": [{"city": c, "tz": t} for c, t in tz.DEFAULT_ZONES],
        "tab": "clock",
    }


def save_config(cfg: dict) -> None:
    """保存配置文件"""
    try:
        with open(_config_path(), "w", encoding="utf-8") as f:
            json.dump(cfg, f, ensure_ascii=False, indent=2)
    except OSError:
        pass


class ZoneCard(QFrame):
    """单个时区卡片"""

    remove_clicked = Signal(str)  # tz_name
    copied = Signal(str)  # 复制的文本

    def __init__(self, city: str, tz_name: str, country: str, is_local: bool, parent=None):
        super().__init__(parent)
        self.city = city
        self.tz_name = tz_name
        self.country = country
        self.is_local = is_local
        self._build_ui()
        self.refresh()

    def _build_ui(self):
        self.setObjectName("ZoneCard")
        self.setProperty("isLocal", "true" if self.is_local else "false")
        self.setCursor(Qt.PointingHandCursor)
        self.setFixedHeight(56)

        root = QVBoxLayout(self)
        root.setContentsMargins(12, 7, 12, 7)
        root.setSpacing(5)

        # 第一行：城市名 + 国家标签 | 时间 + 秒数
        row1 = QHBoxLayout()
        row1.setSpacing(6)
        row1.setContentsMargins(0, 0, 0, 0)

        self.city_label = QLabel(self.city)
        self.city_label.setObjectName("CityName")
        row1.addWidget(self.city_label)

        # 国家标签统一显示（包括本地城市，保持一致性）
        if self.country:
            country_tag = QLabel(self.country)
            country_tag.setObjectName("CountryTag")
            row1.addWidget(country_tag)

        row1.addStretch()

        self.time_label = QLabel("12:34")
        self.time_label.setObjectName("Time")
        self.time_label.setAlignment(Qt.AlignRight | Qt.AlignVCenter)
        row1.addWidget(self.time_label)

        # 秒数隐藏（避免小字号渲染变形被误识别，简化视觉）
        self.seconds_label = QLabel("")
        self.seconds_label.setObjectName("TimeSeconds")
        self.seconds_label.hide()

        # 移除按钮（hover 时显示，放在最右）
        self.remove_btn = QPushButton("×")
        self.remove_btn.setObjectName("RemoveBtn")
        self.remove_btn.setFixedSize(16, 16)
        self.remove_btn.setCursor(Qt.PointingHandCursor)
        self.remove_btn.hide()
        self.remove_btn.clicked.connect(lambda: self.remove_clicked.emit(self.tz_name))
        row1.addWidget(self.remove_btn)

        root.addLayout(row1)

        # 第二行：UTC偏移 + 时差 + 昼夜 + 日期
        row2 = QHBoxLayout()
        row2.setSpacing(6)
        row2.setContentsMargins(0, 0, 0, 0)

        self.offset_label = QLabel("UTC+8")
        self.offset_label.setObjectName("MetaInfo")
        row2.addWidget(self.offset_label)

        self.diff_label = QLabel("本地")
        self.diff_label.setObjectName("DiffBadge")
        row2.addWidget(self.diff_label)

        self.daynight_label = QLabel("● 白天")
        self.daynight_label.setObjectName("DayNightBadge")
        self.daynight_label.setProperty("mode", "day")
        row2.addWidget(self.daynight_label)

        row2.addStretch()

        self.date_label = QLabel("周一 7月20日")
        self.date_label.setObjectName("DateInfo")
        self.date_label.setAlignment(Qt.AlignRight | Qt.AlignVCenter)
        row2.addWidget(self.date_label)

        root.addLayout(row2)

    def enterEvent(self, e):
        if not self.is_local:
            self.remove_btn.show()
        super().enterEvent(e)

    def leaveEvent(self, e):
        self.remove_btn.hide()
        super().leaveEvent(e)

    def mousePressEvent(self, e):
        # 点击卡片复制 "城市 HH:MM" 到剪贴板
        if e.button() == Qt.LeftButton and self.time_label.text():
            text = f"{self.city} {self.time_label.text()}"
            cb = QApplication.clipboard()
            cb.setText(text, QClipboard.Clipboard)
            self.copied.emit(text)
        super().mousePressEvent(e)

    def refresh(self, dt: Optional[datetime] = None):
        """刷新时间显示"""
        if dt is None:
            dt = datetime.now(timezone.utc)
        parts = tz.get_zone_parts(self.tz_name, dt)
        # 时间
        self.time_label.setText(f"{parts.hour:02d}:{parts.minute:02d}")
        self.seconds_label.setText(f":{parts.second:02d}")
        # 日期
        self.date_label.setText(f"{parts.weekday} · {parts.month}月{parts.day}日")
        # UTC 偏移
        off = tz.get_offset_minutes(self.tz_name, dt)
        self.offset_label.setText(tz.format_offset(off))
        # 与本地时差
        if self.is_local:
            self.diff_label.setText("本地")
            self.diff_label.setProperty("isLocal", "true")
        else:
            local_tz = tz.get_local_tz_name()
            try:
                diff = tz.get_hour_diff(local_tz, self.tz_name, dt)
                # diff 是 local - target，反转为 target 比 local 快多少
                ahead = -diff
                if ahead == 0:
                    self.diff_label.setText("同本地")
                else:
                    sign = "+" if ahead > 0 else "-"
                    ah = abs(ahead)
                    h = int(ah)
                    m = int(round((ah - h) * 60))
                    if m == 60:
                        h += 1
                        m = 0
                    if m:
                        self.diff_label.setText(f"{sign}{h}h{m}m")
                    else:
                        self.diff_label.setText(f"{sign}{h}h")
            except Exception:
                self.diff_label.setText("—")
            self.diff_label.setProperty("isLocal", "false")
        self.diff_label.style().unpolish(self.diff_label)
        self.diff_label.style().polish(self.diff_label)
        # 昼夜（色点 + 文字，避免 emoji 字体不协调）
        is_day = tz.is_daytime(self.tz_name, dt)
        self.daynight_label.setText("● 白天" if is_day else "● 夜晚")
        self.daynight_label.setProperty("mode", "day" if is_day else "night")
        self.daynight_label.style().unpolish(self.daynight_label)
        self.daynight_label.style().polish(self.daynight_label)


class AddZonePopup(QFrame):
    """添加时区搜索弹层"""

    zone_added = Signal(str, str)  # city, tz_name
    closed = Signal()

    def __init__(self, parent=None):
        super().__init__(parent)
        self.setObjectName("SearchPopup")
        self.setWindowFlags(Qt.Popup | Qt.FramelessWindowHint)
        self.setAttribute(Qt.WA_StyledBackground, True)
        self.setFixedWidth(300)
        self._build_ui()
        self._populate(tz.COMMON_TIMEZONES)

    def _build_ui(self):
        v = QVBoxLayout(self)
        v.setContentsMargins(12, 12, 12, 12)
        v.setSpacing(8)

        self.search = QLineEdit()
        self.search.setObjectName("SearchInput")
        self.search.setPlaceholderText("搜索城市或地区…")
        self.search.textChanged.connect(self._on_search)
        v.addWidget(self.search)

        self.list = QListWidget()
        self.list.setObjectName("CityList")
        self.list.setUniformItemSizes(True)
        self.list.itemClicked.connect(self._on_click)
        v.addWidget(self.list)

    def _populate(self, items):
        self.list.clear()
        # 去重：同 tz_name 只保留第一个城市
        seen = set()
        for city, tz_name, country in items:
            if tz_name in seen:
                continue
            seen.add(tz_name)
            item = QListWidgetItem(f"{city}  ·  {country}  ·  {tz_name}")
            item.setData(Qt.UserRole, (city, tz_name))
            self.list.addItem(item)

    def _on_search(self, text):
        text = text.strip().lower()
        if not text:
            self._populate(tz.COMMON_TIMEZONES)
            return
        filtered = [
            (c, t, ct) for c, t, ct in tz.COMMON_TIMEZONES
            if text in c.lower() or text in t.lower() or text in ct.lower()
        ]
        self._populate(filtered)

    def _on_click(self, item: QListWidgetItem):
        city, tz_name = item.data(Qt.UserRole)
        self.zone_added.emit(city, tz_name)
        self.close()

    def keyPressEvent(self, e):
        if e.key() == Qt.Key_Escape:
            self.close()
            return
        super().keyPressEvent(e)

    def closeEvent(self, e):
        self.closed.emit()
        super().closeEvent(e)


class TimestampPanel(QFrame):
    """时间戳转换面板"""

    copied = Signal(str)

    def __init__(self, zones: List[dict], parent=None):
        super().__init__(parent)
        self.zones = zones
        self.setObjectName("Panel")
        self._build_ui()
        self._on_input("")

    def _build_ui(self):
        v = QVBoxLayout(self)
        v.setContentsMargins(16, 16, 16, 16)
        v.setSpacing(10)

        hint = QLabel("输入 Unix 时间戳（秒/毫秒自动识别）或 ISO 字符串")
        hint.setObjectName("TsHint")
        hint.setWordWrap(True)
        v.addWidget(hint)

        self.input = QLineEdit()
        self.input.setObjectName("TsInput")
        self.input.setPlaceholderText("例如 1784496000 或 2026-07-20T12:00:00Z")
        self.input.textChanged.connect(self._on_input)
        v.addWidget(self.input)

        # 结果区域
        self.result_label = QLabel("等待输入…")
        self.result_label.setObjectName("TsResult")
        self.result_label.setWordWrap(True)
        self.result_label.setTextFormat(Qt.RichText)
        v.addWidget(self.result_label)

        v.addStretch()

    def set_zones(self, zones):
        self.zones = zones

    def _on_input(self, text: str):
        text = text.strip()
        if not text:
            self.result_label.setText("<span style='color:#8e8e93'>等待输入…</span>")
            return

        # 尝试时间戳
        try:
            ts = int(text)
            # 用第一个时区格式化
            results = []
            for z in self.zones[:6]:
                try:
                    s = tz.convert_timestamp(ts, z["tz"], "YYYY-MM-DD HH:mm:ss W")
                    results.append(f"<b style='color:#007aff'>{z['city']}</b>　{s}")
                except Exception:
                    pass
            if results:
                self.result_label.setText("<br>".join(results))
                self._last_text = "\n".join(
                    f"{z['city']}  {tz.convert_timestamp(ts, z['tz'], 'YYYY-MM-DD HH:mm:ss')}"
                    for z in self.zones[:6]
                )
                return
        except ValueError:
            pass

        # 尝试 ISO
        result = tz.convert_iso(text, "UTC", "YYYY-MM-DD HH:mm:ss")
        if result:
            results = []
            for z in self.zones[:6]:
                try:
                    s = tz.convert_iso(text, z["tz"], "YYYY-MM-DD HH:mm:ss W")
                    results.append(f"<b style='color:#007aff'>{z['city']}</b>　{s}")
                except Exception:
                    pass
            if results:
                self.result_label.setText("<br>".join(results))
                self._last_text = "\n".join(
                    f"{z['city']}  {tz.convert_iso(text, z['tz'], 'YYYY-MM-DD HH:mm:ss')}"
                    for z in self.zones[:6]
                )
                return

        self.result_label.setText(f"<span style='color:#ff3b30'>无法解析：{text}</span>")
        self._last_text = ""

    def mousePressEvent(self, e):
        # 点击结果复制
        if e.button() == Qt.LeftButton and getattr(self, "_last_text", ""):
            cb = QApplication.clipboard()
            cb.setText(self._last_text, QClipboard.Clipboard)
            self.copied.emit(self._last_text)
        super().mousePressEvent(e)


class WorldClockPanel(QWidget):
    """主面板：380×500 弹出式"""

    show_toast = Signal(str)  # 提示消息
    exit_app = Signal()

    def __init__(self, parent=None):
        super().__init__(parent)
        self.cfg = load_config()
        self.cards: List[ZoneCard] = []
        self.add_popup: Optional[AddZonePopup] = None
        self.setWindowTitle("世界时钟便携版")
        self._build_ui()
        self._refresh_all()

        # 每秒刷新
        self.timer = QTimer(self)
        self.timer.timeout.connect(self._refresh_all)
        self.timer.start(1000)

    def _build_ui(self):
        self.setObjectName("Root")
        self.setFixedSize(380, 460)
        self.setAttribute(Qt.WA_StyledBackground, True)

        root = QVBoxLayout(self)
        root.setContentsMargins(14, 10, 14, 8)
        root.setSpacing(6)

        # 顶部标题栏
        header = QHBoxLayout()
        header.setSpacing(8)
        header.setContentsMargins(0, 0, 0, 0)
        title_box = QVBoxLayout()
        title_box.setSpacing(0)
        title_box.setContentsMargins(0, 0, 0, 0)
        title = QLabel("世界时钟")
        title.setObjectName("AppTitle")
        subtitle = QLabel("便携版 · 像输入法一样看时间")
        subtitle.setObjectName("AppSubtitle")
        title_box.addWidget(title)
        title_box.addWidget(subtitle)
        header.addLayout(title_box)
        header.addStretch()
        # 关闭按钮（最小化到托盘）
        close_btn = QPushButton("✕")
        close_btn.setObjectName("RemoveBtn")
        close_btn.setFixedSize(22, 22)
        close_btn.setCursor(Qt.PointingHandCursor)
        close_btn.setToolTip("隐藏到托盘（Esc）")
        close_btn.clicked.connect(self.hide)
        header.addWidget(close_btn)
        root.addLayout(header)

        # 段控件
        seg = QFrame()
        seg.setObjectName("SegmentBar")
        seg.setFixedHeight(30)
        seg_lay = QHBoxLayout(seg)
        seg_lay.setContentsMargins(2, 2, 2, 2)
        seg_lay.setSpacing(2)
        self.seg_clock = QPushButton("时钟")
        self.seg_clock.setObjectName("SegmentBtn")
        self.seg_clock.setCheckable(True)
        self.seg_clock.clicked.connect(lambda: self._switch_tab("clock"))
        self.seg_ts = QPushButton("时间戳")
        self.seg_ts.setObjectName("SegmentBtn")
        self.seg_ts.setCheckable(True)
        self.seg_ts.clicked.connect(lambda: self._switch_tab("ts"))
        seg_lay.addWidget(self.seg_clock)
        seg_lay.addWidget(self.seg_ts)
        root.addWidget(seg)

        # 内容栈
        self.stack = QStackedWidget()
        self.stack.setSizePolicy(QSizePolicy.Expanding, QSizePolicy.Expanding)
        root.addWidget(self.stack, 1)

        # 世界时钟页
        clock_page = QFrame()
        clock_page.setObjectName("ClockPage")
        cp_lay = QVBoxLayout(clock_page)
        cp_lay.setContentsMargins(0, 0, 0, 0)
        cp_lay.setSpacing(6)

        self.scroll = QScrollArea()
        self.scroll.setWidgetResizable(True)
        self.scroll.setHorizontalScrollBarPolicy(Qt.ScrollBarAlwaysOff)
        self.scroll.setFrameShape(QFrame.NoFrame)
        scroll_content = QFrame()
        scroll_content.setObjectName("ScrollContent")
        self.scroll_layout = QVBoxLayout(scroll_content)
        self.scroll_layout.setContentsMargins(0, 4, 4, 4)
        self.scroll_layout.setSpacing(10)
        self.scroll_layout.setAlignment(Qt.AlignTop)
        self.scroll.setWidget(scroll_content)
        cp_lay.addWidget(self.scroll, 1)

        # 添加时区按钮
        self.add_btn = QPushButton("+ 添加时区")
        self.add_btn.setObjectName("AddZoneBtn")
        self.add_btn.setCursor(Qt.PointingHandCursor)
        self.add_btn.clicked.connect(self._show_add_popup)
        cp_lay.addWidget(self.add_btn)

        self.stack.addWidget(clock_page)

        # 时间戳页
        self.ts_panel = TimestampPanel(self.cfg.get("zones", []))
        self.stack.addWidget(self.ts_panel)

        # 底部状态栏（带顶部分隔线）
        footer_frame = QFrame()
        footer_frame.setObjectName("FooterFrame")
        footer = QHBoxLayout(footer_frame)
        footer.setContentsMargins(0, 6, 0, 0)
        footer.setSpacing(6)
        self.footer_label = QLabel("每秒刷新 · 数据本地保存")
        self.footer_label.setObjectName("FooterLabel")
        footer.addWidget(self.footer_label)
        footer.addStretch()
        hint = QLabel("Ctrl+Shift+W 唤起")
        hint.setObjectName("HotkeyHint")
        footer.addWidget(hint)
        root.addWidget(footer_frame)

        # 应用样式
        self.setStyleSheet(APP_QSS)

        # 初始 tab
        tab = self.cfg.get("tab", "clock")
        self._switch_tab(tab)

    def _switch_tab(self, tab: str):
        if tab == "clock":
            self.seg_clock.setChecked(True)
            self.seg_ts.setChecked(False)
            self.stack.setCurrentIndex(0)
        else:
            self.seg_clock.setChecked(False)
            self.seg_ts.setChecked(True)
            self.stack.setCurrentIndex(1)
        self.cfg["tab"] = tab
        save_config(self.cfg)

    def _rebuild_cards(self):
        # 清空
        while self.scroll_layout.count():
            item = self.scroll_layout.takeAt(0)
            w = item.widget()
            if w:
                w.deleteLater()
        self.cards.clear()

        zones = self.cfg.get("zones", [])
        local_tz = tz.get_local_tz_name()
        seen_local = False
        for z in zones:
            is_local = (z["tz"] == local_tz) and not seen_local
            if is_local:
                seen_local = True
            card = ZoneCard(z["city"], z["tz"], self._country_of(z["tz"]), is_local)
            card.remove_clicked.connect(self._on_remove_zone)
            card.copied.connect(lambda t: self.show_toast.emit(f"已复制：{t}"))
            self.scroll_layout.addWidget(card)
            self.cards.append(card)

    def _country_of(self, tz_name: str) -> str:
        for c, t, country in tz.COMMON_TIMEZONES:
            if t == tz_name:
                return country
        return ""

    def _refresh_all(self):
        if not self.cards:
            self._rebuild_cards()
        dt = datetime.now(timezone.utc)
        for c in self.cards:
            c.refresh(dt)

    def _show_add_popup(self):
        if self.add_popup is not None:
            self.add_popup.close()
            self.add_popup = None
            return
        self.add_popup = AddZonePopup(self)
        self.add_popup.zone_added.connect(self._on_add_zone)
        self.add_popup.closed.connect(lambda: setattr(self, "add_popup", None))
        # 定位到按钮上方
        gp = self.add_btn.mapToGlobal(QCursor.pos() - self.add_btn.pos() + self.add_btn.rect().center())
        # 简单定位：面板右下角
        pg = self.mapToGlobal(self.rect().bottomRight())
        self.add_popup.move(pg.x() - 300 - 4, pg.y() - 360)
        self.add_popup.setFixedHeight(360)
        self.add_popup.show()
        self.add_popup.search.setFocus()

    def _on_add_zone(self, city: str, tz_name: str):
        # 去重
        for z in self.cfg["zones"]:
            if z["tz"] == tz_name and z["city"] == city:
                self.show_toast.emit(f"{city} 已在列表中")
                return
        self.cfg["zones"].append({"city": city, "tz": tz_name})
        save_config(self.cfg)
        self.ts_panel.set_zones(self.cfg["zones"])
        self._rebuild_cards()
        self._refresh_all()
        self.show_toast.emit(f"已添加 {city}")

    def _on_remove_zone(self, tz_name: str):
        # 不允许移除本地
        if tz_name == tz.get_local_tz_name():
            self.show_toast.emit("本地时区不可移除")
            return
        new_zones = [z for z in self.cfg["zones"] if z["tz"] != tz_name]
        if len(new_zones) == len(self.cfg["zones"]):
            # 按 city 匹配
            for z in self.cfg["zones"]:
                if z["tz"] == tz_name:
                    new_zones = [zz for zz in self.cfg["zones"] if zz is not z]
                    break
        self.cfg["zones"] = new_zones
        save_config(self.cfg)
        self.ts_panel.set_zones(self.cfg["zones"])
        self._rebuild_cards()
        self._refresh_all()
        self.show_toast.emit("已移除")

    def showEvent(self, e):
        # 显示时刷新一次配置（避免外部修改）
        self.cfg = load_config()
        self.ts_panel.set_zones(self.cfg.get("zones", []))
        self._rebuild_cards()
        self._refresh_all()
        super().showEvent(e)

    def keyPressEvent(self, e):
        if e.key() == Qt.Key_Escape:
            self.hide()
            return
        super().keyPressEvent(e)
