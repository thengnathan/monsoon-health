const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const DB_PATH = path.join(__dirname, '..', 'data', 'willowbark.db');

function initDatabase(options = {}) {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Run schema
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  db.exec(schema);

  if (options.seed) {
    // Check if already seeded
    const siteCount = db.prepare('SELECT COUNT(*) as cnt FROM sites').get().cnt;
    if (siteCount === 0) {
      console.log('Seeding database...');
      const passwordHash = bcrypt.hashSync('password123', 10);
      let seed = fs.readFileSync(path.join(__dirname, 'seed.sql'), 'utf8');
      seed = seed.replace(/\$HASH\$/g, passwordHash);
      db.exec(seed);
      console.log('Seed data loaded.');
    } else {
      console.log('Database already seeded, skipping.');
    }
  }

  return db;
}

function getDb() {
  if (!fs.existsSync(DB_PATH)) {
    return initDatabase({ seed: true });
  }
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  return db;
}

// Run directly
if (require.main === module) {
  const db = initDatabase({ seed: true });
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
  console.log('Tables created:', tables.map(t => t.name).join(', '));
  db.close();
}

module.exports = { initDatabase, getDb, DB_PATH };
