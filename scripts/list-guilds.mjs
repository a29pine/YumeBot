import Database from 'better-sqlite3';
import path from 'path';
const dbPath = path.join(process.cwd(), 'storage', 'game.db');
const db = new Database(dbPath, { readonly: true });
const rows = db.prepare('SELECT guild_id, channel_id, interval_minutes, enabled, min_level, max_level FROM guilds').all();
console.log('Guild rows:');
for (const r of rows) console.log(r);
db.close();
