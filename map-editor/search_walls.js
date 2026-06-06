import fs from 'fs';

const file = './src/lib/imported_stamps.json';
const metadata = JSON.parse(fs.readFileSync(file, 'utf8'));

const dungeons = metadata.filter(m => m.category === 'Fantasy Battlemaps' && m.subcategory === 'Dungeons');
console.log(`Dungeons stamps count: ${dungeons.length}`);

dungeons.slice(0, 37).forEach((d, idx) => {
  console.log(`[${idx}] ID: ${d.id} | File: ${d.file}`);
});
