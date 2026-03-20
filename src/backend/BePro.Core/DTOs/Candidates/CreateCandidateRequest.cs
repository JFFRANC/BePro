using System.ComponentModel.DataAnnotations;

namespace BePro.Core.DTOs.Candidates;

public class CreateCandidateRequest
{
    [Required, MaxLength(200)]
    public string FullName { get; set; } = string.Empty;

    [Required, MaxLength(20)]
    public string Phone { get; set; } = string.Empty;

    [Required]
    public DateTime InterviewDate { get; set; }

    [Required]
    public Guid ClientId { get; set; }

    public TimeOnly? InterviewTime { get; set; }

    [MaxLength(200)]
    public string? Position { get; set; }

    [MaxLength(200)]
    public string? Municipality { get; set; }

    public int? Age { get; set; }

    [MaxLength(100)]
    public string? Shift { get; set; }

    [MaxLength(200)]
    public string? Plant { get; set; }

    [MaxLength(200)]
    public string? InterviewPoint { get; set; }

    [MaxLength(1000)]
    public string? Comments { get; set; }
}
