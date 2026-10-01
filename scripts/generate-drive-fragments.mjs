#!/usr/bin/env node
/**
 * 🧙 Grimoire — Découpage du catalogue Drive en chargement à la demande
 *
 * Entre  : public/drive-catalog.json (4,4 Mo, 30 021 fichiers, chargé d'un bloc)
 * Sortie : public/drive-catalog-light.json  (~200 o) — manifeste : total + compteur par dossier racine
 *          public/drive-fragments/<dossier>.json — lignes compactes [[id, path, name], …] par dossier
 *
 * Le catalogue complet reste en place (repli pour les anciennes versions).
 * Usage : node scripts/generate-drive-fragments.mjs [--if-missing]
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const CATALOG = path.join(ROOT, 'public', 'drive-catalog.json');
const LIGHT = path.join(ROOT, 'public', 'drive-catalog-light.json');
const FRAGMENTS_DIR = path.join(ROOT, 'public', 'drive-fragments');

const ifMissing = process.argv.includes('--if-missing');

// ── Early exit si déjà généré et à jour ──────────────────────────────────────
if (ifMissing && fs.existsSync(LIGHT) && fs.existsSync(FRAGMENTS_DIR)) {
  const catalogMtime = fs.statSync(CATALOG).mtimeMs;
  const lightMtime = fs.statSync(LIGHT).mtimeMs;
  const fragmentFiles = fs.readdirSync(FRAGMENTS_DIR);
  const allFragmentsFresh = fragmentFiles.length > 0
    && fragmentFiles.every(f => fs.statSync(path.join(FRAGMENTS_DIR, f)).mtimeMs >= catalogMtime);
  if (lightMtime >= catalogMtime && allFragmentsFresh) {
    console.log('↩︎  Fragments drive-catalog déjà à jour (--if-missing)');
    process.exit(0);
  }
}

console.log('🧩 Découpage du catalogue Drive en fragments à la demande...');

const catalog = JSON.parse(fs.readFileSync(CATALOG, 'utf8'));
const files = catalog.files || [];
if (!Array.isArray(files) || files.length === 0) {
  console.error('❌ drive-catalog.json vide ou au format inattendu');
  process.exit(1);
}

// ── Découpage : niveau 1 pour tout, niveau 2 pour stamps (26 226 fichiers) ───
const groups = new Map();
for (const item of files) {
  const [, p] = item;
  const parts = String(p).replace(/\\/g, '/').replace(/^\/+/, '').replace(/^assets\//i, '').split('/');
  let key = parts[0] || '(racine)';
  if (key === 'stamps' && parts.length > 2) key = `stamps/${parts[1]}`;
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(item);
}

fs.rmSync(FRAGMENTS_DIR, { recursive: true, force: true });
fs.mkdirSync(FRAGMENTS_DIR, { recursive: true });

const manifest = {
  version: 1,
  updated: catalog.updated || new Date().toISOString().slice(0, 10),
  totalFiles: files.length,
  folders: Object.fromEntries([...groups.entries()].map(([name, list]) => [name, list.length])),
};

let totalBytes = 0;
for (const [name, list] of groups) {
  const fragmentPath = path.join(FRAGMENTS_DIR, `${name.replaceAll('/', '__')}.json`);
  fs.writeFileSync(fragmentPath, JSON.stringify(list));
  totalBytes += fs.statSync(fragmentPath).size;
}
fs.writeFileSync(LIGHT, JSON.stringify(manifest));

const fmtKo = b => (b / 1024).toFixed(1);
console.log(`✅ Manifeste : ${fmtKo(fs.statSync(LIGHT).size)} ko — ${groups.size} fragments : ${fmtKo(totalBytes)} ko au total`);
console.log(`   Dossiers : ${[...groups.entries()].map(([k, v]) => `${k}(${v.length})`).join(', ')}`);
