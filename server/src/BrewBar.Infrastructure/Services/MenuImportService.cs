using BrewBar.Core.Entities.CatalogAggregate;
using BrewBar.Infrastructure.Data;
using ClosedXML.Excel;
using Microsoft.EntityFrameworkCore;

namespace BrewBar.Infrastructure.Services;

public class MenuImportResult
{
    public int CategoriesCreated { get; set; }
    public int ProductsCreated { get; set; }
    public int ProductsUpdated { get; set; }
    public int ModifiersCreated { get; set; }
    public int ModifiersUpdated { get; set; }
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

    /// <summary>
    /// Exports the current catalog as an .xlsx workbook with Id columns populated.
    /// The output is import-compatible: re-uploading it will update existing rows
    /// rather than create duplicates.
    /// </summary>
    public async Task<byte[]> ExportAsync(CancellationToken ct = default)
    {
        var products = await _context.Products
            .Include(p => p.Category)
            .Include(p => p.ProductModifiers)
                .ThenInclude(pm => pm.Modifier)
            .OrderBy(p => p.Category.SortOrder)
            .ThenBy(p => p.SortOrder)
            .ThenBy(p => p.Name)
            .ToListAsync(ct);

        var modifiers = await _context.Modifiers
            .Include(m => m.Options)
            .OrderBy(m => m.SortOrder)
            .ThenBy(m => m.Name)
            .ToListAsync(ct);

        using var wb = new XLWorkbook();

        // --- Products sheet ---
        var productsSheet = wb.Worksheets.Add("Products");
        productsSheet.Cell(1, 1).Value = "Id";
        productsSheet.Cell(1, 2).Value = "Category";
        productsSheet.Cell(1, 3).Value = "Product Name";
        productsSheet.Cell(1, 4).Value = "Description";
        productsSheet.Cell(1, 5).Value = "Price";
        productsSheet.Cell(1, 6).Value = "Available";
        productsSheet.Range(1, 1, 1, 6).Style.Font.Bold = true;

        int row = 2;
        foreach (var p in products)
        {
            productsSheet.Cell(row, 1).Value = p.Id;
            productsSheet.Cell(row, 2).Value = p.Category?.Name ?? string.Empty;
            productsSheet.Cell(row, 3).Value = p.Name;
            productsSheet.Cell(row, 4).Value = p.Description ?? string.Empty;
            productsSheet.Cell(row, 5).Value = p.BasePrice;
            productsSheet.Cell(row, 6).Value = p.IsAvailable ? "Yes" : "No";
            row++;
        }
        productsSheet.Column(1).Width = 8;
        productsSheet.Column(2).Width = 18;
        productsSheet.Column(3).Width = 28;
        productsSheet.Column(4).Width = 50;
        productsSheet.Column(5).Width = 10;
        productsSheet.Column(6).Width = 12;

        // --- Modifiers sheet ---
        // One row per (modifier, option). Modifier-level fields repeat across
        // option rows so the importer can group them back by Id (or Name).
        var modifiersSheet = wb.Worksheets.Add("Modifiers");
        modifiersSheet.Cell(1, 1).Value = "Id";
        modifiersSheet.Cell(1, 2).Value = "Modifier Name";
        modifiersSheet.Cell(1, 3).Value = "Required";
        modifiersSheet.Cell(1, 4).Value = "Allow Multiple";
        modifiersSheet.Cell(1, 5).Value = "Option Name";
        modifiersSheet.Cell(1, 6).Value = "Option Price";
        modifiersSheet.Range(1, 1, 1, 6).Style.Font.Bold = true;

        row = 2;
        foreach (var m in modifiers)
        {
            if (m.Options.Count == 0)
            {
                // Modifier with no options — emit a placeholder row so the Id is preserved
                modifiersSheet.Cell(row, 1).Value = m.Id;
                modifiersSheet.Cell(row, 2).Value = m.Name;
                modifiersSheet.Cell(row, 3).Value = m.IsRequired ? "Yes" : "No";
                modifiersSheet.Cell(row, 4).Value = m.AllowMultiple ? "Yes" : "No";
                row++;
                continue;
            }
            foreach (var o in m.Options.OrderBy(o => o.SortOrder).ThenBy(o => o.Name))
            {
                modifiersSheet.Cell(row, 1).Value = m.Id;
                modifiersSheet.Cell(row, 2).Value = m.Name;
                modifiersSheet.Cell(row, 3).Value = m.IsRequired ? "Yes" : "No";
                modifiersSheet.Cell(row, 4).Value = m.AllowMultiple ? "Yes" : "No";
                modifiersSheet.Cell(row, 5).Value = o.Name;
                modifiersSheet.Cell(row, 6).Value = o.Price;
                row++;
            }
        }
        modifiersSheet.Column(1).Width = 8;
        modifiersSheet.Column(2).Width = 20;
        modifiersSheet.Column(3).Width = 12;
        modifiersSheet.Column(4).Width = 16;
        modifiersSheet.Column(5).Width = 20;
        modifiersSheet.Column(6).Width = 14;

        // --- Product Modifiers sheet ---
        var linksSheet = wb.Worksheets.Add("Product Modifiers");
        linksSheet.Cell(1, 1).Value = "Product Id";
        linksSheet.Cell(1, 2).Value = "Modifier Id";
        linksSheet.Cell(1, 3).Value = "Product Name";
        linksSheet.Cell(1, 4).Value = "Modifier Name";
        linksSheet.Range(1, 1, 1, 4).Style.Font.Bold = true;

        row = 2;
        foreach (var p in products)
        {
            foreach (var pm in p.ProductModifiers)
            {
                linksSheet.Cell(row, 1).Value = p.Id;
                linksSheet.Cell(row, 2).Value = pm.ModifierId;
                linksSheet.Cell(row, 3).Value = p.Name;
                linksSheet.Cell(row, 4).Value = pm.Modifier?.Name ?? string.Empty;
                row++;
            }
        }
        linksSheet.Column(1).Width = 12;
        linksSheet.Column(2).Width = 12;
        linksSheet.Column(3).Width = 28;
        linksSheet.Column(4).Width = 20;

        using var ms = new MemoryStream();
        wb.SaveAs(ms);
        return ms.ToArray();
    }

    /// <summary>
    /// Reads the header row of a sheet and returns a case-insensitive lookup
    /// from column name → 1-based column index. Lets sheets evolve (add Id,
    /// reorder columns) without breaking older files.
    /// </summary>
    private static Dictionary<string, int> ReadHeaders(IXLWorksheet sheet)
    {
        var headers = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
        var headerRow = sheet.RangeUsed()?.RowsUsed().FirstOrDefault();
        if (headerRow == null) return headers;

        foreach (var cell in headerRow.CellsUsed())
        {
            var name = cell.GetString().Trim();
            if (!string.IsNullOrEmpty(name) && !headers.ContainsKey(name))
                headers[name] = cell.Address.ColumnNumber;
        }
        return headers;
    }

    private static string GetCell(IXLRangeRow row, Dictionary<string, int> headers, string column)
    {
        return headers.TryGetValue(column, out var col)
            ? row.Cell(col).GetString().Trim()
            : string.Empty;
    }

    private async Task<Dictionary<string, Modifier>> ImportModifiers(
        XLWorkbook workbook, MenuImportResult result, CancellationToken ct)
    {
        var modifiersByName = new Dictionary<string, Modifier>(StringComparer.OrdinalIgnoreCase);

        // Load existing modifiers (with options) so we can update or de-dupe
        var existing = await _context.Modifiers.Include(m => m.Options).ToListAsync(ct);
        var modifiersById = existing.ToDictionary(m => m.Id);
        foreach (var m in existing)
            modifiersByName[m.Name] = m;

        var sheet = workbook.Worksheets.FirstOrDefault(ws =>
            ws.Name.Equals("Modifiers", StringComparison.OrdinalIgnoreCase));
        if (sheet == null) return modifiersByName;

        var headers = ReadHeaders(sheet);
        if (!headers.ContainsKey("Modifier Name"))
        {
            result.Errors.Add("Modifiers sheet is missing the 'Modifier Name' header");
            return modifiersByName;
        }

        var rows = sheet.RangeUsed()?.RowsUsed().Skip(1); // skip header
        if (rows == null) return modifiersByName;

        int sortOrder = modifiersByName.Count;
        var updatedThisRun = new HashSet<int>();
        var optSortByModifier = new Dictionary<int, int>();

        foreach (var row in rows)
        {
            var idStr = GetCell(row, headers, "Id");
            var modName = GetCell(row, headers, "Modifier Name");
            var required = ParseBool(GetCell(row, headers, "Required"));
            var allowMultiple = ParseBool(GetCell(row, headers, "Allow Multiple"));
            var optionName = GetCell(row, headers, "Option Name");
            var optionPrice = ParseDecimal(GetCell(row, headers, "Option Price"));

            if (string.IsNullOrEmpty(modName) || string.IsNullOrEmpty(optionName))
            {
                result.Errors.Add($"Modifiers row {row.RowNumber()}: Modifier Name and Option Name are required");
                continue;
            }

            Modifier? modifier = null;

            // Id-based lookup takes precedence — supports rename + update.
            if (!string.IsNullOrEmpty(idStr))
            {
                if (!int.TryParse(idStr, out var id))
                {
                    result.Errors.Add($"Modifiers row {row.RowNumber()}: Id '{idStr}' is not a valid integer");
                    continue;
                }
                if (!modifiersById.TryGetValue(id, out modifier))
                {
                    result.Errors.Add($"Modifiers row {row.RowNumber()}: Modifier Id {id} does not exist");
                    continue;
                }

                // First time we see this Id this run → apply field updates
                if (updatedThisRun.Add(id))
                {
                    var renamed = !string.Equals(modifier.Name, modName, StringComparison.Ordinal);
                    modifier.Name = modName;
                    modifier.IsRequired = required;
                    modifier.AllowMultiple = allowMultiple;
                    if (renamed)
                    {
                        // Keep the by-name dictionary in sync so Product Modifiers
                        // sheet can still find this modifier by its new name.
                        modifiersByName[modName] = modifier;
                    }
                    result.ModifiersUpdated++;
                }
            }
            else if (!modifiersByName.TryGetValue(modName, out modifier))
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

            // Add option if it doesn't already exist (case-insensitive name match)
            if (!modifier.Options.Any(o => o.Name.Equals(optionName, StringComparison.OrdinalIgnoreCase)))
            {
                var nextSort = optSortByModifier.TryGetValue(modifier.Id, out var s)
                    ? s
                    : modifier.Options.Count;
                modifier.Options.Add(new ModifierOption
                {
                    Name = optionName,
                    Price = optionPrice,
                    SortOrder = nextSort
                });
                optSortByModifier[modifier.Id] = nextSort + 1;
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
        var productsById = existingProducts.ToDictionary(p => p.Id);
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

        var headers = ReadHeaders(sheet);
        if (!headers.ContainsKey("Product Name") || !headers.ContainsKey("Category"))
        {
            result.Errors.Add("Products sheet must contain 'Category' and 'Product Name' headers");
            return productsByName;
        }

        var rows = sheet.RangeUsed()?.RowsUsed().Skip(1);
        if (rows == null) return productsByName;

        int catSort = categoriesByName.Count;
        int prodSort = productsByName.Count;

        foreach (var row in rows)
        {
            var idStr = GetCell(row, headers, "Id");
            var categoryName = GetCell(row, headers, "Category");
            var productName = GetCell(row, headers, "Product Name");
            var description = GetCell(row, headers, "Description");
            var price = ParseDecimal(GetCell(row, headers, "Price"));
            var availableRaw = GetCell(row, headers, "Available");
            var isAvailable = string.IsNullOrEmpty(availableRaw) || ParseBool(availableRaw);

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

            // Id-based update path
            if (!string.IsNullOrEmpty(idStr))
            {
                if (!int.TryParse(idStr, out var id))
                {
                    result.Errors.Add($"Products row {row.RowNumber()}: Id '{idStr}' is not a valid integer");
                    continue;
                }
                if (!productsById.TryGetValue(id, out var existing))
                {
                    result.Errors.Add($"Products row {row.RowNumber()}: Product Id {id} does not exist");
                    continue;
                }

                var renamed = !string.Equals(existing.Name, productName, StringComparison.Ordinal);
                existing.Name = productName;
                existing.Description = string.IsNullOrEmpty(description) ? null : description;
                existing.BasePrice = price;
                existing.Category = category;
                existing.IsAvailable = isAvailable;

                if (renamed)
                    productsByName[productName] = existing;

                result.ProductsUpdated++;
                continue;
            }

            // Name-based path (skip if already exists)
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

        var headers = ReadHeaders(sheet);
        var hasProductId = headers.ContainsKey("Product Id");
        var hasModifierId = headers.ContainsKey("Modifier Id");
        var hasProductName = headers.ContainsKey("Product Name");
        var hasModifierName = headers.ContainsKey("Modifier Name");

        if (!hasProductId && !hasProductName)
        {
            result.Errors.Add("Product Modifiers sheet must contain 'Product Id' or 'Product Name' header");
            return;
        }
        if (!hasModifierId && !hasModifierName)
        {
            result.Errors.Add("Product Modifiers sheet must contain 'Modifier Id' or 'Modifier Name' header");
            return;
        }

        var rows = sheet.RangeUsed()?.RowsUsed().Skip(1);
        if (rows == null) return;

        // Build Id lookups including any products/modifiers just created in this import
        var productsById = productsByName.Values
            .Where(p => p.Id > 0)
            .GroupBy(p => p.Id)
            .ToDictionary(g => g.Key, g => g.First());
        var modifiersById = modifiersByName.Values
            .Where(m => m.Id > 0)
            .GroupBy(m => m.Id)
            .ToDictionary(g => g.Key, g => g.First());

        var existingLinks = await _context.ProductModifiers.ToListAsync(ct);
        var linkSet = new HashSet<(int, int)>(existingLinks.Select(pm => (pm.ProductId, pm.ModifierId)));

        foreach (var row in rows)
        {
            var productIdStr = GetCell(row, headers, "Product Id");
            var modifierIdStr = GetCell(row, headers, "Modifier Id");
            var productName = GetCell(row, headers, "Product Name");
            var modifierName = GetCell(row, headers, "Modifier Name");

            // Skip fully-empty rows silently
            if (string.IsNullOrEmpty(productIdStr) && string.IsNullOrEmpty(productName)
                && string.IsNullOrEmpty(modifierIdStr) && string.IsNullOrEmpty(modifierName))
                continue;

            // Resolve product — Id takes precedence
            Product? product = null;
            if (!string.IsNullOrEmpty(productIdStr))
            {
                if (!int.TryParse(productIdStr, out var pid))
                {
                    result.Errors.Add($"Product Modifiers row {row.RowNumber()}: Product Id '{productIdStr}' is not a valid integer");
                    continue;
                }
                if (!productsById.TryGetValue(pid, out product))
                {
                    result.Errors.Add($"Product Modifiers row {row.RowNumber()}: Product Id {pid} not found");
                    continue;
                }
            }
            else if (!string.IsNullOrEmpty(productName))
            {
                if (!productsByName.TryGetValue(productName, out product))
                {
                    result.Errors.Add($"Product Modifiers row {row.RowNumber()}: Product '{productName}' not found");
                    continue;
                }
            }
            else
            {
                result.Errors.Add($"Product Modifiers row {row.RowNumber()}: Product Id or Product Name is required");
                continue;
            }

            // Resolve modifier — Id takes precedence
            Modifier? modifier = null;
            if (!string.IsNullOrEmpty(modifierIdStr))
            {
                if (!int.TryParse(modifierIdStr, out var mid))
                {
                    result.Errors.Add($"Product Modifiers row {row.RowNumber()}: Modifier Id '{modifierIdStr}' is not a valid integer");
                    continue;
                }
                if (!modifiersById.TryGetValue(mid, out modifier))
                {
                    result.Errors.Add($"Product Modifiers row {row.RowNumber()}: Modifier Id {mid} not found");
                    continue;
                }
            }
            else if (!string.IsNullOrEmpty(modifierName))
            {
                if (!modifiersByName.TryGetValue(modifierName, out modifier))
                {
                    result.Errors.Add($"Product Modifiers row {row.RowNumber()}: Modifier '{modifierName}' not found");
                    continue;
                }
            }
            else
            {
                result.Errors.Add($"Product Modifiers row {row.RowNumber()}: Modifier Id or Modifier Name is required");
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
