import { SlashCommandBuilder } from 'discord.js';
import db from '../db/sqlite.js';

export const data = new SlashCommandBuilder()
  .setName('ksetlevelchannel')
  .setDescription('Set the channel where level-up pings will be sent')
  .addChannelOption(opt => opt.setName('channel').setDescription('Channel to send level-up pings to').setRequired(true));

export default {
  data,
  async execute(interaction) {
    const channel = interaction.options.getChannel('channel');
    const gid = interaction.guildId;
    db.prepare('INSERT OR IGNORE INTO guilds (guild_id) VALUES (?)').run(gid);
    db.prepare('UPDATE guilds SET levelup_channel_id = ? WHERE guild_id = ?').run(channel.id, gid);
    await interaction.reply({ content: `Level-up channel set to <#${channel.id}>`, ephemeral: true });
  }
};
