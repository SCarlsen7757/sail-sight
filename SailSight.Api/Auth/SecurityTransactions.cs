using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using SailSight.Api.Data;
using SailSight.Api.Models.Entities;

namespace SailSight.Api.Auth;

public static class SecurityTransactions
{
    // Shared across API processes. Membership and account deletion use the same lock
    // so neither can bypass the final-owner invariant while the other is committing.
    public static async Task<IDbContextTransaction> BeginAsync(AppDbContext db, CancellationToken ct = default)
    {
        var tx = await db.Database.BeginTransactionAsync(ct);
        try
        {
            await db.Database.ExecuteSqlRawAsync("SELECT pg_advisory_xact_lock(742019381)", ct);
            return tx;
        }
        catch { await tx.DisposeAsync(); throw; }
    }

    public static void Require(IdentityResult result)
    {
        if (!result.Succeeded) throw new InvalidOperationException("Identity operation failed: " +
            string.Join("; ", result.Errors.Select(e => e.Code)));
    }

    public static bool TryTeamRole(string value, out TeamRole role)
    {
        role = default;
        return Enum.GetNames<TeamRole>().Any(n => string.Equals(n, value, StringComparison.OrdinalIgnoreCase))
            && Enum.TryParse(value, true, out role);
    }

    public static bool CanManage(TeamRole actor, TeamRole current, TeamRole requested) =>
        actor == TeamRole.Owner || (actor == TeamRole.Admin && current == TeamRole.Member && requested == TeamRole.Member);
}
