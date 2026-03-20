using BePro.Core.Entities;
using BePro.Core.Interfaces.Repositories;
using BePro.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace BePro.Infrastructure.Repositories;

public class InvoiceRepository : IInvoiceRepository
{
    private readonly BeProDbContext _context;

    public InvoiceRepository(BeProDbContext context)
    {
        _context = context;
    }

    public async Task<Invoice?> GetByIdAsync(Guid id)
    {
        return await _context.Invoices
            .Include(i => i.Client)
            .Include(i => i.InvoicePlacements)
                .ThenInclude(ip => ip.Placement)
                    .ThenInclude(p => p.Candidate)
            .FirstOrDefaultAsync(i => i.Id == id);
    }

    public async Task<List<Invoice>> GetByClientIdAsync(Guid clientId)
    {
        return await _context.Invoices
            .AsNoTracking()
            .Include(i => i.Client)
            .Where(i => i.ClientId == clientId)
            .OrderByDescending(i => i.IssueDate)
            .ToListAsync();
    }

    public async Task<Invoice> AddAsync(Invoice invoice)
    {
        await _context.Invoices.AddAsync(invoice);
        await _context.SaveChangesAsync();
        return invoice;
    }

    public async Task UpdateAsync(Invoice invoice)
    {
        _context.Invoices.Update(invoice);
        await _context.SaveChangesAsync();
    }
}
