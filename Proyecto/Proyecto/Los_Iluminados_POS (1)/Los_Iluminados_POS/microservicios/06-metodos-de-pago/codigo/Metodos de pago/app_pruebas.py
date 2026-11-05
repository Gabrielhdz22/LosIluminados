import json
import os
import subprocess
import sys
import time
import tkinter as tk
from tkinter import ttk, messagebox
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
from pathlib import Path

BASE = Path(__file__).resolve().parent
URL_BASE = "http://127.0.0.1:8000"
PROCESO_SERVICIO = None


def request_json(method, path, data=None):
    url = URL_BASE + path
    body = json.dumps(data).encode("utf-8") if data is not None else None
    headers = {"Accept": "application/json"}
    if data is not None:
        headers["Content-Type"] = "application/json"
    req = Request(url, data=body, headers=headers, method=method)
    try:
        with urlopen(req, timeout=5) as resp:
            raw = resp.read().decode("utf-8")
            return resp.status, json.loads(raw) if raw else None
    except HTTPError as e:
        raw = e.read().decode("utf-8", errors="replace")
        try:
            detalle = json.loads(raw)
        except json.JSONDecodeError:
            detalle = raw
        return e.code, detalle
    except URLError as e:
        raise ConnectionError("No se pudo conectar con el microservicio.\n\n" + str(e.reason))


def iniciar_microservicio():
    global PROCESO_SERVICIO
    python = BASE / ".venv" / "Scripts" / "python.exe"
    if not python.exists():
        python = Path(sys.executable)
    PROCESO_SERVICIO = subprocess.Popen(
        [str(python), "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8000"],
        cwd=BASE,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0,
    )


def esperar_servicio():
    for _ in range(40):
        try:
            status, _ = request_json("GET", "/salud")
            if status == 200:
                return True
        except Exception:
            pass
        time.sleep(0.25)
    return False


class Aplicacion(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("Panel de pruebas — Microservicio de Métodos de Pago")
        self.geometry("1450x850")
        self.minsize(1180, 700)
        self.configure(bg="#f3f5f7")
        self.protocol("WM_DELETE_WINDOW", self.cerrar)
        self.crear_estilos()
        self.crear_interfaz()
        self.actualizar_todo()

    def crear_estilos(self):
        s = ttk.Style(self)
        s.theme_use("clam")
        s.configure("Titulo.TLabel", font=("Segoe UI", 20, "bold"))
        s.configure("Subtitulo.TLabel", font=("Segoe UI", 10))
        s.configure("Seccion.TLabelframe.Label", font=("Segoe UI", 11, "bold"))
        s.configure("Accion.TButton", font=("Segoe UI", 10, "bold"), padding=(9, 6))
        s.configure("Tabla.Treeview", rowheight=30, font=("Segoe UI", 9))
        s.configure("Tabla.Treeview.Heading", font=("Segoe UI", 9, "bold"))
        s.configure("Tarjeta.TLabel", font=("Segoe UI", 18, "bold"))
        s.configure("Estado.TLabel", font=("Segoe UI", 10, "bold"))

    def crear_interfaz(self):
        cont = ttk.Frame(self, padding=18)
        cont.pack(fill="both", expand=True)
        encabezado = ttk.Frame(cont)
        encabezado.pack(fill="x")
        ttk.Label(encabezado, text="Microservicio de Métodos de Pago", style="Titulo.TLabel").pack(anchor="w")
        ttk.Label(encabezado, text="Panel de escritorio para probar y administrar la API REST en modo demostración.", style="Subtitulo.TLabel").pack(anchor="w", pady=(2, 8))

        barra = ttk.Frame(cont)
        barra.pack(fill="x", pady=(0, 10))
        ttk.Button(barra, text="✓ Comprobar servicio", command=self.comprobar_servicio, style="Accion.TButton").pack(side="left")
        ttk.Button(barra, text="↻ Actualizar todo", command=self.actualizar_todo).pack(side="left", padx=7)
        ttk.Button(barra, text="📖 Abrir documentación", command=self.abrir_documentacion).pack(side="left")
        ttk.Button(barra, text="⚠ Borrar datos de prueba", command=self.borrar_todo, style="Accion.TButton").pack(side="right")
        self.etiqueta_estado = ttk.Label(barra, text="", style="Estado.TLabel")
        self.etiqueta_estado.pack(side="right", padx=14)

        self.notebook = ttk.Notebook(cont)
        self.notebook.pack(fill="both", expand=True)
        self.tab_resumen = ttk.Frame(self.notebook, padding=12)
        self.tab_metodos = ttk.Frame(self.notebook, padding=12)
        self.tab_pagos = ttk.Frame(self.notebook, padding=12)
        self.tab_respuesta = ttk.Frame(self.notebook, padding=12)
        self.notebook.add(self.tab_resumen, text="Resumen")
        self.notebook.add(self.tab_metodos, text="Métodos de pago")
        self.notebook.add(self.tab_pagos, text="Pagos")
        self.notebook.add(self.tab_respuesta, text="Respuesta API")
        self.crear_resumen()
        self.crear_metodos()
        self.crear_pagos()
        self.crear_respuesta()

    def crear_resumen(self):
        for i in range(4): self.tab_resumen.columnconfigure(i, weight=1)
        tarjetas = [("Métodos", "lbl_metodos"), ("Habilitados", "lbl_habilitados"), ("Pagos", "lbl_pagos"), ("Monto total", "lbl_total")]
        for i, (titulo, attr) in enumerate(tarjetas):
            marco = ttk.LabelFrame(self.tab_resumen, text=titulo, padding=15)
            marco.grid(row=0, column=i, sticky="nsew", padx=6, pady=6)
            lbl = ttk.Label(marco, text="—", style="Tarjeta.TLabel")
            lbl.pack(anchor="center", pady=12)
            setattr(self, attr, lbl)
        info = ttk.LabelFrame(self.tab_resumen, text="Estado del sistema", padding=18)
        info.grid(row=1, column=0, columnspan=4, sticky="nsew", padx=6, pady=12)
        self.lbl_salud = ttk.Label(info, text="Comprobando...", font=("Segoe UI", 12, "bold"))
        self.lbl_salud.pack(anchor="w", pady=5)
        ttk.Label(info, text="Los pagos de esta aplicación son demostrativos; no se realiza ningún cobro real.").pack(anchor="w", pady=4)
        ttk.Label(info, text="Usa las pestañas Métodos de pago y Pagos para realizar las pruebas del CRUD.").pack(anchor="w", pady=4)

    def crear_metodos(self):
        self.tab_metodos.columnconfigure(0, weight=1)
        self.tab_metodos.rowconfigure(1, weight=1)
        formulario = ttk.LabelFrame(self.tab_metodos, text="Nuevo método de pago", padding=10)
        formulario.grid(row=0, column=0, sticky="ew", pady=(0, 10))
        for c in range(7): formulario.columnconfigure(c, weight=1 if c in (1,3,5) else 0)
        ttk.Label(formulario, text="Nombre:").grid(row=0, column=0, sticky="w")
        self.nombre = ttk.Entry(formulario)
        self.nombre.grid(row=0, column=1, sticky="ew", padx=(5, 15))
        ttk.Label(formulario, text="Tipo:").grid(row=0, column=2, sticky="w")
        self.tipo = ttk.Combobox(formulario, state="readonly", values=["efectivo", "tarjeta_debito", "tarjeta_credito", "transferencia", "billetera_digital"])
        self.tipo.current(0); self.tipo.grid(row=0, column=3, sticky="ew", padx=(5, 15))
        ttk.Label(formulario, text="Descripción:").grid(row=0, column=4, sticky="w")
        self.descripcion = ttk.Entry(formulario)
        self.descripcion.grid(row=0, column=5, sticky="ew", padx=(5, 15))
        ttk.Button(formulario, text="Crear", command=self.crear_metodo, style="Accion.TButton").grid(row=0, column=6)

        tabla = ttk.LabelFrame(self.tab_metodos, text="Métodos registrados", padding=8)
        tabla.grid(row=1, column=0, sticky="nsew")
        tabla.columnconfigure(0, weight=1); tabla.rowconfigure(0, weight=1)
        cols = ("id", "nombre", "tipo", "habilitado", "descripcion")
        self.tabla_metodos = ttk.Treeview(tabla, columns=cols, show="headings", style="Tabla.Treeview")
        titulos = {"id":"ID", "nombre":"Nombre", "tipo":"Tipo", "habilitado":"Estado", "descripcion":"Descripción"}
        for col in cols:
            self.tabla_metodos.heading(col, text=titulos[col])
            self.tabla_metodos.column(col, width={"id":300,"nombre":180,"tipo":170,"habilitado":100,"descripcion":360}[col], anchor="w")
        sy = ttk.Scrollbar(tabla, orient="vertical", command=self.tabla_metodos.yview)
        self.tabla_metodos.configure(yscrollcommand=sy.set)
        self.tabla_metodos.grid(row=0,column=0,sticky="nsew"); sy.grid(row=0,column=1,sticky="ns")
        botones = ttk.Frame(tabla); botones.grid(row=1,column=0,columnspan=2,sticky="ew",pady=(8,0))
        ttk.Button(botones, text="Habilitar / deshabilitar", command=self.cambiar_estado).pack(side="left")
        ttk.Button(botones, text="Eliminar seleccionado", command=self.eliminar_metodo).pack(side="left", padx=8)
        ttk.Button(botones, text="Actualizar tabla", command=self.cargar_metodos).pack(side="left")

    def crear_pagos(self):
        self.tab_pagos.columnconfigure(0, weight=1); self.tab_pagos.rowconfigure(1, weight=1)
        formulario = ttk.LabelFrame(self.tab_pagos, text="Registrar pago de prueba", padding=10)
        formulario.grid(row=0,column=0,sticky="ew",pady=(0,10))
        ttk.Label(formulario,text="Monto (MXN):").pack(side="left")
        self.monto=ttk.Entry(formulario,width=14); self.monto.insert(0,"100.00"); self.monto.pack(side="left",padx=(6,15))
        ttk.Label(formulario,text="Método:").pack(side="left")
        self.metodo_pago=ttk.Combobox(formulario,width=34,state="readonly"); self.metodo_pago.pack(side="left",padx=(6,15))
        ttk.Label(formulario,text="Referencia:").pack(side="left")
        self.referencia=ttk.Entry(formulario,width=28); self.referencia.pack(side="left",padx=6)
        ttk.Button(formulario,text="Registrar pago",command=self.registrar_pago,style="Accion.TButton").pack(side="left",padx=5)

        tabla=ttk.LabelFrame(self.tab_pagos,text="Pagos registrados",padding=8)
        tabla.grid(row=1,column=0,sticky="nsew"); tabla.columnconfigure(0,weight=1); tabla.rowconfigure(0,weight=1)
        cols=("id","monto","metodo","referencia","estado","fecha")
        self.tabla_pagos=ttk.Treeview(tabla,columns=cols,show="headings",style="Tabla.Treeview")
        titulos={"id":"ID","monto":"Monto","metodo":"Método","referencia":"Referencia","estado":"Estado","fecha":"Fecha"}
        for col in cols:
            self.tabla_pagos.heading(col,text=titulos[col])
            self.tabla_pagos.column(col,width={"id":300,"monto":100,"metodo":180,"referencia":180,"estado":130,"fecha":190}[col],anchor="w")
        sy=ttk.Scrollbar(tabla,orient="vertical",command=self.tabla_pagos.yview)
        self.tabla_pagos.configure(yscrollcommand=sy.set)
        self.tabla_pagos.grid(row=0,column=0,sticky="nsew"); sy.grid(row=0,column=1,sticky="ns")
        botones=ttk.Frame(tabla); botones.grid(row=1,column=0,columnspan=2,sticky="ew",pady=(8,0))
        ttk.Button(botones,text="Eliminar pago seleccionado",command=self.eliminar_pago).pack(side="left")
        ttk.Button(botones,text="Actualizar pagos",command=self.cargar_pagos).pack(side="left",padx=8)

    def crear_respuesta(self):
        ttk.Label(self.tab_respuesta,text="Última respuesta recibida de la API",font=("Segoe UI",12,"bold")).pack(anchor="w",pady=(0,8))
        self.resultado=tk.Text(self.tab_respuesta,wrap="none",font=("Consolas",10),bg="#101418",fg="#e8edf2",insertbackground="white")
        self.resultado.pack(fill="both",expand=True)
        self.resultado.configure(state="disabled")

    def estado(self,texto): self.etiqueta_estado.config(text=texto)

    def mostrar_resultado(self,datos):
        self.resultado.configure(state="normal"); self.resultado.delete("1.0","end")
        self.resultado.insert("1.0",json.dumps(datos,indent=2,ensure_ascii=False) if datos is not None else "Sin contenido (204 No Content)")
        self.resultado.configure(state="disabled")

    @staticmethod
    def error(datos): return str(datos.get("detail",datos)) if isinstance(datos,dict) else str(datos)

    def comprobar_servicio(self):
        try:
            codigo,res=request_json("GET","/salud"); self.mostrar_resultado(res)
            if codigo==200:
                self.estado("✓ Servicio funcionando"); self.lbl_salud.config(text="🟢 Microservicio funcionando")
            else: self.estado("✗ Error del servicio")
        except Exception as e:
            self.estado("🔴 Servicio no disponible"); self.lbl_salud.config(text="🔴 Microservicio no disponible")
            messagebox.showerror("Error de conexión",str(e))

    def actualizar_todo(self):
        self.comprobar_servicio(); self.cargar_resumen(); self.cargar_metodos(); self.cargar_pagos()

    def cargar_resumen(self):
        try:
            codigo,d=request_json("GET","/api/v1/resumen")
            if codigo!=200: raise RuntimeError(self.error(d))
            self.lbl_metodos.config(text=str(d["metodos"])); self.lbl_habilitados.config(text=str(d["metodos_habilitados"])); self.lbl_pagos.config(text=str(d["pagos"])); self.lbl_total.config(text=f'$ {d["monto_total"]:,.2f} MXN')
        except Exception: pass

    def cargar_metodos(self):
        try:
            codigo,datos=request_json("GET","/api/v1/metodos-pago")
            if codigo!=200: raise RuntimeError(self.error(datos))
            for i in self.tabla_metodos.get_children(): self.tabla_metodos.delete(i)
            valores=[]
            for m in datos:
                self.tabla_metodos.insert("","end",iid=m["id"],values=(m["id"],m["nombre"],m["tipo"],"Habilitado" if m["habilitado"] else "Deshabilitado",m.get("descripcion") or ""))
                if m["habilitado"]: valores.append(f'{m["nombre"]} | {m["id"]}')
            self.metodo_pago["values"]=valores
            if valores: self.metodo_pago.current(0)
            else: self.metodo_pago.set("")
            self.estado(f"{len(datos)} método(s) cargado(s)")
        except Exception as e:
            self.estado("No se pudieron cargar los métodos")

    def crear_metodo(self):
        nombre=self.nombre.get().strip()
        if len(nombre)<2: messagebox.showwarning("Datos incompletos","Escribe un nombre para el método de pago."); return
        payload={"nombre":nombre,"tipo":self.tipo.get(),"habilitado":True,"descripcion":self.descripcion.get().strip() or None}
        try:
            codigo,d=request_json("POST","/api/v1/metodos-pago",payload)
            if codigo!=201: raise RuntimeError(self.error(d))
            self.mostrar_resultado(d); self.nombre.delete(0,"end"); self.descripcion.delete(0,"end"); self.actualizar_todo(); self.estado("✓ Método creado correctamente")
        except Exception as e: messagebox.showerror("No se pudo crear",str(e))

    def seleccionado_metodo(self):
        sel=self.tabla_metodos.selection()
        if not sel: messagebox.showwarning("Selecciona un método","Selecciona primero un método en la tabla."); return None
        return sel[0]

    def cambiar_estado(self):
        mid=self.seleccionado_metodo()
        if not mid:return
        try:
            c,actual=request_json("GET",f"/api/v1/metodos-pago/{mid}")
            if c!=200: raise RuntimeError(self.error(actual))
            c,d=request_json("PATCH",f"/api/v1/metodos-pago/{mid}",{"habilitado":not actual["habilitado"]})
            if c!=200: raise RuntimeError(self.error(d))
            self.mostrar_resultado(d); self.actualizar_todo(); self.estado("✓ Estado actualizado")
        except Exception as e: messagebox.showerror("No se pudo actualizar",str(e))

    def eliminar_metodo(self):
        mid=self.seleccionado_metodo()
        if not mid:return
        if not messagebox.askyesno("Confirmar eliminación","¿Deseas eliminar el método seleccionado?\n\nSi tiene pagos asociados, primero debes eliminar esos pagos de prueba."): return
        try:
            c,d=request_json("DELETE",f"/api/v1/metodos-pago/{mid}")
            if c!=204: raise RuntimeError(self.error(d))
            self.mostrar_resultado({"mensaje":"Método eliminado correctamente."}); self.actualizar_todo(); self.estado("✓ Método eliminado")
        except Exception as e: messagebox.showerror("No se pudo eliminar",str(e))

    def registrar_pago(self):
        try:
            monto=float(self.monto.get().replace(",",".")); seleccion=self.metodo_pago.get()
            if " | " not in seleccion: raise ValueError("Selecciona un método de pago habilitado.")
            mid=seleccion.rsplit(" | ",1)[1]
            payload={"monto":monto,"moneda":"MXN","metodo_pago_id":mid,"referencia":self.referencia.get().strip() or None}
            c,d=request_json("POST","/api/v1/pagos",payload)
            if c!=201: raise RuntimeError(self.error(d))
            self.mostrar_resultado(d); self.cargar_pagos(); self.cargar_resumen(); self.estado("✓ Pago de prueba registrado")
        except ValueError as e: messagebox.showwarning("Dato inválido",str(e))
        except Exception as e: messagebox.showerror("No se pudo registrar el pago",str(e))

    def cargar_pagos(self):
        try:
            c,datos=request_json("GET","/api/v1/pagos")
            if c!=200: raise RuntimeError(self.error(datos))
            for i in self.tabla_pagos.get_children(): self.tabla_pagos.delete(i)
            for p in datos:
                fecha=p.get("creado_en","").replace("T"," ")[:19]
                self.tabla_pagos.insert("","end",iid=p["id"],values=(p["id"],f'$ {p["monto"]:,.2f}',p.get("metodo_nombre") or "Sin método",p.get("referencia") or "—",p["estado"],fecha))
        except Exception as e: self.estado("No se pudieron cargar los pagos")

    def eliminar_pago(self):
        sel=self.tabla_pagos.selection()
        if not sel: messagebox.showwarning("Selecciona un pago","Selecciona primero un pago en la tabla."); return
        pid=sel[0]
        if not messagebox.askyesno("Confirmar eliminación","¿Deseas eliminar este pago de prueba? Esta acción no se puede deshacer."): return
        try:
            c,d=request_json("DELETE",f"/api/v1/pagos/{pid}")
            if c!=204: raise RuntimeError(self.error(d))
            self.mostrar_resultado({"mensaje":"Pago de prueba eliminado correctamente."}); self.actualizar_todo(); self.estado("✓ Pago eliminado")
        except Exception as e: messagebox.showerror("No se pudo eliminar",str(e))

    def borrar_todo(self):
        if not messagebox.askyesno("Borrar datos de prueba","¿Seguro que deseas eliminar TODOS los métodos y pagos de prueba?\n\nEsta acción no se puede deshacer."): return
        try:
            c,d=request_json("DELETE","/api/v1/datos-prueba")
            if c!=200: raise RuntimeError(self.error(d))
            self.mostrar_resultado(d); self.actualizar_todo(); self.estado("✓ Datos de prueba eliminados")
        except Exception as e: messagebox.showerror("No se pudieron borrar los datos",str(e))

    def abrir_documentacion(self):
        import webbrowser
        webbrowser.open(URL_BASE+"/documentacion")

    def cerrar(self):
        global PROCESO_SERVICIO
        if PROCESO_SERVICIO and PROCESO_SERVICIO.poll() is None: PROCESO_SERVICIO.terminate()
        self.destroy()


def main():
    if not esperar_servicio():
        iniciar_microservicio()
        if not esperar_servicio():
            messagebox.showerror("Error","No fue posible iniciar el microservicio en http://127.0.0.1:8000")
            return
    app=Aplicacion(); app.mainloop()

if __name__=="__main__": main()
