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

    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .select('id')
      .eq('qr_token', qrToken)
      .maybeSingle();

    if (businessError) {
      console.error('antifraud business lookup error', businessError);
      return res.status(500).json({ error: 'INTERNAL_ERROR' });
    }

    if (!business) {
      return res.status(400).json({ error: 'INVALID_QR_TOKEN' });
    }

    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: visits, error: visitError } = await supabase
      .from('visits')
      .select('id')
      .eq('user_id', req.user.id)
      .eq('business_id', business.id)
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
