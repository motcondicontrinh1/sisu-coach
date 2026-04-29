const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function migrate() {
  console.log('Creating activities table...');

  // Note: If you're using the Supabase dashboard SQL editor, run the SQL from migrations.sql instead.
  // This script uses the Supabase MCP or direct REST API to create the table.
  // For simplicity, we'll use the supabase-js client to execute raw SQL via the REST API.

  const { error } = await supabase.rpc('exec_sql', {
    sql: `
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
    `
  });

  if (error) {
    // The exec_sql RPC may not exist. Fall back to instructing the user.
    console.error('Could not run migration via RPC. Please run the SQL in migrations.sql manually in your Supabase SQL editor.');
    console.error('Error:', error.message);
    console.log('\nAlternatively, paste this into your Supabase Dashboard → SQL Editor:');
    console.log(require('fs').readFileSync(require('path').join(__dirname, 'migrations.sql'), 'utf-8'));
    return;
  }

  console.log('✅ Migration complete! activities table created.');
}

migrate();
