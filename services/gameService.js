
import db from '../db/sqlite.js';
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { randomInt } from 'crypto';

// --- Anti-cheat state ---
const userCooldowns = new Map(); // key: guildId-userId, value: timestamp
const userRapid = new Map(); // key: guildId-userId, value: { times: [timestamps] }
const lastCorrectAnswers = new Map(); // key: guildId, value: normalized answer

// Anti-cheat config
const COOLDOWN_MS = 2000; // 2 seconds per guess
const RAPID_WINDOW_MS = 10000; // 10s window
const RAPID_MAX = 3; // max 3 wrong in window
const RAPID_BLOCK_MS = 10000; // 10s block
const rapidBlocks = new Map(); // key: guildId-userId, value: blockUntil timestamp

const activeIntervals = new Map();
const mcqCounters = new Map();

function normalizeAnswer(s) {
  return String(s || '')
    .toLowerCase()
    .trim()
    .replace(/["'“”‘’]/g, '')
    .replace(/<@!?[0-9]+>/g, '')
    .replace(/<@&[0-9]+>/g, '')
    .replace(/<#?[0-9]+>/g, '')
    .replace(/[.,!?;:()\[\]{}]/g, '')
    .replace(/\s+/g, ' ');
}

function isAnswerCorrect(candidate, english, aliases) {
  const norm = normalizeAnswer(candidate);
  if (!norm) return false;
  const targets = [english].concat(aliases || []);
  for (const t of targets) {
    if (!t) continue;
    if (normalizeAnswer(t) === norm) return true;
    // basic plural handling
    if (normalizeAnswer(t).replace(/s$/, '') === norm.replace(/s$/, '')) return true;
  }
  return false;
}

function calculateXp(level, elapsedSeconds) {
  const base = Math.max(5, level * 10);
  const speedBonus = Math.max(0, Math.floor(Math.max(0, 10 - elapsedSeconds) * 0.5));
  return base + speedBonus;
}

function xpToLevel(xp) {
  const lvl = Math.floor((xp || 0) / 100);
  return Math.max(1, lvl);
}

function getDoubleXpMultiplier(userRow) {
  if (!userRow) return 1;
  let inv = {};
  try { inv = JSON.parse(userRow.inventory || '{}'); } catch {}
  if (inv.double_xp_until && Date.now() < inv.double_xp_until) {
    return 2;
  }
  return 1;
}

export async function startLoop(client, guildId) {
  const guildRow = db.prepare('SELECT * FROM guilds WHERE guild_id = ?').get(guildId);
  if (!guildRow || !guildRow.channel_id) return;
  if (activeIntervals.has(guildId)) return;
  const minutes = Number(guildRow.interval_minutes) || 10;
  const ms = Math.max(1, minutes) * 60 * 1000;
  console.log(`Starting Korean word loop for ${guildId}: interval ${minutes} minute(s)`);
  const run = async () => await postQuestion(client, guildId);
  const id = setInterval(run, ms);
  activeIntervals.set(guildId, id);
  // fire immediately
  await postQuestion(client, guildId);
}

export function stopLoop(guildId) {
  const id = activeIntervals.get(guildId);
  if (id) {
    clearInterval(id);
    activeIntervals.delete(guildId);
  }
}


export async function postQuestion(client, guildId) {
  try {
    console.log('postQuestion invoked for guild', guildId);
    const guildRow = db.prepare('SELECT * FROM guilds WHERE guild_id = ?').get(guildId);
    if (!guildRow || !guildRow.enabled || !guildRow.channel_id) return false;
    const channel = await client.channels.fetch(guildRow.channel_id).catch((err) => { console.error('Failed to fetch channel', guildRow.channel_id, err); return null; });
    if (!channel) {
      console.error('Channel not found for', guildRow.channel_id, 'guild', guildId);
      return false;
    }
    if (typeof channel.isTextBased !== 'function' || !channel.isTextBased()) {
      console.error('Channel is not text based:', guildRow.channel_id, 'type:', channel.type);
      return false;
    }

    // ensure no active question
    const active = db.prepare('SELECT * FROM active_questions WHERE guild_id = ?').get(guildId);
    if (active && active.solved === 0) return false;

    // decide whether to send a multiple-choice question every 2-3 posts
    const counter = mcqCounters.get(guildId) || 0;
    const need = mcqCounters.get(`${guildId}:need`) || (Math.random() < 0.5 ? 2 : 3);
    mcqCounters.set(`${guildId}:need`, need);
    if (counter + 1 >= need) {
      mcqCounters.set(guildId, 0);
      mcqCounters.delete(`${guildId}:need`);
      return await postMultipleChoice(client, guildId, guildRow);
    }
    mcqCounters.set(guildId, counter + 1);

    // select random word matching criteria
    const minL = guildRow.min_level || 1;
    const maxL = guildRow.max_level || 5;
    const rows = db.prepare('SELECT * FROM words WHERE level BETWEEN ? AND ?').all(minL, maxL);
    if (!rows || rows.length === 0) return false;
    const idx = randomInt(0, rows.length);
    const word = rows[idx];

    const baseXp = Math.max(5, (word.level || 1) * 10);
    const pronunciation = word.ipa ? String(word.ipa) : (guildRow.show_romanization && word.romanization ? String(word.romanization) : '—');
    const embed = new EmbedBuilder()
      .setTitle(`${word.korean}`)
      .setDescription(`Translate the word below into English. Reply in this channel with your answer.`)
      .addFields(
        { name: 'Pronunciation', value: pronunciation, inline: true },
        { name: 'Category', value: String(word.category || 'general'), inline: true },
        { name: 'Level', value: `${String(word.level || 1)} ⭐ • Base XP: ${baseXp}`, inline: true }
      )
      .setColor('#2b2d42')
      .setFooter({ text: 'Use the Hint button for a clue — fastest answers get a speed bonus.' })
      .setTimestamp();

    const row = new ActionRowBuilder();
    if (guildRow.use_buttons) {
      row.addComponents(
        new ButtonBuilder().setCustomId('hint_korean_' + guildId).setLabel('Hint').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('skip_korean_' + guildId).setLabel('Skip').setStyle(ButtonStyle.Danger)
      );
    }

    const sent = await channel.send({ embeds: [embed], components: row.components.length ? [row] : [] });
    db.prepare('INSERT OR REPLACE INTO active_questions (guild_id, channel_id, word_id, message_id, started_at, solved) VALUES (?,?,?,?,?,0)')
      .run(guildId, guildRow.channel_id, word.id, sent.id, Date.now());
    console.log(`Posted word ${word.korean} (id=${word.id}) to channel ${guildRow.channel_id} in guild ${guildId}`);

    // --- Expire question after 10 seconds ---
    setTimeout(async () => {
      try {
        const q = db.prepare('SELECT * FROM active_questions WHERE guild_id = ?').get(guildId);
        if (q && q.solved === 0) {
          db.prepare('UPDATE active_questions SET solved = 1 WHERE guild_id = ?').run(guildId);
          await channel.send({ content: `⏰ Time's up! The correct answer was **${word.english}**.` });
        }
      } catch (e) {
        console.error('Failed to expire question for guild', guildId, e);
      }
    }, 10000);

    return true;
  } catch (e) {
    console.error('postQuestion error', e);
    return false;
  }
}

async function postMultipleChoice(client, guildId, guildRow) {
  try {
    const channel = await client.channels.fetch(guildRow.channel_id).catch(() => null);
    if (!channel || typeof channel.isTextBased !== 'function' || !channel.isTextBased()) return false;

    // select a target English word and candidates
    const rows = db.prepare('SELECT * FROM words WHERE level BETWEEN ? AND ?').all(guildRow.min_level || 1, guildRow.max_level || 5);
    if (!rows || rows.length < 4) return false;
    // pick correct word
    const correct = rows[randomInt(0, rows.length)];

    // pick 3 distractors (different korean text)
    const distractors = [];
    const pool = rows.filter(r => r.id !== correct.id);
    while (distractors.length < 3 && pool.length) {
      const idx = randomInt(0, pool.length);
      distractors.push(pool.splice(idx, 1)[0]);
    }
    if (distractors.length < 3) return false;

    const options = [correct, ...distractors].sort(() => Math.random() - 0.5);

    const embed = new EmbedBuilder()
      .setTitle('Multiple Choice — Pick the Korean')
      .setDescription(`Which of these is the correct Korean translation for **${correct.english}**?`)
      .addFields({ name: 'Level', value: String(correct.level || 1), inline: true }, { name: 'Category', value: String(correct.category || 'general'), inline: true })
      .setColor('#4CC9F0')
      .setFooter({ text: 'Click the button matching your answer.' })
      .setTimestamp();

    const row = new ActionRowBuilder();
    for (let i = 0; i < options.length; i++) {
      const opt = options[i];
      const label = String(opt.korean).slice(0, 80);
      // encode label to include in customId
      const enc = encodeURIComponent(label);
      const cid = `mcq_${guildId}_${correct.id}_${i}_${enc}`;
      row.addComponents(new ButtonBuilder().setCustomId(cid).setLabel(label).setStyle(ButtonStyle.Primary));
    }

    const sent = await channel.send({ embeds: [embed], components: [row] });
    db.prepare('INSERT OR REPLACE INTO active_questions (guild_id, channel_id, word_id, message_id, started_at, solved) VALUES (?,?,?,?,?,0)')
      .run(guildId, guildRow.channel_id, correct.id, sent.id, Date.now());
    console.log(`Posted MCQ for ${correct.english} (id=${correct.id}) to channel ${guildRow.channel_id} in guild ${guildId}`);
    return true;
  } catch (e) {
    console.error('postMultipleChoice error', e);
    return false;
  }
}

export async function handleMessage(message) {
  try {
    if (!message.guild) return;
    if (message.editedTimestamp) return; // Ignore edited messages (anti-cheat)
    const guildId = message.guild.id;
    const userId = message.author.id;
    const cfg = db.prepare('SELECT * FROM guilds WHERE guild_id = ?').get(guildId);
    if (!cfg || !cfg.enabled || cfg.channel_id !== message.channel.id) return;

    const active = db.prepare('SELECT * FROM active_questions WHERE guild_id = ?').get(guildId);
    if (!active || active.solved) return;

    const word = db.prepare('SELECT * FROM words WHERE id = ?').get(active.word_id);
    if (!word) return;

    // prevent bot messages or the poster
    if (message.author.bot) return;

    // --- Anti-cheat: cooldown ---
    const cooldownKey = `${guildId}-${userId}`;
    const now = Date.now();
    if (userCooldowns.has(cooldownKey) && now - userCooldowns.get(cooldownKey) < COOLDOWN_MS) {
      try { await message.reply({ content: `⏳ Slow down! Wait ${((COOLDOWN_MS - (now - userCooldowns.get(cooldownKey))) / 1000).toFixed(1)}s before guessing again.`, allowedMentions: { repliedUser: false } }); } catch {}
      return;
    }
    userCooldowns.set(cooldownKey, now);

    // --- Anti-cheat: rapid guessing ---
    if (rapidBlocks.has(cooldownKey) && now < rapidBlocks.get(cooldownKey)) {
      try { await message.reply({ content: `🚫 Too many wrong guesses! Try again in ${(Math.ceil((rapidBlocks.get(cooldownKey) - now) / 1000))}s.`, allowedMentions: { repliedUser: false } }); } catch {}
      return;
    }
    let rapid = userRapid.get(cooldownKey) || { times: [] };
    // Clean up old times
    rapid.times = rapid.times.filter(t => now - t < RAPID_WINDOW_MS);

    const aliases = JSON.parse(word.aliases || '[]');
    // diagnostic logging to help match replies
    try {
      const normMsg = normalizeAnswer(message.content);
      const normTarget = normalizeAnswer(word.english);
      const normAliases = (aliases || []).map(a => normalizeAnswer(a));
      console.log('Answer attempt:', { guildId, channel: message.channel.id, user: message.author.id, content: message.content, normMsg, normTarget, normAliases });
    } catch (e) { console.error('Normalization debug failed', e); }

    // --- Anti-cheat: prevent copying last answer after solved ---
    const lastAnsKey = `${guildId}`;
    const normMsg = normalizeAnswer(message.content);
    if (lastCorrectAnswers.has(lastAnsKey) && lastCorrectAnswers.get(lastAnsKey) === normMsg && active.solved) {
      try { await message.reply({ content: `❌ This answer was already used to solve the last question.`, allowedMentions: { repliedUser: false } }); } catch {}
      return;
    }

    if (isAnswerCorrect(message.content, word.english, aliases)) {
      // mark solved
      const now = Date.now();
      db.prepare('UPDATE active_questions SET solved = 1, correct_user_id = ? WHERE guild_id = ?').run(message.author.id, guildId);

      // calculate xp
      const elapsed = Math.floor((now - active.started_at) / 1000);
      const xp = calculateXp(word.level || 1, elapsed);

      // Store last correct answer for anti-cheat
      lastCorrectAnswers.set(lastAnsKey, normalizeAnswer(message.content));

      const userRow = db.prepare('SELECT * FROM users WHERE guild_id = ? AND user_id = ?').get(guildId, message.author.id);
      let coinReward = 0;
      if (userRow) {
        let bonusXp = 0;
        // Give 50-100 coins for every correct answer
        coinReward = Math.floor(Math.random() * 51) + 50;
        // Calculate day streak: count only if a new UTC day is reached
        const lastStreakDay = userRow.last_streak_day || 0;
        const nowDate = new Date(now);
        const todayMidnight = Date.UTC(nowDate.getUTCFullYear(), nowDate.getUTCMonth(), nowDate.getUTCDate());
        let newStreak = 1;
        if (lastStreakDay) {
          if (todayMidnight - lastStreakDay === 24*60*60*1000) {
            newStreak = (userRow.streak || 0) + 1;
          } else if (todayMidnight === lastStreakDay) {
            newStreak = userRow.streak || 1;
          } else {
            newStreak = 1;
          }
        }
        // Bonus XP for streak milestones
        const streakMilestones = [3, 7, 14, 30];
        if (streakMilestones.includes(newStreak)) {
          bonusXp = newStreak * 5;
          coinReward += newStreak * 2; // bonus coins for streak milestones
        }
        const newXp = (userRow.xp || 0) + (xp + bonusXp) * getDoubleXpMultiplier(userRow);
        let newCoins = userRow.coins || 0;
        const newTotal = (userRow.total_correct || 0) + 1;
        newCoins += coinReward;
        const oldLevel = userRow.level || 1;
        const newLevel = xpToLevel(newXp);
        db.prepare('UPDATE users SET xp = ?, level = ?, streak = ?, total_correct = ?, last_correct_at = ?, last_streak_day = ?, coins = ? WHERE guild_id = ? AND user_id = ?')
          .run(newXp, newLevel, newStreak, newTotal, now, todayMidnight, newCoins, guildId, message.author.id);

        // Notify streak milestone
        if (bonusXp > 0) {
          try {
            await message.channel.send({
              content: `<@${message.author.id}> hit a **${newStreak} streak**! (+${bonusXp} bonus XP${coinReward > 0 ? ", +" + coinReward + " coins" : ""} 🎉)`
            });
          } catch (e) { console.error('Streak milestone notify failed', e); }
        }

        // notify level up
        if (newLevel > oldLevel) {
          try {
            const guildRow = db.prepare('SELECT * FROM guilds WHERE guild_id = ?').get(guildId);
            const targetChannelId = guildRow && guildRow.levelup_channel_id ? guildRow.levelup_channel_id : null;
            if (targetChannelId) {
              const ch = await message.client.channels.fetch(targetChannelId).catch(()=>null);
              if (ch && typeof ch.isTextBased === 'function' && ch.isTextBased()) {
                const nextThreshold = (newLevel + 1) * 100;
                const userObj = await message.client.users.fetch(message.author.id).catch(()=>null);
                const username = userObj ? userObj.username : `User ${message.author.id}`;
                const lvlEmbed = new EmbedBuilder()
                  .setTitle('Level Up!')
                  .setDescription(`${username} has leveled up to **Level ${newLevel}** 🎉`)
                  .addFields({ name: 'Current XP', value: String(newXp), inline: true }, { name: 'Next Level At', value: String(nextThreshold), inline: true })
                  .setColor('#FFD166')
                  .setTimestamp();
                await ch.send({ embeds: [lvlEmbed] }).catch(()=>{});
              }
            }
          } catch (e) { console.error('Level up notify failed', e); }
        }
      } else {
        const newXp = xp;
        const newLevel = xpToLevel(newXp);
        // Give 50-100 coins for first correct answer
        coinReward = Math.floor(Math.random() * 51) + 50;
        const newCoins = coinReward;
        db.prepare('INSERT INTO users (guild_id, user_id, xp, level, streak, total_correct, last_correct_at, last_streak_day, coins) VALUES (?,?,?,?,?,?,?,?,?)')
          .run(guildId, message.author.id, newXp, newLevel, 1, 1, now, 0, newCoins);

        // notify level up if they start above level 1
        if (newLevel > 1) {
          try {
            const guildRow = db.prepare('SELECT * FROM guilds WHERE guild_id = ?').get(guildId);
            const targetChannelId = guildRow && guildRow.levelup_channel_id ? guildRow.levelup_channel_id : null;
            if (targetChannelId) {
              const ch = await message.client.channels.fetch(targetChannelId).catch(()=>null);
              if (ch && typeof ch.isTextBased === 'function' && ch.isTextBased()) {
                const nextThreshold = (newLevel + 1) * 100;
                const userObj = await message.client.users.fetch(message.author.id).catch(()=>null);
                const username = userObj ? userObj.username : `User ${message.author.id}`;
                const lvlEmbed = new EmbedBuilder()
                  .setTitle('Level Up!')
                  .setDescription(`${username} has leveled up to **Level ${newLevel}** 🎉`)
                  .addFields({ name: 'Current XP', value: String(newXp), inline: true }, { name: 'Next Level At', value: String(nextThreshold), inline: true })
                  .setColor('#FFD166')
                  .setTimestamp();
                await ch.send({ embeds: [lvlEmbed] }).catch(()=>{});
              }
            }
          } catch (e) { console.error('Level up notify failed', e); }
        }
      }

      // reply with a clean embed
      const resEmbed = new EmbedBuilder()
        .setTitle('Correct!')
        .setDescription(`${message.author} answered correctly for **${xp} XP** and **+${coinReward} coins**\nThe translation of **${word.korean}** is **${word.english}**`)
        .setColor('#57F287')
        .setTimestamp();

      await message.channel.send({ embeds: [resEmbed] });
    } else {
      // Wrong answer: break streak and notify
      // --- Anti-cheat: rapid guessing update ---
      rapid.times.push(now);
      userRapid.set(cooldownKey, rapid);
      if (rapid.times.length >= RAPID_MAX) {
        rapidBlocks.set(cooldownKey, now + RAPID_BLOCK_MS);
        try { await message.reply({ content: `🚫 Too many wrong guesses! You are blocked for ${RAPID_BLOCK_MS/1000}s.`, allowedMentions: { repliedUser: false } }); } catch {}
        return;
      }
      const userRow = db.prepare('SELECT * FROM users WHERE guild_id = ? AND user_id = ?').get(guildId, message.author.id);
      if (userRow && userRow.streak && userRow.streak > 0) {
        let inv = {};
        try { inv = JSON.parse(userRow.inventory || '{}'); } catch {}
        if (inv.streak_freeze && inv.streak_freeze > 0) {
          inv.streak_freeze -= 1;
          db.prepare('UPDATE users SET inventory = ? WHERE guild_id = ? AND user_id = ?').run(JSON.stringify(inv), guildId, message.author.id);
          try {
            await message.reply({ content: `❄️ Streak Freeze used! Your streak is safe.`, allowedMentions: { repliedUser: false } });
          } catch {}
        } else {
          db.prepare('UPDATE users SET streak = 0 WHERE guild_id = ? AND user_id = ?').run(guildId, message.author.id);
          try {
            await message.reply({ content: `❌ Incorrect! Your streak has been reset.`, allowedMentions: { repliedUser: false } });
          } catch {}
        }
      }
    }
  } catch (e) {
    console.error('handleMessage error', e);
  }
}

export async function getLeaderboard(guildId, limit = 10, offset = 0) {
  const rows = db.prepare('SELECT user_id, xp FROM users WHERE guild_id = ? ORDER BY xp DESC LIMIT ? OFFSET ?').all(guildId, limit, offset);
  return rows;
}

export async function getRank(guildId, userId) {
  const row = db.prepare('SELECT xp FROM users WHERE guild_id = ? AND user_id = ?').get(guildId, userId);
  if (!row) return null;
  const higher = db.prepare('SELECT COUNT(*) AS c FROM users WHERE guild_id = ? AND xp > ?').get(guildId, row.xp);
  return higher.c + 1;
}

export async function getProfile(guildId, userId) {
  const row = db.prepare('SELECT * FROM users WHERE guild_id = ? AND user_id = ?').get(guildId, userId);
  return row;
}

export async function handleComponentInteraction(interaction) {
  try {
    if (!interaction.isButton()) return false;
    const id = interaction.customId || '';
    // Multiple choice answer button: mcq_<guildId>_<correctId>_<index>_<korean>
    if (id.startsWith('mcq_')) {
      const parts = id.split('_');
      const guildId = parts[1];
      const correctId = parts[2];
      const index = parts[3];
      const label = decodeURIComponent(parts.slice(4).join('_'));
      const active = db.prepare('SELECT * FROM active_questions WHERE guild_id = ?').get(guildId);
      if (!active || active.solved) return await interaction.reply({ content: 'This question is already solved or expired.', ephemeral: true });
      const word = db.prepare('SELECT * FROM words WHERE id = ?').get(active.word_id);
      if (!word) return await interaction.reply({ content: 'No word found for this question.', ephemeral: true });
      // Check if this is the correct answer
      if (String(word.korean) === label) {
        // mark solved
        db.prepare('UPDATE active_questions SET solved = 1, correct_user_id = ? WHERE guild_id = ?').run(interaction.user.id, guildId);
        // award XP
        const now = Date.now();
        const elapsed = Math.floor((now - active.started_at) / 1000);
        const xp = calculateXp(word.level || 1, elapsed);
        let bonusXp = 0;
        const userRow = db.prepare('SELECT * FROM users WHERE guild_id = ? AND user_id = ?').get(guildId, interaction.user.id);
        let newLevel = 1, newXp = xp, oldLevel = 1, newStreak = 1, newTotal = 1;
        if (userRow) {
          newXp = (userRow.xp || 0) + (xp + bonusXp) * getDoubleXpMultiplier(userRow);
          newStreak = (userRow.last_correct_at && (now - userRow.last_correct_at) < 24*60*60*1000) ? (userRow.streak || 0) + 1 : 1;
          newTotal = (userRow.total_correct || 0) + 1;
          oldLevel = userRow.level || 1;
          newLevel = xpToLevel(newXp);
          db.prepare('UPDATE users SET xp = ?, level = ?, streak = ?, total_correct = ?, last_correct_at = ? WHERE guild_id = ? AND user_id = ?')
            .run(newXp, newLevel, newStreak, newTotal, now, guildId, interaction.user.id);
        } else {
          db.prepare('INSERT INTO users (guild_id, user_id, xp, level, streak, total_correct, last_correct_at) VALUES (?,?,?,?,?,?,?)')
            .run(guildId, interaction.user.id, newXp, newLevel, newStreak, newTotal, now);
        }
        // level up notification
        if (newLevel > oldLevel) {
          try {
            const guildRow = db.prepare('SELECT * FROM guilds WHERE guild_id = ?').get(guildId);
            const targetChannelId = guildRow && guildRow.levelup_channel_id ? guildRow.levelup_channel_id : null;
            if (targetChannelId) {
              const ch = await interaction.client.channels.fetch(targetChannelId).catch(()=>null);
              if (ch && typeof ch.isTextBased === 'function' && ch.isTextBased()) {
                const nextThreshold = (newLevel + 1) * 100;
                const userObj = await interaction.client.users.fetch(interaction.user.id).catch(()=>null);
                const username = userObj ? userObj.username : `User ${interaction.user.id}`;
                const lvlEmbed = new EmbedBuilder()
                  .setTitle('Level Up!')
                  .setDescription(`${username} has leveled up to **Level ${newLevel}** 🎉`)
                  .addFields({ name: 'Current XP', value: String(newXp), inline: true }, { name: 'Next Level At', value: String(nextThreshold), inline: true })
                  .setColor('#FFD166')
                  .setTimestamp();
                await ch.send({ embeds: [lvlEmbed] }).catch(()=>{});
              }
            }
          } catch (e) { console.error('Level up notify failed', e); }
        }
        // reply with result
        const resEmbed = new EmbedBuilder()
          .setTitle('Correct!')
          .setDescription(`${interaction.user} picked the correct answer for **${xp} XP**\nThe Korean for **${word.english}** is **${word.korean}**`)
          .setColor('#57F287')
          .setTimestamp();
        await interaction.reply({ embeds: [resEmbed], ephemeral: false });
      } else {
        // Wrong MCQ: break streak and notify
        const userRow = db.prepare('SELECT * FROM users WHERE guild_id = ? AND user_id = ?').get(guildId, interaction.user.id);
        if (userRow && userRow.streak && userRow.streak > 0) {
          let inv = {};
          try { inv = JSON.parse(userRow.inventory || '{}'); } catch {}
          if (inv.streak_freeze && inv.streak_freeze > 0) {
            inv.streak_freeze -= 1;
            db.prepare('UPDATE users SET inventory = ? WHERE guild_id = ? AND user_id = ?').run(JSON.stringify(inv), guildId, interaction.user.id);
            // Don't reset streak
          } else {
            db.prepare('UPDATE users SET streak = 0 WHERE guild_id = ? AND user_id = ?').run(guildId, interaction.user.id);
          }
        }
        await interaction.reply({ content: '❌ Incorrect! Your streak has been reset.', ephemeral: true });
      }
      return true;
    }
    if (id.startsWith('hint_korean_')) {
      const guildId = id.replace('hint_korean_', '');
      const userId = interaction.user.id;
      const user = db.prepare('SELECT * FROM users WHERE guild_id = ? AND user_id = ?').get(guildId, userId);
      let inv = {};
      try { inv = JSON.parse(user?.inventory || '{}'); } catch {}
      if (!inv.hint_token || inv.hint_token < 1) {
        return await interaction.reply({ content: 'You need a Hint Token to use this!', ephemeral: true });
      }
      // consume token
      inv.hint_token -= 1;
      db.prepare('UPDATE users SET inventory = ? WHERE guild_id = ? AND user_id = ?').run(JSON.stringify(inv), guildId, userId);
      const active = db.prepare('SELECT * FROM active_questions WHERE guild_id = ?').get(guildId);
      if (!active) return await interaction.reply({ content: 'No active question.', ephemeral: true });
      const word = db.prepare('SELECT * FROM words WHERE id = ?').get(active.word_id);
      if (!word) return await interaction.reply({ content: 'No word found for this question.', ephemeral: true });
      // prefer stored hint
      let hint = word.hints || word.hint || '';
      if (hint) {
        try { hint = JSON.parse(hint); } catch (e) {}
      }
      if (!hint) {
        // fallback: show first letter of english
        hint = `Starts with: **${String(word.english || '').slice(0,1)}**`;
      }
      return await interaction.reply({ content: `Hint: ${hint} (Hint Token used)`, ephemeral: true });
    }

    if (id.startsWith('skip_korean_')) {
      const guildId = id.replace('skip_korean_', '');
      const userId = interaction.user.id;
      const user = db.prepare('SELECT * FROM users WHERE guild_id = ? AND user_id = ?').get(guildId, userId);
      let inv = {};
      try { inv = JSON.parse(user?.inventory || '{}'); } catch {}
      if (!inv.skip_token || inv.skip_token < 1) {
        return await interaction.reply({ content: 'You need a Skip Token to use this!', ephemeral: true });
      }
      // consume token
      inv.skip_token -= 1;
      db.prepare('UPDATE users SET inventory = ? WHERE guild_id = ? AND user_id = ?').run(JSON.stringify(inv), guildId, userId);
      const active = db.prepare('SELECT * FROM active_questions WHERE guild_id = ?').get(guildId);
      if (!active) return await interaction.reply({ content: 'No active question to skip.', ephemeral: true });
      // mark as solved/skipped
      db.prepare('UPDATE active_questions SET solved = 1 WHERE guild_id = ?').run(guildId);
      await interaction.reply({ content: 'Question skipped. Posting next word... (Skip Token used)', ephemeral: true });
      // post next question
      try { await postQuestion(interaction.client, guildId); } catch (e) { console.error('Failed to post after skip', e); }
      return true;
    }
    return false;
  } catch (e) {
    console.error('handleComponentInteraction error', e);
    try { await interaction.reply({ content: 'There was an error handling that button.', ephemeral: true }); } catch {}
    return false;
  }
}

export default { startLoop, stopLoop, postQuestion, handleMessage, getLeaderboard, getProfile, getRank, handleComponentInteraction };
