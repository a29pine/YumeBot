const path = require('path');
const Database = require('better-sqlite3');

const dbPath = path.join(__dirname, '..', 'storage', 'game.db');

const db = new Database(dbPath);

const data = [];
for (let i = 1; i <= 500; i++) {
  data.push({
    korean: `단어${i}`,
    english: `word${i}`,
    romanization: `daneo${i}`,
    level: i % 3 === 0 ? 2 : 1,
    category: 'general',
    aliases: []
  });
}

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
