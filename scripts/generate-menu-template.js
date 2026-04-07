/**
 * Generates the menu-template.xlsx file for BrewBar POS menu import.
 * Uses a simple approach: create the xlsx via the ClosedXML dotnet tool.
 * This script generates a C# program that creates the template and runs it.
 */
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const outputPath = path.resolve(
  __dirname,
  '..',
  'server',
  'src',
  'BrewBar.API',
  'Resources',
  'menu-template.xlsx',
);

const tempDir = path.resolve(__dirname, '..', 'build', 'template-gen');
fs.mkdirSync(tempDir, { recursive: true });

const csproj = `<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <OutputType>Exe</OutputType>
    <TargetFramework>net10.0</TargetFramework>
    <ImplicitUsings>enable</ImplicitUsings>
  </PropertyGroup>
  <ItemGroup>
    <PackageReference Include="ClosedXML" Version="0.105.0" />
  </ItemGroup>
</Project>`;

const program = `using ClosedXML.Excel;

var wb = new XLWorkbook();

// Instructions sheet
var instructions = wb.Worksheets.Add("Instructions");
instructions.Cell("A1").Value = "BrewBar POS — Menu Import Template";
instructions.Cell("A1").Style.Font.Bold = true;
instructions.Cell("A1").Style.Font.FontSize = 14;
instructions.Cell("A3").Value = "How to use this template:";
instructions.Cell("A3").Style.Font.Bold = true;
instructions.Cell("A4").Value = "1. Fill out the Products sheet with your menu items (one row per product)";
instructions.Cell("A5").Value = "2. Fill out the Modifiers sheet with add-ons/options (one row per option)";
instructions.Cell("A6").Value = "3. Fill out the Product Modifiers sheet to link products to their modifiers";
instructions.Cell("A7").Value = "4. Save the file and import it via the BrewBar POS installer or admin dashboard";
instructions.Cell("A9").Value = "Notes:";
instructions.Cell("A9").Style.Font.Bold = true;
instructions.Cell("A10").Value = "• Categories are created automatically from the Products sheet";
instructions.Cell("A11").Value = "• Duplicate product/modifier names are skipped (not duplicated)";
instructions.Cell("A12").Value = "• Prices should be numbers without currency symbols";
instructions.Cell("A13").Value = "• Yes/No columns accept: yes, no, true, false, 1, 0";
instructions.Column("A").Width = 80;

// Products sheet
var products = wb.Worksheets.Add("Products");
var prodHeaders = new[] { "Category", "Product Name", "Description", "Price", "Available" };
for (int i = 0; i < prodHeaders.Length; i++)
{
    products.Cell(1, i + 1).Value = prodHeaders[i];
    products.Cell(1, i + 1).Style.Font.Bold = true;
    products.Cell(1, i + 1).Style.Fill.BackgroundColor = XLColor.LightGray;
}
// Example data
products.Cell(2, 1).Value = "Smoothies";
products.Cell(2, 2).Value = "Green Machine";
products.Cell(2, 3).Value = "Spinach, banana, mango, pineapple";
products.Cell(2, 4).Value = 7.50;
products.Cell(2, 5).Value = "Yes";
products.Cell(3, 1).Value = "Smoothies";
products.Cell(3, 2).Value = "Berry Blast";
products.Cell(3, 3).Value = "Strawberry, blueberry, raspberry";
products.Cell(3, 4).Value = 7.50;
products.Cell(3, 5).Value = "Yes";
products.Cell(4, 1).Value = "Drinks";
products.Cell(4, 2).Value = "Water";
products.Cell(4, 3).Value = "Bottled water";
products.Cell(4, 4).Value = 2.00;
products.Cell(4, 5).Value = "Yes";
products.Columns().AdjustToContents();

// Modifiers sheet
var modifiers = wb.Worksheets.Add("Modifiers");
var modHeaders = new[] { "Modifier Name", "Required", "Allow Multiple", "Option Name", "Option Price" };
for (int i = 0; i < modHeaders.Length; i++)
{
    modifiers.Cell(1, i + 1).Value = modHeaders[i];
    modifiers.Cell(1, i + 1).Style.Font.Bold = true;
    modifiers.Cell(1, i + 1).Style.Fill.BackgroundColor = XLColor.LightGray;
}
// Example data
modifiers.Cell(2, 1).Value = "Size";
modifiers.Cell(2, 2).Value = "Yes";
modifiers.Cell(2, 3).Value = "No";
modifiers.Cell(2, 4).Value = "16 oz";
modifiers.Cell(2, 5).Value = 0.00;
modifiers.Cell(3, 1).Value = "Size";
modifiers.Cell(3, 2).Value = "Yes";
modifiers.Cell(3, 3).Value = "No";
modifiers.Cell(3, 4).Value = "24 oz";
modifiers.Cell(3, 5).Value = 1.50;
modifiers.Cell(4, 1).Value = "Boost";
modifiers.Cell(4, 2).Value = "No";
modifiers.Cell(4, 3).Value = "Yes";
modifiers.Cell(4, 4).Value = "Protein";
modifiers.Cell(4, 5).Value = 1.50;
modifiers.Columns().AdjustToContents();

// Product Modifiers sheet
var prodMods = wb.Worksheets.Add("Product Modifiers");
var pmHeaders = new[] { "Product Name", "Modifier Name" };
for (int i = 0; i < pmHeaders.Length; i++)
{
    prodMods.Cell(1, i + 1).Value = pmHeaders[i];
    prodMods.Cell(1, i + 1).Style.Font.Bold = true;
    prodMods.Cell(1, i + 1).Style.Fill.BackgroundColor = XLColor.LightGray;
}
prodMods.Cell(2, 1).Value = "Green Machine";
prodMods.Cell(2, 2).Value = "Size";
prodMods.Cell(3, 1).Value = "Green Machine";
prodMods.Cell(3, 2).Value = "Boost";
prodMods.Cell(4, 1).Value = "Berry Blast";
prodMods.Cell(4, 2).Value = "Size";
prodMods.Columns().AdjustToContents();

wb.SaveAs(args[0]);
Console.WriteLine("Template generated: " + args[0]);
`;

fs.writeFileSync(path.join(tempDir, 'TemplateGen.csproj'), csproj);
fs.writeFileSync(path.join(tempDir, 'Program.cs'), program);

console.log('Building template generator...');
execSync(`dotnet run --project "${tempDir}" -- "${outputPath}"`, {
  stdio: 'inherit',
});

// Clean up
fs.rmSync(tempDir, { recursive: true, force: true });
console.log(`Template saved to: ${outputPath}`);
