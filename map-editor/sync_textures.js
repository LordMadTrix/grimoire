import fs from 'fs';
import https from 'https';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const jsonPath = path.join(__dirname, 'inkarnate_textures.json');
const texturesDir = path.join(__dirname, 'public', 'assets', 'textures');
const dbPath = path.join(__dirname, 'src', 'lib', 'imported_textures.json');

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
    console.log(`\n❌ Fichier 'inkarnate_textures.json' introuvable dans ${__dirname}.`);
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

  console.log(`📥 Importation de ${urls.length} textures...`);

  if (!fs.existsSync(texturesDir)) {
    fs.mkdirSync(texturesDir, { recursive: true });
  }

  const db = [];
  let textureCounter = 0;
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
        console.log(`- Textures au total : ${db.length}`);
        console.log(`- Téléchargées : ${downloadedCount}`);
        console.log(`- Déjà présentes (passées) : ${skippedCount}`);
        console.log(`- Échecs : ${failedCount}`);
        resolve();
        return;
      }

      while (queue.length > 0 && activeDownloads < CONCURRENCY) {
        const item = queue.shift();
        let url, category, subcategory;

        if (typeof item === 'string') {
          url = item;
          category = "Textures Importées";
          subcategory = "Général";
        } else {
          url = item.url;
          category = item.category || "Textures Importées";
          subcategory = item.subcategory || "Général";
        }

        const match = url.match(/\/([a-zA-Z0-9]+)$/);
        if (!match) {
          continue;
        }

        const id = match[1];
        const filename = `${id}.png`;
        
        const catDir = sanitizeDirName(category);
        const subcatDir = sanitizeDirName(subcategory);
        const dest = path.join(texturesDir, catDir, subcatDir, filename);

        const textureId = `imported_${id}`;
        textureCounter++;
        const textureName = `Texture Importée ${textureCounter}`;

        // Ensure parent nested folder exists
        const parentDir = path.dirname(dest);
        if (!fs.existsSync(parentDir)) {
          fs.mkdirSync(parentDir, { recursive: true });
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
              id: textureId,
              name: textureName,
              file: `${catDir}/${subcatDir}/${filename}`.replace(/\\/g, '/'),
              color: '#888888',
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
