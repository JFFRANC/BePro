using BePro.Core.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace BePro.Infrastructure.Data.Configurations;

public class InvoicePlacementConfiguration : IEntityTypeConfiguration<InvoicePlacement>
{
    public void Configure(EntityTypeBuilder<InvoicePlacement> builder)
    {
        builder.ToTable("invoice_placements");
        builder.HasKey(ip => ip.Id);

        builder.HasIndex(ip => new { ip.InvoiceId, ip.PlacementId }).IsUnique();

        builder.HasOne(ip => ip.Invoice)
            .WithMany(i => i.InvoicePlacements)
            .HasForeignKey(ip => ip.InvoiceId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(ip => ip.Placement)
            .WithMany()
            .HasForeignKey(ip => ip.PlacementId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
