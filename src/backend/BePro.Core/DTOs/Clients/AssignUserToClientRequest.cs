using System.ComponentModel.DataAnnotations;

namespace BePro.Core.DTOs.Clients;

public class AssignUserToClientRequest
{
    [Required]
    public Guid UserId { get; set; }

    public Guid? LeaderId { get; set; }
}
