namespace SailSight.Shared.Dtos.Tokens;

public record PersonalAccessTokenDto(Guid Id, string Name, string TokenPrefix, DateTimeOffset CreatedAt, DateTimeOffset? ExpiresAt, DateTimeOffset? LastUsedAt, DateTimeOffset? RevokedAt);
public record CreatePatRequest(string Name, int? ExpiresInDays);
public record CreatePatResponse(PersonalAccessTokenDto Token, string PlaintextToken);
