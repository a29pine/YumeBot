import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import gameService from '../services/gameService.js';
import db from '../db/sqlite.js';

export const data = new SlashCommandBuilder()
  .setName('kprofile')
  .setDescription('View or edit your profile')
  .addSubcommand(sc => sc.setName('view').setDescription('View a profile').addUserOption(o => o.setName('user').setDescription('User to view')))
  .addSubcommand(sc => sc.setName('edit').setDescription('Edit your profile'));

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
          const total = 20;
          const full = Math.round(p * total);
          const empty = total - full;
          return '▰'.repeat(full) + '▱'.repeat(empty);
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
          .setTitle(`🌸 ${viewedUser.username}'s Korean Profile`)
          .setAuthor({ name: viewedUserTag, iconURL: viewedUserAvatar })
          .setThumbnail(viewedUserAvatarLarge)
          .setColor(row.profile_color || '#5865F2')
          .setTimestamp()
          .addFields(
            { name: '👤 Profile', value: '\u200B', inline: false },
            { name: 'Level', value: `✨ **${level}**`, inline: true },
            { name: 'Rank', value: `🏅 ${rank ? `#${rank}` : '—'}`, inline: true },
            { name: 'Korean Level', value: `📝 ${klevelLabel}`, inline: true },
            { name: '\u200B', value: '\u200B', inline: false },
            { name: 'Progress', value: `${progressBar} ${Math.round(progress*100)}%`, inline: false },
            { name: 'XP', value: `🔮 ${xp} / ${nextThreshold} (next: ${nextLevel})`, inline: true },
            { name: 'Progress Details', value: `(${progressRaw < 0 ? 0 : progressRaw}/${progressMax} XP)`, inline: true },
            { name: '\u200B', value: '\u200B', inline: false },
            { name: 'Bio', value: `💬 ${row.bio ? String(row.bio).slice(0, 1024) : 'No bio set.'}`, inline: false },
            { name: 'Banner', value: row.profile_banner && row.profile_banner.length > 5 ? '🖼️ Banner set.' : '🖼️ No banner set.', inline: false },
            { name: 'Badge', value: `🎖️ ${row.profile_badge || 'None'}`, inline: true },
            { name: 'Social Links', value: `🔗 ${row.profile_social || 'None'}`, inline: true }
          )
          .setFooter({ text: `User ID: ${viewedUserId} • Korean Word Bot` });
        if (row.profile_banner && row.profile_banner.length > 5) statsEmbed.setImage(row.profile_banner);
        statsEmbed.setFooter({ text: `User ID: ${viewedUserId}` });
        const achievementsEmbed = new EmbedBuilder()
          .setTitle(`${viewedUser.username}'s Achievements`)
          .setColor(row.profile_color || '#FFD700')
          .setTimestamp()
          .addFields({ name: 'Achievements', value: badgeEmojis });
        const activityEmbed = new EmbedBuilder()
          .setTitle(`🔥 ${viewedUser.username}'s Activity`)
          .setColor(row.profile_color || '#57F287')
          .setTimestamp()
          .addFields(
            { name: '━━━━━━━━━━', value: '**Activity Summary**', inline: false },
            { name: '🔥 Streak', value: `${row.streak || 0} days`, inline: true },
            { name: '✅ Total Correct', value: `${row.total_correct || 0}`, inline: true },
            { name: '🎮 Games Played', value: `${row.games_played || 0}`, inline: true },
            { name: '━━━━━━━━━━', value: '**Performance**', inline: false },
            { name: '🏆 Win Rate', value: row.games_played && row.games_played > 0 ? `${Math.round((row.total_correct || 0) / row.games_played * 100)}%` : '—', inline: true },
            { name: '⏰ Last Active', value: row.last_active ? new Date(row.last_active).toLocaleString() : 'Unknown', inline: true }
          )
          .setFooter({ text: `User ID: ${viewedUserId} • Activity` });
        const settingsEmbed = new EmbedBuilder()
          .setTitle(`${viewedUser.username}'s Profile Settings`)
          .setColor(row.profile_color || '#5865F2')
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
        const gid = interaction.guildId;
        const uid = interaction.user.id;
        const row = db.prepare('SELECT * FROM users WHERE guild_id = ? AND user_id = ?').get(gid, uid);
        const koreanLevelMap = { 0: 'Unspecified', 1: 'Beginner', 2: 'Intermediate', 3: 'Advanced', 4: 'Native' };
        const klevelLabel = koreanLevelMap[row?.korean_level] || 'Unspecified';
        const embed = new EmbedBuilder()
          .setTitle('Edit Your Profile')
          .setColor(row?.profile_color || '#5865F2')
          .setTimestamp()
          .addFields(
            { name: 'Bio', value: row?.bio ? String(row.bio).slice(0, 1024) : 'No bio set.' },
            { name: 'Korean Level', value: klevelLabel },
            { name: 'Banner URL', value: row?.profile_banner || 'No banner set.' },
            { name: 'Embed Color', value: row?.profile_color || '#5865F2' },
            { name: 'Badge', value: row?.profile_badge || 'None' },
            { name: 'Social Links', value: row?.profile_social || 'None' }
          );
        if (row?.profile_banner && row.profile_banner.length > 5) embed.setImage(row.profile_banner);
        const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = await import('discord.js');
        const rowButtons = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('edit_bio').setLabel('Edit Bio').setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId('edit_klevel').setLabel('Edit Korean Level').setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId('edit_banner').setLabel('Edit Banner URL').setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId('edit_color').setLabel('Edit Embed Color').setStyle(ButtonStyle.Primary)
        );
        const rowButtons2 = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('edit_badge').setLabel('Edit Badge').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('edit_social').setLabel('Edit Social Links').setStyle(ButtonStyle.Secondary)
        );
        await interaction.reply({ embeds: [embed], components: [rowButtons, rowButtons2], ephemeral: true });
        // Listen for button interactions
        const filter = i => ['edit_bio','edit_klevel','edit_banner','edit_color','edit_badge','edit_social'].includes(i.customId) && i.user.id === interaction.user.id;
        const collector = interaction.channel.createMessageComponentCollector({ filter, time: 60000 });
        collector.on('collect', async i => {
          if (i.customId === 'edit_bio') {
            await i.showModal({
              customId: 'modal_edit_bio',
              title: 'Edit Bio',
              components: [{ type: 1, components: [{ type: 4, customId: 'bio_input', label: 'Bio', style: 2, minLength: 1, maxLength: 1024, placeholder: 'Enter your bio', required: true }] }] });
          } else if (i.customId === 'edit_klevel') {
            await i.showModal({
              customId: 'modal_edit_klevel',
              title: 'Edit Korean Level',
              components: [{ type: 1, components: [{ type: 4, customId: 'klevel_input', label: 'Korean Level (1-4)', style: 1, minLength: 1, maxLength: 1, placeholder: '1=Beginner, 2=Intermediate, 3=Advanced, 4=Native', required: true }] }] });
          } else if (i.customId === 'edit_banner') {
            await i.showModal({
              customId: 'modal_edit_banner',
              title: 'Edit Banner URL',
              components: [{ type: 1, components: [{ type: 4, customId: 'banner_input', label: 'Banner Image URL', style: 1, minLength: 5, maxLength: 256, placeholder: 'Paste image URL', required: true }] }] });
          } else if (i.customId === 'edit_color') {
            await i.showModal({
              customId: 'modal_edit_color',
              title: 'Edit Embed Color',
              components: [{ type: 1, components: [{ type: 4, customId: 'color_input', label: 'Embed Color (hex)', style: 1, minLength: 7, maxLength: 7, placeholder: '#5865F2', required: true }] }] });
          } else if (i.customId === 'edit_badge') {
            await i.showModal({
              customId: 'modal_edit_badge',
              title: 'Select Badge',
              components: [{ type: 1, components: [{ type: 4, customId: 'badge_input', label: 'Badge', style: 1, minLength: 1, maxLength: 20, placeholder: '⏱️, 🗣️, 🌙, 9️⃣', required: true }] }] });
          } else if (i.customId === 'edit_social') {
            await i.showModal({
              customId: 'modal_edit_social',
              title: 'Select Social Link',
              components: [{ type: 1, components: [{ type: 4, customId: 'social_input', label: 'Social Link', style: 1, minLength: 1, maxLength: 50, placeholder: 'Instagram, Twitter, etc.', required: true }] }] });
          }
        });
        collector.on('end', async () => { try { await interaction.editReply({ components: [] }); } catch {} });
        // modal submit handler  bit hacky since we don't have a global modal handler, but it works 
        return;
      }
    } catch (err) {
      console.error('kprofile handler error', err);
      try { await interaction.reply({ content: 'There was an error handling that command.', ephemeral: true }); } catch (e) {}
    }
  }
};
