using SailSight.Api.Helpers;
using System.Security.Cryptography;
using Asp.Versioning;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using SailSight.Api.Audit;
using SailSight.Api.Auth;
using SailSight.Api.Data;
using SailSight.Api.Models.Entities;
using SailSight.Shared.Dtos.Admin;

namespace SailSight.Api.Controllers;

[ApiVersion("1.0")]
[ApiController]
[Authorize(Roles = AuthConstants.AdminRole)]
[Route("api/v{version:apiVersion}/admin/invitations")]
public class AdminInvitationsController(
    AppDbContext db,
    IAuditService audit,
    ICurrentUser currentUser,
    IOptions<WebOptions> webOptions) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<List<InvitationDto>>> List(CancellationToken ct)
    {
        var items = await db.Invitations.OrderByDescending(i => i.CreatedAt).ThenBy(i => i.Id).PageAsync(HttpContext, ct);
        return Ok(items.Select(ToDto).ToList());
    }

    [HttpPost]
    public async Task<ActionResult<InvitationWithUrlDto>> Create([FromBody] CreateInvitationRequest req, CancellationToken ct)
    {
        if (req.MaxUses is < 1) return BadRequest(new { error = "invalid_max_uses" });
        if (req.ExpiresInDays is < 1) return BadRequest(new { error = "invalid_expiry" });

        var inv = new Invitation
        {
            Token = GenerateToken(),
            Role = NormalizeRole(req.Role),
            MaxUses = req.MaxUses,
            ExpiresAt = req.ExpiresInDays.HasValue
                ? DateTimeOffset.UtcNow.AddDays(req.ExpiresInDays.Value)
                : null,
            CreatedByUserId = currentUser.UserId,
            Note = req.Note,
        };
        db.Invitations.Add(inv);
        await db.SaveChangesAsync(ct);
        await audit.LogAsync("admin.invitation_created", "invitation", inv.Id.ToString(), details: inv.Role, ct: ct);

        return CreatedAtAction(nameof(List), null, new InvitationWithUrlDto(ToDto(inv), BuildUrl(inv.Token)));
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Revoke(Guid id, CancellationToken ct)
    {
        var inv = await db.Invitations.FindAsync([id], ct);
        if (inv is null) return NotFound();
        if (inv.RevokedAt is null)
        {
            inv.RevokedAt = DateTimeOffset.UtcNow;
            await db.SaveChangesAsync(ct);
            await audit.LogAsync("admin.invitation_revoked", "invitation", id.ToString(), ct: ct);
        }
        return NoContent();
    }

    private string BuildUrl(string token)
        => $"{webOptions.Value.PublicBaseUrl.TrimEnd('/')}/invite?token={Uri.EscapeDataString(token)}";

    internal static InvitationDto ToDto(Invitation i)
    {
        var active = i.RevokedAt is null
            && (i.ExpiresAt is null || i.ExpiresAt > DateTimeOffset.UtcNow)
            && (i.MaxUses is null || i.UsedCount < i.MaxUses);
        var remaining = i.MaxUses.HasValue ? Math.Max(0, i.MaxUses.Value - i.UsedCount) : (int?)null;
        return new InvitationDto(i.Id, i.Role, i.MaxUses, i.UsedCount, i.ExpiresAt, i.CreatedAt, i.RevokedAt, i.Note, active, remaining);
    }

    private static string NormalizeRole(string? role)
        => string.Equals(role, AuthConstants.AdminRole, StringComparison.OrdinalIgnoreCase)
            ? AuthConstants.AdminRole
            : AuthConstants.UserRole;

    private static string GenerateToken()
    {
        var bytes = RandomNumberGenerator.GetBytes(32);
        return Convert.ToBase64String(bytes).Replace('+', '-').Replace('/', '_').TrimEnd('=');
    }
}
