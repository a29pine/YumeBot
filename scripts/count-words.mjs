import Database from 'better-sqlite3';
import path from 'path';
const dbPath = path.join(process.cwd(), 'storage', 'game.db');
const db = new Database(dbPath, { readonly: true });
const row = db.prepare('SELECT COUNT(*) as c FROM words').get();
console.log('Total words:', row.c);
const withHints = db.prepare("SELECT COUNT(*) as c FROM words WHERE hints IS NOT NULL AND hints != ''").get();
console.log('Words with hints:', withHints.c);
db.close();
