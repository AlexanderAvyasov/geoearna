const { supabase } = require('../../db/index');
const { getDistance } = require('./geo');

async function performCheckin({ userId, qrToken, lat, lng, pin }) {
  const { data: business, error: businessError } = await supabase
    .from('businesses')
    .select('*')
    .eq('qr_token', qrToken)
    .maybeSingle();

  if (businessError) {
    console.error('checkin business lookup error', businessError);
    throw Object.assign(new Error('INTERNAL_ERROR'), { code: 'INTERNAL_ERROR' });
  }

  if (!business) {
    throw Object.assign(new Error('INVALID_QR_TOKEN'), { code: 'INVALID_QR_TOKEN' });
  }

  const distance = getDistance({ lat, lng }, { lat: business.lat, lng: business.lng });

  if (distance > business.radius_m) {
    throw Object.assign(new Error('TOO_FAR'), { code: 'TOO_FAR' });
  }

  const { data: campaigns, error: campaignError } = await supabase
    .from('campaigns')
    .select('*')
    .eq('business_id', business.id)
    .eq('active', true);

  if (campaignError) {
    console.error('checkin campaign lookup error', campaignError);
    throw Object.assign(new Error('INTERNAL_ERROR'), { code: 'INTERNAL_ERROR' });
  }

  const now = new Date();
  const campaign = (campaigns || []).find(item => {
    const endsAt = item.ends_at ? new Date(item.ends_at) : null;
    return (!endsAt || endsAt > now) && item.visits_count < item.max_visits;
  });

  if (!campaign) {
    throw Object.assign(new Error('NO_ACTIVE_CAMPAIGN'), { code: 'NO_ACTIVE_CAMPAIGN' });
  }

  if (business.balance < campaign.reward_amount) {
    throw Object.assign(new Error('BUSINESS_INSUFFICIENT_FUNDS'), { code: 'BUSINESS_INSUFFICIENT_FUNDS' });
  }

  // PIN validation when campaign requires it
  if (campaign.requires_pin) {
    if (!pin) {
      throw Object.assign(new Error('PIN_REQUIRED'), { code: 'PIN_REQUIRED' });
    }

    const { data: pinRecord, error: pinError } = await supabase
      .from('verification_pins')
      .select('id, used, expires_at')
      .eq('business_id', business.id)
      .eq('pin', String(pin))
      .maybeSingle();

    if (pinError) throw Object.assign(new Error('INTERNAL_ERROR'), { code: 'INTERNAL_ERROR' });
    if (!pinRecord) throw Object.assign(new Error('INVALID_PIN'), { code: 'INVALID_PIN' });
    if (pinRecord.used) throw Object.assign(new Error('PIN_USED'), { code: 'PIN_USED' });
    if (new Date(pinRecord.expires_at) < now) throw Object.assign(new Error('PIN_EXPIRED'), { code: 'PIN_EXPIRED' });

    await supabase.from('verification_pins').update({ used: true }).eq('id', pinRecord.id);
  }

  const { error: rpcError } = await supabase.rpc('process_checkin', {
    p_user_id: userId,
    p_business_id: business.id,
    p_campaign_id: campaign.id,
    p_lat: lat,
    p_lng: lng,
    p_reward: campaign.reward_amount,
  });

  if (rpcError) {
    console.error('checkin rpc error', rpcError);
    throw Object.assign(new Error('INTERNAL_ERROR'), { code: 'INTERNAL_ERROR' });
  }

  const { data: updatedUser, error: updatedUserError } = await supabase
    .from('users')
    .select('balance')
    .eq('id', userId)
    .single();

  if (updatedUserError) {
    console.error('checkin user balance lookup error', updatedUserError);
    throw Object.assign(new Error('INTERNAL_ERROR'), { code: 'INTERNAL_ERROR' });
  }

  return {
    reward: campaign.reward_amount,
    totalBalance: updatedUser.balance,
  };
}

module.exports = { performCheckin };
