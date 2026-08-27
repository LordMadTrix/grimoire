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

// Clean old generated .wav files from categories
function cleanWavs(dir) {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir, { withFileTypes: true });
  for (const f of files) {
    const full = path.join(dir, f.name);
    if (f.isDirectory()) {
      cleanWavs(full);
    } else if (f.name.endsWith('.wav')) {
      try { fs.unlinkSync(full); } catch (e) {}
    }
  }
}

cleanWavs(basePublic);
cleanWavs(baseVault);

const studioTracks = [
  // ── 1. AMBIANCES (Studio Master Tracks & Loops) ──────────────────────────
  {
    category: 'Ambiances',
    filename: 'Taverne_Animee.mp3',
    url: 'https://incompetech.com/music/royalty-free/mp3-royaltyfree/The%20Britons.mp3'
  },
  {
    category: 'Ambiances',
    filename: 'Auberge_Celtique.mp3',
    url: 'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Celtic%20Impulse.mp3'
  },
  {
    category: 'Ambiances',
    filename: 'Manoir_et_Chateau.mp3',
    url: 'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Angevin%20B.mp3'
  },
  {
    category: 'Ambiances',
    filename: 'Nuit_de_Bivouac.mp3',
    url: 'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Midnight%20Tale.mp3'
  },
  {
    category: 'Ambiances',
    filename: 'Foret_des_Ombres.mp3',
    url: 'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Wind%20of%20the%20Rainforest.mp3'
  },
  {
    category: 'Ambiances',
    filename: 'Catacombes_Maudites.mp3',
    url: 'https://incompetech.com/music/royalty-free/mp3-royaltyfree/SCP-x2x.mp3'
  },

  // ── 2. MUSIQUES DE COMBAT (Orchestral Masterpieces) ───────────────────────
  {
    category: 'Musiques_Combat',
    filename: 'Bataille_des_Cinq_Armees.mp3',
    url: 'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Five%20Armies.mp3'
  },
  {
    category: 'Musiques_Combat',
    filename: 'Choc_des_Titans.mp3',
    url: 'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Strength%20of%20the%20Titans.mp3'
  },
  {
    category: 'Musiques_Combat',
    filename: 'Combat_des_Geants.mp3',
    url: 'https://incompetech.com/music/royalty-free/mp3-royaltyfree/The%20Ice%20Giants.mp3'
  },
  {
    category: 'Musiques_Combat',
    filename: 'Duel_Heroique.mp3',
    url: 'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Clash%20Defiant.mp3'
  },
  {
    category: 'Musiques_Combat',
    filename: 'Peril_Imminent.mp3',
    url: 'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Volatile%20Reaction.mp3'
  },
  {
    category: 'Musiques_Combat',
    filename: 'Croisade_de_Guerre.mp3',
    url: 'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Crusade.mp3'
  },

  // ── 3. MUSIQUES D'EXPLORATION & MYSTÈRE ─────────────────────────────────
  {
    category: 'Musiques_Exploration',
    filename: 'Academie_des_Sorciers.mp3',
    url: 'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Magistar.mp3'
  },
  {
    category: 'Musiques_Exploration',
    filename: 'Veillee_Nocturne.mp3',
    url: 'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Night%20Vigil.mp3'
  },
  {
    category: 'Musiques_Exploration',
    filename: 'Terres_Sauvages.mp3',
    url: 'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Journey%20To%20Ascend.mp3'
  },
  {
    category: 'Musiques_Exploration',
    filename: 'Contes_de_l_Auberge.mp3',
    url: 'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Teller%20of%20the%20Tales.mp3'
  },
  {
    category: 'Musiques_Exploration',
    filename: 'Mystere_Gothique.mp3',
    url: 'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Southern%20Gothic.mp3'
  },

  // ── 4. BRUITAGES SFX (Real Studio Foley) ──────────────────────────────────
  {
    category: 'Bruitages_SFX',
    filename: 'Lancer_de_Des.mp3',
    url: 'https://soundbible.com/grab.php?id=181&type=mp3'
  },
  {
    category: 'Bruitages_SFX',
    filename: 'Choc_de_Lames.mp3',
    url: 'https://soundbible.com/grab.php?id=1187&type=mp3'
  },
  {
    category: 'Bruitages_SFX',
    filename: 'Sortilege_Magique.mp3',
    url: 'https://soundbible.com/grab.php?id=1460&type=mp3'
  },
  {
    category: 'Bruitages_SFX',
    filename: 'Explosion_de_Feu.mp3',
    url: 'https://soundbible.com/grab.php?id=1073&type=mp3'
  },
  {
    category: 'Bruitages_SFX',
    filename: 'Porte_Donjon_Grincante.mp3',
    url: 'https://soundbible.com/grab.php?id=1137&type=mp3'
  },
  {
    category: 'Bruitages_SFX',
    filename: 'Cri_du_Monstre.mp3',
    url: 'https://soundbible.com/grab.php?id=1807&type=mp3'
  },
  {
    category: 'Bruitages_SFX',
    filename: 'Bourse_Pieces_Or.mp3',
    url: 'https://soundbible.com/grab.php?id=1915&type=mp3'
  }
];

async function downloadFile(url, dest) {
  return new Promise((resolve) => {
    const isHttps = url.startsWith('https');
    const client = isHttps ? https : http;
    const req = client.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307 || res.statusCode === 308) {
        let redirectUrl = res.headers.location;
        if (redirectUrl.startsWith('/')) {
          const u = new URL(url);
          redirectUrl = `${u.protocol}//${u.host}${redirectUrl}`;
        }
        downloadFile(redirectUrl, dest).then(resolve);
        return;
      }
      if (res.statusCode !== 200) {
        console.warn(`[FAIL] ${url} -> HTTP ${res.statusCode}`);
        resolve(false);
        return;
      }
      const fileStream = fs.createWriteStream(dest);
      res.pipe(fileStream);
      fileStream.on('finish', () => {
        fileStream.close();
        console.log(`✓ Téléchargé: ${path.basename(dest)} (${(fs.statSync(dest).size / 1024 / 1024).toFixed(2)} MB)`);
        resolve(true);
      });
      fileStream.on('error', (e) => {
        console.error(`Stream error on ${dest}:`, e);
        resolve(false);
      });
    });
    req.on('error', (err) => {
      console.warn(`Network error on ${url}:`, err.message);
      resolve(false);
    });
  });
}

async function main() {
  console.log('=== TÉLÉCHARGEMENT DU PACK STUDIO HD GRIMOIRE ===\n');
  let successCount = 0;
  for (const item of studioTracks) {
    const pubDest = path.join(basePublic, item.category, item.filename);
    const vaultDest = path.join(baseVault, item.category, item.filename);
    const ok = await downloadFile(item.url, pubDest);
    if (ok && fs.existsSync(pubDest)) {
      fs.copyFileSync(pubDest, vaultDest);
      successCount++;
    }
  }
  console.log(`\n=== TERMINÉ : ${successCount}/${studioTracks.length} PISTES STUDIO TÉLÉCHARGÉES & CLASSÉES ! ===`);
}

main();
