import fs from 'fs';

const urls = JSON.parse(fs.readFileSync('d:\\DEV\\grimoire\\map-editor\\inkarnate_urls.json', 'utf-8'));
const categories = new Set();
const subcategories = new Set();

urls.forEach(item => {
  if (item.category) categories.add(item.category);
  if (item.subcategory) subcategories.add(item.subcategory);
});

console.log("Unique categories found in JSON:", Array.from(categories));
console.log("Number of unique subcategories:", subcategories.size);
console.log("Sample subcategories:", Array.from(subcategories).slice(0, 10));
