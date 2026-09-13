namespace SailSight.Shared.Dtos.Admin;

public record AdminUserDto(
    Guid Id,
    string Email,
    string DisplayName,
    IReadOnlyList<string> Roles,
    bool HasPassword,
    DateTimeOffset CreatedAt);

public record CreateUserRequest(string Email, string DisplayName, string? Role);

public record CreateUserResponse(AdminUserDto User, string SetupUrl);

public record UpdateUserRequest(string? DisplayName, string? Role);

public record RegenerateSetupLinkResponse(string SetupUrl);

public record AdminStatsDto(int UserCount, int TeamCount);
