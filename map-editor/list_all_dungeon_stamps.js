import fs from 'fs';
const file = 'd:/DEV/grimoire/map-editor/src/lib/imported_stamps.json';
const metadata = JSON.parse(fs.readFileSync(file, 'utf8'));

const dungeonStamps = metadata.filter(m => m.category === 'Fantasy Battlemaps' && m.subcategory === 'Dungeons');
console.log(`Found ${dungeonStamps.length} stamps in Dungeons subcategory`);

dungeonStamps.forEach(s => {
  console.log(`ID: ${s.id} | Name: ${s.name} | File: ${s.file}`);
});
