namespace SailSight.Api.Middleware;

public sealed class RequestFailureMiddleware(RequestDelegate next)
{
    public async Task InvokeAsync(HttpContext context)
    {
        try { await next(context); }
        catch (BadHttpRequestException exception) when (!context.Response.HasStarted)
        {
            context.Response.Clear();
            context.Response.StatusCode = exception.StatusCode;
            await context.Response.WriteAsJsonAsync(new { error = exception.StatusCode == 413 ? "limit_exceeded" : "invalid_request" });
        }
        catch (OperationCanceledException) when (context.RequestAborted.IsCancellationRequested)
        {
            context.Abort();
        }
    }
}
