# Procesamiento de Pagos

- **Estado:** Con cambios
- **Responsable:** Eric
- **Repositorio:** https://github.com/alejandroaw1/Procesamiento_de_Pagos_Stripe

## Modificaciones necesarias

Eliminar la selección individual de productos, recibir identificadores de pedidos, obtener sus importes desde el servicio de pedidos e implementar webhooks de Stripe.

## Integración en la app

- **Archivo:** `frontend/js/services/pagos.js` (objeto `paymentsService`)
- **Dónde se usa:** Botón Pagar: recibe el id del pedido, toma el importe del servicio de pedidos y procesa el resultado con un handler de webhook de Stripe.
- **Estado actual:** modo local (guarda en `localStorage` del navegador).
- **Para conectar el servicio real:** reemplaza el cuerpo de los métodos de `paymentsService` por llamadas `fetch` a su API. El resto de la app no cambia.

## Código

Ejecuta `clonar-microservicios.sh` (o clona el repositorio a mano) dentro de la carpeta `codigo/`.
