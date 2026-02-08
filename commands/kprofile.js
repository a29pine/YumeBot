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
      if (sub === 'view') {
        const viewedUser = interaction.options.getUser('user') || interaction.user;
        const viewedUserId = viewedUser.id;
        const viewedUserTag = viewedUser.tag;
        const viewedUserAvatar = viewedUser.displayAvatarURL({ extension: 'png', size: 128 });
        const viewedUserAvatarLarge = viewedUser.displayAvatarURL({ extension: 'png', size: 256 });
        const row = await gameService.getProfile(interaction.guildId, viewedUserId);
        if (!row) return await interaction.reply({ content: 'No stats for that user.', ephemeral: true });
        const rank = await gameService.getRank(interaction.guildId, viewedUserId);
        const koreanLevelMap = { 0: 'Unspecified', 1: 'Beginner', 2: 'Intermediate', 3: 'Advanced', 4: 'Native' };
        const klevelLabel = koreanLevelMap[row.korean_level] || 'Unspecified';
        const xp = Number(row.xp || 0);
        const level = Number(row.level || 1);
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
        let badges = [];
        try { badges = JSON.parse(row.badges || '[]'); } catch {}
        const badgeEmojis = badges.length > 0 ? badges.map(b => {
          const badge = {
            fast_thinker: '⏱️',
            slang_king: '🗣️',
            night_owl: '🌙',
            unstoppable: '9️⃣'
          }[b] || '🏅';
          return badge;
        }).join(' ') : 'No achievements yet.';
        const { ActionRowBuilder, StringSelectMenuBuilder } = await import('discord.js');
        const select = new StringSelectMenuBuilder()
          .setCustomId(`profile_tab_select_${viewedUserId}`)
          .setPlaceholder('Select a tab')
          .addOptions([
            { label: 'Stats', value: 'stats', description: 'View stats', emoji: '📊' },
            { label: 'Achievements', value: 'achievements', description: 'View achievements', emoji: '🏅' },
            { label: 'Activity', value: 'activity', description: 'View activity', emoji: '🔥' },
            { label: 'Settings', value: 'settings', description: 'Edit profile', emoji: '⚙️' }
          ]);
        const rowMenu = new ActionRowBuilder().addComponents(select);
        const statsEmbed = new EmbedBuilder()
          .setTitle(`${viewedUser.username}'s Korean Profile — Stats`)
          .setAuthor({ name: viewedUserTag, iconURL: viewedUserAvatar })
          .setThumbnail(viewedUserAvatarLarge)
          .setColor('#5865F2')
          .setTimestamp()
          .addFields(
            { name: 'XP', value: `${xp}`, inline: true },
            { name: 'Level', value: `${level}`, inline: true },
            { name: 'Rank', value: `${rank ? String(rank) : '—'}`, inline: true },
            { name: 'Korean Level', value: klevelLabel, inline: true },
            { name: 'Progress to next level', value: `${progressBar} (${progressRaw < 0 ? 0 : progressRaw}/${progressMax} XP)` },
            { name: 'Bio', value: row.bio ? String(row.bio).slice(0, 1024) : 'No bio set.' }
          );
        statsEmbed.setFooter({ text: `User ID: ${viewedUserId}` });
        const achievementsEmbed = new EmbedBuilder()
          .setTitle(`${viewedUser.username}'s Achievements`)
          .setColor('#FFD700')
          .setTimestamp()
          .addFields({ name: 'Achievements', value: badgeEmojis });
        const activityEmbed = new EmbedBuilder()
          .setTitle(`${viewedUser.username}'s Activity`)
          .setColor('#57F287')
          .setTimestamp()
          .addFields(
            { name: 'Streak', value: `${row.streak || 0}`, inline: true },
            { name: 'Total Correct', value: `${row.total_correct || 0}`, inline: true }
          );
        const settingsEmbed = new EmbedBuilder()
          .setTitle(`${viewedUser.username}'s Profile Settings`)
          .setColor('#5865F2')
          .setTimestamp()
          .addFields(
            { name: 'Korean Level', value: klevelLabel }
          );
        await interaction.reply({ embeds: [statsEmbed], components: [rowMenu], ephemeral: false });
        const filter = i => i.customId === `profile_tab_select_${viewedUserId}` && i.user.id === interaction.user.id;
        const collector = interaction.channel.createMessageComponentCollector({ filter, time: 60000 });
        collector.on('collect', async i => {
          let embed;
          if (i.values[0] === 'stats') embed = statsEmbed;
          else if (i.values[0] === 'achievements') embed = achievementsEmbed;
          else if (i.values[0] === 'activity') embed = activityEmbed;
          else if (i.values[0] === 'settings') embed = settingsEmbed;
          await i.update({ embeds: [embed], components: [rowMenu] });
        });
        collector.on('end', async () => {
          try { await interaction.editReply({ components: [] }); } catch {}
        });
        return;
      }
      if (sub === 'edit') {
        const bio = interaction.options.getString('bio');
        const korean_level = interaction.options.getString('korean_level');
        const korean_level_num = korean_level ? parseInt(korean_level, 10) : undefined;
        const gid = interaction.guildId;
        const uid = interaction.user.id;
        const row = db.prepare('SELECT * FROM users WHERE guild_id = ? AND user_id = ?').get(gid, uid);
        if (!row) {
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
