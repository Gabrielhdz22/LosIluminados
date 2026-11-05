from typing import Annotated

from fastapi import Cookie, Depends, HTTPException

from esquemas.usuario import UsuarioRespuesta
from sesiones import tokens_invalidos
from tienda import obtener_usuario_por_id
from utils import validar_token


def obtener_usuario_actual(
    token: str | None = Cookie(default=None),
) -> UsuarioRespuesta:
    if not token:
        raise HTTPException(status_code=401, detail="No has iniciado sesión.")

    if token in tokens_invalidos:
        raise HTTPException(status_code=401, detail="La sesión fue cancelada.")

    payload = validar_token(token)

    if "error" in payload:
        raise HTTPException(status_code=401, detail=payload["error"])

    usuario_id = payload.get("id")

    if not isinstance(usuario_id, int):
        raise HTTPException(
            status_code=401, detail="El token no contiene un usuario válido."
        )

    usuario = obtener_usuario_por_id(usuario_id)

    if usuario is None:
        raise HTTPException(
            status_code=401, detail="El usuario de esta sesión ya no existe."
        )

    return usuario


UsuarioDep = Annotated[UsuarioRespuesta, Depends(obtener_usuario_actual)]
