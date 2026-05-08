const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const rateLimit = require('express-rate-limit');
const checkinRoutes = require('./routes/checkin');
const checkinInfoRoutes = require('./routes/checkinInfo');
const userRoutes = require('./routes/user');
const withdrawRoutes = require('./routes/withdraw');
const campaignsRoutes = require('./routes/campaigns');
const adminRoutes = require('./routes/admin');
const operatorRoutes = require('./routes/operator');

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

// General API rate limit: 120 requests per minute per IP
app.use('/api', rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'TOO_MANY_REQUESTS' },
}));

// Stricter limit for checkin endpoint: 10 per minute per IP
app.use('/api/checkin', rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'TOO_MANY_REQUESTS' },
}));

app.use(checkinRoutes);
app.use(checkinInfoRoutes);
app.use(userRoutes);
app.use(withdrawRoutes);
app.use(campaignsRoutes);
app.use(adminRoutes);
app.use(operatorRoutes);

app.use((req, res) => {
  res.status(404).json({ error: 'NOT_FOUND' });
});

app.use((err, req, res, next) => {
  console.error('Unhandled error', err);
  res.status(500).json({ error: 'INTERNAL_ERROR' });
});

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`GeoEarn server started on port ${port}`);
});

module.exports = app;
