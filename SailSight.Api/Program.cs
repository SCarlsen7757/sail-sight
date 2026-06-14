using Asp.Versioning;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.AspNetCore.ResponseCompression;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.AI;
using Microsoft.Extensions.Options;
using OpenAI;
using Scalar.AspNetCore;
using System.Threading.RateLimiting;
using SailSight.Api.Audit;
using SailSight.Api.Auth;
using SailSight.Api.Data;
using SailSight.Api.Middleware;
using SailSight.Api.Models.Entities;
using SailSight.Api.Services;

var builder = WebApplication.CreateBuilder(args);

// ── Options ──────────────────────────────────────────────────────────────
builder.Services.Configure<AuthOptions>(builder.Configuration.GetSection("Auth"));
builder.Services.Configure<CorsOptions>(builder.Configuration.GetSection("Cors"));
builder.Services.Configure<WebOptions>(builder.Configuration.GetSection("Web"));
var authOptions = builder.Configuration.GetSection("Auth").Get<AuthOptions>() ?? new AuthOptions();
builder.Services.AddSingleton(authOptions);
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
        builder.Services.AddDataProtection().PersistKeysToDbContext<AppDbContext>();
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

    builder.Services.ConfigureApplicationCookie(opts =>
    {
        opts.Cookie.Name = authOptions.Cookie.Name;
        opts.Cookie.HttpOnly = true;
        opts.Cookie.SameSite = SameSiteMode.Lax;
        opts.Cookie.SecurePolicy = CookieSecurePolicy.SameAsRequest;
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

    builder.Services.AddAuthentication()
        .AddScheme<PatAuthenticationOptions, PatAuthenticationHandler>(AuthConstants.PatScheme, _ => { });
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
            policy.SetIsOriginAllowed(_ => true).AllowAnyHeader().AllowAnyMethod().AllowCredentials();
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
    opts.AddFixedWindowLimiter("login", limiter =>
    {
        limiter.PermitLimit = 5;
        limiter.Window = TimeSpan.FromMinutes(1);
    });
    opts.AddFixedWindowLimiter("upload", limiter =>
    {
        limiter.PermitLimit = 20;
        limiter.Window = TimeSpan.FromHours(1);
    });
});

// AI summary agent
var raceSummaryApiKey = builder.Configuration["RaceSummary:ApiKey"];
if (!string.IsNullOrEmpty(raceSummaryApiKey))
{
    var model = builder.Configuration["RaceSummary:Model"] ?? "gpt-4o-mini";
    var endpoint = builder.Configuration["RaceSummary:Endpoint"];

    builder.Services.AddSingleton<IChatClient>(sp =>
    {
        var options = endpoint is not null
            ? new OpenAIClientOptions { Endpoint = new Uri(endpoint) }
            : new OpenAIClientOptions();
        var credential = new System.ClientModel.ApiKeyCredential(raceSummaryApiKey);
        var client = new OpenAIClient(credential, options);
        return client.GetChatClient(model).AsIChatClient();
    });
    builder.Services.AddScoped<IRaceSummaryAgent, OpenAiRaceSummaryAgent>();
    builder.Services.AddScoped<RaceSummaryService>();
}

var app = builder.Build();

// ── Migrations & seed ────────────────────────────────────────────────────
if (Environment.GetEnvironmentVariable("SKIP_DB_MIGRATION") != "true")
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    await db.Database.MigrateAsync();

    var hypertablesSql = await File.ReadAllTextAsync(
        Path.Combine(AppContext.BaseDirectory, "Data", "Migrations", "hypertables.sql"));
    await db.Database.ExecuteSqlRawAsync(hypertablesSql);

    if (authOptions.IsSingleUser)
    {
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

// ── Pipeline ─────────────────────────────────────────────────────────────
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi().WithDocumentPerVersion();
    app.MapScalarApiReference();
    app.MapGet("/", ctx => { ctx.Response.Redirect("/scalar/v1"); return Task.CompletedTask; });
    app.MapGet("/swagger", ctx => { ctx.Response.Redirect("/scalar/v1"); return Task.CompletedTask; });
}

app.UseMiddleware<SecurityHeadersMiddleware>();
app.UseCors();
app.UseRateLimiter();

app.UseAuthentication();
app.UseMiddleware<SingleUserMiddleware>();
app.UseMiddleware<CsrfMiddleware>();
app.UseAuthorization();

app.UseResponseCompression();

app.MapControllers();

app.Run();

static async Task SeedRolesAndAdminAsync(IServiceProvider sp, AuthOptions authOptions)
{
    var roleManager = sp.GetRequiredService<RoleManager<IdentityRole<Guid>>>();
    foreach (var role in new[] { AuthConstants.AdminRole, AuthConstants.UserRole })
    {
        if (!await roleManager.RoleExistsAsync(role))
            await roleManager.CreateAsync(new IdentityRole<Guid>(role) { Id = Guid.CreateVersion7() });
    }

    var userManager = sp.GetRequiredService<UserManager<AppUser>>();
    var logger = sp.GetRequiredService<ILoggerFactory>().CreateLogger("AdminBootstrap");
    var webOpts = sp.GetRequiredService<IOptions<WebOptions>>().Value;

    var anyAdmin = (await userManager.GetUsersInRoleAsync(AuthConstants.AdminRole)).Any();
    if (anyAdmin) return;

    var email = authOptions.Admin.Email;
    if (string.IsNullOrWhiteSpace(email))
    {
        logger.LogWarning("No Admin role members exist and Auth:Admin:Email is not set. Set Auth__Admin__Email (and optionally Auth__Admin__Password) to bootstrap an admin.");
        return;
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
        await userManager.AddToRoleAsync(admin, AuthConstants.AdminRole);

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
