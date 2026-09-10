using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SailSight.Api.Migrations
{
    /// <inheritdoc />
    public partial class PreserveTeamHistoryAfterAccountDeletion : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_teams_users_created_by_user_id",
                table: "teams");

            migrationBuilder.AlterColumn<Guid>(
                name: "created_by_user_id",
                table: "teams",
                type: "uuid",
                nullable: true,
                oldClrType: typeof(Guid),
                oldType: "uuid");

            migrationBuilder.AddForeignKey(
                name: "FK_teams_users_created_by_user_id",
                table: "teams",
                column: "created_by_user_id",
                principalTable: "users",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_teams_users_created_by_user_id",
                table: "teams");

            migrationBuilder.AlterColumn<Guid>(
                name: "created_by_user_id",
                table: "teams",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"),
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);

            migrationBuilder.AddForeignKey(
                name: "FK_teams_users_created_by_user_id",
                table: "teams",
                column: "created_by_user_id",
                principalTable: "users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }
    }
}
