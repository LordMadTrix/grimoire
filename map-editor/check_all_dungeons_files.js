import fs from 'fs';
import path from 'path';

const dir = './public/assets/stamps/Fantasy_Battlemaps/Dungeons/';
if (!fs.existsSync(dir)) {
  console.log("Directory does not exist!");
  process.exit(1);
}

const files = fs.readdirSync(dir).filter(f => f.endsWith('.png'));
console.log(`Found ${files.length} png files in Dungeons`);

const sizes = {};
files.forEach(f => {
  const fullPath = path.join(dir, f);
  const size = fs.statSync(fullPath).size;
  sizes[size] = (sizes[size] || 0) + 1;
});

console.log("File sizes distribution in Dungeons:");
console.log(JSON.stringify(sizes, null, 2));

// Let's print details of some files
const samples = files.slice(0, 10);
samples.forEach(f => {
  const fullPath = path.join(dir, f);
  const stats = fs.statSync(fullPath);
  console.log(`${f}: size = ${stats.size} bytes`);
});
