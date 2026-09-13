using Asp.Versioning;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using SailSight.Api.Audit;
using SailSight.Api.Auth;
using SailSight.Api.Data;
using SailSight.Api.Models.Entities;
using SailSight.Shared.Dtos.Admin;
using SailSight.Shared.Dtos.Auth;

namespace SailSight.Api.Controllers;

[ApiVersion("1.0")]
[ApiController]
[Route("api/v{version:apiVersion}/auth")]
public class AuthController(
    AppDbContext db,
    UserManager<AppUser> userManager,
    SignInManager<AppUser> signInManager,
    IAuditService audit,
    AuthOptions authOptions,
    IOptions<WebOptions> webOptions) : ControllerBase
{
    [HttpPost("login")]
    [AllowAnonymous]
    [EnableRateLimiting("login")]
    public async Task<ActionResult<AuthResultDto>> Login([FromBody] LoginRequest req)
    {
        if (!authOptions.Local.Enabled) return BadRequest(new { error = "local_auth_disabled" });

        // If a session is already active (e.g. stale cookie from a previous user),
        // sign it out first so Identity starts from a clean state.
        if (User.Identity?.IsAuthenticated == true)
            await signInManager.SignOutAsync();

        var user = await userManager.FindByEmailAsync(req.Email);
        if (user is null) return Unauthorized();

        // Block users that haven't completed setup yet (no password hash).
        if (string.IsNullOrEmpty(user.PasswordHash))
            return Unauthorized(new { error = "setup_not_completed" });

        var result = await signInManager.PasswordSignInAsync(user, req.Password, isPersistent: true, lockoutOnFailure: true);
        if (!result.Succeeded)
        {
            await audit.LogAsync("auth.login_failed", "user", user.Id.ToString());
            return Unauthorized();
        }

        await audit.LogAsync("auth.login", "user", user.Id.ToString());
        return Ok(new AuthResultDto(user.Id, user.Email!, user.DisplayName));
    }

    [HttpPost("logout")]
    [Authorize]
    public async Task<IActionResult> Logout()
    {
        await signInManager.SignOutAsync();
        await audit.LogAsync("auth.logout");
        return NoContent();
    }

    // ── Setup link redemption (used by users created by an admin) ──────
    [HttpGet("setup/validate")]
    [AllowAnonymous]
    public async Task<ActionResult<SetupValidateResponse>> ValidateSetup([FromQuery] Guid userId, [FromQuery] string token)
    {
        var user = await userManager.FindByIdAsync(userId.ToString());
        if (user is null) return NotFound();

        var ok = await userManager.VerifyUserTokenAsync(
            user,
            userManager.Options.Tokens.PasswordResetTokenProvider,
            UserManager<AppUser>.ResetPasswordTokenPurpose,
            token);
        if (!ok) return BadRequest(new { error = "invalid_or_expired_token" });

        return Ok(new SetupValidateResponse(user.Id, user.Email!, user.DisplayName));
    }

    [HttpPost("setup/complete")]
    [AllowAnonymous]
    public async Task<IActionResult> CompleteSetup([FromBody] CompleteSetupRequest req)
    {
        await using var tx = await SecurityTransactions.BeginAsync(db);
        var user = await userManager.FindByIdAsync(req.UserId.ToString());
        if (user is null) return NotFound();

        // ResetPasswordAsync also sets the password if there isn't one yet.
        var result = await userManager.ResetPasswordAsync(user, req.Token, req.Password);
        if (!result.Succeeded)
            return BadRequest(new { errors = result.Errors.Select(e => e.Description) });

        if (!user.EmailConfirmed)
        {
            user.EmailConfirmed = true;
            SecurityTransactions.Require(await userManager.UpdateAsync(user));
        }

        await tx.CommitAsync();
        await signInManager.SignInAsync(user, isPersistent: true);
        await audit.LogAsync("auth.setup_complete", "user", user.Id.ToString());

        // Suppress unused-var warning while still binding webOptions for future use.
        _ = webOptions;
        return Ok(new AuthResultDto(user.Id, user.Email!, user.DisplayName));
    }

    // ── Shareable invitation links (multi-use) ─────────────────────────
    [HttpGet("invitation/validate")]
    [AllowAnonymous]
    [EnableRateLimiting("invitation")]
    public async Task<ActionResult<InvitationValidateResponse>> ValidateInvitation([FromQuery] string token, CancellationToken ct)
    {
        var inv = await db.Invitations.FirstOrDefaultAsync(i => i.Token == token, ct);
        if (inv is null) return NotFound(new { error = "invalid_token" });
        if (inv.RevokedAt is not null) return BadRequest(new { error = "revoked" });
        if (inv.ExpiresAt is not null && inv.ExpiresAt <= DateTimeOffset.UtcNow) return BadRequest(new { error = "expired" });
        if (inv.MaxUses is not null && inv.UsedCount >= inv.MaxUses) return BadRequest(new { error = "exhausted" });

        var remaining = inv.MaxUses.HasValue ? Math.Max(0, inv.MaxUses.Value - inv.UsedCount) : (int?)null;
        return Ok(new InvitationValidateResponse(inv.Role, remaining, inv.ExpiresAt));
    }

    [HttpPost("invitation/redeem")]
    [AllowAnonymous]
    [EnableRateLimiting("invitation")]
    public async Task<ActionResult<AuthResultDto>> RedeemInvitation([FromBody] RedeemInvitationRequest req, CancellationToken ct)
    {
        if (!authOptions.Local.Enabled) return BadRequest(new { error = "local_auth_disabled" });

        await using var tx = await SecurityTransactions.BeginAsync(db, ct);
        // Atomic decrement-or-fail: increment used_count only if invitation is still valid.
        var now = DateTimeOffset.UtcNow;
        var rows = await db.Invitations
            .Where(i => i.Token == req.Token
                && i.RevokedAt == null
                && (i.ExpiresAt == null || i.ExpiresAt > now)
                && (i.MaxUses == null || i.UsedCount < i.MaxUses))
            .ExecuteUpdateAsync(s => s.SetProperty(i => i.UsedCount, i => i.UsedCount + 1), ct);
        if (rows == 0) return BadRequest(new { error = "invalid_or_exhausted" });

        var inv = await db.Invitations.AsNoTracking().FirstAsync(i => i.Token == req.Token, ct);

        if (await userManager.FindByEmailAsync(req.Email) is not null)
        {
            return Conflict(new { error = "email_taken" });
        }

        var user = new AppUser
        {
            Id = Guid.CreateVersion7(),
            UserName = req.Email,
            Email = req.Email,
            EmailConfirmed = true,
            DisplayName = req.DisplayName,
        };
        var create = await userManager.CreateAsync(user, req.Password);
        if (!create.Succeeded)
        {
            return BadRequest(new { errors = create.Errors.Select(e => e.Description) });
        }
        SecurityTransactions.Require(await userManager.AddToRoleAsync(user, inv.Role));

        await tx.CommitAsync();
        await signInManager.SignInAsync(user, isPersistent: true);
        await audit.LogAsync("auth.invitation_redeemed", "invitation", inv.Id.ToString(), details: user.Id.ToString(), ct: ct);
        return Ok(new AuthResultDto(user.Id, user.Email!, user.DisplayName));
    }
}
