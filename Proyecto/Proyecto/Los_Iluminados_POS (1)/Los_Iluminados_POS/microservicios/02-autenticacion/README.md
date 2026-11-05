# Autenticación

- **Estado:** Tal cual
- **Responsable:** Aldo
- **Repositorio:** https://github.com/AldoHassiel/servicio-autenticacion

## Modificaciones necesarias

Ninguna indicada: se usa tal cual fue creado.

## Lo que se sabe del repositorio

API FastAPI (Python 3.14, `uv`) con JWT en cookie HTTP-only (1 hora).
Rutas: `POST /iniciar-sesion` (`{correo, contrasena}`), `GET /validar-sesion`, `POST /cerrar-sesion`, `GET /privado`.
No guarda usuarios: pide a la tienda `GET /usuarios/por-correo/{correo}` y `GET /usuarios/{id}` (el id debe ser entero) y compara la contraseña según `MODO_CONTRASENA` (`bcrypt` por defecto).
Respuestas con el formato `{exito, mensaje, datos}`. Variables: `SECRET_KEY`, `ALGORITMO_TOKEN`, `URL_TIENDA`, `TOKEN_TIENDA` (opcional), `MODO_CONTRASENA`.
La tienda que debe exponer los dos endpoints de usuarios es, en este proyecto, el servicio de Registro de Usuarios.

## Integración en la app

- **Archivo:** `frontend/js/services/auth.js` (objeto `authService`)
- **Dónde se usa:** Botón Ingresar/Salir; protege Pedidos, Inventario y el pago.
- **Estado actual:** modo local (guarda en `localStorage` del navegador).
- **Para conectar el servicio real:** reemplaza el cuerpo de los métodos de `authService` por llamadas `fetch` a su API. El resto de la app no cambia.

## Código

Ejecuta `clonar-microservicios.sh` (o clona el repositorio a mano) dentro de la carpeta `codigo/`.
