namespace SailSight.Shared.Dtos.Me;

public record UserProfileDto(
    Guid Id,
    string Email,
    string DisplayName,
    IReadOnlyList<string> Roles,
    DateTimeOffset CreatedAt);

public record UpdateProfileRequest(string DisplayName);

public record ChangePasswordRequest(string CurrentPassword, string NewPassword);
