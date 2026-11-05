from fastapi import APIRouter, Response, status

from esquemas.respuesta_api import RespuestaAPI
from esquemas.usuario import UsuarioRecibido, UsuarioRespuesta
from tienda import obtener_por_correo
from utils import crear_token, validar_contrasena

login_router = APIRouter(
    tags=["Autenticación"],
    responses={422: {"model": RespuestaAPI[None]}, 500: {"model": RespuestaAPI[None]}},
)

RespuestaLogin = RespuestaAPI[UsuarioRespuesta]


@login_router.post(
    "/iniciar-sesion",
    response_model=RespuestaLogin,
    summary="Iniciar sesión",
    description=(
        "Recibe `correo` y `contrasena`. El servicio pide el usuario a la tienda "
        "(`GET /usuarios/por-correo/{correo}`) y compara la contraseña según "
        "`MODO_CONTRASENA`.\n\n"
        "- **Éxito (`200`):** responde con los datos del usuario y entrega una "
        "cookie `token` (HttpOnly) que contiene el JWT. El frontend debe enviar "
        "las peticiones con `credentials: 'include'` para que el navegador "
        "guarde y reenvíe la cookie.\n"
        "- **Credenciales incorrectas (`401`):** el correo no existe o la "
        "contraseña no coincide.\n"
        "- **Tienda no disponible (`503`)** o **error de la tienda (`502`).**"
    ),
    responses={
        401: {
            "model": RespuestaAPI[None],
            "description": "El correo no existe o la contraseña no coincide.",
        }
    },
)
def iniciar_session(usuario: UsuarioRecibido, response: Response):
    usuario_encontrado = obtener_por_correo(usuario.correo)

    if usuario_encontrado is None or not validar_contrasena(
        usuario.contrasena, usuario_encontrado.contrasena_guardada
    ):
        response.status_code = status.HTTP_401_UNAUTHORIZED

        return RespuestaLogin(exito=False, mensaje="Usuario o contraseña incorrectos.")

    token = crear_token(
        {
            "id": usuario_encontrado.id,
            "nombre": usuario_encontrado.nombres,
            "rol": usuario_encontrado.rol,
        }
    )

    response.set_cookie(
        key="token",
        value=token,
        httponly=True,
        secure=False,
        samesite="lax",
        path="/",
        max_age=3600,
    )
    response.headers["Cache-Control"] = "no-store"

    return RespuestaLogin(
        exito=True,
        mensaje=f"Has inciado sesión como {usuario_encontrado.nombres}",
        datos=usuario_encontrado.a_respuesta(),
    )
