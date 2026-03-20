using BePro.Core.Entities.Base;
using BePro.Core.Enums;

namespace BePro.Core.Entities;

public class Invoice : BaseEntity
{
    public string InvoiceNumber { get; set; } = string.Empty;

    public Guid ClientId { get; set; }
    public Client Client { get; set; } = null!;

    public decimal Amount { get; set; }
    public decimal Tax { get; set; }
    public decimal Total { get; set; }

    public DateTime IssueDate { get; set; }
    public DateTime? PaymentDate { get; set; }
    public PaymentStatus PaymentStatus { get; set; } = PaymentStatus.Pending;

    public ICollection<InvoicePlacement> InvoicePlacements { get; set; } = new List<InvoicePlacement>();
}
