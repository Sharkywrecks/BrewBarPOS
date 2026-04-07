using BrewBar.Core.Enums;

namespace BrewBar.API.Dtos.Orders;

public class OrderDto
{
    public int Id { get; set; }
    public Guid LocalId { get; set; }
    public string DisplayOrderNumber { get; set; } = string.Empty;
    public OrderStatus Status { get; set; }
    public decimal Subtotal { get; set; }
    public decimal TaxAmount { get; set; }
    public decimal TaxRate { get; set; }
    public decimal Total { get; set; }
    public string? Notes { get; set; }
    public string CashierId { get; set; } = string.Empty;
    public string? CashierName { get; set; }
    public int? TerminalId { get; set; }
    public DateTime CreatedAtUtc { get; set; }
    public IList<OrderLineItemDto> LineItems { get; set; } = new List<OrderLineItemDto>();
    public IList<PaymentSummaryDto> Payments { get; set; } = new List<PaymentSummaryDto>();
}

public class OrderLineItemDto
{
    public int Id { get; set; }
    public int ProductId { get; set; }
    public string ProductName { get; set; } = string.Empty;
    public string? VariantName { get; set; }
    public decimal UnitPrice { get; set; }
    public int Quantity { get; set; }
    public decimal LineTotal { get; set; }
    public IList<OrderModifierItemDto> ModifierItems { get; set; } = new List<OrderModifierItemDto>();
}

public class OrderModifierItemDto
{
    public string ModifierName { get; set; } = string.Empty;
    public string OptionName { get; set; } = string.Empty;
    public decimal Price { get; set; }
}

public class PaymentSummaryDto
{
    public int Id { get; set; }
    public PaymentMethod Method { get; set; }
    public PaymentStatus Status { get; set; }
    public decimal AmountTendered { get; set; }
    public decimal ChangeGiven { get; set; }
    public decimal Total { get; set; }
}

public class CreateOrderDto
{
    public Guid? LocalId { get; set; }
    public decimal TaxRate { get; set; }
    public string? Notes { get; set; }
    public int? TerminalId { get; set; }
    public IList<CreateOrderLineItemDto> LineItems { get; set; } = new List<CreateOrderLineItemDto>();
}

public class CreateOrderLineItemDto
{
    public int ProductId { get; set; }
    public string ProductName { get; set; } = string.Empty;
    public string? VariantName { get; set; }
    public decimal UnitPrice { get; set; }
    public int Quantity { get; set; } = 1;
    public IList<CreateOrderModifierItemDto> ModifierItems { get; set; } = new List<CreateOrderModifierItemDto>();
}

public class CreateOrderModifierItemDto
{
    public string ModifierName { get; set; } = string.Empty;
    public string OptionName { get; set; } = string.Empty;
    public decimal Price { get; set; }
}
