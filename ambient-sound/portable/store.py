# -*- coding: utf-8 -*-
"""store.py - 本地 JSON 存储（音量/预设/设置持久化）"""
import json
import os
import threading

APP_NAME = "环境音便携版"
APP_DIR = os.path.join(os.environ.get("APPDATA", os.path.expanduser("~")), APP_NAME)
STORE_PATH = os.path.join(APP_DIR, "settings.json")

# 默认预设
DEFAULT_PRESETS = [
    {"name": "深度专注", "sounds": {"rain": 0.55, "brown": 0.30}},
    {"name": "安心助眠", "sounds": {"waves": 0.55, "pink": 0.30}},
    {"name": "冥想放松", "sounds": {"stream": 0.50, "wind": 0.30}},
    {"name": "雨夜书房", "sounds": {"rain": 0.60, "fire": 0.40}},
]

_lock = threading.Lock()


def _ensure_dir():
    os.makedirs(APP_DIR, exist_ok=True)


def load():
    """加载本地设置，返回 dict"""
    with _lock:
        try:
            if os.path.exists(STORE_PATH):
                with open(STORE_PATH, "r", encoding="utf-8") as f:
                    return json.load(f)
        except Exception as e:
            print(f"[store] 加载失败: {e}")
        return {}


def save(data):
    """原子写入本地设置"""
    with _lock:
        try:
            _ensure_dir()
            tmp = STORE_PATH + ".tmp"
            with open(tmp, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            os.replace(tmp, STORE_PATH)
        except Exception as e:
            print(f"[store] 保存失败: {e}")


def get_volumes():
    """获取各声音音量"""
    data = load()
    return data.get("volumes", {s["id"]: 0.6 for s in __import__("synth").SOUNDS})


def set_volumes(volumes):
    data = load()
    data["volumes"] = volumes
    save(data)


def get_master():
    return load().get("master", 0.8)


def set_master(v):
    data = load()
    data["master"] = v
    save(data)


def get_presets():
    return load().get("presets", DEFAULT_PRESETS)


def get_hotkey():
    return load().get("hotkey", "Ctrl+Shift+A")
