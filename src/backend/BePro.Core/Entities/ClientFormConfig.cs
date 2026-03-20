using BePro.Core.Entities.Base;

namespace BePro.Core.Entities;

public class ClientFormConfig : BaseEntity
{
    public Guid ClientId { get; set; }
    public Client Client { get; set; } = null!;

    public bool ShowInterviewTime { get; set; }
    public bool ShowPosition { get; set; }
    public bool ShowMunicipality { get; set; }
    public bool ShowAge { get; set; }
    public bool ShowShift { get; set; }
    public bool ShowPlant { get; set; }
    public bool ShowInterviewPoint { get; set; }
    public bool ShowComments { get; set; }
}
