using BePro.Core.Enums;

namespace BePro.Core.DTOs.Candidates;

public class CandidateDto
{
    public Guid Id { get; set; }
    public string FullName { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public DateTime InterviewDate { get; set; }
    public TimeOnly? InterviewTime { get; set; }
    public string? Position { get; set; }
    public string? Municipality { get; set; }
    public int? Age { get; set; }
    public string? Shift { get; set; }
    public string? Plant { get; set; }
    public string? InterviewPoint { get; set; }
    public string? Comments { get; set; }
    public bool Attended { get; set; }
    public CandidateStatus Status { get; set; }
    public RejectionCategory? RejectionCategory { get; set; }
    public string? RejectionDetails { get; set; }

    public Guid RecruiterId { get; set; }
    public string RecruiterFullName { get; set; } = string.Empty;
    public Guid LeaderId { get; set; }
    public string LeaderFullName { get; set; } = string.Empty;
    public Guid ClientId { get; set; }
    public string ClientName { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; }
}
