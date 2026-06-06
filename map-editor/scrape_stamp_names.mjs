/**
 * scrape_stamp_names.mjs
 * ======================
 * Scraper automatisé Playwright pour Inkarnate.
 * Ouvre le site, navigue dans toutes les catégories du catalogue de stamps,
 * intercepte les réponses réseau et construit le mapping { hash → nom_réel }.
 *
 * Usage :
 *   node scrape_stamp_names.mjs
 *   node scrape_stamp_names.mjs --headless    (sans interface graphique)
 *   node scrape_stamp_names.mjs --resume      (reprend depuis stamp_names.json existant)
 *
 * Résultat : stamp_names.json dans ce même dossier
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const HEADLESS = process.argv.includes('--headless');
const RESUME   = process.argv.includes('--resume');
const OUT_FILE = path.join(__dirname, 'stamp_names.json');

// URL du catalogue — on cible la section "stamps" directement
const INKARNATE_URL = 'https://inkarnate.com/maps';
// Délai entre chaque action (ms) pour laisser le temps aux requêtes de se faire
const ACTION_DELAY  = 800;
const SCROLL_DELAY  = 400;

// ── Charger un mapping existant si --resume ────────────────────────────────
let nameMap = {};
if (RESUME && fs.existsSync(OUT_FILE)) {
  nameMap = JSON.parse(fs.readFileSync(OUT_FILE, 'utf-8'));
  console.log(`▶️  Reprise : ${Object.keys(nameMap).length} noms déjà dans le cache`);
}

// ── Extraction du hash depuis une URL CDN ─────────────────────────────────
function extractHash(url) {
  if (!url || !url.includes('cdn2.inkarnate.com')) return null;
  const m = url.match(/\/([a-zA-Z0-9]{10,})(?:\?.*)?$/);
  return m ? m[1] : null;
}

// ── Extraction récursive des paires { hash, name } depuis un objet JSON ────
function extractFromObject(obj, depth = 0) {
  if (depth > 12 || !obj || typeof obj !== 'object') return;
  if (Array.isArray(obj)) {
    for (const item of obj) extractFromObject(item, depth + 1);
    return;
  }

  const CDN_FIELDS  = ['url', 'src', 'image', 'imageUrl', 'thumbnail', 'thumbnailUrl',
                        'asset', 'assetUrl', 'iconUrl', 'icon_url', 'stamp_url'];
  const NAME_FIELDS = ['name', 'title', 'label', 'displayName', 'display_name',
                        'assetName', 'asset_name', 'stampName', 'stamp_name', 'alt'];

  let hash = null, realName = null;

  for (const f of CDN_FIELDS) {
    if (typeof obj[f] === 'string') {
      hash = extractHash(obj[f]);
      if (hash) break;
    }
  }
  for (const f of NAME_FIELDS) {
    if (typeof obj[f] === 'string' && obj[f].trim().length > 0 && obj[f].length < 200) {
      realName = obj[f].trim();
      break;
    }
  }

  if (hash && realName && !nameMap[hash]) {
    nameMap[hash] = realName;
  }

  for (const key of Object.keys(obj)) {
    if (typeof obj[key] === 'object') extractFromObject(obj[key], depth + 1);
  }
}

// ── Sauvegarde intermédiaire ───────────────────────────────────────────────
function save() {
  fs.writeFileSync(OUT_FILE, JSON.stringify(nameMap, null, 2), 'utf-8');
}

// ── Main ───────────────────────────────────────────────────────────────────
async function run() {
  console.log(`🚀 Lancement du navigateur (headless: ${HEADLESS})...`);

  const browser = await chromium.launch({
    headless: HEADLESS,
    slowMo: HEADLESS ? 0 : 50,
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36 InkarnateDesktop',
    viewport: { width: 1400, height: 900 },
  });

  const page = await context.newPage();

  // ── Intercepter toutes les réponses réseau ─────────────────────────────
  let intercepted = 0;
  page.on('response', async (response) => {
    const url = response.url();
    const ct  = response.headers()['content-type'] || '';
    if (!ct.includes('application/json')) return;
    try {
      const json = await response.json();
      const before = Object.keys(nameMap).length;
      extractFromObject(json);
      const after = Object.keys(nameMap).length;
      if (after > before) {
        intercepted++;
        const newCount = after - before;
        console.log(`  📡 ${newCount} nouveau(x) nom(s) via ${url.split('?')[0].slice(-60)}`);
        if (intercepted % 10 === 0) save();
      }
    } catch (_) {}
  });

  // ── Navigation ─────────────────────────────────────────────────────────
  console.log(`\n🌐 Ouverture de ${INKARNATE_URL}...`);
  await page.goto(INKARNATE_URL, { waitUntil: 'networkidle', timeout: 60_000 });

  // Attendre que la page soit chargée
  await page.waitForTimeout(2000);

  // Vérifier si on est sur la page de login
  const currentUrl = page.url();
  const isLoginPage = currentUrl.includes('/login') || await page.$('input[type="email"], input[name="email"]');
  if (isLoginPage) {
    console.log('\n⚠️  Page de connexion détectée.');
    console.log('   Le navigateur est ouvert — connectez-vous manuellement.');
    console.log('   Appuyez sur ENTRÉE dans ce terminal une fois connecté...');
    // Attendre que l'utilisateur appuie sur Entrée (pas de timeout)
    await waitForEnter();
    console.log('✅ Reprise du scraping...');
    await page.waitForTimeout(3000);
  }

  // Prendre un screenshot pour voir où on en est
  await page.screenshot({ path: path.join(__dirname, 'scraper_debug.png') });

  // ── Scroll sur la page actuelle pour charger les stamps ───────────────
  console.log('\n📜 Scroll de la page pour charger les assets...');
  await autoScroll(page);

  // ── Chercher et cliquer sur le panneau "Stamps" / "Library" ──────────
  console.log('\n🔍 Recherche du panneau de stamps...');
  
  // Essayer différents sélecteurs possibles pour le catalogue
  const stampPanelSelectors = [
    '[data-panel="stamps"]',
    '[aria-label*="stamp" i]',
    '[title*="stamp" i]',
    'button:has-text("Stamps")',
    'button:has-text("Library")',
    '[class*="stamp"][class*="panel"]',
    '[class*="catalog"]',
    '[class*="library"]',
  ];

  for (const sel of stampPanelSelectors) {
    try {
      const el = await page.$(sel);
      if (el) {
        console.log(`  ✅ Trouvé: ${sel}`);
        await el.click();
        await page.waitForTimeout(ACTION_DELAY);
        await autoScroll(page);
        break;
      }
    } catch (_) {}
  }

  // ── Chercher toutes les catégories cliquables ─────────────────────────
  console.log('\n🗂️  Recherche des catégories...');
  
  // Stratégie : chercher tous les éléments avec du texte qui ressemblent à des catégories
  const categoryTexts = await page.evaluate(() => {
    const results = [];
    // Chercher des boutons, divs cliquables, liens avec des noms de catégories
    const candidates = document.querySelectorAll('button, [role="button"], [role="tab"], a[href*="category"], [class*="category"], [class*="tab"]');
    candidates.forEach(el => {
      const text = el.textContent?.trim();
      if (text && text.length > 2 && text.length < 60) {
        results.push({
          text,
          tag: el.tagName,
          className: el.className?.toString().substring(0, 50),
        });
      }
    });
    return [...new Set(results.map(r => r.text))].slice(0, 50);
  });

  console.log(`  Catégories candidates trouvées: ${categoryTexts.join(' | ')}`);

  // ── Naviguer dans chaque catégorie en cliquant ────────────────────────
  for (const catText of categoryTexts) {
    try {
      const btns = await page.getByText(catText, { exact: true }).all();
      for (const btn of btns) {
        if (await btn.isVisible().catch(() => false)) {
          console.log(`\n  📂 Clic sur: "${catText}"`);
          await btn.click();
          await page.waitForTimeout(ACTION_DELAY);
          await autoScroll(page);
          await page.waitForLoadState('networkidle').catch(() => {});
          await page.waitForTimeout(500);
          break;
        }
      }
    } catch (_) {}
  }

  // ── Essayer aussi de cliquer sur les sous-catégories ─────────────────
  console.log('\n  🗂️  Exploration des sous-catégories...');
  const subCatEls = await page.$$('[class*="subcategory"], [class*="sub-category"], [class*="subcat"]');
  for (const el of subCatEls.slice(0, 50)) {
    try {
      if (await el.isVisible()) {
        await el.click();
        await page.waitForTimeout(ACTION_DELAY);
        await autoScroll(page);
        await page.waitForLoadState('networkidle').catch(() => {});
      }
    } catch (_) {}
  }

  // ── Scroll final sur la page complète ─────────────────────────────────
  console.log('\n📜 Scroll final...');
  await autoScroll(page);
  await page.waitForTimeout(2000);

  // ── Scraper le DOM pour les attributs alt/title/data-* ────────────────
  console.log('\n🔎 Scan du DOM pour les noms d\'images...');
  const domNames = await page.evaluate(() => {
    const found = {};
    document.querySelectorAll('img[src*="cdn2.inkarnate.com"]').forEach(img => {
      const m = img.src.match(/\/([a-zA-Z0-9]{10,})(?:\?.*)?$/);
      if (!m) return;
      const hash = m[1];
      const name = img.alt || img.title || img.closest('[title]')?.title
                || img.closest('[aria-label]')?.getAttribute('aria-label')
                || img.closest('[data-name]')?.getAttribute('data-name');
      if (name && name.trim().length > 0) found[hash] = name.trim();
    });
    return found;
  });

  let domCount = 0;
  for (const [hash, name] of Object.entries(domNames)) {
    if (!nameMap[hash]) { nameMap[hash] = name; domCount++; }
  }
  if (domCount > 0) console.log(`  ${domCount} noms supplémentaires depuis le DOM`);

  // ── Sauvegarde finale ─────────────────────────────────────────────────
  save();
  await page.screenshot({ path: path.join(__dirname, 'scraper_final.png') });
  await browser.close();

  const total = Object.keys(nameMap).length;
  console.log(`\n✅ Terminé ! ${total} noms collectés`);
  console.log(`📄 Sauvegardé dans : ${OUT_FILE}`);
  console.log(`\n💡 Lancez maintenant : node rename_stamps.js --dry-run`);
}

// ── Attendre que l'utilisateur appuie sur Entrée ────────────────────────────
function waitForEnter() {
  return new Promise(resolve => {
    process.stdin.resume();
    process.stdin.setEncoding('utf-8');
    process.stdin.once('data', () => {
      process.stdin.pause();
      resolve();
    });
  });
}

// ── Auto-scroll pour déclencher le lazy loading ───────────────────────────
async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise(resolve => {
      let totalHeight = 0;
      const distance  = 300;
      const timer = setInterval(() => {
        window.scrollBy(0, distance);
        totalHeight += distance;
        if (totalHeight >= document.body.scrollHeight) {
          clearInterval(timer);
          window.scrollTo(0, 0);
          resolve();
        }
      }, 100);
    });
  }).catch(() => {});
  await page.waitForTimeout(SCROLL_DELAY);
}

run().catch(err => {
  console.error('❌ Erreur fatale:', err.message);
  save(); // Sauvegarder quand même ce qu'on a
  process.exit(1);
});
