import fs from 'fs';

const file = './src/lib/imported_stamps.json';
const metadata = JSON.parse(fs.readFileSync(file, 'utf8'));

const index = metadata.findIndex(m => m.id === 'imported_gjojg6sr808ix89hnqknbttvi8ik');
console.log("Index of gjojg6sr808ix89hnqknbttvi8ik:", index);

if (index !== -1) {
  console.log("Stamps around it in the array:");
  metadata.slice(Math.max(0, index - 5), Math.min(metadata.length, index + 10)).forEach((m, idx) => {
    console.log(`[${index - 5 + idx}] ID: ${m.id} | File: ${m.file} | Subcategory: ${m.subcategory}`);
  });
}
