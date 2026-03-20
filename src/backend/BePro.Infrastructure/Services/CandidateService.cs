using BePro.Core.DTOs.Candidates;
using BePro.Core.Entities;
using BePro.Core.Enums;
using BePro.Core.Interfaces.Repositories;
using BePro.Core.Interfaces.Services;

namespace BePro.Infrastructure.Services;

public class CandidateService : ICandidateService
{
    private readonly ICandidateRepository _candidateRepo;
    private readonly IClientAssignmentRepository _assignmentRepo;

    public CandidateService(
        ICandidateRepository candidateRepo,
        IClientAssignmentRepository assignmentRepo)
    {
        _candidateRepo = candidateRepo;
        _assignmentRepo = assignmentRepo;
    }

    public async Task<CandidateDto?> GetByIdAsync(Guid id)
    {
        var candidate = await _candidateRepo.GetByIdAsync(id);
        return candidate == null ? null : MapToDto(candidate);
    }

    public async Task<List<CandidateDto>> GetByClientIdAsync(Guid clientId, Guid currentUserId, UserRole currentUserRole)
    {
        var candidates = await _candidateRepo.GetByClientIdAsync(clientId);

        if (currentUserRole == UserRole.Recruiter)
        {
            candidates = candidates.Where(c => c.RecruiterId == currentUserId).ToList();
        }
        else if (currentUserRole == UserRole.AccountExecutive)
        {
            candidates = candidates.Where(c => c.LeaderId == currentUserId).ToList();
        }

        return candidates.Select(MapToDto).ToList();
    }

    public async Task<List<CandidateDto>> GetMyAsync(Guid recruiterId)
    {
        var candidates = await _candidateRepo.GetByRecruiterIdAsync(recruiterId);
        return candidates.Select(MapToDto).ToList();
    }

    public async Task<CandidateDto> CreateAsync(CreateCandidateRequest request, Guid recruiterId)
    {
        var assignments = await _assignmentRepo.GetByUserIdAsync(recruiterId);
        var assignment = assignments.FirstOrDefault(a => a.ClientId == request.ClientId)
            ?? throw new InvalidOperationException("No tienes asignación para este cliente.");

        var leaderId = assignment.LeaderId ?? recruiterId;

        var candidate = new Candidate
        {
            FullName = request.FullName,
            Phone = request.Phone,
            InterviewDate = request.InterviewDate,
            InterviewTime = request.InterviewTime,
            Position = request.Position,
            Municipality = request.Municipality,
            Age = request.Age,
            Shift = request.Shift,
            Plant = request.Plant,
            InterviewPoint = request.InterviewPoint,
            Comments = request.Comments,
            RecruiterId = recruiterId,
            LeaderId = leaderId,
            ClientId = request.ClientId,
            Status = CandidateStatus.Registered
        };

        await _candidateRepo.AddAsync(candidate);

        var saved = await _candidateRepo.GetByIdAsync(candidate.Id);
        return MapToDto(saved!);
    }

    public async Task<CandidateDto> UpdateStatusAsync(Guid id, UpdateCandidateStatusRequest request)
    {
        var candidate = await _candidateRepo.GetByIdAsync(id)
            ?? throw new KeyNotFoundException("Candidato no encontrado.");

        candidate.Status = request.Status;

        if (request.Status == CandidateStatus.Attended)
            candidate.Attended = true;

        if (request.Status == CandidateStatus.Rejected)
        {
            candidate.RejectionCategory = request.RejectionCategory;
            candidate.RejectionDetails = request.RejectionDetails;
        }

        await _candidateRepo.UpdateAsync(candidate);
        return MapToDto(candidate);
    }

    private static CandidateDto MapToDto(Candidate c) => new()
    {
        Id = c.Id,
        FullName = c.FullName,
        Phone = c.Phone,
        InterviewDate = c.InterviewDate,
        InterviewTime = c.InterviewTime,
        Position = c.Position,
        Municipality = c.Municipality,
        Age = c.Age,
        Shift = c.Shift,
        Plant = c.Plant,
        InterviewPoint = c.InterviewPoint,
        Comments = c.Comments,
        Attended = c.Attended,
        Status = c.Status,
        RejectionCategory = c.RejectionCategory,
        RejectionDetails = c.RejectionDetails,
        RecruiterId = c.RecruiterId,
        RecruiterFullName = c.Recruiter != null ? $"{c.Recruiter.FirstName} {c.Recruiter.LastName}" : string.Empty,
        LeaderId = c.LeaderId,
        LeaderFullName = c.Leader != null ? $"{c.Leader.FirstName} {c.Leader.LastName}" : string.Empty,
        ClientId = c.ClientId,
        ClientName = c.Client?.Name ?? string.Empty,
        CreatedAt = c.CreatedAt
    };
}
