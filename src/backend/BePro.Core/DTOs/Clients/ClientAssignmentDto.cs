using BePro.Core.Enums;

namespace BePro.Core.DTOs.Clients;

public class ClientAssignmentDto
{
    public Guid Id { get; set; }
    public Guid ClientId { get; set; }
    public string ClientName { get; set; } = string.Empty;
    public Guid UserId { get; set; }
    public string UserFullName { get; set; } = string.Empty;
    public UserRole UserRole { get; set; }
    public Guid? LeaderId { get; set; }
    public string? LeaderFullName { get; set; }
}
