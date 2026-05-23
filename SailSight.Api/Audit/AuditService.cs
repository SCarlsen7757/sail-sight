using SailSight.Api.Data;
using SailSight.Api.Models.Entities;

namespace SailSight.Api.Audit;

public interface IAuditService
{
    Task LogAsync(string action, string? entityType = null, string? entityId = null, string? details = null, CancellationToken ct = default);
}

public sealed class AuditService(AppDbContext db, IHttpContextAccessor httpContext, Auth.ICurrentUser currentUser) : IAuditService
{
    public async Task LogAsync(string action, string? entityType = null, string? entityId = null, string? details = null, CancellationToken ct = default)
    {
        var ip = httpContext.HttpContext?.Connection.RemoteIpAddress?.ToString();
        db.AuditEvents.Add(new AuditEvent
        {
            UserId = currentUser.IsAuthenticated ? currentUser.UserId : null,
            Action = action,
            EntityType = entityType,
            EntityId = entityId,
            IpAddress = ip,
            Details = details,
        });
        await db.SaveChangesAsync(ct);
    }
}
