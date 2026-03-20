using BePro.Core.DTOs.Placements;
using BePro.Core.Entities;
using BePro.Core.Enums;
using BePro.Core.Interfaces.Repositories;
using BePro.Core.Interfaces.Services;

namespace BePro.Infrastructure.Services;

public class PlacementService : IPlacementService
{
    private readonly IPlacementRepository _placementRepo;
    private readonly ICandidateRepository _candidateRepo;

    public PlacementService(
        IPlacementRepository placementRepo,
        ICandidateRepository candidateRepo)
    {
        _placementRepo = placementRepo;
        _candidateRepo = candidateRepo;
    }

    public async Task<PlacementDto?> GetByIdAsync(Guid id)
    {
        var placement = await _placementRepo.GetByIdAsync(id);
        return placement == null ? null : MapToDto(placement);
    }

    public async Task<List<PlacementDto>> GetByClientIdAsync(Guid clientId)
    {
        var placements = await _placementRepo.GetByClientIdAsync(clientId);
        return placements.Select(MapToDto).ToList();
    }

    public async Task<PlacementDto> CreateAsync(CreatePlacementRequest request)
    {
        var candidate = await _candidateRepo.GetByIdAsync(request.CandidateId)
            ?? throw new KeyNotFoundException("Candidato no encontrado.");

        if (candidate.Status != CandidateStatus.Approved)
            throw new InvalidOperationException("Solo candidatos aprobados pueden ser colocados.");

        var existing = await _placementRepo.GetByCandidateIdAsync(request.CandidateId);
        if (existing != null)
            throw new InvalidOperationException("El candidato ya tiene una colocación.");

        var placement = new Placement
        {
            CandidateId = request.CandidateId,
            HireDate = request.HireDate,
            GuaranteeEndDate = request.GuaranteeEndDate
        };

        await _placementRepo.AddAsync(placement);

        candidate.Status = CandidateStatus.Hired;
        await _candidateRepo.UpdateAsync(candidate);

        placement.Candidate = candidate;
        return MapToDto(placement);
    }

    public async Task<PlacementDto> UpdateAsync(Guid id, PlacementDto dto)
    {
        var placement = await _placementRepo.GetByIdAsync(id)
            ?? throw new KeyNotFoundException("Colocación no encontrada.");

        if (dto.GuaranteeEndDate.HasValue) placement.GuaranteeEndDate = dto.GuaranteeEndDate;
        if (dto.GuaranteeMet.HasValue) placement.GuaranteeMet = dto.GuaranteeMet;
        if (dto.TerminationDate.HasValue) placement.TerminationDate = dto.TerminationDate;
        if (dto.FreelancerPaymentDate.HasValue) placement.FreelancerPaymentDate = dto.FreelancerPaymentDate;
        placement.FreelancerPaymentStatus = dto.FreelancerPaymentStatus;

        if (dto.GuaranteeMet == true)
            placement.Candidate.Status = CandidateStatus.GuaranteeMet;
        else if (dto.GuaranteeMet == false)
            placement.Candidate.Status = CandidateStatus.GuaranteeFailed;

        await _placementRepo.UpdateAsync(placement);
        return MapToDto(placement);
    }

    private static PlacementDto MapToDto(Placement p) => new()
    {
        Id = p.Id,
        CandidateId = p.CandidateId,
        CandidateFullName = p.Candidate?.FullName ?? string.Empty,
        HireDate = p.HireDate,
        GuaranteeEndDate = p.GuaranteeEndDate,
        GuaranteeMet = p.GuaranteeMet,
        TerminationDate = p.TerminationDate,
        FreelancerPaymentStatus = p.FreelancerPaymentStatus,
        FreelancerPaymentDate = p.FreelancerPaymentDate
    };
}
