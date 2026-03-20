using BePro.Core.Entities;
using BePro.Core.Interfaces.Repositories;
using BePro.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace BePro.Infrastructure.Repositories;

public class CandidateRepository : ICandidateRepository
{
    private readonly BeProDbContext _context;

    public CandidateRepository(BeProDbContext context)
    {
        _context = context;
    }

    public async Task<Candidate?> GetByIdAsync(Guid id)
    {
        return await _context.Candidates
            .Include(c => c.Recruiter)
            .Include(c => c.Leader)
            .Include(c => c.Client)
            .Include(c => c.Placement)
            .FirstOrDefaultAsync(c => c.Id == id);
    }

    public async Task<List<Candidate>> GetByClientIdAsync(Guid clientId)
    {
        return await _context.Candidates
            .AsNoTracking()
            .Include(c => c.Recruiter)
            .Include(c => c.Leader)
            .Where(c => c.ClientId == clientId)
            .OrderByDescending(c => c.CreatedAt)
            .ToListAsync();
    }

    public async Task<List<Candidate>> GetByRecruiterIdAsync(Guid recruiterId)
    {
        return await _context.Candidates
            .AsNoTracking()
            .Include(c => c.Client)
            .Include(c => c.Leader)
            .Where(c => c.RecruiterId == recruiterId)
            .OrderByDescending(c => c.CreatedAt)
            .ToListAsync();
    }

    public async Task<List<Candidate>> GetByLeaderIdAsync(Guid leaderId)
    {
        return await _context.Candidates
            .AsNoTracking()
            .Include(c => c.Recruiter)
            .Include(c => c.Client)
            .Where(c => c.LeaderId == leaderId)
            .OrderByDescending(c => c.CreatedAt)
            .ToListAsync();
    }

    public async Task<Candidate> AddAsync(Candidate candidate)
    {
        await _context.Candidates.AddAsync(candidate);
        await _context.SaveChangesAsync();
        return candidate;
    }

    public async Task UpdateAsync(Candidate candidate)
    {
        _context.Candidates.Update(candidate);
        await _context.SaveChangesAsync();
    }
}
