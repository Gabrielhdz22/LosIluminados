from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from errores import registrar_manejadores_error
from esquemas.respuesta_api import RespuestaAPI
from rutas.cerrar_sesion import cerrar_sesion_router
from rutas.login import login_router
from rutas.pruebas import pruebas_router
from rutas.readme import readme_router
from rutas.validar_sesion import validar_sesion_router

DESCRIPCION = """
Servicio que **solo** hace tres cosas: **iniciar sesión**, **cerrar sesión** y
**validar al usuario** de una tienda en línea.

## Cómo funciona

El servicio no guarda usuarios. Cada vez que alguien inicia sesión o se valida
una sesión, pide los datos a la **API de la tienda** (`URL_TIENDA`) y compara la
contraseña él mismo según `MODO_CONTRASENA`. Los usuarios siguen perteneciendo a
la tienda; el servicio solo los consulta.

## Paso 1. Lo que debe exponer la tienda

El desarrollador de la tienda debe publicar dos endpoints:

| Método | Ruta | Devuelve |
| --- | --- | --- |
| `GET` | `/usuarios/por-correo/{correo}` | `{id, correo, contrasena_guardada, nombres, apellidos, rol}` |
| `GET` | `/usuarios/{id}` | `{id, correo, nombres, apellidos, rol}` |

Ambos responden `404` si el usuario no existe. `contrasena_guardada` es la
contraseña tal como la guarda la tienda (hash o texto). El `rol` es texto libre
y el `id` debe ser un número entero. Conviene protegerlos con `TOKEN_TIENDA`.

## Paso 2. Lo que se configura al desplegar el servicio

En el archivo `.env`:

```dotenv
SECRET_KEY=una_clave_larga_y_secreta
ALGORITMO_TOKEN=HS256
URL_TIENDA=http://127.0.0.1:8001
MODO_CONTRASENA=bcrypt
```

- `URL_TIENDA`: dónde está la API de usuarios de la tienda (obligatoria).
- `MODO_CONTRASENA`: `bcrypt` (por defecto), `texto`, `sha256` o `sha512`.
- `TOKEN_TIENDA` (opcional): se envía como `Authorization: Bearer` a la tienda.

## Paso 3. Uso desde el navegador

1. El frontend hace `POST /iniciar-sesion` con `{correo, contrasena}` y
   `credentials: 'include'`.
2. El servicio responde `200` y entrega la cookie `token` (HttpOnly) con el JWT.
3. El frontend llama a `GET /validar-sesion` (con `credentials: 'include'`) para
   confirmar quién es el usuario.
4. Para salir, el frontend llama a `POST /cerrar-sesion`. El servicio revoca el
   token y borra la cookie.
5. `GET /privado` es un ejemplo de ruta protegida.

El CORS ya está configurado para aceptar cualquier origen con credenciales, así
que el navegador de la tienda puede llamar al servicio sin ajustes extra.
"""

app = FastAPI(
    title="Servicio de autenticación",
    version="1.0.0",
    description=DESCRIPCION,
    openapi_tags=[
        {
            "name": "Autenticación",
            "description": "Inicio, validación y cierre de sesión.",
        },
        {"name": "Pruebas", "description": "Ruta protegida de ejemplo."},
        {
            "name": "Documentación",
            "description": "Consulta del README como página HTML.",
        },
        {"name": "Root", "description": "Mensaje de bienvenida del servicio."},
    ],
)

# CORS abierto a cualquier origen, con credenciales (cookies). Starlette
# refleja el origen de la petición en lugar de "*" cuando allow_credentials es
# True, así que el navegador de la tienda funciona sin configuración adicional.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

registrar_manejadores_error(app)

app.include_router(login_router)
app.include_router(cerrar_sesion_router)
app.include_router(validar_sesion_router)
app.include_router(pruebas_router)
app.include_router(readme_router)


@app.get(
    "/",
    response_model=RespuestaAPI[None],
    tags=["Root"],
    summary="Mensaje de bienvenida",
    description="Devuelve un mensaje de bienvenida al servicio de autenticación.",
)
async def saludo() -> RespuestaAPI[None]:
    return RespuestaAPI[None](
        exito=True, mensaje="Bienvenido al servicio de autenticación"
    )
