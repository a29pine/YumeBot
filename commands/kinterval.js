import { SlashCommandBuilder } from 'discord.js';
import db from '../db/sqlite.js';
import gameService from '../services/gameService.js';

export const data = new SlashCommandBuilder()
  .setName('kinterval')
  .setDescription('Set how often the Korean word is posted automatically (minutes, 0 to disable)')
  .addIntegerOption(opt => opt.setName('minutes').setDescription('Interval in minutes (0 to disable)').setRequired(true));


export async function execute(interaction) {
  // Only allow admins or users with MANAGE_GUILD
  if (!interaction.memberPermissions?.has('ManageGuild') && !interaction.memberPermissions?.has('Administrator')) {
    await interaction.reply({ content: 'You must be a server admin or have Manage Server permissions to use this command.', ephemeral: true });
    return;
  }
  const gid = interaction.guildId;
  const minutes = interaction.options.getInteger('minutes', true);
  db.prepare('INSERT OR IGNORE INTO guilds (guild_id) VALUES (?)').run(gid);
  db.prepare('UPDATE guilds SET interval_minutes = ? WHERE guild_id = ?').run(minutes, gid);
  const cfg = db.prepare('SELECT * FROM guilds WHERE guild_id = ?').get(gid);
  // if enabled, restart loop to pick up new interval
  if (cfg && cfg.enabled) {
    try {
      gameService.stopLoop(gid);
      await gameService.startLoop(interaction.client, gid);
    } catch (e) {
      console.error('Failed to restart game loop after setting interval', e);
    }
  }
  await interaction.reply({ content: `Korean word interval set to ${minutes} minute(s).`, ephemeral: true });
}

export default { data, execute };
