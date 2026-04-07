using BrewBar.Core.Entities.PaymentAggregate;
using BrewBar.Core.Enums;

namespace BrewBar.Tests.Unit.Orders;

public class PaymentTests
{
    [Fact]
    public void CashPayment_ChangeGiven_ShouldBe_TenderedMinusTotal()
    {
        var total = 14.04m;
        var tendered = 20.00m;
        var change = Math.Max(tendered - total, 0);

        Assert.Equal(5.96m, change);
    }

    [Fact]
    public void CashPayment_ExactChange_ShouldBeZero()
    {
        var total = 14.04m;
        var tendered = 14.04m;
        var change = Math.Max(tendered - total, 0);

        Assert.Equal(0m, change);
    }

    [Fact]
    public void CardPayment_ChangeGiven_ShouldAlwaysBeZero()
    {
        // Business rule: card payments never give change
        var method = PaymentMethod.Card;
        var tendered = 20.00m;
        var total = 14.04m;
        var change = method == PaymentMethod.Cash
            ? Math.Max(tendered - total, 0)
            : 0m;

        Assert.Equal(0m, change);
    }

    [Fact]
    public void Payment_DefaultStatus_ShouldBeCompleted()
    {
        var payment = new Payment();
        Assert.Equal(PaymentStatus.Completed, payment.Status);
    }

    [Fact]
    public void Payment_DefaultMethod_ShouldBeCash()
    {
        var payment = new Payment();
        Assert.Equal(PaymentMethod.Cash, payment.Method);
    }

    [Fact]
    public void OrderShouldComplete_WhenPaymentCoversTotal()
    {
        var orderTotal = 14.04m;
        var existingPayments = 0m;
        var newPaymentTotal = 14.04m;

        var shouldComplete = existingPayments + newPaymentTotal >= orderTotal;
        Assert.True(shouldComplete);
    }

    [Fact]
    public void OrderShouldNotComplete_WhenPaymentIsPartial()
    {
        var orderTotal = 14.04m;
        var existingPayments = 0m;
        var newPaymentTotal = 10.00m;

        var shouldComplete = existingPayments + newPaymentTotal >= orderTotal;
        Assert.False(shouldComplete);
    }

    [Fact]
    public void OrderShouldComplete_WhenSplitPaymentsTotal()
    {
        var orderTotal = 14.04m;
        var existingPayments = 10.00m; // First payment
        var newPaymentTotal = 4.04m;   // Second payment

        var shouldComplete = existingPayments + newPaymentTotal >= orderTotal;
        Assert.True(shouldComplete);
    }

    [Fact]
    public void OrderShouldComplete_WhenOverpaid()
    {
        var orderTotal = 14.04m;
        var existingPayments = 0m;
        var newPaymentTotal = 20.00m;

        var shouldComplete = existingPayments + newPaymentTotal >= orderTotal;
        Assert.True(shouldComplete);
    }
}
