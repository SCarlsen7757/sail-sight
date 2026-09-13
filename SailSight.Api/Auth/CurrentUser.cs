using System.Security.Claims;

namespace SailSight.Api.Auth;

public interface ICurrentUser
{
    Guid UserId { get; }
    string? Email { get; }
    bool IsAuthenticated { get; }
}

public sealed class CurrentUser(IHttpContextAccessor accessor, AuthOptions auth) : ICurrentUser
{
    public Guid UserId
    {
        get
        {
            if (auth.IsSingleUser) return AuthConstants.SystemUserId;
            var sub = accessor.HttpContext?.User?.FindFirstValue(ClaimTypes.NameIdentifier);
            return Guid.TryParse(sub, out var id) ? id : Guid.Empty;
        }
    }

    public string? Email => auth.IsSingleUser
        ? AuthConstants.SystemUserEmail
        : accessor.HttpContext?.User?.FindFirstValue(ClaimTypes.Email);

    public bool IsAuthenticated => auth.IsSingleUser
        || accessor.HttpContext?.User?.Identity?.IsAuthenticated == true;
}
