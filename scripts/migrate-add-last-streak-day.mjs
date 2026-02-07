import db from '../db/sqlite.js';

// Migration: add last_streak_day to users if not exists
const hasCol = db.prepare("PRAGMA table_info(users)").all().some(r => r.name === 'last_streak_day');
if (!hasCol) {
  db.prepare('ALTER TABLE users ADD COLUMN last_streak_day INTEGER DEFAULT 0').run();
  console.log('Added last_streak_day column to users table.');
} else {
  console.log('last_streak_day column already exists.');
}
