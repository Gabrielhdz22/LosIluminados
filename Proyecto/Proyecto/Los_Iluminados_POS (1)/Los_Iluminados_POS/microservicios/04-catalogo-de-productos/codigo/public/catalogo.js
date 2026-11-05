const grid = document.getElementById("grid");
const chips = document.getElementById("chips");
const count = document.getElementById("count");
const heroArt = document.getElementById("heroArt");

let productos = [];
let categorias = [];
let categoriaActual = null;

const money = valor =>
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(valor);

function crearElemento(etiqueta, clase, texto) {
  const elemento = document.createElement(etiqueta);

  if (clase) elemento.className = clase;
  if (texto !== undefined) elemento.textContent = texto;

  return elemento;
}

function imagenNoDisponible(nombre) {
  const aviso = crearElemento("div", "ph", "Foto no disponible");
  aviso.setAttribute("role", "img");
  aviso.setAttribute("aria-label", `Foto no disponible: ${nombre}`);
  return aviso;
}

function crearImagen(ruta, nombre, esPortada = false) {
  if (!ruta) return imagenNoDisponible(nombre);

  let url;

  try {
    url = new URL(ruta, window.location.origin);
  } catch {
    return imagenNoDisponible(nombre);
  }

  // Las fotografías deben estar dentro de public/img/.
  if (
    url.origin !== window.location.origin ||
    !url.pathname.startsWith("/img/")
  ) {
    return imagenNoDisponible(nombre);
  }

  const imagen = document.createElement("img");
  imagen.alt = nombre;
  imagen.loading = esPortada ? "eager" : "lazy";

  imagen.addEventListener(
    "error",
    () => imagen.replaceWith(imagenNoDisponible(nombre)),
    { once: true }
  );

  imagen.src = url.href;

  return imagen;
}

function renderProductos() {
  const lista = categoriaActual === null
    ? productos
    : productos.filter(p => p.categoriaId === categoriaActual);

  count.textContent =
    `${lista.length} ${lista.length === 1 ? "pieza" : "piezas"} · MXN`;

  grid.replaceChildren();

  if (lista.length === 0) {
    grid.append(
      crearElemento("li", "", "No hay productos disponibles en esta categoría.")
    );
    return;
  }

  const fragmento = document.createDocumentFragment();

  for (const producto of lista) {
    const card = crearElemento("li", "card");
    const thumb = crearElemento("div", "thumb");

    const foto = producto.fotos[0];

    thumb.append(
      crearImagen(
        foto?.ruta,
        foto?.textoAlternativo || producto.nombre
      )
    );

    if (producto.etiqueta) {
      thumb.append(
        crearElemento(
          "span",
          producto.etiquetaDestacada ? "tag sun" : "tag",
          producto.etiqueta
        )
      );
    }

    // esto ya es del carrito xd
    const agregar = crearElemento("button", "add", "+");
    agregar.type = "button";
    agregar.disabled = true;
    agregar.title = "Carrito pendiente de implementación";
    agregar.setAttribute("aria-label", `Agregar ${producto.nombre}`);

    thumb.append(agregar);

    const info = crearElemento("div", "info");
    const detalles = crearElemento("div");

    detalles.append(
      crearElemento("h3", "", producto.nombre),
      crearElemento("p", "", producto.descripcion)
    );

    const precio = crearElemento("div", "price", money(producto.precio));

    if (producto.precioAnterior !== null) {
      precio.append(
        crearElemento("s", "", money(producto.precioAnterior))
      );
    }

    info.append(detalles, precio);
    card.append(thumb, info);
    fragmento.append(card);
  }

  grid.append(fragmento);
}

function renderCategorias() {
  chips.replaceChildren();

  // "Todas" es un control de interfaz; las categorías provienen de SQL Server.
  const opciones = [
    { id: null, nombre: "Todas" },
    ...categorias
  ];

  for (const categoria of opciones) {
    const boton = crearElemento("button", "chip", categoria.nombre);

    boton.type = "button";
    boton.setAttribute(
      "aria-pressed",
      String(categoria.id === categoriaActual)
    );

    boton.addEventListener("click", () => {
      categoriaActual = categoria.id;

      for (const otro of chips.children) {
        otro.setAttribute("aria-pressed", String(otro === boton));
      }

      renderProductos();
    });

    chips.append(boton);
  }
}

async function cargarCatalogo() {
  count.textContent = "Cargando catálogo…";
  grid.setAttribute("aria-busy", "true");
  grid.replaceChildren();
  chips.replaceChildren();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const respuesta = await fetch("/api/catalogo", {
      signal: controller.signal,
      cache: "no-store"
    });

    if (!respuesta.ok) {
      throw new Error("No se pudo consultar el catálogo.");
    }

    const datos = await respuesta.json();

    productos = datos.productos;
    categorias = datos.categorias;

    if (!categorias.some(c => c.id === categoriaActual)) {
      categoriaActual = null;
    }

    heroArt.replaceChildren(
      crearImagen(datos.portada, "Portada de Dulce Barro", true)
    );

    renderCategorias();
    renderProductos();
  } catch {
    count.textContent = "Catálogo no disponible.";

    const mensaje = crearElemento(
      "li",
      "",
      "No se pudieron cargar los productos. Comprueba que el servidor esté encendido."
    );

    const reintentar = crearElemento("button", "chip", "Reintentar");
    reintentar.type = "button";
    reintentar.addEventListener("click", cargarCatalogo);

    mensaje.append(document.createElement("br"), reintentar);
    grid.replaceChildren(mensaje);
  } finally {
    clearTimeout(timeout);
    grid.setAttribute("aria-busy", "false");
  }
}

cargarCatalogo();