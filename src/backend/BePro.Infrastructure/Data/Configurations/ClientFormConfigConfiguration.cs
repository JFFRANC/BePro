using BePro.Core.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace BePro.Infrastructure.Data.Configurations;

public class ClientFormConfigConfiguration : IEntityTypeConfiguration<ClientFormConfig>
{
    public void Configure(EntityTypeBuilder<ClientFormConfig> builder)
    {
        builder.ToTable("client_form_configs");
        builder.HasKey(fc => fc.Id);

        builder.HasIndex(fc => fc.ClientId).IsUnique();
    }
}
