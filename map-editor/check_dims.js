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

const file = './src/lib/imported_stamps.json';
const metadata = JSON.parse(fs.readFileSync(file, 'utf8'));

const startIndex = 6135;
const endIndex = 6152;

for (let i = startIndex; i <= endIndex; i++) {
  const m = metadata[i];
  if (m) {
    const fullPath = './public' + m.file;
    const dims = getPngDimensions(fullPath);
    console.log(`[${i}] ID: ${m.id} | File: ${m.file} | Dims: ${dims ? `${dims.width}x${dims.height}` : 'unknown'}`);
  }
}
