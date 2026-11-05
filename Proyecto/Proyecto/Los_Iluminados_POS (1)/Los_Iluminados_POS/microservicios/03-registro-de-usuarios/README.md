# Registro de Usuarios

- **Estado:** Tal cual
- **Responsable:** Jesús
- **Repositorio:** https://github.com/jesusacevedo35/ServicioRegistroUsuarios

## Modificaciones necesarias

Ninguna indicada: se usa tal cual fue creado.

## Integración en la app

- **Archivo:** `frontend/js/services/registro.js` (objeto `registroService`)
- **Dónde se usa:** Formulario Crear cuenta. Las cuentas nuevas tienen rol de cliente; el admin se provisiona por separado.
- **Estado actual:** modo local (guarda en `localStorage` del navegador).
- **Para conectar el servicio real:** reemplaza el cuerpo de los métodos de `registroService` por llamadas `fetch` a su API. El resto de la app no cambia.

## Código

Ejecuta `clonar-microservicios.sh` (o clona el repositorio a mano) dentro de la carpeta `codigo/`.
