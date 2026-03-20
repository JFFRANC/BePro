using BePro.Core.Entities;
using BePro.Core.Interfaces.Repositories;
using BePro.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace BePro.Infrastructure.Repositories;

public class ClientAssignmentRepository : IClientAssignmentRepository
{
    private readonly BeProDbContext _context;

    public ClientAssignmentRepository(BeProDbContext context)
    {
        _context = context;
    }

    public async Task<List<ClientAssignment>> GetByClientIdAsync(Guid clientId)
    {
        return await _context.ClientAssignments
            .AsNoTracking()
            .Include(ca => ca.User)
            .Include(ca => ca.Leader)
            .Where(ca => ca.ClientId == clientId)
            .ToListAsync();
    }

    public async Task<List<ClientAssignment>> GetByUserIdAsync(Guid userId)
    {
        return await _context.ClientAssignments
            .AsNoTracking()
            .Include(ca => ca.Client)
            .Include(ca => ca.Leader)
            .Where(ca => ca.UserId == userId)
            .ToListAsync();
    }

    public async Task<ClientAssignment?> GetByClientAndUserAsync(Guid clientId, Guid userId)
    {
        return await _context.ClientAssignments
            .FirstOrDefaultAsync(ca => ca.ClientId == clientId && ca.UserId == userId);
    }

    public async Task<ClientAssignment> AddAsync(ClientAssignment assignment)
    {
        await _context.ClientAssignments.AddAsync(assignment);
        await _context.SaveChangesAsync();
        return assignment;
    }

    public async Task RemoveAsync(ClientAssignment assignment)
    {
        _context.ClientAssignments.Remove(assignment);
        await _context.SaveChangesAsync();
    }
}
