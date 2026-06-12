import 'dotenv/config';
import { Pool } from 'pg';
import { createClient } from '@supabase/supabase-js';

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 5,                // never open more than 5 simultaneous Postgres connections
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
});

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Prevent transient socket errors on idle clients (e.g. EADDRNOTAVAIL, ECONNRESET
// from Supabase) from crashing the whole process. Without this handler, an error
// emitted on an idle pooled client is unhandled and takes down the server.
pool.on('error', (err: Error) => {
    console.error('  ⚠ Postgres pool error (recovered):', err.message);
});

// Test connection on startup
pool.query('SELECT 1').then(() => {
    console.log('  ✦ Connected to Supabase Postgres');
}).catch((err: Error) => {
    console.error('  ✗ Postgres connection failed:', err.message);
});

export { pool, supabase };
