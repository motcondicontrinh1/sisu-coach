-- Run this in your Supabase Dashboard → SQL Editor

CREATE TABLE IF NOT EXISTS activities (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  strava_id BIGINT UNIQUE NOT NULL,
  type TEXT NOT NULL,
  distance_m FLOAT,
  moving_time_s INT,
  elapsed_time_s INT,
  total_elevation_gain_m FLOAT,
  average_heartrate FLOAT,
  max_heartrate FLOAT,
  average_speed_ms FLOAT,
  max_speed_ms FLOAT,
  started_at TIMESTAMPTZ,
  name TEXT,
  description TEXT,
  raw JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activities_started_at ON activities(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_activities_strava_id ON activities(strava_id);
