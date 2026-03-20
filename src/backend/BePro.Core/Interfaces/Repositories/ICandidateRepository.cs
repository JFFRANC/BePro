using BePro.Core.Entities;

namespace BePro.Core.Interfaces.Repositories;

public interface ICandidateRepository
{
    Task<Candidate?> GetByIdAsync(Guid id);
    Task<List<Candidate>> GetByClientIdAsync(Guid clientId);
    Task<List<Candidate>> GetByRecruiterIdAsync(Guid recruiterId);
    Task<List<Candidate>> GetByLeaderIdAsync(Guid leaderId);
    Task<Candidate> AddAsync(Candidate candidate);
    Task UpdateAsync(Candidate candidate);
}
