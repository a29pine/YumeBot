import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import gameService from '../services/gameService.js';
import db from '../db/sqlite.js';

export const data = new SlashCommandBuilder()
  .setName('kprofile')
  .setDescription('View or edit your profile')
  .addSubcommand(sc => sc.setName('view').setDescription('View a profile').addUserOption(o => o.setName('user').setDescription('User to view')))
  .addSubcommand(sc => sc.setName('edit').setDescription('Edit your profile').addStringOption(o => o.setName('bio').setDescription('Short bio').setRequired(false)).addStringOption(o => o.setName('korean_level').setDescription('Your Korean level').setRequired(false).addChoices(
    { name: 'Beginner', value: '1' },
    { name: 'Intermediate', value: '2' },
    { name: 'Advanced', value: '3' },
    { name: 'Native', value: '4' }
  )));

export default {
  data,
  async execute(interaction) {
    try {
      let sub;
      try {
        sub = interaction.options.getSubcommand();
      } catch (e) {
        sub = null;
      }
      if (!sub) {
        return await interaction.reply({ content: 'Please specify a subcommand: `view` or `edit`.', ephemeral: true });
      }
      console.log('kprofile invoked', { sub, guild: interaction.guildId, user: interaction.user?.id });

      if (sub === 'view') {
        const user = interaction.options.getUser('user') || interaction.user;
        const row = await gameService.getProfile(interaction.guildId, user.id);
        if (!row) return await interaction.reply({ content: 'No stats for that user.', ephemeral: true });

        const rank = await gameService.getRank(interaction.guildId, user.id);
        const koreanLevelMap = { 0: 'Unspecified', 1: 'Beginner', 2: 'Intermediate', 3: 'Advanced', 4: 'Native' };
        const klevelLabel = koreanLevelMap[row.korean_level] || 'Unspecified';
        const xp = Number(row.xp || 0);
        const level = Number(row.level || 1);
        // Calculate XP needed for next level (not based on Korean level)
        const nextLevel = level + 1;
        const nextThreshold = nextLevel * 100;
        const prevThreshold = level * 100;
        const progressRaw = xp - prevThreshold;
        const progressMax = nextThreshold - prevThreshold;
        const progress = Math.max(0, Math.min(1, progressRaw / progressMax));
        const progressBar = (function(p){
          const full = Math.round(p * 10);
          const empty = 10 - full;
          return '▰'.repeat(full) + '▱'.repeat(empty) + ` ${Math.round(p*100)}%`;
        })(progress);

        // Display badges
        let badges = [];
        try { badges = JSON.parse(row.badges || '[]'); } catch {}
        if (badges.length > 0) {
          const badgeEmojis = badges.map(b => {
            const badge = {
              fast_thinker: '⏱️',
              slang_king: '🗣️',
              night_owl: '🌙',
              unstoppable: '9️⃣'
            }[b] || '🏅';
            return badge;
          }).join(' ');
          embed.addFields({ name: 'Achievements', value: badgeEmojis });
        }

        const embed = new EmbedBuilder()
          .setTitle(`${user.username}'s Korean Profile`)
          .setAuthor({ name: user.tag, iconURL: user.displayAvatarURL({ extension: 'png', size: 128 }) })
          .setThumbnail(user.displayAvatarURL({ extension: 'png', size: 256 }))
          .setColor('#5865F2')
          .setTimestamp()
          .addFields(
            { name: 'Stats', value: `**XP:** ${xp}\n**Level:** ${level}\n**Rank:** ${rank ? String(rank) : '—'}`, inline: true },
            { name: 'Activity', value: `**Streak:** ${row.streak || 0}\n**Total Correct:** ${row.total_correct || 0}`, inline: true },
            { name: 'Korean Level', value: klevelLabel, inline: true }
          )
          .addFields({ name: 'Progress to next level', value: `${progressBar} (${progressRaw < 0 ? 0 : progressRaw}/${progressMax} XP)` });
        if (row.bio) embed.addFields({ name: 'Bio', value: String(row.bio).slice(0, 1024) });
        embed.setFooter({ text: `User ID: ${user.id}` });
        return await interaction.reply({ embeds: [embed], ephemeral: false });
      }

      if (sub === 'edit') {
        const bio = interaction.options.getString('bio');
        const korean_level = interaction.options.getString('korean_level');
        const korean_level_num = korean_level ? parseInt(korean_level, 10) : undefined;
        const gid = interaction.guildId;
        const uid = interaction.user.id;
        const row = db.prepare('SELECT * FROM users WHERE guild_id = ? AND user_id = ?').get(gid, uid);
        if (!row) {
          // create default
          db.prepare('INSERT INTO users (guild_id, user_id, xp, level, streak, total_correct, last_correct_at, bio, korean_level) VALUES (?,?,?,?,?,?,?,?,?)')
            .run(gid, uid, 0, 1, 0, 0, 0, bio || '', korean_level_num || 0);
        } else {
          const newBio = bio !== null && bio !== undefined ? bio : row.bio || '';
          const newLevel = typeof korean_level_num === 'number' && !Number.isNaN(korean_level_num) ? korean_level_num : (row.korean_level || 0);
          db.prepare('UPDATE users SET bio = ?, korean_level = ? WHERE guild_id = ? AND user_id = ?').run(newBio, newLevel, gid, uid);
        }
        return await interaction.reply({ content: 'Profile updated.', ephemeral: true });
      }
    } catch (err) {
      console.error('kprofile handler error', err);
      try { await interaction.reply({ content: 'There was an error handling that command.', ephemeral: true }); } catch (e) {}
    }
  }
};
