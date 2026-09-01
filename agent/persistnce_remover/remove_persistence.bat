@echo off
setlocal EnableDelayedExpansion

echo ========================================================
echo Removing Agent Persistence Mechanisms and WMI Subscriptions
echo ========================================================
echo.

:: 1. Check for Administrator privileges
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [!] WARNING: Running without Administrator privileges!
    echo     WMI cleanup requires elevated rights.
    echo     Please right-click and "Run as Administrator".
    pause
    exit /b 1
)

echo [*] Terminating running agent and watchdog processes...
taskkill /F /IM securityhealthservice.exe /T 2>nul
taskkill /F /IM securityhelper.exe /T 2>nul
taskkill /F /IM scrcons.exe /T 2>nul
powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like '*watchdog_action*' -or $_.ExecutablePath -like '*SecurityHealth*' } | Stop-Process -Force -ErrorAction SilentlyContinue" 2>nul

echo [*] Removing Scheduled Tasks...
schtasks /delete /tn "Microsoft Security Health Service" /f 2>nul
schtasks /delete /tn "HealthServiceRecovery" /f 2>nul
schtasks /delete /tn "SecurityHealthService" /f 2>nul
schtasks /delete /tn "SecurityHealthHelper" /f 2>nul

echo [*] Removing Registry Run Keys...
reg delete "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v "Microsoft Security Health Service" /f 2>nul
reg delete "HKLM\Software\Microsoft\Windows\CurrentVersion\Run" /v "Microsoft Security Health Service" /f 2>nul
reg delete "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v "HealthServiceRecovery" /f 2>nul
reg delete "HKLM\Software\Microsoft\Windows\CurrentVersion\Run" /v "HealthServiceRecovery" /f 2>nul
reg delete "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v "securityhelper" /f 2>nul
reg delete "HKLM\Software\Microsoft\Windows\CurrentVersion\Run" /v "securityhelper" /f 2>nul

echo [*] Removing Windows Defender Exclusions (if any were added)...
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { Remove-MpPreference -ExclusionPath '$env:ProgramData\Microsoft\SecurityHealth' -ErrorAction SilentlyContinue; Remove-MpPreference -ExclusionPath '$env:ProgramData\Microsoft\Windows\securityhelper.exe' -ErrorAction SilentlyContinue; Remove-MpPreference -ExclusionProcess 'securityhealthservice.exe' -ErrorAction SilentlyContinue; Remove-MpPreference -ExclusionProcess 'securityhelper.exe' -ErrorAction SilentlyContinue } catch {}" 2>nul

echo [*] Removing WMI Watchdog Persistence via PowerShell...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$hostHash = [System.BitConverter]::ToString([System.Security.Cryptography.MD5]::Create().ComputeHash([System.Text.Encoding]::UTF8.GetBytes($env:COMPUTERNAME))).Replace('-','').Substring(0,10); $filterName = 'F_' + $hostHash; $consumerName = 'C_' + $hostHash; $timerName = 'T_' + $hostHash; foreach ($ns in @('root\subscription', 'root\cimv2')) { Get-CimInstance -Namespace $ns -ClassName __FilterToConsumerBinding -ErrorAction SilentlyContinue | Where-Object { $_.Filter.Name -like ('*'+$hostHash+'*') -or $_.Filter.Name -like ('*'+$filterName+'*') -or $_.Consumer.Name -like ('*'+$consumerName+'*') } | Remove-CimInstance -ErrorAction SilentlyContinue; Get-CimInstance -Namespace $ns -ClassName CommandLineEventConsumer -ErrorAction SilentlyContinue | Where-Object { $_.Name -eq $consumerName -or $_.CommandLineTemplate -like '*watchdog_action*' } | Remove-CimInstance -ErrorAction SilentlyContinue; Get-CimInstance -Namespace $ns -ClassName __EventFilter -ErrorAction SilentlyContinue | Where-Object { $_.Name -eq $filterName -or $_.Name -like ('*'+$hostHash+'*') } | Remove-CimInstance -ErrorAction SilentlyContinue; Get-CimInstance -Namespace $ns -ClassName __IntervalTimerInstruction -ErrorAction SilentlyContinue | Where-Object { $_.TimerId -eq $timerName -or $_.TimerId -like ('*'+$hostHash+'*') } | Remove-CimInstance -ErrorAction SilentlyContinue; }" 2>nul

echo [*] Removing Junction Points and Unhiding Files...
rmdir "%ProgramData%\Microsoft\SecurityHealth\GhostRoot\A" 2>nul
rmdir "%ProgramData%\Microsoft\SecurityHealth\GhostRoot\B" 2>nul
fsutil reparsepoint delete "%ProgramData%\Microsoft\SecurityHealth\GhostRoot\A" 2>nul
fsutil reparsepoint delete "%ProgramData%\Microsoft\SecurityHealth\GhostRoot\B" 2>nul
attrib -h -s -r /s /d "%ProgramData%\Microsoft\SecurityHealth\*" 2>nul
attrib -h -s -r "%ProgramData%\Microsoft\Windows\securityhelper.exe" 2>nul
attrib -h -s -r "%ProgramData%\Microsoft\Windows\watchdog_action.ps1" 2>nul

echo [*] Deleting Executable Binaries and Scripts...
del /F /Q /A "%ProgramData%\Microsoft\SecurityHealth\securityhealthservice.exe" 2>nul
del /F /Q /A "%ProgramData%\Microsoft\Windows\securityhelper.exe" 2>nul
del /F /Q /A "%ProgramData%\Microsoft\Windows\watchdog_action.ps1" 2>nul

echo [*] Deleting Logs, Locks, and State files...
del /F /Q /A "%ProgramData%\Microsoft\SecurityHealth\watchdog.log*" 2>nul
del /F /Q /A "%ProgramData%\Microsoft\SecurityHealth\.last_restart" 2>nul
del /F /Q /A "%APPDATA%\.c2_agent_state.json" 2>nul
del /F /Q /A "%LOCALAPPDATA%\.c2_agent_state.json" 2>nul
del /F /Q /A "%USERPROFILE%\.c2_agent_state.json" 2>nul
del /F /Q /A "%SystemDrive%\.c2_agent_state.json" 2>nul
del /F /Q /A "C:\Users\Public\.c2_agent_state.json" 2>nul
del /F /Q /A "C:\ProgramData\.c2_agent_state.json" 2>nul
del /F /Q /A "%TEMP%\agent_log.txt" 2>nul
del /F /Q /A "%TEMP%\agent.lock" 2>nul
del /F /Q /A "%TEMP%\shs_*.tmp" 2>nul
del /F /Q /A "%TEMP%\cleanup.bat" 2>nul

echo [*] Removing Directories...
rmdir /S /Q "%ProgramData%\Microsoft\SecurityHealth\GhostRoot" 2>nul
rmdir /S /Q "%ProgramData%\Microsoft\SecurityHealth" 2>nul

echo.
echo ========================================================
echo Removal Complete! All known traces have been wiped.
echo ========================================================
pause