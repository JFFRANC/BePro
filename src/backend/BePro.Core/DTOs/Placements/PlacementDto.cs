using BePro.Core.Enums;

namespace BePro.Core.DTOs.Placements;

public class PlacementDto
{
    public Guid Id { get; set; }
    public Guid CandidateId { get; set; }
    public string CandidateFullName { get; set; } = string.Empty;
    public DateTime HireDate { get; set; }
    public DateTime? GuaranteeEndDate { get; set; }
    public bool? GuaranteeMet { get; set; }
    public DateTime? TerminationDate { get; set; }
    public PaymentStatus FreelancerPaymentStatus { get; set; }
    public DateTime? FreelancerPaymentDate { get; set; }
}
