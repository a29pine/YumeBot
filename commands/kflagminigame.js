import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } from 'discord.js';


// ISO 3166-1 alpha-2 country codes and Korean names
const COUNTRY_KR = {
  "kr": "대한민국", "us": "미국", "jp": "일본", "cn": "중국", "fr": "프랑스", "de": "독일", "gb": "영국", "it": "이탈리아", "ca": "캐나다", "br": "브라질",
  "es": "스페인", "ru": "러시아", "in": "인도", "au": "호주", "mx": "멕시코", "tr": "터키", "ar": "아르헨티나", "za": "남아프리카 공화국", "eg": "이집트", "se": "스웨덴",
  "no": "노르웨이", "fi": "핀란드", "dk": "덴마크", "nl": "네덜란드", "be": "벨기에", "ch": "스위스", "pl": "폴란드", "gr": "그리스", "pt": "포르투갈", "hu": "헝가리",
  "cz": "체코", "at": "오스트리아", "ua": "우크라이나", "ro": "루마니아", "bg": "불가리아", "il": "이스라엘", "sa": "사우디아라비아", "ae": "아랍에미리트", "sg": "싱가포르", "th": "태국",
  "id": "인도네시아", "my": "말레이시아", "ph": "필리핀", "vn": "베트남", "nz": "뉴질랜드", "ie": "아일랜드", "cl": "칠레", "co": "콜롬비아", "pe": "페루", "ve": "베네수엘라",
  "pk": "파키스탄", "bd": "방글라데시", "ir": "이란", "iq": "이라크", "sy": "시리아", "jo": "요르단", "lb": "레바논", "kw": "쿠웨이트", "qa": "카타르", "om": "오만",
  "ye": "예멘", "ma": "모로코", "dz": "알제리", "tn": "튀니지", "ly": "리비아", "ng": "나이지리아", "ke": "케냐", "gh": "가나", "et": "에티오피아", "tz": "탄자니아",
  "ug": "우간다", "zm": "잠비아", "zw": "짐바브웨", "cm": "카메룬", "sn": "세네갈", "ml": "말리", "ci": "코트디부아르", "sd": "수단", "cd": "콩고", "ao": "앙골라"
};

const COUNTRY_CODES = Object.keys(COUNTRY_KR);


const data = new SlashCommandBuilder()
  .setName('kflagminigame')
  .setDescription('Start a multi-round flag guessing game!')
  .addIntegerOption(opt =>
    opt.setName('rounds')
      .setDescription('Number of rounds (1-10)')
      .setMinValue(1)
      .setMaxValue(10)
      .setRequired(true)
  );

// Helper: create settings embed and buttons
function getSettingsEmbed(rounds, answerTime) {
  return new EmbedBuilder()
    .setTitle('🇰🇷 Flag Mini-Game Settings')
    .setDescription('Customize your game settings before starting the lobby!')
    .addFields(
      { name: 'Rounds', value: `${rounds}`, inline: true },
      { name: 'Seconds per Answer', value: `${answerTime}`, inline: true }
    )
    .setColor('#00B4D8')
    .setThumbnail('https://flagcdn.com/w320/kr.png')
    .setFooter({ text: 'Adjust settings below, then press Start Lobby!' });
}

function getSettingsButtons(rounds, answerTime) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('set_rounds_minus').setLabel('−').setStyle(ButtonStyle.Secondary).setDisabled(rounds <= 1),
      new ButtonBuilder().setCustomId('set_rounds_plus').setLabel('+').setStyle(ButtonStyle.Secondary).setDisabled(rounds >= 10),
      new ButtonBuilder().setCustomId('set_time_minus').setLabel('−').setStyle(ButtonStyle.Secondary).setDisabled(answerTime <= 5),
      new ButtonBuilder().setCustomId('set_time_plus').setLabel('+').setStyle(ButtonStyle.Secondary).setDisabled(answerTime >= 30),
      new ButtonBuilder().setCustomId('start_lobby').setLabel('Start Lobby').setStyle(ButtonStyle.Success)
    )
  ];
}
async function execute(interaction) {
  if (!interaction.inGuild()) {
    await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
    return;
  }
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
    await interaction.reply({ content: 'You need the Manage Server permission to start this mini-game.', ephemeral: true });
    return;
  }
  // --- Settings phase ---
  let rounds = interaction.options.getInteger('rounds', true);
  let answerTime = 12;
  const channelId = interaction.channel.id;
  if (!global.kFlagLobbies) global.kFlagLobbies = {};
  if (global.kFlagLobbies[channelId]) {
    return interaction.reply({ content: 'A flag game is already running in this channel.', ephemeral: true });
  }
  // Only the host can interact with settings
  let settingsMsg = await interaction.reply({
    embeds: [getSettingsEmbed(rounds, answerTime)],
    components: getSettingsButtons(rounds, answerTime),
    ephemeral: true,
    fetchReply: true
  });
  // Wait for host to confirm settings
  let settingsDone = false;
  while (!settingsDone) {
    const btn = await settingsMsg.awaitMessageComponent({
      filter: i => i.user.id === interaction.user.id,
      time: 60000
    }).catch(() => null);
    if (!btn) {
      await interaction.editReply({ content: 'Settings timed out.', embeds: [], components: [] });
      return;
    }
    if (btn.customId === 'set_rounds_minus' && rounds > 1) rounds--;
    if (btn.customId === 'set_rounds_plus' && rounds < 10) rounds++;
    if (btn.customId === 'set_time_minus' && answerTime > 5) answerTime -= 1;
    if (btn.customId === 'set_time_plus' && answerTime < 30) answerTime += 1;
    if (btn.customId === 'start_lobby') settingsDone = true;
    await btn.update({
      embeds: [getSettingsEmbed(rounds, answerTime)],
      components: settingsDone ? [] : getSettingsButtons(rounds, answerTime)
    });
  }
  // --- Lobby phase ---
  global.kFlagLobbies[channelId] = {
    host: interaction.user.id,
    players: new Set([interaction.user.id]),
    scores: {},
    round: 0,
    totalRounds: rounds,
    answerTime,
    inProgress: false,
    answers: {},
    currentFlag: null,
    lobbyMessageId: null
  };
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('join_flag_lobby').setLabel('Join Game').setStyle(ButtonStyle.Primary)
  );
  const reply = await interaction.channel.send({ content: `Flag Mini-Game starting soon! Click Join to participate. The host (${interaction.user.username}) will start the game automatically in 15 seconds.`, components: [row], fetchReply: true });
  global.kFlagLobbies[channelId].lobbyMessageId = reply.id;
  setTimeout(async () => {
    const lobby = global.kFlagLobbies[channelId];
    if (!lobby || lobby.inProgress) return;
    lobby.inProgress = true;
    try {
      await reply.edit({ content: `Flag Mini-Game is starting! No more players can join.`, components: [] });
    } catch {}
    const playerIds = Array.from(lobby.players);
    if (playerIds.length === 0) {
      await interaction.channel.send({ content: 'No players joined. Game cancelled.' });
      delete global.kFlagLobbies[channelId];
      return;
    }
    for (const id of playerIds) lobby.scores[id] = 0;
    const usedFlags = new Set();
    try {
      for (let round = 1; round <= lobby.totalRounds; round++) {
        let flagCode;
        let tries = 0;
        do {
          flagCode = COUNTRY_CODES[Math.floor(Math.random() * COUNTRY_CODES.length)];
          tries++;
        } while (usedFlags.has(flagCode) && tries < 10 * COUNTRY_CODES.length);
        usedFlags.add(flagCode);
        const flagUrl = `https://flagcdn.com/w320/${flagCode}.png`;
        const answer = COUNTRY_KR[flagCode];
        lobby.currentFlag = { code: flagCode, answer };
        lobby.answers = {};
        const embed = new EmbedBuilder()
          .setTitle(`🏳️‍🌈 Round ${round} / ${lobby.totalRounds}`)
          .setDescription('What is the Korean name of this country? Type your answer in chat!')
          .setImage(flagUrl)
          .setColor('#00B4D8')
          .setFooter({ text: `You have ${lobby.answerTime} seconds to answer!` });
        await interaction.channel.send({ embeds: [embed] });
        const filter = m => !m.author.bot && lobby.players.has(m.author.id);
        const maxMessages = Math.max(20, playerIds.length * 5);
        const collected = await interaction.channel.awaitMessages({ filter, time: lobby.answerTime * 1000, max: maxMessages }).catch(() => null) || new Map();
        const placements = [];
        const alreadyAnswered = new Set();
        for (const msg of collected.values()) {
          const userId = msg.author.id;
          const isCorrect = msg.content.trim() === answer;
          if (alreadyAnswered.has(userId)) continue;
          if (isCorrect) {
            await msg.react('✅');
            placements.push(userId);
            alreadyAnswered.add(userId);
          } else {
            await msg.react('❌');
          }
        }
        for (let i = 0; i < placements.length; i++) {
          const userId = placements[i];
          const points = Math.max(1, playerIds.length - i);
          lobby.scores[userId] = (lobby.scores[userId] || 0) + points;
          const msg = collected.find(m => m.author.id === userId && m.content.trim() === answer);
          if (msg) {
            await msg.reply({ content: `🎉 **Correct!** +${points} point${points > 1 ? 's' : ''} for ${msg.author}`, allowedMentions: { users: [msg.author.id] } });
          }
        }
        if (placements.length === 0) {
          await interaction.channel.send({ content: `⏰ Time's up! The correct answer was **${answer}**.` });
        }
        await new Promise(res => setTimeout(res, 1200));
      }
    } catch (err) {
      console.error('kflagminigame loop error', err);
    } finally {
      const maxScore = Math.max(...Object.values(lobby.scores));
      const winners = Object.entries(lobby.scores).filter(([id, score]) => score === maxScore).map(([id]) => id);
      const winnerMentions = winners.map(id => `<@${id}>`).join(', ');
      const userNames = {};
      for (const id of playerIds) {
        try {
          const user = await interaction.client.users.fetch(id);
          userNames[id] = user ? user.username : id;
        } catch {
          userNames[id] = id;
        }
      }
      const fields = playerIds.map(id => ({
        name: `🏅 ${userNames[id]}`,
        value: `**${lobby.scores[id]}** point${lobby.scores[id] === 1 ? '' : 's'}`,
        inline: true
      }));
      let desc = '';
      if (winners.length > 0 && maxScore > 0) {
        desc = `🥇 Winner${winners.length > 1 ? 's' : ''}: ${winnerMentions} (+300 XP)`;
      } else {
        desc = 'No winners this time. Better luck next game!';
      }
      const resultEmbed = new EmbedBuilder()
        .setTitle('🏁 Flag Mini-Game Results')
        .setDescription(desc)
        .addFields(fields)
        .setColor('#FFD700')
        .setThumbnail('https://flagcdn.com/w320/kr.png')
        .setFooter({ text: `Thanks for playing! Hosted by ${interaction.user.username}` })
        .setTimestamp();
      try { await interaction.channel.send({ embeds: [resultEmbed] }); } catch {}
      delete global.kFlagLobbies[channelId];
    }
  }, 15000);
}

export default {
  data,
  execute
};