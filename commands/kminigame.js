import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import db from '../db/sqlite.js';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
dotenv.config();

export const data = new SlashCommandBuilder()
  .setName('kminigame')
  .setDescription('Guess the Korean word for a random picture!');

export default {
  data,
  async execute(interaction) {
    const PIXABAY_API_KEY = process.env.PIXABAY_API_KEY;
    // Pick a random keyword (could be improved with a word list)
    const keywords = ['apple', 'cat', 'dog', 'tree', 'bird', 'car', 'book', 'flower', 'house', 'fish'];
    const keyword = keywords[Math.floor(Math.random() * keywords.length)];
    const url = `https://pixabay.com/api/?key=${PIXABAY_API_KEY}&q=${encodeURIComponent(keyword)}&image_type=photo&lang=en&safesearch=true&per_page=10`;
    let imageUrl = null;
    try {
      const res = await fetch(url);
      const data = await res.json();
      if (data.hits && data.hits.length > 0) {
        const img = data.hits[Math.floor(Math.random() * data.hits.length)];
        imageUrl = img.webformatURL || img.largeImageURL || img.previewURL;
      }
    } catch (e) {
      console.error('Pixabay fetch error', e);
    }
    if (!imageUrl) {
      return interaction.reply({ content: 'Could not fetch image. Try again.', ephemeral: true });
    }
    // Map keyword to Korean (simple dictionary)
    const englishToKorean = {
      'apple': '사과',
      'cat': '고양이',
      'dog': '개',
      'tree': '나무',
      'bird': '새',
      'car': '자동차',
      'book': '책',
      'flower': '꽃',
      'house': '집',
      'fish': '물고기'
    };
    const koreanAnswer = englishToKorean[keyword];
    const embed = new EmbedBuilder()
      .setTitle('Mini-Game: Guess the Korean Word!')
      .setDescription('Type the Korean word for the image below in chat within 10 seconds!')
      .setImage(imageUrl)
      .setColor('#00B4D8')
      .setFooter({ text: 'Reply in this channel with your guess.' })
      .setTimestamp();
    await interaction.reply({ embeds: [embed], ephemeral: false });
    // Store answer in memory for this channel
    if (!global.kMiniGameAnswers) global.kMiniGameAnswers = {};
    global.kMiniGameAnswers[interaction.channel.id] = {
      answer: koreanAnswer,
      startedAt: Date.now(),
      hostId: interaction.user.id,
      timeout: setTimeout(() => {
        if (global.kMiniGameAnswers[interaction.channel.id]) {
          interaction.followUp({ content: `⏰ Time's up! The correct answer was **${koreanAnswer}**.` });
          delete global.kMiniGameAnswers[interaction.channel.id];
        }
      }, 10000)
    };
  }
};
