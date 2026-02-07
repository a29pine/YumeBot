const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const dbPath = path.join(__dirname, '..', 'storage', 'game.db');
const jsonPath = path.join(__dirname, '..', 'storage', 'default_words.json');

if (!fs.existsSync(jsonPath)) {
  console.error('default_words.json not found');
  process.exit(1);
}

let data;
try {
  data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
} catch (err) {
  console.error('Failed to parse JSON', jsonPath, err.message);
  process.exit(1);
}

const db = new Database(dbPath);

try {
  const insert = db.prepare(`INSERT OR IGNORE INTO words (korean, english, romanization, level, category, aliases) VALUES (?, ?, ?, ?, ?, ?)`);
  const insertMany = db.transaction((items) => {
    for (const it of items) {
      insert.run(it.korean, it.english, it.romanization || '', it.level || 1, it.category || 'general', JSON.stringify(it.aliases || []));
    }
  });

  insertMany(data);
  console.log(`Imported ${data.length} placeholder words into ${dbPath}`);
} catch (err) {
  console.error('Import failed:', err);
  process.exit(1);
} finally {
  db.close();
}
