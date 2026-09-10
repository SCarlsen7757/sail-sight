using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SailSight.Api.Migrations
{
    /// <inheritdoc />
    public partial class SecurityOwnershipAndDeferredRemoval : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "personal_access_tokens");

            migrationBuilder.DropTable(
                name: "race_summary_reports");

            migrationBuilder.AddForeignKey(
                name: "FK_boats_users_owner_user_id",
                table: "boats",
                column: "owner_user_id",
                principalTable: "users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_courses_users_owner_user_id",
                table: "courses",
                column: "owner_user_id",
                principalTable: "users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_marks_users_owner_user_id",
                table: "marks",
                column: "owner_user_id",
                principalTable: "users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_sessions_users_owner_user_id",
                table: "sessions",
                column: "owner_user_id",
                principalTable: "users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_teams_users_created_by_user_id",
                table: "teams",
                column: "created_by_user_id",
                principalTable: "users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_boats_users_owner_user_id",
                table: "boats");

            migrationBuilder.DropForeignKey(
                name: "FK_courses_users_owner_user_id",
                table: "courses");

            migrationBuilder.DropForeignKey(
                name: "FK_marks_users_owner_user_id",
                table: "marks");

            migrationBuilder.DropForeignKey(
                name: "FK_sessions_users_owner_user_id",
                table: "sessions");

            migrationBuilder.DropForeignKey(
                name: "FK_teams_users_created_by_user_id",
                table: "teams");

            migrationBuilder.CreateTable(
                name: "personal_access_tokens",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    expires_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    last_used_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    name = table.Column<string>(type: "text", nullable: false),
                    revoked_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    token_hash = table.Column<string>(type: "text", nullable: false),
                    token_prefix = table.Column<string>(type: "text", nullable: false),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_personal_access_tokens", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "race_summary_reports",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    race_id = table.Column<Guid>(type: "uuid", nullable: false),
                    session_id = table.Column<Guid>(type: "uuid", nullable: false),
                    content = table.Column<string>(type: "text", nullable: false),
                    context_hash = table.Column<string>(type: "text", nullable: false),
                    generated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    model = table.Column<string>(type: "text", nullable: false),
                    race_number = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_race_summary_reports", x => x.id);
                    table.ForeignKey(
                        name: "FK_race_summary_reports_races_race_id",
                        column: x => x.race_id,
                        principalTable: "races",
                        principalColumn: "id");
                    table.ForeignKey(
                        name: "FK_race_summary_reports_sessions_session_id",
                        column: x => x.session_id,
                        principalTable: "sessions",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_personal_access_tokens_token_hash",
                table: "personal_access_tokens",
                column: "token_hash",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_personal_access_tokens_user_id",
                table: "personal_access_tokens",
                column: "user_id");

            migrationBuilder.CreateIndex(
                name: "IX_race_summary_reports_race_id",
                table: "race_summary_reports",
                column: "race_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_race_summary_reports_session_id_race_number",
                table: "race_summary_reports",
                columns: new[] { "session_id", "race_number" },
                unique: true);
        }
    }
}
