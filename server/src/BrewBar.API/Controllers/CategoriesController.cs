using BrewBar.API.Dtos.Catalog;
using BrewBar.API.Errors;
using BrewBar.Core.Entities.CatalogAggregate;
using BrewBar.Core.Interfaces;
using BrewBar.Core.Constants;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BrewBar.API.Controllers;

[Authorize]
public class CategoriesController : BaseApiController
{
    private readonly IUnitOfWork _unitOfWork;

    public CategoriesController(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<CategoryDto>>> GetCategories(
        [FromQuery] bool activeOnly = false, CancellationToken ct = default)
    {
        var query = _unitOfWork.GetQueryable<Category>()
            .Include(c => c.Products)
            .OrderBy(c => c.SortOrder)
            .AsQueryable();

        if (activeOnly) query = query.Where(c => c.IsActive);

        var categories = await query.ToListAsync(ct);

        return Ok(categories.Select(c => new CategoryDto
        {
            Id = c.Id,
            Name = c.Name,
            Description = c.Description,
            SortOrder = c.SortOrder,
            IsActive = c.IsActive,
            ProductCount = c.Products.Count
        }).ToList());
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<CategoryDetailDto>> GetCategory(int id, CancellationToken ct)
    {
        var category = await _unitOfWork.GetQueryable<Category>()
            .Include(c => c.Products)
                .ThenInclude(p => p.Variants)
            .Include(c => c.Products)
                .ThenInclude(p => p.ProductModifiers)
                    .ThenInclude(pm => pm.Modifier)
                        .ThenInclude(m => m.Options)
            .FirstOrDefaultAsync(c => c.Id == id, ct);

        if (category == null) return NotFound(new ApiResponse(404));

        return Ok(MapCategoryDetail(category));
    }

    [HttpPost]
    [Authorize(Roles = Roles.AdminOrManager)]
    public async Task<ActionResult<CategoryDto>> CreateCategory(CreateCategoryDto dto, CancellationToken ct)
    {
        var category = new Category
        {
            Name = dto.Name,
            Description = dto.Description,
            SortOrder = dto.SortOrder,
            IsActive = dto.IsActive
        };

        _unitOfWork.Repository<Category>().Add(category);
        await _unitOfWork.Complete(ct);

        return CreatedAtAction(nameof(GetCategory), new { id = category.Id }, new CategoryDto
        {
            Id = category.Id,
            Name = category.Name,
            Description = category.Description,
            SortOrder = category.SortOrder,
            IsActive = category.IsActive,
            ProductCount = 0
        });
    }

    [HttpPut("{id}")]
    [Authorize(Roles = Roles.AdminOrManager)]
    public async Task<ActionResult<CategoryDto>> UpdateCategory(int id, UpdateCategoryDto dto, CancellationToken ct)
    {
        var category = await _unitOfWork.Repository<Category>().GetByIdAsync(id, ct);
        if (category == null) return NotFound(new ApiResponse(404));

        category.Name = dto.Name;
        category.Description = dto.Description;
        category.SortOrder = dto.SortOrder;
        category.IsActive = dto.IsActive;

        _unitOfWork.Repository<Category>().Update(category);
        await _unitOfWork.Complete(ct);

        return Ok(new CategoryDto
        {
            Id = category.Id,
            Name = category.Name,
            Description = category.Description,
            SortOrder = category.SortOrder,
            IsActive = category.IsActive
        });
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = Roles.Admin)]
    public async Task<ActionResult> DeleteCategory(int id, CancellationToken ct)
    {
        var category = await _unitOfWork.GetQueryable<Category>()
            .Include(c => c.Products)
            .FirstOrDefaultAsync(c => c.Id == id, ct);

        if (category == null) return NotFound(new ApiResponse(404));
        if (category.Products.Count > 0)
            return BadRequest(new ApiResponse(400, "Cannot delete a category that has products. Remove products first."));

        _unitOfWork.Repository<Category>().Delete(category);
        await _unitOfWork.Complete(ct);

        return NoContent();
    }

    private static CategoryDetailDto MapCategoryDetail(Category c) => new()
    {
        Id = c.Id,
        Name = c.Name,
        Description = c.Description,
        SortOrder = c.SortOrder,
        IsActive = c.IsActive,
        ProductCount = c.Products.Count,
        Products = c.Products.OrderBy(p => p.SortOrder).Select(p => new ProductDto
        {
            Id = p.Id,
            Name = p.Name,
            Description = p.Description,
            BasePrice = p.BasePrice,
            CategoryId = p.CategoryId,
            CategoryName = c.Name,
            SortOrder = p.SortOrder,
            IsAvailable = p.IsAvailable,
            ImageUrl = p.ImageUrl,
            Variants = p.Variants.OrderBy(v => v.SortOrder).Select(v => new ProductVariantDto
            {
                Id = v.Id,
                Name = v.Name,
                PriceOverride = v.PriceOverride,
                SortOrder = v.SortOrder,
                IsAvailable = v.IsAvailable
            }).ToList(),
            Modifiers = p.ProductModifiers.Select(pm => new ProductModifierDto
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
            }).ToList()
        }).ToList()
    };
}
