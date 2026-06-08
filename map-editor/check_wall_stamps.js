import fs from 'fs';
import path from 'path';

const file = './src/lib/imported_stamps.json';
const metadata = JSON.parse(fs.readFileSync(file, 'utf8'));

const classicWall = metadata.find(m => m.id === 'imported_gmua4v7ktx5iobfgn3aw0trqpvyw');
console.log("Classic Wall metadata:", classicWall);

// Let's list some files in public/assets/stamps/Fantasy_Battlemaps/Dungeons/
const dir = './public/assets/stamps/Fantasy_Battlemaps/Dungeons/';
if (fs.existsSync(dir)) {
  const files = fs.readdirSync(dir);
  console.log(`Found ${files.length} files in Dungeons asset directory`);
  console.log("Sample files:", files.slice(0, 10));
} else {
  console.log("Dungeons directory does not exist!");
}

// Let's check if there are other subcategories under Dungeons or if there's any file mixup.
// Wait, is classic wall file size very small or very large?
const wallPath = './public' + classicWall.file;
if (fs.existsSync(wallPath)) {
  const stats = fs.statSync(wallPath);
  console.log(`Classic Wall file stats: size = ${stats.size} bytes`);
} else {
  console.log("Classic Wall file does not exist at", wallPath);
}
