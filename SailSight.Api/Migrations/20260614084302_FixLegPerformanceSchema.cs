using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SailSight.Api.Migrations
{
    /// <inheritdoc />
    public partial class FixLegPerformanceSchema : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_course_legs_marks_mark_id",
                table: "course_legs");

            migrationBuilder.DropForeignKey(
                name: "FK_race_leg_performances_course_legs_course_leg_id",
                table: "race_leg_performances");

            migrationBuilder.DropIndex(
                name: "IX_race_leg_performances_race_id",
                table: "race_leg_performances");

            migrationBuilder.DropIndex(
                name: "IX_course_legs_course_id",
                table: "course_legs");

            migrationBuilder.AlterColumn<string>(
                name: "status",
                table: "race_leg_performances",
                type: "text",
                nullable: false,
                oldClrType: typeof(int),
                oldType: "integer");

            migrationBuilder.CreateIndex(
                name: "IX_race_leg_performances_race_id_leg_index",
                table: "race_leg_performances",
                columns: new[] { "race_id", "leg_index" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_course_legs_course_id_sort_order",
                table: "course_legs",
                columns: new[] { "course_id", "sort_order" },
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_course_legs_marks_mark_id",
                table: "course_legs",
                column: "mark_id",
                principalTable: "marks",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_race_leg_performances_course_legs_course_leg_id",
                table: "race_leg_performances",
                column: "course_leg_id",
                principalTable: "course_legs",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_course_legs_marks_mark_id",
                table: "course_legs");

            migrationBuilder.DropForeignKey(
                name: "FK_race_leg_performances_course_legs_course_leg_id",
                table: "race_leg_performances");

            migrationBuilder.DropIndex(
                name: "IX_race_leg_performances_race_id_leg_index",
                table: "race_leg_performances");

            migrationBuilder.DropIndex(
                name: "IX_course_legs_course_id_sort_order",
                table: "course_legs");

            migrationBuilder.AlterColumn<int>(
                name: "status",
                table: "race_leg_performances",
                type: "integer",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "text");

            migrationBuilder.CreateIndex(
                name: "IX_race_leg_performances_race_id",
                table: "race_leg_performances",
                column: "race_id");

            migrationBuilder.CreateIndex(
                name: "IX_course_legs_course_id",
                table: "course_legs",
                column: "course_id");

            migrationBuilder.AddForeignKey(
                name: "FK_course_legs_marks_mark_id",
                table: "course_legs",
                column: "mark_id",
                principalTable: "marks",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_race_leg_performances_course_legs_course_leg_id",
                table: "race_leg_performances",
                column: "course_leg_id",
                principalTable: "course_legs",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);
        }
    }
}
