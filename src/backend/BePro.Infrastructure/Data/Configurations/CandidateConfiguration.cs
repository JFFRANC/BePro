using BePro.Core.Entities;
using BePro.Core.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace BePro.Infrastructure.Data.Configurations;

public class CandidateConfiguration : IEntityTypeConfiguration<Candidate>
{
    public void Configure(EntityTypeBuilder<Candidate> builder)
    {
        builder.ToTable("candidates");
        builder.HasKey(c => c.Id);

        builder.Property(c => c.FullName).HasMaxLength(200).IsRequired();
        builder.Property(c => c.Phone).HasMaxLength(20).IsRequired();
        builder.Property(c => c.Position).HasMaxLength(200);
        builder.Property(c => c.Municipality).HasMaxLength(200);
        builder.Property(c => c.Shift).HasMaxLength(100);
        builder.Property(c => c.Plant).HasMaxLength(200);
        builder.Property(c => c.InterviewPoint).HasMaxLength(200);
        builder.Property(c => c.Comments).HasMaxLength(1000);
        builder.Property(c => c.RejectionDetails).HasMaxLength(500);

        builder.Property(c => c.Status)
            .HasConversion(
                v => ConvertStatusToString(v),
                v => ConvertStringToStatus(v))
            .HasMaxLength(30)
            .IsRequired();

        builder.Property(c => c.RejectionCategory)
            .HasConversion(
                v => v == null ? null : v.ToString()!.ToLower(),
                v => v == null ? null : Enum.Parse<RejectionCategory>(v, true))
            .HasMaxLength(30);

        builder.HasIndex(c => new { c.ClientId, c.Status });
        builder.HasIndex(c => c.RecruiterId);

        builder.HasOne(c => c.Recruiter)
            .WithMany(u => u.RecruitedCandidates)
            .HasForeignKey(c => c.RecruiterId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(c => c.Leader)
            .WithMany(u => u.LedCandidates)
            .HasForeignKey(c => c.LeaderId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(c => c.Client)
            .WithMany(cl => cl.Candidates)
            .HasForeignKey(c => c.ClientId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(c => c.Placement)
            .WithOne(p => p.Candidate)
            .HasForeignKey<Placement>(p => p.CandidateId)
            .OnDelete(DeleteBehavior.Cascade);
    }

    private static string ConvertStatusToString(CandidateStatus status) => status switch
    {
        CandidateStatus.Registered => "registered",
        CandidateStatus.InterviewScheduled => "interview_scheduled",
        CandidateStatus.Attended => "attended",
        CandidateStatus.NoShow => "no_show",
        CandidateStatus.Pending => "pending",
        CandidateStatus.Approved => "approved",
        CandidateStatus.Rejected => "rejected",
        CandidateStatus.Declined => "declined",
        CandidateStatus.Discarded => "discarded",
        CandidateStatus.Hired => "hired",
        CandidateStatus.InGuarantee => "in_guarantee",
        CandidateStatus.GuaranteeMet => "guarantee_met",
        CandidateStatus.GuaranteeFailed => "guarantee_failed",
        CandidateStatus.Replacement => "replacement",
        _ => status.ToString().ToLower()
    };

    private static CandidateStatus ConvertStringToStatus(string value) => value switch
    {
        "registered" => CandidateStatus.Registered,
        "interview_scheduled" => CandidateStatus.InterviewScheduled,
        "attended" => CandidateStatus.Attended,
        "no_show" => CandidateStatus.NoShow,
        "pending" => CandidateStatus.Pending,
        "approved" => CandidateStatus.Approved,
        "rejected" => CandidateStatus.Rejected,
        "declined" => CandidateStatus.Declined,
        "discarded" => CandidateStatus.Discarded,
        "hired" => CandidateStatus.Hired,
        "in_guarantee" => CandidateStatus.InGuarantee,
        "guarantee_met" => CandidateStatus.GuaranteeMet,
        "guarantee_failed" => CandidateStatus.GuaranteeFailed,
        "replacement" => CandidateStatus.Replacement,
        _ => Enum.Parse<CandidateStatus>(value, true)
    };
}
