import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import db from '../db/sqlite.js';

// Define shop items
const SHOP_ITEMS = [
  {
    id: 'streak_freeze',
    name: 'Streak Freeze',
    description: 'Protect your streak from breaking once.',
    price: 500,
    emoji: '🧊',
  },
  {
    id: 'hint_token',
    name: 'Hint Token',
    description: 'Redeem for a hint on any question.',
    price: 200,
    emoji: '💡',
  },
  {
    id: 'skip_token',
    name: 'Skip Token',
    description: 'Skip a question without penalty.',
    price: 300,
    emoji: '⏭️',
  },
  {
    id: 'profile_banner',
    name: 'Custom Profile Banner',
    description: 'Unlock a custom banner for your profile.',
    price: 2000,
    emoji: '🖼️',
  },
  {
    id: 'double_xp',
    name: 'Double XP (1h)',
    description: 'Earn double XP for 1 hour.',
    price: 1000,
    emoji: '⚡',
  },
  // Add more items as needed
  {
    id: 'rename_token',
    name: 'Rename Token',
    description: 'Change your display name in leaderboards.',
    price: 800,
    emoji: '✏️',
  },
];

export default {
  data: new SlashCommandBuilder()
    .setName('kshop')
    .setDescription('View and buy items from the shop!')
    .addStringOption(option =>
      option.setName('item')
        .setDescription('ID of the item to buy')
        .setRequired(false)
        .addChoices(...SHOP_ITEMS.map(i => ({ name: `${i.emoji} ${i.name} (${i.price} coins)`, value: i.id })))
    ),
  async execute(interaction) {
    const userId = interaction.user.id;
    const guildId = interaction.guild.id;
    const itemId = interaction.options.getString('item');
    const user = db.prepare('SELECT * FROM users WHERE guild_id = ? AND user_id = ?').get(guildId, userId);
    if (!user) {
      return interaction.reply({ content: 'You have no account yet. Answer a question to get started!', ephemeral: true });
    }
    if (!itemId) {
      // Show shop
      const embed = new EmbedBuilder()
        .setTitle('🛒 KoreanBot Shop')
        .setDescription('Spend your coins on useful items! Use `/kshop item:<item>` to buy.')
        .addFields(
          SHOP_ITEMS.map(i => ({
            name: `${i.emoji} ${i.name} — ${i.price} coins`,
            value: i.description,
            inline: false,
          }))
        )
        .setFooter({ text: `You have ${user.coins || 0} coins.` })
        .setColor('#FFD700');
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }
    // Buying logic
    const item = SHOP_ITEMS.find(i => i.id === itemId);
    if (!item) {
      return interaction.reply({ content: 'Invalid item selected.', ephemeral: true });
    }
    if ((user.coins || 0) < item.price) {
      return interaction.reply({ content: `You need ${item.price} coins for this item.`, ephemeral: true });
    }
    // Deduct coins
    db.prepare('UPDATE users SET coins = coins - ? WHERE guild_id = ? AND user_id = ?').run(item.price, guildId, userId);
    // Grant item (simple inventory system)
    let inv = {};
    try {
      inv = JSON.parse(user.inventory || '{}');
    } catch {}
    inv[item.id] = (inv[item.id] || 0) + 1;
    db.prepare('UPDATE users SET inventory = ? WHERE guild_id = ? AND user_id = ?').run(JSON.stringify(inv), guildId, userId);
    return interaction.reply({ content: `You bought **${item.name}** for ${item.price} coins!`, ephemeral: true });
  },
};
