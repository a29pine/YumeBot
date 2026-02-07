import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_DIR = path.join(__dirname, '..', 'storage');
const DB_PATH = path.join(DB_DIR, 'game.db');
fs.mkdirSync(DB_DIR, { recursive: true });

const db = new Database(DB_PATH);

// initialize schema
db.pragma('journal_mode = WAL');

// guild configs
db.prepare(`CREATE TABLE IF NOT EXISTS guilds (
  guild_id TEXT PRIMARY KEY,
  channel_id TEXT,
  levelup_channel_id TEXT,
  interval_minutes INTEGER DEFAULT 10,
  min_level INTEGER DEFAULT 1,
  max_level INTEGER DEFAULT 5,
  categories TEXT DEFAULT '[]',
  show_romanization INTEGER DEFAULT 0,
  use_buttons INTEGER DEFAULT 1,
  enabled INTEGER DEFAULT 0
)`).run();

// words
db.prepare(`CREATE TABLE IF NOT EXISTS words (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  korean TEXT NOT NULL,
  english TEXT NOT NULL,
  romanization TEXT,
  ipa TEXT,
  level INTEGER DEFAULT 1,
  category TEXT DEFAULT 'general',
  aliases TEXT DEFAULT '[]',
  hint TEXT DEFAULT ''
)`).run();

// user stats per guild
db.prepare(`CREATE TABLE IF NOT EXISTS users (
  guild_id TEXT,
  user_id TEXT,
  xp INTEGER DEFAULT 0,
  level INTEGER DEFAULT 1,
  streak INTEGER DEFAULT 0,
  total_correct INTEGER DEFAULT 0,
  last_correct_at INTEGER DEFAULT 0,
  last_streak_day INTEGER DEFAULT 0,
  coins INTEGER DEFAULT 0,
  inventory TEXT DEFAULT '{}',
  PRIMARY KEY (guild_id, user_id)
)`).run();

// active questions
db.prepare(`CREATE TABLE IF NOT EXISTS active_questions (
  guild_id TEXT PRIMARY KEY,
  channel_id TEXT,
  word_id INTEGER,
  message_id TEXT,
  started_at INTEGER,
  solved INTEGER DEFAULT 0,
  correct_user_id TEXT
)`).run();

export default db;
