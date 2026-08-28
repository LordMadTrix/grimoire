import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';

const CONCURRENCY = 6;
const MAX_RETRIES = 3;

const basePublic = path.resolve('public/assets/audio/Grimoire_Audio');
const baseVault = path.resolve('wfrp_vault/assets/audio/Grimoire_Audio');

// Load catalogs
const tracksCatalog = JSON.parse(fs.readFileSync('scripts/tta_catalog.json', 'utf8'));
const soundpadCatalog = JSON.parse(fs.readFileSync('scripts/tta_soundpad_catalog.json', 'utf8'));

// Build complete download queue
const queue = [];

// 1. Long 10-min tracks
for (const track of tracksCatalog) {
  if (!track.url) continue;
  const filename = `${track.id.toString().padStart(3, '0')}_${track.cleanTitle}.mp3`;
  const relPath = path.join('Musiques_et_Ambiances', track.category, filename);
  queue.push({
    type: 'music',
    id: track.id,
    title: track.title,
    category: track.category,
    tags: track.tags,
    flavor: track.flavor,
    url: track.url,
    relPath,
    filename,
    isLoop: true
  });
}

// 2. SoundPad SFX & loops
for (const sfx of soundpadCatalog) {
  if (!sfx.url) continue;
  const ext = sfx.filename.split('.').pop() || 'ogg';
  const filename = `${sfx.cleanName}.${ext}`;
  const relPath = path.join('Bruitages_SFX', sfx.category, filename);
  queue.push({
    type: 'sfx',
    soundpad: sfx.soundpad,
    category: sfx.category,
    title: sfx.cleanName.replace(/_/g, ' '),
    url: sfx.url,
    relPath,
    filename,
    isLoop: sfx.isLoop
  });
}

console.log(`\n======================================================`);
console.log(`  TABLETOP AUDIO - TÉLÉCHARGEMENT INTÉGRAL`);
console.log(`  Pistes musicales : ${tracksCatalog.length}`);
console.log(`  Bruitages SFX    : ${soundpadCatalog.length}`);
console.log(`  Total fichiers   : ${queue.length}`);
console.log(`  Parallélisme     : ${CONCURRENCY} téléchargements simultanés`);
console.log(`======================================================\n`);

// Ensure directories exist
for (const item of queue) {
  const pubDir = path.dirname(path.join(basePublic, item.relPath));
  const vaultDir = path.dirname(path.join(baseVault, item.relPath));
  fs.mkdirSync(pubDir, { recursive: true });
  fs.mkdirSync(vaultDir, { recursive: true });
}

let completedCount = 0;
let skippedCount = 0;
let failedCount = 0;
let totalBytes = 0;
const startTime = Date.now();

function formatBytes(b) {
  if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' KB';
  if (b < 1024 * 1024 * 1024) return (b / (1024 * 1024)).toFixed(1) + ' MB';
  return (b / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
}

function formatDuration(sec) {
  if (!isFinite(sec) || sec < 0) return '--:--';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}m ${s.toString().padStart(2, '0')}s`;
}

function downloadFile(item, retry = 0) {
  return new Promise((resolve) => {
    const pubDest = path.join(basePublic, item.relPath);
    const vaultDest = path.join(baseVault, item.relPath);
    const tempDest = pubDest + '.part';

    // Check if already downloaded and valid
    if (fs.existsSync(pubDest)) {
      const stat = fs.statSync(pubDest);
      if (stat.size > 2048) { // bigger than 2KB
        if (!fs.existsSync(vaultDest) || fs.statSync(vaultDest).size !== stat.size) {
          try { fs.copyFileSync(pubDest, vaultDest); } catch (e) {}
        }
        completedCount++;
        skippedCount++;
        totalBytes += stat.size;
        return resolve(true);
      }
    }

    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Referer': 'https://tabletopaudio.com/',
      'Origin': 'https://tabletopaudio.com',
      'Accept': '*/*'
    };

    const req = https.get(item.url, { headers, timeout: 30000 }, (res) => {
      // Handle redirect
      if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location) {
        let redirectUrl = res.headers.location;
        if (redirectUrl.startsWith('/')) {
          const u = new URL(item.url);
          redirectUrl = `${u.protocol}//${u.host}${redirectUrl}`;
        }
        item.url = redirectUrl;
        return downloadFile(item, retry).then(resolve);
      }

      if (res.statusCode !== 200 && res.statusCode !== 206) {
        if (retry < MAX_RETRIES) {
          return setTimeout(() => downloadFile(item, retry + 1).then(resolve), 1500 * (retry + 1));
        }
        failedCount++;
        console.warn(`\n[FAIL HTTP ${res.statusCode}] ${item.url}`);
        return resolve(false);
      }

      const fileStream = fs.createWriteStream(tempDest);
      let receivedBytes = 0;

      res.on('data', (chunk) => {
        receivedBytes += chunk.length;
      });

      res.pipe(fileStream);

      fileStream.on('finish', () => {
        fileStream.close(() => {
          if (receivedBytes < 1024) {
            // Suspiciously small
            try { fs.unlinkSync(tempDest); } catch (e) {}
            if (retry < MAX_RETRIES) {
              return setTimeout(() => downloadFile(item, retry + 1).then(resolve), 1500 * (retry + 1));
            }
            failedCount++;
            return resolve(false);
          }

          try {
            if (fs.existsSync(pubDest)) fs.unlinkSync(pubDest);
            fs.renameSync(tempDest, pubDest);
            fs.copyFileSync(pubDest, vaultDest);
          } catch (err) {
            console.error('File rename error:', err);
          }

          completedCount++;
          totalBytes += receivedBytes;
          
          const elapsedSec = (Date.now() - startTime) / 1000;
          const speed = totalBytes / elapsedSec; // B/s
          const pct = ((completedCount / queue.length) * 100).toFixed(1);
          const remainingFiles = queue.length - completedCount;
          const avgFileBytes = totalBytes / completedCount;
          const etaSec = speed > 0 ? (remainingFiles * avgFileBytes) / speed : 0;

          process.stdout.write(
            `\r[${completedCount}/${queue.length}] ${pct}% | ${formatBytes(totalBytes)} | ${(speed / 1024 / 1024).toFixed(1)} MB/s | ETA: ${formatDuration(etaSec)} | ✓ ${item.filename.slice(0, 30)}`
          );

          resolve(true);
        });
      });

      fileStream.on('error', (err) => {
        try { fs.unlinkSync(tempDest); } catch (e) {}
        if (retry < MAX_RETRIES) {
          return setTimeout(() => downloadFile(item, retry + 1).then(resolve), 1500 * (retry + 1));
        }
        failedCount++;
        resolve(false);
      });
    });

    req.on('timeout', () => {
      req.destroy();
      if (retry < MAX_RETRIES) {
        return setTimeout(() => downloadFile(item, retry + 1).then(resolve), 2000 * (retry + 1));
      }
      failedCount++;
      resolve(false);
    });

    req.on('error', (err) => {
      try { if (fs.existsSync(tempDest)) fs.unlinkSync(tempDest); } catch (e) {}
      if (retry < MAX_RETRIES) {
        return setTimeout(() => downloadFile(item, retry + 1).then(resolve), 2000 * (retry + 1));
      }
      failedCount++;
      resolve(false);
    });
  });
}

// Worker Queue Pool
async function runPool() {
  let currentIndex = 0;

  async function worker(workerId) {
    while (currentIndex < queue.length) {
      const idx = currentIndex++;
      const item = queue[idx];
      await downloadFile(item);
    }
  }

  const workers = [];
  for (let i = 0; i < CONCURRENCY; i++) {
    workers.push(worker(i));
  }

  await Promise.all(workers);

  console.log(`\n\n======================================================`);
  console.log(`  TÉLÉCHARGEMENT TERMINÉ !`);
  console.log(`  Fichiers traités     : ${completedCount}/${queue.length}`);
  console.log(`  Fichiers existants   : ${skippedCount}`);
  console.log(`  Volume total         : ${formatBytes(totalBytes)}`);
  console.log(`  Échecs               : ${failedCount}`);
  console.log(`  Temps écoulé         : ${formatDuration((Date.now() - startTime) / 1000)}`);
  console.log(`======================================================\n`);

  // Write rich manifest
  const manifest = {
    generatedAt: new Date().toISOString(),
    totalTracks: tracksCatalog.length,
    totalSfx: soundpadCatalog.length,
    categories: {
      musiques_et_ambiances: [
        'Musiques_Combat',
        'Horreur_et_Donjons',
        'Villes_et_Tavernes',
        'Nature_et_Elements',
        'SciFi_et_Futuriste',
        'Musiques_Exploration',
        'Ambiances'
      ],
      bruitages_sfx: [
        'Bruitages_Combat',
        'Bruitages_Donjon',
        'Bruitages_Monstres',
        'Bruitages_Taverne',
        'Bruitages_Nature',
        'Bruitages_Gothique',
        'Bruitages_Maritime',
        'Bruitages_SciFi',
        'Bruitages_Steampunk',
        'Bruitages_PostApo',
        'Bruitages_Western',
        'Bruitages_Moderne',
        'Bruitages_Wuxia',
        'Bruitages_Historique',
        'Bruitages_Generaux'
      ]
    },
    items: queue.map(q => ({
      type: q.type,
      id: q.id,
      title: q.title,
      category: q.category,
      soundpad: q.soundpad,
      tags: q.tags,
      flavor: q.flavor,
      isLoop: q.isLoop,
      path: q.relPath.replace(/\\/g, '/'),
      vaultPath: `assets/audio/Grimoire_Audio/${q.relPath.replace(/\\/g, '/')}`,
      publicPath: `/assets/audio/Grimoire_Audio/${q.relPath.replace(/\\/g, '/')}`
    }))
  };

  fs.writeFileSync(path.join(basePublic, 'audio_manifest.json'), JSON.stringify(manifest, null, 2));
  fs.writeFileSync(path.join(baseVault, 'audio_manifest.json'), JSON.stringify(manifest, null, 2));
  console.log('✓ Manifeste audio généré avec succès dans public/ et wfrp_vault/ !');
}

runPool();
