require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { connectWithRetry } = require('./db');
const authRoutes = require('./routes/auth.routes');

const app = express();

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', service: 'books-service', timestamp: new Date().toISOString() });
});

// 404
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route non trouvée.' });
});


const PORT = process.env.PORT || 3000;


connectWithRetry()
  .then(() => {
    app.listen(PORT, () => {
      console.log(` Auth Service tournant sur le port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
