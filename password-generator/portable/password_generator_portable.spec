# -*- mode: python ; coding: utf-8 -*-
"""PyInstaller spec - 密码生成器便携版单文件打包

构建：pyinstaller portable/password_generator_portable.spec --noconfirm --clean
产物：dist/PasswordGeneratorPortable.exe（单文件，免安装）
"""

import os

block_cipher = None

a = Analysis(
    ['main.py'],
    pathex=[os.path.abspath('.')],
    binaries=[],
    datas=[
        # 打包图标资源（运行时由 resources.py 生成兜底，此处打包预生成版本）
        ('build/icon.ico', 'build'),
        ('build/icon.png', 'build'),
    ],
    hiddenimports=[],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        # 排除未使用的大模块以减小体积
        'tkinter', 'unittest', 'pydoc', 'doctest',
        'PySide6.Qt3D', 'PySide6.QtCharts', 'PySide6.QtDataVisualization',
        'PySide6.QtMultimedia', 'PySide6.QtNetwork', 'PySide6.QtOpenGL',
        'PySide6.QtQml', 'PySide6.QtQuick', 'PySide6.QtQuick3D',
        'PySide6.QtQuickWidgets', 'PySide6.QtSql', 'PySide6.QtTest',
        'PySide6.QtWebEngineCore', 'PySide6.QtWebEngineWidgets',
        'PySide6.QtWebSockets', 'PySide6.QtXml', 'PySide6.QtSvg',
        'PySide6.QtPdf', 'PySide6.QtPdfWidgets', 'PySide6.QtDesigner',
        'PySide6.QtHelp', 'PySide6.QtLocation', 'PySide6.QtPositioning',
        'PySide6.QtSensors', 'PySide6.QtSerialPort', 'PySide6.QtBluetooth',
    ],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='PasswordGeneratorPortable',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,  # 无控制台窗口
    disable_windowed_traceback=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon='build/icon.ico',
)
