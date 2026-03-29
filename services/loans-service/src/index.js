require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { connectWithRetry } = require('./db');
const loansRouter = require('./routes/loans');

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/loans', loansRouter);

app.get('/health', (req, res) => {
  res.json({ status: 'OK', service: 'loans-service', timestamp: new Date().toISOString() });
});

app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route non trouvée.' });
});

const PORT = process.env.PORT || 3003;

connectWithRetry()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`📋 Loans Service démarré sur le port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
