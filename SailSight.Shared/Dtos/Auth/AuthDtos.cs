namespace SailSight.Shared.Dtos.Auth;

public record LoginRequest(string Email, string Password);
public record AuthProvidersDto(bool Local, string Mode);
public record AuthResultDto(Guid UserId, string Email, string DisplayName);

/// <summary>
/// Response of GET /auth/setup/validate — returned when the setup token is valid,
/// so the UI can show the user's email/display name on the password-set form.
/// </summary>
public record SetupValidateResponse(Guid UserId, string Email, string DisplayName);

/// <summary>
/// Body of POST /auth/setup/complete — user redeems the setup token and sets their password.
/// </summary>
public record CompleteSetupRequest(Guid UserId, string Token, string Password);
