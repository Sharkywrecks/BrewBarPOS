namespace BrewBar.API.Dtos.Reports;

public class DailySalesReportDto
{
    public DateTime Date { get; set; }
    public int OrderCount { get; set; }
    public int VoidedCount { get; set; }
    public int ItemsSold { get; set; }
    public decimal GrossSales { get; set; }
    public decimal TaxCollected { get; set; }
    public decimal NetSales { get; set; }
    public decimal CashTotal { get; set; }
    public decimal CardTotal { get; set; }
    public decimal AverageOrderValue { get; set; }
    public IList<HourlySalesDto> HourlySales { get; set; } = new List<HourlySalesDto>();
}

public class HourlySalesDto
{
    public int Hour { get; set; }
    public int OrderCount { get; set; }
    public decimal Total { get; set; }
}

public class SalesRangeReportDto
{
    public DateTime From { get; set; }
    public DateTime To { get; set; }
    public int TotalOrders { get; set; }
    public decimal GrossSales { get; set; }
    public decimal TaxCollected { get; set; }
    public decimal NetSales { get; set; }
    public IList<DailySalesPointDto> DailyBreakdown { get; set; } = new List<DailySalesPointDto>();
}

public class DailySalesPointDto
{
    public DateTime Date { get; set; }
    public int OrderCount { get; set; }
    public decimal Total { get; set; }
}

public class ProductPerformanceDto
{
    public int ProductId { get; set; }
    public string ProductName { get; set; } = string.Empty;
    public string CategoryName { get; set; } = string.Empty;
    public int UnitsSold { get; set; }
    public decimal Revenue { get; set; }
}

public class PaymentSummaryReportDto
{
    public DateTime From { get; set; }
    public DateTime To { get; set; }
    public decimal CashTotal { get; set; }
    public int CashCount { get; set; }
    public decimal CardTotal { get; set; }
    public int CardCount { get; set; }
    public decimal RefundTotal { get; set; }
    public int RefundCount { get; set; }
}
