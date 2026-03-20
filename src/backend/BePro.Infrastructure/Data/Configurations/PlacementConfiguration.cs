using BePro.Core.Entities;
using BePro.Core.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace BePro.Infrastructure.Data.Configurations;

public class PlacementConfiguration : IEntityTypeConfiguration<Placement>
{
    public void Configure(EntityTypeBuilder<Placement> builder)
    {
        builder.ToTable("placements");
        builder.HasKey(p => p.Id);

        builder.HasIndex(p => p.CandidateId).IsUnique();

        builder.Property(p => p.FreelancerPaymentStatus)
            .HasConversion(
                v => v.ToString().ToLower(),
                v => Enum.Parse<PaymentStatus>(v, true))
            .HasMaxLength(20)
            .IsRequired();
    }
}
