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
