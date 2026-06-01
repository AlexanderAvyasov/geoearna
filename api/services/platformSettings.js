// Run in Supabase SQL editor:
// CREATE TABLE IF NOT EXISTS platform_settings (
//   key TEXT PRIMARY KEY,
//   value NUMERIC NOT NULL,
//   description TEXT,
//   updated_at TIMESTAMPTZ DEFAULT now()
// );

const { supabase } = require('../../db/index');

const DEFAULTS = {
  referral_bonus_referrer: 25,
  referral_bonus_new_user: 10,
  milestone_geo_7:  100,
  milestone_geo_14: 200,
  milestone_geo_30: 300,
  new_place_bonus:  100,
};

let _cache = null;
let _cacheAt = 0;
const CACHE_TTL = 60_000;

async function getSettings() {
  if (_cache && Date.now() - _cacheAt < CACHE_TTL) return _cache;
  try {
    const { data, error } = await supabase.from('platform_settings').select('key, value');
    if (error || !data) return DEFAULTS;
    const result = { ...DEFAULTS };
    for (const row of data) {
      if (row.key in result) result[row.key] = Number(row.value);
    }
    _cache = result;
    _cacheAt = Date.now();
    return result;
  } catch {
    return DEFAULTS;
  }
}

function invalidateCache() { _cache = null; }

module.exports = { getSettings, invalidateCache, DEFAULTS };
