import dotenv from 'dotenv';
import { Client, GatewayIntentBits } from 'discord.js';
import gameService from '../services/gameService.js';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
const token = process.env.TOKEN;
const GID = '1363274006521708654';
if (!token) { console.error('TOKEN missing'); process.exit(1); }
const client = new Client({ intents: [GatewayIntentBits.Guilds] });
client.once('ready', async () => {
  console.log('Client ready for ksend test as', client.user.tag);
  try {
    await gameService.postQuestion(client, GID);
    console.log('ksend test completed');
  } catch (e) {
    console.error('ksend test failed', e);
  } finally {
    client.destroy();
    process.exit(0);
  }
});
client.login(token).catch(e => { console.error('Login failed', e); process.exit(1); });
