import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths
const ROOT_DIR = __dirname;
const MAP_EDITOR_DIR = path.join(ROOT_DIR, 'map-editor');
const PUBLIC_MAPS_DIR = path.join(ROOT_DIR, 'public', 'maps');
const PUBLIC_TOKENS_DIR = path.join(ROOT_DIR, 'public', 'tokens');
const PUBLIC_LIBRARY_JS = path.join(ROOT_DIR, 'public', 'library.js');
const PUBLIC_LIBRARY_CATALOG = path.join(ROOT_DIR, 'public', 'library-catalog.json');

const EDITOR_TEXTURES_DIR = path.join(MAP_EDITOR_DIR, 'public', 'assets', 'textures');
const EDITOR_STAMPS_DIR = path.join(MAP_EDITOR_DIR, 'public', 'assets', 'stamps');
const EDITOR_IMPORTED_TEXTURES_JSON = path.join(MAP_EDITOR_DIR, 'src', 'lib', 'imported_textures.json');
const EDITOR_IMPORTED_STAMPS_JSON = path.join(MAP_EDITOR_DIR, 'src', 'lib', 'imported_stamps.json');

// Supported extensions
const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.svg']);

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// Format name from filename or folder
function formatReadableName(filename) {
  const base = path.parse(filename).name;
  return base
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// 1. Rebuild Grimoire Maps Catalog
export function rebuildMapsCatalog() {
  ensureDir(PUBLIC_MAPS_DIR);
  const files = fs.readdirSync(PUBLIC_MAPS_DIR).filter(f => IMAGE_EXTS.has(path.extname(f).toLowerCase()));
  
  const mapsList = files.map(file => {
    const id = path.parse(file).name;
    return {
      id,
      name: formatReadableName(file),
      path: `./maps/${file}`
    };
  });

  // Write library.js
  const jsContent = `const GRIMOIRE_MAPS = ${JSON.stringify(mapsList, null, 2)};\n`;
  fs.writeFileSync(PUBLIC_LIBRARY_JS, jsContent, 'utf-8');

  // Update library-catalog.json maps field
  if (fs.existsSync(PUBLIC_LIBRARY_CATALOG)) {
    try {
      const catalog = JSON.parse(fs.readFileSync(PUBLIC_LIBRARY_CATALOG, 'utf-8'));
      catalog.maps = files.map(file => ({
        name: formatReadableName(file),
        url: `/maps/${file}`,
        desc: `Carte locale ${formatReadableName(file)}`
      }));
      fs.writeFileSync(PUBLIC_LIBRARY_CATALOG, JSON.stringify(catalog, null, 2), 'utf-8');
    } catch (e) {
      console.warn('⚠️ Erreur mise à jour library-catalog.json:', e.message);
    }
  }

  console.log(`🗺️  Grimoire : ${mapsList.length} carte(s) indexée(s) dans la bibliothèque.`);
  return mapsList.length;
}

// 2. Rebuild Map Editor Textures Catalog
export function rebuildTexturesCatalog() {
  ensureDir(EDITOR_TEXTURES_DIR);
  const textures = [];

  function scanDir(currentPath, cat = '', subcat = '') {
    const entries = fs.readdirSync(currentPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        if (!cat) {
          scanDir(fullPath, entry.name, '');
        } else if (!subcat) {
          scanDir(fullPath, cat, entry.name);
        } else {
          scanDir(fullPath, cat, `${subcat}/${entry.name}`);
        }
      } else if (IMAGE_EXTS.has(path.extname(entry.name).toLowerCase())) {
        const relPath = path.relative(EDITOR_TEXTURES_DIR, fullPath).replace(/\\/g, '/');
        // Root files (like grass.png, rock.png)
        const category = cat ? cat.replace(/_/g, ' ') : 'Standard';
        const subcategory = subcat ? subcat.replace(/_/g, ' ') : 'Général';
        const id = `tex_${path.parse(entry.name).name.replace(/[^a-zA-Z0-9_]/g, '_')}`;

        textures.push({
          id: id,
          name: formatReadableName(entry.name),
          file: relPath,
          color: '#888888',
          category: category,
          subcategory: subcategory
        });
      }
    }
  }

  scanDir(EDITOR_TEXTURES_DIR);
  fs.writeFileSync(EDITOR_IMPORTED_TEXTURES_JSON, JSON.stringify(textures, null, 2), 'utf-8');
  console.log(`🎨 Map Editor : ${textures.length} texture(s) indexée(s) dans imported_textures.json.`);
  return textures.length;
}

// 3. Rebuild Map Editor Stamps Catalog
export function rebuildStampsCatalog() {
  ensureDir(EDITOR_STAMPS_DIR);
  const stamps = [];

  function scanDir(currentPath, cat = '', subcat = '') {
    const entries = fs.readdirSync(currentPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        if (!cat) {
          scanDir(fullPath, entry.name, '');
        } else if (!subcat) {
          scanDir(fullPath, cat, entry.name);
        } else {
          scanDir(fullPath, cat, `${subcat}/${entry.name}`);
        }
      } else if (IMAGE_EXTS.has(path.extname(entry.name).toLowerCase())) {
        const relPath = path.relative(EDITOR_STAMPS_DIR, fullPath).replace(/\\/g, '/');
        const category = cat ? cat.replace(/_/g, ' ') : 'Divers';
        const subcategory = subcat ? subcat.replace(/_/g, ' ') : 'Général';
        const id = `stamp_${path.parse(entry.name).name.replace(/[^a-zA-Z0-9_]/g, '_')}`;

        stamps.push({
          id: id,
          name: formatReadableName(entry.name),
          file: `/assets/stamps/${relPath}`,
          category: category,
          subcategory: subcategory
        });
      }
    }
  }

  scanDir(EDITOR_STAMPS_DIR);
  fs.writeFileSync(EDITOR_IMPORTED_STAMPS_JSON, JSON.stringify(stamps, null, 2), 'utf-8');
  console.log(`🏰 Map Editor : ${stamps.length} tampon(s)/stamp(s) indexé(s) dans imported_stamps.json.`);
  return stamps.length;
}

// 4. Import / Copy from a source directory (e.g. Google Drive folder)
export function importFromSourceDir(sourcePath) {
  if (!fs.existsSync(sourcePath)) {
    console.error(`❌ Le dossier source spécifié n'existe pas : ${sourcePath}`);
    return;
  }

  console.log(`\n🔄 Analyse et importation depuis : ${sourcePath}`);

  function copyRecursive(src, targetBase) {
    ensureDir(targetBase);
    const entries = fs.readdirSync(src, { withFileTypes: true });
    for (const entry of entries) {
      const s = path.join(src, entry.name);
      const t = path.join(targetBase, entry.name);
      if (entry.isDirectory()) {
        copyRecursive(s, t);
      } else if (IMAGE_EXTS.has(path.extname(entry.name).toLowerCase())) {
        fs.copyFileSync(s, t);
      }
    }
  }

  // Detect subdirectories in source
  const entries = fs.readdirSync(sourcePath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(sourcePath, entry.name);
    const lowerName = entry.name.toLowerCase();

    if (entry.isDirectory()) {
      if (lowerName.includes('map') || lowerName.includes('carte')) {
        console.log(`📁 Dossier Cartes détecté : ${entry.name} -> Copie vers public/maps/`);
        copyRecursive(fullPath, PUBLIC_MAPS_DIR);
      } else if (lowerName.includes('texture')) {
        console.log(`📁 Dossier Textures détecté : ${entry.name} -> Copie vers map-editor/public/assets/textures/`);
        copyRecursive(fullPath, EDITOR_TEXTURES_DIR);
      } else if (lowerName.includes('stamp') || lowerName.includes('tampon') || lowerName.includes('props') || lowerName.includes('objet')) {
        console.log(`📁 Dossier Tampons/Stamps détecté : ${entry.name} -> Copie vers map-editor/public/assets/stamps/`);
        copyRecursive(fullPath, EDITOR_STAMPS_DIR);
      } else if (lowerName.includes('token') || lowerName.includes('pion')) {
        console.log(`📁 Dossier Tokens détecté : ${entry.name} -> Copie vers public/tokens/`);
        copyRecursive(fullPath, PUBLIC_TOKENS_DIR);
      } else {
        // Unknown category folder -> place in textures or maps depending on contents
        console.log(`📁 Dossier thématique détecté : ${entry.name} -> Ajout aux textures Map Editor`);
        const targetDir = path.join(EDITOR_TEXTURES_DIR, entry.name.replace(/\s+/g, '_'));
        copyRecursive(fullPath, targetDir);
      }
    } else if (IMAGE_EXTS.has(path.extname(entry.name).toLowerCase())) {
      // Loose image files in root of source folder
      console.log(`🖼️ Image racine détectée : ${entry.name} -> Copie vers public/maps/`);
      ensureDir(PUBLIC_MAPS_DIR);
      fs.copyFileSync(fullPath, path.join(PUBLIC_MAPS_DIR, entry.name));
    }
  }

  console.log('\n⚡ Reconstruction des catalogues...');
  rebuildMapsCatalog();
  rebuildTexturesCatalog();
  rebuildStampsCatalog();
  console.log('\n✨ Importation et synchronisation terminées avec succès !');
}

// CLI Execution
const args = process.argv.slice(2);
if (args.length > 0 && args[0] !== '--rebuild-only') {
  const source = path.resolve(args[0]);
  importFromSourceDir(source);
} else {
  console.log('⚡ Reconstruction des catalogues actuels (sans nouveau dossier source)...');
  rebuildMapsCatalog();
  rebuildTexturesCatalog();
  rebuildStampsCatalog();
  console.log('✅ Catalogues à jour !');
}
