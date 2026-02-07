import { SlashCommandBuilder } from 'discord.js';
import db from '../db/sqlite.js';

export const data = new SlashCommandBuilder()
  .setName('kword')
  .setDescription('Manage word bank')
  .addSubcommand(sc => sc.setName('add').setDescription('Add a word')
    .addStringOption(o => o.setName('korean').setDescription('Korean text').setRequired(true))
    .addStringOption(o => o.setName('english').setDescription('English translation').setRequired(true))
    .addIntegerOption(o => o.setName('level').setDescription('Difficulty level (1-5)'))
    .addStringOption(o => o.setName('ipa').setDescription('IPA pronunciation'))
    .addStringOption(o => o.setName('category').setDescription('Category name'))
    .addStringOption(o => o.setName('aliases').setDescription('JSON array of alternate answers')))
  .addSubcommand(sc => sc.setName('list').setDescription('List words'))
  .addSubcommand(sc => sc.setName('import').setDescription('Import JSON word list').addStringOption(o => o.setName('data').setDescription('JSON array of words').setRequired(true)))
  .addSubcommand(sc => sc.setName('export').setDescription('Export JSON word list'));

export default {
  data,
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    if (sub === 'add') {
      const korean = interaction.options.getString('korean');
      const english = interaction.options.getString('english');
      const level = interaction.options.getInteger('level') || 1;
      const ipa = interaction.options.getString('ipa') || '';
      const category = interaction.options.getString('category') || 'general';
      const aliases = interaction.options.getString('aliases') || '[]';
      const ali = Array.isArray(aliases) ? aliases : JSON.parse(aliases || '[]');
      db.prepare('INSERT INTO words (korean, english, romanization, ipa, level, category, aliases) VALUES (?,?,?,?,?,?,?)')
        .run(korean, english, null, ipa, level, category, JSON.stringify(ali));
      await interaction.reply({ content: 'Word added.', ephemeral: true });
    } else if (sub === 'list') {
      const rows = db.prepare('SELECT id,korean,english,level,category FROM words ORDER BY id DESC LIMIT 50').all();
      if (!rows.length) return await interaction.reply({ content: 'No words yet.', ephemeral: true });
      const lines = rows.map(r=>`#${r.id} [L${r.level}] ${r.korean} → ${r.english} (${r.category})`);
      await interaction.reply({ content: lines.join('\n'), ephemeral: true });
    } else if (sub === 'import') {
      const data = interaction.options.getString('data');
      let parsed;
      try { parsed = JSON.parse(data); } catch (e) { return await interaction.reply({ content: `Invalid JSON: ${e.message}`, ephemeral: true }); }
      if (!Array.isArray(parsed)) return await interaction.reply({ content: 'Expecting array of words', ephemeral: true });
      const insert = db.prepare('INSERT INTO words (korean, english, romanization, level, category, aliases) VALUES (?,?,?,?,?,?)');
      const tx = db.transaction((items) => { for (const it of items) insert.run(it.korean, it.english, it.romanization || null, it.level || 1, it.category || 'general', JSON.stringify(it.aliases || [])); });
      tx(parsed);
      await interaction.reply({ content: `Imported ${parsed.length} words.`, ephemeral: true });
    } else if (sub === 'export') {
      const rows = db.prepare('SELECT korean,english,romanization,ipa,level,category,aliases FROM words').all();
      const out = rows.map(r => ({ korean: r.korean, english: r.english, romanization: r.romanization, ipa: r.ipa || '', level: r.level, category: r.category, aliases: JSON.parse(r.aliases || '[]') }));
      await interaction.reply({ content: '```json\n'+JSON.stringify(out, null, 2)+'\n```', ephemeral: true });
    }
  }
};
