# -*- coding: utf-8 -*-
"""截图模式启动器 - 清除旧数据，注入种子数据，启动截图"""
import os
import sys

# 清除旧数据，确保截图有完整的种子数据
data_dir = os.path.join(os.environ.get("APPDATA", ""), "SnippetManagerPortable")
os.makedirs(data_dir, exist_ok=True)
store_path = os.path.join(data_dir, "snippets.json")
if os.path.exists(store_path):
    os.unlink(store_path)

os.environ["SM_AUTO_SCREENSHOT"] = r"D:\Ai\mimo\screenshots\snippet-portable.png"
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from main import run_screenshot_mode
run_screenshot_mode()
