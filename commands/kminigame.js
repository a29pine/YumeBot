import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import { getSession, setSession, clearSession, hasSession } from '../services/kminigameSessions.js';
dotenv.config();

export const data = new SlashCommandBuilder()
  .setName('kminigame')
  .setDescription('Guess the Korean word for a random picture!');

export default {
  data,
  async execute(interaction) {
    const PIXABAY_API_KEY = process.env.PIXABAY_API_KEY;
    const GAME_DURATION_MS = 20000; // 20 seconds
    const RETRY_LIMIT = 3;

    // Only include guessable, image-friendly nouns with Korean translations
    const WORDS = [
      { en: 'apple', ko: '사과' }, { en: 'cat', ko: '고양이' }, { en: 'dog', ko: '개' }, { en: 'tree', ko: '나무' },
      { en: 'bird', ko: '새' }, { en: 'car', ko: '자동차' }, { en: 'book', ko: '책' }, { en: 'flower', ko: '꽃' },
      { en: 'house', ko: '집' }, { en: 'fish', ko: '물고기' }, { en: 'computer', ko: '컴퓨터' }, { en: 'phone', ko: '전화기' },
      { en: 'mountain', ko: '산' }, { en: 'river', ko: '강' }, { en: 'sun', ko: '태양' }, { en: 'moon', ko: '달' },
      { en: 'star', ko: '별' }, { en: 'shoe', ko: '신발' }, { en: 'shirt', ko: '셔츠' }, { en: 'pants', ko: '바지' },
      { en: 'cup', ko: '컵' }, { en: 'table', ko: '테이블' }, { en: 'chair', ko: '의자' }, { en: 'window', ko: '창문' },
      { en: 'door', ko: '문' }, { en: 'pen', ko: '펜' }, { en: 'pencil', ko: '연필' }, { en: 'bag', ko: '가방' },
      { en: 'clock', ko: '시계' }, { en: 'camera', ko: '카메라' }, { en: 'bicycle', ko: '자전거' }, { en: 'train', ko: '기차' },
      { en: 'bus', ko: '버스' }, { en: 'plane', ko: '비행기' }, { en: 'boat', ko: '배' }, { en: 'hat', ko: '모자' },
      { en: 'bed', ko: '침대' }, { en: 'lamp', ko: '램프' }, { en: 'pizza', ko: '피자' }, { en: 'cake', ko: '케이크' },
      { en: 'banana', ko: '바나나' }, { en: 'grape', ko: '포도' }, { en: 'orange', ko: '오렌지' }, { en: 'rabbit', ko: '토끼' },
      { en: 'horse', ko: '말' }, { en: 'cow', ko: '소' }, { en: 'pig', ko: '돼지' }, { en: 'chicken', ko: '닭' },
      { en: 'lion', ko: '사자' }, { en: 'tiger', ko: '호랑이' }, { en: 'bear', ko: '곰' }, { en: 'elephant', ko: '코끼리' }
    ];

    // 1. Prevent overlapping games
    if (hasSession(interaction.channel.id)) {
      return interaction.reply({ content: 'A mini-game is already running in this channel. Please wait for it to finish!', ephemeral: true });
    }

    // 2. Validate API key
    if (!PIXABAY_API_KEY) {
      return interaction.reply({ content: 'Pixabay API key is missing. Please contact the bot admin.', ephemeral: true });
    }

    // 3. Pick a random word with a Korean translation
    let word, imageUrl, tries = 0;
    while (tries < RETRY_LIMIT) {
      word = WORDS[Math.floor(Math.random() * WORDS.length)];
      // 4. Fetch image from Pixabay
      const url = `https://pixabay.com/api/?key=${PIXABAY_API_KEY}&q=${encodeURIComponent(word.en)}&image_type=photo&lang=en&safesearch=true&per_page=10`;
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Pixabay error: ${res.status}`);
        const data = await res.json();
        if (data.hits && data.hits.length > 0) {
          const img = data.hits[Math.floor(Math.random() * data.hits.length)];
          imageUrl = img.webformatURL || img.largeImageURL || img.previewURL;
          break;
        }
      } catch (e) {
        // Log and try another word
      }
      tries++;
    }
    if (!imageUrl) {
      return interaction.reply({ content: 'Could not fetch an image for the mini-game. Please try again later.', ephemeral: true });
    }

    // 5. Prepare and send the embed
    const difficulty = 'Easy'; // For now, fixed
    const seconds = Math.floor(GAME_DURATION_MS / 1000);
    const embed = new EmbedBuilder()
      .setTitle('🇰🇷 Mini-Game: Guess the Korean Word!')
      .setDescription([
        `**Difficulty:** ${difficulty}`,
        `Type the Korean word for the image below in chat!`,
        `**Ends in ${seconds} seconds.**`
      ].join('\n'))
      .setImage(imageUrl)
      .setColor('#00B4D8')
      .setFooter({ text: `Hosted by ${interaction.user.username} • Korean Word Bot` })
      .setTimestamp();

    const reply = await interaction.reply({ embeds: [embed], ephemeral: false, fetchReply: true });

    // 6. Start session and timeout
    setSession(interaction.channel.id, {
      answer: word.ko,
      keyword: word.en,
      startTime: Date.now(),
      endTime: Date.now() + GAME_DURATION_MS,
      hostId: interaction.user.id,
      messageId: reply.id,
      timeout: setTimeout(async () => {
        // Clean up and notify
        clearSession(interaction.channel.id);
        try {
          await interaction.channel.send({ content: `⏰ Time's up! The correct answer was **${word.ko}** (${word.en}).` });
        } catch {}
      }, GAME_DURATION_MS)
    });
  }
};
