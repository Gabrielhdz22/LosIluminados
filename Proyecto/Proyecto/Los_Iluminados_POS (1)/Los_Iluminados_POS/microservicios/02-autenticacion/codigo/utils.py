import hashlib
from datetime import UTC, datetime, timedelta
from typing import Callable
from uuid import uuid4

import bcrypt
import jwt

from configuracion import config

Verificador = Callable[[str, str], bool]


def _texto_plano(contrasena_ingresada: str, contrasena_guardada: str) -> bool:
    return contrasena_ingresada == contrasena_guardada


def _bcrypt(contrasena_ingresada: str, contrasena_guardada: str) -> bool:
    try:
        return bcrypt.checkpw(
            contrasena_ingresada.encode("utf-8"), contrasena_guardada.encode("utf-8")
        )
    except ValueError:
        return False


def _sha256(contrasena_ingresada: str, contrasena_guardada: str) -> bool:
    return hashlib.sha256(contrasena_ingresada.encode("utf-8")).hexdigest() == (
        contrasena_guardada
    )


def _sha512(contrasena_ingresada: str, contrasena_guardada: str) -> bool:
    return hashlib.sha512(contrasena_ingresada.encode("utf-8")).hexdigest() == (
        contrasena_guardada
    )


VERIFICADORES: dict[str, Verificador] = {
    "texto": _texto_plano,
    "bcrypt": _bcrypt,
    "sha256": _sha256,
    "sha512": _sha512,
}


def validar_contrasena(
    contrasena_ingresada: str, contrasena_guardada: str
) -> bool:
    """Compara la contraseña según el modo configurado en MODO_CONTRASENA.

    Para agregar otro tipo de guardado, crea una función que reciba la
    contraseña ingresada y la guardada, devuelva un booleano, y regístrala
    en VERIFICADORES.
    """

    verificador = VERIFICADORES.get(config.modo_contrasena)

    if verificador is None:
        raise ValueError(
            f"Modo de contraseña desconocido: '{config.modo_contrasena}'. "
            f"Opciones disponibles: {', '.join(VERIFICADORES)}."
        )

    return verificador(contrasena_ingresada, contrasena_guardada)


def crear_token(datos: dict) -> str:
    payload = datos.copy()

    expiracion = datetime.now(UTC) + timedelta(hours=1)
    payload.update({"exp": expiracion, "jti": str(uuid4())})

    token = jwt.encode(payload, config.secret_key, algorithm=config.algoritmo_token)

    return token


def validar_token(token: str) -> dict:
    try:
        payload = jwt.decode(
            token, config.secret_key, algorithms=[config.algoritmo_token]
        )
        return payload
    except jwt.ExpiredSignatureError:
        return {"error": "El token ha expirado"}
    except jwt.InvalidTokenError:
        return {"error": "Token inválido"}
