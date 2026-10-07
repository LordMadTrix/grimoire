#!/usr/bin/env node
/**
 * Audit LECTURE SEULE de l'arborescence Drive (clé API, aucun déplacement).
 * But : mesurer le « désordre » (profondeur, dossiers vides, fichiers isolés,
 * extensions inattendues, noms douteux) avant toute réorganisation.
 *
 * Usage : node scripts/survey-drive-layout.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT_ID = process.argv[2] || '1tEqv_ErH8SSO1sWX-HbYjgJZwVd2jS8B'; // dossier « assets »
const MAX_FILES = 60000;
const FOLDER_MIME = 'application/vnd.google-apps.folder';

function loadDotEnv() {
  const p = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = /^([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
}
loadDotEnv();

const KEY = process.env.DRIVE_API_KEY;
if (!KEY) {
  console.error('❌ DRIVE_API_KEY absente de .env');
  process.exit(1);
}

async function listChildren(folderId) {
  const out = [];
  let pageToken;
  do {
    const u = new URL('https://www.googleapis.com/drive/v3/files');
    u.searchParams.set('q', `'${folderId}' in parents and trashed = false`);
    u.searchParams.set('fields', 'nextPageToken,files(id,name,mimeType,size)');
    u.searchParams.set('pageSize', '1000');
    u.searchParams.set('key', KEY);
    if (pageToken) u.searchParams.set('pageToken', pageToken);
    const res = await fetch(u);
    const data = await res.json();
    if (!res.ok) throw new Error(`Drive API ${res.status} : ${data.error?.message || '?'}`);
    for (const f of data.files || []) out.push(f);
    pageToken = data.nextPageToken;
  } while (pageToken);
  return out;
}

const stats = {
  folders: 0,
  files: 0,
  emptyFolders: [],
  deepFolders: [],
  looseFilesAtCategoryRoot: [],
  oddExtensions: new Map(),
  suspiciousNames: [],
  maxDepth: 0,
};

async function walk(folderId, relPath, depth) {
  if (stats.files >= MAX_FILES || depth > 8) return { files: 0, folders: 0 };
  const children = await listChildren(folderId);
  const dirs = children.filter((c) => c.mimeType === FOLDER_MIME);
  const files = children.filter((c) => c.mimeType !== FOLDER_MIME);

  stats.folders += dirs.length;
  stats.files += files.length;
  if (depth > stats.maxDepth) stats.maxDepth = depth;

  if (dirs.length === 0 && files.length === 0) {
    stats.emptyFolders.push(relPath || '(racine)');
  }
  if (depth >= 4 && dirs.length > 0) {
    stats.deepFolders.push(`${relPath} (profondeur ${depth}, ${dirs.length} sous-dossiers)`);
  }
  // Fichiers posés directement à la racine d'une grande catégorie (vrac)
  if (depth === 2 && files.length > 0 && dirs.length > 0) {
    stats.looseFilesAtCategoryRoot.push(`${relPath} → ${files.length} fichier(s) en vrac + ${dirs.length} dossier(s)`);
  }

  for (const f of files) {
    const ext = (f.name.split('.').pop() || '').toLowerCase();
    stats.oddExtensions.set(ext, (stats.oddExtensions.get(ext) || 0) + 1);
    // Noms peu lisibles : id Drive brut, préfixe numérique, casse incohérente, espaces multiples
    if (/^[A-Za-z0-9_-]{20,}$/.test(f.name.replace(/\.[^.]+$/, ''))) {
      stats.suspiciousNames.push(`[id brut] ${relPath}/${f.name}`);
    } else if (/\s{2,}/.test(f.name)) {
      stats.suspiciousNames.push(`[espaces] ${relPath}/${f.name}`);
    }
  }

  let totalFiles = files.length;
  for (const d of dirs) {
    const sub = await walk(d.id, relPath ? `${relPath}/${d.name}` : d.name, depth + 1);
    totalFiles += sub.files;
  }
  return { files: totalFiles, folders: dirs.length };
}

const t0 = Date.now();
const root = await listChildren(ROOT_ID);
console.log('── Racine « assets » ──');
for (const r of root) {
  const kind = r.mimeType === FOLDER_MIME ? '📁' : '📄';
  console.log(`  ${kind} ${r.name}`);
}

for (const r of root.filter((c) => c.mimeType === FOLDER_MIME)) {
  const res = await walk(r.id, r.name, 1);
  console.log(`\n── ${r.name} : ${res.files} fichiers, ${res.folders} sous-dossiers directs ──`);
}

const sortedExt = [...stats.oddExtensions.entries()].sort((a, b) => b[1] - a[1]);

console.log('\n═══ Synthèse ═══');
console.log(`  dossiers        : ${stats.folders}`);
console.log(`  fichiers        : ${stats.files}`);
console.log(`  profondeur max  : ${stats.maxDepth}`);
console.log(`  dossiers vides  : ${stats.emptyFolders.length}`);
for (const e of stats.emptyFolders.slice(0, 15)) console.log(`      • ${e}`);
console.log(`  dossiers profonds (>=4) : ${stats.deepFolders.length}`);
for (const d of stats.deepFolders.slice(0, 15)) console.log(`      • ${d}`);
console.log(`  vrac à la racine d'une catégorie : ${stats.looseFilesAtCategoryRoot.length}`);
for (const v of stats.looseFilesAtCategoryRoot.slice(0, 15)) console.log(`      • ${v}`);
console.log('  extensions :');
for (const [ext, n] of sortedExt.slice(0, 20)) console.log(`      .${ext || '(aucune)'} = ${n}`);
console.log(`  noms douteux (id brut / espaces doubles) : ${stats.suspiciousNames.length}`);
for (const s of stats.suspiciousNames.slice(0, 15)) console.log(`      • ${s}`);
console.log(`\n⏱️  ${((Date.now() - t0) / 1000).toFixed(1)} s`);
