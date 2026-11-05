@echo off
setlocal
cd /d "%~dp0"

title Microservicio de Metodos de Pago - App de Pruebas

echo ========================================================
echo   MICROSERVICIO DE METODOS DE PAGO - APP DE PRUEBAS
echo ========================================================
echo.

where python >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python no esta instalado.
    echo Instala Python 3.10 o superior y vuelve a ejecutar este archivo.
    pause
    exit /b 1
)

if not exist ".venv\Scripts\python.exe" (
    echo Creando entorno de Python...
    python -m venv .venv
    if errorlevel 1 (
        echo No se pudo crear el entorno virtual.
        pause
        exit /b 1
    )
)

echo Verificando e instalando dependencias...
.venv\Scripts\python.exe -m pip install --disable-pip-version-check -q -r requirements.txt
if errorlevel 1 (
    echo No se pudieron instalar las dependencias.
    pause
    exit /b 1
)

echo.
echo Iniciando panel de pruebas...
echo Cierra la ventana de la aplicacion para detener el microservicio.
echo.
.venv\Scripts\python.exe app_pruebas.py

endlocal
