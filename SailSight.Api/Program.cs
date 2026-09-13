using System.Net;
using Microsoft.AspNetCore.HttpOverrides;
using Asp.Versioning;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.AspNetCore.ResponseCompression;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Scalar.AspNetCore;
using System.Threading.RateLimiting;
using SailSight.Api.Audit;
using SailSight.Api.Auth;
using SailSight.Api.Data;
using SailSight.Api.Middleware;
using SailSight.Api.Models.Entities;
using SailSight.Api.Services;

var builder = WebApplication.CreateBuilder(args);
var migrateOnly = args.Contains("--migrate-only");

// ── Options ──────────────────────────────────────────────────────────────
builder.Services.Configure<AuthOptions>(builder.Configuration.GetSection("Auth"));
builder.Services.Configure<CorsOptions>(builder.Configuration.GetSection("Cors"));
builder.Services.Configure<WebOptions>(builder.Configuration.GetSection("Web"));
var localProfile = builder.Environment.IsDevelopment() && builder.Configuration.GetValue<bool>("LocalProfile");
var authOptions = builder.Configuration.GetSection("Auth").Get<AuthOptions>() ?? new AuthOptions();
builder.Services.AddSingleton(authOptions);
if (authOptions.IsSingleUser && !localProfile) throw new InvalidOperationException("SingleUser requires the explicit local development profile.");
var publicUrl = new Uri(builder.Configuration["Web:PublicBaseUrl"] ?? "http://localhost:8081");
if (publicUrl.Scheme != "https" && !(localProfile && publicUrl.IsLoopback))
    throw new InvalidOperationException("Shared browser access requires an HTTPS application origin.");
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    options.KnownProxies.Clear();
    options.KnownIPNetworks.Clear();
    foreach (var ip in builder.Configuration.GetSection("TrustedProxies").Get<string[]>() ?? [])
    {
        options.KnownProxies.Add(IPAddress.Parse(ip));
        options.KnownProxies.Add(IPAddress.Parse(ip).MapToIPv6());
    }
});
var corsOptions = builder.Configuration.GetSection("Cors").Get<CorsOptions>() ?? new CorsOptions();

builder.Services.AddControllers();
builder.Services
    .AddApiVersioning(opts =>
    {
        opts.DefaultApiVersion = new ApiVersion(1, 0);
        opts.AssumeDefaultVersionWhenUnspecified = true;
        opts.ReportApiVersions = true;
        opts.ApiVersionReader = new UrlSegmentApiVersionReader();
    })
    .AddApiExplorer(opts =>
    {
        opts.GroupNameFormat = "'v'VVV";
        opts.SubstituteApiVersionInUrl = true;
    })
    .AddMvc()
    .AddOpenApi();
builder.Services.AddHttpContextAccessor();

builder.Services.AddResponseCompression(opts =>
{
    opts.EnableForHttps = true;
    opts.Providers.Add<BrotliCompressionProvider>();
    opts.Providers.Add<GzipCompressionProvider>();
});

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("Default")));

// ── Identity & authentication ────────────────────────────────────────────
var skipDbConnection = Environment.GetEnvironmentVariable("SKIP_DB_MIGRATION") == "true";

if (!authOptions.IsSingleUser)
{
    if (skipDbConnection)
    {
        builder.Services.AddDataProtection().UseEphemeralDataProtectionProvider();
    }
    else
    {
        var protection = builder.Services.AddDataProtection().SetApplicationName("SailSight").PersistKeysToDbContext<AppDbContext>();
        var certificatePath = builder.Configuration["Auth:KeyCertificatePath"];
        if (!string.IsNullOrEmpty(certificatePath))
            protection.ProtectKeysWithCertificate(System.Security.Cryptography.X509Certificates.X509CertificateLoader.LoadPkcs12FromFile(
                certificatePath, builder.Configuration["Auth:KeyCertificatePassword"]));
        else if (!localProfile)
            throw new InvalidOperationException("Shared access requires Auth:KeyCertificatePath to protect persisted authentication keys.");
    }

    builder.Services
        .AddIdentity<AppUser, IdentityRole<Guid>>(opts =>
        {
            opts.Password.RequiredLength = 12;
            opts.Password.RequireDigit = false;
            opts.Password.RequireLowercase = false;
            opts.Password.RequireUppercase = false;
            opts.Password.RequireNonAlphanumeric = false;
            opts.User.RequireUniqueEmail = true;
            opts.SignIn.RequireConfirmedEmail = false;
            opts.Lockout.MaxFailedAccessAttempts = 5;
            opts.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(15);
        })
        .AddEntityFrameworkStores<AppDbContext>()
        .AddDefaultTokenProviders();

    builder.Services.Configure<SecurityStampValidatorOptions>(o => o.ValidationInterval = TimeSpan.Zero);
    builder.Services.ConfigureApplicationCookie(opts =>
    {
        opts.Cookie.Name = authOptions.Cookie.Name;
        opts.Cookie.HttpOnly = true;
        opts.Cookie.SameSite = SameSiteMode.Lax;
        opts.Cookie.SecurePolicy = localProfile ? CookieSecurePolicy.SameAsRequest : CookieSecurePolicy.Always;
        opts.ExpireTimeSpan = TimeSpan.FromDays(authOptions.Cookie.SlidingExpirationDays);
        opts.SlidingExpiration = true;
        opts.Events.OnRedirectToLogin = ctx =>
        {
            ctx.Response.StatusCode = StatusCodes.Status401Unauthorized;
            return Task.CompletedTask;
        };
        opts.Events.OnRedirectToAccessDenied = ctx =>
        {
            ctx.Response.StatusCode = StatusCodes.Status403Forbidden;
            return Task.CompletedTask;
        };
    });


}
else
{
    builder.Services.AddAuthentication("SingleUser")
        .AddScheme<AuthenticationSchemeOptions, NoOpAuthHandler>("SingleUser", _ => { });
}

builder.Services.AddAuthorization();

// ── App services ─────────────────────────────────────────────────────────
builder.Services.AddScoped<ICurrentUser, CurrentUser>();
builder.Services.AddScoped<SessionAuthorizer>();
builder.Services.AddScoped<IAuthorizationHandler, SessionAccessHandler>();
builder.Services.AddScoped<IAuditService, AuditService>();
builder.Services.AddScoped<RaceDetectionService>();
builder.Services.AddScoped<VkxIngestionService>();
var ingestionLimits = builder.Configuration.GetSection("Ingestion").Get<IngestionLimits>() ?? new();
builder.Services.AddSingleton(ingestionLimits);
builder.Services.AddSingleton<IngestionGate>();
builder.Services.AddScoped<UploadAdmissionFilter>();
builder.WebHost.ConfigureKestrel(o => o.Limits.MaxRequestBodySize = IngestionLimits.RequestBytes);
builder.Services.Configure<Microsoft.AspNetCore.Http.Features.FormOptions>(o =>
{
    o.MultipartBodyLengthLimit = IngestionLimits.RequestBytes;
    o.ValueCountLimit = 1; o.ValueLengthLimit = 1024; o.MemoryBufferThreshold = 65536;
});
builder.Services.AddScoped<StartAnalysisService>();
builder.Services.AddScoped<RaceLegAnalysisService>();
builder.Services.AddSingleton<NotificationBus>();

// CORS
builder.Services.AddCors(opts =>
{
    opts.AddDefaultPolicy(policy =>
    {
        if (corsOptions.AllowedOrigins.Count == 0)
        {
            // No cross-origin API access unless explicitly configured.
        }
        else
        {
            policy.WithOrigins([.. corsOptions.AllowedOrigins])
                .AllowAnyHeader().AllowAnyMethod().AllowCredentials();
        }
    });
});

// Rate limiting
builder.Services.AddRateLimiter(opts =>
{
    opts.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    foreach (var policy in new[] { "login", "invitation" })
        opts.AddPolicy(policy, context => RateLimitPartition.GetFixedWindowLimiter(
            context.Connection.RemoteIpAddress?.ToString() ?? "unknown", _ => new FixedWindowRateLimiterOptions
            { PermitLimit = 5, Window = TimeSpan.FromMinutes(1) }));
    opts.AddPolicy("upload", context => RateLimitPartition.GetFixedWindowLimiter(
        context.User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value ?? "anonymous",
        _ => new FixedWindowRateLimiterOptions { PermitLimit = ingestionLimits.UploadsPerHour, Window = TimeSpan.FromHours(1) }));
});

var app = builder.Build();

// ── Migrations & seed ────────────────────────────────────────────────────
if (!skipDbConnection && (migrateOnly || (localProfile && builder.Configuration.GetValue("Database:AutoMigrate", true))))
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    if (migrateOnly)
        db.Database.SetConnectionString(builder.Configuration.GetConnectionString("Migration") ??
            throw new InvalidOperationException("A dedicated migration connection is required."));
    await db.Database.MigrateAsync();

    var hypertablesSql = await File.ReadAllTextAsync(
        Path.Combine(AppContext.BaseDirectory, "Data", "Migrations", "hypertables.sql"));
    await db.Database.ExecuteSqlRawAsync(hypertablesSql);

    if (authOptions.IsSingleUser)
    {
        if (await db.Users.AnyAsync(u => u.Id != AuthConstants.SystemUserId) ||
            await db.Sessions.AnyAsync(s => s.OwnerUserId != AuthConstants.SystemUserId) ||
            await db.Boats.AnyAsync(s => s.OwnerUserId != AuthConstants.SystemUserId) ||
            await db.Courses.AnyAsync(s => s.OwnerUserId != AuthConstants.SystemUserId) ||
            await db.Marks.AnyAsync(s => s.OwnerUserId != AuthConstants.SystemUserId))
            throw new InvalidOperationException("SingleUser cannot open a database containing other users or their data.");
        var exists = await db.Users.AnyAsync(u => u.Id == AuthConstants.SystemUserId);
        if (!exists)
        {
            db.Users.Add(new AppUser
            {
                Id = AuthConstants.SystemUserId,
                UserName = AuthConstants.SystemUserEmail,
                NormalizedUserName = AuthConstants.SystemUserEmail.ToUpperInvariant(),
                Email = AuthConstants.SystemUserEmail,
                NormalizedEmail = AuthConstants.SystemUserEmail.ToUpperInvariant(),
                EmailConfirmed = true,
                DisplayName = "Local User",
                SecurityStamp = Guid.NewGuid().ToString(),
            });
            await db.SaveChangesAsync();
        }
    }
    else
    {
        await SeedRolesAndAdminAsync(scope.ServiceProvider, authOptions);
    }
}

if (!skipDbConnection && authOptions.IsSingleUser)
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    if (await db.Users.AnyAsync(u => u.Id != AuthConstants.SystemUserId) ||
        await db.Sessions.AnyAsync(s => s.OwnerUserId != AuthConstants.SystemUserId) ||
        await db.Boats.AnyAsync(s => s.OwnerUserId != AuthConstants.SystemUserId) ||
        await db.Courses.AnyAsync(s => s.OwnerUserId != AuthConstants.SystemUserId) ||
        await db.Marks.AnyAsync(s => s.OwnerUserId != AuthConstants.SystemUserId))
        throw new InvalidOperationException("SingleUser cannot open a database containing other users or their data.");
}
if (migrateOnly) return;

// ── Pipeline ─────────────────────────────────────────────────────────────
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi().WithDocumentPerVersion();
    app.MapScalarApiReference();
    app.MapGet("/", ctx => { ctx.Response.Redirect("/scalar/v1"); return Task.CompletedTask; });
    app.MapGet("/swagger", ctx => { ctx.Response.Redirect("/scalar/v1"); return Task.CompletedTask; });
}

// Reject untrusted forwarding data before any component consumes scheme or client IP.
app.Use(async (context, next) =>
{
    var trusted = builder.Configuration.GetSection("TrustedProxies").Get<string[]>() ?? [];
    if (!trusted.Any(ip => IPAddress.Parse(ip).MapToIPv6().Equals(context.Connection.RemoteIpAddress?.MapToIPv6())))
        foreach (var name in context.Request.Headers.Keys.Where(k => k.Equals("Forwarded", StringComparison.OrdinalIgnoreCase) || k.StartsWith("X-Forwarded-", StringComparison.OrdinalIgnoreCase)).ToList())
            context.Request.Headers.Remove(name);
    await next(context);
});
app.UseForwardedHeaders();
app.UseMiddleware<RequestFailureMiddleware>();
app.UseMiddleware<SecurityHeadersMiddleware>();
app.UseMiddleware<RequestOriginMiddleware>();
app.UseCors();

app.UseAuthentication();
app.UseMiddleware<SingleUserMiddleware>();
app.UseRateLimiter();
app.UseMiddleware<CsrfMiddleware>();
app.UseAuthorization();

app.UseResponseCompression();

app.MapControllers();

app.Run();

static async Task SeedRolesAndAdminAsync(IServiceProvider sp, AuthOptions authOptions)
{
    var db = sp.GetRequiredService<AppDbContext>();
    await using var tx = await SecurityTransactions.BeginAsync(db);
    var initialInstall = !await db.Roles.AnyAsync() && !await db.Users.AnyAsync();
    var roleManager = sp.GetRequiredService<RoleManager<IdentityRole<Guid>>>();
    foreach (var role in new[] { AuthConstants.AdminRole, AuthConstants.UserRole })
    {
        if (!await roleManager.RoleExistsAsync(role))
            SecurityTransactions.Require(await roleManager.CreateAsync(new IdentityRole<Guid>(role) { Id = Guid.CreateVersion7() }));
    }

    var userManager = sp.GetRequiredService<UserManager<AppUser>>();
    var logger = sp.GetRequiredService<ILoggerFactory>().CreateLogger("AdminBootstrap");
    var webOpts = sp.GetRequiredService<IOptions<WebOptions>>().Value;

    if (!initialInstall) { await tx.CommitAsync(); return; }

    var email = authOptions.Admin.Email;
    if (string.IsNullOrWhiteSpace(email))
    {
        throw new InvalidOperationException("Set Auth__Admin__Email for initial installation.");
    }

    var existing = await userManager.FindByEmailAsync(email);
    AppUser admin;
    if (existing is null)
    {
        admin = new AppUser
        {
            Id = Guid.CreateVersion7(),
            UserName = email,
            Email = email,
            EmailConfirmed = true,
            DisplayName = "Admin",
        };

        IdentityResult create = string.IsNullOrEmpty(authOptions.Admin.Password)
            ? await userManager.CreateAsync(admin)
            : await userManager.CreateAsync(admin, authOptions.Admin.Password);

        if (!create.Succeeded)
        {
            logger.LogError("Failed to bootstrap admin user: {Errors}",
                string.Join("; ", create.Errors.Select(e => e.Description)));
            return;
        }
    }
    else
    {
        admin = existing;
    }

    if (!await userManager.IsInRoleAsync(admin, AuthConstants.AdminRole))
        SecurityTransactions.Require(await userManager.AddToRoleAsync(admin, AuthConstants.AdminRole));

    await tx.CommitAsync();
    if (string.IsNullOrEmpty(admin.PasswordHash))
    {
        var token = await userManager.GeneratePasswordResetTokenAsync(admin);
        var url = $"{webOpts.PublicBaseUrl.TrimEnd('/')}/setup?userId={admin.Id}&token={Uri.EscapeDataString(token)}";
        logger.LogWarning("Admin {Email} has no password. Open this one-time setup URL to set one:\n  {Url}", email, url);
    }
    else
    {
        logger.LogInformation("Admin {Email} bootstrapped.", email);
    }
}

internal sealed class NoOpAuthHandler(
    IOptionsMonitor<AuthenticationSchemeOptions> options,
    ILoggerFactory logger,
    System.Text.Encodings.Web.UrlEncoder encoder)
    : AuthenticationHandler<AuthenticationSchemeOptions>(options, logger, encoder)
{
    protected override Task<AuthenticateResult> HandleAuthenticateAsync()
        => Task.FromResult(AuthenticateResult.NoResult());
}
