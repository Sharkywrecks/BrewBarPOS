using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using ClosedXML.Excel;

namespace BrewBar.Tests.Integration;

public class MenuImportApiTests : IClassFixture<TestFixture>
{
    private readonly TestFixture _f;

    public MenuImportApiTests(TestFixture fixture) => _f = fixture;

    private static MemoryStream CreateTestWorkbook(
        Action<XLWorkbook>? customize = null)
    {
        var wb = new XLWorkbook();

        // Products sheet
        var products = wb.Worksheets.Add("Products");
        products.Cell(1, 1).Value = "Category";
        products.Cell(1, 2).Value = "Product Name";
        products.Cell(1, 3).Value = "Description";
        products.Cell(1, 4).Value = "Price";
        products.Cell(1, 5).Value = "Available";

        products.Cell(2, 1).Value = "Import Smoothies";
        products.Cell(2, 2).Value = "Import Green";
        products.Cell(2, 3).Value = "Test smoothie";
        products.Cell(2, 4).Value = 7.50;
        products.Cell(2, 5).Value = "Yes";

        products.Cell(3, 1).Value = "Import Smoothies";
        products.Cell(3, 2).Value = "Import Berry";
        products.Cell(3, 3).Value = "Test berry";
        products.Cell(3, 4).Value = 8.00;
        products.Cell(3, 5).Value = "Yes";

        products.Cell(4, 1).Value = "Import Drinks";
        products.Cell(4, 2).Value = "Import Water";
        products.Cell(4, 3).Value = "";
        products.Cell(4, 4).Value = 2.00;
        products.Cell(4, 5).Value = "Yes";

        // Modifiers sheet
        var modifiers = wb.Worksheets.Add("Modifiers");
        modifiers.Cell(1, 1).Value = "Modifier Name";
        modifiers.Cell(1, 2).Value = "Required";
        modifiers.Cell(1, 3).Value = "Allow Multiple";
        modifiers.Cell(1, 4).Value = "Option Name";
        modifiers.Cell(1, 5).Value = "Option Price";

        modifiers.Cell(2, 1).Value = "Import Size";
        modifiers.Cell(2, 2).Value = "Yes";
        modifiers.Cell(2, 3).Value = "No";
        modifiers.Cell(2, 4).Value = "Small";
        modifiers.Cell(2, 5).Value = 0.00;

        modifiers.Cell(3, 1).Value = "Import Size";
        modifiers.Cell(3, 2).Value = "Yes";
        modifiers.Cell(3, 3).Value = "No";
        modifiers.Cell(3, 4).Value = "Large";
        modifiers.Cell(3, 5).Value = 1.50;

        // Product Modifiers sheet
        var prodMods = wb.Worksheets.Add("Product Modifiers");
        prodMods.Cell(1, 1).Value = "Product Name";
        prodMods.Cell(1, 2).Value = "Modifier Name";
        prodMods.Cell(2, 1).Value = "Import Green";
        prodMods.Cell(2, 2).Value = "Import Size";
        prodMods.Cell(3, 1).Value = "Import Berry";
        prodMods.Cell(3, 2).Value = "Import Size";

        customize?.Invoke(wb);

        var ms = new MemoryStream();
        wb.SaveAs(ms);
        ms.Position = 0;
        return ms;
    }

    private static MultipartFormDataContent CreateFormData(Stream stream, string filename = "test.xlsx")
    {
        var content = new MultipartFormDataContent();
        var fileContent = new StreamContent(stream);
        fileContent.Headers.ContentType = new MediaTypeHeaderValue(
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        content.Add(fileContent, "file", filename);
        return content;
    }

    // --- Import ---

    [Fact]
    public async Task Import_ValidFile_CreatesEntities()
    {
        var client = await _f.AsAdmin();
        using var stream = CreateTestWorkbook();

        var response = await client.PostAsync("/api/MenuImport", CreateFormData(stream));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(json.GetProperty("categoriesCreated").GetInt32() >= 2);
        Assert.True(json.GetProperty("productsCreated").GetInt32() >= 3);
        Assert.True(json.GetProperty("modifiersCreated").GetInt32() >= 1);
        Assert.True(json.GetProperty("productModifierLinksCreated").GetInt32() >= 2);
    }

    [Fact]
    public async Task Import_DuplicateProducts_SkipsDuplicates()
    {
        var client = await _f.AsAdmin();

        // Import twice
        using var stream1 = CreateTestWorkbook();
        await client.PostAsync("/api/MenuImport", CreateFormData(stream1));

        using var stream2 = CreateTestWorkbook();
        var response = await client.PostAsync("/api/MenuImport", CreateFormData(stream2));

        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        // Second import should create 0 new products (all already exist)
        Assert.Equal(0, json.GetProperty("productsCreated").GetInt32());
    }

    [Fact]
    public async Task Import_MissingProductsSheet_ReturnsErrors()
    {
        var client = await _f.AsAdmin();
        using var stream = CreateTestWorkbook(wb =>
        {
            wb.Worksheets.Delete("Products");
        });

        var response = await client.PostAsync("/api/MenuImport", CreateFormData(stream));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        var errors = json.GetProperty("errors");
        Assert.True(errors.GetArrayLength() > 0);
    }

    [Fact]
    public async Task Import_InvalidPrice_ReportsRowError()
    {
        var client = await _f.AsAdmin();
        using var stream = CreateTestWorkbook(wb =>
        {
            var sheet = wb.Worksheet("Products");
            sheet.Cell(5, 1).Value = "Bad Category";
            sheet.Cell(5, 2).Value = "Bad Product";
            sheet.Cell(5, 3).Value = "";
            sheet.Cell(5, 4).Value = "not-a-number";
            sheet.Cell(5, 5).Value = "Yes";
        });

        var response = await client.PostAsync("/api/MenuImport", CreateFormData(stream));

        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        var errors = json.GetProperty("errors");
        Assert.True(errors.GetArrayLength() > 0);
        Assert.Contains("Price", errors[0].GetString());
    }

    [Fact]
    public async Task Import_NoFile_Returns400()
    {
        var client = await _f.AsAdmin();
        var content = new MultipartFormDataContent();
        var response = await client.PostAsync("/api/MenuImport", content);
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Import_WrongFileType_Returns400()
    {
        var client = await _f.AsAdmin();
        var content = new MultipartFormDataContent();
        var fileContent = new StringContent("not an excel file");
        content.Add(fileContent, "file", "test.txt");
        var response = await client.PostAsync("/api/MenuImport", content);
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Import_AsCashier_Returns403()
    {
        var client = await _f.AsCashier();
        using var stream = CreateTestWorkbook();
        var response = await client.PostAsync("/api/MenuImport", CreateFormData(stream));
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task Import_Unauthenticated_Returns401()
    {
        using var stream = CreateTestWorkbook();
        var response = await _f.Client.PostAsync("/api/MenuImport", CreateFormData(stream));
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Import_OptionalModifierWithNegativePrice_PersistsAndExposesViaProductsApi()
    {
        // Regression: cocktail "Virgin Variant" modifier (optional, price -50)
        // must round-trip through import and be exposed on the product DTO so
        // the POS UI can offer it.
        var client = await _f.AsAdmin();
        using var stream = CreateTestWorkbook(wb =>
        {
            // Use unique names so this test doesn't pollute the shared fixture
            // for other MenuImportApiTests that share the database.
            var products = wb.Worksheet("Products");
            products.Cell(2, 1).Value = "Virgin Cocktails";
            products.Cell(2, 2).Value = "Virgin Mojito Test";
            products.Cell(3, 1).Value = "Virgin Cocktails";
            products.Cell(3, 2).Value = "Virgin Pina Test";
            products.Cell(4, 1).Value = "Virgin Cocktails";
            products.Cell(4, 2).Value = "Virgin Daiquiri Test";

            wb.Worksheets.Delete("Modifiers");
            wb.Worksheets.Delete("Product Modifiers");

            var modifiers = wb.Worksheets.Add("Modifiers");
            modifiers.Cell(1, 1).Value = "Modifier Name";
            modifiers.Cell(1, 2).Value = "Required";
            modifiers.Cell(1, 3).Value = "Allow Multiple";
            modifiers.Cell(1, 4).Value = "Option Name";
            modifiers.Cell(1, 5).Value = "Option Price";
            modifiers.Cell(2, 1).Value = "Virgin Variant Test";
            modifiers.Cell(2, 2).Value = "No";
            modifiers.Cell(2, 3).Value = "No";
            modifiers.Cell(2, 4).Value = "Make Virgin Test";
            modifiers.Cell(2, 5).Value = -50;

            var prodMods = wb.Worksheets.Add("Product Modifiers");
            prodMods.Cell(1, 1).Value = "Product Name";
            prodMods.Cell(1, 2).Value = "Modifier Name";
            prodMods.Cell(2, 1).Value = "Virgin Mojito Test";
            prodMods.Cell(2, 2).Value = "Virgin Variant Test";
        });

        var importResponse = await client.PostAsync("/api/MenuImport", CreateFormData(stream));
        Assert.Equal(HttpStatusCode.OK, importResponse.StatusCode);

        var importJson = await importResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(importJson.GetProperty("modifiersCreated").GetInt32() >= 1);
        Assert.True(importJson.GetProperty("productModifierLinksCreated").GetInt32() >= 1);

        // Fetch products and locate the imported one
        var productsResponse = await client.GetAsync("/api/products?pageSize=200");
        Assert.Equal(HttpStatusCode.OK, productsResponse.StatusCode);
        var productsJson = await productsResponse.Content.ReadFromJsonAsync<JsonElement>();
        var data = productsJson.GetProperty("data");

        JsonElement? mojito = null;
        foreach (var p in data.EnumerateArray())
        {
            if (p.GetProperty("name").GetString() == "Virgin Mojito Test")
            {
                mojito = p;
                break;
            }
        }
        Assert.NotNull(mojito);

        var modifiers = mojito!.Value.GetProperty("modifiers");
        Assert.True(modifiers.GetArrayLength() >= 1);

        JsonElement? virginMod = null;
        foreach (var m in modifiers.EnumerateArray())
        {
            if (m.GetProperty("modifierName").GetString() == "Virgin Variant Test")
            {
                virginMod = m;
                break;
            }
        }
        Assert.NotNull(virginMod);
        Assert.False(virginMod!.Value.GetProperty("isRequired").GetBoolean());

        var options = virginMod.Value.GetProperty("options");
        Assert.Equal(1, options.GetArrayLength());
        Assert.Equal("Make Virgin Test", options[0].GetProperty("name").GetString());
        Assert.Equal(-50m, options[0].GetProperty("price").GetDecimal());
    }

    // --- Id-based updates ---

    [Fact]
    public async Task Import_ProductWithId_UpdatesExistingProduct()
    {
        var client = await _f.AsAdmin();

        // Step 1: create a product via name-based import
        using var stream1 = CreateTestWorkbook(wb =>
        {
            wb.Worksheets.Delete("Modifiers");
            wb.Worksheets.Delete("Product Modifiers");
            var p = wb.Worksheet("Products");
            p.Cell(2, 1).Value = "IdTest Cat";
            p.Cell(2, 2).Value = "IdTest Original";
            p.Cell(2, 3).Value = "before";
            p.Cell(2, 4).Value = 5.00;
            p.Cell(2, 5).Value = "Yes";
            // Wipe other rows
            p.Row(3).Clear();
            p.Row(4).Clear();
        });
        await client.PostAsync("/api/MenuImport", CreateFormData(stream1));

        // Look up the assigned id
        var productsResp = await client.GetAsync("/api/products?pageSize=200");
        var productsJson = await productsResp.Content.ReadFromJsonAsync<JsonElement>();
        int createdId = 0;
        foreach (var p in productsJson.GetProperty("data").EnumerateArray())
        {
            if (p.GetProperty("name").GetString() == "IdTest Original")
            {
                createdId = p.GetProperty("id").GetInt32();
                break;
            }
        }
        Assert.True(createdId > 0);

        // Step 2: re-import with Id column → rename + price change
        var wb2 = new XLWorkbook();
        var sheet = wb2.Worksheets.Add("Products");
        sheet.Cell(1, 1).Value = "Id";
        sheet.Cell(1, 2).Value = "Category";
        sheet.Cell(1, 3).Value = "Product Name";
        sheet.Cell(1, 4).Value = "Description";
        sheet.Cell(1, 5).Value = "Price";
        sheet.Cell(1, 6).Value = "Available";
        sheet.Cell(2, 1).Value = createdId;
        sheet.Cell(2, 2).Value = "IdTest Cat";
        sheet.Cell(2, 3).Value = "IdTest Renamed";
        sheet.Cell(2, 4).Value = "after";
        sheet.Cell(2, 5).Value = 9.99;
        sheet.Cell(2, 6).Value = "Yes";
        var ms = new MemoryStream();
        wb2.SaveAs(ms);
        ms.Position = 0;

        var resp = await client.PostAsync("/api/MenuImport", CreateFormData(ms));
        var resultJson = await resp.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(1, resultJson.GetProperty("productsUpdated").GetInt32());
        Assert.Equal(0, resultJson.GetProperty("productsCreated").GetInt32());

        // Verify the rename + price stuck via API
        var verifyResp = await client.GetAsync("/api/products?pageSize=200");
        var verifyJson = await verifyResp.Content.ReadFromJsonAsync<JsonElement>();
        JsonElement? renamed = null;
        foreach (var p in verifyJson.GetProperty("data").EnumerateArray())
        {
            if (p.GetProperty("id").GetInt32() == createdId)
            {
                renamed = p;
                break;
            }
        }
        Assert.NotNull(renamed);
        Assert.Equal("IdTest Renamed", renamed!.Value.GetProperty("name").GetString());
        Assert.Equal(9.99m, renamed.Value.GetProperty("basePrice").GetDecimal());
    }

    [Fact]
    public async Task Import_ProductWithUnknownId_ReportsError()
    {
        var client = await _f.AsAdmin();
        var wb = new XLWorkbook();
        var sheet = wb.Worksheets.Add("Products");
        sheet.Cell(1, 1).Value = "Id";
        sheet.Cell(1, 2).Value = "Category";
        sheet.Cell(1, 3).Value = "Product Name";
        sheet.Cell(1, 4).Value = "Price";
        sheet.Cell(2, 1).Value = 999999;
        sheet.Cell(2, 2).Value = "Ghost";
        sheet.Cell(2, 3).Value = "Ghost Product";
        sheet.Cell(2, 4).Value = 1.00;
        var ms = new MemoryStream();
        wb.SaveAs(ms);
        ms.Position = 0;

        var resp = await client.PostAsync("/api/MenuImport", CreateFormData(ms));
        var json = await resp.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(0, json.GetProperty("productsCreated").GetInt32());
        Assert.Equal(0, json.GetProperty("productsUpdated").GetInt32());
        var errors = json.GetProperty("errors");
        Assert.True(errors.GetArrayLength() > 0);
        Assert.Contains("999999", errors[0].GetString());
    }

    [Fact]
    public async Task Import_ModifierWithId_UpdatesExistingModifier()
    {
        var client = await _f.AsAdmin();

        // Create a modifier via name-based import
        using var stream1 = CreateTestWorkbook(wb =>
        {
            wb.Worksheet("Modifiers").Cell(2, 1).Value = "ModIdTest";
            wb.Worksheet("Modifiers").Cell(3, 1).Value = "ModIdTest";
            wb.Worksheets.Delete("Product Modifiers");
        });
        await client.PostAsync("/api/MenuImport", CreateFormData(stream1));

        // The integration test catalog API may not expose all modifiers; query via
        // a fresh import that lists all modifiers — simpler: re-fetch using catalog endpoint.
        var modsResp = await client.GetAsync("/api/modifiers");
        Assert.Equal(HttpStatusCode.OK, modsResp.StatusCode);
        var modsJson = await modsResp.Content.ReadFromJsonAsync<JsonElement>();
        int modId = 0;
        foreach (var m in modsJson.EnumerateArray())
        {
            if (m.GetProperty("name").GetString() == "ModIdTest")
            {
                modId = m.GetProperty("id").GetInt32();
                break;
            }
        }
        Assert.True(modId > 0);

        // Re-import with Id → rename and flip Required
        var wb2 = new XLWorkbook();
        var sheet = wb2.Worksheets.Add("Modifiers");
        sheet.Cell(1, 1).Value = "Id";
        sheet.Cell(1, 2).Value = "Modifier Name";
        sheet.Cell(1, 3).Value = "Required";
        sheet.Cell(1, 4).Value = "Allow Multiple";
        sheet.Cell(1, 5).Value = "Option Name";
        sheet.Cell(1, 6).Value = "Option Price";
        sheet.Cell(2, 1).Value = modId;
        sheet.Cell(2, 2).Value = "ModIdTest Renamed";
        sheet.Cell(2, 3).Value = "Yes";
        sheet.Cell(2, 4).Value = "No";
        sheet.Cell(2, 5).Value = "Small";
        sheet.Cell(2, 6).Value = 0;
        var ms = new MemoryStream();
        wb2.SaveAs(ms);
        ms.Position = 0;

        var resp = await client.PostAsync("/api/MenuImport", CreateFormData(ms));
        var json = await resp.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(1, json.GetProperty("modifiersUpdated").GetInt32());
        Assert.Equal(0, json.GetProperty("modifiersCreated").GetInt32());
    }

    [Fact]
    public async Task Import_ProductModifierLinkByIds_Works()
    {
        var client = await _f.AsAdmin();

        // Step 1: seed a product and a modifier via name-based import
        using var stream1 = CreateTestWorkbook(wb =>
        {
            var p = wb.Worksheet("Products");
            p.Cell(2, 1).Value = "LinkIdTest Cat";
            p.Cell(2, 2).Value = "LinkIdTest Product";
            p.Cell(2, 3).Value = "";
            p.Cell(2, 4).Value = 5.00;
            p.Cell(2, 5).Value = "Yes";
            p.Row(3).Clear();
            p.Row(4).Clear();

            var m = wb.Worksheet("Modifiers");
            m.Cell(2, 1).Value = "LinkIdTest Modifier";
            m.Cell(2, 2).Value = "No";
            m.Cell(2, 3).Value = "No";
            m.Cell(2, 4).Value = "Opt A";
            m.Cell(2, 5).Value = 0;
            m.Row(3).Clear();

            wb.Worksheets.Delete("Product Modifiers");
        });
        await client.PostAsync("/api/MenuImport", CreateFormData(stream1));

        // Look up assigned ids
        var productsResp = await client.GetAsync("/api/products?pageSize=200");
        var productsJson = await productsResp.Content.ReadFromJsonAsync<JsonElement>();
        int productId = 0;
        foreach (var p in productsJson.GetProperty("data").EnumerateArray())
        {
            if (p.GetProperty("name").GetString() == "LinkIdTest Product")
            {
                productId = p.GetProperty("id").GetInt32();
                break;
            }
        }
        var modsResp = await client.GetAsync("/api/modifiers");
        var modsJson = await modsResp.Content.ReadFromJsonAsync<JsonElement>();
        int modifierId = 0;
        foreach (var m in modsJson.EnumerateArray())
        {
            if (m.GetProperty("name").GetString() == "LinkIdTest Modifier")
            {
                modifierId = m.GetProperty("id").GetInt32();
                break;
            }
        }
        Assert.True(productId > 0 && modifierId > 0);

        // Step 2: link via Id columns only
        var wb2 = new XLWorkbook();
        var sheet = wb2.Worksheets.Add("Product Modifiers");
        sheet.Cell(1, 1).Value = "Product Id";
        sheet.Cell(1, 2).Value = "Modifier Id";
        sheet.Cell(2, 1).Value = productId;
        sheet.Cell(2, 2).Value = modifierId;
        var ms = new MemoryStream();
        wb2.SaveAs(ms);
        ms.Position = 0;

        var resp = await client.PostAsync("/api/MenuImport", CreateFormData(ms));
        var json = await resp.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(1, json.GetProperty("productModifierLinksCreated").GetInt32());

        // Verify the link via products API
        var verifyResp = await client.GetAsync("/api/products?pageSize=200");
        var verifyJson = await verifyResp.Content.ReadFromJsonAsync<JsonElement>();
        foreach (var p in verifyJson.GetProperty("data").EnumerateArray())
        {
            if (p.GetProperty("id").GetInt32() == productId)
            {
                var mods = p.GetProperty("modifiers");
                Assert.True(mods.GetArrayLength() >= 1);
                return;
            }
        }
        Assert.Fail("Product not found after Id-based link");
    }

    [Fact]
    public async Task Import_BackwardsCompatible_FileWithoutIdColumn_StillWorks()
    {
        // The original CreateTestWorkbook helper produces a file with no Id columns —
        // confirm it still imports cleanly after the header-driven refactor.
        var client = await _f.AsAdmin();
        using var stream = CreateTestWorkbook();
        var resp = await client.PostAsync("/api/MenuImport", CreateFormData(stream));
        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
        var json = await resp.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(json.GetProperty("productsCreated").GetInt32() >= 0);
    }

    // --- Export ---

    [Fact]
    public async Task Export_ReturnsRoundTrippableXlsx()
    {
        var client = await _f.AsAdmin();

        // Seed something specific so we can find it on the round-trip
        using var seedStream = CreateTestWorkbook(wb =>
        {
            var p = wb.Worksheet("Products");
            p.Cell(2, 1).Value = "ExportTest Cat";
            p.Cell(2, 2).Value = "ExportTest Product";
            p.Cell(2, 3).Value = "round-trip";
            p.Cell(2, 4).Value = 12.34;
            p.Cell(2, 5).Value = "Yes";
            p.Row(3).Clear();
            p.Row(4).Clear();

            var m = wb.Worksheet("Modifiers");
            m.Cell(2, 1).Value = "ExportTest Mod";
            m.Cell(2, 2).Value = "No";
            m.Cell(2, 3).Value = "No";
            m.Cell(2, 4).Value = "Opt X";
            m.Cell(2, 5).Value = 1.00;
            m.Row(3).Clear();

            var pm = wb.Worksheet("Product Modifiers");
            pm.Cell(2, 1).Value = "ExportTest Product";
            pm.Cell(2, 2).Value = "ExportTest Mod";
            pm.Row(3).Clear();
        });
        await client.PostAsync("/api/MenuImport", CreateFormData(seedStream));

        // Export
        var exportResp = await client.GetAsync("/api/MenuImport/export");
        Assert.Equal(HttpStatusCode.OK, exportResp.StatusCode);
        Assert.Equal(
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            exportResp.Content.Headers.ContentType?.MediaType);

        var bytes = await exportResp.Content.ReadAsByteArrayAsync();
        Assert.True(bytes.Length > 0);

        using var ms = new MemoryStream(bytes);
        using var wb = new XLWorkbook(ms);

        // Verify all three sheets exist with Id headers
        Assert.True(wb.Worksheets.Contains("Products"));
        Assert.True(wb.Worksheets.Contains("Modifiers"));
        Assert.True(wb.Worksheets.Contains("Product Modifiers"));

        var productsSheet = wb.Worksheet("Products");
        Assert.Equal("Id", productsSheet.Cell(1, 1).GetString());
        Assert.Equal("Category", productsSheet.Cell(1, 2).GetString());
        Assert.Equal("Product Name", productsSheet.Cell(1, 3).GetString());

        // Find our seeded product and confirm Id is populated
        bool foundProduct = false;
        int seededProductId = 0;
        for (int row = 2; row <= productsSheet.LastRowUsed()!.RowNumber(); row++)
        {
            if (productsSheet.Cell(row, 3).GetString() == "ExportTest Product")
            {
                seededProductId = (int)productsSheet.Cell(row, 1).GetDouble();
                Assert.True(seededProductId > 0);
                Assert.Equal(12.34m, productsSheet.Cell(row, 5).GetValue<decimal>());
                foundProduct = true;
                break;
            }
        }
        Assert.True(foundProduct);

        // Verify Product Modifiers sheet has Id columns and contains our link
        var linksSheet = wb.Worksheet("Product Modifiers");
        Assert.Equal("Product Id", linksSheet.Cell(1, 1).GetString());
        Assert.Equal("Modifier Id", linksSheet.Cell(1, 2).GetString());

        bool foundLink = false;
        for (int row = 2; row <= (linksSheet.LastRowUsed()?.RowNumber() ?? 1); row++)
        {
            if ((int)linksSheet.Cell(row, 1).GetDouble() == seededProductId)
            {
                Assert.True(linksSheet.Cell(row, 2).GetDouble() > 0);
                foundLink = true;
                break;
            }
        }
        Assert.True(foundLink);

        // Round-trip: re-import the exported file and confirm it does not duplicate
        ms.Position = 0;
        var reimportResp = await client.PostAsync("/api/MenuImport", CreateFormData(ms));
        var reimportJson = await reimportResp.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(0, reimportJson.GetProperty("productsCreated").GetInt32());
        Assert.Equal(0, reimportJson.GetProperty("modifiersCreated").GetInt32());
        // Updated count > 0 because every row had an Id and re-applied its fields
        Assert.True(reimportJson.GetProperty("productsUpdated").GetInt32() > 0);
    }

    [Fact]
    public async Task Export_AsCashier_Returns403()
    {
        var client = await _f.AsCashier();
        var resp = await client.GetAsync("/api/MenuImport/export");
        Assert.Equal(HttpStatusCode.Forbidden, resp.StatusCode);
    }

    [Fact]
    public async Task Export_Unauthenticated_Returns401()
    {
        var resp = await _f.Client.GetAsync("/api/MenuImport/export");
        Assert.Equal(HttpStatusCode.Unauthorized, resp.StatusCode);
    }

    // --- Template ---

    [Fact]
    public async Task GetTemplate_ReturnsXlsxFile()
    {
        var response = await _f.Client.GetAsync("/api/MenuImport/template");

        // Template file may not exist in test environment (no Resources folder in test output)
        // This is expected — the template is only bundled in the published API
        if (response.StatusCode == HttpStatusCode.NotFound) return;

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            response.Content.Headers.ContentType?.MediaType);
    }
}
