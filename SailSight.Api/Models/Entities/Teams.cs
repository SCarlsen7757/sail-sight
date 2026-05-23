namespace SailSight.Api.Models.Entities;

public enum TeamRole
{
    Member = 0,
    Admin = 1,
    Owner = 2,
}

public class Team
{
    public Guid Id { get; set; } = Guid.CreateVersion7();
    public string Name { get; set; } = string.Empty;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public Guid CreatedByUserId { get; set; }

    public ICollection<TeamMember> Members { get; set; } = [];
    public ICollection<TeamInvite> Invites { get; set; } = [];
}

public class TeamMember
{
    public Guid TeamId { get; set; }
    public Guid UserId { get; set; }
    public TeamRole Role { get; set; } = TeamRole.Member;
    public DateTimeOffset JoinedAt { get; set; } = DateTimeOffset.UtcNow;

    public Team Team { get; set; } = null!;
    public AppUser User { get; set; } = null!;
}

public class TeamInvite
{
    public Guid Id { get; set; } = Guid.CreateVersion7();
    public Guid TeamId { get; set; }
    public Guid InvitedUserId { get; set; }
    public string Email { get; set; } = string.Empty;
    public string Role { get; set; } = "Member";
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset ExpiresAt { get; set; }
    public DateTimeOffset? AcceptedAt { get; set; }
    public DateTimeOffset? DeclinedAt { get; set; }

    public Team Team { get; set; } = null!;
    public AppUser InvitedUser { get; set; } = null!;
}
