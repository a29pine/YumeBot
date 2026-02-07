import { SlashCommandBuilder } from 'discord.js';
import db from '../db/sqlite.js';

export const data = new SlashCommandBuilder()
  .setName('ksetchannel')
  .setDescription('Set the channel for Korean word posts')
  .addChannelOption(opt => opt.setName('channel').setDescription('Channel to post in').setRequired(true));

export default {
  data,
  async execute(interaction) {
    const channel = interaction.options.getChannel('channel');
    const gid = interaction.guildId;
    db.prepare('INSERT OR IGNORE INTO guilds (guild_id) VALUES (?)').run(gid);
    db.prepare('UPDATE guilds SET channel_id = ? WHERE guild_id = ?').run(channel.id, gid);
    await interaction.reply({ content: `Posting channel set to <#${channel.id}>`, ephemeral: true });
  }
};
