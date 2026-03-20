using BePro.Core.Entities;

namespace BePro.Core.Interfaces.Repositories;

public interface IClientAssignmentRepository
{
    Task<List<ClientAssignment>> GetByClientIdAsync(Guid clientId);
    Task<List<ClientAssignment>> GetByUserIdAsync(Guid userId);
    Task<ClientAssignment?> GetByClientAndUserAsync(Guid clientId, Guid userId);
    Task<ClientAssignment> AddAsync(ClientAssignment assignment);
    Task RemoveAsync(ClientAssignment assignment);
}
