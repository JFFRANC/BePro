using BePro.Core.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace BePro.Infrastructure.Data.Configurations;

public class ClientAssignmentConfiguration : IEntityTypeConfiguration<ClientAssignment>
{
    public void Configure(EntityTypeBuilder<ClientAssignment> builder)
    {
        builder.ToTable("client_assignments");
        builder.HasKey(ca => ca.Id);

        builder.HasIndex(ca => new { ca.ClientId, ca.UserId }).IsUnique();

        builder.HasOne(ca => ca.Client)
            .WithMany(c => c.Assignments)
            .HasForeignKey(ca => ca.ClientId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(ca => ca.User)
            .WithMany(u => u.ClientAssignments)
            .HasForeignKey(ca => ca.UserId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(ca => ca.Leader)
            .WithMany()
            .HasForeignKey(ca => ca.LeaderId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
