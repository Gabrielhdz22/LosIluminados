namespace CarritoService.Models;

public class CarritoItem
{
    public int ProductoId { get; set; }

    public string NombreProducto { get; set; } = string.Empty;

    public decimal PrecioUnitario { get; set; }

    public int Cantidad { get; set; }

    public decimal Subtotal =>
        PrecioUnitario * Cantidad;
}