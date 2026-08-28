import fs from 'fs';
import path from 'path';
import https from 'https';

const basePublic = path.resolve('public/assets/audio/Grimoire_Audio');
const baseVault = path.resolve('wfrp_vault/assets/audio/Grimoire_Audio');

const tracks = JSON.parse(fs.readFileSync('scripts/tta_catalog.json', 'utf8'));

// Find missing
const pubBase = path.join(basePublic, 'Musiques_et_Ambiances');
const allExisting = [];
function walk(d) {
  if (!fs.existsSync(d)) return;
  for (const f of fs.readdirSync(d, { withFileTypes: true })) {
    if (f.isDirectory()) walk(path.join(d, f.name));
    else allExisting.push(f.name);
  }
}
walk(pubBase);

const missing = [];
for (const t of tracks) {
  if (!t.url) continue;
  const num3 = t.id.toString().padStart(3, '0');
  const numRaw = t.id.toString();
  const found = allExisting.some(f => f.startsWith(num3 + '_') || f.startsWith(numRaw + '_'));
  if (!found) {
    missing.push(t);
  }
}

console.log(`Pistes restantes à télécharger : ${missing.length}`);

function download(t) {
  return new Promise((resolve) => {
    const num3 = t.id.toString().padStart(3, '0');
    const cleanTitle = t.cleanTitle || t.title.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `${num3}_${cleanTitle}.mp3`;
    const targetPub = path.join(pubBase, t.category, filename);
    const targetVault = path.join(baseVault, 'Musiques_et_Ambiances', t.category, filename);

    fs.mkdirSync(path.dirname(targetPub), { recursive: true });
    fs.mkdirSync(path.dirname(targetVault), { recursive: true });

    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Referer': 'https://tabletopaudio.com/',
      'Origin': 'https://tabletopaudio.com'
    };

    https.get(t.url, { headers }, (res) => {
      if (res.statusCode !== 200) {
        console.warn(`[FAIL ${res.statusCode}] ${t.title} (${t.url})`);
        return resolve(false);
      }
      const stream = fs.createWriteStream(targetPub);
      res.pipe(stream);
      stream.on('finish', () => {
        stream.close();
        try { fs.copyFileSync(targetPub, targetVault); } catch (e) {}
        console.log(`✓ Téléchargé (${(fs.statSync(targetPub).size / 1024 / 1024).toFixed(1)} MB): ${t.title}`);
        resolve(true);
      });
      stream.on('error', () => resolve(false));
    }).on('error', () => resolve(false));
  });
}

async function run() {
  for (let i = 0; i < missing.length; i += 5) {
    const chunk = missing.slice(i, i + 5);
    await Promise.all(chunk.map(download));
  }
  console.log('✓ Téléchargement du complément terminé !');
}

run();
