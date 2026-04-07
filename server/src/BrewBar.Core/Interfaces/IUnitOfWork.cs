using BrewBar.Core.Entities;

namespace BrewBar.Core.Interfaces;

public interface IUnitOfWork : IDisposable
{
    IGenericRepository<TEntity> Repository<TEntity>() where TEntity : BaseEntity;
    IQueryable<TEntity> GetQueryable<TEntity>() where TEntity : BaseEntity;
    Task<int> Complete(CancellationToken ct = default);
}
