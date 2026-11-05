using CarritoService.Models;

namespace CarritoService.Services;

public class CarritoService
{
	private readonly Dictionary<int, Carrito> carritos = new();

	private int siguienteId = 1;

	public Carrito CrearCarrito(int clienteId)
	{
		var carrito = new Carrito
		{
			Id = siguienteId++,
			ClienteId = clienteId,
			Estado = EstadoCarrito.Activo
		};

		carritos.Add(carrito.Id, carrito);

		return carrito;
	}

	public Carrito? ObtenerCarrito(int carritoId)
	{
		carritos.TryGetValue(carritoId, out var carrito);

		return carrito;
	}

	public Carrito AgregarProducto(
		int carritoId,
		CarritoItem item)
	{
		var carrito = ObtenerCarrito(carritoId);

		if (carrito == null)
			throw new KeyNotFoundException(
				"El carrito no existe.");

		if (carrito.Estado != EstadoCarrito.Activo)
			throw new InvalidOperationException(
				"El carrito no está activo.");

		if (item.Cantidad <= 0)
			throw new ArgumentException(
				"La cantidad debe ser mayor que cero.");

		if (item.PrecioUnitario < 0)
			throw new ArgumentException(
				"El precio no puede ser negativo.");

		var productoExistente = carrito.Items
			.FirstOrDefault(x =>
				x.ProductoId == item.ProductoId);

		if (productoExistente != null)
		{
			productoExistente.Cantidad += item.Cantidad;
		}
		else
		{
			carrito.Items.Add(item);
		}

		return carrito;
	}

	public Carrito? ActualizarCantidad(
		int carritoId,
		int productoId,
		int cantidad)
	{
		var carrito = ObtenerCarrito(carritoId);

		if (carrito == null)
			return null;

		if (carrito.Estado != EstadoCarrito.Activo)
			throw new InvalidOperationException(
				"El carrito no está activo.");

		if (cantidad <= 0)
			throw new ArgumentException(
				"La cantidad debe ser mayor que cero.");

		var item = carrito.Items
			.FirstOrDefault(x =>
				x.ProductoId == productoId);

		if (item == null)
			return null;

		item.Cantidad = cantidad;

		return carrito;
	}

	public bool EliminarProducto(
		int carritoId,
		int productoId)
	{
		var carrito = ObtenerCarrito(carritoId);

		if (carrito == null)
			return false;

		var item = carrito.Items
			.FirstOrDefault(x =>
				x.ProductoId == productoId);

		if (item == null)
			return false;

		carrito.Items.Remove(item);

		return true;
	}

	public bool VaciarCarrito(int carritoId)
	{
		var carrito = ObtenerCarrito(carritoId);

		if (carrito == null)
			return false;

		carrito.Items.Clear();

		return true;
	}

	public Carrito? ConfirmarCarrito(int carritoId)
	{
		var carrito = ObtenerCarrito(carritoId);

		if (carrito == null)
			return null;

		if (!carrito.Items.Any())
			throw new InvalidOperationException(
				"No se puede confirmar un carrito vacío.");

		carrito.Estado = EstadoCarrito.Confirmado;

		return carrito;
	}
}