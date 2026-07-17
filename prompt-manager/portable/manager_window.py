# -*- coding: utf-8 -*-
"""管理窗口 —— 完整的提示词库管理（新建/编辑/删除/导入导出）"""
from __future__ import annotations

import json
from typing import Optional, List, Dict, Any

from PySide6.QtCore import Qt, QSize
from PySide6.QtGui import QIcon, QCursor, QAction
from PySide6.QtWidgets import (
    QMainWindow, QWidget, QVBoxLayout, QHBoxLayout, QLabel, QLineEdit, QPushButton,
    QFrame, QScrollArea, QListWidget, QListWidgetItem, QStackedWidget, QFileDialog,
    QMessageBox, QCheckBox, QSplitter, QSizePolicy, QStatusBar, QApplication, QMenu,
    QGraphicsDropShadowEffect
)
from PySide6.QtGui import QColor

from store import PromptStore, extract_vars, fill_vars
from styles import APPLE_QSS, COLOR_BG, COLOR_CARD, COLOR_ACCENT, COLOR_TEXT_2, COLOR_TEXT_3


class EditDialog(QWidget):
    """新建/编辑提示词弹窗"""

    def __init__(self, store: PromptStore, pid: Optional[str] = None, parent: Optional[QWidget] = None):
        super().__init__(parent)
        self.setWindowFlags(Qt.Dialog | Qt.WindowTitleHint | Qt.WindowCloseButtonHint)
        self.setWindowTitle("编辑提示词" if pid else "新建提示词")
        self.setStyleSheet(APPLE_QSS)
        self._store = store
        self._pid = pid
        self._build_ui()
        if pid:
            self._load(pid)
        self.setFixedSize(460, 540)

    def _build_ui(self):
        root = QFrame(self)
        root.setObjectName("cardSurface")
        outer = QVBoxLayout(root)
        outer.setContentsMargins(24, 20, 24, 20)
        outer.setSpacing(12)

        title = QLabel("编辑提示词" if self._pid else "新建提示词")
        title.setObjectName("sectionTitle")
        outer.addWidget(title)

        # 标题
        outer.addWidget(self._field_label("标题"))
        self._title = QLineEdit()
        self._title.setPlaceholderText("给这条提示词起个名字")
        outer.addWidget(self._title)

        # 分类
        outer.addWidget(self._field_label("分类"))
        self._category = QLineEdit()
        self._category.setPlaceholderText("例如：写作、编程、翻译")
        outer.addWidget(self._category)

        # 标签
        outer.addWidget(self._field_label("标签（用逗号分隔）"))
        self._tags = QLineEdit()
        self._tags.setPlaceholderText("例如：周报, 工作")
        outer.addWidget(self._tags)

        # 内容
        outer.addWidget(self._field_label('内容（用 {{变量名}} 标记变量）'))
        from PySide6.QtWidgets import QPlainTextEdit
        self._content = QPlainTextEdit()
        self._content.setPlaceholderText("提示词内容…")
        outer.addWidget(self._content)

        # 收藏 + 变量提示
        row = QHBoxLayout()
        self._favorite = QCheckBox("收藏")
        row.addWidget(self._favorite)
        row.addStretch()
        self._var_hint = QLabel("")
        self._var_hint.setStyleSheet(f"color: {COLOR_TEXT_3}; font-size: 11px;")
        row.addWidget(self._var_hint)
        outer.addLayout(row)

        self._content.textChanged.connect(self._update_var_hint)

        # 按钮
        btn_row = QHBoxLayout()
        btn_row.addStretch()
        if self._pid:
            del_btn = QPushButton("删除")
            del_btn.setObjectName("dangerBtn")
            del_btn.clicked.connect(self._delete)
            btn_row.addWidget(del_btn)
        cancel_btn = QPushButton("取消")
        cancel_btn.setMinimumWidth(72)
        cancel_btn.clicked.connect(self.close)
        btn_row.addWidget(cancel_btn)
        save_btn = QPushButton("保存")
        save_btn.setObjectName("primaryBtn")
        save_btn.setMinimumWidth(80)
        save_btn.clicked.connect(self._save)
        btn_row.addWidget(save_btn)
        outer.addLayout(btn_row)

        wrapper = QVBoxLayout(self)
        wrapper.setContentsMargins(0, 0, 0, 0)
        wrapper.addWidget(root)

    def _field_label(self, text: str) -> QLabel:
        lbl = QLabel(text)
        lbl.setObjectName("fieldLabel")
        return lbl

    def _update_var_hint(self):
        vars_ = extract_vars(self._content.toPlainText())
        if vars_:
            self._var_hint.setText(f"检测到 {len(vars_)} 个变量：{', '.join(vars_)}")
        else:
            self._var_hint.setText("")

    def _load(self, pid: str):
        p = self._store.get(pid)
        if not p:
            return
        self._title.setText(p.get("title", ""))
        self._category.setText(p.get("category", ""))
        self._tags.setText(", ".join(p.get("tags") or []))
        self._content.setPlainText(p.get("content", ""))
        self._favorite.setChecked(bool(p.get("favorite")))
        self._update_var_hint()

    def _save(self):
        title = self._title.text().strip()
        if not title:
            QMessageBox.warning(self, "提示", "请填写标题")
            self._title.setFocus()
            return
        content = self._content.toPlainText()
        if not content.strip():
            QMessageBox.warning(self, "提示", "请填写内容")
            self._content.setFocus()
            return
        category = self._category.text().strip() or "未分类"
        tags_str = self._tags.text()
        tags = [t.strip() for t in tags_str.replace("，", ",").split(",") if t.strip()]
        favorite = self._favorite.isChecked()
        if self._pid:
            self._store.update(self._pid, title=title, content=content,
                               category=category, tags=tags, favorite=favorite)
        else:
            self._store.add(title=title, content=content, category=category,
                            tags=tags, favorite=favorite)
        self.close()

    def _delete(self):
        if not self._pid:
            return
        ans = QMessageBox.question(self, "确认", "确定删除这条提示词？此操作不可撤销。",
                                   QMessageBox.Yes | QMessageBox.No)
        if ans == QMessageBox.Yes:
            self._store.delete(self._pid)
            self.close()


class VarFillDialogMgr(QWidget):
    """管理窗口里的变量填写弹窗"""

    def __init__(self, prompt: Dict[str, Any], parent: Optional[QWidget] = None):
        super().__init__(parent)
        self.setWindowFlags(Qt.Dialog | Qt.WindowTitleHint | Qt.WindowCloseButtonHint)
        self.setWindowTitle("填写变量并复制")
        self.setStyleSheet(APPLE_QSS)
        self._prompt = prompt
        self._vars = extract_vars(prompt.get("content", ""))
        self._inputs: Dict[str, QLineEdit] = {}
        self._build_ui()
        self.setFixedSize(420, 380 + max(0, len(self._vars) - 2) * 56)

    def _build_ui(self):
        root = QFrame(self)
        root.setObjectName("cardSurface")
        outer = QVBoxLayout(root)
        outer.setContentsMargins(22, 18, 22, 18)
        outer.setSpacing(12)

        title = QLabel("填写变量并复制")
        title.setObjectName("sectionTitle")
        outer.addWidget(title)

        sub = QLabel(self._prompt.get("title", ""))
        sub.setStyleSheet(f"color: {COLOR_TEXT_2}; font-size: 12px;")
        outer.addWidget(sub)

        if not self._vars:
            hint = QLabel("这条提示词没有变量，可直接复制。")
            hint.setStyleSheet(f"color: {COLOR_TEXT_3}; font-size: 12px;")
            outer.addWidget(hint)
        else:
            for name in self._vars:
                lbl = QLabel("变量  " + name)
                lbl.setObjectName("varName")
                outer.addWidget(lbl)
                inp = QLineEdit()
                inp.setPlaceholderText(f"请输入 {name}")
                outer.addWidget(inp)
                self._inputs[name] = inp

        btn_row = QHBoxLayout()
        btn_row.addStretch()
        cancel = QPushButton("取消")
        cancel.clicked.connect(self.close)
        btn_row.addWidget(cancel)
        copy_btn = QPushButton("复制并关闭")
        copy_btn.setObjectName("primaryBtn")
        copy_btn.clicked.connect(self._copy)
        btn_row.addWidget(copy_btn)
        outer.addLayout(btn_row)

        wrapper = QVBoxLayout(self)
        wrapper.setContentsMargins(0, 0, 0, 0)
        wrapper.addWidget(root)

    def _copy(self):
        values = {n: inp.text() for n, inp in self._inputs.items()}
        result = fill_vars(self._prompt.get("content", ""), values)
        QApplication.clipboard().setText(result)
        self.close()


class ManagerWindow(QMainWindow):
    """管理窗口主界面"""

    def __init__(self, store: PromptStore):
        super().__init__()
        self._store = store
        self.setWindowTitle("提示词库管理")
        self.setStyleSheet(APPLE_QSS)
        self.setWindowIcon(QIcon("icon.ico"))
        self.resize(960, 640)
        self.setMinimumSize(800, 520)

        self._filter = "all"  # all | favorite | recent | category:xxx | tag:xxx
        self._keyword = ""
        self._view_mode = "grid"  # grid | list

        self._build_ui()
        self._refresh()

    def _build_ui(self):
        central = QWidget()
        central.setObjectName("root")
        self.setCentralWidget(central)

        outer = QVBoxLayout(central)
        outer.setContentsMargins(16, 14, 16, 14)
        outer.setSpacing(10)

        # 顶部工具栏
        top = QHBoxLayout()
        top.setSpacing(8)
        title = QLabel("提示词库")
        title.setObjectName("titleLabel")
        top.addWidget(title)
        top.addSpacing(8)
        self._count_label = QLabel("")
        self._count_label.setStyleSheet(f"color: {COLOR_TEXT_3}; font-size: 12px;")
        top.addWidget(self._count_label)
        top.addStretch()

        # 搜索框
        self._search = QLineEdit()
        self._search.setPlaceholderText("搜索标题、内容、标签、分类…")
        self._search.setFixedWidth(260)
        self._search.setClearButtonEnabled(True)
        self._search.textChanged.connect(self._on_search)
        top.addWidget(self._search)

        new_btn = QPushButton("＋ 新建")
        new_btn.setObjectName("primaryBtn")
        new_btn.clicked.connect(lambda: self._open_edit(None))
        top.addWidget(new_btn)
        outer.addLayout(top)

        # 主体：左侧导航 + 右侧内容
        splitter = QSplitter(Qt.Horizontal)
        splitter.setHandleWidth(8)
        splitter.setStyleSheet("background: transparent;")

        # 左侧侧栏 —— 缩窄到 200px
        side = QFrame()
        side.setStyleSheet(f"background: {COLOR_CARD}; border-radius: 12px;")
        side.setFixedWidth(200)
        side_lay = QVBoxLayout(side)
        side_lay.setContentsMargins(10, 14, 10, 14)
        side_lay.setSpacing(4)

        # 智能分组
        sec1 = QLabel("智能分组")
        sec1.setObjectName("fieldLabel")
        side_lay.addWidget(sec1)

        self._nav_buttons: List[QPushButton] = []
        for key, label in [("all", "全部"), ("favorite", "收藏"), ("recent", "最近使用")]:
            btn = QPushButton(label)
            btn.setObjectName("navItem")
            btn.setCheckable(True)
            btn.setProperty("filterKey", key)
            btn.clicked.connect(lambda _=False, k=key: self._set_filter(k))
            self._nav_buttons.append(btn)
            side_lay.addWidget(btn)

        side_lay.addSpacing(8)

        sec2 = QLabel("分类")
        sec2.setObjectName("fieldLabel")
        side_lay.addWidget(sec2)

        self._cat_box = QVBoxLayout()
        self._cat_box.setSpacing(4)
        side_lay.addLayout(self._cat_box)

        side_lay.addSpacing(8)
        sec3 = QLabel("标签")
        sec3.setObjectName("fieldLabel")
        side_lay.addWidget(sec3)

        self._tag_box = QVBoxLayout()
        self._tag_box.setSpacing(4)
        side_lay.addLayout(self._tag_box)

        side_lay.addStretch()

        # 底部导入导出
        io_row = QHBoxLayout()
        io_row.setSpacing(4)
        exp_btn = QPushButton("导出")
        exp_btn.setObjectName("iconBtn")
        exp_btn.clicked.connect(self._export)
        io_row.addWidget(exp_btn)
        imp_btn = QPushButton("导入")
        imp_btn.setObjectName("iconBtn")
        imp_btn.clicked.connect(self._import)
        io_row.addWidget(imp_btn)
        side_lay.addLayout(io_row)

        splitter.addWidget(side)

        # 右侧内容区
        right = QFrame()
        right.setStyleSheet(f"background: {COLOR_BG}; border-radius: 12px;")
        right_lay = QVBoxLayout(right)
        right_lay.setContentsMargins(0, 0, 0, 0)
        right_lay.setSpacing(8)

        # 视图切换 + 排序
        bar = QHBoxLayout()
        bar.setContentsMargins(16, 14, 16, 4)
        bar.addStretch()

        seg = QFrame()
        seg.setObjectName("segmented")
        seg.setFixedSize(140, 30)
        seg_lay = QHBoxLayout(seg)
        seg_lay.setContentsMargins(2, 2, 2, 2)
        seg_lay.setSpacing(0)
        self._seg_grid = QPushButton("网格")
        self._seg_grid.setObjectName("segBtn")
        self._seg_grid.setCheckable(True)
        self._seg_grid.setChecked(True)
        self._seg_grid.clicked.connect(lambda: self._set_view("grid"))
        seg_lay.addWidget(self._seg_grid)
        self._seg_list = QPushButton("列表")
        self._seg_list.setObjectName("segBtn")
        self._seg_list.setCheckable(True)
        self._seg_list.clicked.connect(lambda: self._set_view("list"))
        seg_lay.addWidget(self._seg_list)
        bar.addWidget(seg)
        right_lay.addLayout(bar)

        # 滚动内容
        self._scroll = QScrollArea()
        self._scroll.setWidgetResizable(True)
        self._scroll.setFrameShape(QFrame.NoFrame)
        self._scroll.setHorizontalScrollBarPolicy(Qt.ScrollBarAlwaysOff)
        self._scroll.setStyleSheet("background: transparent; border: none;")
        self._content = QWidget()
        self._content.setStyleSheet("background: transparent;")
        self._content_lay = QVBoxLayout(self._content)
        self._content_lay.setContentsMargins(16, 4, 16, 16)
        self._content_lay.setSpacing(10)
        self._content_lay.addStretch()
        self._scroll.setWidget(self._content)
        right_lay.addWidget(self._scroll, 1)

        # 空状态
        self._empty_hint = QLabel("还没有提示词，点击右上角「＋ 新建」开始")
        self._empty_hint.setStyleSheet(f"color: {COLOR_TEXT_3}; font-size: 13px;")
        self._empty_hint.setAlignment(Qt.AlignCenter)
        self._empty_hint.setVisible(False)
        right_lay.addWidget(self._empty_hint)

        splitter.addWidget(side)
        splitter.addWidget(right)
        splitter.setStretchFactor(0, 0)
        splitter.setStretchFactor(1, 1)
        splitter.setSizes([210, 740])

        outer.addWidget(splitter, 1)

        # 状态栏
        sb = QStatusBar()
        sb.setStyleSheet(f"background: transparent; color: {COLOR_TEXT_3}; font-size: 11px;")
        sb.showMessage("就绪")
        self.setStatusBar(sb)

    def _set_filter(self, key: str):
        self._filter = key
        for btn in self._nav_buttons:
            btn.setChecked(btn.property("filterKey") == key)
        self._refresh()

    def _set_view(self, mode: str):
        self._view_mode = mode
        self._seg_grid.setChecked(mode == "grid")
        self._seg_list.setChecked(mode == "list")
        self._refresh_content()

    def _on_search(self, text: str):
        self._keyword = text
        self._refresh_content()

    def _refresh(self):
        # 刷新左侧分类/标签
        # 清空 cat_box
        while self._cat_box.count():
            item = self._cat_box.takeAt(0)
            w = item.widget()
            if w:
                w.deleteLater()
        while self._tag_box.count():
            item = self._tag_box.takeAt(0)
            w = item.widget()
            if w:
                w.deleteLater()

        cats = self._store.categories()
        for c in cats:
            cnt = sum(1 for p in self._store.all() if p.get("category") == c)
            btn = QPushButton(f"{c}  ({cnt})")
            btn.setObjectName("navItem")
            btn.setCheckable(True)
            btn.setChecked(self._filter == f"category:{c}")
            btn.clicked.connect(lambda _=False, k=f"category:{c}": self._set_filter(k))
            self._cat_box.addWidget(btn)

        tags = self._store.tags()[:14]
        if not tags:
            hint = QLabel("暂无标签")
            hint.setStyleSheet(f"color: {COLOR_TEXT_3}; font-size: 11px; padding: 4px;")
            self._tag_box.addWidget(hint)
        else:
            for t in tags:
                btn = QPushButton(t)
                btn.setObjectName("navItem")
                btn.setCheckable(True)
                btn.setChecked(self._filter == f"tag:{t}")
                btn.clicked.connect(lambda _=False, k=f"tag:{t}": self._set_filter(k))
                self._tag_box.addWidget(btn)

        # 默认 all
        if self._filter not in ("all", "favorite", "recent") and not (
            self._filter.startswith("category:") or self._filter.startswith("tag:")
        ):
            self._filter = "all"
        for btn in self._nav_buttons:
            btn.setChecked(btn.property("filterKey") == self._filter)

        self._refresh_content()

    def _refresh_content(self):
        # 清空（保留 stretch）
        while self._content_lay.count() > 1:
            item = self._content_lay.takeAt(0)
            w = item.widget()
            if w:
                w.deleteLater()

        # 取过滤后的列表
        kw = self._keyword.strip()
        f = self._filter
        items = self._store.search(
            keyword=kw,
            category=f[9:] if f.startswith("category:") else None,
            tag=f[4:] if f.startswith("tag:") else None,
            favorite_only=(f == "favorite"),
            recent_only=(f == "recent"),
            limit=200,
        )

        self._count_label.setText(f"共 {len(items)} 条")
        if not items:
            self._empty_hint.setVisible(True)
            return
        self._empty_hint.setVisible(False)

        if self._view_mode == "grid":
            self._render_grid(items)
        else:
            self._render_list(items)

    def _render_grid(self, items: List[Dict[str, Any]]):
        # 用 QGridLayout 保证网格对齐，固定列数
        from PySide6.QtWidgets import QGridLayout
        cols = 2
        # 清空旧的（除 stretch）
        while self._content_lay.count() > 1:
            item = self._content_lay.takeAt(0)
            w = item.widget()
            if w:
                w.deleteLater()
        grid_container = QWidget()
        grid_container.setStyleSheet("background: transparent;")
        grid = QGridLayout(grid_container)
        grid.setContentsMargins(0, 0, 0, 0)
        grid.setHorizontalSpacing(10)
        grid.setVerticalSpacing(10)
        for i, p in enumerate(items):
            r = i // cols
            c = i % cols
            card = self._build_manager_card(p, wide=False)
            grid.addWidget(card, r, c)
        # 让两列等宽
        grid.setColumnStretch(0, 1)
        grid.setColumnStretch(1, 1)
        self._content_lay.insertWidget(0, grid_container)

    def _render_list(self, items: List[Dict[str, Any]]):
        for p in items:
            card = self._build_manager_card(p, wide=True)
            self._content_lay.insertWidget(self._content_lay.count() - 1, card)

    def _build_manager_card(self, p: Dict[str, Any], wide: bool = False) -> QFrame:
        card = QFrame()
        card.setObjectName("managerCard")
        card.setCursor(Qt.PointingHandCursor)
        # 统一高度
        if wide:
            card.setFixedHeight(82)
        else:
            card.setFixedHeight(140)

        # 卡片阴影 —— 增强层次感（细腻多层投影，模拟 macOS 卡片）
        shadow = QGraphicsDropShadowEffect(card)
        shadow.setBlurRadius(12)
        shadow.setColor(QColor(0, 0, 0, 18))  # 极淡
        shadow.setOffset(0, 2)
        card.setGraphicsEffect(shadow)

        lay = QVBoxLayout(card)
        lay.setContentsMargins(14, 12, 14, 12)
        lay.setSpacing(5)

        # 头部
        head = QHBoxLayout()
        head.setSpacing(6)
        title = QLabel()
        title.setStyleSheet("font-size: 13px; font-weight: 600; color: #1d1d1f;")
        title.setWordWrap(False)
        from PySide6.QtGui import QFontMetrics, QFont
        f = QFont("Segoe UI", 9, QFont.DemiBold)
        title.setFont(f)
        full_title = p.get("title", "")
        metrics = QFontMetrics(f)
        max_w = 200 if not wide else 400
        title.setText(metrics.elidedText(full_title, Qt.ElideRight, max_w))
        head.addWidget(title)

        if p.get("favorite"):
            star = QLabel("★")
            star.setStyleSheet("color: #ff9f0a; font-size: 13px;")
            head.addWidget(star)
        head.addStretch()

        # 分类标签
        cat = p.get("category")
        if cat:
            cat_badge = QLabel(cat)
            cat_badge.setStyleSheet(
                "color: #6e6e73; font-size: 10.5px; background: #f0f0f5;"
                "border-radius: 8px; padding: 2px 8px;"
            )
            head.addWidget(cat_badge)
        lay.addLayout(head)

        # 内容预览 —— 截断带省略号
        snippet_text = p.get("content", "").replace("\n", " ")
        snippet = QLabel()
        snippet.setStyleSheet(f"color: {COLOR_TEXT_2}; font-size: 11.5px;")
        snippet.setWordWrap(True if not wide else False)
        if wide:
            sn_f = QFont("Segoe UI", 9)
            snippet.setFont(sn_f)
            sn_metrics = QFontMetrics(sn_f)
            snippet.setText(sn_metrics.elidedText(snippet_text, Qt.ElideRight, 500))
        else:
            # 网格视图：截断到 2 行
            if len(snippet_text) > 70:
                snippet_text = snippet_text[:70] + "…"
            snippet.setText(snippet_text)
        if wide:
            snippet.setMaximumHeight(34)
        else:
            snippet.setMaximumHeight(48)
            snippet.setMinimumHeight(34)
        lay.addWidget(snippet)

        # 元信息行
        meta = QHBoxLayout()
        meta.setSpacing(6)
        var_count = len(extract_vars(p.get("content", "")))
        if var_count:
            vb = QLabel(f"⚙ {var_count} 变量")
            vb.setStyleSheet("color: #007aff; font-size: 10.5px; background: #e8f1ff; border-radius: 8px; padding: 2px 7px;")
            meta.addWidget(vb)
        for t in (p.get("tags") or [])[:3]:
            tb = QLabel(t)
            tb.setStyleSheet("color: #6e6e73; font-size: 10.5px; background: #f0f0f5; border-radius: 8px; padding: 2px 7px;")
            meta.addWidget(tb)
        if p.get("usageCount"):
            uc = QLabel(f"↻ {p['usageCount']}")
            uc.setStyleSheet(f"color: {COLOR_TEXT_3}; font-size: 10.5px;")
            meta.addWidget(uc)
        meta.addStretch()

        # 操作按钮
        edit_btn = QPushButton("编辑")
        edit_btn.setStyleSheet(
            "background: transparent; border: 1px solid #d4d4dc; border-radius: 6px;"
            "padding: 3px 10px; color: #1d1d1f; font-size: 11px;"
        )
        edit_btn.clicked.connect(lambda _=False, pid=p.get("id"): self._open_edit(pid))
        meta.addWidget(edit_btn)

        vars_ = extract_vars(p.get("content", ""))
        copy_btn = QPushButton("填写并复制" if vars_ else "复制")
        copy_btn.setStyleSheet(
            "background: #007aff; border: 1px solid #007aff; color: #ffffff;"
            "border-radius: 6px; padding: 3px 10px; font-size: 11px;"
        )
        copy_btn.clicked.connect(lambda _=False, pp=p: self._quick_copy(pp))
        meta.addWidget(copy_btn)

        lay.addLayout(meta)

        # 双击编辑
        card.mouseDoubleClickEvent = lambda e, pid=p.get("id"): self._open_edit(pid)  # type: ignore

        return card

    def _open_edit(self, pid: Optional[str]):
        dlg = EditDialog(self._store, pid, parent=self)
        dlg.show()
        dlg.raise_()
        dlg.activateWindow()
        # 编辑后刷新（关闭时刷新）
        dlg.destroyed.connect(lambda _=None: self._refresh())

    def _quick_copy(self, p: Dict[str, Any]):
        vars_ = extract_vars(p.get("content", ""))
        if vars_:
            dlg = VarFillDialogMgr(p, parent=self)
            dlg.show()
            dlg.destroyed.connect(lambda _=None: self._refresh())
        else:
            QApplication.clipboard().setText(p.get("content", ""))
            self._store.bump_usage(p.get("id"))
            self.statusBar().showMessage(f"已复制：{p.get('title', '')}", 2000)

    def _export(self):
        path, _ = QFileDialog.getSaveFileName(
            self, "导出提示词库", "prompts.json", "JSON 文件 (*.json)"
        )
        if not path:
            return
        try:
            data = self._store.export_all()
            with open(path, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            self.statusBar().showMessage(f"已导出到：{path}", 3000)
        except Exception as e:
            QMessageBox.warning(self, "导出失败", str(e))

    def _import(self):
        path, _ = QFileDialog.getOpenFileName(
            self, "导入提示词库", "", "JSON 文件 (*.json)"
        )
        if not path:
            return
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
            added = self._store.import_merge(data)
            self._refresh()
            QMessageBox.information(self, "导入完成", f"新增 {added} 条提示词")
        except Exception as e:
            QMessageBox.warning(self, "导入失败", str(e))

    def closeEvent(self, e):
        # 关闭时只隐藏，让托盘继续运行
        e.accept()
