const express = require('express');
const { getGeoRate } = require('../lib/geoRate');

const router = express.Router();

router.get('/api/config', (req, res) => {
  res.json({
    geoRate: getGeoRate(),
    currency: 'GEO',
    fiatCurrency: 'UZS',
  });
});

module.exports = router;
