import Database from 'better-sqlite3';
import path from 'path';

const db = new Database(path.join(process.cwd(), 'storage', 'game.db'));

function hasColumn(table, column) {
  const info = db.prepare(`PRAGMA table_info(${table})`).all();
  return info.some(r => r.name === column);
}

try {
  if (!hasColumn('users', 'bio')) {
    db.prepare("ALTER TABLE users ADD COLUMN bio TEXT DEFAULT ''").run();
    console.log('Added users.bio');
  } else {
    console.log('users.bio already exists');
  }
  if (!hasColumn('users', 'korean_level')) {
    db.prepare('ALTER TABLE users ADD COLUMN korean_level INTEGER DEFAULT 0').run();
    console.log('Added users.korean_level');
  } else {
    console.log('users.korean_level already exists');
  }
} catch (e) {
  console.error('Migration failed', e);
  process.exit(1);
} finally {
  db.close();
}

console.log('Migration complete');
