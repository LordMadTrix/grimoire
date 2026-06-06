import fs from 'fs';
import path from 'path';

function getPngDimensions(filePath) {
  try {
    const fd = fs.openSync(filePath, 'r');
    const buffer = Buffer.alloc(8);
    fs.readSync(fd, buffer, 0, 8, 16);
    fs.closeSync(fd);
    const width = buffer.readInt32BE(0);
    const height = buffer.readInt32BE(4);
    return { width, height };
  } catch (err) {
    return null;
  }
}

const dir = './public/assets/stamps/Fantasy_Battlemaps/Dungeons/';
if (!fs.existsSync(dir)) {
  console.log("Directory does not exist!");
  process.exit(1);
}

const files = fs.readdirSync(dir).filter(f => f.endsWith('.png'));
const fileData = [];

files.forEach(f => {
  const fullPath = path.join(dir, f);
  const dims = getPngDimensions(fullPath);
  if (dims) {
    fileData.push({
      file: f,
      width: dims.width,
      height: dims.height,
      aspect: dims.width / dims.height,
      size: fs.statSync(fullPath).size
    });
  }
});

// Sort by aspect ratio descending
fileData.sort((a, b) => b.aspect - a.aspect);

console.log("Dungeons stamps sorted by aspect ratio (wider first):");
fileData.forEach((d, idx) => {
  console.log(`[${idx}] File: ${d.file} | Resolution: ${d.width}x${d.height} | Aspect: ${d.aspect.toFixed(2)} | Size: ${d.size} bytes`);
});
