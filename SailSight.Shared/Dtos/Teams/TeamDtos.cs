namespace SailSight.Shared.Dtos.Teams;

public record TeamDto(Guid Id, string Name, DateTimeOffset CreatedAt, int MemberCount, string Role);
public record TeamDetailDto(Guid Id, string Name, DateTimeOffset CreatedAt, IReadOnlyList<TeamMemberDto> Members);
public record TeamMemberDto(Guid UserId, string Email, string DisplayName, string Role, DateTimeOffset JoinedAt);
public record CreateTeamRequest(string Name);
public record UpdateTeamRequest(string Name);
public record InviteMemberRequest(string Email, string Role);
public record TeamInviteDto(Guid Id, string Email, string DisplayName, string Role, DateTimeOffset CreatedAt, DateTimeOffset ExpiresAt);
public record UpdateMemberRoleRequest(string Role);

// Returned to the current user for invites they have received
public record PendingTeamInviteDto(Guid Id, Guid TeamId, string TeamName, string InvitedByEmail, string Role, DateTimeOffset CreatedAt, DateTimeOffset ExpiresAt);

// Returned to team admins listing pending invites for their team
public record TeamPendingInviteDto(Guid Id, Guid InvitedUserId, string Email, string DisplayName, string Role, DateTimeOffset CreatedAt, DateTimeOffset ExpiresAt);

