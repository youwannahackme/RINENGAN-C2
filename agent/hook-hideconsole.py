import ctypes
import platform
if platform.system() == "Windows":
    try:
        ctypes.windll.user32.ShowWindow(ctypes.windll.kernel32.GetConsoleWindow(), 0)
        ctypes.windll.kernel32.FreeConsole()
    except:
        pass