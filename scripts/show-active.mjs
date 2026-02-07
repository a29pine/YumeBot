import Database from 'better-sqlite3';
import path from 'path';
const db = new Database(path.join(process.cwd(), 'storage', 'game.db'), { readonly: true });
const rows = db.prepare('SELECT * FROM active_questions').all();
console.log('active_questions rows:');
for (const r of rows) console.log(r);
db.close();
