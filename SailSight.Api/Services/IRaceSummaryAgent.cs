namespace SailSight.Api.Services;

public interface IRaceSummaryAgent
{
    IAsyncEnumerable<string> GenerateAsync(
        RaceSummaryContext context, CancellationToken ct);
}
