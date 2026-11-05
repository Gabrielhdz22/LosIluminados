from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException

from esquemas.respuesta_api import RespuestaAPI


def registrar_manejadores_error(app: FastAPI):
    @app.exception_handler(RequestValidationError)
    async def manejador_error_validacion(request: Request, exc: RequestValidationError):
        mensajes: list[str] = []

        for error in exc.errors():
            campo = ".".join(str(parte) for parte in error["loc"][1:]) or "solicitud"

            tipo = error["type"]

            if tipo == "missing":
                motivo = "Este campo es obligatorio"
            elif tipo == "string_type":
                motivo = "Debe de ser un texto"
            elif tipo == "json_invalid":
                campo = "solicitud"
                motivo = "El JSON enviado no es válido"
            elif campo == "correo" and tipo == "value_error":
                motivo = "Debe de ser un correo electronico válido"
            else:
                motivo = error["msg"]

            mensajes.append(f"{campo}: {motivo}")

        respuesta = RespuestaAPI[None](exito=False, mensaje="; ".join(mensajes))

        return JSONResponse(status_code=422, content=respuesta.model_dump(mode="json"))

    @app.exception_handler(HTTPException)
    async def manejador_error_http(request: Request, exc: HTTPException):
        respuesta = RespuestaAPI[None](exito=False, mensaje=str(exc.detail))

        return JSONResponse(
            status_code=exc.status_code,
            content=respuesta.model_dump(mode="json"),
            headers=exc.headers,
        )
