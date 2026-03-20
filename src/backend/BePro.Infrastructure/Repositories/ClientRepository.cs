using BePro.Core.Entities;
using BePro.Core.Interfaces.Repositories;
using BePro.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace BePro.Infrastructure.Repositories;

public class ClientRepository : IClientRepository
{
    private readonly BeProDbContext _context;

    public ClientRepository(BeProDbContext context)
    {
        _context = context;
    }

    public async Task<Client?> GetByIdAsync(Guid id)
    {
        return await _context.Clients
            .AsNoTracking()
            .Include(c => c.FormConfig)
            .FirstOrDefaultAsync(c => c.Id == id);
    }

    public async Task<Client?> GetByIdWithConfigAsync(Guid id)
    {
        return await _context.Clients
            .Include(c => c.FormConfig)
            .FirstOrDefaultAsync(c => c.Id == id);
    }

    public async Task<List<Client>> GetAllAsync()
    {
        return await _context.Clients
            .AsNoTracking()
            .Include(c => c.FormConfig)
            .Where(c => c.IsActive)
            .OrderBy(c => c.Name)
            .ToListAsync();
    }

    public async Task<List<Client>> GetByUserIdAsync(Guid userId)
    {
        return await _context.ClientAssignments
            .AsNoTracking()
            .Where(ca => ca.UserId == userId)
            .Include(ca => ca.Client)
                .ThenInclude(c => c.FormConfig)
            .Select(ca => ca.Client)
            .Where(c => c.IsActive)
            .OrderBy(c => c.Name)
            .ToListAsync();
    }

    public async Task<Client> AddAsync(Client client)
    {
        await _context.Clients.AddAsync(client);
        await _context.SaveChangesAsync();
        return client;
    }

    public async Task UpdateAsync(Client client)
    {
        _context.Clients.Update(client);
        await _context.SaveChangesAsync();
    }
}
