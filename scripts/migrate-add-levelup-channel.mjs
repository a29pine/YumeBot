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
  // Add column if it doesn't exist
  const info = db.prepare("PRAGMA table_info(guilds)").all();
  const has = info.some(r => r.name === 'levelup_channel_id');
  if (!has) {
    console.log('Adding levelup_channel_id column to guilds');
    db.prepare('ALTER TABLE guilds ADD COLUMN levelup_channel_id TEXT').run();
    console.log('Migration complete');
  } else {
    console.log('Column already present');
  }
} catch (e) {
  console.error('Migration failed', e);
  process.exit(1);
} finally {
  db.close();
}
