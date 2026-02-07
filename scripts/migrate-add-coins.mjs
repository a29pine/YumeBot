import db from '../db/sqlite.js';

// Migration: add coins to users if not exists
const hasCol = db.prepare("PRAGMA table_info(users)").all().some(r => r.name === 'coins');
if (!hasCol) {
  db.prepare('ALTER TABLE users ADD COLUMN coins INTEGER DEFAULT 0').run();
  console.log('Added coins column to users table.');
} else {
  console.log('coins column already exists.');
}
