namespace SailSight.Shared.Dtos.Admin;

public record InvitationDto(
    Guid Id,
    string Role,
    int? MaxUses,
    int UsedCount,
    DateTimeOffset? ExpiresAt,
    DateTimeOffset CreatedAt,
    DateTimeOffset? RevokedAt,
    string? Note,
    bool IsActive,
    int? RemainingUses);

public record InvitationWithUrlDto(InvitationDto Invitation, string Url);

public record CreateInvitationRequest(
    string? Role,
    int? MaxUses,
    int? ExpiresInDays,
    string? Note);

public record InvitationValidateResponse(
    string Role,
    int? RemainingUses,
    DateTimeOffset? ExpiresAt);

public record RedeemInvitationRequest(
    string Token,
    string Email,
    string DisplayName,
    string Password);
