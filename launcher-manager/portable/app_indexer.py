# -*- coding: utf-8 -*-
"""应用索引器 —— 扫描 Windows 开始菜单和桌面快捷方式
忠实移植自原 Electron 版 src/lib/appIndexer.js。"""

from __future__ import annotations
import os
from typing import List, Dict, Set


# 不需要的应用关键词（卸载、帮助等）
_UNWANTED_KEYWORDS = ('uninstall', '卸载', 'help', 'readme', 'license',
                      '访问网站', 'website')

# 合法的扩展名
_VALID_EXTS = ('.lnk', '.url', '.exe')

# 最大扫描深度
_MAX_DEPTH = 4


def _get_scan_dirs() -> List[str]:
    """返回需要扫描的目录列表。"""
    user = os.path.expanduser('~')
    program_data = os.environ.get('ProgramData', r'C:\ProgramData')
    return [
        os.path.join(program_data, 'Microsoft', 'Windows', 'Start Menu', 'Programs'),
        os.path.join(user, 'AppData', 'Roaming', 'Microsoft', 'Windows',
                     'Start Menu', 'Programs'),
        os.path.join(user, 'Desktop'),
        os.path.join(r'C:\Users\Public', 'Desktop'),
    ]


def _is_unwanted(name: str) -> bool:
    n = name.lower()
    return any(k in n for k in _UNWANTED_KEYWORDS)


def _scan_dir(directory: str, found: List[Dict], seen: Set[str], depth: int = 0):
    """递归扫描目录，收集快捷方式。"""
    if depth > _MAX_DEPTH:
        return
    try:
        entries = os.scandir(directory)
    except (OSError, PermissionError):
        return
    for entry in entries:
        try:
            full = entry.path
            if entry.is_dir(follow_symlinks=False):
                _scan_dir(full, found, seen, depth + 1)
            elif entry.is_file(follow_symlinks=False):
                ext = os.path.splitext(entry.name)[1].lower()
                if ext in _VALID_EXTS:
                    name = os.path.splitext(entry.name)[0]
                    if full in seen:
                        continue
                    seen.add(full)
                    if _is_unwanted(name):
                        continue
                    found.append({
                        'name': name.strip(),
                        'path': full,
                        'ext': ext,
                    })
        except OSError:
            continue


def scan_apps() -> List[Dict]:
    """扫描所有应用快捷方式，返回按名称排序的应用列表。"""
    found: List[Dict] = []
    seen: Set[str] = set()
    for d in _get_scan_dirs():
        _scan_dir(d, found, seen)
    # 不区分大小写排序，中文跟随系统 locale
    found.sort(key=lambda a: a['name'].lower())
    return found



