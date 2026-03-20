using BePro.Core.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace BePro.Infrastructure.Data.Configurations;

public class ClientConfiguration : IEntityTypeConfiguration<Client>
{
    public void Configure(EntityTypeBuilder<Client> builder)
    {
        builder.ToTable("clients");
        builder.HasKey(c => c.Id);

        builder.Property(c => c.Name).HasMaxLength(200).IsRequired();
        builder.Property(c => c.ContactInfo).HasMaxLength(500);
        builder.Property(c => c.Address).HasMaxLength(500);

        builder.HasOne(c => c.FormConfig)
            .WithOne(fc => fc.Client)
            .HasForeignKey<ClientFormConfig>(fc => fc.ClientId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
