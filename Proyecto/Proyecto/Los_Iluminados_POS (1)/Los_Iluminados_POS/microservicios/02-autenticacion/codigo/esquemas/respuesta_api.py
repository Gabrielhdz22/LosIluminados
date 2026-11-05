from pydantic import BaseModel


class RespuestaAPI[T](BaseModel):
    exito: bool
    mensaje: str
    datos: T | None = None
