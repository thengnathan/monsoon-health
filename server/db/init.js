require('dotenv').config();
const { Pool } = require('pg');
const { createClient } = require('@supabase/supabase-js');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
});

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Test connection on startup
pool.query('SELECT 1').then(() => {
    console.log('  ✦ Connected to Supabase Postgres');
}).catch(err => {
    console.error('  ✗ Postgres connection failed:', err.message);
});

module.exports = { pool, supabase };
