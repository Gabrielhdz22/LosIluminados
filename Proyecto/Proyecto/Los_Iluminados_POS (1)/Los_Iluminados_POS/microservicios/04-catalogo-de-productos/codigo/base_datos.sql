-- Ejecutar en SQL Server Management Studio.

IF DB_ID(N'DulceBarro') IS NULL
    EXEC(N'CREATE DATABASE DulceBarro');
GO

USE DulceBarro;
GO

CREATE TABLE Categorias (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    Nombre NVARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE Productos (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    CategoriaId INT NOT NULL,
    Nombre NVARCHAR(150) NOT NULL,
    Descripcion NVARCHAR(1000) NOT NULL,
    Precio DECIMAL(10,2) NOT NULL CHECK (Precio >= 0),
    PrecioAnterior DECIMAL(10,2) NULL,
    Etiqueta NVARCHAR(50) NULL,
    EtiquetaDestacada BIT NOT NULL DEFAULT 0,
    Activo BIT NOT NULL DEFAULT 1,

    CONSTRAINT FK_Productos_Categorias
        FOREIGN KEY (CategoriaId) REFERENCES Categorias(Id),

    CONSTRAINT CK_Productos_PrecioAnterior
        CHECK (PrecioAnterior IS NULL OR PrecioAnterior > Precio)
);

CREATE TABLE FotosProducto (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    ProductoId INT NOT NULL,
    Ruta NVARCHAR(500) NOT NULL,
    TextoAlternativo NVARCHAR(200) NOT NULL DEFAULT N'',
    Orden INT NOT NULL DEFAULT 0,

    CONSTRAINT FK_Fotos_Productos
        FOREIGN KEY (ProductoId) REFERENCES Productos(Id)
        ON DELETE CASCADE
);

CREATE TABLE Configuracion (
    Clave NVARCHAR(100) PRIMARY KEY,
    Valor NVARCHAR(1000) NOT NULL
);

CREATE INDEX IX_Productos_CategoriaId ON Productos(CategoriaId);
CREATE INDEX IX_FotosProducto_ProductoId ON FotosProducto(ProductoId);
GO

-- Datos iniciales: se guardan en la base, no en el HTML ni en JavaScript.

INSERT INTO Categorias (Nombre)
VALUES (N'Jarrones'), (N'Tazas'), (N'Platos y tazones'), (N'Macetas');

INSERT INTO Productos
    (CategoriaId, Nombre, Descripcion, Precio, PrecioAnterior, Etiqueta, EtiquetaDestacada)
SELECT
    c.Id, datos.Nombre, datos.Descripcion,
    datos.Precio, datos.PrecioAnterior, datos.Etiqueta, datos.Destacada
FROM (
    VALUES
    (N'Jarrones', N'Jarrón Flor', N'Gres rosa pastel, 28 cm',
        680.00, NULL, N'Nuevo', 0),
    (N'Tazas', N'Taza Gato', N'Esmalte azul mate, 300 ml',
        240.00, NULL, NULL, 0),
    (N'Platos y tazones', N'Tazón Corazón', N'Blanco con borde rosa, 16 cm',
        320.00, NULL, N'Más vendido', 1),
    (N'Platos y tazones', N'Plato Corazón', N'Plato llano menta, 26 cm',
        290.00, NULL, NULL, 0),
    (N'Jarrones', N'Jarra Pozo', N'Jarra azul con asa, 1.2 litros',
        890.00, NULL, NULL, 0),
    (N'Macetas', N'Maceta Sakura', N'Color durazno, con plato, para 15 cm',
        450.00, 520.00, N'Oferta', 1),
    (N'Tazas', N'Taza Espresso', N'Lavanda, juego de 2 piezas, 90 ml',
        480.00, NULL, NULL, 0),
    (N'Platos y tazones', N'Bowl Mágico', N'Rosa para servir, 30 cm',
        760.00, NULL, NULL, 0)
) AS datos(Categoria, Nombre, Descripcion, Precio, PrecioAnterior, Etiqueta, Destacada)
JOIN Categorias c ON c.Nombre = datos.Categoria;

INSERT INTO FotosProducto (ProductoId, Ruta, TextoAlternativo)
SELECT p.Id, datos.Ruta, p.Nombre
FROM (
    VALUES
    (N'Jarrón Flor', N'/img/jarronflor.jpg'),
    (N'Taza Gato', N'/img/tazagato.jpg'),
    (N'Tazón Corazón', N'/img/tazoncorazon.jpg'),
    (N'Plato Corazón', N'/img/platocorazon.jpg'),
    (N'Jarra Pozo', N'/img/jarrapozo.jpg'),
    (N'Maceta Sakura', N'/img/macetasakura.jpg'),
    (N'Taza Espresso', N'/img/tazaespresso.jpg'),
    (N'Bowl Mágico', N'/img/bowlmagico.jpg')
) AS datos(Nombre, Ruta)
JOIN Productos p ON p.Nombre = datos.Nombre;

INSERT INTO Configuracion (Clave, Valor)
VALUES (N'portada', N'/img/inicio.jpg');
GO