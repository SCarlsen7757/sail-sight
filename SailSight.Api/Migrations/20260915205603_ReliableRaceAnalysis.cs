using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SailSight.Api.Migrations
{
    /// <inheritdoc />
    public partial class ReliableRaceAnalysis : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Derived data only: old statuses/metrics must not survive the new calculation semantics.
            migrationBuilder.Sql("DELETE FROM race_leg_performances;");
            migrationBuilder.AddColumn<string>(
                name: "analysis_reason",
                table: "races",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "analysis_revision",
                table: "races",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AlterColumn<double>(
                name: "sailed_distance_meters",
                table: "race_leg_performances",
                type: "double precision",
                nullable: true,
                oldClrType: typeof(double),
                oldType: "double precision");

            migrationBuilder.AlterColumn<float>(
                name: "max_speed_over_ground",
                table: "race_leg_performances",
                type: "real",
                nullable: true,
                oldClrType: typeof(float),
                oldType: "real");

            migrationBuilder.AlterColumn<DateTimeOffset>(
                name: "exited_previous_mark_at",
                table: "race_leg_performances",
                type: "timestamp with time zone",
                nullable: true,
                oldClrType: typeof(DateTimeOffset),
                oldType: "timestamp with time zone");

            migrationBuilder.AlterColumn<DateTimeOffset>(
                name: "entered_current_mark_at",
                table: "race_leg_performances",
                type: "timestamp with time zone",
                nullable: true,
                oldClrType: typeof(DateTimeOffset),
                oldType: "timestamp with time zone");

            migrationBuilder.AlterColumn<float>(
                name: "average_velocity_made_good",
                table: "race_leg_performances",
                type: "real",
                nullable: true,
                oldClrType: typeof(float),
                oldType: "real");

            migrationBuilder.AlterColumn<float>(
                name: "average_speed_over_ground",
                table: "race_leg_performances",
                type: "real",
                nullable: true,
                oldClrType: typeof(float),
                oldType: "real");

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "exited_current_mark_at",
                table: "race_leg_performances",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "reason",
                table: "race_leg_performances",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "target_latitude",
                table: "race_leg_performances",
                type: "double precision",
                nullable: false,
                defaultValue: 0.0);

            migrationBuilder.AddColumn<double>(
                name: "target_longitude",
                table: "race_leg_performances",
                type: "double precision",
                nullable: false,
                defaultValue: 0.0);

            migrationBuilder.AddColumn<string>(
                name: "target_type",
                table: "race_leg_performances",
                type: "text",
                nullable: false,
                defaultValue: "");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "analysis_reason",
                table: "races");

            migrationBuilder.DropColumn(
                name: "analysis_revision",
                table: "races");

            migrationBuilder.DropColumn(
                name: "exited_current_mark_at",
                table: "race_leg_performances");

            migrationBuilder.DropColumn(
                name: "reason",
                table: "race_leg_performances");

            migrationBuilder.DropColumn(
                name: "target_latitude",
                table: "race_leg_performances");

            migrationBuilder.DropColumn(
                name: "target_longitude",
                table: "race_leg_performances");

            migrationBuilder.DropColumn(
                name: "target_type",
                table: "race_leg_performances");

            migrationBuilder.AlterColumn<double>(
                name: "sailed_distance_meters",
                table: "race_leg_performances",
                type: "double precision",
                nullable: false,
                defaultValue: 0.0,
                oldClrType: typeof(double),
                oldType: "double precision",
                oldNullable: true);

            migrationBuilder.AlterColumn<float>(
                name: "max_speed_over_ground",
                table: "race_leg_performances",
                type: "real",
                nullable: false,
                defaultValue: 0f,
                oldClrType: typeof(float),
                oldType: "real",
                oldNullable: true);

            migrationBuilder.AlterColumn<DateTimeOffset>(
                name: "exited_previous_mark_at",
                table: "race_leg_performances",
                type: "timestamp with time zone",
                nullable: false,
                defaultValue: new DateTimeOffset(new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)),
                oldClrType: typeof(DateTimeOffset),
                oldType: "timestamp with time zone",
                oldNullable: true);

            migrationBuilder.AlterColumn<DateTimeOffset>(
                name: "entered_current_mark_at",
                table: "race_leg_performances",
                type: "timestamp with time zone",
                nullable: false,
                defaultValue: new DateTimeOffset(new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)),
                oldClrType: typeof(DateTimeOffset),
                oldType: "timestamp with time zone",
                oldNullable: true);

            migrationBuilder.AlterColumn<float>(
                name: "average_velocity_made_good",
                table: "race_leg_performances",
                type: "real",
                nullable: false,
                defaultValue: 0f,
                oldClrType: typeof(float),
                oldType: "real",
                oldNullable: true);

            migrationBuilder.AlterColumn<float>(
                name: "average_speed_over_ground",
                table: "race_leg_performances",
                type: "real",
                nullable: false,
                defaultValue: 0f,
                oldClrType: typeof(float),
                oldType: "real",
                oldNullable: true);
        }
    }
}
