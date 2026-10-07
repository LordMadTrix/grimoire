#!/usr/bin/env node
/**
 * 📡 Grimoire — Scan d'un dossier Google Drive partagé (sans Python/gdown)
 *
 * Alternative Node au script Python generate_drive_catalog.py --fetch-drive
 * pour les machines sans Python. Utilise le listing embarqué de la page
 * publique du dossier (_DRIVE_ivd).
 *
 * Usages :
 *   node scripts/scan-drive-folder.mjs --list <folderId>
 *       Liste directe des enfants (id, type, nom).
 *
 *   node scripts/scan-drive-folder.mjs --rescan <rootId> <nomDossier>
 *       Scanne récursivement <nomDossier> (enfant direct de <rootId>),
 *       remplace ses entrées dans public/drive-catalog.json (les autres
 *       fichiers sont conservés), sauvegarde l'ancien catalogue dans le
 *       dossier temporaire, puis régénère les fragments via
 *       scripts/generate-drive-fragments.mjs.
 *
 * Notes :
 *  - Le dossier doit être partagé (accessible sans authentification).
 *  - Google peut limiter l'affichage des très gros dossiers ; une garde
 *    MAX_FILES arrête le scan au-delà du plafond.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const CATALOG = path.join(ROOT, 'public', 'drive-catalog.json');
const FRAGMENTS_DIR = path.join(ROOT, 'public', 'drive-fragments');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)';
const MAX_FILES = 60000; // > 26 000 fichiers dans assets/stamps (le plafond précédent coupait ce scan)
// Le listing statique de Drive s'arrête à 50 entrées par dossier (troncature
// silencieuse) — le mode API (clé dans .env) est seul fiable pour un scan complet.
const STATIC_LISTING_LIMIT = 50;

/** Charge .env à la racine (sans écraser les variables déjà définies). */
function loadDotEnv() {
  const p = path.join(ROOT, '.env');
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m && m[2] && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
}

// Même liste d'extensions que scripts/generate_drive_catalog.py
const ALLOWED_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.webp', '.svg', '.gif',
  '.pdf', '.mp3', '.ogg', '.wav', '.flac', '.m4a', '.md', '.txt',
  '.mp4', '.webm',
]);

/** Même transformation de nom que generate_drive_catalog.py (format_readable_name). */
function formatReadableName(filename) {
  let name = filename.replace(/\.[^.]+$/, '');
  name = name.replace(/^\d+[\s_-]*/, '');
  name = name.replace(/[_-]+/g, ' ');
  name = name.replace(/([a-z])([A-Z])/g, '$1 $2').trim();
  return name.replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Interprète le littéral JS de window['_DRIVE_ivd'] puis parse le JSON :
 *  1. littéral JS → valeur (`\\`→`\`, `\xHH`→car., `\uHHHH`→car.) ;
 *  2. réparation des backslashes résiduels non valides en JSON (`\x3d`…).
 */
function parseDriveIvd(raw) {
  let v = '';
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (c !== '\\') { v += c; continue; }
    const n = raw[i + 1];
    if (n === 'x') { v += String.fromCharCode(parseInt(raw.slice(i + 2, i + 4), 16)); i += 3; }
    else if (n === 'u') { v += String.fromCharCode(parseInt(raw.slice(i + 2, i + 6), 16)); i += 5; }
    else if (n === '\\') { v += '\\'; i += 1; }
    else if (n === "'") { v += "'"; i += 1; }
    // autres (\n, \", \/ …) : conservés tels quels, déjà valides en JSON
  }
  v = v.replace(/\\(?!(["\\\/bfnrtu]))/g, '\\\\');
  return JSON.parse(v);
}

/** Décodage du listing embarqué window['_DRIVE_ivd']. */
function parseFolderListing(html, folderId) {
  const m = html.match(/window\['_DRIVE_ivd'\] = '([^']+)'/);
  if (!m) {
    throw new Error(
      `Listing introuvable pour ${folderId} — dossier privé, lien non partagé, ou page Google modifiée.`
    );
  }
  const data = parseDriveIvd(m[1]);
  if (!Array.isArray(data)) throw new Error(`Listing illisible pour ${folderId}`);
  // Le JSON racine a la forme [ [item, item, …], index ] : on aplanit d'un niveau.
  const list = Array.isArray(data[0]) && Array.isArray(data[0][0]) ? data[0] : data;
  return list
    .filter((e) => Array.isArray(e) && e[0])
    .map((e) => ({ id: e[0], name: String(e[2] ?? ''), mime: String(e[3] ?? '') }));
}

const isFolderMime = (mime) => mime === 'application/vnd.google-apps.folder';

/** Liste complète via l'API Google Drive v3 (clé DRIVE_API_KEY) — sans plafond à 50. */
async function fetchFolderItemsApi(folderId, key) {
  const items = [];
  let pageToken;
  do {
    const u = new URL('https://www.googleapis.com/drive/v3/files');
    u.searchParams.set('q', `'${folderId}' in parents and trashed = false`);
    u.searchParams.set('fields', 'nextPageToken,files(id,name,mimeType)');
    u.searchParams.set('pageSize', '1000');
    u.searchParams.set('key', key);
    if (pageToken) u.searchParams.set('pageToken', pageToken);
    const res = await fetch(u);
    const data = await res.json();
    if (!res.ok) {
      throw new Error(`Drive API ${res.status} : ${data.error?.message || 'erreur inconnue'}`);
    }
    for (const f of data.files || []) {
      items.push({ id: f.id, name: f.name, mime: f.mimeType });
    }
    pageToken = data.nextPageToken;
  } while (pageToken);
  return items;
}

/** Liste statique (sans clé) — plafonnée à STATIC_LISTING_LIMIT entrées. */
async function fetchFolderItemsStatic(folderId) {
  const res = await fetch(`https://drive.google.com/drive/folders/${folderId}`, {
    headers: { 'User-Agent': UA },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} pour ${folderId}`);
  return parseFolderListing(await res.text(), folderId);
}

async function fetchFolderItems(folderId) {
  const key = process.env.DRIVE_API_KEY;
  if (key) return fetchFolderItemsApi(folderId, key);
  const items = await fetchFolderItemsStatic(folderId);
  if (items.length >= STATIC_LISTING_LIMIT) {
    console.warn(
      `⚠️  Dossier ${folderId} : ${items.length} entrées = plafond du listing statique — scan potentiellement tronqué. Ajoutez DRIVE_API_KEY dans .env pour un scan complet.`
    );
  }
  return items;
}

const isFolder = (item) => isFolderMime(item.mime);

/** Parcours récursif ; retourne les entrées [id, relPath, name] au format catalogue. */
async function collectFiles(folderId, relPrefix, out, depth) {
  if (out.length >= MAX_FILES) return;
  if (depth > 8) return;
  const items = await fetchFolderItems(folderId);
  for (const item of items) {
    if (out.length >= MAX_FILES) return;
    const relPath = relPrefix ? `${relPrefix}/${item.name}` : item.name;
    if (isFolder(item)) {
      await collectFiles(item.id, relPath, out, depth + 1);
    } else {
      const ext = path.extname(item.name).toLowerCase();
      if (!ALLOWED_EXTENSIONS.has(ext)) continue;
      out.push([item.id, relPath.replace(/\\/g, '/'), formatReadableName(item.name)]);
    }
  }
}

async function main() {
  const [mode, arg1, arg2] = process.argv.slice(2);

  if (mode === '--list' && arg1) {
    const items = await fetchFolderItems(arg1);
    for (const i of items) {
      console.log(` - ${isFolder(i) ? '[D]' : '[F]'} ${i.name} => ${i.id}`);
    }
    console.log(`(${items.length} éléments)`);
    return;
  }

  if (mode === '--rescan' && arg1 && arg2) {
    loadDotEnv();
    const rootId = arg1;
    const folderName = arg2;
    const pathPrefix = process.argv[5] || ''; // argv: 2=--rescan 3=rootId 4=nom 5=préfixe (« assets » pour assets/Token)

    console.log(
      process.env.DRIVE_API_KEY
        ? '🔑 Mode API Drive (scan complet, sans plafond à 50).'
        : '⚠️  Mode statique SANS clé — scan possiblement tronqué (50 entrées max par dossier).'
    );

    const children = await fetchFolderItems(rootId);
    const target = children.find(
      (c) => isFolderMime(c.mime) && c.name.toLowerCase() === folderName.toLowerCase()
    );
    if (!target) {
      console.error(
        `❌ Dossier « ${folderName} » introuvable parmi les ${children.length} enfants de ${rootId}.`
      );
      console.error(
        `   Enfants : ${children.map((c) => c.name).join(', ') || '(aucun)'} `
      );
      process.exit(2);
    }

    const relBase = pathPrefix ? `${pathPrefix}/${target.name}` : target.name;
    console.log(`🔎 Scan de « ${relBase} » (${target.id})...`);
    const entries = [];
    await collectFiles(target.id, relBase, entries, 0);
    if (entries.length >= MAX_FILES) {
      console.error(`⚠️  Plafond MAX_FILES (${MAX_FILES}) atteint — scan partiel.`);
      process.exit(3);
    }
    console.log(`📦 ${entries.length} fichiers autorisés trouvés.`);

    const catalog = JSON.parse(fs.readFileSync(CATALOG, 'utf8'));
    const prefix = `${relBase}/`;
    const before = catalog.files.filter((f) => f[1].startsWith(prefix)).length;
    const kept = catalog.files.filter((f) => !f[1].startsWith(prefix));
    catalog.files = [...kept, ...entries];
    catalog.totalFiles = catalog.files.length;
    catalog.updated = new Date().toISOString().replace('T', ' ').slice(0, 19);

    const backup = path.join(os.tmpdir(), `drive-catalog.backup-${Date.now()}.json`);
    fs.copyFileSync(CATALOG, backup);
    fs.writeFileSync(CATALOG, JSON.stringify(catalog));
    console.log(
      `💾 Catalogue mis à jour (${before} entrées « ${prefix} » remplacées par ${entries.length}) — backup : ${backup}`
    );

    const gen = spawnSync(
      process.execPath,
      [path.join(ROOT, 'scripts', 'generate-drive-fragments.mjs')],
      { stdio: 'inherit' }
    );
    if (gen.status !== 0) process.exit(gen.status ?? 1);
    console.log(`✅ Fragments régénérés dans ${path.relative(ROOT, FRAGMENTS_DIR)}/`);
    return;
  }    console.log('Usage:');
    console.log('  node scripts/scan-drive-folder.mjs --list <folderId>');
    console.log('  node scripts/scan-drive-folder.mjs --rescan <rootId> <nomDossier> [préfixeEx:assets]');
    console.log('');
    console.log('Clé API Drive (scan complet) : mettre DRIVE_API_KEY=... dans .env à la racine.');
  process.exit(1);
}

main().catch((e) => {
  console.error(`❌ ${e.message}`);
  process.exit(1);
});
