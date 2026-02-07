import dotenv from 'dotenv';
import { REST, Routes } from 'discord.js';

dotenv.config();

const token = process.env.TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;

if (!token || !clientId) {
  console.error('Missing TOKEN or CLIENT_ID in .env');
  process.exit(1);
}

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
  try {
    if (guildId) {
      const cmds = await rest.get(Routes.applicationGuildCommands(clientId, guildId));
      console.log('Guild commands:');
      console.log(JSON.stringify(cmds, null, 2));
    } else {
      const cmds = await rest.get(Routes.applicationCommands(clientId));
      console.log('Global commands:');
      console.log(JSON.stringify(cmds, null, 2));
    }
  } catch (err) {
    console.error('Failed to fetch commands:', err);
    process.exit(1);
  }
})();
