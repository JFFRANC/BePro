using BePro.Core.Entities;

namespace BePro.Core.Interfaces.Repositories;

public interface IRefreshTokenRepository
{
    Task<RefreshToken?> GetByTokenAsync(string token);
    Task AddAsync(RefreshToken refreshToken);
    Task RevokeAsync(RefreshToken refreshToken, string? replacedByToken = null);
    Task RevokeAllByUserIdAsync(Guid userId);
}
