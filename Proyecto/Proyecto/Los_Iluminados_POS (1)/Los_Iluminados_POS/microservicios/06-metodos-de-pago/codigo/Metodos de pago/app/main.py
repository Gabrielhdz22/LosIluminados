from contextlib import asynccontextmanager
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path
from typing import Optional
from uuid import uuid4
import sqlite3

from fastapi import FastAPI, HTTPException, status
from pydantic import BaseModel, Field

BASE_DIR = Path(__file__).resolve().parent.parent
DB_PATH = BASE_DIR / "pagos.db"

class TipoMetodo(str, Enum):
    efectivo = "efectivo"
    tarjeta_debito = "tarjeta_debito"
    tarjeta_credito = "tarjeta_credito"
    transferencia = "transferencia"
    billetera_digital = "billetera_digital"

class MetodoPagoCrear(BaseModel):
    nombre: str = Field(min_length=2, max_length=100)
    tipo: TipoMetodo
    habilitado: bool = True
    descripcion: Optional[str] = Field(default=None, max_length=250)

class MetodoPagoActualizar(BaseModel):
    nombre: Optional[str] = Field(default=None, min_length=2, max_length=100)
    tipo: Optional[TipoMetodo] = None
    habilitado: Optional[bool] = None
    descripcion: Optional[str] = Field(default=None, max_length=250)

class SolicitudPago(BaseModel):
    monto: float = Field(gt=0, le=1_000_000)
    moneda: str = Field(default="MXN", min_length=3, max_length=3)
    metodo_pago_id: str
    referencia: Optional[str] = Field(default=None, max_length=100)


def conectar():
    conexion = sqlite3.connect(DB_PATH)
    conexion.row_factory = sqlite3.Row
    return conexion


def inicializar_bd():
    with conectar() as conexion:
        conexion.execute("""CREATE TABLE IF NOT EXISTS metodos_pago (
            id TEXT PRIMARY KEY, nombre TEXT NOT NULL, tipo TEXT NOT NULL,
            habilitado INTEGER NOT NULL DEFAULT 1, descripcion TEXT,
            creado_en TEXT NOT NULL, actualizado_en TEXT NOT NULL
        )""")
        conexion.execute("""CREATE TABLE IF NOT EXISTS pagos (
            id TEXT PRIMARY KEY, monto REAL NOT NULL, moneda TEXT NOT NULL,
            metodo_pago_id TEXT NOT NULL, referencia TEXT,
            estado TEXT NOT NULL, creado_en TEXT NOT NULL
        )""")


def fecha_actual():
    return datetime.now(timezone.utc).isoformat()


def metodo_a_diccionario(fila):
    resultado = dict(fila)
    resultado["habilitado"] = bool(resultado["habilitado"])
    return resultado


@asynccontextmanager
async def ciclo_de_vida(app: FastAPI):
    inicializar_bd()
    yield


app = FastAPI(
    title="Microservicio de Métodos de Pago",
    description="API REST en español para administrar métodos de pago y registrar pagos de demostración.",
    version="2.0.0",
    lifespan=ciclo_de_vida,
    docs_url="/documentacion",
    redoc_url="/documentacion-redoc",
)

@app.get("/salud", tags=["Salud"], summary="Comprobar el estado del servicio")
def salud():
    return {"estado": "correcto", "servicio": "microservicio-metodos-pago", "version": "2.0.0"}

@app.get("/api/v1/resumen", tags=["Resumen"], summary="Consultar resumen del sistema")
def resumen():
    with conectar() as conexion:
        metodos = conexion.execute("SELECT COUNT(*) AS total FROM metodos_pago").fetchone()["total"]
        habilitados = conexion.execute("SELECT COUNT(*) AS total FROM metodos_pago WHERE habilitado=1").fetchone()["total"]
        pagos = conexion.execute("SELECT COUNT(*) AS total FROM pagos").fetchone()["total"]
        total = conexion.execute("SELECT COALESCE(SUM(monto),0) AS total FROM pagos").fetchone()["total"]
    return {"metodos": metodos, "metodos_habilitados": habilitados, "pagos": pagos, "monto_total": round(total, 2), "moneda": "MXN"}

@app.post("/api/v1/metodos-pago", status_code=status.HTTP_201_CREATED, tags=["Métodos de pago"], summary="Crear método de pago")
def crear_metodo_pago(datos: MetodoPagoCrear):
    metodo_id, ahora = str(uuid4()), fecha_actual()
    with conectar() as conexion:
        conexion.execute("INSERT INTO metodos_pago (id,nombre,tipo,habilitado,descripcion,creado_en,actualizado_en) VALUES (?,?,?,?,?,?,?)",
                         (metodo_id, datos.nombre, datos.tipo.value, int(datos.habilitado), datos.descripcion, ahora, ahora))
        fila = conexion.execute("SELECT * FROM metodos_pago WHERE id=?", (metodo_id,)).fetchone()
    return metodo_a_diccionario(fila)

@app.get("/api/v1/metodos-pago", tags=["Métodos de pago"], summary="Consultar métodos de pago")
def listar_metodos_pago(habilitado: Optional[bool] = None):
    with conectar() as conexion:
        if habilitado is None:
            filas = conexion.execute("SELECT * FROM metodos_pago ORDER BY creado_en DESC").fetchall()
        else:
            filas = conexion.execute("SELECT * FROM metodos_pago WHERE habilitado=? ORDER BY creado_en DESC", (int(habilitado),)).fetchall()
    return [metodo_a_diccionario(fila) for fila in filas]

@app.get("/api/v1/metodos-pago/{metodo_id}", tags=["Métodos de pago"], summary="Consultar un método de pago")
def obtener_metodo_pago(metodo_id: str):
    with conectar() as conexion:
        fila = conexion.execute("SELECT * FROM metodos_pago WHERE id=?", (metodo_id,)).fetchone()
    if fila is None:
        raise HTTPException(status_code=404, detail="No se encontró el método de pago")
    return metodo_a_diccionario(fila)

@app.patch("/api/v1/metodos-pago/{metodo_id}", tags=["Métodos de pago"], summary="Actualizar un método de pago")
def actualizar_metodo_pago(metodo_id: str, datos: MetodoPagoActualizar):
    cambios = datos.model_dump(exclude_unset=True)
    if not cambios:
        raise HTTPException(status_code=400, detail="Debes enviar al menos un campo para actualizar")
    if "tipo" in cambios and cambios["tipo"] is not None:
        cambios["tipo"] = cambios["tipo"].value
    if "habilitado" in cambios and cambios["habilitado"] is not None:
        cambios["habilitado"] = int(cambios["habilitado"])
    cambios["actualizado_en"] = fecha_actual()
    asignaciones = ", ".join(f"{campo}=?" for campo in cambios)
    with conectar() as conexion:
        cursor = conexion.execute(f"UPDATE metodos_pago SET {asignaciones} WHERE id=?", (*cambios.values(), metodo_id))
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="No se encontró el método de pago")
        fila = conexion.execute("SELECT * FROM metodos_pago WHERE id=?", (metodo_id,)).fetchone()
    return metodo_a_diccionario(fila)

@app.delete("/api/v1/metodos-pago/{metodo_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["Métodos de pago"], summary="Eliminar un método de pago")
def eliminar_metodo_pago(metodo_id: str):
    with conectar() as conexion:
        existe = conexion.execute("SELECT id FROM metodos_pago WHERE id=?", (metodo_id,)).fetchone()
        if existe is None:
            raise HTTPException(status_code=404, detail="No se encontró el método de pago")
        usados = conexion.execute("SELECT COUNT(*) AS total FROM pagos WHERE metodo_pago_id=?", (metodo_id,)).fetchone()["total"]
        if usados:
            raise HTTPException(status_code=409, detail="No se puede eliminar este método porque tiene pagos asociados. Elimina primero los pagos de prueba asociados.")
        conexion.execute("DELETE FROM metodos_pago WHERE id=?", (metodo_id,))
    return None

@app.post("/api/v1/pagos", status_code=status.HTTP_201_CREATED, tags=["Pagos"], summary="Registrar un pago de demostración")
def registrar_pago(datos: SolicitudPago):
    if datos.moneda.upper() != "MXN":
        raise HTTPException(status_code=422, detail="En esta versión solamente se admite MXN (peso mexicano)")
    with conectar() as conexion:
        metodo = conexion.execute("SELECT * FROM metodos_pago WHERE id=?", (datos.metodo_pago_id,)).fetchone()
        if metodo is None:
            raise HTTPException(status_code=404, detail="No se encontró el método de pago")
        if not metodo["habilitado"]:
            raise HTTPException(status_code=409, detail="El método de pago está deshabilitado")
        pago_id, ahora = str(uuid4()), fecha_actual()
        conexion.execute("INSERT INTO pagos (id,monto,moneda,metodo_pago_id,referencia,estado,creado_en) VALUES (?,?,?,?,?,?,?)",
                         (pago_id, datos.monto, "MXN", datos.metodo_pago_id, datos.referencia, "pendiente_demo", ahora))
    return {"id": pago_id, "monto": datos.monto, "moneda": "MXN", "metodo_pago_id": datos.metodo_pago_id,
            "referencia": datos.referencia, "estado": "pendiente_demo", "creado_en": ahora,
            "mensaje": "Solicitud registrada en modo demostración; no se realizó ningún cobro real."}

@app.get("/api/v1/pagos", tags=["Pagos"], summary="Consultar pagos registrados")
def listar_pagos():
    with conectar() as conexion:
        filas = conexion.execute("""SELECT p.*, m.nombre AS metodo_nombre
                                   FROM pagos p LEFT JOIN metodos_pago m ON m.id=p.metodo_pago_id
                                   ORDER BY p.creado_en DESC""").fetchall()
    return [dict(f) for f in filas]

@app.get("/api/v1/pagos/{pago_id}", tags=["Pagos"], summary="Consultar un pago")
def obtener_pago(pago_id: str):
    with conectar() as conexion:
        fila = conexion.execute("""SELECT p.*, m.nombre AS metodo_nombre
                                  FROM pagos p LEFT JOIN metodos_pago m ON m.id=p.metodo_pago_id
                                  WHERE p.id=?""", (pago_id,)).fetchone()
    if fila is None:
        raise HTTPException(status_code=404, detail="No se encontró el pago")
    return dict(fila)

@app.delete("/api/v1/pagos/{pago_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["Pagos"], summary="Eliminar un pago de prueba")
def eliminar_pago(pago_id: str):
    with conectar() as conexion:
        cursor = conexion.execute("DELETE FROM pagos WHERE id=?", (pago_id,))
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="No se encontró el pago")
    return None

@app.delete("/api/v1/datos-prueba", tags=["Administración"], summary="Eliminar todos los datos de prueba")
def eliminar_datos_prueba():
    with conectar() as conexion:
        pagos = conexion.execute("SELECT COUNT(*) AS total FROM pagos").fetchone()["total"]
        metodos = conexion.execute("SELECT COUNT(*) AS total FROM metodos_pago").fetchone()["total"]
        conexion.execute("DELETE FROM pagos")
        conexion.execute("DELETE FROM metodos_pago")
    return {"mensaje": "Datos de prueba eliminados correctamente", "pagos_eliminados": pagos, "metodos_eliminados": metodos}
