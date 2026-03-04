const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();
const { initDatabase } = require('./db/init');

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize DB with seed data
const db = initDatabase({ seed: true });

// Make db available to routes
app.locals.db = db;

// Middleware
app.use(cors({ origin: ['http://localhost:5173', 'http://0.0.0.0:5173'], credentials: true }));
app.use(express.json({ limit: '5mb' }));

// Request logging (minimal)
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const ms = Date.now() - start;
        if (req.path !== '/health') {
            console.log(`${req.method} ${req.path} ${res.statusCode} ${ms}ms`);
        }
    });
    next();
});

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/patients', require('./routes/patients'));
app.use('/api/trials', require('./routes/trials'));
app.use('/api/screening-cases', require('./routes/screeningCases'));
app.use('/api/signal-types', require('./routes/signalTypes'));
app.use('/api/signals', require('./routes/signals'));
app.use('/api/pending-items', require('./routes/pendingItems'));
app.use('/api/screen-fail-reasons', require('./routes/screenFailReasons'));
app.use('/api/referral-sources', require('./routes/referralSources'));
app.use('/api/today', require('./routes/today'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/users', require('./routes/users'));
app.use('/api', require('./routes/visits'));

// Start scheduler
const { startScheduler } = require('./services/scheduler');
startScheduler(db);

// Error handler
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
    console.log(`\n  ✦ Monsoon Health API running on http://localhost:${PORT}\n`);
});

// Cleanup on exit
process.on('SIGINT', () => {
    db.close();
    process.exit(0);
});

module.exports = app;
