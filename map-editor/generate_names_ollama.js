import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync, spawn } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Configuration
const OLLAMA_URL = 'http://localhost:11434';
const OLLAMA_GENERATE_URL = `${OLLAMA_URL}/api/generate`;
const OLLAMA_MODEL = 'llama3.2-vision';
const STAMPS_DIR = path.join(__dirname, 'public', 'assets', 'stamps');
const OUT_FILE = path.join(__dirname, 'ollama_stamp_names.json');
const MAX_RETRIES = 3;
const CONCURRENCY = 4;  // Ajustez (ex: 2 à 8) selon votre carte graphique
const DELAY_MS = 0;     // Plus de délai entre les requêtes pour accélérer
const SAVE_EVERY = 10;  // Sauvegarder tous les N traitements

const SYSTEM_PROMPT = `You are an image classifier for a fantasy game.
Your task is to identify the main object in the image.
RULES:
1. Translate the object's name to French.
2. Output ONLY the French name.
3. Maximum 3 words.
4. DO NOT write sentences like "This is a" or "C'est un".
Examples of valid outputs: "Tente", "Feu de camp", "Arbre", "Rocher", "Mur".`;

// --- Persistance ---

let nameMap = {};
if (fs.existsSync(OUT_FILE)) {
  try {
    nameMap = JSON.parse(fs.readFileSync(OUT_FILE, 'utf-8'));
    console.log(`▶️  Reprise : ${Object.keys(nameMap).length} noms déjà générés dans ${OUT_FILE}`);
  } catch {
    console.error(`⚠️  Fichier ${OUT_FILE} illisible, on repart de zéro.`);
  }
}

function saveProgress() {
  const tmp = OUT_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(nameMap, null, 2), 'utf-8');
  fs.renameSync(tmp, OUT_FILE); // écriture atomique
}

process.on('SIGINT', () => {
  console.log('\n🛑 Arrêt manuel. Sauvegarde...');
  saveProgress();
  console.log('✅ Sauvegarde terminée.');
  process.exit(0);
});

// --- Utilitaires ---

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function getAllImages(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  for (const file of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, file.name);
    if (file.isDirectory()) {
      getAllImages(fullPath, fileList);
    } else if (/\.(png|jpe?g|webp)$/i.test(file.name)) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

function toBase64(filePath) {
  return fs.readFileSync(filePath).toString('base64');
}

function cleanName(rawText) {
  let cleaned = rawText
    .trim()
    // Supprimer la ponctuation sauf tiret et apostrophe
    .replace(/[.,/#!$%^&*;:{}=`~()"]/g, '')
    .replace(/\s{2,}/g, ' ')
    // Supprimer les phrases parasites fréquentes du modèle
    .replace(/^(Voici une image\s*[:-]?|L'image (montre|représente)\s*[:-]?|Il s'agit (d'un?|de)\s*|C'est (un?|une)\s*|Ceci est (un?|une)\s*|En France\s*|L'objet\s*)/i, '')
    .trim();

  const words = cleaned.split(/\s+/);
  if (words.length > 5) cleaned = words.slice(0, 5).join(' ');

  return cleaned.substring(0, 50).trim();
}

// Utilise un Set en cache pour éviter de le reconstruire à chaque image
function makeNameSet(map) {
  return new Set(Object.values(map).map(n => n.toLowerCase()));
}

function getUniqueName(baseName, existingNamesSet) {
  let name = baseName;
  let counter = 1;
  while (existingNamesSet.has(name.toLowerCase())) {
    counter++;
    name = `${baseName} ${counter}`;
  }
  existingNamesSet.add(name.toLowerCase());
  return name;
}

// --- Ollama ---

async function checkOllama() {
  console.log("🔍 Vérification d'Ollama...");
  let res = await fetch(`${OLLAMA_URL}/api/tags`).catch(() => null);

  if (!res?.ok) {
    console.log("⚠️  Ollama ne tourne pas. Lancement en arrière-plan...");
    const child = spawn('ollama', ['serve'], { detached: true, stdio: 'ignore', windowsHide: true });
    child.unref();

    // Attente active (max 15 s)
    for (let i = 0; i < 5; i++) {
      await sleep(3000);
      res = await fetch(`${OLLAMA_URL}/api/tags`).catch(() => null);
      if (res?.ok) break;
    }
    if (!res?.ok) {
      console.error("❌ Impossible de démarrer Ollama. Lancez-le manuellement.");
      process.exit(1);
    }
    console.log("✅ Ollama démarré.");
  } else {
    console.log("✅ Ollama déjà actif.");
  }

  const data = await res.json();
  const hasModel = data.models?.some(m => m.name === OLLAMA_MODEL || m.name.startsWith(`${OLLAMA_MODEL}:`));
  if (!hasModel) {
    console.log(`📥 Téléchargement du modèle "${OLLAMA_MODEL}"...`);
    try {
      execSync(`ollama pull ${OLLAMA_MODEL}`, { stdio: 'inherit' });
      console.log(`✅ Modèle prêt.`);
    } catch {
      console.error(`❌ Échec. Lancez "ollama pull ${OLLAMA_MODEL}" manuellement.`);
      process.exit(1);
    }
  } else {
    console.log(`✅ Modèle "${OLLAMA_MODEL}" détecté.`);
  }
}

async function restartOllama() {
  console.log("🔄 Redémarrage d'Ollama...");
  try {
    if (process.platform === 'win32') {
      execSync('taskkill /F /IM ollama.exe /T', { stdio: 'ignore' });
      execSync('taskkill /F /IM ollama_llama_server.exe /T', { stdio: 'ignore' });
    } else {
      execSync('pkill -f ollama', { stdio: 'ignore' });
    }
  } catch { /* process déjà mort */ }

  await sleep(3000);
  const child = spawn('ollama', ['serve'], { detached: true, stdio: 'ignore', windowsHide: true });
  child.unref();
  await sleep(5000);
  console.log("✅ Ollama redémarré.");
}

async function queryOllama(imagePath) {
  const base64Image = toBase64(imagePath);
  const response = await fetch(OLLAMA_GENERATE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      prompt: "What is this? Answer with the French name only.",
      system: SYSTEM_PROMPT,
      images: [base64Image],
      stream: false,
      options: { 
        temperature: 0.0
      }
    })
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => 'no text');
    throw new Error(`HTTP ${response.status}: ${errText}`);
  }

  const data = await response.json();
  return data.response;
}

// --- Traitement d'une image (avec retries) ---

async function processImage(imagePath, hash, index, total, existingNamesSet, stats) {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const rawName = await queryOllama(imagePath);
      let finalName = cleanName(rawName);

      if (!finalName) {
        console.warn(`⚠️  [${index}/${total}] Réponse vide pour ${hash}, essai ${attempt}/${MAX_RETRIES}`);
        continue;
      }

      finalName = getUniqueName(finalName, existingNamesSet);
      nameMap[hash] = finalName;
      stats.processed++;

      const rel = path.relative(STAMPS_DIR, imagePath);
      console.log(`[${index}/${total}] 📝 ${rel} → "${finalName}"`);

      if (stats.processed % SAVE_EVERY === 0) saveProgress();
      stats.consecutiveErrors = 0;
      return;

    } catch (err) {
      console.error(`❌ [${index}/${total}] ${hash} (essai ${attempt}/${MAX_RETRIES}): ${err.message}`);
      stats.consecutiveErrors++;

      if (stats.consecutiveErrors >= 5) {
        console.log('⏳ Trop d\'erreurs consécutives — redémarrage d\'Ollama...');
        await restartOllama();
        stats.consecutiveErrors = 0;
      } else if (attempt < MAX_RETRIES) {
        await sleep(2000 * attempt); // backoff exponentiel léger
      }
    }
  }

  // Tous les essais échoués
  console.warn(`⚠️  [${index}/${total}] Échec définitif pour ${hash}.`);
  const fallback = `Inconnu ${hash.substring(0, 4)}`;
  nameMap[hash] = fallback;
  existingNamesSet.add(fallback.toLowerCase());
  saveProgress();
}

// --- Main ---

async function main() {
  await checkOllama();

  console.log('\n🔍 Scan des images...');
  const allImages = getAllImages(STAMPS_DIR);
  console.log(`📦 ${allImages.length} images trouvées.`);

  const pending = allImages.filter(p => !nameMap[path.basename(p, path.extname(p))]);
  console.log(`⏳ ${pending.length} à traiter (${allImages.length - pending.length} déjà faites).\n`);

  if (pending.length === 0) {
    console.log('✅ Rien à faire !');
    return;
  }

  const existingNamesSet = makeNameSet(nameMap);
  const stats = { processed: 0, consecutiveErrors: 0 };
  const total = allImages.length;

  const startTime = Date.now();

  for (let i = 0; i < pending.length; i += CONCURRENCY) {
    const batch = pending.slice(i, i + CONCURRENCY);
    await Promise.all(batch.map(imagePath => {
      const index = allImages.indexOf(imagePath) + 1;
      const hash = path.basename(imagePath, path.extname(imagePath));
      return processImage(imagePath, hash, index, total, existingNamesSet, stats);
    }));
    
    // Calcul de l'ETA
    const elapsedMs = Date.now() - startTime;
    const itemsDone = Math.max(1, i + CONCURRENCY);
    const msPerItem = elapsedMs / itemsDone;
    const itemsLeft = pending.length - itemsDone;
    const etaSeconds = Math.round((itemsLeft * msPerItem) / 1000);
    const etaMinutes = Math.floor(etaSeconds / 60);
    const etaStr = etaMinutes > 0 ? `${etaMinutes} min ${etaSeconds % 60} s` : `${etaSeconds} s`;
    
    process.stdout.write(`\r[Progression: ${Math.round((itemsDone / pending.length) * 100)}%] Temps restant estimé: ${etaStr}      `);
    
    await sleep(DELAY_MS);
  }

  console.log('\n\n✅ Sauvegarde finale en cours...');
  saveProgress();
  console.log(`\n✅ Terminé ! ${stats.processed} nouvelles images traitées.`);
  console.log(`📄 Résultat dans : ${OUT_FILE}`);
}

main().catch(err => {
  console.error("❌ Erreur critique:", err);
  process.exit(1);
});
