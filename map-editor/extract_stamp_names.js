/**
 * SCRIPT CONSOLE INKARNATE — Extraction des noms réels des assets
 * ================================================================
 * À coller dans la console DevTools du navigateur sur https://electron.inkarnate.com/maps
 * (ou sur inkarnate.com, dans la section catalogue/library)
 *
 * Ce script intercepte toutes les réponses des requêtes réseau
 * et extrait les paires { hash_cdn → nom_réel }.
 *
 * Résultat : copier le JSON affiché dans la console, le sauvegarder
 * sous le nom "stamp_names.json" dans le dossier map-editor.
 */

(function () {
  const nameMap = {}; // { "hash": "Nom Réel" }
  let interceptCount = 0;

  // ── 1. Intercepter fetch ──────────────────────────────────────────────
  const originalFetch = window.fetch;
  window.fetch = async function (...args) {
    const response = await originalFetch.apply(this, args);
    const clone = response.clone();
    clone.json().then(data => {
      extractNames(data);
    }).catch(() => {});
    return response;
  };

  // ── 2. Intercepter XMLHttpRequest ─────────────────────────────────────
  const originalXHROpen = XMLHttpRequest.prototype.open;
  const originalXHRSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this._url = url;
    return originalXHROpen.apply(this, [method, url, ...rest]);
  };
  XMLHttpRequest.prototype.send = function (...args) {
    this.addEventListener('load', function () {
      try {
        const data = JSON.parse(this.responseText);
        extractNames(data);
      } catch (e) {}
    });
    return originalXHRSend.apply(this, args);
  };

  // ── 3. Extraction récursive des noms depuis n'importe quel JSON ───────
  function extractNames(obj, depth = 0) {
    if (depth > 10 || !obj || typeof obj !== 'object') return;

    if (Array.isArray(obj)) {
      obj.forEach(item => extractNames(item, depth + 1));
      return;
    }

    // Cherche un champ "url" ou "src" contenant cdn2.inkarnate.com
    // + un champ "name", "title", "label", "displayName" au même niveau
    const cdnFields = ['url', 'src', 'image', 'imageUrl', 'thumbnail', 'thumbnailUrl', 'asset', 'assetUrl'];
    const nameFields = ['name', 'title', 'label', 'displayName', 'display_name', 'assetName', 'asset_name', 'stampName', 'stamp_name'];

    let foundHash = null;
    let foundName = null;

    for (const field of cdnFields) {
      if (typeof obj[field] === 'string' && obj[field].includes('cdn2.inkarnate.com')) {
        const match = obj[field].match(/\/([a-zA-Z0-9]+)(?:\?.*)?$/);
        if (match) {
          foundHash = match[1];
          break;
        }
      }
    }

    for (const field of nameFields) {
      if (typeof obj[field] === 'string' && obj[field].trim().length > 0) {
        foundName = obj[field].trim();
        break;
      }
    }

    if (foundHash && foundName) {
      if (!nameMap[foundHash]) {
        nameMap[foundHash] = foundName;
        interceptCount++;
        if (interceptCount % 50 === 0) {
          console.log(`[Inkarnate Extractor] ${interceptCount} noms collectés...`);
        }
      }
    }

    // Parcourir les sous-objets
    for (const key of Object.keys(obj)) {
      if (typeof obj[key] === 'object') {
        extractNames(obj[key], depth + 1);
      }
    }
  }

  // ── 4. Scanner le DOM existant (balises img avec alt/title) ──────────
  function scanDOM() {
    let domCount = 0;
    document.querySelectorAll('img[src*="cdn2.inkarnate.com"]').forEach(img => {
      const match = img.src.match(/\/([a-zA-Z0-9]+)(?:\?.*)?$/);
      if (!match) return;
      const hash = match[1];
      const name = img.alt || img.title || img.getAttribute('data-name') || img.getAttribute('aria-label');
      if (name && name.trim().length > 0 && !nameMap[hash]) {
        nameMap[hash] = name.trim();
        domCount++;
      }
      // Chercher un label proche dans le DOM
      const parent = img.closest('[title], [aria-label], [data-name]');
      if (parent && !nameMap[hash]) {
        const parentName = parent.getAttribute('title') || parent.getAttribute('aria-label') || parent.getAttribute('data-name');
        if (parentName && parentName.trim().length > 0) {
          nameMap[hash] = parentName.trim();
          domCount++;
        }
      }
    });

    // Chercher aussi dans les divs/spans avec data-* attributes
    document.querySelectorAll('[data-stamp-id], [data-asset-id], [data-id]').forEach(el => {
      const id = el.getAttribute('data-stamp-id') || el.getAttribute('data-asset-id') || el.getAttribute('data-id');
      const name = el.getAttribute('data-name') || el.textContent?.trim();
      if (id && name && name.length < 100) {
        if (!nameMap[id]) {
          nameMap[id] = name;
          domCount++;
        }
      }
    });

    if (domCount > 0) {
      console.log(`[Inkarnate Extractor] ${domCount} noms trouvés dans le DOM`);
    }
  }

  // ── 5. Observer les changements DOM (chargement lazy) ────────────────
  const observer = new MutationObserver(() => scanDOM());
  observer.observe(document.body, { childList: true, subtree: true });

  // Scan initial
  scanDOM();

  // ── 6. Commandes disponibles dans la console ──────────────────────────
  window.__inkarnateExtractor = {
    // Affiche le mapping actuel
    show() {
      console.log(`Total: ${Object.keys(nameMap).length} noms collectés`);
      console.log(nameMap);
    },
    // Exporte le JSON à copier
    export() {
      const json = JSON.stringify(nameMap, null, 2);
      console.log('=== COPIER LE JSON CI-DESSOUS ===');
      console.log(json);
      console.log('=================================');
      // Essaye aussi de le copier dans le presse-papier
      try {
        navigator.clipboard.writeText(json).then(() => {
          console.log('✅ JSON copié dans le presse-papier !');
        });
      } catch (e) {
        console.log('⚠️ Copie automatique échouée — copier manuellement ci-dessus');
      }
      return json;
    },
    // Affiche les stats
    stats() {
      console.log(`Noms collectés: ${Object.keys(nameMap).length}`);
      console.log(`Interceptions réseau: ${interceptCount}`);
    }
  };

  console.log('%c[Inkarnate Extractor] Activé ✅', 'color: #4CAF50; font-weight: bold; font-size: 14px');
  console.log('Naviguez dans le catalogue Inkarnate pour collecter les noms.');
  console.log('Commandes disponibles:');
  console.log('  __inkarnateExtractor.show()   → voir les noms collectés');
  console.log('  __inkarnateExtractor.export() → copier le JSON');
  console.log('  __inkarnateExtractor.stats()  → voir les statistiques');
})();
