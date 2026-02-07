import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { Client, GatewayIntentBits, Partials, Events } from 'discord.js';

dotenv.config();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

import gameService from './services/gameService.js';
import db from './db/sqlite.js';

const token = process.env.TOKEN;
if (!token) {
  console.error('TOKEN missing in .env');
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
  partials: [Partials.Channel]
});

client.once('ready', () => {
  console.log('Bot ready as', client.user.tag);
  try {
    // Set a nice status
    client.user.setPresence({
      activities: [{ name: 'Korean words with you! 🇰🇷✨', type: 0 }],
      status: 'online',
    });
  } catch (e) {
    console.error('Failed to set bot status', e);
  }
  try {
    // auto-start game loops for guilds that have the game enabled
    const rows = db.prepare('SELECT guild_id FROM guilds WHERE enabled = 1 AND channel_id IS NOT NULL').all();
    for (const r of rows) {
      try {
        gameService.startLoop(client, r.guild_id).catch(() => {});
        console.log('Started game loop for', r.guild_id);
      } catch (e) {
        console.error('Failed to start game loop for', r.guild_id, e);
      }
    }
  } catch (e) {
    console.error('Error auto-starting game loops', e);
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      const name = interaction.commandName;
      console.log('Received command', name, 'from', interaction.user?.id);

      // dynamic dispatch for other command modules
      try {
        const cmdModule = await import(`./commands/${name}.js`);
        console.log('Imported module for', name);
        if (cmdModule) {
          const fn = (cmdModule.default && typeof cmdModule.default.execute === 'function') ? cmdModule.default.execute : (typeof cmdModule.execute === 'function' ? cmdModule.execute : null);
          if (!fn) {
            console.warn('Command module has no executable function:', name);
            try { await interaction.reply({ content: 'This command is not implemented correctly.', ephemeral: true }); } catch {}
            return;
          }
          try {
            await fn(interaction);
            console.log('Executed command', name);
          } catch (err) {
            console.error('Error executing command', name, err);
            try { await interaction.reply({ content: 'There was an error executing that command.', ephemeral: true }); } catch {}
          }
        }
      } catch (e) {
        console.error('Failed to import/execute command module', name, e);
        try { await interaction.reply({ content: 'Command not found or failed to load.', ephemeral: true }); } catch {}
      }
      return;
    }

    // Handle component interactions (buttons)
    try {
      if (interaction.isButton()) {
        try {
          await gameService.handleComponentInteraction(interaction);
        } catch (e) {
          console.error('Failed handling component interaction', e);
        }
        return;
      }
    } catch (e) {
      console.error('Component handling error', e);
    }

    // other interaction handling falls through to dynamic command modules
  } catch (err) {
    console.error('Interaction handler error:', err);
    if (interaction.replied || interaction.deferred) {
      try { await interaction.followUp({ content: 'There was an error handling that interaction.', ephemeral: true }); } catch {}
    } else {
      try { await interaction.reply({ content: 'There was an error handling that interaction.', ephemeral: true }); } catch {}
    }
  }
});


client.on('messageCreate', async (message) => {
  try {
    await gameService.handleMessage(message);
  } catch (e) {
    console.error('message handler error', e);
  }
});

// --- Anti-cheat: Ignore edited messages ---
client.on('messageUpdate', async (oldMsg, newMsg) => {
  try {
    // Only handle if content changed and not a bot
    if (!newMsg.partial && newMsg.content !== oldMsg.content && !newMsg.author.bot) {
      // Just ignore edits for anti-cheat
      // Optionally, could log or notify
      // No action needed
    }
  } catch (e) {
    console.error('messageUpdate anti-cheat error', e);
  }
});

// No welcome member-add handling (welcome module removed)

client.login(token);
