using BePro.Core.Entities;

namespace BePro.Core.Interfaces.Repositories;

public interface IClientRepository
{
    Task<Client?> GetByIdAsync(Guid id);
    Task<Client?> GetByIdWithConfigAsync(Guid id);
    Task<List<Client>> GetAllAsync();
    Task<List<Client>> GetByUserIdAsync(Guid userId);
    Task<Client> AddAsync(Client client);
    Task UpdateAsync(Client client);
}
