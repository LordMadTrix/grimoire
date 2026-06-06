import fs from 'fs';
import https from 'https';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const jsonPath = path.join(__dirname, 'inkarnate_urls.json');
const stampsDir = path.join(__dirname, 'public', 'assets', 'stamps');
const dbPath = path.join(__dirname, 'src', 'lib', 'imported_stamps.json');

// Helper to sanitize directory names for the filesystem (replaces spaces with underscores)
function sanitizeDirName(name) {
  return name
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, '_')
    .trim();
}

// Helper to download a file
function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    if (fs.existsSync(dest)) {
      resolve(true); // already existed
      return;
    }
    const file = fs.createWriteStream(dest);
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        file.close();
        fs.unlink(dest, () => {});
        reject(new Error(`HTTP status ${response.statusCode}`));
        return;
      }
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve(false); // newly downloaded
      });
    }).on('error', (err) => {
      file.close();
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

async function run() {
  if (!fs.existsSync(jsonPath)) {
    console.log(`\n❌ Fichier 'inkarnate_urls.json' introuvable dans ${__dirname}.`);
    console.log("Veuillez y copier le fichier généré depuis la console Chrome.");
    return;
  }

  let urls;
  try {
    urls = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
  } catch (err) {
    console.error(`❌ Échec de lecture du fichier JSON : ${err.message}`);
    return;
  }

  console.log(`📥 Importation de ${urls.length} tampons...`);

  if (!fs.existsSync(stampsDir)) {
    fs.mkdirSync(stampsDir, { recursive: true });
  }

  const db = [];
  let stampCounter = 0; // Synchronous counter for unique stamp naming
  const CONCURRENCY = 25; // 25 downloads in parallel
  const queue = [...urls];
  let activeDownloads = 0;
  let completed = 0;
  let downloadedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;

  console.log(`🚀 Démarrage du téléchargement en parallèle (concurrence max: ${CONCURRENCY})...`);

  return new Promise((resolve) => {
    function next() {
      if (queue.length === 0 && activeDownloads === 0) {
        // Save database
        fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf-8');
        console.log(`\n✅ Importation terminée !`);
        console.log(`- Tampons au total : ${db.length}`);
        console.log(`- Téléchargés : ${downloadedCount}`);
        console.log(`- Déjà présents (passés) : ${skippedCount}`);
        console.log(`- Échecs : ${failedCount}`);

        // Clean up empty directories with spaces (from previous run)
        try {
          const mainDirs = fs.readdirSync(stampsDir);
          let cleanedDirs = 0;
          for (const d of mainDirs) {
            const dPath = path.join(stampsDir, d);
            if (fs.statSync(dPath).isDirectory() && d.includes(' ')) {
              // Read subdirectories
              const subDirs = fs.readdirSync(dPath);
              for (const sub of subDirs) {
                const subPath = path.join(dPath, sub);
                if (fs.statSync(subPath).isDirectory()) {
                  const files = fs.readdirSync(subPath);
                  if (files.length === 0) {
                    fs.rmdirSync(subPath);
                    cleanedDirs++;
                  }
                }
              }
              // If main dir is now empty, remove it too
              if (fs.readdirSync(dPath).length === 0) {
                fs.rmdirSync(dPath);
                cleanedDirs++;
              }
            }
          }
          if (cleanedDirs > 0) {
            console.log(`🧹 Nettoyage : ${cleanedDirs} dossiers contenant des espaces ont été nettoyés.`);
          }
        } catch (cleanupErr) {
          console.error(`Erreur nettoyage dossiers vides : ${cleanupErr.message}`);
        }

        resolve();
        return;
      }

      while (queue.length > 0 && activeDownloads < CONCURRENCY) {
        const item = queue.shift();
        let url, category, subcategory;

        if (typeof item === 'string') {
          url = item;
          category = "Assets Importés";
          subcategory = "Général";
        } else {
          url = item.url;
          category = item.category || "Assets Importés";
          subcategory = item.subcategory || "Général";
        }

        const match = url.match(/\/([a-zA-Z0-9]+)$/);
        if (!match) {
          continue;
        }

        const id = match[1];
        const filename = `${id}.png`;
        
        // New directory with underscores
        const catDir = sanitizeDirName(category);
        const subcatDir = sanitizeDirName(subcategory);
        const dest = path.join(stampsDir, catDir, subcatDir, filename);

        // Old directory with spaces (from the previous run)
        const oldSpaceCatDir = category.replace(/[\\/:*?"<>|]/g, '_').trim();
        const oldSpaceSubcatDir = subcategory.replace(/[\\/:*?"<>|]/g, '_').trim();
        const spaceDest = path.join(stampsDir, oldSpaceCatDir, oldSpaceSubcatDir, filename);

        const oldDest = path.join(stampsDir, filename); // Historic flat destination

        const stampId = `imported_${id}`;
        stampCounter++;
        const stampName = `Tampon Importé ${stampCounter}`;

        // Ensure parent nested folder exists
        const parentDir = path.dirname(dest);
        if (!fs.existsSync(parentDir)) {
          fs.mkdirSync(parentDir, { recursive: true });
        }

        // 1. Move from the folder with spaces if it exists
        if (fs.existsSync(spaceDest) && !fs.existsSync(dest)) {
          try {
            fs.renameSync(spaceDest, dest);
          } catch (err) {
            console.error(`❌ Erreur de déplacement (espaces -> underscores) pour ${filename} : ${err.message}`);
          }
        }

        // 2. Move from the historic flat folder if it exists
        if (fs.existsSync(oldDest) && !fs.existsSync(dest)) {
          try {
            fs.renameSync(oldDest, dest);
          } catch (err) {
            console.error(`❌ Erreur de déplacement (plat -> underscores) pour ${filename} : ${err.message}`);
          }
        }

        activeDownloads++;
        
        downloadFile(url, dest)
          .then((alreadyExisted) => {
            if (alreadyExisted) {
              skippedCount++;
            } else {
              downloadedCount++;
            }
            db.push({
              id: stampId,
              name: stampName,
              file: `/assets/stamps/${catDir}/${subcatDir}/${filename}`.replace(/\\/g, '/'),
              icon: '🎨',
              variants: [stampId],
              category: category,
              subcategory: subcategory
            });
          })
          .catch((err) => {
            failedCount++;
            console.error(`❌ Échec de téléchargement pour ${id} :`, err.message);
          })
          .finally(() => {
            activeDownloads--;
            completed++;
            if (completed % 100 === 0 || completed === urls.length) {
              console.log(`Progression : [${completed}/${urls.length}] (${Math.round((completed / urls.length) * 100)}%) | Téléchargés: ${downloadedCount} | Échecs: ${failedCount}`);
            }
            next();
          });
      }
    }

    next();
  });
}

run();
