@echo off
setlocal DisableDelayedExpansion
chcp 65001 >nul
title Codex for Zotero - Windows 环境检查
echo Codex for Zotero - Research Bridge 0.6.5 - Windows 环境检查
echo 此工具只检查本机程序和登录状态，不安装软件、不发送论文、不显示登录令牌。
echo.
set "CZ_RESULT=1"
set "CZ_EXE="
if not "%~1"=="" goto explicit

for /f "delims=" %%I in ('where.exe codex.exe 2^>nul') do if not defined CZ_EXE set "CZ_EXE=%%I"
if defined CZ_EXE goto found
if not defined LOCALAPPDATA goto standalone
for /f "delims=" %%D in ('dir /b /ad /o:-d "%LOCALAPPDATA%\OpenAI\Codex\bin" 2^>nul') do if not defined CZ_EXE if exist "%LOCALAPPDATA%\OpenAI\Codex\bin\%%D\codex.exe" set "CZ_EXE=%LOCALAPPDATA%\OpenAI\Codex\bin\%%D\codex.exe"
if defined CZ_EXE goto found

:standalone
if defined CODEX_INSTALL_DIR if exist "%CODEX_INSTALL_DIR%\codex.exe" set "CZ_EXE=%CODEX_INSTALL_DIR%\codex.exe"
if defined CZ_EXE goto found
if defined LOCALAPPDATA if exist "%LOCALAPPDATA%\Programs\OpenAI\Codex\bin\codex.exe" set "CZ_EXE=%LOCALAPPDATA%\Programs\OpenAI\Codex\bin\codex.exe"
if defined CZ_EXE goto found
for /f "delims=" %%I in ('where.exe codex.cmd 2^>nul') do call :npmShim "%%I"
if defined CZ_EXE goto found
if defined APPDATA call :scanNpm "%APPDATA%\npm\node_modules\@openai"
if defined CZ_EXE goto found
if defined ProgramFiles call :scanNpm "%ProgramFiles%\nodejs\node_modules\@openai"
if defined CZ_EXE goto found

echo [未找到] 原生 Windows codex.exe。
echo 请先按照“开始这里.html”安装并登录 Codex，然后关闭本窗口重新检查。
echo 只有 WSL 中的 Codex 不满足此插件的 Windows 连接要求。
echo 自定义安装位置：把真实的 codex.exe 文件拖到本 CMD 文件上，可指定检查该程序。
goto finish

:explicit
if /i not "%~x1"==".exe" goto invalid
if not exist "%~1" goto invalid
set "CZ_EXE=%~f1"
goto found

:invalid
echo [路径无效] 请指定存在的 codex.exe 文件，不能指定 codex.cmd 或整个文件夹。
goto finish

:found
echo [程序路径] 把下一行复制到插件设置的“Codex 程序路径”，无需添加引号：
echo "%CZ_EXE%"
echo 复制时去掉上面路径两端的双引号。
echo 更新 Codex 后如果旧路径失效，请重新运行本工具。
echo.
echo [版本]
"%CZ_EXE%" --version
if errorlevel 1 goto badRuntime
echo.
"%CZ_EXE%" login status >nul 2>&1
if errorlevel 1 goto notLoggedIn
echo [登录状态] CLI 报告已有登录凭据。账号额度和在线请求是否成功，需要在插件内发送问题确认。
goto appServer

:notLoggedIn
echo [登录状态] 未登录，或 CLI 无法读取当前用户的凭据。
echo 在 PowerShell 中执行下面一行，使用自己的账号完成登录：
echo ^& "%CZ_EXE%" login
echo 不要使用管理员或其他 Windows 用户代为登录。

:appServer
echo.
"%CZ_EXE%" app-server --help >nul 2>&1
if errorlevel 1 goto noAppServer
echo [接口] 已提供 app-server 命令。此检查不调用模型，不验证每一项协议能力。
echo [下一步] 在 Zotero 的 Codex 窗口点击齿轮，填写上面的程序路径，再点“保存路径并重连”。
set "CZ_RESULT=0"
goto finish

:noAppServer
echo [接口不可用] 请从官方渠道更新 Codex；需要支持 app-server 的原生 Windows 版本。
goto finish

:badRuntime
echo [运行失败] 程序可能缺少配套文件、架构不匹配，或被系统策略限制。
echo 请重新安装完整的官方 Codex，勿只复制别人电脑上的 codex.exe。
goto finish

:npmShim
if defined CZ_EXE exit /b
call :scanNpm "%~dp1node_modules\@openai"
exit /b

:scanNpm
if defined CZ_EXE exit /b
if not exist "%~1" exit /b
for /r "%~1" %%E in (codex.exe) do if not defined CZ_EXE if exist "%%E" set "CZ_EXE=%%E"
exit /b

:finish
echo.
echo 安装和故障排查请看“开始这里.html”或“安装与使用说明.md”。
if /i "%~2"=="--no-pause" goto end
pause
:end
exit /b %CZ_RESULT%
