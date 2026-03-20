using BePro.Core.Entities.Base;
using BePro.Core.Enums;

namespace BePro.Core.Entities;

public class Placement : BaseEntity
{
    public Guid CandidateId { get; set; }
    public Candidate Candidate { get; set; } = null!;

    public DateTime HireDate { get; set; }
    public DateTime? GuaranteeEndDate { get; set; }
    public bool? GuaranteeMet { get; set; }
    public DateTime? TerminationDate { get; set; }

    public PaymentStatus FreelancerPaymentStatus { get; set; } = PaymentStatus.Pending;
    public DateTime? FreelancerPaymentDate { get; set; }
}
