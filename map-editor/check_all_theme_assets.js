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

const ids = [
  'imported_gmua4v7ktx5iobfgn3aw0trqpvyw', // classic wall
  'imported_drno28tawfeedwm42jep9t6w5p58', // prison wall
  'imported_wv2bfinnybnnlyf1v5ebatubdrlm'  // cave wall
];

ids.forEach(id => {
  const found = metadata.find(m => m.id === id);
  if (found) {
    const fullPath = './public' + found.file;
    const dims = getPngDimensions(fullPath);
    console.log(`ID: ${id} | File: ${found.file} | Resolution: ${dims ? `${dims.width}x${dims.height}` : 'unknown'}`);
  } else {
    console.log(`ID: ${id} NOT FOUND`);
  }
});
