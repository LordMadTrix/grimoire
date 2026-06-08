/**
 * rename_stamps.js
 * ================
 * Applique le mapping { hash → nom_réel } sur :
 *   1. Les fichiers images dans public/assets/stamps/**
 *   2. Le fichier src/lib/imported_stamps.json (champ "name")
 *
 * Prérequis :
 *   - Avoir exécuté extract_stamp_names.js dans la console Inkarnate
 *   - Avoir sauvegardé le JSON exporté dans : map-editor/stamp_names.json
 *
 * Usage :
 *   node rename_stamps.js
 *   node rename_stamps.js --dry-run   (simulation sans modifier les fichiers)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DRY_RUN = process.argv.includes('--dry-run');
const NAMES_FILE = path.join(__dirname, 'ollama_stamp_names.json');
const STAMPS_JSON = path.join(__dirname, 'src', 'lib', 'imported_stamps.json');
const STAMPS_DIR = path.join(__dirname, 'public', 'assets', 'stamps');

if (DRY_RUN) {
  console.log('🔍 MODE SIMULATION (--dry-run) — aucun fichier ne sera modifié\n');
}

// ── Charger le mapping hash → nom ────────────────────────────────────────────
if (!fs.existsSync(NAMES_FILE)) {
  console.error(`❌ Fichier introuvable : ${NAMES_FILE}`);
  console.error('   Exportez d\'abord les noms depuis la console Inkarnate avec :');
  console.error('   __inkarnateExtractor.export()');
  process.exit(1);
}

const nameMap = JSON.parse(fs.readFileSync(NAMES_FILE, 'utf-8'));
const totalNames = Object.keys(nameMap).length;
console.log(`✅ Mapping chargé : ${totalNames} noms`);

// ── Charger imported_stamps.json ──────────────────────────────────────────────
if (!fs.existsSync(STAMPS_JSON)) {
  console.error(`❌ Fichier introuvable : ${STAMPS_JSON}`);
  process.exit(1);
}

const stamps = JSON.parse(fs.readFileSync(STAMPS_JSON, 'utf-8'));
console.log(`📦 Stamps chargés : ${stamps.length} entrées\n`);

// ── Sanitize : transforme un nom en nom de fichier valide ─────────────────────
function toSafeFilename(name) {
  return name
    .replace(/[\\/:*?"<>|]/g, '_')  // Caractères interdits Windows
    .replace(/\s+/g, '_')            // Espaces → underscores
    .replace(/_+/g, '_')             // Underscores multiples → un seul
    .replace(/^_|_$/g, '')           // Trim underscores
    .substring(0, 100);              // Max 100 caractères
}

// ── Statistiques ──────────────────────────────────────────────────────────────
let renamedFiles = 0;
let renamedJson = 0;
let alreadyGood = 0;
let noMatch = 0;
const notFound = [];

// ── 1. Mettre à jour le champ "name" dans imported_stamps.json ────────────────
console.log('📝 Mise à jour des noms dans imported_stamps.json...');

const updatedStamps = stamps.map(stamp => {
  // Extraire le hash depuis l'id ou le chemin du fichier
  // id = "imported_2hopvd3mdrzcyakojk6wsextckwl"
  const hashFromId = stamp.id?.replace(/^imported_/, '');
  // file = "/assets/stamps/Cat/Sub/2hopvd3mdrzcyakojk6wsextckwl.png"
  const hashFromFile = path.basename(stamp.file || '', '.png');

  const hash = hashFromId || hashFromFile;
  const realName = nameMap[hash];

  if (realName) {
    if (stamp.name !== realName) {
      if (!DRY_RUN) {
        stamp.name = realName;
      }
      renamedJson++;
    } else {
      alreadyGood++;
    }
  } else {
    noMatch++;
    notFound.push(hash);
  }

  return stamp;
});

if (!DRY_RUN) {
  fs.writeFileSync(STAMPS_JSON, JSON.stringify(updatedStamps, null, 2), 'utf-8');
  console.log(`  ✅ ${renamedJson} noms mis à jour dans imported_stamps.json`);
} else {
  console.log(`  [DRY-RUN] ${renamedJson} noms seraient mis à jour`);
}
console.log(`  ⏭️  ${alreadyGood} noms déjà corrects`);
console.log(`  ❓ ${noMatch} stamps sans correspondance\n`);

// ── 2. Renommer les fichiers images ───────────────────────────────────────────
console.log('🖼️  Renommage des fichiers images...');

function scanAndRename(dir) {
  if (!fs.existsSync(dir)) return;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      scanAndRename(fullPath);
      continue;
    }

    if (!entry.name.endsWith('.png') && !entry.name.endsWith('.webp') && !entry.name.endsWith('.jpg')) {
      continue;
    }

    const ext = path.extname(entry.name);
    const hash = path.basename(entry.name, ext);
    const realName = nameMap[hash];

    if (!realName) continue;

    const safeNewName = toSafeFilename(realName) + ext;
    if (safeNewName === entry.name) {
      // Déjà renommé
      continue;
    }

    const newPath = path.join(dir, safeNewName);

    // Gérer les conflits de noms (si le fichier existe déjà)
    if (fs.existsSync(newPath)) {
      // Ajouter le hash court pour différencier
      const shortHash = hash.substring(0, 8);
      const conflictName = toSafeFilename(realName) + `_${shortHash}` + ext;
      const conflictPath = path.join(dir, conflictName);
      if (!DRY_RUN) {
        fs.renameSync(fullPath, conflictPath);
      }
      console.log(`  ⚠️  CONFLIT: ${entry.name} → ${conflictName}`);
      renamedFiles++;
    } else {
      if (!DRY_RUN) {
        fs.renameSync(fullPath, newPath);
      }
      console.log(`  ✏️  ${entry.name} → ${safeNewName}`);
      renamedFiles++;
    }
  }
}

scanAndRename(STAMPS_DIR);

if (!DRY_RUN) {
  console.log(`\n✅ ${renamedFiles} fichiers renommés`);
} else {
  console.log(`\n[DRY-RUN] ${renamedFiles} fichiers seraient renommés`);
}

// ── 3. Mettre à jour les chemins "file" dans imported_stamps.json ─────────────
// (Si les fichiers ont été renommés, les chemins doivent aussi être mis à jour)
if (renamedFiles > 0 && !DRY_RUN) {
  console.log('\n🔗 Mise à jour des chemins de fichiers dans imported_stamps.json...');

  const freshStamps = JSON.parse(fs.readFileSync(STAMPS_JSON, 'utf-8'));
  let pathsUpdated = 0;

  const updatedPaths = freshStamps.map(stamp => {
    const hashFromId = stamp.id?.replace(/^imported_/, '');
    const realName = nameMap[hashFromId];
    if (!realName) return stamp;

    const ext = path.extname(stamp.file || '.png') || '.png';
    const safeNewName = toSafeFilename(realName) + ext;
    const dir = path.dirname(stamp.file);
    const newFilePath = `${dir}/${safeNewName}`;

    if (newFilePath !== stamp.file) {
      stamp.file = newFilePath;
      pathsUpdated++;
    }

    return stamp;
  });

  fs.writeFileSync(STAMPS_JSON, JSON.stringify(updatedPaths, null, 2), 'utf-8');
  console.log(`  ✅ ${pathsUpdated} chemins mis à jour`);
}

// ── Rapport final ─────────────────────────────────────────────────────────────
console.log('\n══════════════════════════════════════');
console.log('📊 RAPPORT FINAL');
console.log('══════════════════════════════════════');
console.log(`  Mapping chargé       : ${totalNames} noms`);
console.log(`  JSON mis à jour      : ${renamedJson}`);
console.log(`  Fichiers renommés    : ${renamedFiles}`);
console.log(`  Déjà corrects        : ${alreadyGood}`);
console.log(`  Sans correspondance  : ${noMatch}`);

if (notFound.length > 0 && notFound.length <= 20) {
  console.log('\n⚠️  Hashes sans nom (premiers 20):');
  notFound.slice(0, 20).forEach(h => console.log(`    - ${h}`));
}

if (DRY_RUN) {
  console.log('\n💡 Relancez sans --dry-run pour appliquer les changements.');
}
