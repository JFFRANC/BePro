using BePro.Core.Entities;
using BePro.Core.Interfaces.Repositories;
using BePro.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace BePro.Infrastructure.Repositories;

public class PlacementRepository : IPlacementRepository
{
    private readonly BeProDbContext _context;

    public PlacementRepository(BeProDbContext context)
    {
        _context = context;
    }

    public async Task<Placement?> GetByIdAsync(Guid id)
    {
        return await _context.Placements
            .Include(p => p.Candidate)
            .FirstOrDefaultAsync(p => p.Id == id);
    }

    public async Task<Placement?> GetByCandidateIdAsync(Guid candidateId)
    {
        return await _context.Placements
            .Include(p => p.Candidate)
            .FirstOrDefaultAsync(p => p.CandidateId == candidateId);
    }

    public async Task<List<Placement>> GetByClientIdAsync(Guid clientId)
    {
        return await _context.Placements
            .AsNoTracking()
            .Include(p => p.Candidate)
            .Where(p => p.Candidate.ClientId == clientId)
            .OrderByDescending(p => p.HireDate)
            .ToListAsync();
    }

    public async Task<Placement> AddAsync(Placement placement)
    {
        await _context.Placements.AddAsync(placement);
        await _context.SaveChangesAsync();
        return placement;
    }

    public async Task UpdateAsync(Placement placement)
    {
        _context.Placements.Update(placement);
        await _context.SaveChangesAsync();
    }
}
