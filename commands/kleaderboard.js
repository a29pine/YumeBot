import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import gameService from '../services/gameService.js';

export const data = new SlashCommandBuilder()
  .setName('kleaderboard')
  .setDescription('Show top users by XP')
  .addIntegerOption(o=>o.setName('page').setDescription('Page number'));

export default {
  data,
  async execute(interaction) {
    const page = Math.max(1, interaction.options.getInteger('page') || 1);
    const limit = 10;
    const offset = (page-1)*limit;
    const rows = await gameService.getLeaderboard(interaction.guildId, limit, offset);
    if (!rows.length) return await interaction.reply({ content: 'No data yet.', ephemeral: true });

    // build a richer embed: highlight top 3, include small stats per user
    let thumbnail = null;
    try {
      const top = rows[0];
      const u = await interaction.client.users.fetch(top.user_id).catch(() => null);
      if (u) thumbnail = u.displayAvatarURL({ extension: 'png', size: 128 });
    } catch {}

    const embed = new EmbedBuilder()
      .setTitle(`Korean Leaderboard — Page ${page}`)
      .setColor('#5865F2')
      .setTimestamp()
      .setDescription('Top learners in this server — keep practicing!');
    if (thumbnail) embed.setThumbnail(thumbnail);

    const medals = ['🥇','🥈','🥉'];

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const rank = offset + i + 1;
      let userTag = `<@${r.user_id}>`;
      let username = null;
      try { const u = await interaction.client.users.fetch(r.user_id).catch(()=>null); if (u) { username = u.username; userTag = `${u}`; } } catch {}

      // fetch profile to show extra stats
      const profile = await gameService.getProfile(interaction.guildId, r.user_id);
      const totalCorrect = profile ? (profile.total_correct || 0) : 0;
      const streak = profile ? (profile.streak || 0) : 0;
      const klevel = profile ? (profile.korean_level || 0) : 0;
      const klabels = {0: '—', 1: 'Beginner', 2: 'Intermediate', 3: 'Advanced', 4: 'Native'};

      const nameLine = `${medals[i] ? medals[i] + ' ' : ''}**${rank}. ${username || userTag}**`;
      const valueLine = `XP: **${r.xp}** • Correct: **${totalCorrect}** • Streak: **${streak}** • Level: **${klabels[klevel] || '—'}**`;

      embed.addFields({ name: nameLine, value: valueLine, inline: false });
    }

    // footer with requester info
    try {
      embed.setFooter({ text: `Requested by ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL({ extension: 'png', size: 64 }) });
    } catch {}

    await interaction.reply({ embeds: [embed], ephemeral: false });
  }
};
