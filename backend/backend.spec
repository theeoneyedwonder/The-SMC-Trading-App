# -*- mode: python ; coding: utf-8 -*-
# PyInstaller spec for the SMC Bot backend
# Run from the backend/ directory:
#   pyinstaller backend.spec --clean --noconfirm

from PyInstaller.utils.hooks import collect_all

# Collect MetaTrader5 native binaries / data automatically
mt5_datas, mt5_binaries, mt5_hidden = collect_all('MetaTrader5')

a = Analysis(
    ['main.py'],
    pathex=['.'],
    binaries=mt5_binaries,
    datas=mt5_datas,
    hiddenimports=mt5_hidden + [
        # Anthropic SDK
        'anthropic',
        'httpx',
        'httpx._transports.default',
        'httpcore',
        'httpcore._async.interfaces',
        'httpcore._sync.interfaces',
        # uvicorn doesn't auto-discover all its sub-modules
        'uvicorn.logging',
        'uvicorn.loops',
        'uvicorn.loops.auto',
        'uvicorn.loops.asyncio',
        'uvicorn.protocols',
        'uvicorn.protocols.http',
        'uvicorn.protocols.http.auto',
        'uvicorn.protocols.http.h11_impl',
        'uvicorn.protocols.websockets',
        'uvicorn.protocols.websockets.auto',
        'uvicorn.protocols.websockets.websockets_impl',
        'uvicorn.lifespan',
        'uvicorn.lifespan.on',
        'uvicorn.lifespan.off',
        'anyio',
        'anyio._backends._asyncio',
        'starlette.routing',
        'starlette.middleware.cors',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='smc-bot-backend',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=True,           # keep console output (Electron pipes it)
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='smc-bot-backend',
)
