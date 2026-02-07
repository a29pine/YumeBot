const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'storage', 'game.db');
const db = new Database(dbPath);

try {
  const cols = db.prepare("PRAGMA table_info(words)").all();
  const hasHints = cols.some(c => c.name === 'hints');
  if (!hasHints) {
    db.prepare("ALTER TABLE words ADD COLUMN hints TEXT DEFAULT '[]'").run();
    console.log('Added column `hints` to words');
  } else {
    console.log('Column `hints` already exists');
  }
} catch (err) {
  console.error('Migration failed:', err);
  process.exit(1);
} finally {
  db.close();
}
