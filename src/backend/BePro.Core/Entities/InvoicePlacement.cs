using BePro.Core.Entities.Base;

namespace BePro.Core.Entities;

public class InvoicePlacement : BaseEntity
{
    public Guid InvoiceId { get; set; }
    public Invoice Invoice { get; set; } = null!;

    public Guid PlacementId { get; set; }
    public Placement Placement { get; set; } = null!;
}
