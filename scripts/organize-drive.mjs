#!/usr/bin/env node
/**
 * Rangement du Drive Grimoire — regroupement des fichiers posés EN VRAC à la
 * racine d'une catégorie, par auteur/collection déduit du nom de fichier.
 *
 *   node scripts/organize-drive.mjs --plan  [catégorie]   (défaut : maps)
 *   node scripts/organize-drive.mjs --apply [catégorie]
 *
 * • `--plan` fonctionne avec la SEULE clé lecture seule (DRIVE_API_KEY) :
 *   il n'écrit rien, il affiche ce qui serait déplacé.
 * • `--apply` exige un compte de service : GOOGLE_SERVICE_ACCOUNT_JSON
 *   (chemin du fichier .json) ET le partage du dossier « assets » avec
 *   l'e-mail du compte de service (rôle Éditeur). Voir .env.example.
 *
 * Sécurité : jamais de suppression ; interdit de sortir des dossiers racine
 * autorisés ; idempotent (relancer ne redéplace pas ce qui est déjà rangé).
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOTS = {
  assets: '1tEqv_ErH8SSO1sWX-HbYjgJZwVd2jS8B',
  maps: '1R0loeyByWj8HTk_C6PhMoV-AawsTUYrd',
  stamps: '16TSPYeWn8shzreOAZY4DTJ7q9dO8Gd9r',
  textures: '1S3wE7pCAgJVKD8Cuq3eZnWmTOduO8wC9',
  Token: '1Z1iijqVt87cgRg5Lgmq2azZogE4ueOVv',
  PDF: '1tLyshjCQchrHpf3CBtq8tjPBzZbRq4Os',
  Grimoire_Audio: '1cW7TCMop-JXz2q2eUMDKQXvXzObEdkXQ',
};
const CATEGORIES = ['maps', 'stamps', 'textures', 'Token', 'PDF', 'Grimoire_Audio'];
const PROTECTED = 'assets'; // le seul dossier qu'on ne quitte jamais
const FOLDER_MIME = 'application/vnd.google-apps.folder';
const NO_TAG_FOLDER = 'Divers';

function loadDotEnv() {
  const p = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = /^([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
}
loadDotEnv();

// ── Auth ─────────────────────────────────────────────────────────────────
/** Jeton d'accès via un compte de service (JWT RS256 signé localement). */
async function serviceAccountToken() {
  const keyPath = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!keyPath) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON manquant dans .env');
  if (!fs.existsSync(keyPath)) throw new Error(`Fichier introuvable : ${keyPath}`);
  const sa = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
  const now = Math.floor(Date.now() / 1000);
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const input = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/drive',
    aud: sa.token_uri || 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  })}`;
  const sig = crypto.createSign('RSA-SHA256').update(input).sign(sa.private_key).toString('base64url');
  const res = await fetch(sa.token_uri || 'https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${input}.${sig}`,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Auth compte de service ${res.status} : ${data.error_description || data.error}`);
  return data.access_token;
}

/** Requête Drive : clé API (lecture) ou Bearer (écriture). */
function driveFetch(method, urlPath, { token, body, params } = {}) {
  const u = new URL(`https://www.googleapis.com/drive/v3/${urlPath}`);
  for (const [k, v] of Object.entries(params || {})) u.searchParams.set(k, v);
  if (!token) u.searchParams.set('key', process.env.DRIVE_API_KEY || '');
  return fetch(u, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

// ── Règles de rangement ──────────────────────────────────────────────────
/** Auteur/collection déduit du nom : « (DnDavid) », « ... DnDavid.jpg », sinon Divers. */
function authorOf(filename) {
  const m = /\(([^)]+)\)\s*\.[A-Za-z0-9]+$/.exec(filename);
  if (m) {
    const raw = m[1].trim().replace(/[/\\]/g, '-');
    // « (1) », « (2) » … sont des doublons Windows, pas un auteur : on évite
    // de créer un dossier « 1 » à côté des vrais dossiers d'auteurs.
    if (!/^\d{1,3}$/.test(raw)) return raw;
  }
  if (/\sDnDavid\s*\.[A-Za-z0-9]+$/.test(filename)) return 'DnDavid';
  return NO_TAG_FOLDER;
}

// ── Programme ────────────────────────────────────────────────────────────
async function listDirectFiles(folderId, token) {
  const files = [];
  let pageToken;
  do {
    const res = await driveFetch('GET', 'files', {
      token,
      params: {
        q: `'${folderId}' in parents and trashed = false`,
        fields: 'nextPageToken,files(id,name,mimeType)',
        pageSize: '1000',
        ...(pageToken ? { pageToken } : {}),
      },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(`Drive API ${res.status} : ${data.error?.message || '?'}`);
    for (const f of data.files || []) files.push(f);
    pageToken = data.nextPageToken;
  } while (pageToken);
  return files;
}

async function ensureFolder(name, parentId, token, knownChildren) {
  const children = knownChildren ?? (await listDirectFiles(parentId, token));
  const found = children.find((c) => c.mimeType === FOLDER_MIME && c.name === name);
  if (found) return { id: found.id, created: false };
  const res = await driveFetch('POST', 'files', {
    token,
    params: { fields: 'id' },
    body: { name, mimeType: FOLDER_MIME, parents: [parentId] },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Création « ${name} » : ${data.error?.message || res.status}`);
  return { id: data.id, created: true };
}

async function main() {
  const mode = process.argv[2] || '--plan';
  const category = process.argv[3] || 'maps';

  if (!['--plan', '--apply'].includes(mode)) {
    console.log('Usage : node scripts/organize-drive.mjs [--plan|--apply] [catégorie]');
    console.log('  catégories : ' + CATEGORIES.join(', '));
    process.exit(1);
  }
  if (!CATEGORIES.includes(category)) {
    console.error(`❌ Catégorie inconnue « ${category} » (autorisées : ${CATEGORIES.join(', ')})`);
    process.exit(1);
  }

  const rootId = ROOTS[category];
  const token = mode === '--apply' ? await serviceAccountToken() : null;
  if (mode === '--apply' && !token) {
    console.error('❌ Écriture impossible sans compte de service.');
    process.exit(1);
  }

  console.log(`📂 Catégorie « ${category} » (${rootId}) — mode ${mode === '--apply' ? 'ÉCRITURE' : 'SIMULATION'}`);

  // 1. Racine de la catégorie
  const rootChildren = await listDirectFiles(rootId, token);
  let moved = await organizeFolder(rootChildren, rootId, category, token, mode);

  // 2. Sous-dossiers directs qui mélangent fichiers EN VRAC et dossiers :
  //    c'est le vrai critère de désordre (un dossier plat = légitime, on n'y touche pas).
  const subfolders = rootChildren.filter((c) => c.mimeType === FOLDER_MIME);
  let checked = 0;
  for (const sub of subfolders) {
    const kids = await listDirectFiles(sub.id, token);
    const hasFiles = kids.some((c) => c.mimeType !== FOLDER_MIME);
    const hasDirs = kids.some((c) => c.mimeType === FOLDER_MIME);
    if (!hasFiles || !hasDirs) continue;
    checked++;
    moved += await organizeFolder(kids, sub.id, `${category}/${sub.name}`, token, mode);
  }
  console.log(`\n   Sous-dossiers mélangés contrôlés : ${checked}/${subfolders.length}`);

  if (mode === '--plan') {
    console.log('\nℹ️  Simulation seule — aucun fichier déplacé.');
    console.log('   Pour exécuter : compte de service + partage de « assets » (Éditeur), puis :');
    console.log(`   node scripts/organize-drive.mjs --apply ${category}`);
    return;
  }

  console.log(`\n✅ ${moved} fichier(s) déplacé(s) dans « ${category} ».`);
  console.log('   → régénérer le catalogue : node scripts/scan-drive-folder.mjs --rescan <rootId> <nom> <préfixe>');
}

/**
 * Range UN dossier : ses fichiers en vrac passent dans `<dossier>/<auteur>/`
 * (auteur déduit du nom, sinon `Divers`). Jamais de suppression, jamais de
 * destination hors du dossier traité. Retourne le nombre de fichiers déplacés.
 */
async function organizeFolder(children, folderId, label, token, mode) {
  const loose = children.filter((c) => c.mimeType !== FOLDER_MIME);
  const dirs = children.filter((c) => c.mimeType === FOLDER_MIME);

  if (loose.length === 0) {
    console.log(`\n📁 ${label} — ${dirs.length} dossier(s), aucun fichier en vrac ✅`);
    return 0;
  }
  if (dirs.length === 0) {
    console.log(`\n📁 ${label} — ${loose.length} fichier(s) et aucun sous-dossier (dossier plat : laissé tel quel) ✅`);
    return 0;
  }

  // Regroupement par auteur/collection
  const groups = new Map();
  for (const f of loose) {
    const a = authorOf(f.name);
    if (!groups.has(a)) groups.set(a, []);
    groups.get(a).push(f);
  }
  const sorted = [...groups.entries()].sort((x, y) => y[1].length - x[1].length);

  console.log(`\n📁 ${label} — ${children.length} enfants (${loose.length} en vrac, ${dirs.length} dossiers)`);
  console.log('   Plan de rangement :');
  for (const [author, items] of sorted) {
    console.log(`      📁 ${label}/${author}/ ← ${items.length} fichier(s)`);
    for (const it of items.slice(0, 4)) console.log(`           • ${it.name}`);
    if (items.length > 4) console.log(`           … et ${items.length - 4} autre(s)`);
  }
  if (mode === '--plan') return 0;

  console.log('   🚚 Déplacement...');
  let moved = 0;
  for (const [author, items] of sorted) {
    const { id: destId, created } = await ensureFolder(author, folderId, token, children);
    console.log(`      ${created ? '➕ créé' : '📁 existant'} : ${label}/${author} (${destId})`);
    for (const f of items) {
      // Garde-fou : la destination doit rester à l'intérieur du dossier traité.
      if (destId === folderId) throw new Error(`garde-fou : destination = source dans ${label}`);
      const res = await driveFetch('PATCH', `files/${f.id}`, {
        token,
        params: { addParents: destId, removeParents: folderId, fields: 'id,parents' },
      });
      const data = await res.json();
      if (!res.ok) {
        console.error(`      ❌ ${f.name} : ${data.error?.message || res.status}`);
        continue;
      }
      moved++;
    }
  }
  return moved;
}

main().catch((e) => {
  console.error(`❌ ${e.message}`);
  process.exit(1);
});
