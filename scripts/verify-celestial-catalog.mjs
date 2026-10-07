#!/usr/bin/env node
/**
 * 🧙 Grimoire — Vérification d'intégrité du catalogue céleste (Archives Célestes)
 *
 * Contrôle :
 *  1. drive-catalog-light.json (manifeste) : structure + sommes
 *  2. public/drive-fragments/*.json        : format compact [id, path, name], comptes
 *  3. Cohérence manifeste ↔ fragments ↔ drive-catalog.json
 *  4. Doublons d'identifiants Drive et de chemins
 *  5. Chemins hors préfixe `assets/`, extensions inconnues de la whitelist
 *  6. Fragments orphelins (absents du manifeste) et dossiers du manifeste sans fragment
 *
 * Usage : node scripts/verify-celestial-catalog.mjs
 * Code retour : 0 = OK, 1 = incohérence détectée.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = path.join(ROOT, 'public');
const LIGHT = path.join(PUBLIC, 'drive-catalog-light.json');
const CATALOG = path.join(PUBLIC, 'drive-catalog.json');
const FRAGMENTS_DIR = path.join(PUBLIC, 'drive-fragments');

// Doit rester aligné avec scripts/scan-drive-folder.mjs (ALLOWED_EXTENSIONS)
const ALLOWED_EXT = new Set([
  '.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.avif',
  '.mp3', '.ogg', '.wav', '.flac', '.m4a',
  '.mp4', '.webm',
  '.pdf', '.txt', '.md', '.json',
]);

const errors = [];
const warnings = [];
const note = msg => console.log(`   ${msg}`);
const err = msg => { errors.push(msg); };
const warn = msg => { warnings.push(msg); };

// ── 1. Manifeste ─────────────────────────────────────────────────────────────
console.log('\n1️⃣  Manifeste (drive-catalog-light.json)');
if (!fs.existsSync(LIGHT)) {
  err('drive-catalog-light.json manquant');
  console.log('   ❌ absent');
} else {
  const manifest = JSON.parse(fs.readFileSync(LIGHT, 'utf8'));
  const folders = manifest.folders || {};
  const sum = Object.values(folders).reduce((a, b) => a + b, 0);
  note(`version ${manifest.version} — mis à jour ${manifest.updated}`);
  note(`${Object.keys(folders).length} dossiers — totalFiles=${manifest.totalFiles} — somme des dossiers=${sum}`);
  if (sum !== manifest.totalFiles) err(`manifeste : totalFiles=${manifest.totalFiles} ≠ somme des dossiers=${sum}`);
}

// ── 2–5. Fragments ───────────────────────────────────────────────────────────
console.log('\n2️⃣  Fragments (public/drive-fragments/*.json)');
const manifest = JSON.parse(fs.readFileSync(LIGHT, 'utf8'));
const fragmentFiles = fs.existsSync(FRAGMENTS_DIR)
  ? fs.readdirSync(FRAGMENTS_DIR).filter(f => f.endsWith('.json'))
  : [];
if (!fragmentFiles.length) err('aucun fragment trouvé');

const toKey = f => f.replace(/\.json$/, '').replaceAll('__', '/');
const fragmentKeys = new Set(fragmentFiles.map(toKey));

for (const folder of Object.keys(manifest.folders)) {
  if (!fragmentKeys.has(folder)) err(`fragment manquant pour le dossier du manifeste « ${folder} »`);
}
for (const key of fragmentKeys) {
  if (!(key in manifest.folders)) err(`fragment orphelin (pas dans le manifeste) : « ${key} »`);
}

const allRows = [];
let compactOk = 0;
for (const f of fragmentFiles) {
  const key = toKey(f);
  let rows;
  try {
    rows = JSON.parse(fs.readFileSync(path.join(FRAGMENTS_DIR, f), 'utf8'));
  } catch (e) {
    err(`JSON invalide dans ${f} : ${e.message}`);
    continue;
  }
  if (!Array.isArray(rows)) { err(`${f} : format attendu = tableau compact`); continue; }

  const expected = manifest.folders[key];
  if (expected !== rows.length) {
    err(`${key} : manifeste=${expected} mais fragment=${rows.length}`);
  }

  for (const row of rows) {
    if (!Array.isArray(row) || row.length !== 3 || typeof row[0] !== 'string' || typeof row[1] !== 'string') {
      err(`${key} : entrée mal formée → ${JSON.stringify(row).slice(0, 120)}`);
      continue;
    }
    const [id, p, name] = row;
    if (!id) err(`${key} : id vide → ${JSON.stringify(row).slice(0, 120)}`);
    if (!p) err(`${key} : path vide → ${JSON.stringify(row).slice(0, 120)}`);
    if (!name) warn(`${key} : nom vide → ${p}`);
    if (!/^assets\//i.test(p)) warn(`${key} : chemin sans préfixe assets/ → ${p}`);
    const ext = (p.match(/\.[a-z0-9]+$/i) || [''])[0].toLowerCase();
    if (ext && !ALLOWED_EXT.has(ext)) warn(`${key} : extension non autorisée « ${ext} » → ${p}`);
    compactOk++;
    allRows.push(row);
  }
}
note(`${compactOk} entrées compactes valides [id, path, name]`);

// Doublons
const ids = allRows.map(r => r[0]);
const paths = allRows.map(r => r[1]);
const dupIds = [...new Set(ids.filter((v, i) => ids.indexOf(v) !== i))];
const dupPaths = [...new Set(paths.filter((v, i) => paths.indexOf(v) !== i))];
note(`doublons d'id : ${dupIds.length} — doublons de chemin : ${dupPaths.length}`);
if (dupIds.length) err(`${dupIds.length} id dupliqués, ex. ${dupIds.slice(0, 3).join(', ')}`);
if (dupPaths.length) err(`${dupPaths.length} chemins dupliqués, ex. ${dupPaths.slice(0, 3).join(', ')}`);

// Extensions
const extCount = {};
for (const r of allRows) {
  const ext = (r[1].match(/\.[a-z0-9]+$/i) || ['(aucune)'])[0].toLowerCase();
  extCount[ext] = (extCount[ext] || 0) + 1;
}
note(`extensions : ${Object.entries(extCount).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}=${v}`).join(' ')}`);

// ── 3. Cohérence avec le catalogue complet ───────────────────────────────────
console.log('\n3️⃣  Cohérence avec drive-catalog.json (repli complet)');
if (!fs.existsSync(CATALOG)) {
  warn('drive-catalog.json absent (repli ancienne version indisponible)');
} else {
  const big = JSON.parse(fs.readFileSync(CATALOG, 'utf8'));
  const files = big.files || [];
  note(`catalogue complet : ${files.length} fichiers — mis à jour ${big.updated}`);
  if (big.totalFiles !== files.length) err(`catalogue : totalFiles=${big.totalFiles} ≠ files.length=${files.length}`);
  if (manifest.totalFiles !== files.length) err(`manifeste=${manifest.totalFiles} ≠ catalogue complet=${files.length}`);
  if (manifest.updated !== big.updated) warn(`dates divergentes : manifeste=${manifest.updated} / catalogue=${big.updated}`);

  const fragSet = new Set(allRows.map(r => r[0]));
  const bigSet = new Set(files.map(r => r[0]));
  const onlyInFragments = [...fragSet].filter(x => !bigSet.has(x));
  const onlyInCatalog = [...bigSet].filter(x => !fragSet.has(x));
  if (onlyInFragments.length) err(`${onlyInFragments.length} id présents dans les fragments mais pas dans le catalogue, ex. ${onlyInFragments.slice(0, 3).join(', ')}`);
  if (onlyInCatalog.length) err(`${onlyInCatalog.length} id présents dans le catalogue mais pas dans les fragments, ex. ${onlyInCatalog.slice(0, 3).join(', ')}`);
  if (!onlyInFragments.length && !onlyInCatalog.length) note('ensembles d\'id identiques fragments ↔ catalogue ✓');
}

// ── Synthèse ─────────────────────────────────────────────────────────────────
console.log('\n─── Synthèse ───');
console.log(`   entrées : ${allRows.length} / manifeste ${manifest.totalFiles}`);
if (warnings.length) {
  console.log(`   ⚠️  ${warnings.length} avertissement(s) :`);
  for (const w of warnings.slice(0, 15)) console.log(`      - ${w}`);
  if (warnings.length > 15) console.log(`      … et ${warnings.length - 15} autres`);
}
if (errors.length) {
  console.log(`   ❌ ${errors.length} erreur(s) :`);
  for (const e of errors) console.log(`      - ${e}`);
  process.exit(1);
}
console.log('   ✅ Catalogue céleste cohérent');
