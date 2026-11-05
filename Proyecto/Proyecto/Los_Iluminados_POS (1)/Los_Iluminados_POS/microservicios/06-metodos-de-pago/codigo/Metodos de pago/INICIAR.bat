@echo off
setlocal
cd /d "%~dp0"

title Microservicio de Metodos de Pago

echo ============================================================
echo        MICROSERVICIO DE METODOS DE PAGO
 echo        Iniciando automaticamente...
echo ============================================================
echo.

where py >nul 2>nul
if %errorlevel%==0 (
    py start.py
    goto :fin
)

where python >nul 2>nul
if %errorlevel%==0 (
    python start.py
    goto :fin
)

echo NO SE ENCONTRO PYTHON EN ESTE EQUIPO.
echo.
echo Instala Python 3.10 o superior desde:
echo https://www.python.org/downloads/windows/
echo.
echo IMPORTANTE: marca "Add python.exe to PATH" durante la instalacion.
echo.
pause

goto :fin

:fin
if errorlevel 1 (
    echo.
    echo El servicio se cerro con un error.
    pause
)
endlocal
