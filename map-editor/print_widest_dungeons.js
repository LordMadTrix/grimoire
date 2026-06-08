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
      aspect: dims.width / dims.height
    });
  }
});

fileData.sort((a, b) => b.aspect - a.aspect);

// Print the top 20 widest stamps in Dungeons
console.log("Top 20 widest Dungeons stamps:");
fileData.slice(0, 20).forEach(d => {
  console.log(`File: ${d.file} | Resolution: ${d.width}x${d.height} | Aspect: ${d.aspect.toFixed(2)}`);
});
