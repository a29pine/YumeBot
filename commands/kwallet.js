import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import gameService from '../services/gameService.js';

export const data = new SlashCommandBuilder()
  .setName('kwallet')
  .setDescription('View your wallet (coins, tokens, boosts)')
  .addUserOption(option => option.setName('user').setDescription('User to view (optional)'));

export default {
  data,
  async execute(interaction) {
    const user = interaction.options.getUser('user') || interaction.user;
    const row = await gameService.getProfile(interaction.guildId, user.id);
    if (!row) {
      return await interaction.reply({ content: 'No wallet found for that user.', ephemeral: true });
    }
    const coins = row.coins || 0;
    // Placeholder for tokens/boosts
    const embed = new EmbedBuilder()
      .setTitle(`${user.username}'s Wallet`)
      .setDescription(`💰 **${coins} coins**`)
      .setColor('#FFD700')
      .setFooter({ text: `User ID: ${user.id}` })
      .setTimestamp();
    return await interaction.reply({ embeds: [embed], ephemeral: false });
  }
};
