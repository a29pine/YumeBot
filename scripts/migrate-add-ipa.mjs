import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_PATH = path.join(process.cwd(), 'storage', 'game.db');
if (!fs.existsSync(DB_PATH)) {
  console.error('DB not found at', DB_PATH);
  process.exit(1);
}
const db = new Database(DB_PATH);

try {
  const info = db.prepare("PRAGMA table_info(words)").all();
  const has = info.some(r => r.name === 'ipa');
  if (!has) {
    console.log('Adding ipa column to words');
    db.prepare('ALTER TABLE words ADD COLUMN ipa TEXT').run();
    console.log('Migration complete');
  } else {
    console.log('ipa column already present');
  }
} catch (e) {
  console.error('Migration failed', e);
  process.exit(1);
} finally {
  db.close();
}
