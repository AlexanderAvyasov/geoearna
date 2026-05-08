const express = require('express');
const validateTma = require('../middleware/validateTma');
const { supabase } = require('../../db/index');

const router = express.Router();

router.get('/api/campaigns', validateTma, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('campaigns')
      .select(`
        id,
        reward_amount,
        max_visits,
        visits_count,
        ends_at,
        businesses (
          name,
          address
        )
      `)
      .eq('active', true);

    if (error) {
      console.error('GET /api/campaigns error', error);
      return res.status(500).json({ error: 'INTERNAL_ERROR' });
    }

    const now = new Date();
    const campaigns = (data || [])
      .filter((c) => {
        const notExpired = !c.ends_at || new Date(c.ends_at) > now;
        const hasSlots = c.visits_count < c.max_visits;
        return notExpired && hasSlots;
      })
      .map((c) => ({
        id: c.id,
        reward_amount: c.reward_amount,
        business_name: c.businesses?.name || '',
        address: c.businesses?.address || '',
      }));

    return res.json(campaigns);
  } catch (err) {
    console.error('GET /api/campaigns error', err);
    return res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

module.exports = router;
