import fs from 'fs';

const wallFile = './public/assets/stamps/Fantasy_Battlemaps/Dungeons/gmua4v7ktx5iobfgn3aw0trqpvyw.png';
const campfireFile = './public/assets/stamps/Fantasy_Battlemaps/Camp/MqWqQziNJ3cHAnsf9qo93J.png';

const wallStats = fs.statSync(wallFile);
const campStats = fs.statSync(campfireFile);

console.log(`Wall file size: ${wallStats.size} bytes`);
console.log(`Campfire file size: ${campStats.size} bytes`);

// Compare content bytes
const wallBuf = fs.readFileSync(wallFile);
const campBuf = fs.readFileSync(campfireFile);

if (wallBuf.equals(campBuf)) {
  console.log("CRITICAL ERROR: The wall file content is identical to the campfire file content!");
} else {
  console.log("The wall file content is different from the campfire file content.");
}
