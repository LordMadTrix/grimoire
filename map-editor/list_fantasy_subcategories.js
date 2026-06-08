import fs from 'fs';
const file = 'd:/DEV/grimoire/map-editor/src/lib/imported_stamps.json';
const metadata = JSON.parse(fs.readFileSync(file, 'utf8'));

const subcategories = {};
metadata.forEach(m => {
  if (m.category === 'Fantasy Battlemaps') {
    if (!subcategories[m.subcategory]) subcategories[m.subcategory] = 0;
    subcategories[m.subcategory]++;
  }
});

console.log("Subcategories under 'Fantasy Battlemaps':");
console.log(JSON.stringify(subcategories, null, 2));
