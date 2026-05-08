const express = require('express');
const { supabase } = require('../../db/index');

const router = express.Router();

router.get('/api/checkin/info', async (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).json({ error: 'INVALID_PARAMS' });

  const { data: business, error } = await supabase
    .from('businesses')
    .select('id, name, address, campaigns(id, reward_amount, task_type, task_description, requires_pin, active, ends_at, visits_count, max_visits)')
    .eq('qr_token', token)
    .maybeSingle();

  if (error) return res.status(500).json({ error: 'INTERNAL_ERROR' });
  if (!business) return res.status(404).json({ error: 'INVALID_QR_TOKEN' });

  const now = new Date();
  const campaign = (business.campaigns || []).find(c => {
    if (!c.active) return false;
    if (c.ends_at && new Date(c.ends_at) <= now) return false;
    if (c.visits_count >= c.max_visits) return false;
    return true;
  });

  if (!campaign) return res.status(404).json({ error: 'NO_ACTIVE_CAMPAIGN' });

  return res.json({
    businessName: business.name,
    address: business.address,
    reward: campaign.reward_amount,
    taskType: campaign.task_type || 'visit',
    taskDescription: campaign.task_description || null,
    requiresPin: campaign.requires_pin || false,
  });
});

module.exports = router;
