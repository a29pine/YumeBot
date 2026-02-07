import { SlashCommandBuilder } from 'discord.js';
import db from '../db/sqlite.js';
import gameService from '../services/gameService.js';

export const data = new SlashCommandBuilder()
  .setName('kstart')
  .setDescription('Start the Korean word posting loop for this guild');

export default {
  data,
  async execute(interaction) {
    if (!interaction.member.permissions.has('0')) {
      // fallback; check admin
    }
    const gid = interaction.guildId;
    db.prepare('INSERT OR IGNORE INTO guilds (guild_id) VALUES (?)').run(gid);
    db.prepare('UPDATE guilds SET enabled = 1 WHERE guild_id = ?').run(gid);
    await gameService.startLoop(interaction.client, gid);
    await interaction.reply({ content: 'Korean word game started for this server.', ephemeral: true });
  }
};
