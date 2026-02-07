import { SlashCommandBuilder } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('kinfo')
    .setDescription('Information about the bot and its features.'),
  async execute(interaction) {
    await interaction.reply({
      embeds: [
        {
          title: 'Korean Word Game Bot',
          description:
            'This bot helps you learn and practice Korean vocabulary through daily word games, quizzes, and challenges!\n\n**Main Features:**\n- Daily Korean word quizzes (with MCQ, hints, and skip options)\n- Streak and XP system with level-up pings\n- Shop and economy for hints and bonuses\n- User stats, inventory, and wallet\n- Anti-cheat and cooldowns\n- Works in all servers!\n\n**Report bugs or feedback:**\nContact bomberrie (<@744828801153892382>) on Discord.',
          color: 0x0099ff,
          footer: { text: 'Thank you for playing and learning!' },
        },
      ],
      ephemeral: true,
    });
  },
};
