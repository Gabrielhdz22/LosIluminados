from fastapi import APIRouter, Response

from dependencias import UsuarioDep
from esquemas.respuesta_api import RespuestaAPI

pruebas_router = APIRouter(tags=["Pruebas"])


@pruebas_router.get(
    "/privado",
    response_model=RespuestaAPI[None],
    summary="Ruta protegida de ejemplo",
    description=(
        "Ejemplo de ruta protegida con la dependencia `UsuarioDep`. Devuelve un "
        "saludo personalizado si la sesión es válida; responde `401` si no lo "
        "es. Úsala como modelo para proteger las rutas de tu tienda."
    ),
    responses={
        401: {
            "model": RespuestaAPI[None],
            "description": "No hay una sesión válida.",
        }
    },
)
async def ruta_protegida(response: Response, usuario: UsuarioDep):
    response.headers["Cache-Control"] = "no-store"

    return RespuestaAPI[None](
        exito=True, mensaje=f"Hola, {usuario.nombres}! Esta ruta esta protegida"
    )
