using BePro.API.Extensions;
using BePro.Core.DTOs.Candidates;
using BePro.Core.DTOs.Common;
using BePro.Core.Enums;
using BePro.Core.Interfaces.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BePro.API.Controllers;

[ApiController]
[Route("api/v1/[controller]")]
[Authorize]
public class CandidatesController : ControllerBase
{
    private readonly ICandidateService _candidateService;

    public CandidatesController(ICandidateService candidateService)
    {
        _candidateService = candidateService;
    }

    [HttpGet("client/{clientId:guid}")]
    public async Task<ActionResult<ApiResponse<List<CandidateDto>>>> GetByClient(Guid clientId)
    {
        var userId = User.GetUserId();
        var role = Enum.Parse<UserRole>(User.GetRole().Replace("_", ""), true);
        var candidates = await _candidateService.GetByClientIdAsync(clientId, userId, role);
        return Ok(ApiResponse<List<CandidateDto>>.Ok(candidates));
    }

    [HttpGet("my")]
    public async Task<ActionResult<ApiResponse<List<CandidateDto>>>> GetMy()
    {
        var userId = User.GetUserId();
        var candidates = await _candidateService.GetMyAsync(userId);
        return Ok(ApiResponse<List<CandidateDto>>.Ok(candidates));
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ApiResponse<CandidateDto>>> GetById(Guid id)
    {
        var candidate = await _candidateService.GetByIdAsync(id);
        if (candidate == null)
            return NotFound(ApiResponse<CandidateDto>.Fail("Candidato no encontrado."));

        return Ok(ApiResponse<CandidateDto>.Ok(candidate));
    }

    [HttpPost]
    public async Task<ActionResult<ApiResponse<CandidateDto>>> Create([FromBody] CreateCandidateRequest request)
    {
        var recruiterId = User.GetUserId();
        var candidate = await _candidateService.CreateAsync(request, recruiterId);
        return CreatedAtAction(nameof(GetById), new { id = candidate.Id }, ApiResponse<CandidateDto>.Ok(candidate, "Candidato registrado exitosamente."));
    }

    [HttpPatch("{id:guid}/status")]
    [Authorize(Roles = "admin,manager,account_executive")]
    public async Task<ActionResult<ApiResponse<CandidateDto>>> UpdateStatus(Guid id, [FromBody] UpdateCandidateStatusRequest request)
    {
        var candidate = await _candidateService.UpdateStatusAsync(id, request);
        return Ok(ApiResponse<CandidateDto>.Ok(candidate, "Estado actualizado exitosamente."));
    }
}
