# -*- coding: utf-8 -*-
"""TOTP 核心实现：RFC 6238 / RFC 4226 + Base32 解码 + otpauth:// 解析。
纯标准库实现，零依赖，可独立测试。"""
import hmac
import hashlib
import struct
import time
import urllib.parse

BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'


def base32_decode(s: str) -> bytes:
    """RFC 4648 Base32 解码（忽略空格、= 填充、大小写）。"""
    s = (s or '').upper().replace('=', '').replace(' ', '')
    bits = 0
    value = 0
    out = bytearray()
    for c in s:
        idx = BASE32_ALPHABET.find(c)
        if idx < 0:
            continue
        value = (value << 5) | idx
        bits += 5
        if bits >= 8:
            bits -= 8
            out.append((value >> bits) & 0xff)
    return bytes(out)


def hotp(secret: bytes, counter: int, digits: int = 6, algorithm: str = 'SHA1') -> str:
    """RFC 4226 HOTP。"""
    buf = struct.pack('>Q', counter)
    algo = {
        'SHA1': hashlib.sha1,
        'SHA256': hashlib.sha256,
        'SHA512': hashlib.sha512,
    }.get(algorithm.upper())
    if algo is None:
        raise ValueError(f'不支持的算法: {algorithm}')
    h = hmac.new(secret, buf, algo).digest()
    offset = h[-1] & 0x0f
    binary = (((h[offset] & 0x7f) << 24) |
              ((h[offset + 1] & 0xff) << 16) |
              ((h[offset + 2] & 0xff) << 8) |
              (h[offset + 3] & 0xff))
    return str(binary % (10 ** digits)).zfill(digits)


def totp_at(secret_b32: str, t: int, period: int = 30, digits: int = 6, algorithm: str = 'SHA1') -> str:
    """指定时间戳 t 处的 TOTP。"""
    key = base32_decode(secret_b32)
    counter = t // period
    return hotp(key, counter, digits, algorithm)


def totp_now(secret_b32: str, period: int = 30, digits: int = 6, algorithm: str = 'SHA1') -> str:
    """当前时间 TOTP。"""
    return totp_at(secret_b32, int(time.time()), period, digits, algorithm)


def seconds_remaining(period: int, t: int = None) -> int:
    """当前周期剩余秒数。"""
    if t is None:
        t = int(time.time())
    return period - (t % period)


def parse_otpauth(url: str) -> dict:
    """解析 otpauth://totp/Issuer:label?secret=...&issuer=...&period=...&digits=...&algorithm=...
    返回 dict: {issuer, label, secret, period, digits, algorithm}
    """
    url = (url or '').strip()
    if not url.startswith('otpauth://'):
        raise ValueError('不是 otpauth:// 链接')
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme != 'otpauth' or parsed.netloc.lower() != 'totp':
        raise ValueError('仅支持 otpauth://totp/')
    label = urllib.parse.unquote(parsed.path.lstrip('/'))
    issuer = ''
    if ':' in label:
        issuer, label = label.split(':', 1)
        label = label.strip()
    params = urllib.parse.parse_qs(parsed.query)
    secret = params.get('secret', [''])[0]
    if not secret:
        raise ValueError('缺少 secret 参数')
    issuer_q = params.get('issuer', [''])[0]
    if issuer_q:
        issuer = issuer_q
    period = int(params.get('period', ['30'])[0])
    digits = int(params.get('digits', ['6'])[0])
    algorithm = params.get('algorithm', ['SHA1'])[0].upper()
    return {
        'issuer': issuer.strip(),
        'label': label.strip(),
        'secret': secret.upper().replace(' ', ''),
        'period': period,
        'digits': digits,
        'algorithm': algorithm,
    }


def normalize_secret(s: str) -> str:
    """清理 secret：去空格、转大写。"""
    return (s or '').replace(' ', '').upper()
