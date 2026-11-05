from pathlib import Path
from string import Template

from fastapi import APIRouter, HTTPException
from fastapi.responses import HTMLResponse
from markdown_it import MarkdownIt

from esquemas.respuesta_api import RespuestaAPI

readme_router = APIRouter(tags=["Documentación"])
RUTA_README = Path(__file__).resolve().parent.parent / "README.md"
RUTA_PLANTILLA = Path(__file__).resolve().parent.parent / "plantillas" / "readme.html"
markdown = MarkdownIt("commonmark", {"html": False}).enable("table")


@readme_router.get(
    "/readme",
    response_class=HTMLResponse,
    responses={404: {"model": RespuestaAPI[None]}},
    summary="Ver el README",
    description=(
        "Muestra el contenido del archivo `README.md` formateado como una página "
        "HTML, sin requerir sesión. Es la guía completa de instalación y uso."
    ),
)
def visualizar_readme() -> str:
    try:
        contenido = RUTA_README.read_text(encoding="utf-8")
    except FileNotFoundError as exc:
        raise HTTPException(
            status_code=404, detail="No se encontró el archivo README.md."
        ) from exc

    plantilla = Template(RUTA_PLANTILLA.read_text(encoding="utf-8"))
    return plantilla.substitute(contenido=markdown.render(contenido))
