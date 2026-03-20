namespace BePro.Core.DTOs.Clients;

public class ClientDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? ContactInfo { get; set; }
    public string? Address { get; set; }
    public bool IsActive { get; set; }
    public ClientFormConfigDto FormConfig { get; set; } = null!;
}
