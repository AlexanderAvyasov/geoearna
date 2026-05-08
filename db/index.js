const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.DATABASE_URL;
const serviceKey = process.env.SERVICE_KEY;

if (!supabaseUrl || !serviceKey) {
  throw new Error('Missing DATABASE_URL or SERVICE_KEY environment variables');
}

const supabase = createClient(supabaseUrl, serviceKey);

module.exports = {
  supabase,
};
