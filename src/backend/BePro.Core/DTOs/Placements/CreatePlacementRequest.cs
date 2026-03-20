using System.ComponentModel.DataAnnotations;

namespace BePro.Core.DTOs.Placements;

public class CreatePlacementRequest
{
    [Required]
    public Guid CandidateId { get; set; }

    [Required]
    public DateTime HireDate { get; set; }

    public DateTime? GuaranteeEndDate { get; set; }
}
