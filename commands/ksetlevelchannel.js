import { SlashCommandBuilder, PermissionFlagsBits, ChannelType } from 'discord.js';
import db from '../db/sqlite.js';

export const data = new SlashCommandBuilder()
  .setName('ksetlevelchannel')
  .setDescription('Set the channel where level-up pings will be sent')
  .addChannelOption(opt => opt.setName('channel').setDescription('Channel to send level-up pings to').setRequired(true));

export default {
  data,
  async execute(interaction) {
    if (!interaction.inGuild()) {
      await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
      return;
    }
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
      await interaction.reply({ content: 'You need the Manage Server permission to set the level-up channel.', ephemeral: true });
      return;
    }
    const channel = interaction.options.getChannel('channel');
    const allowed = [ChannelType.GuildText, ChannelType.GuildAnnouncement];
    if (!allowed.includes(channel.type)) {
      await interaction.reply({ content: 'Please choose a text channel.', ephemeral: true });
      return;
    }
    const gid = interaction.guildId;
    db.prepare('INSERT OR IGNORE INTO guilds (guild_id) VALUES (?)').run(gid);
    db.prepare('UPDATE guilds SET levelup_channel_id = ? WHERE guild_id = ?').run(channel.id, gid);
    await interaction.reply({ content: `Level-up channel set to <#${channel.id}>`, ephemeral: true });
  }
};
