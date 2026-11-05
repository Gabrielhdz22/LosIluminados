namespace CarritoService.Models;

public class Carrito
{
    public int Id { get; set; }

    public int ClienteId { get; set; }

    public EstadoCarrito Estado { get; set; }

    public List<CarritoItem> Items { get; set; } = new();

    public decimal Subtotal =>
        Items.Sum(item => item.Subtotal);

    public decimal Impuestos =>
        Subtotal * 0.16m;

    public decimal Total =>
        Subtotal + Impuestos;
}