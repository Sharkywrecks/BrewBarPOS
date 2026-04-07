using System.Linq.Expressions;
using BrewBar.Core.Entities;
using BrewBar.Core.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace BrewBar.Infrastructure.Data;

public class GenericRepository<T> : IGenericRepository<T> where T : BaseEntity
{
    private readonly BrewBarContext _context;

    public GenericRepository(BrewBarContext context)
    {
        _context = context;
    }

    public async Task<T?> GetByIdAsync(int id, CancellationToken ct = default)
    {
        return await _context.Set<T>().FindAsync(new object[] { id }, ct);
    }

    public async Task<IReadOnlyList<T>> ListAllAsync(CancellationToken ct = default)
    {
        return await _context.Set<T>().ToListAsync(ct);
    }

    public async Task<IReadOnlyList<T>> ListAsync(Expression<Func<T, bool>> predicate, CancellationToken ct = default)
    {
        return await _context.Set<T>().Where(predicate).ToListAsync(ct);
    }

    public IQueryable<T> GetQueryable()
    {
        return _context.Set<T>().AsQueryable();
    }

    public void Add(T entity)
    {
        _context.Set<T>().Add(entity);
    }

    public void Update(T entity)
    {
        _context.Set<T>().Attach(entity);
        _context.Entry(entity).State = EntityState.Modified;
    }

    public void Delete(T entity)
    {
        _context.Set<T>().Remove(entity);
    }

    public async Task<int> CountAsync(CancellationToken ct = default)
    {
        return await _context.Set<T>().CountAsync(ct);
    }

    public async Task<int> CountAsync(Expression<Func<T, bool>> predicate, CancellationToken ct = default)
    {
        return await _context.Set<T>().CountAsync(predicate, ct);
    }

    public async Task<bool> AnyAsync(Expression<Func<T, bool>> predicate, CancellationToken ct = default)
    {
        return await _context.Set<T>().AnyAsync(predicate, ct);
    }
}
