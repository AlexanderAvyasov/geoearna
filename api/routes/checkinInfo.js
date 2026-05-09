const express = require('express');
const { supabase } = require('../../db/index');

const router = express.Router();

router.get('/api/checkin/info', async (req, res) => {
  const { token } = req.query;
  if (!token || typeof token !== 'string' || token.length > 128) {
    return res.status(400).json({ error: 'INVALID_PARAMS' });
  }

  const { data: business, error } = await supabase
    .from('businesses')
    .select('id, name, address, campaigns(id, reward_amount, task_type, task_description, requires_pin, active, ends_at, visits_count, max_visits)')
    .eq('qr_token', token)
    .maybeSingle();

  if (error) return res.status(500).json({ error: 'INTERNAL_ERROR' });
  if (!business) {
    console.warn(`[checkin/info] invalid token from ${req.ip}`);
    return res.status(404).json({ error: 'INVALID_QR_TOKEN' });
  }

  const now = new Date();
  const cidParam = req.query.cid ? parseInt(req.query.cid, 10) : null;

  let campaign;
  if (cidParam) {
    campaign = (business.campaigns || []).find(c => c.id === cidParam);
    if (!campaign || !campaign.active || (campaign.ends_at && new Date(campaign.ends_at) <= now) || campaign.visits_count >= campaign.max_visits) {
      return res.status(404).json({ error: 'NO_ACTIVE_CAMPAIGN' });
    }
  } else {
    campaign = (business.campaigns || []).find(c => {
      if (!c.active) return false;
      if (c.ends_at && new Date(c.ends_at) <= now) return false;
      if (c.visits_count >= c.max_visits) return false;
      return true;
    });
    if (!campaign) return res.status(404).json({ error: 'NO_ACTIVE_CAMPAIGN' });
  }

  return res.json({
    businessName: business.name,
    address: business.address,
    reward: campaign.reward_amount,
    taskType: campaign.task_type || 'visit',
    taskDescription: campaign.task_description || null,
    requiresPin: campaign.requires_pin || false,
    campaignId: campaign.id,
  });
});

module.exports = router;
