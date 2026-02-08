import { SlashCommandBuilder } from 'discord.js';
import db from '../db/sqlite.js';

export const data = new SlashCommandBuilder()
  .setName('kgive')
  .setDescription('Give your coins to another user')
  .addUserOption(option => option.setName('user').setDescription('User to give coins to').setRequired(true))
  .addIntegerOption(option => option.setName('amount').setDescription('Amount of coins to give').setRequired(true));

export default {
  data,
  async execute(interaction) {
    const giverId = interaction.user.id;
    const receiver = interaction.options.getUser('user');
    const receiverId = receiver.id;
    const amount = interaction.options.getInteger('amount');
    const guildId = interaction.guildId;

    if (receiverId === giverId) {
      return interaction.reply({ content: 'You cannot give coins to yourself.', ephemeral: true });
    }
    if (amount <= 0) {
      return interaction.reply({ content: 'Amount must be greater than zero.', ephemeral: true });
    }
    const giver = db.prepare('SELECT coins FROM users WHERE guild_id = ? AND user_id = ?').get(guildId, giverId);
    if (!giver || (giver.coins || 0) < amount) {
      return interaction.reply({ content: 'You do not have enough coins.', ephemeral: true });
    }
    // Deduct from giver
    db.prepare('UPDATE users SET coins = coins - ? WHERE guild_id = ? AND user_id = ?').run(amount, guildId, giverId);
    // Add to receiver
    db.prepare('INSERT OR IGNORE INTO users (guild_id, user_id, coins) VALUES (?, ?, 0)').run(guildId, receiverId);
    db.prepare('UPDATE users SET coins = coins + ? WHERE guild_id = ? AND user_id = ?').run(amount, guildId, receiverId);
    await interaction.reply({ content: `You gave ${amount} coins to ${receiver}.`, ephemeral: false });
  }
};
