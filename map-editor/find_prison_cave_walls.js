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

const subcats = ['Prison', 'Prison 2.0', 'Cave', 'Cave 2.0'];
const subcatStamps = metadata.filter(m => m.category === 'Fantasy Battlemaps' && subcats.includes(m.subcategory));

const data = subcatStamps.map(m => {
  const fullPath = './public' + m.file;
  const dims = getPngDimensions(fullPath);
  return {
    id: m.id,
    file: m.file,
    subcat: m.subcategory,
    width: dims ? dims.width : 0,
    height: dims ? dims.height : 0,
    aspect: dims ? dims.width / dims.height : 0
  };
});

data.sort((a, b) => b.aspect - a.aspect);

console.log("TOP 10 WIDEST PRISON/CAVE STAMPS (Horizontal Walls):");
data.slice(0, 10).forEach(d => {
  console.log(`Subcat: ${d.subcat} | ID: ${d.id} | File: ${d.file} | Dims: ${d.width}x${d.height} | Aspect: ${d.aspect.toFixed(2)}`);
});

console.log("\nTOP 10 NARROWEST PRISON/CAVE STAMPS (Vertical Walls):");
data.filter(d => d.aspect > 0).slice(-10).forEach(d => {
  console.log(`Subcat: ${d.subcat} | ID: ${d.id} | File: ${d.file} | Dims: ${d.width}x${d.height} | Aspect: ${d.aspect.toFixed(2)}`);
});
