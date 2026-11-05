const express = require("express");
const sql = require("mssql/msnodesqlv8");
const path = require("path");

const app = express();
const puerto = 3000;

// cadena de conexion
const conexion = {
  connectionString:
    "Driver={ODBC Driver 17 for SQL Server};Server=MARCE;Database=DulceBarro;Trusted_Connection=Yes;TrustServerCertificate=Yes;"
};

app.disable("x-powered-by");

app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  next();
});

// Solo se publica esta carpeta. servidor.js queda fuera del acceso público.
app.use(express.static(path.join(__dirname, "public")));

const pool = new sql.ConnectionPool(conexion);

pool.on("error", () => {
  console.error("Se produjo un error en la conexión con SQL Server.");
});

app.get("/api/catalogo", async (req, res) => {
  res.setHeader("Cache-Control", "no-store");

  try {
    const resultado = await pool.request().query(`
      SELECT
        Id AS id,
        Nombre AS nombre
      FROM Categorias
      ORDER BY Id;

      SELECT
        p.Id AS id,
        p.Nombre AS nombre,
        p.Descripcion AS descripcion,
        p.Precio AS precio,
        p.PrecioAnterior AS precioAnterior,
        p.Etiqueta AS etiqueta,
        p.EtiquetaDestacada AS etiquetaDestacada,
        p.CategoriaId AS categoriaId,
        c.Nombre AS categoria
      FROM Productos p
      INNER JOIN Categorias c ON c.Id = p.CategoriaId
      WHERE p.Activo = 1
      ORDER BY p.Id;

      SELECT
        f.ProductoId AS productoId,
        f.Ruta AS ruta,
        f.TextoAlternativo AS textoAlternativo
      FROM FotosProducto f
      INNER JOIN Productos p ON p.Id = f.ProductoId
      WHERE p.Activo = 1
      ORDER BY f.Orden, f.Id;

      SELECT Valor AS portada
      FROM Configuracion
      WHERE Clave = N'portada';
    `);

    const [categorias, productos, fotos, configuracion] = resultado.recordsets;

    const fotosPorProducto = new Map();

    for (const foto of fotos) {
      if (!fotosPorProducto.has(foto.productoId)) {
        fotosPorProducto.set(foto.productoId, []);
      }

      fotosPorProducto.get(foto.productoId).push({
        ruta: foto.ruta,
        textoAlternativo: foto.textoAlternativo
      });
    }

    res.json({
      categorias,
      productos: productos.map(producto => ({
        ...producto,
        fotos: fotosPorProducto.get(producto.id) || []
      })),
      portada: configuracion[0]?.portada || null
    });
  } catch {
    console.error("No se pudo consultar el catálogo.");

    res.status(503).json({
      error: "No se pudo cargar el catálogo. Inténtalo de nuevo."
    });
  }
});

async function iniciar() {
  try {
    await pool.connect();

    app.listen(puerto, "127.0.0.1", () => {
      console.log(`Dulce Barro: http://localhost:${puerto}`);
    });
    } catch (error) {
    console.error("Error al conectar:", error.message);
    process.exitCode = 1;
    await pool.close().catch(() => {});
  }
}

iniciar();