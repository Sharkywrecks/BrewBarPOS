using BrewBar.API.Dtos.Catalog;
using BrewBar.API.Errors;
using BrewBar.API.Helpers;
using BrewBar.Core.Entities.CatalogAggregate;
using BrewBar.Core.Interfaces;
using BrewBar.Core.Constants;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BrewBar.API.Controllers;

[Authorize]
public class ProductsController : BaseApiController
{
    private readonly IUnitOfWork _unitOfWork;

    public ProductsController(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    [HttpGet]
    public async Task<ActionResult<Pagination<ProductDto>>> GetProducts(
        [FromQuery] int? categoryId,
        [FromQuery] bool availableOnly = false,
        [FromQuery] int pageIndex = 0,
        [FromQuery] int pageSize = 50,
        CancellationToken ct = default)
    {
        var query = _unitOfWork.GetQueryable<Product>()
            .Include(p => p.Category)
            .Include(p => p.Variants)
            .Include(p => p.ProductModifiers)
                .ThenInclude(pm => pm.Modifier)
                    .ThenInclude(m => m.Options)
            .AsQueryable();

        if (categoryId.HasValue) query = query.Where(p => p.CategoryId == categoryId.Value);
        if (availableOnly) query = query.Where(p => p.IsAvailable);

        var count = await query.CountAsync(ct);
        var products = await query
            .OrderBy(p => p.SortOrder)
            .Skip(pageIndex * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        var data = products.Select(MapProduct).ToList();
        return Ok(new Pagination<ProductDto>(pageIndex, pageSize, count, data));
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<ProductDto>> GetProduct(int id, CancellationToken ct)
    {
        var product = await _unitOfWork.GetQueryable<Product>()
            .Include(p => p.Category)
            .Include(p => p.Variants)
            .Include(p => p.ProductModifiers)
                .ThenInclude(pm => pm.Modifier)
                    .ThenInclude(m => m.Options)
            .FirstOrDefaultAsync(p => p.Id == id, ct);

        if (product == null) return NotFound(new ApiResponse(404));
        return Ok(MapProduct(product));
    }

    [HttpGet("lookup")]
    public async Task<ActionResult<ProductDto>> LookupProduct(
        [FromQuery] string? barcode, [FromQuery] string? sku, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(barcode) && string.IsNullOrWhiteSpace(sku))
            return BadRequest(new ApiResponse(400, "Provide barcode or sku"));

        var query = _unitOfWork.GetQueryable<Product>()
            .Include(p => p.Category)
            .Include(p => p.Variants)
            .Include(p => p.ProductModifiers)
                .ThenInclude(pm => pm.Modifier)
                    .ThenInclude(m => m.Options)
            .AsQueryable();

        Product? product = null;
        if (!string.IsNullOrWhiteSpace(barcode))
            product = await query.FirstOrDefaultAsync(p => p.Barcode == barcode, ct);
        else if (!string.IsNullOrWhiteSpace(sku))
            product = await query.FirstOrDefaultAsync(p => p.Sku == sku, ct);

        if (product == null) return NotFound(new ApiResponse(404));
        return Ok(MapProduct(product));
    }

    [HttpPost]
    [Authorize(Policy = Policies.RequireAdminOrManager)]
    public async Task<ActionResult<ProductDto>> CreateProduct(CreateProductDto dto, CancellationToken ct)
    {
        var category = await _unitOfWork.Repository<Category>().GetByIdAsync(dto.CategoryId, ct);
        if (category == null) return BadRequest(new ApiResponse(400, "Category not found"));

        var product = new Product
        {
            Name = dto.Name,
            Description = dto.Description,
            BasePrice = dto.BasePrice,
            CategoryId = dto.CategoryId,
            SortOrder = dto.SortOrder,
            IsAvailable = dto.IsAvailable,
            ImageUrl = dto.ImageUrl,
            TaxRate = dto.TaxRate,
            Barcode = dto.Barcode,
            Sku = dto.Sku
        };

        _unitOfWork.Repository<Product>().Add(product);
        await _unitOfWork.Complete(ct);

        // Reload with includes
        var created = await _unitOfWork.GetQueryable<Product>()
            .Include(p => p.Category)
            .Include(p => p.Variants)
            .FirstOrDefaultAsync(p => p.Id == product.Id, ct);

        return CreatedAtAction(nameof(GetProduct), new { id = product.Id }, MapProduct(created!));
    }

    [HttpPut("{id}")]
    [Authorize(Policy = Policies.RequireAdminOrManager)]
    public async Task<ActionResult<ProductDto>> UpdateProduct(int id, UpdateProductDto dto, CancellationToken ct)
    {
        var product = await _unitOfWork.GetQueryable<Product>()
            .Include(p => p.Category)
            .Include(p => p.Variants)
            .Include(p => p.ProductModifiers)
                .ThenInclude(pm => pm.Modifier)
                    .ThenInclude(m => m.Options)
            .FirstOrDefaultAsync(p => p.Id == id, ct);

        if (product == null) return NotFound(new ApiResponse(404));

        product.Name = dto.Name;
        product.Description = dto.Description;
        product.BasePrice = dto.BasePrice;
        product.CategoryId = dto.CategoryId;
        product.SortOrder = dto.SortOrder;
        product.IsAvailable = dto.IsAvailable;
        product.ImageUrl = dto.ImageUrl;
        product.TaxRate = dto.TaxRate;
        product.Barcode = dto.Barcode;
        product.Sku = dto.Sku;

        await _unitOfWork.Complete(ct);
        return Ok(MapProduct(product));
    }

    [HttpDelete("{id}")]
    [Authorize(Policy = Policies.RequireAdmin)]
    public async Task<ActionResult> DeleteProduct(int id, CancellationToken ct)
    {
        var product = await _unitOfWork.Repository<Product>().GetByIdAsync(id, ct);
        if (product == null) return NotFound(new ApiResponse(404));

        _unitOfWork.Repository<Product>().Delete(product);
        await _unitOfWork.Complete(ct);
        return NoContent();
    }

    // --- Variants ---

    [HttpPost("{productId}/variants")]
    [Authorize(Policy = Policies.RequireAdminOrManager)]
    public async Task<ActionResult<ProductVariantDto>> CreateVariant(int productId, CreateProductVariantDto dto, CancellationToken ct)
    {
        var product = await _unitOfWork.Repository<Product>().GetByIdAsync(productId, ct);
        if (product == null) return NotFound(new ApiResponse(404, "Product not found"));

        var variant = new ProductVariant
        {
            ProductId = productId,
            Name = dto.Name,
            PriceOverride = dto.PriceOverride,
            SortOrder = dto.SortOrder,
            IsAvailable = dto.IsAvailable
        };

        _unitOfWork.Repository<ProductVariant>().Add(variant);
        await _unitOfWork.Complete(ct);

        return CreatedAtAction(nameof(GetProduct), new { id = productId }, new ProductVariantDto
        {
            Id = variant.Id,
            Name = variant.Name,
            PriceOverride = variant.PriceOverride,
            SortOrder = variant.SortOrder,
            IsAvailable = variant.IsAvailable
        });
    }

    [HttpPut("{productId}/variants/{variantId}")]
    [Authorize(Policy = Policies.RequireAdminOrManager)]
    public async Task<ActionResult<ProductVariantDto>> UpdateVariant(int productId, int variantId, UpdateProductVariantDto dto, CancellationToken ct)
    {
        var variant = await _unitOfWork.GetQueryable<ProductVariant>()
            .FirstOrDefaultAsync(v => v.Id == variantId && v.ProductId == productId, ct);

        if (variant == null) return NotFound(new ApiResponse(404));

        variant.Name = dto.Name;
        variant.PriceOverride = dto.PriceOverride;
        variant.SortOrder = dto.SortOrder;
        variant.IsAvailable = dto.IsAvailable;

        await _unitOfWork.Complete(ct);

        return Ok(new ProductVariantDto
        {
            Id = variant.Id,
            Name = variant.Name,
            PriceOverride = variant.PriceOverride,
            SortOrder = variant.SortOrder,
            IsAvailable = variant.IsAvailable
        });
    }

    [HttpDelete("{productId}/variants/{variantId}")]
    [Authorize(Policy = Policies.RequireAdmin)]
    public async Task<ActionResult> DeleteVariant(int productId, int variantId, CancellationToken ct)
    {
        var variant = await _unitOfWork.GetQueryable<ProductVariant>()
            .FirstOrDefaultAsync(v => v.Id == variantId && v.ProductId == productId, ct);

        if (variant == null) return NotFound(new ApiResponse(404));

        _unitOfWork.Repository<ProductVariant>().Delete(variant);
        await _unitOfWork.Complete(ct);
        return NoContent();
    }

    // --- Product-Modifier Assignments ---

    [HttpPost("{productId}/modifiers/{modifierId}")]
    [Authorize(Policy = Policies.RequireAdminOrManager)]
    public async Task<ActionResult> AssignModifier(int productId, int modifierId, CancellationToken ct)
    {
        var product = await _unitOfWork.Repository<Product>().GetByIdAsync(productId, ct);
        if (product == null) return NotFound(new ApiResponse(404, "Product not found"));

        var modifier = await _unitOfWork.Repository<Modifier>().GetByIdAsync(modifierId, ct);
        if (modifier == null) return NotFound(new ApiResponse(404, "Modifier not found"));

        var exists = await _unitOfWork.GetQueryable<ProductModifier>()
            .AnyAsync(pm => pm.ProductId == productId && pm.ModifierId == modifierId, ct);

        if (exists) return BadRequest(new ApiResponse(400, "Modifier already assigned to product"));

        _unitOfWork.Repository<ProductModifier>().Add(new ProductModifier
        {
            ProductId = productId,
            ModifierId = modifierId
        });

        await _unitOfWork.Complete(ct);
        return NoContent();
    }

    [HttpDelete("{productId}/modifiers/{modifierId}")]
    [Authorize(Policy = Policies.RequireAdminOrManager)]
    public async Task<ActionResult> RemoveModifier(int productId, int modifierId, CancellationToken ct)
    {
        var pm = await _unitOfWork.GetQueryable<ProductModifier>()
            .FirstOrDefaultAsync(pm => pm.ProductId == productId && pm.ModifierId == modifierId, ct);

        if (pm == null) return NotFound(new ApiResponse(404));

        _unitOfWork.Repository<ProductModifier>().Delete(pm);
        await _unitOfWork.Complete(ct);
        return NoContent();
    }

    private static ProductDto MapProduct(Product p) => new()
    {
        Id = p.Id,
        Name = p.Name,
        Description = p.Description,
        BasePrice = p.BasePrice,
        CategoryId = p.CategoryId,
        CategoryName = p.Category?.Name ?? string.Empty,
        SortOrder = p.SortOrder,
        IsAvailable = p.IsAvailable,
        ImageUrl = p.ImageUrl,
        TaxRate = p.TaxRate,
        Barcode = p.Barcode,
        Sku = p.Sku,
        Variants = p.Variants.OrderBy(v => v.SortOrder).Select(v => new ProductVariantDto
        {
            Id = v.Id,
            Name = v.Name,
            PriceOverride = v.PriceOverride,
            SortOrder = v.SortOrder,
            IsAvailable = v.IsAvailable
        }).ToList(),
        Modifiers = p.ProductModifiers?.Select(pm => new ProductModifierDto
        {
            ModifierId = pm.Modifier.Id,
            ModifierName = pm.Modifier.Name,
            IsRequired = pm.Modifier.IsRequired,
            AllowMultiple = pm.Modifier.AllowMultiple,
            SortOrder = pm.Modifier.SortOrder,
            Options = pm.Modifier.Options.OrderBy(o => o.SortOrder).Select(o => new ModifierOptionDto
            {
                Id = o.Id,
                Name = o.Name,
                Price = o.Price,
                SortOrder = o.SortOrder
            }).ToList()
        }).ToList() ?? new List<ProductModifierDto>()
    };
}
