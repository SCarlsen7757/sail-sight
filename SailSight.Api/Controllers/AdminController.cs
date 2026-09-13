using SailSight.Api.Helpers;
using Asp.Versioning;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
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
[Route("api/v{version:apiVersion}/admin/users")]
public class AdminController(
    AppDbContext db,
    UserManager<AppUser> userManager,
    IAuditService audit,
    ICurrentUser currentUser,
    IOptions<WebOptions> webOptions) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<List<AdminUserDto>>> List(CancellationToken ct)
    {
        var users = await userManager.Users.OrderBy(u => u.Email).ThenBy(u => u.Id).PageAsync(HttpContext, ct);
        var result = new List<AdminUserDto>(users.Count);
        foreach (var u in users)
        {
            var roles = await userManager.GetRolesAsync(u);
            result.Add(new AdminUserDto(
                u.Id, u.Email!, u.DisplayName, [.. roles],
                !string.IsNullOrEmpty(u.PasswordHash), u.CreatedAt));
        }
        return Ok(result);
    }

    [HttpGet("stats")]
    [EndpointSummary("Quick admin stats: user count and team count.")]
    public async Task<ActionResult<AdminStatsDto>> GetStats(CancellationToken ct)
    {
        var userCount = await userManager.Users.CountAsync(ct);
        var teamCount = await db.Teams.CountAsync(ct);
        return Ok(new AdminStatsDto(userCount, teamCount));
    }

    [HttpPost]
    public async Task<ActionResult<CreateUserResponse>> Create([FromBody] CreateUserRequest req)
    {
        await using var tx = await SecurityTransactions.BeginAsync(db);
        if (await userManager.FindByEmailAsync(req.Email) is not null)
            return Conflict(new { error = "email_taken" });

        var user = new AppUser
        {
            Id = Guid.CreateVersion7(),
            UserName = req.Email,
            Email = req.Email,
            EmailConfirmed = true,
            DisplayName = req.DisplayName,
        };
        var create = await userManager.CreateAsync(user);
        if (!create.Succeeded)
            return BadRequest(new { errors = create.Errors.Select(e => e.Description) });

        var role = NormalizeRole(req.Role);
        SecurityTransactions.Require(await userManager.AddToRoleAsync(user, role));

        var setupUrl = await BuildSetupUrlAsync(user);
        await audit.LogAsync("admin.user_created", "user", user.Id.ToString(), details: role);

        await tx.CommitAsync();
        return CreatedAtAction(nameof(List), null, new CreateUserResponse(await ToDto(user), setupUrl));
    }

    [HttpPost("{id:guid}/setup-link")]
    public async Task<ActionResult<RegenerateSetupLinkResponse>> RegenerateSetupLink(Guid id)
    {
        await using var tx = await SecurityTransactions.BeginAsync(db);
        var user = await userManager.FindByIdAsync(id.ToString());
        if (user is null) return NotFound();
        var url = await BuildSetupUrlAsync(user);
        await audit.LogAsync("admin.setup_link_regenerated", "user", user.Id.ToString());
        await tx.CommitAsync();
        return Ok(new RegenerateSetupLinkResponse(url));
    }

    [HttpPatch("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateUserRequest req)
    {
        await using var tx = await SecurityTransactions.BeginAsync(db);
        var user = await userManager.FindByIdAsync(id.ToString());
        if (user is null) return NotFound();

        if (req.DisplayName is not null)
            user.DisplayName = req.DisplayName;
        SecurityTransactions.Require(await userManager.UpdateAsync(user));

        if (req.Role is not null)
        {
            var newRole = NormalizeRole(req.Role);
            var current = await userManager.GetRolesAsync(user);
            if (current.Contains(AuthConstants.AdminRole) && newRole != AuthConstants.AdminRole &&
                (await userManager.GetUsersInRoleAsync(AuthConstants.AdminRole)).Count <= 1)
                return Conflict(new { error = "cannot_demote_last_admin" });
            SecurityTransactions.Require(await userManager.RemoveFromRolesAsync(user, current));
            SecurityTransactions.Require(await userManager.AddToRoleAsync(user, newRole));
            SecurityTransactions.Require(await userManager.UpdateSecurityStampAsync(user));
            await audit.LogAsync("admin.user_role_changed", "user", user.Id.ToString(), details: newRole);
        }
        await tx.CommitAsync();
        return Ok();
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        await using var tx = await SecurityTransactions.BeginAsync(db);
        if (id == currentUser.UserId)
            return BadRequest(new { error = "cannot_delete_self" });

        var user = await userManager.FindByIdAsync(id.ToString());
        if (user is null) return NotFound();
        if (await userManager.IsInRoleAsync(user, AuthConstants.AdminRole) &&
            (await userManager.GetUsersInRoleAsync(AuthConstants.AdminRole)).Count <= 1)
            return Conflict(new { error = "cannot_delete_last_admin" });
        if (await db.Sessions.AnyAsync(s => s.OwnerUserId == id) || await db.Boats.AnyAsync(b => b.OwnerUserId == id) ||
            await db.Courses.AnyAsync(c => c.OwnerUserId == id) || await db.Marks.AnyAsync(m => m.OwnerUserId == id) ||
            await db.TeamMembers.AnyAsync(m => m.UserId == id && m.Role == TeamRole.Owner &&
                !db.TeamMembers.Any(o => o.TeamId == m.TeamId && o.Role == TeamRole.Owner && o.UserId != id)))
            return Conflict(new { error = "account_owns_data" });
        var del = await userManager.DeleteAsync(user);
        if (!del.Succeeded) return BadRequest(new { errors = del.Errors.Select(e => e.Description) });
        await audit.LogAsync("admin.user_deleted", "user", id.ToString());
        await tx.CommitAsync();
        return NoContent();
    }

    private async Task<string> BuildSetupUrlAsync(AppUser user)
    {
        SecurityTransactions.Require(await userManager.UpdateSecurityStampAsync(user));
        var token = await userManager.GeneratePasswordResetTokenAsync(user);
        var baseUrl = webOptions.Value.PublicBaseUrl.TrimEnd('/');
        return $"{baseUrl}/setup?userId={user.Id}&token={Uri.EscapeDataString(token)}";
    }

    private async Task<AdminUserDto> ToDto(AppUser u)
    {
        var roles = await userManager.GetRolesAsync(u);
        return new AdminUserDto(u.Id, u.Email!, u.DisplayName, [.. roles],
            !string.IsNullOrEmpty(u.PasswordHash), u.CreatedAt);
    }

    private static string NormalizeRole(string? role)
    {
        if (string.Equals(role, AuthConstants.AdminRole, StringComparison.OrdinalIgnoreCase))
            return AuthConstants.AdminRole;
        return AuthConstants.UserRole;
    }
}
