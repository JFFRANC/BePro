using BePro.Core.Enums;

namespace BePro.Core.DTOs.Invoices;

public class InvoiceDto
{
    public Guid Id { get; set; }
    public string InvoiceNumber { get; set; } = string.Empty;
    public Guid ClientId { get; set; }
    public string ClientName { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    public decimal Tax { get; set; }
    public decimal Total { get; set; }
    public DateTime IssueDate { get; set; }
    public DateTime? PaymentDate { get; set; }
    public PaymentStatus PaymentStatus { get; set; }
}
