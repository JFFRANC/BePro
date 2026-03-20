using BePro.Core.DTOs.Clients;
using BePro.Core.Enums;

namespace BePro.Core.Interfaces.Services;

public interface IClientService
{
    Task<ClientDto?> GetByIdAsync(Guid id);
    Task<List<ClientDto>> GetAllAsync(Guid? userId = null, UserRole? role = null);
    Task<ClientDto> CreateAsync(CreateClientRequest request);
    Task<ClientDto> UpdateAsync(Guid id, UpdateClientRequest request);
    Task<List<ClientAssignmentDto>> GetAssignmentsAsync(Guid clientId);
    Task<ClientAssignmentDto> AssignUserAsync(Guid clientId, AssignUserToClientRequest request);
    Task RemoveAssignmentAsync(Guid clientId, Guid userId);
}
