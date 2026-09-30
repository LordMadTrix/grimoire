// Génère depuis map-editor/src/lib/imported_stamps.json les artefacts du
// chargement à la demande du catalogue de tampons :
//  - stamps_manifest.json  : structure {catégorie, sous-catégorie, nombre}
//    (~10 ko) pour construire l'arborescence immédiatement ;
//  - stamps_fragments/<cat enc>/<sub enc>.json : entrées complètes par
//    sous-catégorie, importées dynamiquement au besoin (~140 ko pièce) ;
//  - stamps_registry.json  : id → fragment ordinal (~1 Mo), chargé
//    uniquement pour favoris / recherche globale / résolution d'id.
//
// Usage :
//   node scripts/generate-stamps-catalog.mjs                # régénère toujours
//   node scripts/generate-stamps-catalog.mjs --if-missing   # seulement si périmé
//
// Sorties gitignorées : régénérées via predev/prebuild de map-editor.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SOURCE = path.join(ROOT, 'map-editor', 'src', 'lib', 'imported_stamps.json');
const LIB_DIR = path.join(ROOT, 'map-editor', 'src', 'lib');
const FRAG_DIR = path.join(LIB_DIR, 'stamps_fragments');
const MANIFEST_OUT = path.join(LIB_DIR, 'stamps_manifest.json');
const REGISTRY_OUT = path.join(LIB_DIR, 'stamps_registry.json');

const ifMissing = process.argv.includes('--if-missing');
const sourceMtime = fs.statSync(SOURCE).mtimeMs;

function isFresh() {
  if (!fs.existsSync(MANIFEST_OUT) || !fs.existsSync(REGISTRY_OUT)) return false;
  return (
    fs.statSync(MANIFEST_OUT).mtimeMs >= sourceMtime &&
    fs.statSync(REGISTRY_OUT).mtimeMs >= sourceMtime
  );
}

if (ifMissing && isFresh()) process.exit(0);

const stamps = JSON.parse(fs.readFileSync(SOURCE, 'utf-8'));

// Grouper par (catégorie, sous-catégorie).
const groups = new Map();
for (const s of stamps) {
  const cat = s.category || 'Divers';
  const sub = s.subcategory || 'Général';
  const key = `${cat}\u0000${sub}`;
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(s);
}

// Noms de fichiers sûrs pour import dynamique + import.meta.glob :
// aucun espace ni caractère spécial (les % encodés cassent la résolution
// de modules de Vite) — slug déterministe en minuscules + underscores.
const fragName = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'x';
const fragmentRelPath = (cat, sub) => `./stamps_fragments/${fragName(cat)}/${fragName(sub)}.json`;

// ── Manifeste : structure de l'arbre ────────────────────────────
const manifest = [...groups.entries()]
  .map(([key, entries]) => {
    const [cat, sub] = key.split('\u0000');
    return { c: cat, s: sub, n: entries.length, p: fragmentRelPath(cat, sub) };
  })
  .sort((a, b) => a.c.localeCompare(b.c) || a.s.localeCompare(b.s));

// ── Registre : id → [ordinal de fragment, nom] ──────────────────
// Sert à la recherche globale (nom), aux favoris et à la résolution
// d'un id précis sans charger tous les fragments. Clés stables.
const fragmentKeys = manifest.map((m) => `${m.c}\u0000${m.s}`);
const registry = {};
for (const [key, entries] of groups) {
  const ordinal = fragmentKeys.indexOf(key);
  for (const e of entries) registry[e.id] = [ordinal, e.name];
}

// ── Écritures ───────────────────────────────────────────────────
fs.rmSync(FRAG_DIR, { recursive: true, force: true });
let fragBytes = 0;
for (const [key, entries] of groups) {
  const [cat, sub] = key.split('\u0000');
  const file = path.join(LIB_DIR, fragmentRelPath(cat, sub).replace('./', ''));
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const json = JSON.stringify(entries);
  fs.writeFileSync(file, json);
  fragBytes += Buffer.byteLength(json);
}

fs.writeFileSync(MANIFEST_OUT, JSON.stringify(manifest));
fs.writeFileSync(REGISTRY_OUT, JSON.stringify(registry));

console.log(`🗂️  stamps_manifest.json : ${manifest.length} sous-catégories (${(fs.statSync(MANIFEST_OUT).size / 1024).toFixed(0)} ko)`);
console.log(`🧩 ${groups.size} fragments (${(fragBytes / 1024).toFixed(0)} ko au total, ${(fragBytes / groups.size / 1024).toFixed(0)} ko en moyenne)`);
console.log(`🔗 stamps_registry.json : ${Object.keys(registry).length} ids (${(fs.statSync(REGISTRY_OUT).size / 1024).toFixed(0)} ko)`);
