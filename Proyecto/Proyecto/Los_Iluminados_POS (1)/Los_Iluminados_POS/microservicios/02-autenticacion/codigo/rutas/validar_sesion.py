from fastapi import APIRouter, Response

from dependencias import UsuarioDep
from esquemas.respuesta_api import RespuestaAPI
from esquemas.usuario import UsuarioRespuesta

validar_sesion_router = APIRouter(
    tags=["Autenticación"],
    responses={422: {"model": RespuestaAPI[None]}, 500: {"model": RespuestaAPI[None]}},
)


@validar_sesion_router.get(
    "/validar-sesion",
    response_model=RespuestaAPI[UsuarioRespuesta],
    summary="Validar sesión",
    description=(
        "Requiere la cookie `token` (se envía sola si el navegador usa "
        "`credentials: 'include'`). El servicio comprueba la firma, la "
        "expiración y la revocación del token, y luego pide el usuario a la "
        "tienda (`GET /usuarios/{id}`) para devolver sus datos actualizados.\n\n"
        "- **Sesión válida (`200`):** responde con los datos del usuario.\n"
        "- **Sesión inválida (`401`):** no hay cookie, el token expiró, fue "
        "revocado o la tienda no reconoce al usuario."
    ),
    responses={
        401: {
            "model": RespuestaAPI[None],
            "description": "No hay sesión válida o el token fue revocado.",
        }
    },
)
async def validar_sesion(response: Response, usuario: UsuarioDep):
    response.headers["Cache-Control"] = "no-store"

    return RespuestaAPI[UsuarioRespuesta](
        exito=True, mensaje="Sesión válida.", datos=usuario
    )
