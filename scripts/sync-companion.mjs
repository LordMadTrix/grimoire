import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const srcDir = path.join(rootDir, 'src-tauri', 'src', 'commands');
const targetDir = path.join(rootDir, 'player-companion', 'www');

if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

const mappings = [
  { src: 'player_app.html', dest: 'index.html' },
  { src: 'manifest.webmanifest', dest: 'manifest.webmanifest' },
  { src: 'sw.js', dest: 'sw.js' },
  { src: 'icon.svg', dest: 'icon.svg' },
  { src: 'icon-192.png', dest: 'icon-192.png' },
  { src: 'icon-512.png', dest: 'icon-512.png' },
];

for (const m of mappings) {
  const from = path.join(srcDir, m.src);
  const to = path.join(targetDir, m.dest);
  if (fs.existsSync(from)) {
    fs.copyFileSync(from, to);
    console.log(`Copied ${m.src} -> ${m.dest}`);
  } else {
    console.warn(`Source not found: ${from}`);
  }
}

// Version embarquée dans l'APK (détection des mises à jour côté téléphone)
const { version } = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf-8'));
const indexPath = path.join(targetDir, 'index.html');
fs.writeFileSync(indexPath, fs.readFileSync(indexPath, 'utf-8').replaceAll('__GRIMOIRE_VERSION__', version));
console.log(`Embedded APK version: ${version}`);

console.log('Player companion assets synced successfully.');

