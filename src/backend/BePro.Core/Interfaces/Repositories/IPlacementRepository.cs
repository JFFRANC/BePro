using BePro.Core.Entities;

namespace BePro.Core.Interfaces.Repositories;

public interface IPlacementRepository
{
    Task<Placement?> GetByIdAsync(Guid id);
    Task<Placement?> GetByCandidateIdAsync(Guid candidateId);
    Task<List<Placement>> GetByClientIdAsync(Guid clientId);
    Task<Placement> AddAsync(Placement placement);
    Task UpdateAsync(Placement placement);
}
