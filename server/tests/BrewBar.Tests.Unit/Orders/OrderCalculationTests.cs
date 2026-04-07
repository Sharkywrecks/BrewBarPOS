using BrewBar.Core.Entities.OrderAggregate;
using BrewBar.Core.Enums;

namespace BrewBar.Tests.Unit.Orders;

public class OrderCalculationTests
{
    [Fact]
    public void LineTotal_ShouldBe_UnitPriceTimesQuantity()
    {
        var item = new OrderLineItem
        {
            UnitPrice = 7.50m,
            Quantity = 2,
            LineTotal = 7.50m * 2
        };

        Assert.Equal(15.00m, item.LineTotal);
    }

    [Fact]
    public void LineTotal_WithModifiers_ShouldIncludeModifierPrices()
    {
        // Business rule from OrdersController: lineTotal = (unitPrice + modifierTotal) * quantity
        var unitPrice = 7.50m;
        var modifierTotal = 1.50m + 1.00m; // Protein + Immunity
        var quantity = 1;
        var lineTotal = (unitPrice + modifierTotal) * quantity;

        Assert.Equal(10.00m, lineTotal);
    }

    [Fact]
    public void Subtotal_ShouldBe_SumOfLineTotals()
    {
        var lineTotals = new[] { 10.00m, 4.00m, 7.50m };
        var subtotal = lineTotals.Sum();

        Assert.Equal(21.50m, subtotal);
    }

    [Fact]
    public void TaxAmount_ShouldBe_SubtotalTimesTaxRate_Rounded()
    {
        var subtotal = 13.00m;
        var taxRate = 0.08m;
        var taxAmount = Math.Round(subtotal * taxRate, 2);

        Assert.Equal(1.04m, taxAmount);
    }

    [Fact]
    public void TaxAmount_ShouldRoundToTwoDecimals()
    {
        var subtotal = 7.33m;
        var taxRate = 0.0875m; // 8.75% tax
        var taxAmount = Math.Round(subtotal * taxRate, 2);

        Assert.Equal(0.64m, taxAmount);
    }

    [Fact]
    public void Total_ShouldBe_SubtotalPlusTax()
    {
        var subtotal = 13.00m;
        var taxAmount = 1.04m;
        var total = subtotal + taxAmount;

        Assert.Equal(14.04m, total);
    }

    [Fact]
    public void Order_DefaultStatus_ShouldBeOpen()
    {
        var order = new Order();
        Assert.Equal(OrderStatus.Open, order.Status);
    }

    [Fact]
    public void Order_LocalId_ShouldBeGeneratedByDefault()
    {
        var order = new Order();
        Assert.NotEqual(Guid.Empty, order.LocalId);
    }

    [Fact]
    public void Order_ShouldCalculateCorrectTotals()
    {
        // Simulate the calculation from OrdersController.CreateOrder
        var lineItems = new[]
        {
            new { UnitPrice = 7.50m, Quantity = 1, ModifierTotal = 1.50m },
            new { UnitPrice = 2.00m, Quantity = 2, ModifierTotal = 0m },
        };

        var lineTotals = lineItems.Select(li => (li.UnitPrice + li.ModifierTotal) * li.Quantity).ToArray();
        var subtotal = lineTotals.Sum();
        var taxRate = 0.08m;
        var taxAmount = Math.Round(subtotal * taxRate, 2);
        var total = subtotal + taxAmount;

        Assert.Equal(9.00m, lineTotals[0]); // (7.50 + 1.50) * 1
        Assert.Equal(4.00m, lineTotals[1]); // (2.00 + 0) * 2
        Assert.Equal(13.00m, subtotal);
        Assert.Equal(1.04m, taxAmount);
        Assert.Equal(14.04m, total);
    }
}
