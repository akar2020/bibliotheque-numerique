require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { connectWithRetry } = require('./db');
const usersRouter = require('./routes/users');

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/users', usersRouter);

app.get('/health', (req, res) => {
  res.json({ status: 'OK', service: 'users-service', timestamp: new Date().toISOString() });
});

app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route non trouvée.' });
});

const PORT = process.env.PORT || 3002;

connectWithRetry()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`👤 Users Service démarré sur le port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
