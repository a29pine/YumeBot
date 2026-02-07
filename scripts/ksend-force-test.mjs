import dotenv from 'dotenv';
import { Client, GatewayIntentBits } from 'discord.js';
import gameService from '../services/gameService.js';
import Database from 'better-sqlite3';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
const token = process.env.TOKEN;
const GID = '1363274006521708654';
if (!token) { console.error('TOKEN missing'); process.exit(1); }

// clear active question
const db = new Database(path.join(process.cwd(), 'storage', 'game.db'));
db.prepare('UPDATE active_questions SET solved = 1 WHERE guild_id = ?').run(GID);
db.close();

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
client.once('ready', async () => {
  console.log('Client ready for ksend force test as', client.user.tag);
  try {
    const posted = await gameService.postQuestion(client, GID);
    console.log('postQuestion returned', posted);
  } catch (e) {
    console.error('ksend force test failed', e);
  } finally {
    client.destroy();
    process.exit(0);
  }
});
client.login(token).catch(e => { console.error('Login failed', e); process.exit(1); });
