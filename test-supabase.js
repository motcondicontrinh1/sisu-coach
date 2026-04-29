require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

(async () => {
  console.log('🔗 Testing Supabase connection...');
  const { data, error } = await supabase.from('activities').select('count').limit(1);
  if (error) {
    console.error(`❌ Error: ${error.message}`);
    if (error.message.includes('relation') || error.message.includes('does not exist')) {
      console.error('👉 The activities table does NOT exist. Run the migration from migrations.sql in Supabase SQL Editor first.');
    }
  } else {
    console.log('✅ Supabase connected. Table "activities" exists.');
  }
})();
