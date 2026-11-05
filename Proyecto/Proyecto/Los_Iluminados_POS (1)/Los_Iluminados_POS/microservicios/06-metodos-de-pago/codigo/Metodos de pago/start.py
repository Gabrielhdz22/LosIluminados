import os
import sys
import subprocess
import time
import threading
import webbrowser
from pathlib import Path

RAIZ = Path(__file__).resolve().parent
ENTORNO = RAIZ / ".venv"
PYTHON = ENTORNO / ("Scripts" if os.name == "nt" else "bin") / ("python.exe" if os.name == "nt" else "python")


def ejecutar(*argumentos):
    print(">", " ".join(map(str, argumentos)))
    subprocess.check_call(list(map(str, argumentos)), cwd=RAIZ)


def main():
    if not PYTHON.exists():
        print("Preparando entorno de Python...")
        ejecutar(sys.executable, "-m", "venv", str(ENTORNO))

    print("Instalando/verificando componentes necesarios...")
    ejecutar(PYTHON, "-m", "pip", "install", "--disable-pip-version-check", "-r", str(RAIZ / "requirements.txt"))

    print("\nIniciando Microservicio de Métodos de Pago...")
    print("Documentación: http://127.0.0.1:8000/documentacion")
    print("Presiona Ctrl+C para detenerlo.\n")

    def abrir_navegador():
        time.sleep(1.5)
        webbrowser.open("http://127.0.0.1:8000/documentacion")

    threading.Thread(target=abrir_navegador, daemon=True).start()
    os.environ.setdefault("PYTHONUNBUFFERED", "1")
    subprocess.call(
        [str(PYTHON), "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8000"],
        cwd=RAIZ,
    )


if __name__ == "__main__":
    main()
