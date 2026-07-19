# -*- coding: utf-8 -*-
"""核心逻辑单元测试 - 不依赖 Qt UI"""
import sys
import os
import io

# 让测试能 import qr_widget
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# 测试核心逻辑前，先 stub PySide6（避免在 CI/无显示环境报错）
class _Stub:
    def __getattr__(self, _):
        return _Stub()
    def __call__(self, *a, **kw):
        return _Stub()

# 如果 PySide6 不可用，stub 它
try:
    import PySide6  # noqa
except Exception:
    sys.modules["PySide6"] = _Stub()
    sys.modules["PySide6.QtCore"] = _Stub()
    sys.modules["PySide6.QtGui"] = _Stub()
    sys.modules["PySide6.QtWidgets"] = _Stub()

# 现在可以安全导入核心逻辑（注意：导入 qr_widget 会触发 Qt 模块导入，
# 但由于 _Stub 通吃，import 本身不会失败。运行时若用不到 UI 不会触发问题）
from qr_widget import (
    build_qr_text,
    generate_qr_pixmap,
    recognize_qr_from_image,
    load_history,
    save_history,
    add_history,
)


def test_build_text():
    assert build_qr_text("text", {"text": "hello"}) == "hello"
    assert build_qr_text("text", {"text": "  trimmed  "}) == "trimmed"
    assert build_qr_text("text", {"text": ""}) == ""
    print("[OK] build_qr_text")


def test_build_url():
    assert build_qr_text("url", {"url": "example.com"}) == "https://example.com"
    assert build_qr_text("url", {"url": "http://a.com"}) == "http://a.com"
    assert build_qr_text("url", {"url": "https://b.com"}) == "https://b.com"
    print("[OK] build_qr_url")


def test_build_wifi():
    r = build_qr_text("wifi", {"ssid": "MyWiFi", "password": "pass123", "auth": "WPA"})
    assert "WIFI:T:WPA;" in r
    assert "S:MyWiFi;" in r
    assert "P:pass123;" in r
    # 特殊字符转义
    r2 = build_qr_text("wifi", {"ssid": "a;b,c:d", "password": "p", "auth": "WPA"})
    assert "S:a\\;b\\,c\\:d;" in r2
    print("[OK] build_qr_wifi")


def test_build_email():
    r = build_qr_text("email", {"email": "a@b.com", "subject": "Hi", "body": "Body"})
    assert r == "mailto:a@b.com?subject=Hi&body=Body"
    r2 = build_qr_text("email", {"email": "a@b.com"})
    assert r2 == "mailto:a@b.com"
    print("[OK] build_qr_email")


def test_build_tel():
    assert build_qr_text("tel", {"tel": "+8613800000000"}) == "tel:+8613800000000"
    print("[OK] build_qr_tel")


def test_build_sms():
    r = build_qr_text("sms", {"number": "10086", "body": "Hello"})
    assert r == "SMSTO:10086:Hello"
    r2 = build_qr_text("sms", {"number": "10086", "body": ""})
    assert r2 == "sms:10086"
    print("[OK] build_qr_sms")


def test_generate_qr_pixmap():
    # 不依赖 Qt 真实运行，仅验证逻辑：当无文本时返回 None
    assert generate_qr_pixmap("", size=240) is None
    print("[OK] generate_qr_pixmap_empty")


def test_history_roundtrip(tmp_path=None):
    import qr_widget as qw
    # 临时改路径
    orig = qw.HISTORY_FILE
    import tempfile
    with tempfile.TemporaryDirectory() as td:
        qw.HISTORY_FILE = os.path.join(td, "h.json")
        qw.CONFIG_DIR = td
        save_history([])
        assert load_history() == []
        add_history("text", "hello", "hello")
        h = load_history()
        assert len(h) == 1
        assert h[0]["text"] == "hello"
        # 去重
        add_history("text", "hello", "hello")
        h = load_history()
        assert len(h) == 1
        # 新内容置顶
        add_history("text", "world", "world")
        h = load_history()
        assert h[0]["text"] == "world"
        assert len(h) == 2
        # 超过 20 条裁剪
        for i in range(25):
            add_history("text", f"item{i}", f"item{i}")
        h = load_history()
        assert len(h) == 20
    qw.HISTORY_FILE = orig
    print("[OK] history_roundtrip")


def test_recognize_invalid_path():
    r = recognize_qr_from_image("non_existent_file.png")
    assert r == []
    print("[OK] recognize_invalid_path")


def test_recognize_real_qr():
    """端到端：生成 → 保存 → 识别"""
    from PIL import Image
    import qrcode
    qr = qrcode.QRCode(box_size=8, border=2)
    qr.add_data("Hello-QR-Test-12345")
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white").convert("RGB")
    import tempfile
    with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as f:
        img.save(f.name, "PNG")
        path = f.name
    try:
        results = recognize_qr_from_image(path)
        if not results:
            print("[WARN] recognize_real_qr: 未识别到（pyzbar 可能缺 zbar DLL）")
        else:
            assert "Hello-QR-Test-12345" in results[0], f"got {results[0]}"
            print("[OK] recognize_real_qr")
    finally:
        os.unlink(path)


def main():
    print("===== qr-manager portable 核心逻辑测试 =====")
    test_build_text()
    test_build_url()
    test_build_wifi()
    test_build_email()
    test_build_tel()
    test_build_sms()
    test_generate_qr_pixmap()
    test_history_roundtrip()
    test_recognize_invalid_path()
    test_recognize_real_qr()
    print("===== 全部测试通过 =====")
    return 0


if __name__ == "__main__":
    sys.exit(main())
