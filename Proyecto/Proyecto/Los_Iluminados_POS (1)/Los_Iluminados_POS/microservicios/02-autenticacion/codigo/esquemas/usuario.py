from pydantic import BaseModel, EmailStr


class UsuarioRecibido(BaseModel):
    correo: EmailStr
    contrasena: str


class UsuarioCredenciales(BaseModel):
    """Usuario con la contraseña tal como la guarda la tienda.

    Es de uso interno: nunca se serializa en una respuesta. El campo
    ``contrasena_guardada`` puede ser un hash o texto plano, según
    ``MODO_CONTRASENA``.
    """

    id: int
    correo: EmailStr
    contrasena_guardada: str
    nombres: str
    apellidos: str
    rol: str

    def a_respuesta(self) -> "UsuarioRespuesta":
        return UsuarioRespuesta(
            id=self.id,
            correo=self.correo,
            nombres=self.nombres,
            apellidos=self.apellidos,
            rol=self.rol,
        )


class UsuarioRespuesta(BaseModel):
    id: int
    correo: EmailStr
    nombres: str
    apellidos: str
    rol: str
