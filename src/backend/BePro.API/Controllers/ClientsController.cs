using BePro.API.Extensions;
using BePro.Core.DTOs.Clients;
using BePro.Core.DTOs.Common;
using BePro.Core.Enums;
using BePro.Core.Interfaces.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BePro.API.Controllers;

[ApiController]
[Route("api/v1/[controller]")]
[Authorize]
public class ClientsController : ControllerBase
{
    private readonly IClientService _clientService;

    public ClientsController(IClientService clientService)
    {
        _clientService = clientService;
    }

    [HttpGet]
    public async Task<ActionResult<ApiResponse<List<ClientDto>>>> GetAll()
    {
        var userId = User.GetUserId();
        var role = Enum.Parse<UserRole>(User.GetRole().Replace("_", ""), true);
        var clients = await _clientService.GetAllAsync(userId, role);
        return Ok(ApiResponse<List<ClientDto>>.Ok(clients));
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ApiResponse<ClientDto>>> GetById(Guid id)
    {
        var client = await _clientService.GetByIdAsync(id);
        if (client == null)
            return NotFound(ApiResponse<ClientDto>.Fail("Cliente no encontrado."));

        return Ok(ApiResponse<ClientDto>.Ok(client));
    }

    [HttpPost]
    [Authorize(Roles = "admin")]
    public async Task<ActionResult<ApiResponse<ClientDto>>> Create([FromBody] CreateClientRequest request)
    {
        var client = await _clientService.CreateAsync(request);
        return CreatedAtAction(nameof(GetById), new { id = client.Id }, ApiResponse<ClientDto>.Ok(client, "Cliente creado exitosamente."));
    }

    [HttpPut("{id:guid}")]
    [Authorize(Roles = "admin")]
    public async Task<ActionResult<ApiResponse<ClientDto>>> Update(Guid id, [FromBody] UpdateClientRequest request)
    {
        var client = await _clientService.UpdateAsync(id, request);
        return Ok(ApiResponse<ClientDto>.Ok(client, "Cliente actualizado exitosamente."));
    }

    [HttpGet("{id:guid}/assignments")]
    [Authorize(Roles = "admin,manager")]
    public async Task<ActionResult<ApiResponse<List<ClientAssignmentDto>>>> GetAssignments(Guid id)
    {
        var assignments = await _clientService.GetAssignmentsAsync(id);
        return Ok(ApiResponse<List<ClientAssignmentDto>>.Ok(assignments));
    }

    [HttpPost("{id:guid}/assignments")]
    [Authorize(Roles = "admin,manager")]
    public async Task<ActionResult<ApiResponse<ClientAssignmentDto>>> AssignUser(Guid id, [FromBody] AssignUserToClientRequest request)
    {
        var assignment = await _clientService.AssignUserAsync(id, request);
        return Ok(ApiResponse<ClientAssignmentDto>.Ok(assignment, "Usuario asignado exitosamente."));
    }

    [HttpDelete("{clientId:guid}/assignments/{userId:guid}")]
    [Authorize(Roles = "admin,manager")]
    public async Task<IActionResult> RemoveAssignment(Guid clientId, Guid userId)
    {
        await _clientService.RemoveAssignmentAsync(clientId, userId);
        return NoContent();
    }
}
