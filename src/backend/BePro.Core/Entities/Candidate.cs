using BePro.Core.Entities.Base;
using BePro.Core.Enums;

namespace BePro.Core.Entities;

public class Candidate : BaseEntity
{
    public string FullName { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public DateTime InterviewDate { get; set; }

    public Guid RecruiterId { get; set; }
    public User Recruiter { get; set; } = null!;

    public Guid LeaderId { get; set; }
    public User Leader { get; set; } = null!;

    public Guid ClientId { get; set; }
    public Client Client { get; set; } = null!;

    public TimeOnly? InterviewTime { get; set; }
    public string? Position { get; set; }
    public string? Municipality { get; set; }
    public int? Age { get; set; }
    public string? Shift { get; set; }
    public string? Plant { get; set; }
    public string? InterviewPoint { get; set; }
    public string? Comments { get; set; }

    public bool Attended { get; set; }
    public CandidateStatus Status { get; set; } = CandidateStatus.Registered;
    public RejectionCategory? RejectionCategory { get; set; }
    public string? RejectionDetails { get; set; }

    public Placement? Placement { get; set; }
}
