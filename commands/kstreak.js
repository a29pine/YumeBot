import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import gameService from '../services/gameService.js';


export const data = new SlashCommandBuilder()
  .setName('kstreak')
  .setDescription('View your current correct-in-a-row streak')
  .addUserOption(option => option.setName('user').setDescription('User to view (optional)'));

export default {
  data,
  async execute(interaction) {
    const user = interaction.options.getUser('user') || interaction.user;
    const row = await gameService.getProfile(interaction.guildId, user.id);
    if (!row) {
      return await interaction.reply({ content: 'No stats for that user.', ephemeral: true });
    }
    const streak = row.streak || 0;
    const embed = new EmbedBuilder()
      .setTitle(`${user.username}'s Streak`)
      .setDescription(`🔥 **${streak} correct in a row!**\nGet 5 in a row for a bonus!`)
      .setColor('#FF6F00')
      .setFooter({ text: `User ID: ${user.id}` })
      .setTimestamp();
    return await interaction.reply({ embeds: [embed], ephemeral: false });
  }
};
