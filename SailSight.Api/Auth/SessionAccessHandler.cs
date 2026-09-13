using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using SailSight.Api.Data;
using SailSight.Api.Models.Entities;

namespace SailSight.Api.Auth;

public sealed class SessionAccessRequirement(bool requireWrite) : IAuthorizationRequirement
{
    public bool RequireWrite { get; } = requireWrite;
}

public sealed class SessionAccessHandler(SessionAuthorizer authorizer)
    : AuthorizationHandler<SessionAccessRequirement, Guid>
{
    protected override async Task HandleRequirementAsync(
        AuthorizationHandlerContext context,
        SessionAccessRequirement requirement,
        Guid sessionId)
    {
        if (requirement.RequireWrite ? await authorizer.CanWriteAsync(sessionId) : await authorizer.CanReadAsync(sessionId))
            context.Succeed(requirement);
    }
}
