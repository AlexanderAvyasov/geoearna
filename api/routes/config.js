const express = require('express');

const router = express.Router();

router.get('/api/config', (req, res) => {
  res.json({
    geoRate: parseFloat(process.env.GEO_RATE) || 1,
    currency: 'GEO',
    fiatCurrency: 'UZS',
  });
});

module.exports = router;
