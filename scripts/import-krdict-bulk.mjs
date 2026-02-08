import fetch from 'node-fetch';
import db from '../db/sqlite.js';
import dotenv from 'dotenv';
dotenv.config();

const KRDICT_API_KEY = process.env.KRDICT_API_KEY || '9FF69A9165A5DAA3511CD97AE7F4D283';
const BATCHES = 30; // 30 batches x 20 = 600 words
const ROWS = 20;

function randomHangul() {
  // Pick a random Hangul syllable
  return String.fromCharCode(0xAC00 + Math.floor(Math.random() * (0xD7A3 - 0xAC00)));
}

async function fetchWords(query) {
  const url = `https://krdict.korean.go.kr/openApi/search?key=${KRDICT_API_KEY}&target_type=search&part=word&q=${encodeURIComponent(query)}&sort=popular&rows=${ROWS}`;
  const res = await fetch(url);
  const xml = await res.text();
  const items = xml.match(/<item>([\s\S]*?)<\/item>/g) || [];
  const words = [];
  for (const item of items) {
    const korean = (item.match(/<word>(.*?)<\/word>/) || [])[1];
    const english = (item.match(/<sense>.*?<translation>(.*?)<\/translation>/) || [])[1];
    const ipa = (item.match(/<pronunciation>(.*?)<\/pronunciation>/) || [])[1];
    if (korean && english) {
      words.push({ korean, english, ipa });
    }
  }
  return words;
}

async function main() {
  let total = 0;
  const seen = new Set();
  for (let i = 0; i < BATCHES; i++) {
    const query = randomHangul();
    const words = await fetchWords(query);
    const insert = db.prepare('INSERT OR IGNORE INTO words (korean, english, ipa, level, category, aliases) VALUES (?,?,?,?,?,?)');
    const tx = db.transaction((items) => {
      for (const it of items) {
        const key = it.korean + '|' + it.english;
        if (!seen.has(key)) {
          insert.run(it.korean, it.english, it.ipa || '', 1, 'api', '[]');
          seen.add(key);
          total++;
        }
      }
    });
    tx(words);
    console.log(`Batch ${i+1}: Imported ${words.length} words.`);
  }
  console.log(`Total imported: ${total}`);
}

main();