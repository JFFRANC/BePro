using BePro.Core.Entities.Base;

namespace BePro.Core.Entities;

public class ClientAssignment : BaseEntity
{
    public Guid ClientId { get; set; }
    public Client Client { get; set; } = null!;

    public Guid UserId { get; set; }
    public User User { get; set; } = null!;

    public Guid? LeaderId { get; set; }
    public User? Leader { get; set; }
}
