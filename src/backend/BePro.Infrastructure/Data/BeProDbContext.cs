using BePro.Core.Entities;
using BePro.Core.Entities.Base;
using Microsoft.EntityFrameworkCore;

namespace BePro.Infrastructure.Data;

public class BeProDbContext : DbContext
{
    public BeProDbContext(DbContextOptions<BeProDbContext> options) : base(options) { }

    public DbSet<User> Users => Set<User>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
    public DbSet<Client> Clients => Set<Client>();
    public DbSet<ClientFormConfig> ClientFormConfigs => Set<ClientFormConfig>();
    public DbSet<ClientAssignment> ClientAssignments => Set<ClientAssignment>();
    public DbSet<Candidate> Candidates => Set<Candidate>();
    public DbSet<Placement> Placements => Set<Placement>();
    public DbSet<Invoice> Invoices => Set<Invoice>();
    public DbSet<InvoicePlacement> InvoicePlacements => Set<InvoicePlacement>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(BeProDbContext).Assembly);
    }

    public override async Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        var now = DateTime.UtcNow;

        foreach (var entry in ChangeTracker.Entries<BaseEntity>())
        {
            switch (entry.State)
            {
                case EntityState.Added:
                    entry.Entity.CreatedAt = now;
                    entry.Entity.UpdatedAt = now;
                    if (entry.Entity.Id == Guid.Empty)
                        entry.Entity.Id = Guid.NewGuid();
                    break;
                case EntityState.Modified:
                    entry.Entity.UpdatedAt = now;
                    break;
            }
        }

        return await base.SaveChangesAsync(cancellationToken);
    }
}
