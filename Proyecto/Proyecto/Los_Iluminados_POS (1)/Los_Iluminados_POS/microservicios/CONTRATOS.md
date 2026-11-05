# Contratos de los servicios

Cada servicio vive en `frontend/js/services/` como un objeto con métodos `async`.
Para conectar el microservicio real, se reemplaza el cuerpo de sus métodos por `fetch` a su API;
las firmas y los mensajes de error se mantienen. La columna REST es la ruta sugerida.

| Servicio | Método | Entrada | Salida | REST sugerido |
|---|---|---|---|---|
| Registro | `register({nombre,email,password})` | datos del usuario | usuario público | `POST /usuarios` |
| Autenticación | `login(email,password)` | credenciales | usuario público (sesión 8 h) | `POST /api/v1/login` |
| Autenticación | `current()` / `logout()` | – | usuario o `null` | `GET /sesion` / `DELETE /sesion` |
| Catálogo | `list()` / `get(id)` | – / id | productos (con categoría y franquicia) | `GET /productos` / `GET /productos/{id}` |
| Inventario | `all()` | – | `{idProducto: existencias}` | `GET /inventario` |
| Inventario | `check(lineas)` | `[{id,name,quantity}]` | error si falta stock | `POST /inventario/verificar` |
| Inventario | `discount(lineas)` | idem | descuenta existencias (tras pago confirmado) | `POST /inventario/descuento` |
| Inventario | `restock(id,qty)` | id, 1–1000 | – (solo admin) | `POST /inventario/{id}/entradas` |
| Carrito | `priced()` / `add(id)` / `change(id,delta)` / `remove(id)` / `clear()` | – | líneas con precio real | `/carrito` |
| Métodos de pago | `list()` / `get(id)` / `add({titular,numero,vence})` / `remove(id)` | – | métodos del usuario (solo marca y últimos 4) | `/metodos-pago` |
| Pedidos | `create(lineas)` | `[{id,quantity}]` | pedido `PED-0001` en `pendiente_pago` | `POST /pedidos` |
| Pedidos | `list()` / `get(id)` / `cancel(id)` | – / id | pedidos del usuario (admin: todos) | `GET /pedidos`, `DELETE /pedidos/{id}` |
| Pagos | `pay(orderId, methodId)` | ids | `{ok, reason}` | `POST /pagos` |
| Pagos | `handleWebhook(evento)` | evento Stripe | `{processed}` (idempotente por `evento.id`) | `POST /pagos/webhook` |

## Reglas que ya cumplen los servicios

- Cada servicio local valida la sesión y el rol por su cuenta; no depende de la interfaz.
- Los precios y el importe del pago se toman del catálogo y del pedido, nunca del cliente.
- El inventario se descuenta solo cuando el pago queda confirmado, y se vuelve a verificar en ese momento.
- Un cliente solo ve y modifica sus pedidos y sus tarjetas; el encargado ve todas las ventas.
- Estados del pedido: `pendiente_pago` → `pagado` | `pago_rechazado` (reintentable) | `cancelado`.

## Pruebas

```
cd frontend
node tests/servicios.test.js
```

Las pruebas de servicios deben seguir pasando después de conectar cada servicio real.

## Contratos reales de los repositorios

La app descrita arriba sigue usando los servicios locales de `frontend/js/services/`. El microservicio
separado de Métodos de pago administra tipos globales de pago y registra pagos de demostración; no guarda
tarjetas de clientes, no tiene identidad/autorización y no cobra dinero real. No debe conectarse al flujo
de pedidos de la app hasta implementar autenticación y una pasarela de pago real.

Se leyó el README de los repositorios que GitHub permitió consultar. El código fuente no se pudo leer,
así que solo hay contrato confirmado para Autenticación.

### Autenticación (`AldoHassiel/servicio-autenticacion`)

| Método | Ruta | Cuerpo / efecto | Respuesta |
|---|---|---|---|
| `POST` | `/iniciar-sesion` | `{correo, contrasena}` → cookie `token` (JWT, HTTP-only, 1 h) | `{exito, mensaje, datos:{id, correo, nombres, apellidos, rol}}`; `401` si es incorrecto |
| `GET` | `/validar-sesion` | requiere cookie | usuario en `datos`; `401` si no hay sesión |
| `POST` | `/cerrar-sesion` | revoca el token y borra la cookie | `{exito:true, mensaje:"Sesión cerrada."}` |

Para funcionar necesita que la tienda (Registro de Usuarios) exponga `GET /usuarios/por-correo/{correo}`
(devuelve `{id, correo, contrasena_guardada, nombres, apellidos, rol}`) y `GET /usuarios/{id}`.
Desde el navegador se llama con `credentials: 'include'`. Equivale a `authService.login/current/logout` de la app.

### Catálogo (`marcekitty/dulce-barro`)

Node.js + Express + SQL Server en `http://localhost:3000`. Sin rutas documentadas.

### Carrito (`yurianacevil/CarritoService`)

Sin README ni rutas documentadas.

### Sin información

Registro, Métodos de pago, Procesamiento de pagos, Gestión de pedidos e Inventarios: no se pudo leer su contenido.
