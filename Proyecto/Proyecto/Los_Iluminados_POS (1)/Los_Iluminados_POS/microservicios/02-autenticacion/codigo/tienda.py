import httpx
from fastapi import HTTPException

from configuracion import config
from esquemas.usuario import UsuarioCredenciales, UsuarioRespuesta

TIEMPO_ESPERA = 5.0


def obtener_por_correo(correo: str) -> UsuarioCredenciales | None:
    """Pide a la tienda el usuario y su contraseña guardada."""

    datos = _obtener(f"/usuarios/por-correo/{correo}")

    return UsuarioCredenciales(**datos) if datos else None


def obtener_usuario_por_id(id: int) -> UsuarioRespuesta | None:
    """Pide a la tienda el usuario por su identificador."""

    datos = _obtener(f"/usuarios/{id}")

    return UsuarioRespuesta(**datos) if datos else None


def _obtener(ruta: str) -> dict | None:
    cabeceras: dict[str, str] = {}

    if config.token_tienda:
        cabeceras["Authorization"] = f"Bearer {config.token_tienda}"

    try:
        with httpx.Client(
            base_url=config.url_tienda.rstrip("/"),
            headers=cabeceras,
            timeout=TIEMPO_ESPERA,
        ) as cliente:
            respuesta = cliente.get(ruta)
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=503, detail="La tienda no está disponible."
        ) from exc

    if respuesta.status_code == 404:
        return None

    if respuesta.status_code != 200:
        raise HTTPException(
            status_code=502, detail="La tienda respondió con un error."
        )

    return respuesta.json()
