import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = new Database(path.join(__dirname, '../storage/game.db'));

db.prepare('ALTER TABLE users ADD COLUMN inventory TEXT DEFAULT "{}"').run();

console.log('Migration complete: Added inventory column to users table.');
