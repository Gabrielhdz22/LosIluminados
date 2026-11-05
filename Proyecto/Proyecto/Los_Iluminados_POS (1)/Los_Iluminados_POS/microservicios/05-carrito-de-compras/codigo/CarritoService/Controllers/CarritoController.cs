using CarritoService.Models;
using CarritoService.Services;
using Microsoft.AspNetCore.Mvc;

namespace CarritoService.Controllers;

[ApiController]
[Route("api/carritos")]
public class CarritoController : ControllerBase
{
	private readonly CarritoService.Services.CarritoService _carritoService;

	public CarritoController(
		CarritoService.Services.CarritoService carritoService)
	{
		_carritoService = carritoService;
	}

	// POST /api/carritos?clienteId=1
	[HttpPost]
	public ActionResult<Carrito> CrearCarrito(
		[FromQuery] int clienteId)
	{
		var carrito =
			_carritoService.CrearCarrito(clienteId);

		return CreatedAtAction(
			nameof(ObtenerCarrito),
			new { id = carrito.Id },
			carrito);
	}

	// GET /api/carritos/1
	[HttpGet("{id}")]
	public ActionResult<Carrito> ObtenerCarrito(int id)
	{
		var carrito =
			_carritoService.ObtenerCarrito(id);

		if (carrito == null)
		{
			return NotFound(new
			{
				mensaje = "Carrito no encontrado."
			});
		}

		return Ok(carrito);
	}

	// POST /api/carritos/1/items
	[HttpPost("{id}/items")]
	public ActionResult<Carrito> AgregarProducto(
		int id,
		[FromBody] CarritoItem item)
	{
		try
		{
			var carrito =
				_carritoService.AgregarProducto(id, item);

			return Ok(carrito);
		}
		catch (KeyNotFoundException ex)
		{
			return NotFound(new
			{
				mensaje = ex.Message
			});
		}
		catch (ArgumentException ex)
		{
			return BadRequest(new
			{
				mensaje = ex.Message
			});
		}
		catch (InvalidOperationException ex)
		{
			return Conflict(new
			{
				mensaje = ex.Message
			});
		}
	}

	// PUT /api/carritos/1/items/10
	[HttpPut("{id}/items/{productoId}")]
	public ActionResult<Carrito> ActualizarCantidad(
		int id,
		int productoId,
		[FromBody] int cantidad)
	{
		try
		{
			var carrito =
				_carritoService.ActualizarCantidad(
					id,
					productoId,
					cantidad);

			if (carrito == null)
			{
				return NotFound();
			}

			return Ok(carrito);
		}
		catch (ArgumentException ex)
		{
			return BadRequest(new
			{
				mensaje = ex.Message
			});
		}
		catch (InvalidOperationException ex)
		{
			return Conflict(new
			{
				mensaje = ex.Message
			});
		}
	}

	// DELETE /api/carritos/1/items/10
	[HttpDelete("{id}/items/{productoId}")]
	public IActionResult EliminarProducto(
		int id,
		int productoId)
	{
		var eliminado =
			_carritoService.EliminarProducto(
				id,
				productoId);

		if (!eliminado)
		{
			return NotFound();
		}

		return NoContent();
	}

	// DELETE /api/carritos/1/items
	[HttpDelete("{id}/items")]
	public IActionResult VaciarCarrito(int id)
	{
		var vaciado =
			_carritoService.VaciarCarrito(id);

		if (!vaciado)
		{
			return NotFound();
		}

		return NoContent();
	}

	// POST /api/carritos/1/confirmar
	[HttpPost("{id}/confirmar")]
	public ActionResult<Carrito> ConfirmarCarrito(int id)
	{
		try
		{
			var carrito =
				_carritoService.ConfirmarCarrito(id);

			if (carrito == null)
			{
				return NotFound();
			}

			return Ok(carrito);
		}
		catch (InvalidOperationException ex)
		{
			return Conflict(new
			{
				mensaje = ex.Message
			});
		}
	}
}