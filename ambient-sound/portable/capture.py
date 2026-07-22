# -*- coding: utf-8 -*-
"""capture.py - 后台截图工具

使用 Qt 内置 grab() 方法渲染组件到 QPixmap，不使用 CopyFromScreen。
后台启动应用（演示模式），应用自行截图后退出。
"""
import subprocess
import sys
import os
import time
from PIL import Image


def main():
    output_path = sys.argv[1] if len(sys.argv) > 1 else "D:\\Ai\\mimo\\screenshots\\ambient_portable.png"
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    port = os.path.dirname(os.path.abspath(__file__))
    # 后台启动应用（演示模式 + 截图模式）
    log_out = os.path.join(port, "capture_stdout.log")
    log_err = os.path.join(port, "capture_stderr.log")
    proc = subprocess.Popen(
        [sys.executable, os.path.join(port, "main.py"), "--demo", "--screenshot", output_path],
        cwd=port,
        stdout=open(log_out, "w"),
        stderr=open(log_err, "w"),
    )

    print(f"[capture] 已启动演示进程 PID={proc.pid}")
    print(f"[capture] 等待应用截图（含音频合成约 35 秒）...")

    # 等待进程退出（最长 120 秒）
    for i in range(120):
        time.sleep(1)
        ret = proc.poll()
        if ret is not None:
            print(f"[capture] 进程已退出 (code={ret})，第 {i+1} 秒")
            break
    else:
        print("[capture] 超时，强制终止")
        proc.kill()
        proc.wait(timeout=5)
        return False

    # 检查截图文件
    if not os.path.exists(output_path):
        print(f"[capture] 截图文件不存在: {output_path}")
        return False

    # 验证截图内容
    img = Image.open(output_path)
    print(f"[capture] 截图已保存: {output_path} ({img.size[0]}x{img.size[1]})")

    # 确保进程已终止
    if proc.poll() is None:
        proc.kill()
        proc.wait(timeout=5)

    return True


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
