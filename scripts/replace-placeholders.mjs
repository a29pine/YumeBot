import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'storage', 'game.db');
const JSON_PATH = path.join(process.cwd(), 'storage', 'real_words_200.json');

if (!fs.existsSync(JSON_PATH)) {
  console.error('real_words_200.json not found — run generate-real-words.cjs first');
  process.exit(1);
}

let data;
try {
  data = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
} catch (err) {
  console.error('Failed to parse JSON', JSON_PATH, err.message);
  process.exit(1);
}
const db = new Database(DB_PATH);

try {
  const before = db.prepare('SELECT COUNT(*) as c FROM words').get().c;
  console.log('Words before:', before);

  const del = db.prepare("DELETE FROM words WHERE korean LIKE '단어%'");
  const info = del.run();
  console.log('Deleted placeholder rows:', info.changes);

  const insert = db.prepare(`INSERT OR IGNORE INTO words (korean, english, romanization, level, category, aliases, hints) VALUES (?, ?, ?, ?, ?, ?, ?)`);
  const insertMany = db.transaction((items) => {
    for (const it of items) {
      insert.run(it.korean, it.english, it.romanization || '', it.level || 1, it.category || 'general', JSON.stringify(it.aliases || []), JSON.stringify(it.hint || ''));
    }
  });

  insertMany(data);
  const after = db.prepare('SELECT COUNT(*) as c FROM words').get().c;
  const withHints = db.prepare("SELECT COUNT(*) as c FROM words WHERE hints IS NOT NULL AND hints != ''").get().c;
  console.log('Words after:', after);
  console.log('Words with hints:', withHints);
} catch (e) {
  console.error('Error during replace:', e);
  process.exit(1);
} finally {
  db.close();
}
