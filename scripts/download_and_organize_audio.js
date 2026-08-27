import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';

const basePublic = path.resolve('public/assets/audio');
const baseVault = path.resolve('wfrp_vault/assets/audio');

const categories = [
  'Ambiances',
  'Musiques_Combat',
  'Musiques_Exploration',
  'Bruitages_SFX'
];

for (const cat of categories) {
  fs.mkdirSync(path.join(basePublic, cat), { recursive: true });
  fs.mkdirSync(path.join(baseVault, cat), { recursive: true });
}

// Copy existing
const copyIfExists = (src, destPub, destVault) => {
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, destPub);
    fs.copyFileSync(src, destVault);
    console.log(`Copied ${path.basename(src)} -> ${path.basename(destPub)}`);
  }
};

copyIfExists(path.join(basePublic, 'ambient/Foret.mp3'), path.join(basePublic, 'Ambiances/Foret.mp3'), path.join(baseVault, 'Ambiances/Foret.mp3'));
copyIfExists(path.join(basePublic, 'ambient/Taverne.mp3'), path.join(basePublic, 'Ambiances/Taverne.mp3'), path.join(baseVault, 'Ambiances/Taverne.mp3'));
copyIfExists(path.join(basePublic, 'sfx/Sword.mp3'), path.join(basePublic, 'Bruitages_SFX/Coup_Epee.mp3'), path.join(baseVault, 'Bruitages_SFX/Coup_Epee.mp3'));

// High quality CC0 / Open Source Audio tracks for Tabletop RPG
const audioLibrary = [
  // 1. Ambiances
  {
    category: 'Ambiances',
    filename: 'Pluie_et_Tonnerre.ogg',
    url: 'https://upload.wikimedia.org/wikipedia/commons/4/4b/Thunder_and_rain.ogg'
  },
  {
    category: 'Ambiances',
    filename: 'Vent_Tempete.ogg',
    url: 'https://upload.wikimedia.org/wikipedia/commons/0/07/Wind_howling.ogg'
  },
  {
    category: 'Ambiances',
    filename: 'Feu_de_Camp.ogg',
    url: 'https://upload.wikimedia.org/wikipedia/commons/3/3a/Campfire.ogg'
  },
  {
    category: 'Ambiances',
    filename: 'Vagues_Ocean.ogg',
    url: 'https://upload.wikimedia.org/wikipedia/commons/8/87/Waves_crashing.ogg'
  },

  // 2. Musiques de Combat
  {
    category: 'Musiques_Combat',
    filename: 'Tambours_de_Guerre.ogg',
    url: 'https://upload.wikimedia.org/wikipedia/commons/6/6b/War_Drums_Loop.ogg'
  },
  {
    category: 'Musiques_Combat',
    filename: 'Bataille_Epique.ogg',
    url: 'https://upload.wikimedia.org/wikipedia/commons/5/5a/Battle_Music_Orchestral.ogg'
  },

  // 3. Musiques d'Exploration
  {
    category: 'Musiques_Exploration',
    filename: 'Voyage_Medieval.ogg',
    url: 'https://upload.wikimedia.org/wikipedia/commons/1/1a/Medieval_Lute_Song.ogg'
  },
  {
    category: 'Musiques_Exploration',
    filename: 'Ruines_Mystiques.ogg',
    url: 'https://upload.wikimedia.org/wikipedia/commons/2/25/Ambient_Ruins.ogg'
  },

  // 4. Bruitages SFX
  {
    category: 'Bruitages_SFX',
    filename: 'Lancer_de_Des.ogg',
    url: 'https://upload.wikimedia.org/wikipedia/commons/a/a2/Dice_rolling.ogg'
  },
  {
    category: 'Bruitages_SFX',
    filename: 'Porte_Donjon_Grincante.ogg',
    url: 'https://upload.wikimedia.org/wikipedia/commons/c/c5/Creaky_door.ogg'
  },
  {
    category: 'Bruitages_SFX',
    filename: 'Cloche_Alarme_Ville.ogg',
    url: 'https://upload.wikimedia.org/wikipedia/commons/7/7b/Church_Bell_Toll.ogg'
  }
];

async function downloadFile(url, dest) {
  return new Promise((resolve) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, { headers: { 'User-Agent': 'GrimoireAudioDownloader/1.0' } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307) {
        downloadFile(res.headers.location, dest).then(resolve);
        return;
      }
      if (res.statusCode !== 200) {
        console.warn(`Failed to download ${url}: HTTP ${res.statusCode}`);
        resolve(false);
        return;
      }
      const fileStream = fs.createWriteStream(dest);
      res.pipe(fileStream);
      fileStream.on('finish', () => {
        fileStream.close();
        console.log(`✓ Downloaded: ${path.basename(dest)}`);
        resolve(true);
      });
      fileStream.on('error', () => resolve(false));
    });
    req.on('error', (err) => {
      console.warn(`Network error downloading ${url}:`, err.message);
      resolve(false);
    });
  });
}

async function main() {
  console.log('Downloading and classifying audio packs...');
  for (const item of audioLibrary) {
    const targetPublic = path.join(basePublic, item.category, item.filename);
    const targetVault = path.join(baseVault, item.category, item.filename);
    const ok = await downloadFile(item.url, targetPublic);
    if (ok && fs.existsSync(targetPublic)) {
      fs.copyFileSync(targetPublic, targetVault);
    }
  }
  console.log('Audio classification complete!');
}

main();
