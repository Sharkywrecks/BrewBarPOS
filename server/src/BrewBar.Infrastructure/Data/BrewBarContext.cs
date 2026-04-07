using BrewBar.Core.Entities.CatalogAggregate;
using BrewBar.Core.Entities.OrderAggregate;
using BrewBar.Core.Entities.PaymentAggregate;
using BrewBar.Core.Entities.SyncAggregate;
using BrewBar.Core.Entities.TerminalAggregate;
using Microsoft.EntityFrameworkCore;

namespace BrewBar.Infrastructure.Data;

public class BrewBarContext : DbContext
{
    public BrewBarContext(DbContextOptions<BrewBarContext> options) : base(options) { }

    public DbSet<Category> Categories => Set<Category>();
    public DbSet<Product> Products => Set<Product>();
    public DbSet<ProductVariant> ProductVariants => Set<ProductVariant>();
    public DbSet<Modifier> Modifiers => Set<Modifier>();
    public DbSet<ModifierOption> ModifierOptions => Set<ModifierOption>();
    public DbSet<ProductModifier> ProductModifiers => Set<ProductModifier>();
    public DbSet<Order> Orders => Set<Order>();
    public DbSet<OrderLineItem> OrderLineItems => Set<OrderLineItem>();
    public DbSet<OrderModifierItem> OrderModifierItems => Set<OrderModifierItem>();
    public DbSet<Payment> Payments => Set<Payment>();
    public DbSet<Terminal> Terminals => Set<Terminal>();
    public DbSet<SyncOutboxEntry> SyncOutboxEntries => Set<SyncOutboxEntry>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(BrewBarContext).Assembly);
    }

    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        foreach (var entry in ChangeTracker.Entries<Core.Entities.BaseEntity>())
        {
            if (entry.State == EntityState.Modified)
            {
                entry.Entity.UpdatedAtUtc = DateTime.UtcNow;
            }
        }

        return base.SaveChangesAsync(cancellationToken);
    }
}
