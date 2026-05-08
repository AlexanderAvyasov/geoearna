const express = require('express');
const validateTma = require('../middleware/validateTma');
const { supabase } = require('../../db/index');

const router = express.Router();

router.get('/api/me', validateTma, async (req, res) => {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('id, telegram_id, username, balance, created_at')
      .eq('id', req.user.id)
      .single();

    if (error) {
      console.error('GET /api/me error', error);
      return res.status(500).json({ error: 'INTERNAL_ERROR' });
    }

    if (!user) {
      return res.status(404).json({ error: 'USER_NOT_FOUND' });
    }

    return res.json({ user });
  } catch (error) {
    console.error('GET /api/me error', error);
    return res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

router.get('/api/visits', validateTma, async (req, res) => {
  try {
    const { data: visits, error } = await supabase
      .from('visits')
      .select(`
        id,
        campaign_id,
        lat,
        lng,
        rewarded,
        created_at,
        businesses (
          name
        )
      `)
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('GET /api/visits error', error);
      return res.status(500).json({ error: 'INTERNAL_ERROR' });
    }

    const mapped = (visits || []).map((v) => ({
      id: v.id,
      campaign_id: v.campaign_id,
      lat: v.lat,
      lng: v.lng,
      rewarded: v.rewarded,
      created_at: v.created_at,
      business_name: v.businesses?.name || '',
    }));

    return res.json({ visits: mapped });
  } catch (error) {
    console.error('GET /api/visits error', error);
    return res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

module.exports = router;
