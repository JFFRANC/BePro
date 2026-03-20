using BePro.Core.DTOs.Clients;
using BePro.Core.Entities;
using BePro.Core.Enums;
using BePro.Core.Interfaces.Repositories;
using BePro.Core.Interfaces.Services;

namespace BePro.Infrastructure.Services;

public class ClientService : IClientService
{
    private readonly IClientRepository _clientRepo;
    private readonly IClientAssignmentRepository _assignmentRepo;
    private readonly IUserRepository _userRepo;

    public ClientService(
        IClientRepository clientRepo,
        IClientAssignmentRepository assignmentRepo,
        IUserRepository userRepo)
    {
        _clientRepo = clientRepo;
        _assignmentRepo = assignmentRepo;
        _userRepo = userRepo;
    }

    public async Task<ClientDto?> GetByIdAsync(Guid id)
    {
        var client = await _clientRepo.GetByIdAsync(id);
        return client == null ? null : MapToDto(client);
    }

    public async Task<List<ClientDto>> GetAllAsync(Guid? userId = null, UserRole? role = null)
    {
        List<Client> clients;

        if (role == UserRole.Admin || role == UserRole.Manager)
            clients = await _clientRepo.GetAllAsync();
        else if (userId.HasValue)
            clients = await _clientRepo.GetByUserIdAsync(userId.Value);
        else
            clients = await _clientRepo.GetAllAsync();

        return clients.Select(MapToDto).ToList();
    }

    public async Task<ClientDto> CreateAsync(CreateClientRequest request)
    {
        var client = new Client
        {
            Name = request.Name,
            ContactInfo = request.ContactInfo,
            Address = request.Address,
            FormConfig = new ClientFormConfig
            {
                ShowInterviewTime = request.FormConfig?.ShowInterviewTime ?? false,
                ShowPosition = request.FormConfig?.ShowPosition ?? false,
                ShowMunicipality = request.FormConfig?.ShowMunicipality ?? false,
                ShowAge = request.FormConfig?.ShowAge ?? false,
                ShowShift = request.FormConfig?.ShowShift ?? false,
                ShowPlant = request.FormConfig?.ShowPlant ?? false,
                ShowInterviewPoint = request.FormConfig?.ShowInterviewPoint ?? false,
                ShowComments = request.FormConfig?.ShowComments ?? false,
            }
        };

        await _clientRepo.AddAsync(client);
        return MapToDto(client);
    }

    public async Task<ClientDto> UpdateAsync(Guid id, UpdateClientRequest request)
    {
        var client = await _clientRepo.GetByIdWithConfigAsync(id)
            ?? throw new KeyNotFoundException("Cliente no encontrado.");

        if (request.Name != null) client.Name = request.Name;
        if (request.ContactInfo != null) client.ContactInfo = request.ContactInfo;
        if (request.Address != null) client.Address = request.Address;
        if (request.IsActive.HasValue) client.IsActive = request.IsActive.Value;

        if (request.FormConfig != null)
        {
            client.FormConfig.ShowInterviewTime = request.FormConfig.ShowInterviewTime;
            client.FormConfig.ShowPosition = request.FormConfig.ShowPosition;
            client.FormConfig.ShowMunicipality = request.FormConfig.ShowMunicipality;
            client.FormConfig.ShowAge = request.FormConfig.ShowAge;
            client.FormConfig.ShowShift = request.FormConfig.ShowShift;
            client.FormConfig.ShowPlant = request.FormConfig.ShowPlant;
            client.FormConfig.ShowInterviewPoint = request.FormConfig.ShowInterviewPoint;
            client.FormConfig.ShowComments = request.FormConfig.ShowComments;
        }

        await _clientRepo.UpdateAsync(client);
        return MapToDto(client);
    }

    public async Task<List<ClientAssignmentDto>> GetAssignmentsAsync(Guid clientId)
    {
        var assignments = await _assignmentRepo.GetByClientIdAsync(clientId);
        return assignments.Select(MapAssignmentToDto).ToList();
    }

    public async Task<ClientAssignmentDto> AssignUserAsync(Guid clientId, AssignUserToClientRequest request)
    {
        var existing = await _assignmentRepo.GetByClientAndUserAsync(clientId, request.UserId);
        if (existing != null)
            throw new InvalidOperationException("El usuario ya está asignado a este cliente.");

        var user = await _userRepo.GetByIdAsync(request.UserId)
            ?? throw new KeyNotFoundException("Usuario no encontrado.");

        var assignment = new ClientAssignment
        {
            ClientId = clientId,
            UserId = request.UserId,
            LeaderId = request.LeaderId
        };

        await _assignmentRepo.AddAsync(assignment);

        assignment.User = user;
        if (request.LeaderId.HasValue)
        {
            assignment.Leader = await _userRepo.GetByIdAsync(request.LeaderId.Value);
        }

        return MapAssignmentToDto(assignment);
    }

    public async Task RemoveAssignmentAsync(Guid clientId, Guid userId)
    {
        var assignment = await _assignmentRepo.GetByClientAndUserAsync(clientId, userId)
            ?? throw new KeyNotFoundException("Asignación no encontrada.");

        await _assignmentRepo.RemoveAsync(assignment);
    }

    private static ClientDto MapToDto(Client client) => new()
    {
        Id = client.Id,
        Name = client.Name,
        ContactInfo = client.ContactInfo,
        Address = client.Address,
        IsActive = client.IsActive,
        FormConfig = new ClientFormConfigDto
        {
            ShowInterviewTime = client.FormConfig.ShowInterviewTime,
            ShowPosition = client.FormConfig.ShowPosition,
            ShowMunicipality = client.FormConfig.ShowMunicipality,
            ShowAge = client.FormConfig.ShowAge,
            ShowShift = client.FormConfig.ShowShift,
            ShowPlant = client.FormConfig.ShowPlant,
            ShowInterviewPoint = client.FormConfig.ShowInterviewPoint,
            ShowComments = client.FormConfig.ShowComments,
        }
    };

    private static ClientAssignmentDto MapAssignmentToDto(ClientAssignment ca) => new()
    {
        Id = ca.Id,
        ClientId = ca.ClientId,
        ClientName = ca.Client?.Name ?? string.Empty,
        UserId = ca.UserId,
        UserFullName = ca.User != null ? $"{ca.User.FirstName} {ca.User.LastName}" : string.Empty,
        UserRole = ca.User?.Role ?? UserRole.Recruiter,
        LeaderId = ca.LeaderId,
        LeaderFullName = ca.Leader != null ? $"{ca.Leader.FirstName} {ca.Leader.LastName}" : null,
    };
}
