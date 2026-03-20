using System.ComponentModel.DataAnnotations;

namespace BePro.Core.DTOs.Clients;

public class CreateClientRequest
{
    [Required, MaxLength(200)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(500)]
    public string? ContactInfo { get; set; }

    [MaxLength(500)]
    public string? Address { get; set; }

    public ClientFormConfigDto? FormConfig { get; set; }
}
