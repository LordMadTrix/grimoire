import fs from 'fs';

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

const f = 'public/assets/stamps/Fantasy_Battlemaps/Dungeons/gmua4v7ktx5iobfgn3aw0trqpvyw.png';
const dims = getPngDimensions(f);
console.log(`${f}: ${dims ? `${dims.width}x${dims.height}` : 'failed to read'}`);
