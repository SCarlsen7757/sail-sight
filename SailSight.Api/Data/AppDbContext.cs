using Microsoft.AspNetCore.DataProtection.EntityFrameworkCore;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using SailSight.Api.Models.Entities;

namespace SailSight.Api.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options)
    : IdentityDbContext<AppUser, IdentityRole<Guid>, Guid>(options), IDataProtectionKeyContext
{
    public DbSet<DataProtectionKey> DataProtectionKeys => Set<DataProtectionKey>();

    // Relational tables
    public DbSet<Boat> Boats => Set<Boat>();
    public DbSet<BoatClass> BoatClasses => Set<BoatClass>();
    public DbSet<Mark> Marks => Set<Mark>();
    public DbSet<Course> Courses => Set<Course>();
    public DbSet<CourseLeg> CourseLegs => Set<CourseLeg>();
    public DbSet<Session> Sessions => Set<Session>();
    public DbSet<Race> Races => Set<Race>();
    public DbSet<RaceSummaryReport> RaceSummaryReports => Set<RaceSummaryReport>();
    public DbSet<RaceLegPerformance> RaceLegPerformances => Set<RaceLegPerformance>();

    // Multi-user / teams
    public DbSet<Team> Teams => Set<Team>();
    public DbSet<TeamMember> TeamMembers => Set<TeamMember>();
    public DbSet<TeamInvite> TeamInvites => Set<TeamInvite>();
    public DbSet<Invitation> Invitations => Set<Invitation>();
    public DbSet<SessionShare> SessionShares => Set<SessionShare>();
    public DbSet<PersonalAccessToken> PersonalAccessTokens => Set<PersonalAccessToken>();
    public DbSet<AuditEvent> AuditEvents => Set<AuditEvent>();
    public DbSet<BoatClassRequest> BoatClassRequests => Set<BoatClassRequest>();

    // Hypertables
    public DbSet<PositionReading> Positions => Set<PositionReading>();
    public DbSet<WindReading> WindReadings => Set<WindReading>();
    public DbSet<SpeedThroughWaterReading> SpeedThroughWater => Set<SpeedThroughWaterReading>();
    public DbSet<DepthReading> DepthReadings => Set<DepthReading>();
    public DbSet<TemperatureReading> TemperatureReadings => Set<TemperatureReading>();
    public DbSet<LoadReading> LoadReadings => Set<LoadReading>();
    public DbSet<DeclinationReading> Declinations => Set<DeclinationReading>();
    public DbSet<RaceTimerEvent> RaceTimerEvents => Set<RaceTimerEvent>();
    public DbSet<LinePositionReading> LinePositions => Set<LinePositionReading>();
    public DbSet<ShiftAngleReading> ShiftAngles => Set<ShiftAngleReading>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // ── Identity tables: rename to snake_case for house style ───────────
        modelBuilder.Entity<AppUser>(e =>
        {
            e.ToTable("users");
            e.Property(u => u.DisplayName).HasColumnName("display_name");
            e.Property(u => u.CreatedAt).HasColumnName("created_at");
        });
        modelBuilder.Entity<IdentityRole<Guid>>(e => e.ToTable("roles"));
        modelBuilder.Entity<IdentityUserRole<Guid>>(e => e.ToTable("user_roles"));
        modelBuilder.Entity<IdentityUserClaim<Guid>>(e => e.ToTable("user_claims"));
        modelBuilder.Entity<IdentityUserLogin<Guid>>(e => e.ToTable("user_logins"));
        modelBuilder.Entity<IdentityUserToken<Guid>>(e => e.ToTable("user_tokens"));
        modelBuilder.Entity<IdentityRoleClaim<Guid>>(e => e.ToTable("role_claims"));

        // ── Boat Classes ─────────────────────────────────────────────────────
        modelBuilder.Entity<BoatClass>(e =>
        {
            e.ToTable("boat_classes");
            e.HasKey(bc => bc.Id);
            e.Property(bc => bc.Id).HasColumnName("id").ValueGeneratedNever();
            e.Property(bc => bc.Name).HasColumnName("name").IsRequired();
            e.Property(bc => bc.Length).HasColumnName("length");
            e.Property(bc => bc.Width).HasColumnName("width");
            e.Property(bc => bc.Weight).HasColumnName("weight");
        });

        modelBuilder.Entity<BoatClassRequest>(e =>
        {
            e.ToTable("boat_class_requests");
            e.HasKey(r => r.Id);
            e.Property(r => r.Id).HasColumnName("id").ValueGeneratedNever();
            e.Property(r => r.RequestedByUserId).HasColumnName("requested_by_user_id");
            e.Property(r => r.Name).HasColumnName("name").IsRequired();
            e.Property(r => r.Length).HasColumnName("length");
            e.Property(r => r.Width).HasColumnName("width");
            e.Property(r => r.Weight).HasColumnName("weight");
            e.Property(r => r.Notes).HasColumnName("notes");
            e.Property(r => r.Status).HasColumnName("status").HasConversion<int>();
            e.Property(r => r.ReviewedByUserId).HasColumnName("reviewed_by_user_id");
            e.Property(r => r.ReviewedAt).HasColumnName("reviewed_at");
            e.Property(r => r.CreatedAt).HasColumnName("created_at");
            e.HasOne(r => r.RequestedByUser).WithMany().HasForeignKey(r => r.RequestedByUserId).OnDelete(DeleteBehavior.Cascade);
            e.HasIndex(r => r.RequestedByUserId);
            e.HasIndex(r => r.Status);
        });

        // ── Boats ───────────────────────────────────────────────────────────
        modelBuilder.Entity<Boat>(e =>
        {
            e.ToTable("boats");
            e.HasKey(b => b.Id);
            e.Property(b => b.Id).HasColumnName("id").ValueGeneratedNever();
            e.Property(b => b.OwnerUserId).HasColumnName("owner_user_id");
            e.Property(b => b.Name).HasColumnName("name").IsRequired();
            e.Property(b => b.SailNumber).HasColumnName("sail_number");
            e.Property(b => b.BoatClassId).HasColumnName("boat_class_id");
            e.Property(b => b.Description).HasColumnName("description");
            e.Property(b => b.IsPublic).HasColumnName("is_public");
            e.Property(b => b.CreatedAt).HasColumnName("created_at");
            e.HasOne(b => b.BoatClass).WithMany().HasForeignKey(b => b.BoatClassId).OnDelete(DeleteBehavior.Restrict);
            e.HasIndex(b => b.OwnerUserId);
        });

        // ── Marks ───────────────────────────────────────────────────────────
        modelBuilder.Entity<Mark>(e =>
        {
            e.ToTable("marks");
            e.HasKey(m => m.Id);
            e.Property(m => m.Id).HasColumnName("id").ValueGeneratedNever();
            e.Property(m => m.OwnerUserId).HasColumnName("owner_user_id");
            e.Property(m => m.Name).HasColumnName("name").IsRequired();
            e.Property(m => m.ActiveFrom).HasColumnName("active_from");
            e.Property(m => m.ActiveUntil).HasColumnName("active_until");
            e.Property(m => m.Latitude).HasColumnName("latitude");
            e.Property(m => m.Longitude).HasColumnName("longitude");
            e.Property(m => m.DefaultRoundingRadiusMeters).HasColumnName("default_rounding_radius_meters");
            e.Property(m => m.Description).HasColumnName("description");
            e.HasIndex(m => new { m.OwnerUserId, m.Name, m.ActiveFrom }).IsUnique();
        });

        // ── Courses ─────────────────────────────────────────────────────────
        modelBuilder.Entity<Course>(e =>
        {
            e.ToTable("courses");
            e.HasKey(c => c.Id);
            e.Property(c => c.Id).HasColumnName("id").ValueGeneratedNever();
            e.Property(c => c.OwnerUserId).HasColumnName("owner_user_id");
            e.Property(c => c.Name).HasColumnName("name").IsRequired();
            e.Property(c => c.Year).HasColumnName("year");
            e.Property(c => c.Description).HasColumnName("description");
            e.Property(c => c.CreatedAt).HasColumnName("created_at");
            e.Property(c => c.StartLineSource).HasColumnName("start_line_source").HasConversion<string>();
            e.Property(c => c.StartMark1Id).HasColumnName("start_mark1_id");
            e.Property(c => c.StartMark2Id).HasColumnName("start_mark2_id");
            e.Property(c => c.FinishLineSource).HasColumnName("finish_line_source").HasConversion<string>();
            e.Property(c => c.FinishMark1Id).HasColumnName("finish_mark1_id");
            e.Property(c => c.FinishMark2Id).HasColumnName("finish_mark2_id");
            e.HasOne(c => c.StartMark1).WithMany().HasForeignKey(c => c.StartMark1Id).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(c => c.StartMark2).WithMany().HasForeignKey(c => c.StartMark2Id).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(c => c.FinishMark1).WithMany().HasForeignKey(c => c.FinishMark1Id).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(c => c.FinishMark2).WithMany().HasForeignKey(c => c.FinishMark2Id).OnDelete(DeleteBehavior.Restrict);
            e.HasIndex(c => c.OwnerUserId);
        });

        modelBuilder.Entity<CourseLeg>(e =>
        {
            e.ToTable("course_legs");
            e.HasKey(cl => cl.Id);
            e.Property(cl => cl.Id).HasColumnName("id").ValueGeneratedNever();
            e.Property(cl => cl.CourseId).HasColumnName("course_id");
            e.Property(cl => cl.MarkId).HasColumnName("mark_id");
            e.Property(cl => cl.GateMarkId).HasColumnName("gate_mark_id");
            e.Property(cl => cl.SortOrder).HasColumnName("sort_order");
            e.Property(cl => cl.LegName).HasColumnName("leg_name");
            e.Property(cl => cl.OverrideRoundingRadiusMeters).HasColumnName("override_rounding_radius_meters");
            e.Property(cl => cl.LegType).HasColumnName("leg_type").HasConversion<string>();
            e.Property(cl => cl.PassingSide).HasColumnName("passing_side").HasConversion<string>();
            e.HasOne(cl => cl.Course).WithMany(c => c.Legs).HasForeignKey(cl => cl.CourseId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(cl => cl.Mark).WithMany(m => m.CourseLegs).HasForeignKey(cl => cl.MarkId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(cl => cl.GateMark).WithMany().HasForeignKey(cl => cl.GateMarkId).OnDelete(DeleteBehavior.Restrict);
            e.HasIndex(cl => new { cl.CourseId, cl.SortOrder }).IsUnique();
        });

        // ── Sessions ────────────────────────────────────────────────────────
        modelBuilder.Entity<Session>(e =>
        {
            e.ToTable("sessions");
            e.HasKey(s => s.Id);
            e.Property(s => s.Id).HasColumnName("id").ValueGeneratedNever();
            e.Property(s => s.OwnerUserId).HasColumnName("owner_user_id");
            e.Property(s => s.BoatId).HasColumnName("boat_id");
            e.Property(s => s.CourseId).HasColumnName("course_id");
            e.Property(s => s.FileName).HasColumnName("file_name").IsRequired();
            e.Property(s => s.DisplayName).HasColumnName("display_name");
            e.Property(s => s.ContentHash).HasColumnName("content_hash").IsRequired();
            e.HasIndex(s => new { s.OwnerUserId, s.ContentHash }).IsUnique();
            e.HasIndex(s => s.OwnerUserId);
            e.Property(s => s.FormatVersion).HasColumnName("format_version");
            e.Property(s => s.TelemetryRateHz).HasColumnName("telemetry_rate_hz");
            e.Property(s => s.IsFixedToBodyFrame).HasColumnName("is_fixed_to_body_frame");
            e.Property(s => s.IsPublic).HasColumnName("is_public");
            e.Property(s => s.StartedAt).HasColumnName("started_at");
            e.Property(s => s.EndedAt).HasColumnName("ended_at");
            e.Property(s => s.UploadedAt).HasColumnName("uploaded_at");
            e.Property(s => s.Notes).HasColumnName("notes");
            e.HasOne(s => s.Boat).WithMany(b => b.Sessions).HasForeignKey(s => s.BoatId).OnDelete(DeleteBehavior.SetNull);
            e.HasOne(s => s.Course).WithMany(c => c.Sessions).HasForeignKey(s => s.CourseId).OnDelete(DeleteBehavior.SetNull);
        });

        // ── Races ───────────────────────────────────────────────────────────
        modelBuilder.Entity<Race>(e =>
        {
            e.ToTable("races");
            e.HasKey(r => r.Id);
            e.Property(r => r.Id).HasColumnName("id").ValueGeneratedNever();
            e.Property(r => r.SessionId).HasColumnName("session_id");
            e.Property(r => r.CourseId).HasColumnName("course_id");
            e.Property(r => r.RaceNumber).HasColumnName("race_number");
            e.Property(r => r.CountdownStartedAt).HasColumnName("countdown_started_at");
            e.Property(r => r.CountdownDurationSeconds).HasColumnName("countdown_duration_seconds");
            e.Property(r => r.StartedAt).HasColumnName("started_at");
            e.Property(r => r.EndedAt).HasColumnName("ended_at");
            e.Property(r => r.SailedDistanceMeters).HasColumnName("sailed_distance_meters");
            e.Property(r => r.MaxSpeedOverGround).HasColumnName("max_speed_over_ground");
            e.Property(r => r.Notes).HasColumnName("notes");
            e.Property(r => r.AnalysisStatus).HasColumnName("analysis_status").HasConversion<string>();
            e.HasIndex(r => new { r.SessionId, r.RaceNumber }).IsUnique();
            e.HasOne(r => r.Session).WithMany(s => s.Races).HasForeignKey(r => r.SessionId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(r => r.Course).WithMany(c => c.Races).HasForeignKey(r => r.CourseId).OnDelete(DeleteBehavior.SetNull);
        });

        // ── Race Leg Performance ─────────────────────────────────────────
        modelBuilder.Entity<RaceLegPerformance>(e =>
        {
            e.ToTable("race_leg_performances");
            e.HasKey(p => p.Id);
            e.Property(p => p.Id).HasColumnName("id").ValueGeneratedNever();
            e.Property(p => p.RaceId).HasColumnName("race_id");
            e.Property(p => p.CourseLegId).HasColumnName("course_leg_id");
            e.Property(p => p.LegIndex).HasColumnName("leg_index");
            e.Property(p => p.Status).HasColumnName("status").HasConversion<string>();
            e.Property(p => p.ExitedPreviousMarkAt).HasColumnName("exited_previous_mark_at");
            e.Property(p => p.EnteredCurrentMarkAt).HasColumnName("entered_current_mark_at");
            e.Property(p => p.SailedDistanceMeters).HasColumnName("sailed_distance_meters");
            e.Property(p => p.AverageSpeedOverGround).HasColumnName("average_speed_over_ground");
            e.Property(p => p.AverageVelocityMadeGood).HasColumnName("average_velocity_made_good");
            e.Property(p => p.MaxSpeedOverGround).HasColumnName("max_speed_over_ground");
            e.HasOne(p => p.Race).WithMany(r => r.LegPerformances).HasForeignKey(p => p.RaceId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(p => p.CourseLeg).WithMany().HasForeignKey(p => p.CourseLegId).OnDelete(DeleteBehavior.Cascade);
            e.HasIndex(p => new { p.RaceId, p.LegIndex }).IsUnique();
        });

        // ── Race Summary Reports ─────────────────────────────────────────
        modelBuilder.Entity<RaceSummaryReport>(e =>
        {
            e.ToTable("race_summary_reports");
            e.HasKey(r => r.Id);
            e.Property(r => r.Id).HasColumnName("id").ValueGeneratedNever();
            e.Property(r => r.SessionId).HasColumnName("session_id");
            e.Property(r => r.RaceNumber).HasColumnName("race_number");
            e.Property(r => r.RaceId).HasColumnName("race_id");
            e.Property(r => r.Content).HasColumnName("content").IsRequired();
            e.Property(r => r.Model).HasColumnName("model").IsRequired();
            e.Property(r => r.ContextHash).HasColumnName("context_hash").IsRequired();
            e.Property(r => r.GeneratedAt).HasColumnName("generated_at");
            e.HasIndex(r => new { r.SessionId, r.RaceNumber }).IsUnique();
            e.HasIndex(r => r.RaceId).IsUnique();
            e.HasOne(r => r.Session).WithMany()
                .HasForeignKey(r => r.SessionId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(r => r.Race).WithMany()
                .HasForeignKey(r => r.RaceId).OnDelete(DeleteBehavior.NoAction);
        });

        // ── Teams ───────────────────────────────────────────────────────────
        modelBuilder.Entity<Team>(e =>
        {
            e.ToTable("teams");
            e.HasKey(t => t.Id);
            e.Property(t => t.Id).HasColumnName("id").ValueGeneratedNever();
            e.Property(t => t.Name).HasColumnName("name").IsRequired();
            e.Property(t => t.CreatedAt).HasColumnName("created_at");
            e.Property(t => t.CreatedByUserId).HasColumnName("created_by_user_id");
            e.HasIndex(t => t.CreatedByUserId);
        });

        modelBuilder.Entity<TeamMember>(e =>
        {
            e.ToTable("team_members");
            e.HasKey(tm => new { tm.TeamId, tm.UserId });
            e.Property(tm => tm.TeamId).HasColumnName("team_id");
            e.Property(tm => tm.UserId).HasColumnName("user_id");
            e.Property(tm => tm.Role).HasColumnName("role").HasConversion<int>();
            e.Property(tm => tm.JoinedAt).HasColumnName("joined_at");
            e.HasOne(tm => tm.Team).WithMany(t => t.Members).HasForeignKey(tm => tm.TeamId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(tm => tm.User).WithMany().HasForeignKey(tm => tm.UserId).OnDelete(DeleteBehavior.Cascade);
            e.HasIndex(tm => tm.UserId);
        });

        modelBuilder.Entity<TeamInvite>(e =>
        {
            e.ToTable("team_invites");
            e.HasKey(i => i.Id);
            e.Property(i => i.Id).HasColumnName("id").ValueGeneratedNever();
            e.Property(i => i.TeamId).HasColumnName("team_id");
            e.Property(i => i.InvitedUserId).HasColumnName("invited_user_id");
            e.Property(i => i.Email).HasColumnName("email").IsRequired();
            e.Property(i => i.Role).HasColumnName("role").IsRequired();
            e.Property(i => i.CreatedAt).HasColumnName("created_at");
            e.Property(i => i.ExpiresAt).HasColumnName("expires_at");
            e.Property(i => i.AcceptedAt).HasColumnName("accepted_at");
            e.Property(i => i.DeclinedAt).HasColumnName("declined_at");
            e.HasIndex(i => i.InvitedUserId);
            e.HasIndex(i => new { i.TeamId, i.InvitedUserId });
            e.HasOne(i => i.Team).WithMany(t => t.Invites).HasForeignKey(i => i.TeamId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(i => i.InvitedUser).WithMany().HasForeignKey(i => i.InvitedUserId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Invitation>(e =>
        {
            e.ToTable("invitations");
            e.HasKey(i => i.Id);
            e.Property(i => i.Id).HasColumnName("id").ValueGeneratedNever();
            e.Property(i => i.Token).HasColumnName("token").IsRequired();
            e.Property(i => i.Role).HasColumnName("role").IsRequired();
            e.Property(i => i.MaxUses).HasColumnName("max_uses");
            e.Property(i => i.UsedCount).HasColumnName("used_count");
            e.Property(i => i.ExpiresAt).HasColumnName("expires_at");
            e.Property(i => i.CreatedAt).HasColumnName("created_at");
            e.Property(i => i.CreatedByUserId).HasColumnName("created_by_user_id");
            e.Property(i => i.RevokedAt).HasColumnName("revoked_at");
            e.Property(i => i.Note).HasColumnName("note");
            e.HasIndex(i => i.Token).IsUnique();
        });

        modelBuilder.Entity<SessionShare>(e =>
        {
            e.ToTable("session_shares");
            e.HasKey(s => new { s.SessionId, s.TeamId });
            e.Property(s => s.SessionId).HasColumnName("session_id");
            e.Property(s => s.TeamId).HasColumnName("team_id");
            e.Property(s => s.CreatedAt).HasColumnName("created_at");
            e.HasOne(s => s.Session).WithMany(sess => sess.Shares).HasForeignKey(s => s.SessionId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(s => s.Team).WithMany().HasForeignKey(s => s.TeamId).OnDelete(DeleteBehavior.Cascade);
            e.HasIndex(s => s.TeamId);
        });

        modelBuilder.Entity<PersonalAccessToken>(e =>
        {
            e.ToTable("personal_access_tokens");
            e.HasKey(p => p.Id);
            e.Property(p => p.Id).HasColumnName("id").ValueGeneratedNever();
            e.Property(p => p.UserId).HasColumnName("user_id");
            e.Property(p => p.Name).HasColumnName("name").IsRequired();
            e.Property(p => p.TokenHash).HasColumnName("token_hash").IsRequired();
            e.Property(p => p.TokenPrefix).HasColumnName("token_prefix").IsRequired();
            e.Property(p => p.CreatedAt).HasColumnName("created_at");
            e.Property(p => p.ExpiresAt).HasColumnName("expires_at");
            e.Property(p => p.LastUsedAt).HasColumnName("last_used_at");
            e.Property(p => p.RevokedAt).HasColumnName("revoked_at");
            e.HasIndex(p => p.UserId);
            e.HasIndex(p => p.TokenHash).IsUnique();
        });

        modelBuilder.Entity<AuditEvent>(e =>
        {
            e.ToTable("audit_events");
            e.HasKey(a => a.Id);
            e.Property(a => a.Id).HasColumnName("id").ValueGeneratedNever();
            e.Property(a => a.UserId).HasColumnName("user_id");
            e.Property(a => a.Action).HasColumnName("action").IsRequired();
            e.Property(a => a.EntityType).HasColumnName("entity_type");
            e.Property(a => a.EntityId).HasColumnName("entity_id");
            e.Property(a => a.At).HasColumnName("at");
            e.Property(a => a.IpAddress).HasColumnName("ip_address");
            e.Property(a => a.Details).HasColumnName("details");
            e.HasIndex(a => a.UserId);
            e.HasIndex(a => a.At);
        });

        // ── Hypertables ─────────────────────────────────────────────────────
        // TimescaleDB hypertables have no traditional PK; use (time, session_id) composite.

        modelBuilder.Entity<PositionReading>(e =>
        {
            e.ToTable("positions");
            e.HasKey(p => new { p.Time, p.SessionId });
            e.Property(p => p.Time).HasColumnName("time");
            e.Property(p => p.SessionId).HasColumnName("session_id");
            e.Property(p => p.Latitude).HasColumnName("latitude");
            e.Property(p => p.Longitude).HasColumnName("longitude");
            e.Property(p => p.SpeedOverGround).HasColumnName("speed_over_ground");
            e.Property(p => p.CourseOverGround).HasColumnName("course_over_ground");
            e.Property(p => p.Altitude).HasColumnName("altitude");
            e.Property(p => p.QuaternionW).HasColumnName("quaternion_w");
            e.Property(p => p.QuaternionX).HasColumnName("quaternion_x");
            e.Property(p => p.QuaternionY).HasColumnName("quaternion_y");
            e.Property(p => p.QuaternionZ).HasColumnName("quaternion_z");
            e.HasOne(p => p.Session).WithMany().HasForeignKey(p => p.SessionId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<WindReading>(e =>
        {
            e.ToTable("wind_readings");
            e.HasKey(w => new { w.Time, w.SessionId });
            e.Property(w => w.Time).HasColumnName("time");
            e.Property(w => w.SessionId).HasColumnName("session_id");
            e.Property(w => w.WindDirection).HasColumnName("wind_direction");
            e.Property(w => w.WindSpeed).HasColumnName("wind_speed");
            e.HasOne(w => w.Session).WithMany().HasForeignKey(w => w.SessionId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<SpeedThroughWaterReading>(e =>
        {
            e.ToTable("speed_through_water");
            e.HasKey(s => new { s.Time, s.SessionId });
            e.Property(s => s.Time).HasColumnName("time");
            e.Property(s => s.SessionId).HasColumnName("session_id");
            e.Property(s => s.ForwardSpeed).HasColumnName("forward_speed");
            e.Property(s => s.HorizontalSpeed).HasColumnName("horizontal_speed");
            e.HasOne(s => s.Session).WithMany().HasForeignKey(s => s.SessionId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<DepthReading>(e =>
        {
            e.ToTable("depth_readings");
            e.HasKey(d => new { d.Time, d.SessionId });
            e.Property(d => d.Time).HasColumnName("time");
            e.Property(d => d.SessionId).HasColumnName("session_id");
            e.Property(d => d.Depth).HasColumnName("depth");
            e.HasOne(d => d.Session).WithMany().HasForeignKey(d => d.SessionId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<TemperatureReading>(e =>
        {
            e.ToTable("temperature_readings");
            e.HasKey(t => new { t.Time, t.SessionId });
            e.Property(t => t.Time).HasColumnName("time");
            e.Property(t => t.SessionId).HasColumnName("session_id");
            e.Property(t => t.Temperature).HasColumnName("temperature");
            e.HasOne(t => t.Session).WithMany().HasForeignKey(t => t.SessionId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<LoadReading>(e =>
        {
            e.ToTable("load_readings");
            e.HasKey(l => new { l.Time, l.SessionId });
            e.Property(l => l.Time).HasColumnName("time");
            e.Property(l => l.SessionId).HasColumnName("session_id");
            e.Property(l => l.SensorName).HasColumnName("sensor_name");
            e.Property(l => l.Load).HasColumnName("load");
            e.HasOne(l => l.Session).WithMany().HasForeignKey(l => l.SessionId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<DeclinationReading>(e =>
        {
            e.ToTable("declinations");
            e.HasKey(d => new { d.Time, d.SessionId });
            e.Property(d => d.Time).HasColumnName("time");
            e.Property(d => d.SessionId).HasColumnName("session_id");
            e.Property(d => d.DeclinationOffset).HasColumnName("declination_offset");
            e.Property(d => d.Latitude).HasColumnName("latitude");
            e.Property(d => d.Longitude).HasColumnName("longitude");
            e.HasOne(d => d.Session).WithMany().HasForeignKey(d => d.SessionId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<RaceTimerEvent>(e =>
        {
            e.ToTable("race_timer_events");
            e.HasKey(r => new { r.Time, r.SessionId });
            e.Property(r => r.Time).HasColumnName("time");
            e.Property(r => r.SessionId).HasColumnName("session_id");
            e.Property(r => r.EventType).HasColumnName("event_type");
            e.Property(r => r.TimerValue).HasColumnName("timer_value");
            e.HasOne(r => r.Session).WithMany().HasForeignKey(r => r.SessionId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<LinePositionReading>(e =>
        {
            e.ToTable("line_positions");
            e.HasKey(l => new { l.Time, l.SessionId });
            e.Property(l => l.Time).HasColumnName("time");
            e.Property(l => l.SessionId).HasColumnName("session_id");
            e.Property(l => l.LineEnd).HasColumnName("line_end");
            e.Property(l => l.Latitude).HasColumnName("latitude");
            e.Property(l => l.Longitude).HasColumnName("longitude");
            e.HasOne(l => l.Session).WithMany().HasForeignKey(l => l.SessionId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<ShiftAngleReading>(e =>
        {
            e.ToTable("shift_angles");
            e.HasKey(s => new { s.Time, s.SessionId });
            e.Property(s => s.Time).HasColumnName("time");
            e.Property(s => s.SessionId).HasColumnName("session_id");
            e.Property(s => s.IsPort).HasColumnName("is_port");
            e.Property(s => s.IsManual).HasColumnName("is_manual");
            e.Property(s => s.TrueHeading).HasColumnName("true_heading");
            e.Property(s => s.SpeedOverGround).HasColumnName("speed_over_ground");
            e.HasOne(s => s.Session).WithMany().HasForeignKey(s => s.SessionId).OnDelete(DeleteBehavior.Cascade);
        });
    }
}
