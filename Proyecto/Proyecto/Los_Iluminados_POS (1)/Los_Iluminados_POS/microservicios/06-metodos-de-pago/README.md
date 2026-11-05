# Métodos de Pago

- **Estado:** Con cambios
- **Responsable:** Sergio
- **Repositorio:** https://github.com/Gabrielhdz22/Microservicio

## Modificaciones necesarias

Adaptar su administración de métodos de pago al flujo del POS y definir su integración con SQL Server.

## Integración en la app

- **Archivo:** `frontend/js/services/metodosPago.js` (objeto `paymentMethodsService`)
- **Dónde se usa:** Selector del pago: efectivo de mostrador y tarjetas guardadas (marca + últimos 4).
- **Estado actual:** modo local (guarda en `localStorage` del navegador).
- **Para conectar el servicio real:** reemplaza el cuerpo de los métodos de `paymentMethodsService` por llamadas `fetch` a su API. El resto de la app no cambia.

## Código

Ejecuta `clonar-microservicios.sh` (o clona el repositorio a mano) dentro de la carpeta `codigo/`.
