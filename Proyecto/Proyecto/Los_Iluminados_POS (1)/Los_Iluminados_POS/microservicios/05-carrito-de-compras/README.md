# Carrito de Compras

- **Estado:** Con cambios
- **Responsable:** Yuriana
- **Repositorio:** https://github.com/yurianacevil/CarritoService

## Modificaciones necesarias

Conectarlo a SQL Server, agregar persistencia y consultar los precios reales desde el catálogo.

## Lo que se sabe del repositorio

Repositorio "Servicio Carrito para SOA" con una carpeta `CarritoService`. No tiene README ni documentación de rutas.

## Integración en la app

- **Archivo:** `frontend/js/services/carrito.js` (objeto `cartService`)
- **Dónde se usa:** Panel del carrito: persistente y con precios consultados al catálogo.
- **Estado actual:** modo local (guarda en `localStorage` del navegador).
- **Para conectar el servicio real:** reemplaza el cuerpo de los métodos de `cartService` por llamadas `fetch` a su API. El resto de la app no cambia.

## Código

Ejecuta `clonar-microservicios.sh` (o clona el repositorio a mano) dentro de la carpeta `codigo/`.
