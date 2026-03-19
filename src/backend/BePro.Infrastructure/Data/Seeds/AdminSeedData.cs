using BePro.Core.Entities;
using BePro.Core.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace BePro.Infrastructure.Data.Seeds;

public class AdminSeedData : IEntityTypeConfiguration<User>
{
    public void Configure(EntityTypeBuilder<User> builder)
    {
        // Password: Admin123!
        // Pre-computed BCrypt hash
        var adminId = Guid.Parse("a1b2c3d4-e5f6-7890-abcd-ef1234567890");

        builder.HasData(new User
        {
            Id = adminId,
            Email = "admin@bepro.com",
            // Hash pre-computado de "Admin123!"
            PasswordHash = "$2a$11$SEXXFVhuj21MwybRNKPHMO6cTApwxyAyoagArHGSYq4ON.5t7J6Qa",
            FirstName = "Admin",
            LastName = "BePro",
            Role = UserRole.Admin,
            IsActive = true,
            CreatedAt = new DateTime(2026, 3, 18, 0, 0, 0, DateTimeKind.Utc),
            UpdatedAt = new DateTime(2026, 3, 18, 0, 0, 0, DateTimeKind.Utc)
        });
    }
}
