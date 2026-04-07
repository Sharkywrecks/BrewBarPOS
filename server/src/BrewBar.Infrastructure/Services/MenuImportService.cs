using BrewBar.Core.Entities.CatalogAggregate;
using BrewBar.Infrastructure.Data;
using ClosedXML.Excel;
using Microsoft.EntityFrameworkCore;

namespace BrewBar.Infrastructure.Services;

public class MenuImportResult
{
    public int CategoriesCreated { get; set; }
    public int ProductsCreated { get; set; }
    public int ModifiersCreated { get; set; }
    public int ProductModifierLinksCreated { get; set; }
    public List<string> Errors { get; set; } = new();
}

public class MenuImportService
{
    private readonly BrewBarContext _context;

    public MenuImportService(BrewBarContext context)
    {
        _context = context;
    }

    public async Task<MenuImportResult> ImportAsync(Stream fileStream, CancellationToken ct = default)
    {
        var result = new MenuImportResult();

        using var workbook = new XLWorkbook(fileStream);

        var modifiersByName = await ImportModifiers(workbook, result, ct);
        var productsByName = await ImportProducts(workbook, result, ct);
        await LinkProductModifiers(workbook, productsByName, modifiersByName, result, ct);

        return result;
    }

    private async Task<Dictionary<string, Modifier>> ImportModifiers(
        XLWorkbook workbook, MenuImportResult result, CancellationToken ct)
    {
        var modifiersByName = new Dictionary<string, Modifier>(StringComparer.OrdinalIgnoreCase);

        // Load existing modifiers
        var existing = await _context.Modifiers.Include(m => m.Options).ToListAsync(ct);
        foreach (var m in existing)
            modifiersByName[m.Name] = m;

        var sheet = workbook.Worksheets.FirstOrDefault(ws =>
            ws.Name.Equals("Modifiers", StringComparison.OrdinalIgnoreCase));
        if (sheet == null) return modifiersByName;

        var rows = sheet.RangeUsed()?.RowsUsed().Skip(1); // skip header
        if (rows == null) return modifiersByName;

        int sortOrder = modifiersByName.Count;
        int optSortOrder = 0;

        foreach (var row in rows)
        {
            var modName = row.Cell(1).GetString().Trim();
            var required = ParseBool(row.Cell(2).GetString());
            var allowMultiple = ParseBool(row.Cell(3).GetString());
            var optionName = row.Cell(4).GetString().Trim();
            var optionPrice = ParseDecimal(row.Cell(5).GetString());

            if (string.IsNullOrEmpty(modName) || string.IsNullOrEmpty(optionName))
            {
                result.Errors.Add($"Modifiers row {row.RowNumber()}: Modifier Name and Option Name are required");
                continue;
            }

            if (!modifiersByName.TryGetValue(modName, out var modifier))
            {
                modifier = new Modifier
                {
                    Name = modName,
                    IsRequired = required,
                    AllowMultiple = allowMultiple,
                    SortOrder = sortOrder++,
                    Options = new List<ModifierOption>()
                };
                _context.Modifiers.Add(modifier);
                modifiersByName[modName] = modifier;
                result.ModifiersCreated++;
            }

            // Add option if it doesn't already exist
            if (!modifier.Options.Any(o => o.Name.Equals(optionName, StringComparison.OrdinalIgnoreCase)))
            {
                modifier.Options.Add(new ModifierOption
                {
                    Name = optionName,
                    Price = optionPrice,
                    SortOrder = optSortOrder++
                });
            }
        }

        await _context.SaveChangesAsync(ct);
        return modifiersByName;
    }

    private async Task<Dictionary<string, Product>> ImportProducts(
        XLWorkbook workbook, MenuImportResult result, CancellationToken ct)
    {
        var productsByName = new Dictionary<string, Product>(StringComparer.OrdinalIgnoreCase);

        // Load existing
        var existingProducts = await _context.Products.ToListAsync(ct);
        foreach (var p in existingProducts)
            productsByName[p.Name] = p;

        var existingCategories = await _context.Categories.ToListAsync(ct);
        var categoriesByName = new Dictionary<string, Category>(StringComparer.OrdinalIgnoreCase);
        foreach (var c in existingCategories)
            categoriesByName[c.Name] = c;

        var sheet = workbook.Worksheets.FirstOrDefault(ws =>
            ws.Name.Equals("Products", StringComparison.OrdinalIgnoreCase));
        if (sheet == null)
        {
            result.Errors.Add("Missing required 'Products' sheet");
            return productsByName;
        }

        var rows = sheet.RangeUsed()?.RowsUsed().Skip(1);
        if (rows == null) return productsByName;

        int catSort = categoriesByName.Count;
        int prodSort = productsByName.Count;

        foreach (var row in rows)
        {
            var categoryName = row.Cell(1).GetString().Trim();
            var productName = row.Cell(2).GetString().Trim();
            var description = row.Cell(3).GetString().Trim();
            var price = ParseDecimal(row.Cell(4).GetString());
            var available = row.Cell(5).GetString().Trim();
            var isAvailable = string.IsNullOrEmpty(available) || ParseBool(available);

            if (string.IsNullOrEmpty(categoryName) || string.IsNullOrEmpty(productName))
            {
                result.Errors.Add($"Products row {row.RowNumber()}: Category and Product Name are required");
                continue;
            }

            if (price <= 0)
            {
                result.Errors.Add($"Products row {row.RowNumber()}: Price must be greater than 0");
                continue;
            }

            // Get or create category
            if (!categoriesByName.TryGetValue(categoryName, out var category))
            {
                category = new Category
                {
                    Name = categoryName,
                    IsActive = true,
                    SortOrder = catSort++
                };
                _context.Categories.Add(category);
                categoriesByName[categoryName] = category;
                result.CategoriesCreated++;
            }

            // Skip if product already exists
            if (productsByName.ContainsKey(productName)) continue;

            var product = new Product
            {
                Name = productName,
                Description = string.IsNullOrEmpty(description) ? null : description,
                BasePrice = price,
                Category = category,
                SortOrder = prodSort++,
                IsAvailable = isAvailable
            };
            _context.Products.Add(product);
            productsByName[productName] = product;
            result.ProductsCreated++;
        }

        await _context.SaveChangesAsync(ct);
        return productsByName;
    }

    private async Task LinkProductModifiers(
        XLWorkbook workbook,
        Dictionary<string, Product> productsByName,
        Dictionary<string, Modifier> modifiersByName,
        MenuImportResult result,
        CancellationToken ct)
    {
        var sheet = workbook.Worksheets.FirstOrDefault(ws =>
            ws.Name.Equals("Product Modifiers", StringComparison.OrdinalIgnoreCase));
        if (sheet == null) return;

        var rows = sheet.RangeUsed()?.RowsUsed().Skip(1);
        if (rows == null) return;

        var existingLinks = await _context.ProductModifiers.ToListAsync(ct);
        var linkSet = new HashSet<(int, int)>(existingLinks.Select(pm => (pm.ProductId, pm.ModifierId)));

        foreach (var row in rows)
        {
            var productName = row.Cell(1).GetString().Trim();
            var modifierName = row.Cell(2).GetString().Trim();

            if (string.IsNullOrEmpty(productName) || string.IsNullOrEmpty(modifierName))
            {
                result.Errors.Add($"Product Modifiers row {row.RowNumber()}: Product Name and Modifier Name are required");
                continue;
            }

            if (!productsByName.TryGetValue(productName, out var product))
            {
                result.Errors.Add($"Product Modifiers row {row.RowNumber()}: Product '{productName}' not found");
                continue;
            }

            if (!modifiersByName.TryGetValue(modifierName, out var modifier))
            {
                result.Errors.Add($"Product Modifiers row {row.RowNumber()}: Modifier '{modifierName}' not found");
                continue;
            }

            if (!linkSet.Add((product.Id, modifier.Id))) continue; // already linked

            _context.ProductModifiers.Add(new ProductModifier
            {
                ProductId = product.Id,
                ModifierId = modifier.Id
            });
            result.ProductModifierLinksCreated++;
        }

        await _context.SaveChangesAsync(ct);
    }

    private static bool ParseBool(string value)
    {
        var v = value.Trim().ToLowerInvariant();
        return v is "yes" or "true" or "1";
    }

    private static decimal ParseDecimal(string value)
    {
        return decimal.TryParse(value.Trim().TrimStart('$'), out var d) ? d : 0m;
    }
}
