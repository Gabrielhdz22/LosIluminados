# Gestión de Inventarios

- **Estado:** Con cambios
- **Responsable:** Eduardo
- **Repositorio:** https://github.com/Mixowo/Gesti-n-Inventario

## Modificaciones necesarias

Integrarlo con SQL Server y permitir actualizar existencias después de confirmar una venta.

## Integración en la app

- **Archivo:** `frontend/js/services/inventario.js` (objeto `inventoryService`)
- **Dónde se usa:** Pestaña Inventario (stock y reabastecimiento), badge de stock en el catálogo; descuenta existencias al confirmarse el pago.
- **Estado actual:** modo local (guarda en `localStorage` del navegador).
- **Para conectar el servicio real:** reemplaza el cuerpo de los métodos de `inventoryService` por llamadas `fetch` a su API. El resto de la app no cambia.

## Código

Ejecuta `clonar-microservicios.sh` (o clona el repositorio a mano) dentro de la carpeta `codigo/`.
