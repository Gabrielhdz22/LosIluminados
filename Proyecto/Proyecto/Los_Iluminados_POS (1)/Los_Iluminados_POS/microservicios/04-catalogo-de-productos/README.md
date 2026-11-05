# Catálogo de Productos

- **Estado:** Con cambios
- **Responsable:** Marcela
- **Repositorio:** https://github.com/marcekitty/dulce-barro

## Modificaciones necesarias

Verificar su compatibilidad con la estructura de `Productos`, `Categorias` y `Franquicias` de SQL Server.

## Lo que se sabe del repositorio

Node.js + Express + Microsoft SQL Server (`servidor.js`, `base_datos.sql`), se abre en `http://localhost:3000`.
La conexión usa autenticación de Windows y el controlador ODBC indicado en `servidor.js`. El README no documenta rutas de API.

## Integración en la app

- **Archivo:** `frontend/js/services/catalogo.js` (objeto `catalogService`)
- **Dónde se usa:** Catálogo (productos con categoría y franquicia) y fuente de precios para el carrito.
- **Estado actual:** modo local (guarda en `localStorage` del navegador).
- **Para conectar el servicio real:** reemplaza el cuerpo de los métodos de `catalogService` por llamadas `fetch` a su API. El resto de la app no cambia.

## Código

Ejecuta `clonar-microservicios.sh` (o clona el repositorio a mano) dentro de la carpeta `codigo/`.
