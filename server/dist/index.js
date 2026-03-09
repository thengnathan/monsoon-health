"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const init_1 = require("./db/init");
const auth_1 = __importDefault(require("./routes/auth"));
const patients_1 = __importDefault(require("./routes/patients"));
const trials_1 = __importDefault(require("./routes/trials"));
const screeningCases_1 = __importDefault(require("./routes/screeningCases"));
const signalTypes_1 = __importDefault(require("./routes/signalTypes"));
const signals_1 = __importDefault(require("./routes/signals"));
const pendingItems_1 = __importDefault(require("./routes/pendingItems"));
const screenFailReasons_1 = __importDefault(require("./routes/screenFailReasons"));
const referralSources_1 = __importDefault(require("./routes/referralSources"));
const today_1 = __importDefault(require("./routes/today"));
const notifications_1 = __importDefault(require("./routes/notifications"));
const users_1 = __importDefault(require("./routes/users"));
const notes_1 = __importDefault(require("./routes/notes"));
const visits_1 = __importDefault(require("./routes/visits"));
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3001;
// Make db and supabase available to routes
app.locals.db = init_1.pool;
app.locals.supabase = init_1.supabase;
// Middleware
app.use((0, cors_1.default)({ origin: ['http://localhost:5173', 'http://0.0.0.0:5173'], credentials: true }));
app.use(express_1.default.json({ limit: '5mb' }));
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
app.get('/health', (_req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));
// Routes
app.use('/api/auth', auth_1.default);
app.use('/api/patients', patients_1.default);
app.use('/api/trials', trials_1.default);
app.use('/api/screening-cases', screeningCases_1.default);
app.use('/api/signal-types', signalTypes_1.default);
app.use('/api/signals', signals_1.default);
app.use('/api/pending-items', pendingItems_1.default);
app.use('/api/screen-fail-reasons', screenFailReasons_1.default);
app.use('/api/referral-sources', referralSources_1.default);
app.use('/api/today', today_1.default);
app.use('/api/notifications', notifications_1.default);
app.use('/api/users', users_1.default);
app.use('/api/notes', notes_1.default);
app.use('/api', visits_1.default);
// Error handler
app.use((err, _req, res, _next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
});
app.listen(PORT, () => {
    console.log(`\n  ✦ Monsoon Health API running on http://localhost:${PORT}\n`);
});
process.on('SIGINT', () => {
    init_1.pool.end();
    process.exit(0);
});
exports.default = app;
