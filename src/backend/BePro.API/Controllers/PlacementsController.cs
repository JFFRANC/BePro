using BePro.Core.DTOs.Common;
using BePro.Core.DTOs.Placements;
using BePro.Core.Interfaces.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BePro.API.Controllers;

[ApiController]
[Route("api/v1/[controller]")]
[Authorize]
public class PlacementsController : ControllerBase
{
    private readonly IPlacementService _placementService;

    public PlacementsController(IPlacementService placementService)
    {
        _placementService = placementService;
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ApiResponse<PlacementDto>>> GetById(Guid id)
    {
        var placement = await _placementService.GetByIdAsync(id);
        if (placement == null)
            return NotFound(ApiResponse<PlacementDto>.Fail("Colocación no encontrada."));

        return Ok(ApiResponse<PlacementDto>.Ok(placement));
    }

    [HttpGet("client/{clientId:guid}")]
    [Authorize(Roles = "admin,manager,account_executive")]
    public async Task<ActionResult<ApiResponse<List<PlacementDto>>>> GetByClient(Guid clientId)
    {
        var placements = await _placementService.GetByClientIdAsync(clientId);
        return Ok(ApiResponse<List<PlacementDto>>.Ok(placements));
    }

    [HttpPost]
    [Authorize(Roles = "admin,manager,account_executive")]
    public async Task<ActionResult<ApiResponse<PlacementDto>>> Create([FromBody] CreatePlacementRequest request)
    {
        var placement = await _placementService.CreateAsync(request);
        return CreatedAtAction(nameof(GetById), new { id = placement.Id }, ApiResponse<PlacementDto>.Ok(placement, "Colocación creada exitosamente."));
    }

    [HttpPut("{id:guid}")]
    [Authorize(Roles = "admin,manager")]
    public async Task<ActionResult<ApiResponse<PlacementDto>>> Update(Guid id, [FromBody] PlacementDto dto)
    {
        var placement = await _placementService.UpdateAsync(id, dto);
        return Ok(ApiResponse<PlacementDto>.Ok(placement, "Colocación actualizada exitosamente."));
    }
}
