namespace BrewBar.API.Dtos.Orders;

public class RefundDto
{
    public int Id { get; set; }
    public int OrderId { get; set; }
    public int OriginalPaymentId { get; set; }
    public decimal Amount { get; set; }
    public string Reason { get; set; } = string.Empty;
    public string? PerformedByUserName { get; set; }
    public bool IsFullRefund { get; set; }
    public DateTime CreatedAtUtc { get; set; }
    public IList<RefundLineItemDto> LineItems { get; set; } = new List<RefundLineItemDto>();
}

public class RefundLineItemDto
{
    public int OrderLineItemId { get; set; }
    public int Quantity { get; set; }
    public decimal Amount { get; set; }
}

public class CreateRefundDto
{
    public int OrderId { get; set; }
    public int OriginalPaymentId { get; set; }
    public string Reason { get; set; } = string.Empty;
    public bool IsFullRefund { get; set; }
    public IList<CreateRefundLineItemDto>? LineItems { get; set; }
}

public class CreateRefundLineItemDto
{
    public int OrderLineItemId { get; set; }
    public int Quantity { get; set; }
}

public class VoidOrderDto
{
    public string Reason { get; set; } = string.Empty;
}
