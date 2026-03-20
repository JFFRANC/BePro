using System.ComponentModel.DataAnnotations;
using BePro.Core.Enums;

namespace BePro.Core.DTOs.Candidates;

public class UpdateCandidateStatusRequest
{
    [Required]
    public CandidateStatus Status { get; set; }

    public RejectionCategory? RejectionCategory { get; set; }

    [MaxLength(500)]
    public string? RejectionDetails { get; set; }
}
