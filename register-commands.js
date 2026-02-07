import { REST, Routes } from 'discord.js';
import dotenv from 'dotenv';
dotenv.config();

const token = process.env.TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID; // optional: provide for quicker guild registration

if (!token || !clientId) {
  console.error('Set TOKEN and CLIENT_ID in .env');
  process.exit(1);
}


import kstart from './commands/kstart.js';
import kstop from './commands/kstop.js';
import ksetchannel from './commands/ksetchannel.js';
import ksetlevelchannel from './commands/ksetlevelchannel.js';
import kinterval from './commands/kinterval.js';
import ksend from './commands/ksend.js';
import kword from './commands/kword.js';
import kleaderboard from './commands/kleaderboard.js';
import kprofile from './commands/kprofile.js';
import kstreak from './commands/kstreak.js';
import kwallet from './commands/kwallet.js';
import kshop from './commands/kshop.js';
import kinfo from './commands/kinfo.js';

const commands = [
  kstart.data.toJSON(),
  kstop.data.toJSON(),
  kinterval.data.toJSON(),
  ksend.data.toJSON(),
  ksetchannel.data.toJSON(),
  ksetlevelchannel.data.toJSON(),
  kword.data.toJSON(),
  kleaderboard.data.toJSON(),
  kprofile.data.toJSON(),
  kstreak.data.toJSON(),
  kwallet.data.toJSON(),
  kshop.data.toJSON(),
  kinfo.data.toJSON(),
];

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
  try {
    console.log('Registering slash command...');
    if (guildId) {
      console.log('WARNING: GUILD_ID is set. Commands will only be registered for this guild. Remove GUILD_ID from .env for global commands.');
      await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
      console.log('Registered as guild command to', guildId);
    } else {
      await rest.put(Routes.applicationCommands(clientId), { body: commands });
      console.log('Registered as global command (may take up to an hour).');
    }
  } catch (err) {
    console.error('Failed to register commands:', err);
  }
})();
