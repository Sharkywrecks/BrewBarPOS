using System.Collections;
using BrewBar.Core.Entities;
using BrewBar.Core.Interfaces;

namespace BrewBar.Infrastructure.Data;

public class UnitOfWork : IUnitOfWork
{
    private readonly BrewBarContext _context;
    private readonly Hashtable _repositories = new();

    public UnitOfWork(BrewBarContext context)
    {
        _context = context;
    }

    public IGenericRepository<TEntity> Repository<TEntity>() where TEntity : BaseEntity
    {
        var type = typeof(TEntity).Name;

        if (!_repositories.ContainsKey(type))
        {
            var repositoryInstance = new GenericRepository<TEntity>(_context);
            _repositories.Add(type, repositoryInstance);
        }

        return (IGenericRepository<TEntity>)_repositories[type]!;
    }

    public IQueryable<TEntity> GetQueryable<TEntity>() where TEntity : BaseEntity
    {
        return _context.Set<TEntity>().AsQueryable();
    }

    public async Task<int> Complete(CancellationToken ct = default)
    {
        return await _context.SaveChangesAsync(ct);
    }

    public void Dispose()
    {
        _context.Dispose();
    }
}
