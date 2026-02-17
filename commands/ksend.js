import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
const cooldownMs = 30000;
const lastSend = new Map(); // key: guildId, value: timestamp
import gameService from '../services/gameService.js';
import db from '../db/sqlite.js';

export const data = new SlashCommandBuilder()
  .setName('ksend')
  .setDescription('Force send a Korean word question immediately for this guild');

export async function execute(interaction) {
  if (!interaction.inGuild()) {
    await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
    return;
  }
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
    await interaction.reply({ content: 'You need the Manage Server permission to force-send a question.', ephemeral: true });
    return;
  }
  const gid = interaction.guildId;
  const now = Date.now();
  const last = lastSend.get(gid) || 0;
  if (now - last < cooldownMs) {
    const waitSec = Math.ceil((cooldownMs - (now - last)) / 1000);
    await interaction.reply({ content: `Please wait ${waitSec}s before force-sending another question.`, ephemeral: true });
    return;
  }
  lastSend.set(gid, now);
  try {
    // clear any existing active question so force-send always posts
    try {
      db.prepare('UPDATE active_questions SET solved = 1 WHERE guild_id = ?').run(gid);
    } catch (err) {
      console.error('Failed to clear active question before ksend', err);
    }
    const posted = await gameService.postQuestion(interaction.client, gid);
    if (posted) {
      await interaction.reply({ content: 'Korean word posted.', ephemeral: true });
    } else {
      await interaction.reply({ content: 'No word posted — check that the game is enabled and the channel is configured and the bot has send permission.', ephemeral: true });
    }
  } catch (e) {
    console.error('ksend error', e);
    await interaction.reply({ content: `Failed to post word: ${e.message}`, ephemeral: true });
  }
}

export default { data, execute };
