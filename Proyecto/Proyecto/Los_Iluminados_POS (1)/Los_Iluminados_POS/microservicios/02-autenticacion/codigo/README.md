# Servicio de autenticación

API desarrollada con FastAPI para iniciar, validar y cerrar sesiones mediante tokens JWT almacenados en una cookie HTTP-only. El servicio compara las contraseñas y permite configurar el modo de guardado (texto plano, bcrypt, sha256…). Incluye una ruta protegida de ejemplo y respuestas JSON en español.

El servicio no guarda ni conoce a los usuarios: se los pide a la tienda por HTTP y compara la contraseña él mismo. Solo mantiene en memoria la lista de tokens cerrados, así que no necesita base de datos.

## Guía de uso paso a paso

Esta sección resume todo lo necesario para usar el servicio en una tienda. Los detalles de cada parte están en las secciones siguientes.

### 1. Instalar el servicio

```bash
git clone <url-del-repositorio> servicio-autenticacion
cd servicio-autenticacion
uv sync --locked
```

### 2. Configurar el `.env`

```dotenv
SECRET_KEY=una_clave_larga_y_secreta
ALGORITMO_TOKEN=HS256
URL_TIENDA=http://127.0.0.1:8001
MODO_CONTRASENA=bcrypt
```

Genera la `SECRET_KEY` con `uv run python -c "import secrets; print(secrets.token_hex(32))"`. La tabla completa de variables está en [Instalación y ejecución](#instalación-y-ejecución).

### 3. Pedir a la tienda que exponga dos endpoints

La tienda es la dueña de los usuarios. Debe publicar:

| Método | Ruta | Devuelve |
| --- | --- | --- |
| `GET` | `/usuarios/por-correo/{correo}` | `{id, correo, contrasena_guardada, nombres, apellidos, rol}` |
| `GET` | `/usuarios/{id}` | `{id, correo, nombres, apellidos, rol}` |

Ambos responden `404` si el usuario no existe. El contrato completo y un ejemplo están en [Cómo se conecta con la tienda](#cómo-se-conecta-con-la-tienda). Recuerda que `MODO_CONTRASENA` debe coincidir con cómo guarda la tienda la contraseña.

### 4. Arrancar el servicio

```bash
uv run uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

La documentación interactiva está en `http://127.0.0.1:8000/docs` y este README en `http://127.0.0.1:8000/readme`.

### 5. Probar con `curl`

```bash
# Iniciar sesión (guarda la cookie en cookies.txt).
curl -i -c cookies.txt -H 'Content-Type: application/json' \
  -d '{"correo":"jose_perez@gmail.com","contrasena":"jose"}' \
  http://127.0.0.1:8000/iniciar-sesion

# Validar la sesión.
curl -i -b cookies.txt http://127.0.0.1:8000/validar-sesion

# Cerrar la sesión.
curl -i -X POST -b cookies.txt http://127.0.0.1:8000/cerrar-sesion
```

### 6. Integrar el navegador de la tienda

El frontend llama al servicio con `credentials: 'include'`. El CORS ya está resuelto: el servicio acepta cualquier origen con credenciales, así que no hay que configurar nada extra. Ver [Integración desde un navegador](#integración-desde-un-navegador).

### 7. Proteger las rutas de la tienda

La API de la tienda debe comprobar la sesión en el servidor: reenvía la cookie del usuario a `GET /validar-sesion`, o protege sus propias rutas con la dependencia `UsuarioDep`. Ver [Cómo proteger nuevas rutas](#cómo-proteger-nuevas-rutas).

### 8. Antes de publicar

- Cambiar `secure=False` por `secure=True` en `rutas/login.py` y `rutas/cerrar_sesion.py` (requiere HTTPS).
- Revisar la política `SameSite` si el servicio y la tienda viven en dominios distintos.
- Recordar que la lista de tokens cerrados vive en memoria: con varios procesos, el cierre no se comparte (ver [Almacenamiento y limitaciones actuales](#almacenamiento-y-limitaciones-actuales)).

### Lo que el servicio NO hace

No registra usuarios, no recupera ni cambia contraseñas, no maneja refresh tokens y no aplica permisos por rol. Todo eso queda del lado de la tienda.

## Requisitos y tecnologías

- Python **3.13 o superior**, según `pyproject.toml`.
- [uv](https://docs.astral.sh/uv/) para instalar las dependencias y ejecutar el proyecto.
- FastAPI para las rutas, validación y documentación OpenAPI.
- Pydantic para los esquemas y Pydantic Settings para la configuración.
- PyJWT para firmar y validar tokens.
- httpx para consultar la API de usuarios de la tienda.
- bcrypt para comparar contraseñas cuando `MODO_CONTRASENA=bcrypt`.

Las dependencias directas se declaran en `pyproject.toml`; `uv.lock` contiene las versiones resueltas.

## Instalación y ejecución

Desde la raíz del proyecto:

```bash
uv sync --locked
```

Crea un archivo `.env` con estas variables obligatorias:

```dotenv
SECRET_KEY=reemplaza_este_valor_por_una_clave_aleatoria
ALGORITMO_TOKEN=HS256
URL_TIENDA=http://127.0.0.1:8001
```

Puedes generar una clave para `SECRET_KEY` con:

```bash
uv run python -c 'import secrets; print(secrets.token_hex(32))'
```

| Variable | Uso |
| --- | --- |
| `SECRET_KEY` | Clave utilizada para firmar y verificar los JWT. |
| `ALGORITMO_TOKEN` | Algoritmo de firma y verificación. `HS256` es la configuración utilizada en este ejemplo. |
| `URL_TIENDA` | Dirección base de la API de la tienda (obligatoria). |
| `TOKEN_TIENDA` | Se envía como `Authorization: Bearer` a la tienda. Opcional. |
| `MODO_CONTRASENA` | Cómo compara el servicio la contraseña: `bcrypt` (por defecto), `texto`, `sha256` o `sha512`. |

`configuracion.py` carga `.env` desde el directorio de ejecución. También acepta variables de entorno, que tienen prioridad sobre el archivo. `SECRET_KEY`, `ALGORITMO_TOKEN` y `URL_TIENDA` no tienen valor predeterminado: si falta alguna, la aplicación no inicia. Conserva la clave fuera del control de versiones.

## Cómo se conecta con la tienda

El servicio no guarda ni conoce a los usuarios: se los pide a la tienda por HTTP y **él mismo compara la contraseña**. La tienda solo debe exponer dos endpoints:

| Método | Ruta | Qué devuelve | Respuesta `200` |
| --- | --- | --- | --- |
| `GET` | `/usuarios/por-correo/{correo}` | El usuario y su contraseña guardada | `{id, correo, contrasena_guardada, nombres, apellidos, rol}` |
| `GET` | `/usuarios/{id}` | El usuario por id (sin contraseña) | `{id, correo, nombres, apellidos, rol}` |

Ambos responden `404` si el usuario no existe. `contrasena_guardada` es la contraseña tal como la tenga la tienda: un hash o texto plano, según `MODO_CONTRASENA`. El `rol` es texto libre (`cliente`, `admin`, lo que use la tienda) y el `id` debe ser un número entero. Si defines `TOKEN_TIENDA`, el servicio envía `Authorization: Bearer <token>` en cada petición para que la tienda pueda proteger esos endpoints.

Ejemplo mínimo de esos endpoints en la tienda:

```python
@app.get("/usuarios/por-correo/{correo}")
def por_correo(correo: str):
    usuario = buscar_por_correo(correo)
    if usuario is None:
        raise HTTPException(status_code=404)
    return {
        "id": usuario.id,
        "correo": usuario.correo,
        "contrasena_guardada": usuario.password,   # hash o texto, según MODO_CONTRASENA
        "nombres": usuario.nombres,
        "apellidos": usuario.apellidos,
        "rol": usuario.rol,
    }

@app.get("/usuarios/{id}")
def por_id(id: int):
    usuario = buscar_por_id(id)
    if usuario is None:
        raise HTTPException(status_code=404)
    return {
        "id": usuario.id,
        "correo": usuario.correo,
        "nombres": usuario.nombres,
        "apellidos": usuario.apellidos,
        "rol": usuario.rol,
    }
```

Si la tienda está caída, el servicio responde `503`; si responde con un error inesperado, `502`.

## Modo de contraseña

Con `MODO_CONTRASENA` eliges cómo compara el servicio la contraseña del cliente con `contrasena_guardada`:

| Valor | Cuándo usarlo |
| --- | --- |
| `bcrypt` | La tienda guarda hashes bcrypt (valor predeterminado). |
| `texto` | La tienda guarda la contraseña en texto plano (solo para pruebas). |
| `sha256` | La tienda guarda el hash SHA-256 en hexadecimal. |
| `sha512` | La tienda guarda el hash SHA-512 en hexadecimal. |

```dotenv
MODO_CONTRASENA=texto
```

Para cualquier otro caso, agrega una función y regístrala en `VERIFICADORES` de `utils.py`:

```python
def _argon2(contrasena_ingresada: str, contrasena_guardada: str) -> bool:
    ...

VERIFICADORES["argon2"] = _argon2
```

Luego se elige con `MODO_CONTRASENA=argon2`.

Inicia el servidor de desarrollo:

```bash
uv run uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

La API estará disponible en `http://127.0.0.1:8000`.

| Recurso | URL local |
| --- | --- |
| README formateado | http://127.0.0.1:8000/readme |
| Swagger UI | http://127.0.0.1:8000/docs |
| ReDoc | http://127.0.0.1:8000/redoc |
| Esquema OpenAPI | http://127.0.0.1:8000/openapi.json |

Para ejecutar sin recarga automática, elimina `--reload`. El almacenamiento de revocaciones es local al proceso; consulta las limitaciones antes de utilizar varios procesos o desplegar el servicio.

## Estructura del proyecto

```text
.
├── main.py                    # Aplicación, registro de routers y ruta raíz
├── configuracion.py           # Configuración desde .env y variables de entorno
├── tienda.py                  # Consulta la API de usuarios de la tienda
├── sesiones.py                # Tokens revocados en memoria
├── dependencias.py            # Obtención del usuario autenticado y UsuarioDep
├── errores.py                 # Manejadores de errores HTTP y de validación
├── utils.py                   # Funciones de JWT
├── esquemas/
│   ├── respuesta_api.py        # Envoltorio genérico de las respuestas
│   └── usuario.py              # Modelos de entrada y respuesta
├── rutas/
│   ├── login.py                # Inicio de sesión
│   ├── validar_sesion.py       # Validación de sesión
│   ├── cerrar_sesion.py        # Cierre de sesión
│   ├── readme.py               # Consulta pública del README en HTML
│   └── pruebas.py              # Ruta protegida de ejemplo
├── plantillas/
│   └── readme.html             # Diseño adaptable de la documentación
├── pyproject.toml             # Metadatos y dependencias
└── uv.lock                    # Versiones resueltas de dependencias
```

## Flujo de autenticación

1. El cliente envía `correo` y `contrasena` a `POST /iniciar-sesion`.
2. El servicio pide el usuario a la tienda (`GET /usuarios/por-correo/{correo}`) y compara la contraseña con `contrasena_guardada` según `MODO_CONTRASENA`.
3. Si las credenciales son correctas, genera un JWT con vigencia de una hora y lo entrega en la cookie `token` mediante `Set-Cookie`.
4. El cliente conserva y envía esa cookie para acceder a `/validar-sesion` y `/privado`.
5. La dependencia `UsuarioDep` comprueba la revocación del token, su firma y expiración, y que su identificador siga existiendo en la tienda (`GET /usuarios/{id}`).
6. Al cerrar sesión, el servicio registra el token válido como revocado en memoria y elimina la cookie del cliente.

El JWT contiene `id`, `nombre`, `rol`, `exp` y un identificador único `jti`. El token no se devuelve en el cuerpo JSON. Las rutas protegidas leen exclusivamente la cookie `token`; no implementan autenticación mediante `Authorization: Bearer`.

La cookie se configura con:

| Propiedad | Valor actual |
| --- | --- |
| Nombre | `token` |
| `HttpOnly` | `true` |
| `Secure` | `false` |
| `SameSite` | `lax` |
| `Path` | `/` |
| `Max-Age` | `3600` segundos |

Las respuestas exitosas de inicio, validación y cierre de sesión, así como de la ruta privada, incluyen `Cache-Control: no-store`. Esta cabecera no se establece en todas las respuestas de error.

## Formato de las respuestas

Las respuestas JSON de los endpoints y los errores HTTP o de validación manejados utilizan `RespuestaAPI[T]`. La respuesta exitosa de `/readme` devuelve una página HTML:

```json
{
  "exito": true,
  "mensaje": "Descripción del resultado",
  "datos": null
}
```

| Campo | Tipo | Descripción |
| --- | --- | --- |
| `exito` | `boolean` | Indica si la operación fue exitosa. |
| `mensaje` | `string` | Mensaje del resultado o motivo del error. |
| `datos` | Objeto o `null` | Datos del usuario en inicio y validación de sesión; `null` en las demás respuestas. |

El usuario (`UsuarioRespuesta`) contiene `id`, `correo`, `nombres`, `apellidos` y `rol`. El rol es texto libre, así que cada tienda usa los suyos. Las contraseñas nunca pasan por el servicio.

## Endpoints

| Método | Ruta | Requiere sesión | Función |
| --- | --- | --- | --- |
| `GET` | `/` | No | Devuelve un mensaje de bienvenida. |
| `GET` | `/readme` | No | Muestra el README formateado y con estilos. |
| `POST` | `/iniciar-sesion` | No | Verifica credenciales y crea la cookie de sesión. |
| `GET` | `/validar-sesion` | Sí | Devuelve los datos del usuario autenticado. |
| `POST` | `/cerrar-sesion` | No | Revoca el token recibido si es válido y elimina la cookie. |
| `GET` | `/privado` | Sí | Devuelve un saludo al usuario autenticado. |

### `GET /`

Respuesta `200 OK`:

```json
{
  "exito": true,
  "mensaje": "Bienvenido al servicio de autenticación",
  "datos": null
}
```

### `GET /readme`

Muestra el contenido de `README.md` como una página de documentación, sin requerir sesión. Responde `200 OK` con `Content-Type: text/html; charset=utf-8`. Convierte Markdown a HTML mediante `markdown-it-py`, incluyendo títulos, listas, tablas, enlaces y bloques de código.

El diseño se adapta a móviles y al tema claro u oscuro del sistema. Los estilos se incluyen en la página, sin depender de servicios externos. El HTML escrito dentro del Markdown se muestra como texto.

El archivo se lee en cada solicitud, por lo que sus cambios se reflejan sin reiniciar el servidor. Si no existe, responde `404 Not Found` con el formato JSON de errores del servicio.

```bash
curl http://127.0.0.1:8000/readme
```

### `POST /iniciar-sesion`

Recibe un cuerpo JSON con dos campos obligatorios: `correo`, con formato de correo electrónico, y `contrasena`, de tipo texto.

Por ejemplo, si la tienda tiene este usuario:

```json
{
  "correo": "jose_perez@gmail.com",
  "contrasena": "jose"
}
```

Respuesta `200 OK`, acompañada de la cookie `token`:

```json
{
  "exito": true,
  "mensaje": "Has inciado sesión como Jose",
  "datos": {
    "id": 5,
    "correo": "jose_perez@gmail.com",
    "nombres": "Jose",
    "apellidos": "Perez",
    "rol": "cliente"
  }
}
```

El mensaje reproduce el texto actual del servicio. Si el usuario no existe o la contraseña no coincide, responde `401 Unauthorized` con `Usuario o contraseña incorrectos.`. Si el cuerpo no pasa la validación, responde `422 Unprocessable Entity`.

### `GET /validar-sesion`

Requiere una cookie `token` válida. Responde `200 OK` con `exito: true`, `mensaje: "Sesión válida."` y el objeto del usuario en `datos`, con la misma estructura del inicio de sesión.

Los datos se piden a la tienda (`GET /usuarios/{id}`) a partir del `id` del JWT. Si la sesión no es válida, responde `401 Unauthorized`.

### `POST /cerrar-sesion`

No requiere cuerpo. Si recibe un token cuya firma y expiración son válidas, lo añade al conjunto `tokens_invalidos` de `sesiones.py`. Después elimina la cookie `token`.

Responde `200 OK` incluso si no hay cookie o el token recibido es inválido o está expirado:

```json
{
  "exito": true,
  "mensaje": "Sesión cerrada.",
  "datos": null
}
```

El cierre afecta al token recibido; no cierra todas las sesiones del usuario.

### `GET /privado`

Ejemplo de ruta protegida mediante `UsuarioDep`. Cualquier usuario con sesión válida puede acceder, independientemente de su rol.

Respuesta `200 OK` para el usuario de ejemplo:

```json
{
  "exito": true,
  "mensaje": "Hola, Jose! Esta ruta esta protegida",
  "datos": null
}
```

Sin una sesión válida responde `401 Unauthorized`.

## Errores

Ejemplo de acceso a una ruta protegida sin cookie:

```json
{
  "exito": false,
  "mensaje": "No has iniciado sesión.",
  "datos": null
}
```

| Estado | Situación | Mensaje |
| --- | --- | --- |
| `401` | Credenciales incorrectas | `Usuario o contraseña incorrectos.` |
| `401` | Cookie ausente o vacía | `No has iniciado sesión.` |
| `401` | Token revocado | `La sesión fue cancelada.` |
| `401` | Token expirado | `El token ha expirado` |
| `401` | Token inválido | `Token inválido` |
| `401` | Identificador de usuario ausente o no entero | `El token no contiene un usuario válido.` |
| `401` | Usuario inexistente | `El usuario de esta sesión ya no existe.` |
| `422` | Solicitud inválida | Mensajes por campo, separados por `; `. |
| `502` | La tienda responde con un error | `La tienda respondió con un error.` |
| `503` | La tienda no responde | `La tienda no está disponible.` |

Ejemplo de validación cuando falta `contrasena`:

```json
{
  "exito": false,
  "mensaje": "contrasena: Este campo es obligatorio",
  "datos": null
}
```

También se manejan excepciones HTTP, como `404` y `405`, con el mismo envoltorio. Aunque los routers de autenticación declaran una respuesta `500` en OpenAPI, no existe un manejador general de excepciones que garantice este formato para fallos internos inesperados. Los estados `401` se producen en ejecución, pero no están declarados explícitamente en las respuestas de OpenAPI.

## Ejemplo completo con curl

Con el servidor ejecutándose, utiliza el mismo archivo de cookies para conservar la sesión:

```bash
# 1. Consultar la ruta pública.
curl -i http://127.0.0.1:8000/

# 2. Iniciar sesión y guardar la cookie en un archivo local.
curl -i -c cookies.txt \
  -H 'Content-Type: application/json' \
  -d '{"correo":"jose_perez@gmail.com","contrasena":"jose"}' \
  http://127.0.0.1:8000/iniciar-sesion

# 3. Validar la sesión.
curl -i -b cookies.txt http://127.0.0.1:8000/validar-sesion

# 4. Acceder a la ruta protegida.
curl -i -b cookies.txt http://127.0.0.1:8000/privado

# 5. Cerrar sesión y actualizar el archivo de cookies.
curl -i -X POST -b cookies.txt -c cookies.txt \
  http://127.0.0.1:8000/cerrar-sesion

# 6. Comprobar que el acceso ya devuelve 401.
curl -i -b cookies.txt http://127.0.0.1:8000/privado
```

`cookies.txt` contiene la credencial de sesión mientras esté activa; no lo agregues al repositorio.

## Integración desde un navegador

Ejemplo para una interfaz servida desde el mismo origen que la API:

```javascript
const respuesta = await fetch('/iniciar-sesion', {
  method: 'POST',
  credentials: 'include',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    correo: 'jose_perez@gmail.com',
    contrasena: 'jose',
  }),
});
const resultado = await respuesta.json();

if (respuesta.ok && resultado.exito) {
  const sesion = await fetch('/validar-sesion', {
    credentials: 'include',
  });
  console.log(await sesion.json());
}

// Cerrar la sesión.
await fetch('/cerrar-sesion', {
  method: 'POST',
  credentials: 'include',
});
```

El navegador administra la cookie; JavaScript no puede leerla por ser `HttpOnly`. El servicio **ya configura CORS** para aceptar cualquier origen con credenciales, así que una interfaz alojada en otro origen funciona sin tocar el servidor: Starlette refleja el origen de la petición en lugar de `*`. Solo debes enviar `credentials: 'include'`; sin eso el navegador no guarda ni reenvía la cookie. Un despliegue entre sitios diferentes (dominios distintos) además requiere revisar la política `SameSite`.

## Cómo proteger nuevas rutas

Declara `usuario: UsuarioDep` como dependencia en la función del endpoint:

```python
from fastapi import APIRouter

from dependencias import UsuarioDep
from esquemas.respuesta_api import RespuestaAPI
from esquemas.usuario import UsuarioRespuesta

router = APIRouter()


@router.get(
    '/perfil',
    response_model=RespuestaAPI[UsuarioRespuesta],
    description='Devuelve el perfil del usuario autenticado.',
)
async def perfil(usuario: UsuarioDep):
    return RespuestaAPI[UsuarioRespuesta](
        exito=True,
        mensaje='Perfil obtenido.',
        datos=usuario,
    )
```

Registra el nuevo router con `app.include_router(router)` en `main.py`. La dependencia rechaza solicitudes sin sesión válida antes de ejecutar la función. Las restricciones por rol deben implementarse aparte.

## Almacenamiento y limitaciones actuales

- **El servicio no guarda usuarios:** se los pide a la tienda en cada inicio y validación de sesión y compara la contraseña él mismo. La tienda es la dueña de los datos; el servicio no persiste usuarios.
- **Modo de contraseña:** la comparación depende de `MODO_CONTRASENA`. Con `texto` la contraseña viaja y se guarda sin cifrar, así que úsalo solo en pruebas, no en producción.
- **Dependencia de la tienda:** si la API de la tienda no responde, el inicio y la validación de sesión fallan con `503`; si responde con un error inesperado, `502`.
- **Sin persistencia:** `tokens_invalidos` (`sesiones.py`) reside en memoria. Al reiniciar, se pierden las revocaciones; un JWT previamente revocado podría volver a aceptarse si no expiró y se conserva la misma clave.
- **Varios procesos:** cada proceso mantiene su propio conjunto de tokens revocados. El cierre de sesión no se comparte entre workers o instancias.
- **Revocaciones sin limpieza:** el conjunto de tokens inválidos no elimina automáticamente los tokens cuando expiran.
- **Duración fija:** el JWT y la cookie duran una hora. No hay refresh tokens ni renovación automática. Cambiar la clave de firma invalida los tokens emitidos con la clave anterior.
- **Autorización:** el rol es texto libre y se incluye en el JWT, pero las rutas actuales solo comprueban autenticación, sin permisos por rol.
- **Identificador:** se asume un `id` entero.
- **Configuración de despliegue:** la cookie utiliza `secure=False` para desarrollo. Un despliegue con HTTPS debe ajustar esa propiedad. No se han implementado controles explícitos de CSRF ni límites de intentos de inicio de sesión.
- **Pruebas:** el repositorio no incluye una suite automatizada. El flujo de curl anterior permite una comprobación manual básica.

La versión publicada en los metadatos del proyecto es `0.1.0`; la aplicación declara `1.0.0` en la documentación OpenAPI.
