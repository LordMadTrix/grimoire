import fs from 'fs';

const rawData = fs.readFileSync('d:\\DEV\\grimoire\\map-editor\\extracted_raw_user_1.txt', 'utf-8');

// Find all matches of anything containing 'catalog', 'modal', 'grid', 'stamp', 'list', 'sidebar'
const keywords = ['catalog', 'modal', 'grid', 'stamp', 'list', 'sidebar', 'ReactModal'];
const results = {};

keywords.forEach(keyword => {
  const regex = new RegExp(`[^\\s"'\`\\(\\)\\\\]*${keyword}[^\\s"'\`\\(\\)\\\\]*`, 'gi');
  const matches = rawData.match(regex) || [];
  results[keyword] = [...new Set(matches)];
});

console.log(JSON.stringify(results, null, 2));
