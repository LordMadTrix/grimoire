import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const stampsDir = path.join(__dirname, 'public', 'assets', 'stamps');

function getPNGDimensions(filePath) {
  const buffer = fs.readFileSync(filePath);
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  return { width, height };
}

try {
  const files = fs.readdirSync(stampsDir).filter(f => f.endsWith('.png'));
  console.log(`Checking ${files.length} images...`);
  files.slice(0, 10).forEach(file => {
    const testFile = path.join(stampsDir, file);
    const dimensions = getPNGDimensions(testFile);
    const stats = fs.statSync(testFile);
    console.log(`- File: ${file} | Resolution: ${dimensions.width}x${dimensions.height} px | Size: ${(stats.size / 1024).toFixed(1)} KB`);
  });
} catch (err) {
  console.error("Error reading image:", err.message);
}
