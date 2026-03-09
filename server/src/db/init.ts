import 'dotenv/config';
import { Pool } from 'pg';
import { createClient } from '@supabase/supabase-js';

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
});

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Test connection on startup
pool.query('SELECT 1').then(() => {
    console.log('  ✦ Connected to Supabase Postgres');
}).catch((err: Error) => {
    console.error('  ✗ Postgres connection failed:', err.message);
});

export { pool, supabase };
