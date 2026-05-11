const express = require('express');
const { supabase } = require('../../db/index');

const router = express.Router();

router.get('/api/checkin/info', async (req, res) => {
  const { token } = req.query;
  if (!token || typeof token !== 'string' || token.length > 128) {
    return res.status(400).json({ error: 'INVALID_PARAMS' });
  }

  const now = new Date();

  // ── Try campaign-level QR token first ────────────────────────────────────────
  const { data: campaignRow, error: campErr } = await supabase
    .from('campaigns')
    .select('id, reward_amount, task_type, task_description, requires_pin, active, ends_at, visits_count, max_visits, business_id')
    .eq('qr_token', token)
    .maybeSingle();

  if (campErr) {
    console.error('[checkin/info] campaign lookup error', campErr);
    return res.status(500).json({ error: 'INTERNAL_ERROR' });
  }

  if (campaignRow) {
    const expired   = campaignRow.ends_at && new Date(campaignRow.ends_at) <= now;
    const exhausted = campaignRow.visits_count >= campaignRow.max_visits;
    if (!campaignRow.active || expired || exhausted) {
      return res.status(404).json({ error: 'NO_ACTIVE_CAMPAIGN' });
    }

    const { data: biz, error: bizCampErr } = await supabase
      .from('businesses')
      .select('id, name, address')
      .eq('id', campaignRow.business_id)
      .maybeSingle();
    if (bizCampErr) {
      console.error('[checkin/info] biz lookup error', bizCampErr);
      return res.status(500).json({ error: 'INTERNAL_ERROR' });
    }

    return res.json({
      businessName:    biz?.name        || '',
      address:         biz?.address     || null,
      reward:          campaignRow.reward_amount,
      taskType:        campaignRow.task_type || 'visit',
      taskDescription: campaignRow.task_description || null,
      requiresPin:     campaignRow.requires_pin || false,
      campaignId:      campaignRow.id,
    });
  }

  // ── Fallback: business-level QR token ────────────────────────────────────────
  const { data: business, error: bizErr } = await supabase
    .from('businesses')
    .select('id, name, address')
    .eq('qr_token', token)
    .maybeSingle();

  if (bizErr) {
    console.error('[checkin/info] business lookup error', bizErr);
    return res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
  if (!business) {
    console.warn(`[checkin/info] unknown token from ${req.ip}`);
    return res.status(404).json({ error: 'INVALID_QR_TOKEN' });
  }

  const { data: campaigns, error: campListErr } = await supabase
    .from('campaigns')
    .select('id, reward_amount, task_type, task_description, requires_pin, active, ends_at, visits_count, max_visits')
    .eq('business_id', business.id);

  if (campListErr) {
    console.error('[checkin/info] campaign list error', campListErr);
    return res.status(500).json({ error: 'INTERNAL_ERROR' });
  }

  const cidParam = req.query.cid ? parseInt(req.query.cid, 10) : null;
  let campaign;

  if (cidParam) {
    campaign = (campaigns || []).find(c => c.id === cidParam);
    if (!campaign || !campaign.active ||
        (campaign.ends_at && new Date(campaign.ends_at) <= now) ||
        campaign.visits_count >= campaign.max_visits) {
      return res.status(404).json({ error: 'NO_ACTIVE_CAMPAIGN' });
    }
  } else {
    campaign = (campaigns || []).find(c => {
      if (!c.active) return false;
      if (c.ends_at && new Date(c.ends_at) <= now) return false;
      if (c.visits_count >= c.max_visits) return false;
      return true;
    });
    if (!campaign) return res.status(404).json({ error: 'NO_ACTIVE_CAMPAIGN' });
  }

  return res.json({
    businessName:    business.name,
    address:         business.address,
    reward:          campaign.reward_amount,
    taskType:        campaign.task_type || 'visit',
    taskDescription: campaign.task_description || null,
    requiresPin:     campaign.requires_pin || false,
    campaignId:      campaign.id,
  });
});

module.exports = router;
