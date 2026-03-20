using BePro.Core.DTOs.Placements;

namespace BePro.Core.Interfaces.Services;

public interface IPlacementService
{
    Task<PlacementDto?> GetByIdAsync(Guid id);
    Task<List<PlacementDto>> GetByClientIdAsync(Guid clientId);
    Task<PlacementDto> CreateAsync(CreatePlacementRequest request);
    Task<PlacementDto> UpdateAsync(Guid id, PlacementDto dto);
}
