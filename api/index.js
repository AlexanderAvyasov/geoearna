const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const checkinRoutes = require('./routes/checkin');
const userRoutes = require('./routes/user');
const withdrawRoutes = require('./routes/withdraw');
const campaignsRoutes = require('./routes/campaigns');

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

app.use(checkinRoutes);
app.use(userRoutes);
app.use(withdrawRoutes);
app.use(campaignsRoutes);

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
