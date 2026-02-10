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
      // Handle modal submissions for kprofile edit
      if (interaction.isModalSubmit && typeof interaction.isModalSubmit === 'function' ? interaction.isModalSubmit() : interaction.type === 5) {
        const gid = interaction.guildId;
        const uid = interaction.user.id;
        let updated = false;
        let field = '', value = '';
        if (interaction.customId === 'modal_edit_bio') {
          value = interaction.fields.getTextInputValue('bio_input');
          db.prepare('UPDATE users SET bio = ? WHERE guild_id = ? AND user_id = ?').run(value, gid, uid);
          field = 'Bio';
          updated = true;
        } else if (interaction.customId === 'modal_edit_klevel') {
          value = interaction.fields.getTextInputValue('klevel_input');
          const klevel = Math.max(1, Math.min(4, parseInt(value)));
          db.prepare('UPDATE users SET korean_level = ? WHERE guild_id = ? AND user_id = ?').run(klevel, gid, uid);
          field = 'Korean Level';
          updated = true;
        } else if (interaction.customId === 'modal_edit_banner') {
          value = interaction.fields.getTextInputValue('banner_input');
          db.prepare('UPDATE users SET profile_banner = ? WHERE guild_id = ? AND user_id = ?').run(value, gid, uid);
          field = 'Banner URL';
          updated = true;
        } else if (interaction.customId === 'modal_edit_color') {
          value = interaction.fields.getTextInputValue('color_input').trim();
          // Accept #RRGGBB or RRGGBB
          if (/^[0-9A-Fa-f]{6}$/.test(value)) {
            value = '#' + value;
          }
          if (!/^#[0-9A-Fa-f]{6}$/.test(value)) {
            await interaction.reply({ content: '❌ Invalid hex color. Please use #RRGGBB or RRGGBB format.', ephemeral: true });
            return;
          }
          db.prepare('UPDATE users SET profile_color = ? WHERE guild_id = ? AND user_id = ?').run(value, gid, uid);
          field = 'Embed Color';
          updated = true;
        } else if (interaction.customId === 'modal_edit_font') {
          value = interaction.fields.getTextInputValue('font_input');
          db.prepare('UPDATE users SET profile_font = ? WHERE guild_id = ? AND user_id = ?').run(value, gid, uid);
          field = 'Font Style';
          updated = true;
        } else if (interaction.customId === 'modal_edit_badge') {
          value = interaction.fields.getTextInputValue('badge_input');
          // Accept any emoji or string
          db.prepare('UPDATE users SET profile_badge = ? WHERE guild_id = ? AND user_id = ?').run(value, gid, uid);
          field = 'Badge';
          updated = true;
        } else if (interaction.customId === 'modal_edit_social') {
          value = interaction.fields.getTextInputValue('social_input');
          db.prepare('UPDATE users SET profile_social = ? WHERE guild_id = ? AND user_id = ?').run(value, gid, uid);
          field = 'Social Link';
          updated = true;
        }
        if (updated) {
          // Fetch updated profile and show embed
          const row = db.prepare('SELECT * FROM users WHERE guild_id = ? AND user_id = ?').get(gid, uid);
          const koreanLevelMap = { 0: 'Unspecified', 1: 'Beginner', 2: 'Intermediate', 3: 'Advanced', 4: 'Native' };
          const klevelLabel = koreanLevelMap[row?.korean_level] || 'Unspecified';
          const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = await import('discord.js');
          const embed = new EmbedBuilder()
            .setTitle('Edit Your Profile')
            .setColor(row?.profile_color || '#5865F2')
            .setTimestamp()
            .addFields(
              { name: 'Bio', value: row?.bio ? String(row.bio).slice(0, 1024) : 'No bio set.' },
              { name: 'Korean Level', value: klevelLabel },
              { name: 'Banner URL', value: row?.profile_banner || 'No banner set.' },
              { name: 'Embed Color', value: row?.profile_color || '#5865F2' }
            );
          if (row?.profile_banner && row.profile_banner.length > 5) embed.setImage(row.profile_banner);
          const rowButtons = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('edit_bio').setLabel('Edit Bio').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('edit_klevel').setLabel('Edit Korean Level').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('edit_banner').setLabel('Edit Banner URL').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('edit_color').setLabel('Edit Embed Color').setStyle(ButtonStyle.Primary)
          );
          if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: `✅ ${field} updated!`, embeds: [embed], components: [rowButtons] });
          } else {
            await interaction.reply({ content: `✅ ${field} updated!`, embeds: [embed], components: [rowButtons] });
          }
        } else {
          await interaction.reply({ content: 'Profile update failed.', ephemeral: true });
        }
        return;
      }
    } catch (e) {
      console.error('Component/modal handling error', e);
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
    // Mini-game answer check (session-based)
    const { getSession, clearSession } = await import('./services/kminigameSessions.js');
    const db = (await import('./db/sqlite.js')).default;
    if (message.channel) {
      const session = getSession(message.channel.id);
      if (session && !message.author.bot && message.content && message.content.toLowerCase().trim() === session.answer) {
        // End minigame session
        clearSession(message.channel.id);
        // Award XP
        const guildId = message.guildId || (message.guild && message.guild.id) || 'global';
        const userId = message.author.id;
        const baseXp = 20;
        const now = Date.now();
        // Fetch user row
        let userRow = db.prepare('SELECT * FROM users WHERE guild_id = ? AND user_id = ?').get(guildId, userId);
        let newXp = baseXp, newLevel = 1, newStreak = 1, newTotal = 1;
        if (userRow) {
          newXp = (userRow.xp || 0) + baseXp;
          newStreak = (userRow.last_correct_at && (now - userRow.last_correct_at) < 24*60*60*1000) ? (userRow.streak || 0) + 1 : 1;
          newTotal = (userRow.total_correct || 0) + 1;
          newLevel = Math.floor(newXp / 100) || 1;
          db.prepare('UPDATE users SET xp = ?, level = ?, streak = ?, total_correct = ?, last_correct_at = ? WHERE guild_id = ? AND user_id = ?')
            .run(newXp, newLevel, newStreak, newTotal, now, guildId, userId);
        } else {
          db.prepare('INSERT INTO users (guild_id, user_id, xp, level, streak, total_correct, last_correct_at) VALUES (?,?,?,?,?,?,?)')
            .run(guildId, userId, newXp, newLevel, newStreak, newTotal, now);
        }
        await message.reply({ content: `🎉 Correct! ${message.author} guessed the word and earned **${baseXp} XP**!`, allowedMentions: { repliedUser: false } });
        return;
      }
    }
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
