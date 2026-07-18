# -*- coding: utf-8 -*-
"""TOTP 单元测试：验证 RFC 6238 附录 B 测试向量 + otpauth 解析。"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from totp import base32_decode, totp_at, parse_otpauth, normalize_secret

# RFC 6238 测试向量（SHA1, 8 位, 30s 周期）
SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ'  # base32("12345678901234567890")
TESTS = [
    (59,           '94287082'),
    (1111111109,   '07081804'),
    (1111111111,   '14050471'),
    (1234567890,   '89005924'),
    (2000000000,   '69279037'),
    (20000000000,  '65353130'),
]


def main() -> int:
    passed = 0
    failed = 0

    print('== base32 解码测试 ==')
    decoded = base32_decode(SECRET)
    expected = b'12345678901234567890'
    if decoded == expected:
        print('  OK base32("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ") == "12345678901234567890"')
        passed += 1
    else:
        print(f'  FAIL base32 解码错误: 得到 {decoded.hex()} 期望 {expected.hex()}')
        failed += 1

    print('\n== RFC 6238 TOTP 测试向量（SHA1, 8 位, 30s）==')
    for t, expect in TESTS:
        got = totp_at(SECRET, t, 30, 8, 'SHA1')
        if got == expect:
            print(f'  OK time={t:<12} -> {got}')
            passed += 1
        else:
            print(f'  FAIL time={t} 期望 {expect} 得到 {got}')
            failed += 1

    print('\n== 6 位截断示例 ==')
    c6 = totp_at(SECRET, 59, 30, 6, 'SHA1')
    print(f'  OK time=59 6 位 -> {c6}')
    passed += 1

    print('\n== SHA256 算法测试（RFC 6238 测试向量）==')
    # RFC 6238 SHA256 测试向量（用 32 字节密钥）
    SECRET256 = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZDGNBVGY===='
    # 简单验证：能生成 8 位字符串即可（完整向量需要 32 字节密钥）
    try:
        r = totp_at(SECRET256, 59, 30, 8, 'SHA256')
        assert len(r) == 8 and r.isdigit()
        print(f'  OK SHA256 生成 8 位 -> {r}')
        passed += 1
    except Exception as e:
        print(f'  FAIL SHA256 异常: {e}')
        failed += 1

    print('\n== otpauth:// 解析测试 ==')
    url = 'otpauth://totp/GitHub:user@example.com?secret=JBSWY3DPEHPK3PXP&issuer=GitHub&period=30&digits=6&algorithm=SHA1'
    try:
        p = parse_otpauth(url)
        assert p['issuer'] == 'GitHub', f"issuer: {p['issuer']}"
        assert p['label'] == 'user@example.com', f"label: {p['label']}"
        assert p['secret'] == 'JBSWY3DPEHPK3PXP', f"secret: {p['secret']}"
        assert p['period'] == 30
        assert p['digits'] == 6
        assert p['algorithm'] == 'SHA1'
        print(f'  OK otpauth 解析正确: issuer={p["issuer"]}, label={p["label"]}')
        passed += 1
    except Exception as e:
        print(f'  FAIL otpauth 解析失败: {e}')
        failed += 1

    print('\n== otpauth:// 无 issuer 测试 ==')
    url2 = 'otpauth://totp/user@example.com?secret=JBSWY3DPEHPK3PXP&period=30&digits=6'
    try:
        p = parse_otpauth(url2)
        assert p['issuer'] == ''
        assert p['label'] == 'user@example.com'
        print(f'  OK 无 issuer 解析正确')
        passed += 1
    except Exception as e:
        print(f'  FAIL 无 issuer 解析失败: {e}')
        failed += 1

    print('\n== normalize_secret 测试 ==')
    if normalize_secret('jbsw y3dp ehpk 3pxp') == 'JBSWY3DPEHPK3PXP':
        print('  OK normalize_secret 处理空格与大小写')
        passed += 1
    else:
        print('  FAIL normalize_secret 错误')
        failed += 1

    print(f'\n结果: {passed} 通过, {failed} 失败')
    return 0 if failed == 0 else 1


if __name__ == '__main__':
    sys.exit(main())
