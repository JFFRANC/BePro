using BePro.Core.Interfaces.Repositories;
using BePro.Core.Interfaces.Services;
using BePro.Infrastructure.Data;
using BePro.Infrastructure.Repositories;
using BePro.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace BePro.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddDbContext<BeProDbContext>(options =>
            options.UseNpgsql(configuration.GetConnectionString("DefaultConnection"))
                   .UseSnakeCaseNamingConvention());

        services.AddScoped<IUserRepository, UserRepository>();
        services.AddScoped<IRefreshTokenRepository, RefreshTokenRepository>();
        services.AddScoped<IClientRepository, ClientRepository>();
        services.AddScoped<IClientAssignmentRepository, ClientAssignmentRepository>();
        services.AddScoped<ICandidateRepository, CandidateRepository>();
        services.AddScoped<IPlacementRepository, PlacementRepository>();
        services.AddScoped<IInvoiceRepository, InvoiceRepository>();

        services.AddScoped<IPasswordService, PasswordService>();
        services.AddScoped<ITokenService, TokenService>();
        services.AddScoped<IAuthService, AuthService>();
        services.AddScoped<IUserService, UserService>();
        services.AddScoped<IClientService, ClientService>();
        services.AddScoped<ICandidateService, CandidateService>();
        services.AddScoped<IPlacementService, PlacementService>();

        return services;
    }
}
