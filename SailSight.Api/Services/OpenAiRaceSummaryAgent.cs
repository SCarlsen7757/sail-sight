using Microsoft.Extensions.AI;
using System.Runtime.CompilerServices;

namespace SailSight.Api.Services;

public class OpenAiRaceSummaryAgent(IChatClient chatClient) : IRaceSummaryAgent
{
    public async IAsyncEnumerable<string> GenerateAsync(
        RaceSummaryContext ctx, [EnumeratorCancellation] CancellationToken ct)
    {
        var systemPrompt = """
            You are a sailing performance analyst. Write a concise race summary in markdown 
            for a sailor reviewing their performance. Include insights about their start, 
            speed, and overall race execution. Keep it under 500 words.
            """;

        var userPrompt = BuildUserPrompt(ctx);

        var messages = new List<ChatMessage>
        {
            new(ChatRole.System, systemPrompt),
            new(ChatRole.User, userPrompt)
        };

        await foreach (var update in chatClient.GetStreamingResponseAsync(messages, cancellationToken: ct))
        {
            if (update.Text is { Length: > 0 } text)
                yield return text;
        }
    }

    private static string BuildUserPrompt(RaceSummaryContext ctx)
    {
        var lines = new List<string>
        {
            $"Boat: {ctx.BoatName}",
            ctx.BoatClass is not null ? $"Class: {ctx.BoatClass}" : null!,
            ctx.CourseName is not null ? $"Course: {ctx.CourseName}" : null!,
            $"Race number: {ctx.RaceNumber}",
            $"Started at: {ctx.StartedAt:u}",
            $"Duration: {ctx.DurationSeconds:F1} seconds",
            $"Sailed distance: {ctx.SailedDistanceMeters:F0} m",
            $"Max SOG: {ctx.MaxSpeedOverGroundMs:F2} m/s",
            $"Avg SOG: {ctx.AvgSpeedOverGroundMs:F2} m/s"
        };

        if (ctx.AvgWindSpeedMs.HasValue)
            lines.Add($"Avg wind speed: {ctx.AvgWindSpeedMs.Value:F2} m/s");
        if (ctx.AvgWindDirectionDeg.HasValue)
            lines.Add($"Avg wind direction: {ctx.AvgWindDirectionDeg.Value:F0}°");

        if (ctx.StartAnalysis is { } sa)
        {
            lines.Add($"Start line crossed at: {sa.CrossedAt:u}");
            if (sa.TimeBiasSeconds.HasValue)
                lines.Add($"Time bias: {sa.TimeBiasSeconds.Value:F2} s (negative = early, positive = late)");
            else
                lines.Add("Time bias: no valid start crossing detected");
            if (sa.IsOcs)
            {
                var ocsDesc = sa.OcsTimeBiasSeconds.HasValue
                    ? $"{sa.OcsTimeBiasSeconds.Value:F2} s before the gun"
                    : "unknown time";
                lines.Add($"OCS: boat crossed start line early ({ocsDesc}){(sa.IsOcsCleared ? ", cleared before gun" : ", did not return before gun")}");
            }
            lines.Add($"Speed at crossing: {sa.SpeedAtCrossingMs:F2} m/s");
            lines.Add($"Approach course: {sa.ApproachCourseDegrees:F0}°");
            lines.Add($"Line fraction: {sa.LineFraction:F2} (0 = pin end, 1 = boat end)");
            if (ctx.StartLineLengthMeters.HasValue)
                lines.Add($"Position on line: {sa.LineFraction * ctx.StartLineLengthMeters.Value:F1} m from pin end (line length: {ctx.StartLineLengthMeters.Value:F1} m)");
        }

        return string.Join("\n", lines.Where(l => l is not null));
    }
}
