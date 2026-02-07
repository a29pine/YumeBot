import { SlashCommandBuilder } from 'discord.js';
import gameService from '../services/gameService.js';
import db from '../db/sqlite.js';

export const data = new SlashCommandBuilder()
  .setName('ksend')
  .setDescription('Force send a Korean word question immediately for this guild');

export async function execute(interaction) {
  const gid = interaction.guildId;
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
