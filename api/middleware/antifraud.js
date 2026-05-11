const { supabase } = require('../../db/index');

async function antifraud(req, res, next) {
  try {
    const { qrToken } = req.body;

    if (!qrToken) {
      return res.status(400).json({ error: 'INVALID_PARAMS' });
    }

    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: 'USER_NOT_AUTHENTICATED' });
    }

    // Try business-level QR token first, then campaign-level.
    // Both point to a business for the cooldown check.
    let businessId;

    const { data: business, error: bizErr } = await supabase
      .from('businesses')
      .select('id')
      .eq('qr_token', qrToken)
      .maybeSingle();

    if (bizErr) {
      console.error('antifraud business lookup error', bizErr);
      return res.status(500).json({ error: 'INTERNAL_ERROR' });
    }

    if (business) {
      businessId = business.id;
    } else {
      // Campaign-level QR token
      const { data: campaign, error: campErr } = await supabase
        .from('campaigns')
        .select('business_id')
        .eq('qr_token', qrToken)
        .maybeSingle();

      if (campErr) {
        console.error('antifraud campaign lookup error', campErr);
        return res.status(500).json({ error: 'INTERNAL_ERROR' });
      }

      if (!campaign) {
        return res.status(400).json({ error: 'INVALID_QR_TOKEN' });
      }

      businessId = campaign.business_id;
    }

    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: visits, error: visitError } = await supabase
      .from('visits')
      .select('id')
      .eq('user_id', req.user.id)
      .eq('business_id', businessId)
      .gte('created_at', dayAgo)
      .limit(1);

    if (visitError) {
      console.error('antifraud visit lookup error', visitError);
      return res.status(500).json({ error: 'INTERNAL_ERROR' });
    }

    if (visits && visits.length > 0) {
      return res.status(429).json({ error: 'TOO_SOON' });
    }

    return next();
  } catch (error) {
    console.error('antifraud error', error);
    return res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
}

module.exports = antifraud;
