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
      const keywords = [
        'apple', 'cat', 'dog', 'tree', 'bird', 'car', 'book', 'flower', 'house', 'fish',
        'computer', 'phone', 'mountain', 'river', 'sun', 'moon', 'star', 'shoe', 'shirt', 'pants',
        'cup', 'table', 'chair', 'window', 'door', 'pen', 'pencil', 'bag', 'clock', 'camera',
        'bicycle', 'train', 'bus', 'plane', 'boat', 'hat', 'glove', 'sock', 'bed', 'lamp',
        'pizza', 'cake', 'icecream', 'banana', 'grape', 'orange', 'peach', 'strawberry', 'watermelon',
        'rabbit', 'horse', 'cow', 'pig', 'chicken', 'duck', 'goose', 'lion', 'tiger', 'bear',
        'elephant', 'monkey', 'fox', 'wolf', 'deer', 'frog', 'snake', 'turtle', 'bee', 'ant',
        'spider', 'whale', 'dolphin', 'shark', 'octopus', 'crab', 'lobster', 'shrimp', 'seal',
        'school', 'teacher', 'student', 'desk', 'blackboard', 'eraser', 'backpack', 'notebook', 'ruler', 'scissors',
        'hospital', 'doctor', 'nurse', 'medicine', 'bandage', 'ambulance', 'stethoscope', 'thermometer', 'syringe', 'wheelchair',
        'restaurant', 'chef', 'waiter', 'menu', 'fork', 'spoon', 'knife', 'plate', 'glass', 'napkin',
        'market', 'shop', 'cashier', 'basket', 'cart', 'money', 'receipt', 'bag', 'customer', 'store',
        'city', 'street', 'building', 'bridge', 'road', 'traffic', 'light', 'crosswalk', 'bus stop', 'park',
        'family', 'mother', 'father', 'sister', 'brother', 'grandmother', 'grandfather', 'child', 'baby', 'parent',
        'music', 'song', 'singer', 'band', 'guitar', 'piano', 'drum', 'violin', 'flute', 'microphone',
        'movie', 'actor', 'actress', 'director', 'screen', 'camera', 'ticket', 'popcorn', 'seat', 'theater',
        'weather', 'rain', 'snow', 'cloud', 'wind', 'storm', 'fog', 'temperature', 'umbrella', 'season',
        'food', 'rice', 'noodle', 'meat', 'vegetable', 'fruit', 'egg', 'milk', 'bread', 'soup',
        'color', 'red', 'blue', 'green', 'yellow', 'purple', 'pink', 'brown', 'black', 'white',
        'animal', 'dog', 'cat', 'bird', 'fish', 'horse', 'cow', 'pig', 'rabbit', 'lion',
        'transport', 'car', 'bus', 'train', 'plane', 'boat', 'bicycle', 'motorcycle', 'truck', 'subway',
        'nature', 'tree', 'flower', 'mountain', 'river', 'sea', 'lake', 'forest', 'desert', 'island',
        'body', 'head', 'face', 'eye', 'ear', 'nose', 'mouth', 'hand', 'foot', 'leg',
        'clothes', 'shirt', 'pants', 'dress', 'skirt', 'coat', 'hat', 'sock', 'shoe', 'glove'
      ];
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
        'apple': '사과', 'cat': '고양이', 'dog': '개', 'tree': '나무', 'bird': '새', 'car': '자동차', 'book': '책', 'flower': '꽃', 'house': '집', 'fish': '물고기',
        'computer': '컴퓨터', 'phone': '전화기', 'mountain': '산', 'river': '강', 'sun': '태양', 'moon': '달', 'star': '별', 'shoe': '신발', 'shirt': '셔츠', 'pants': '바지',
        'cup': '컵', 'table': '테이블', 'chair': '의자', 'window': '창문', 'door': '문', 'pen': '펜', 'pencil': '연필', 'bag': '가방', 'clock': '시계', 'camera': '카메라',
        'bicycle': '자전거', 'train': '기차', 'bus': '버스', 'plane': '비행기', 'boat': '배', 'hat': '모자', 'glove': '장갑', 'sock': '양말', 'bed': '침대', 'lamp': '램프',
        'pizza': '피자', 'cake': '케이크', 'icecream': '아이스크림', 'banana': '바나나', 'grape': '포도', 'orange': '오렌지', 'peach': '복숭아', 'strawberry': '딸기', 'watermelon': '수박',
        'rabbit': '토끼', 'horse': '말', 'cow': '소', 'pig': '돼지', 'chicken': '닭', 'duck': '오리', 'goose': '거위', 'lion': '사자', 'tiger': '호랑이', 'bear': '곰',
        'elephant': '코끼리', 'monkey': '원숭이', 'fox': '여우', 'wolf': '늑대', 'deer': '사슴', 'frog': '개구리', 'snake': '뱀', 'turtle': '거북이', 'bee': '벌', 'ant': '개미',
        'spider': '거미', 'whale': '고래', 'dolphin': '돌고래', 'shark': '상어', 'octopus': '문어', 'crab': '게', 'lobster': '랍스터', 'shrimp': '새우', 'seal': '물개',
        'school': '학교', 'teacher': '선생님', 'student': '학생', 'desk': '책상', 'blackboard': '칠판', 'eraser': '지우개', 'backpack': '배낭', 'notebook': '노트', 'ruler': '자', 'scissors': '가위',
        'hospital': '병원', 'doctor': '의사', 'nurse': '간호사', 'medicine': '약', 'bandage': '붕대', 'ambulance': '구급차', 'stethoscope': '청진기', 'thermometer': '온도계', 'syringe': '주사기', 'wheelchair': '휠체어',
        'restaurant': '식당', 'chef': '요리사', 'waiter': '웨이터', 'menu': '메뉴', 'fork': '포크', 'spoon': '숟가락', 'knife': '칼', 'plate': '접시', 'glass': '유리잔', 'napkin': '냅킨',
        'market': '시장', 'shop': '가게', 'cashier': '계산원', 'basket': '바구니', 'cart': '카트', 'money': '돈', 'receipt': '영수증', 'customer': '손님', 'store': '상점',
        'city': '도시', 'street': '거리', 'building': '건물', 'bridge': '다리', 'road': '도로', 'traffic': '교통', 'light': '빛', 'crosswalk': '횡단보도', 'bus stop': '버스정류장', 'park': '공원',
        'family': '가족', 'mother': '어머니', 'father': '아버지', 'sister': '여동생', 'brother': '남동생', 'grandmother': '할머니', 'grandfather': '할아버지', 'child': '아이', 'baby': '아기', 'parent': '부모',
        'music': '음악', 'song': '노래', 'singer': '가수', 'band': '밴드', 'guitar': '기타', 'piano': '피아노', 'drum': '드럼', 'violin': '바이올린', 'flute': '플루트', 'microphone': '마이크',
        'movie': '영화', 'actor': '배우', 'actress': '여배우', 'director': '감독', 'screen': '스크린', 'ticket': '티켓', 'popcorn': '팝콘', 'seat': '좌석', 'theater': '극장',
        'weather': '날씨', 'rain': '비', 'snow': '눈', 'cloud': '구름', 'wind': '바람', 'storm': '폭풍', 'fog': '안개', 'temperature': '온도', 'umbrella': '우산', 'season': '계절',
        'food': '음식', 'rice': '밥', 'noodle': '국수', 'meat': '고기', 'vegetable': '채소', 'fruit': '과일', 'egg': '계란', 'milk': '우유', 'bread': '빵', 'soup': '수프',
        'color': '색깔', 'red': '빨강', 'blue': '파랑', 'green': '초록', 'yellow': '노랑', 'purple': '보라', 'pink': '분홍', 'brown': '갈색', 'black': '검정', 'white': '하양',
        'animal': '동물', 'transport': '교통수단', 'nature': '자연', 'body': '몸', 'clothes': '옷',
        'dress': '드레스', 'skirt': '치마', 'coat': '코트', 'motorcycle': '오토바이', 'truck': '트럭', 'subway': '지하철', 'sea': '바다', 'lake': '호수', 'forest': '숲', 'desert': '사막', 'island': '섬',
        'head': '머리', 'face': '얼굴', 'eye': '눈', 'ear': '귀', 'nose': '코', 'mouth': '입', 'hand': '손', 'foot': '발', 'leg': '다리'
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
          interaction.channel.send({ content: `⏰ Time's up! The correct answer was **${koreanAnswer}**.` });
          delete global.kMiniGameAnswers[interaction.channel.id];
        }
      }, 10000)
    };
  }
};
