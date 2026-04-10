import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { pool, supabase } from './db/init';
import { authMiddleware } from './middleware/auth';

import authRouter from './routes/auth';
import patientsRouter from './routes/patients';
import trialsRouter from './routes/trials';
import screeningCasesRouter from './routes/screeningCases';
import signalTypesRouter from './routes/signalTypes';
import signalsRouter from './routes/signals';
import pendingItemsRouter from './routes/pendingItems';
import screenFailReasonsRouter from './routes/screenFailReasons';
import referralSourcesRouter from './routes/referralSources';
import todayRouter from './routes/today';
import notificationsRouter from './routes/notifications';
import usersRouter from './routes/users';
import notesRouter from './routes/notes';
import visitsRouter from './routes/visits';
import emailRouter from './routes/email';
import intakeRouter from './routes/intake';
import settingsRouter from './routes/settings';

const app = express();
const PORT = process.env.PORT || 3001;

// Make db and supabase available to routes
app.locals.db = pool;
app.locals.supabase = supabase;

// Middleware
app.use(cors({ origin: ['http://localhost:5173', 'http://0.0.0.0:5173'], credentials: true }));
app.use(express.json({ limit: '5mb' }));
app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setTimeout(300000); // 5 min — needed for local LLM calls
    next();
});

// Request logging (minimal)
app.use((req: Request, res: Response, next: NextFunction) => {
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
app.get('/health', (_req: Request, res: Response) => res.json({ status: 'ok', ts: new Date().toISOString() }));

// Routes
app.use('/api/auth', authRouter);
app.use('/api/patients', patientsRouter);
app.use('/api/trials', trialsRouter);
app.use('/api/screening-cases', screeningCasesRouter);
app.use('/api/signal-types', signalTypesRouter);
app.use('/api/signals', signalsRouter);
app.use('/api/pending-items', pendingItemsRouter);
app.use('/api/screen-fail-reasons', screenFailReasonsRouter);
app.use('/api/referral-sources', referralSourcesRouter);
app.use('/api/today', todayRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/users', usersRouter);
app.use('/api/notes', notesRouter);
app.use('/api/email', emailRouter);
app.use('/api/intake', intakeRouter);
app.use('/api/settings', settingsRouter);
app.use('/api', visitsRouter);

// Error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
    console.log(`\n  ✦ Monsoon Health API running on http://localhost:${PORT}\n`);
});

process.on('SIGINT', () => {
    pool.end();
    process.exit(0);
});

export default app;
