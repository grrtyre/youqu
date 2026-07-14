# -*- coding: utf-8 -*-
"""拾色管家·便携版 - 全屏取色覆盖层

工作流程：
1. 用户按 Ctrl+Shift+C → 主面板隐藏 → 截取整屏 QPixmap
2. 显示全屏无边框覆盖层，背景绘制截屏（视觉上"冻结"桌面）
3. 鼠标移动：在光标附近显示放大镜（13× 像素级），同步显示当前色 HEX/RGB/HSL
4. 左键点击：确认取色，发出 color_picked 信号
5. Esc / 右键：取消

像素采样直接从 QPixmap 取（避免抓到放大镜自身）。
"""

from __future__ import annotations

import ctypes
from ctypes import wintypes

from PySide6.QtCore import Qt, QPoint, QRect, QTimer, Signal
from PySide6.QtGui import (
    QPixmap, QImage, QPainter, QColor, QPen, QBrush,
    QMouseEvent, QKeyEvent, QPaintEvent,
)
from PySide6.QtWidgets import QWidget, QApplication, QLabel


# ================================================================
#  Win32 光标位置 API
# ================================================================

user32 = ctypes.windll.user32
user32.GetCursorPos.argtypes = [ctypes.POINTER(wintypes.POINT)]
user32.GetCursorPos.restype = wintypes.BOOL


# ================================================================
#  常量
# ================================================================

LENS_PIXEL = 220       # 放大镜显示尺寸（像素）
ZOOM = 13              # 放大倍数（奇数，便于中心对齐）
HALF = ZOOM // 2       # 中心偏移


class PickerOverlay(QWidget):
    """全屏取色覆盖层。"""

    color_picked = Signal(dict)   # {r, g, b, hex}
    cancelled = Signal()

    def __init__(self, parent=None):
        super().__init__(parent)
        self.setWindowFlags(
            Qt.FramelessWindowHint
            | Qt.WindowStaysOnTopHint
            | Qt.Tool
        )
        # 不设置 WA_TranslucentBackground —— 我们用截屏作为背景，不透明
        self.setAttribute(Qt.WA_DeleteOnClose, False)
        self.setCursor(Qt.CrossCursor)

        self._snapshot: QPixmap | None = None  # 整屏截图
        self._snapshot_image: QImage | None = None  # 用于像素采样的 QImage
        self._scale_x = 1.0
        self._scale_y = 1.0
        self._origin_x = 0
        self._origin_y = 0
        self._current_rgb: dict | None = None
        self._mouse_pos: QPoint = QPoint(0, 0)

    # ----------------------------------------------------------------
    #  启动取色
    # ----------------------------------------------------------------

    def start(self):
        """截屏并显示全屏覆盖层。"""
        # 截取虚拟屏幕（多显示器合并）
        screen = QApplication.primaryScreen()
        if screen is None:
            self.cancelled.emit()
            return

        # 虚拟几何 = 所有显示器合并区域
        virt = screen.virtualGeometry()

        # grabWindow(0 = 整个屏幕) 加虚拟几何参数
        # 返回的是物理分辨率 QPixmap
        self._snapshot = screen.grabWindow(0, virt.x(), virt.y(), virt.width(), virt.height())
        if self._snapshot.isNull():
            self.cancelled.emit()
            return

        self._snapshot_image = self._snapshot.toImage().convertToFormat(QImage.Format_RGB32)
        # 物理像素 / 逻辑像素比例
        self._scale_x = self._snapshot.width() / max(1, virt.width())
        self._scale_y = self._snapshot.height() / max(1, virt.height())
        self._origin_x = virt.x()
        self._origin_y = virt.y()

        # 覆盖整个虚拟屏幕
        self.setGeometry(virt)
        self.show()
        self.raise_()
        self.activateWindow()
        self.setMouseTracking(True)
        self.setFocus()

    # ----------------------------------------------------------------
    #  像素采样
    # ----------------------------------------------------------------

    def _sample_at(self, global_x: int, global_y: int) -> dict | None:
        """采样指定全局坐标处的像素颜色。"""
        if self._snapshot_image is None:
            return None
        # 全局坐标 → 截图像素坐标
        sx = int((global_x - self._origin_x) * self._scale_x)
        sy = int((global_y - self._origin_y) * self._scale_y)
        if sx < 0 or sy < 0 or sx >= self._snapshot_image.width() or sy >= self._snapshot_image.height():
            return None
        px = self._snapshot_image.pixel(sx, sy)
        # QRgb 格式 0xAARRGGBB
        r = (px >> 16) & 0xFF
        g = (px >> 8) & 0xFF
        b = px & 0xFF
        return {'r': r, 'g': g, 'b': b}

    # ----------------------------------------------------------------
    #  绘制
    # ----------------------------------------------------------------

    def paintEvent(self, event: QPaintEvent):
        painter = QPainter(self)
        painter.setRenderHint(QPainter.SmoothPixmapTransform, False)
        painter.setRenderHint(QPainter.Antialiasing, True)

        # 1. 绘制截屏背景
        if self._snapshot is not None:
            painter.drawPixmap(self.rect(), self._snapshot)

        # 2. 当前光标位置（局部坐标）
        mx = self._mouse_pos.x()
        my = self._mouse_pos.y()

        # 3. 计算放大镜位置（光标右下，空间不足时翻到左上）
        lens_x = mx + 24
        lens_y = my + 24
        if lens_x + LENS_PIXEL + 230 > self.width():
            lens_x = mx - LENS_PIXEL - 24
        if lens_y + LENS_PIXEL + 30 > self.height():
            lens_y = my - LENS_PIXEL - 24
        # 防止超出屏幕
        lens_x = max(4, min(lens_x, self.width() - LENS_PIXEL - 4))
        lens_y = max(4, min(lens_y, self.height() - LENS_PIXEL - 4))

        # 4. 绘制放大镜（背景 + 像素 + 边框）
        self._draw_lens(painter, lens_x, lens_y, mx, my)

        # 5. 绘制信息卡（HEX/RGB/HSL + 色块）
        info_x = lens_x + LENS_PIXEL + 14
        info_y = lens_y
        if info_x + 220 > self.width():
            info_x = lens_x - 220 - 14
        self._draw_info_card(painter, info_x, info_y, info_x + 220)

        # 6. 绘制底部提示
        hint_y = lens_y + LENS_PIXEL + 8
        if hint_y + 28 > self.height():
            hint_y = lens_y - 28 - 8
        self._draw_hint(painter, lens_x, hint_y)

    def _draw_lens(self, painter: QPainter, x: int, y: int, mx: int, my: int):
        """绘制放大镜：边框 + 像素放大区 + 中心十字 + 中心高亮框。"""
        # 阴影外框
        painter.setPen(QPen(QColor(0, 0, 0, 90), 1))
        painter.setBrush(QColor(255, 255, 255, 230))
        painter.drawRoundedRect(x - 2, y - 2, LENS_PIXEL + 4, LENS_PIXEL + 4, 8, 8)

        # 像素放大区（从截屏取 ZOOM×ZOOM 区域，放大到 LENS_PIXEL×LENS_PIXEL）
        # 截图坐标
        if self._snapshot is not None:
            cell = LENS_PIXEL / ZOOM
            # 鼠标全局坐标 → 截图像素坐标
            sx_center = int((self._mouse_pos_global().x() - self._origin_x) * self._scale_x)
            sy_center = int((self._mouse_pos_global().y() - self._origin_y) * self._scale_y)
            src_x = sx_center - HALF
            src_y = sy_center - HALF

            # 关闭平滑插值，保留像素感
            painter.setRenderHint(QPainter.SmoothPixmapTransform, False)
            for i in range(ZOOM):
                for j in range(ZOOM):
                    px = src_x + i
                    py = src_y + j
                    if 0 <= px < self._snapshot_image.width() and 0 <= py < self._snapshot_image.height():
                        color = QColor.fromRgb(self._snapshot_image.pixel(px, py))
                    else:
                        color = QColor(29, 29, 31)
                    painter.fillRect(
                        x + int(i * cell), y + int(j * cell),
                        int(cell) + 1, int(cell) + 1,
                        color,
                    )

        # 中心高亮框（白色描边 + 黑色虚线，标记当前像素）
        center_x = x + (LENS_PIXEL // 2) - int(cell) // 2 if self._snapshot else x + LENS_PIXEL // 2 - 8
        center_y = y + (LENS_PIXEL // 2) - int(cell) // 2 if self._snapshot else y + LENS_PIXEL // 2 - 8
        cell_size = int(cell) if self._snapshot else 16
        painter.setPen(QPen(QColor(255, 255, 255, 220), 2))
        painter.setBrush(Qt.NoBrush)
        painter.drawRect(center_x, center_y, cell_size, cell_size)
        painter.setPen(QPen(QColor(0, 0, 0, 180), 1, Qt.DashLine))
        painter.drawRect(center_x, center_y, cell_size, cell_size)

        # 中心十字延伸线（细红线）
        painter.setPen(QPen(QColor(255, 59, 48, 110), 1))
        painter.drawLine(x, y + LENS_PIXEL // 2, x + LENS_PIXEL, y + LENS_PIXEL // 2)
        painter.drawLine(x + LENS_PIXEL // 2, y, x + LENS_PIXEL // 2, y + LENS_PIXEL)

    def _draw_info_card(self, painter: QPainter, x: int, y: int, right_edge: int):
        """绘制信息卡：当前色块 + HEX + RGB + HSL。"""
        width = right_edge - x
        # 卡片背景
        painter.setPen(QPen(QColor(0, 0, 0, 30), 1))
        painter.setBrush(QColor(255, 255, 255, 245))
        painter.drawRoundedRect(x, y, width, 124, 10, 10)

        if self._current_rgb is None:
            painter.setPen(QColor(110, 110, 115))
            painter.setFont(self.font())
            painter.drawText(x + 12, y + 60, '— 移动鼠标取色 —')
            return

        r, g, b = self._current_rgb['r'], self._current_rgb['g'], self._current_rgb['b']
        hex_str = f'#{r:02X}{g:02X}{b:02X}'
        rgb_str = f'rgb({r}, {g}, {b})'
        # HSL
        from color_core import rgb_to_hsl
        hsl = rgb_to_hsl(r, g, b)
        hsl_str = f'hsl({hsl["h"]}, {hsl["s"]}%, {hsl["l"]}%)'

        # 色块
        swatch_x = x + 12
        swatch_y = y + 12
        painter.setPen(QPen(QColor(0, 0, 0, 40), 1))
        painter.setBrush(QColor(r, g, b))
        painter.drawRoundedRect(swatch_x, swatch_y, 100, 100, 8, 8)

        # 文字
        text_x = swatch_x + 100 + 14
        painter.setPen(QColor(29, 29, 31))
        from PySide6.QtGui import QFont
        font_hex = QFont(self.font())
        font_hex.setPointSize(12)
        font_hex.setBold(True)
        painter.setFont(font_hex)
        painter.drawText(text_x, y + 32, hex_str)

        painter.setPen(QColor(110, 110, 115))
        font_small = QFont(self.font())
        font_small.setPointSize(9)
        painter.setFont(font_small)
        painter.drawText(text_x, y + 58, rgb_str)
        painter.drawText(text_x, y + 78, hsl_str)

    def _draw_hint(self, painter: QPainter, x: int, y: int):
        """绘制操作提示。"""
        text = '点击取色  ·  Esc / 右键取消'
        from PySide6.QtGui import QFontMetrics, QFont
        font = QFont(self.font())
        font.setPointSize(9)
        painter.setFont(font)
        fm = QFontMetrics(font)
        text_w = fm.horizontalAdvance(text) + 24
        text_h = 24
        painter.setPen(Qt.NoPen)
        painter.setBrush(QColor(29, 29, 31, 200))
        painter.drawRoundedRect(x, y, text_w, text_h, 10, 10)
        painter.setPen(QColor(255, 255, 255))
        painter.drawText(x + 12, y + 16, text)

    # ----------------------------------------------------------------
    #  事件
    # ----------------------------------------------------------------

    def _mouse_pos_global(self) -> QPoint:
        pt = wintypes.POINT()
        user32.GetCursorPos(ctypes.byref(pt))
        return QPoint(pt.x, pt.y)

    def mouseMoveEvent(self, event: QMouseEvent):
        self._mouse_pos = event.position().toPoint()
        # 采样
        gp = self._mouse_pos_global()
        self._current_rgb = self._sample_at(gp.x(), gp.y())
        self.update()

    def mousePressEvent(self, event: QMouseEvent):
        if event.button() == Qt.LeftButton:
            if self._current_rgb is not None:
                r, g, b = self._current_rgb['r'], self._current_rgb['g'], self._current_rgb['b']
                hex_str = f'#{r:02X}{g:02X}{b:02X}'
                self.color_picked.emit({'r': r, 'g': g, 'b': b, 'hex': hex_str})
            else:
                self.cancelled.emit()
        elif event.button() == Qt.RightButton:
            self.cancelled.emit()

    def keyPressEvent(self, event: QKeyEvent):
        if event.key() == Qt.Key_Escape:
            self.cancelled.emit()
        else:
            super().keyPressEvent(event)

    def closeEvent(self, event):
        # 防止意外关闭丢失信号
        event.ignore()
        self.cancelled.emit()
