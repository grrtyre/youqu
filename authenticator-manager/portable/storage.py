# -*- coding: utf-8 -*-
"""本地加密存储：使用 Windows DPAPI 加密整个 JSON 文件。
密钥绑定当前 Windows 用户账户，离开本机无法解密。"""
import os
import json
import time
import uuid
import ctypes
from ctypes import wintypes
from dataclasses import dataclass, asdict
from typing import List, Optional, Dict, Any


# ============ DPAPI ============

class _DATA_BLOB(ctypes.Structure):
    _fields_ = [
        ('cbData', wintypes.DWORD),
        ('pbData', ctypes.POINTER(ctypes.c_byte)),
    ]


_crypt32 = ctypes.windll.crypt32
_kernel32 = ctypes.windll.kernel32

# 函数签名
_crypt32.CryptProtectData.restype = wintypes.BOOL
_crypt32.CryptProtectData.argtypes = [
    ctypes.POINTER(_DATA_BLOB), wintypes.LPCWSTR,
    ctypes.POINTER(_DATA_BLOB), wintypes.HANDLE,
    ctypes.POINTER(_DATA_BLOB), wintypes.DWORD,
    ctypes.POINTER(_DATA_BLOB),
]
_crypt32.CryptUnprotectData.restype = wintypes.BOOL
_crypt32.CryptUnprotectData.argtypes = [
    ctypes.POINTER(_DATA_BLOB), ctypes.POINTER(wintypes.LPWSTR),
    ctypes.POINTER(_DATA_BLOB), wintypes.HANDLE,
    ctypes.POINTER(_DATA_BLOB), wintypes.DWORD,
    ctypes.POINTER(_DATA_BLOB),
]
_kernel32.LocalFree.argtypes = [wintypes.HLOCAL]
_kernel32.LocalFree.restype = wintypes.HLOCAL


def dpapi_protect(data: bytes, description: str = 'Authenticator') -> bytes:
    """DPAPI 加密。"""
    if not data:
        raise ValueError('数据为空')
    buf = ctypes.create_string_buffer(data, len(data))
    in_blob = _DATA_BLOB(len(data), ctypes.cast(buf, ctypes.POINTER(ctypes.c_byte)))
    out_blob = _DATA_BLOB()
    if not _crypt32.CryptProtectData(
            ctypes.byref(in_blob), description, None, None, None, 0, ctypes.byref(out_blob)):
        raise OSError('CryptProtectData 失败')
    try:
        return ctypes.string_at(out_blob.pbData, out_blob.cbData)
    finally:
        _kernel32.LocalFree(out_blob.pbData)


def dpapi_unprotect(data: bytes) -> bytes:
    """DPAPI 解密。"""
    if not data:
        raise ValueError('数据为空')
    buf = ctypes.create_string_buffer(data, len(data))
    in_blob = _DATA_BLOB(len(data), ctypes.cast(buf, ctypes.POINTER(ctypes.c_byte)))
    out_blob = _DATA_BLOB()
    if not _crypt32.CryptUnprotectData(
            ctypes.byref(in_blob), None, None, None, None, 0, ctypes.byref(out_blob)):
        raise OSError('CryptUnprotectData 失败')
    try:
        return ctypes.string_at(out_blob.pbData, out_blob.cbData)
    finally:
        _kernel32.LocalFree(out_blob.pbData)


# ============ 数据模型 ============

@dataclass
class Account:
    id: str
    issuer: str
    label: str
    secret: str
    period: int = 30
    digits: int = 6
    algorithm: str = 'SHA1'
    created_at: float = 0.0

    @classmethod
    def new(cls, issuer: str, label: str, secret: str,
            period: int = 30, digits: int = 6, algorithm: str = 'SHA1') -> 'Account':
        from totp import normalize_secret
        return cls(
            id=str(uuid.uuid4()),
            issuer=issuer.strip(),
            label=label.strip(),
            secret=normalize_secret(secret),
            period=period,
            digits=digits,
            algorithm=algorithm.upper(),
            created_at=time.time(),
        )

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> 'Account':
        return cls(
            id=d.get('id', str(uuid.uuid4())),
            issuer=d.get('issuer', ''),
            label=d.get('label', ''),
            secret=d.get('secret', ''),
            period=int(d.get('period', 30)),
            digits=int(d.get('digits', 6)),
            algorithm=str(d.get('algorithm', 'SHA1')).upper(),
            created_at=float(d.get('created_at', 0.0)),
        )


DEFAULT_SETTINGS = {
    'hotkey': 'Ctrl+Shift+A',
    'auto_hide': True,
    'hide_after_copy': True,
    'hide_delay_ms': 1200,
    'start_hidden': True,
}


# ============ 存储 ============

class Storage:
    """DPAPI 加密的本地 JSON 存储。"""

    def __init__(self, path: str):
        self.path = path

    def load(self) -> Dict[str, Any]:
        if not os.path.exists(self.path):
            return {'accounts': [], 'settings': dict(DEFAULT_SETTINGS)}
        try:
            with open(self.path, 'rb') as f:
                encrypted = f.read()
            if not encrypted:
                return {'accounts': [], 'settings': dict(DEFAULT_SETTINGS)}
            decrypted = dpapi_unprotect(encrypted)
            data = json.loads(decrypted.decode('utf-8'))
            if 'accounts' not in data:
                data['accounts'] = []
            if 'settings' not in data:
                data['settings'] = dict(DEFAULT_SETTINGS)
            else:
                # 合并默认值
                merged = dict(DEFAULT_SETTINGS)
                merged.update(data['settings'])
                data['settings'] = merged
            return data
        except OSError:
            # DPAPI 解密失败：可能是换用户/换机器。备份后返回空
            backup = self.path + '.corrupt-' + str(int(time.time()))
            try:
                os.replace(self.path, backup)
            except OSError:
                pass
            return {'accounts': [], 'settings': dict(DEFAULT_SETTINGS)}
        except json.JSONDecodeError:
            # 兼容明文 JSON 迁移
            try:
                with open(self.path, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except Exception:
                return {'accounts': [], 'settings': dict(DEFAULT_SETTINGS)}

    def save(self, data: Dict[str, Any]) -> None:
        plain = json.dumps(data, ensure_ascii=False, indent=2).encode('utf-8')
        encrypted = dpapi_protect(plain, 'Authenticator portable data')
        tmp = self.path + '.tmp'
        with open(tmp, 'wb') as f:
            f.write(encrypted)
        os.replace(tmp, self.path)


class AccountStore:
    """账户管理（基于 Storage）。"""

    def __init__(self, storage: Storage):
        self.storage = storage
        self._data: Dict[str, Any] = storage.load()

    @property
    def settings(self) -> Dict[str, Any]:
        return self._data['settings']

    def update_settings(self, patch: Dict[str, Any]) -> Dict[str, Any]:
        self._data['settings'].update(patch)
        self.storage.save(self._data)
        return dict(self._data['settings'])

    def list_accounts(self) -> List[Account]:
        return [Account.from_dict(a) for a in self._data['accounts']]

    def add_account(self, account: Account) -> None:
        self._data['accounts'].append(account.to_dict())
        self.storage.save(self._data)

    def update_account(self, account_id: str, patch: Dict[str, Any]) -> Optional[Account]:
        for i, a in enumerate(self._data['accounts']):
            if a['id'] == account_id:
                a.update(patch)
                if 'secret' in patch:
                    from totp import normalize_secret
                    a['secret'] = normalize_secret(a['secret'])
                self._data['accounts'][i] = a
                self.storage.save(self._data)
                return Account.from_dict(a)
        return None

    def delete_account(self, account_id: str) -> bool:
        before = len(self._data['accounts'])
        self._data['accounts'] = [a for a in self._data['accounts'] if a['id'] != account_id]
        after = len(self._data['accounts'])
        if before != after:
            self.storage.save(self._data)
            return True
        return False

    def find_duplicate(self, issuer: str, label: str, secret: str) -> bool:
        from totp import normalize_secret
        s_norm = normalize_secret(secret)
        for a in self._data['accounts']:
            if (a.get('issuer', '').strip() == issuer.strip() and
                    a.get('label', '').strip() == label.strip() and
                    a.get('secret', '').upper() == s_norm):
                return True
        return False
