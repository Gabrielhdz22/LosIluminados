from fastapi import APIRouter, Cookie, Response

from sesiones import tokens_invalidos
from esquemas.respuesta_api import RespuestaAPI
from utils import validar_token

cerrar_sesion_router = APIRouter(
    tags=["Autenticación"],
    responses={422: {"model": RespuestaAPI[None]}, 500: {"model": RespuestaAPI[None]}},
)


@cerrar_sesion_router.post(
    "/cerrar-sesion",
    response_model=RespuestaAPI[None],
    summary="Cerrar sesión",
    description=(
        "Revoca el token recibido en la cookie (lo agrega a la lista de tokens "
        "inválidos) y borra la cookie `token`.\n\n"
        "Responde `200` incluso si no hay cookie o si el token ya no era válido, "
        "para que cerrar sesión siempre funcione. Solo cierra la sesión de este "
        "token; las demás sesiones del usuario siguen activas."
    ),
)
async def cerrar_sesion(response: Response, token: str | None = Cookie(default=None)):
    if token:
        resultado = validar_token(token)

        if "error" not in resultado:
            tokens_invalidos.add(token)

    response.delete_cookie(
        key="token", path="/", httponly=True, secure=False, samesite="lax"
    )
    response.headers["Cache-Control"] = "no-store"

    return RespuestaAPI[None](exito=True, mensaje="Sesión cerrada.")
