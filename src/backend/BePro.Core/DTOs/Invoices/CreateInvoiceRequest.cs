using System.ComponentModel.DataAnnotations;

namespace BePro.Core.DTOs.Invoices;

public class CreateInvoiceRequest
{
    [Required, MaxLength(50)]
    public string InvoiceNumber { get; set; } = string.Empty;

    [Required]
    public Guid ClientId { get; set; }

    [Required]
    public decimal Amount { get; set; }

    [Required]
    public decimal Tax { get; set; }

    [Required]
    public DateTime IssueDate { get; set; }

    public List<Guid> PlacementIds { get; set; } = new();
}
