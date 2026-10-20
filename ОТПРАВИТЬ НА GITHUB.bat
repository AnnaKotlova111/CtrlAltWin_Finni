@echo off
chcp 866 >nul
title Отправка на GitHub
cd /d "%~dp0"

echo.
echo  ==========================================================
echo    Отправляем коммит "Питомец Финни 1.1" на GitHub.
echo  ==========================================================
echo.

git push --force-with-lease origin main

if errorlevel 1 (
  echo.
  echo  Не получилось. Покажите эти строки в чате.
) else (
  echo.
  echo  Готово. Коммит отправлен.
)

echo.
pause
