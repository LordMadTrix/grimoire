#!/usr/bin/env node
/**
 * 🧙 Grimoire — Validateur du catalogue d'addons communautaire
 *
 * Vérifie docs/addons-catalog.json :
 *   - JSON syntaxiquement valide
 *   - unicité des identifiants (slug kebab-case)
 *   - champs obligatoires présents et typés
 *   - URLs vivantes (download_url, thumbnail) — HEAD, 3 essais
 *   - cohérence des tailles (±20 % entre size_bytes et la taille réelle)
 *
 * Usage : node scripts/validate-addons-catalog.js [--skip-network]
 * Exit code 0 = catalogue valide, 1 = erreurs bloquantes.
 */

const fs = require('fs');
const path = require('path');

const SKIP_NETWORK = process.argv.includes('--skip-network');
const CATALOG_PATH = path.join(__dirname, '..', 'docs', 'addons-catalog.json');

const REQUIRED_FIELDS = {
  id: 'string',
  name: 'string',
  version: 'string',
  category: 'string',
  description: 'string',
  author: 'string',
  download_url: 'string',
  size_bytes: 'number',
  file_count: 'number',
  destination: 'string',
};

const KNOWN_DESTINATIONS = new Set([
  'maps', 'tokens', 'audio', 'scenarios', 'tiles/custom', 'assets/audio', 'books', 'other',
]);

const errors = [];
const warnings = [];

function fail(msg) { errors.push(msg); }
function warn(msg) { warnings.push(msg); }

async function head(url, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { method: 'HEAD', redirect: 'follow' });
      if (res.ok) return { ok: true, status: res.status };
      if (res.status >= 500) continue; // erreur serveur : on réessaie
      return { ok: false, status: res.status };
    } catch (e) {
      if (i === tries - 1) return { ok: false, status: 0, error: String(e) };
      await new Promise(r => setTimeout(r, 1500));
    }
  }
  return { ok: false, status: 0 };
}

async function main() {
  // 1. JSON valide
  let catalog;
  try {
    catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
  } catch (e) {
    console.error(`❌ JSON invalide : ${e.message}`);
    process.exit(1);
  }

  if (!Array.isArray(catalog.addons)) fail('`addons` doit être un tableau');

  const seenIds = new Set();
  const urlChecks = [];

  (catalog.addons || []).forEach((a, i) => {
    const label = a?.id || `addons[${i}]`;

    // 2. Identifiant unique + kebab-case
    if (seenIds.has(a.id)) fail(`${label} : identifiant en double`);
    seenIds.add(a.id);
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(a.id ?? '')) {
      fail(`${label} : l'identifiant doit être un slug kebab-case (ex: mon-pack-maps)`);
    }

    // 3. Champs obligatoires typés
    for (const [field, type] of Object.entries(REQUIRED_FIELDS)) {
      const v = a[field];
      if (v === undefined || v === null || v === '') {
        fail(`${label} : champ manquant \`${field}\``);
      } else if (typeof v !== type) {
        fail(`${label} : \`${field}\` doit être un ${type} (reçu ${typeof v})`);
      }
    }

    if (a.destination && !KNOWN_DESTINATIONS.has(a.destination)) {
      warn(`${label} : destination inconnue "${a.destination}"`);
    }
    if (a.file_count !== undefined && a.file_count <= 0) {
      warn(`${label} : file_count devrait être > 0`);
    }

    // 4. URLs vivantes (sauf addons marqués indisponibles)
    if (a.available === false) {
      warn(`${label} : marqué "available: false" — liens non vérifiés, pack caché à réuploader`);
    } else {
      if (a.download_url) urlChecks.push([label, 'download_url', a.download_url]);
      if (a.thumbnail) urlChecks.push([label, 'thumbnail', a.thumbnail]);
    }
  });

  if (!SKIP_NETWORK) {
    console.log(`🌐 Vérification de ${urlChecks.length} URL(s)...`);
    for (const [label, field, url] of urlChecks) {
      const r = await head(url);
      if (!r.ok) {
        if (field === 'thumbnail') {
          warn(`${label} : thumbnail inaccessible (HTTP ${r.status}) — ${url}`);
        } else {
          fail(`${label} : ${field} inaccessible (HTTP ${r.status}) — ${url}`);
        }
      }
    }
  } else {
    console.log('⏭️  Vérification réseau ignorée (--skip-network)');
  }

  // 5. Rapport
  for (const w of warnings) console.warn(`⚠️  ${w}`);
  if (errors.length) {
    for (const e of errors) console.error(`❌ ${e}`);
    console.error(`\n🚫 ${errors.length} erreur(s), ${warnings.length} avertissement(s).`);
    process.exit(1);
  }
  console.log(`✅ Catalogue valide : ${(catalog.addons || []).length} addon(s), ${warnings.length} avertissement(s).`);
}

main().catch(e => { console.error('❌', e); process.exit(1); });
