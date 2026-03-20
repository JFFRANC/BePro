using BePro.Core.Entities.Base;

namespace BePro.Core.Entities;

public class Client : BaseEntity
{
    public string Name { get; set; } = string.Empty;
    public string? ContactInfo { get; set; }
    public string? Address { get; set; }

    public ClientFormConfig FormConfig { get; set; } = null!;
    public ICollection<ClientAssignment> Assignments { get; set; } = new List<ClientAssignment>();
    public ICollection<Candidate> Candidates { get; set; } = new List<Candidate>();
    public ICollection<Invoice> Invoices { get; set; } = new List<Invoice>();
}
