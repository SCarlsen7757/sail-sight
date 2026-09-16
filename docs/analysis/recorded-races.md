# Recorded race analysis

SailSight analyzes VKX exports after sailing. Analysis uses a course explicitly assigned to the race; a session course is not inherited.

## Geometry and meaning

Mark visits require entry into and exit from the configured rounding radius. Passing side comes from signed angular movement of the GPS track around the mark in a local east/north plane: counterclockwise is port, clockwise is starboard. At least 15 degrees of net movement is required. More than 15 degrees of opposing movement, a track segment within 2 metres of the mark, or an incomplete visit is uncertain. These are analysis heuristics, not certification of racing-rule compliance.

Gate passage requires a side change through the finite segment joining distinct endpoints. A single sample exactly on that segment can establish a crossing when its neighbors are on opposite sides. Touching or travelling along the line does not count. Either crossing direction is accepted; VMG is toward the gate midpoint.

Analysis stops at the first unreached, wrong-side, or uncertain target. Earlier verified legs retain their metrics. Later legs are unresolved, with null metrics. An unfinished timer-defined race has no leg results. GPS never defines race start or end.

Approach duration runs from the start gun (first leg) or previous mark exit to target entry. Rounding intervals are separate. Gate crossing both ends the approach and starts the next leg. Distance follows the recorded track; average speed and VMG use time-weighted trapezoidal integration with interpolated boundary samples. All calculations use SI values and COG, not heading.

## Recalculation

Leg results are derived data stamped with an analysis revision. At normal API startup, a sequential backfill rebuilds every race whose revision is outdated before requests are served; migration-only runs and OpenAPI generation skip it. Failed races are logged, unavailable, and retried on the next startup. Installations holding many races can therefore take longer to start after a revision bump.

Course assignment/removal and relevant course/mark edits invalidate results before recalculation; uploaded sessions and telemetry are never touched. When changing calculation semantics, raise the revision so existing results are rebuilt rather than migrated. Verify the fresh-database path after any schema change.

## Replay

Both public and authenticated race viewers show the same leg summary. Select a leg to pause and seek to its approach start. During recorded playback, the active target is highlighted on the map and the VMG readout uses raw speed and COG interpolated at the cursor. Gates are explicitly labelled as midpoint targets.

The chart smooths each valid approach separately, preserving gaps at target changes, rounding intervals, and missing samples. Neither the readout nor the chart supplies values during countdown or unresolved legs. Summary metrics remain the backend's unsmoothed, time-weighted values. Course assignment is managed on the session page for each race.
