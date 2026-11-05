# Microservicio de Métodos de Pago — versión 2.0

Proyecto académico en Python para administrar métodos de pago y registrar pagos de demostración.

## Inicio rápido

1. Tener Python 3.10 o superior instalado.
2. Ejecutar `INICIAR_PRUEBAS.bat`.
3. El archivo crea el entorno virtual, instala dependencias, inicia el microservicio y abre la aplicación de escritorio.

No es necesario ejecutar primero `INICIAR.bat`.

## Componentes

- FastAPI + Uvicorn: API REST.
- SQLite: base de datos local `pagos.db`.
- Tkinter: aplicación de escritorio para pruebas.
- Swagger: `http://127.0.0.1:8000/documentacion`.

## Funciones de la aplicación

- Resumen con estado del servicio, cantidad de métodos, métodos habilitados, pagos y monto total.
- Crear métodos de pago.
- Consultar métodos.
- Habilitar/deshabilitar métodos.
- Eliminar métodos sin pagos asociados.
- Registrar pagos de prueba.
- Consultar pagos.
- Eliminar pagos de prueba.
- Eliminar todos los datos de prueba.
- Ver la última respuesta JSON de la API.

La interfaz está diseñada para caber cómodamente en una pantalla de 1920 x 1080 y también se puede redimensionar.

Los pagos son simulados y no realizan cargos reales.
