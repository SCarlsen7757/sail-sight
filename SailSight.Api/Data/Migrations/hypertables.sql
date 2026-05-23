-- Idempotent script to convert plain tables into TimescaleDB hypertables.
-- Run after EF Core migrations have created the column structure.

SELECT create_hypertable('positions',           'time', if_not_exists => TRUE);
SELECT create_hypertable('wind_readings',        'time', if_not_exists => TRUE);
SELECT create_hypertable('speed_through_water',  'time', if_not_exists => TRUE);
SELECT create_hypertable('depth_readings',       'time', if_not_exists => TRUE);
SELECT create_hypertable('temperature_readings', 'time', if_not_exists => TRUE);
SELECT create_hypertable('load_readings',        'time', if_not_exists => TRUE);
SELECT create_hypertable('declinations',         'time', if_not_exists => TRUE);
SELECT create_hypertable('race_timer_events',    'time', if_not_exists => TRUE);
SELECT create_hypertable('line_positions',       'time', if_not_exists => TRUE);
SELECT create_hypertable('shift_angles',         'time', if_not_exists => TRUE);

-- Per-session time-descending indexes for fast race-scoped queries.
CREATE INDEX IF NOT EXISTS ix_positions_session_time            ON positions            (session_id, time DESC);
CREATE INDEX IF NOT EXISTS ix_wind_readings_session_time        ON wind_readings        (session_id, time DESC);
CREATE INDEX IF NOT EXISTS ix_speed_through_water_session_time  ON speed_through_water  (session_id, time DESC);
CREATE INDEX IF NOT EXISTS ix_depth_readings_session_time       ON depth_readings       (session_id, time DESC);
CREATE INDEX IF NOT EXISTS ix_temperature_readings_session_time ON temperature_readings (session_id, time DESC);
CREATE INDEX IF NOT EXISTS ix_load_readings_session_time        ON load_readings        (session_id, time DESC);
CREATE INDEX IF NOT EXISTS ix_race_timer_events_session_time    ON race_timer_events    (session_id, time DESC);
CREATE INDEX IF NOT EXISTS ix_line_positions_session_time       ON line_positions       (session_id, time DESC);
CREATE INDEX IF NOT EXISTS ix_shift_angles_session_time         ON shift_angles         (session_id, time DESC);
