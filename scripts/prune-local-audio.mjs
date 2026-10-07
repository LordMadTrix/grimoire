#!/usr/bin/env node
/**
 * 🧹 Grimoire — Retrait des entrées audio LOCALES du catalogue céleste
 *
 * Pourquoi :
 *  - ces entrées ont des ids synthétiques (audio_music_*, audio_sfx_*) et des URL
 *    du type /assets/audio/… or `public/assets/` est gitignoré (0 fichier tracké),
 *    donc 100 % de ces liens sont morts ;
 *  - 1 146 d'entre elles sont des doublons exacts du dossier Drive « Grimoire_Audio »
 *    qui possède de vrais identifiants (et fonctionne) : l'interface affichait donc
 *    deux dossiers « 🎵 Grimoire Audio » identiques, l'un cassé.
 *
 * On conserve l'intégralité de la source Drive.
 *
 * Idempotent. Usage : node scripts/prune-local-audio.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const CATALOG = path.join(ROOT, 'public', 'drive-catalog.json');

const catalog = JSON.parse(fs.readFileSync(CATALOG, 'utf8'));
const before = catalog.files.length;
const kept = catalog.files.filter((f) => !String(f[1]).replace(/\\/g, '/').toLowerCase().startsWith('assets/audio/'));
const removed = before - kept.length;

if (removed === 0) {
  console.log('↩︎  Aucune entrée audio locale à retirer (déjà propre).');
} else {
  catalog.files = kept;
  catalog.totalFiles = kept.length;
  catalog.updated = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const backup = path.join(process.env.TEMP || process.env.TMP || '/tmp', `drive-catalog.backup-prune-${Date.now()}.json`);
  fs.copyFileSync(CATALOG, backup);
  fs.writeFileSync(CATALOG, JSON.stringify(catalog));
  console.log(`🗑️  ${removed} entrées audio locales retirées — ${before} → ${kept.length} fichiers`);
  console.log(`💾 Sauvegarde : ${backup}`);
}

const gen = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'generate-drive-fragments.mjs')], { stdio: 'inherit' });
process.exit(gen.status ?? 0);
