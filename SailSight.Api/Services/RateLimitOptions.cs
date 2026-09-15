namespace SailSight.Api.Services;

// Per-IP fixed-window limits for anonymous auth endpoints. Defaults are the production values;
// test stacks raise them (RateLimits__LoginPerMinute) so seeding and E2E logins are not throttled.
public sealed class RateLimitOptions
{
    public const string Section = "RateLimits";
    public int LoginPerMinute { get; set; } = 5;
    public int InvitationPerMinute { get; set; } = 5;

    public static RateLimitOptions Load(IConfiguration configuration)
    {
        var options = configuration.GetSection(Section).Get<RateLimitOptions>() ?? new();
        if (options.LoginPerMinute < 1 || options.InvitationPerMinute < 1)
            throw new InvalidOperationException($"{Section} limits must be at least 1.");
        return options;
    }
}
