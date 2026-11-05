Set-Location $PSScriptRoot
if (Get-Command py -ErrorAction SilentlyContinue) {
    py .\start.py
} elseif (Get-Command python -ErrorAction SilentlyContinue) {
    python .\start.py
} else {
    Write-Host "No se encontro Python 3.10+. Instala Python desde https://www.python.org/downloads/windows/"
    Read-Host "Presiona ENTER para salir"
}
