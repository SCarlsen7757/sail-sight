using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using SailSight.Api.Auth;

namespace SailSight.Api.Services;

// Resource filters execute before multipart model binding and temporary-file spooling.
public sealed class UploadAdmissionFilter(IngestionGate gate, ICurrentUser user) : IAsyncResourceFilter
{
    public async Task OnResourceExecutionAsync(ResourceExecutingContext context, ResourceExecutionDelegate next)
    {
        using var lease = gate.TryEnter(user.UserId);
        if (lease is null) { context.Result = new ObjectResult(new { error = "ingestion_busy" }) { StatusCode = 429 }; return; }
        await next();
    }
}
