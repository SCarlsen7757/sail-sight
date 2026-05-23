namespace SailSight.Api.Auth;

public sealed class AuthOptions
{
    public string Mode { get; set; } = "MultiUser";
    public CookieOpts Cookie { get; set; } = new();
    public LocalAuthOpts Local { get; set; } = new();
    public AdminBootstrapOpts Admin { get; set; } = new();

    public bool IsSingleUser => string.Equals(Mode, "SingleUser", StringComparison.OrdinalIgnoreCase);

    public sealed class CookieOpts
    {
        public string Name { get; set; } = "vkx.auth";
        public int SlidingExpirationDays { get; set; } = 14;
    }

    public sealed class LocalAuthOpts
    {
        public bool Enabled { get; set; } = true;
    }

    /// <summary>
    /// Bootstrap config for the first admin. If both Email and Password are provided
    /// and no Admin role member exists, an admin user is seeded on startup.
    /// If only Email is set, the admin is seeded with no password and a setup URL is logged.
    /// </summary>
    public sealed class AdminBootstrapOpts
    {
        public string? Email { get; set; }
        public string? Password { get; set; }
    }
}

public sealed class CorsOptions
{
    public List<string> AllowedOrigins { get; set; } = [];
}

public sealed class WebOptions
{
    public string PublicBaseUrl { get; set; } = "http://localhost:8081";
}
