# Gestión de Pedidos

- **Estado:** Con cambios
- **Responsable:** Elidor
- **Repositorio:** https://github.com/El1d0r/Stock-sistema

## Modificaciones necesarias

Adaptarlo para registrar ventas de mostrador, asociar los productos del carrito y controlar los estados de pago.

## Integración en la app

- **Archivo:** `frontend/js/services/pedidos.js` (objeto `ordersService`)
- **Dónde se usa:** Pestaña Pedidos: ventas de mostrador con estados pendiente_pago / pago_rechazado / pagado / cancelado.
- **Estado actual:** modo local (guarda en `localStorage` del navegador).
- **Para conectar el servicio real:** reemplaza el cuerpo de los métodos de `ordersService` por llamadas `fetch` a su API. El resto de la app no cambia.

## Código

Ejecuta `clonar-microservicios.sh` (o clona el repositorio a mano) dentro de la carpeta `codigo/`.
