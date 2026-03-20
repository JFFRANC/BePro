namespace BePro.Core.DTOs.Clients;

public class UpdateClientRequest
{
    public string? Name { get; set; }
    public string? ContactInfo { get; set; }
    public string? Address { get; set; }
    public bool? IsActive { get; set; }
    public ClientFormConfigDto? FormConfig { get; set; }
}
