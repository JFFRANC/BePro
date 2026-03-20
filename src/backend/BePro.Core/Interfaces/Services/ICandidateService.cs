using BePro.Core.DTOs.Candidates;
using BePro.Core.Enums;

namespace BePro.Core.Interfaces.Services;

public interface ICandidateService
{
    Task<CandidateDto?> GetByIdAsync(Guid id);
    Task<List<CandidateDto>> GetByClientIdAsync(Guid clientId, Guid currentUserId, UserRole currentUserRole);
    Task<List<CandidateDto>> GetMyAsync(Guid recruiterId);
    Task<CandidateDto> CreateAsync(CreateCandidateRequest request, Guid recruiterId);
    Task<CandidateDto> UpdateStatusAsync(Guid id, UpdateCandidateStatusRequest request);
}
