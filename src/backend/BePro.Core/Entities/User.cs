using BePro.Core.Entities.Base;
using BePro.Core.Enums;

namespace BePro.Core.Entities;

public class User : BaseEntity
{
    public string Email { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public UserRole Role { get; set; }
    public bool IsFreelancer { get; set; }
    public DateTime? LastLoginAt { get; set; }

    public ICollection<RefreshToken> RefreshTokens { get; set; } = new List<RefreshToken>();
    public ICollection<ClientAssignment> ClientAssignments { get; set; } = new List<ClientAssignment>();
    public ICollection<Candidate> RecruitedCandidates { get; set; } = new List<Candidate>();
    public ICollection<Candidate> LedCandidates { get; set; } = new List<Candidate>();
}
