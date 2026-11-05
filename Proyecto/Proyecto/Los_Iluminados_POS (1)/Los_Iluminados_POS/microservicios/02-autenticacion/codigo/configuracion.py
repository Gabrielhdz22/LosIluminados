from pydantic_settings import BaseSettings, SettingsConfigDict


class Config(BaseSettings):
    secret_key: str
    algoritmo_token: str
    url_tienda: str
    token_tienda: str | None = None
    modo_contrasena: str = "bcrypt"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


config = Config()  # type: ignore[call-arg]
