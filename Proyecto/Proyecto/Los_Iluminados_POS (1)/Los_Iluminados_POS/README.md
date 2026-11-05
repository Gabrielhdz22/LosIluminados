# Los Iluminados POS

Abre `frontend/index.html` en el navegador.

```
frontend/
├── index.html
├── css/styles.css
├── js/data.js            Catálogo base y pestañas
├── js/services/          Un archivo por microservicio
├── js/app.js             Interfaz
├── tests/servicios.test.js   pruebas de los servicios
└── assets/img/
microservicios/           Una carpeta por microservicio + CONTRATOS.md (métodos y rutas REST sugeridas)
clonar-microservicios.sh
```

## Modo local

Los servicios guardan los datos en `localStorage`, así que todo funciona sin servidor: registro, login,
carrito, pedidos, pagos simulados e inventario. Para pasar a producción, cada servicio de `js/services/`
se reemplaza por llamadas a su microservicio real (SQL Server, Stripe).

La cuenta preestablecida de administrador usa el usuario `ADMIN` y la contraseña `123456789`. Para abrir
el acceso de administrador de forma discreta, haz cinco clics rápidos en el logotipo. El administrador
puede consultar inventario, reabastecer y revisar todas las ventas. Todas las cuentas creadas mediante
el registro son clientes; cada cliente puede comprar y consultar solo sus propios pedidos.

Esta cuenta y la autenticación local son únicamente para demostración: no son seguras para producción.
En un despliegue real, autentica y autoriza en el servidor y cambia las credenciales de demostración.

## Funciones

- **Administrador:** en Productos e inventario puede crear y editar artículos, activar/desactivar su
  publicación y ajustar existencias. Los productos desactivados no aparecen en el catálogo, pero se
  conservan para el historial de ventas.
- **Reportes:** filtra ventas pagadas por fecha, consulta totales y productos más vendidos, y exporta el
  detalle a CSV.
- **Cliente:** busca por nombre, SKU, categoría o franquicia, filtra el catálogo y revisa el detalle de
  sus pedidos; al pagar recibe un resumen de confirmación.

Tarjetas de prueba: `4242 4242 4242 4242` aprueba, `4000 0000 0000 0002` se rechaza. Los pagos de esta
app son simulados: solo se conserva la marca, el titular, la fecha de vencimiento y los últimos cuatro
dígitos; no se realiza un cargo real. No uses datos de tarjetas reales.

## Pruebas

```
cd frontend
node tests/servicios.test.js
```
