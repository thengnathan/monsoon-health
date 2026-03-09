"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.supabase = exports.pool = void 0;
require("dotenv/config");
const pg_1 = require("pg");
const supabase_js_1 = require("@supabase/supabase-js");
const pool = new pg_1.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
});
exports.pool = pool;
const supabase = (0, supabase_js_1.createClient)(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
exports.supabase = supabase;
// Test connection on startup
pool.query('SELECT 1').then(() => {
    console.log('  ✦ Connected to Supabase Postgres');
}).catch((err) => {
    console.error('  ✗ Postgres connection failed:', err.message);
});
