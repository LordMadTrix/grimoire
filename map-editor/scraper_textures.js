// Script d'extraction des textures Inkarnate v1 (Console Chrome)
(async function() {
  let scrollContainer = null;
  const elements = document.querySelectorAll('*');
  for (const el of elements) {
    const style = window.getComputedStyle(el);
    const hasScrollStyle = style.overflowY === 'auto' || style.overflowY === 'scroll';
    const isClassNameString = typeof el.className === 'string';
    const matchesKeyword = isClassNameString && (
      el.className.includes('catalog') || 
      el.className.includes('grid') || 
      el.className.includes('list')
    );
    
    if ((hasScrollStyle || matchesKeyword) && el.scrollHeight > el.clientHeight) {
      if (!scrollContainer || el.scrollHeight > scrollContainer.scrollHeight) {
        scrollContainer = el;
      }
    }
  }

  if (!scrollContainer) {
    scrollContainer = document.querySelector('[class*="modal"], [class*="catalog"], [class*="grid"]');
    if (!scrollContainer || scrollContainer.scrollHeight <= scrollContainer.clientHeight) {
      scrollContainer = document.documentElement;
    }
  }

  console.log("🚀 Lancement de l'extraction des textures...");
  
  const textureDataMap = new Map();
  
  let currentCategory = "Importés";
  let currentSubcategory = "Général";
  let lastLoggedHeader = "";

  const MAIN_CATEGORIES = [
    'Sci-Fi Battlemaps',
    'Fantasy Regional',
    'Fantasy Battlemaps',
    'Watercolor Battlemaps',
    'Watercolor Cities',
    'Fantasy World',
    'Battlemaps Classic',
    'Parchment World'
  ];

  function cleanPrefix(txt) {
    return txt.replace(/\s+/g, ' ').trim().replace(/^[▼▲v>\s\-\/]+/g, '');
  }

  function parseHeader(txt) {
    const clean = cleanPrefix(txt);
    
    // Détecter si la ligne contient le format de quantité d'assets comme "(12 Assets)"
    if (!clean.includes('Assets')) return null;

    // Extraire la quantité (ex: "(12 Assets)")
    const countMatch = clean.match(/\((\d+)\s+Assets\)/);
    if (!countMatch) return null;

    const fullTitle = clean.substring(0, countMatch.index).trim();
    
    // Trouver le préfixe correspondant à une catégorie principale connue
    for (const mainCat of MAIN_CATEGORIES) {
      if (fullTitle.startsWith(mainCat)) {
        const sub = fullTitle.substring(mainCat.length).trim().replace(/^[▼▲v>\s\-\/]+/g, '');
        return {
          category: mainCat,
          subcategory: sub || "Général"
        };
      }
    }

    // Fallback si la catégorie n'est pas dans la liste principale
    const parts = fullTitle.split('/');
    if (parts.length >= 2) {
      return {
        category: parts[0].trim(),
        subcategory: parts[1].trim().replace(/^[▼▲v>\s\-\/]+/g, '')
      };
    }

    // Si c'est le pack "Importés" par défaut d'Inkarnate
    if (fullTitle.toLowerCase().includes('import')) {
      return {
        category: "Importés",
        subcategory: "Général"
      };
    }

    return null; // Retourner null pour ignorer les div parents bruyants
  }

  let lastLoggedHeaders = new Set();

  function collectData() {
    // 1. Trouver les en-têtes actuellement chargés dans le DOM
    const allElements = scrollContainer.querySelectorAll('*');
    const headers = [];
    allElements.forEach(el => {
      const txt = el.textContent || '';
      if (txt.includes('Assets') && txt.length < 150) {
        const parsed = parseHeader(txt);
        if (parsed) {
          headers.push({ el: el, meta: parsed });
        }
      }
    });

    // Logger les nouveaux packs détectés
    headers.forEach(h => {
      const headerStr = `${h.meta.category} / ${h.meta.subcategory}`;
      if (!lastLoggedHeaders.has(headerStr)) {
        console.log(`📁 Pack détecté : ${headerStr}`);
        lastLoggedHeaders.add(headerStr);
      }
    });

    // 2. Parcourir tous les éléments pour trouver les vignettes de texture
    allElements.forEach(el => {
      let isThumbnail = false;
      let url = "";

      // Vérifier backgroundImage (sur l'élément et ses pseudo-éléments)
      const stylesToCheck = [
        window.getComputedStyle(el),
        window.getComputedStyle(el, '::before'),
        window.getComputedStyle(el, '::after')
      ];

      for (const style of stylesToCheck) {
        const bg = style.backgroundImage || '';
        if (bg && bg !== 'none' && bg.includes('inkarnate.com')) {
          const match = bg.match(/url\("?([^"\)]+)"?\)/);
          if (match) {
            url = match[1];
            isThumbnail = true;
            break;
          }
        }
      }

      // Vérifier balise IMG
      if (!isThumbnail && el.tagName === 'IMG') {
        const src = el.src || '';
        if (src && src.includes('inkarnate.com')) {
          url = src;
          isThumbnail = true;
        }
      }

      if (isThumbnail && url) {
        // Trouver l'en-tête le plus proche qui précède cette vignette
        let closestMeta = { category: "Importés", subcategory: "Général" };
        for (const h of headers) {
          const position = h.el.compareDocumentPosition(el);
          if (position & Node.DOCUMENT_POSITION_FOLLOWING) {
            closestMeta = h.meta;
          } else {
            break;
          }
        }
        
        if (!textureDataMap.has(url)) {
          textureDataMap.set(url, closestMeta);
        }
      }
    });
  }

  // Défilement pas-à-pas de l'élément scrollable
  const step = 800;
  const delay = 120;
  let currentScroll = 0;
  
  while (currentScroll < scrollContainer.scrollHeight) {
    scrollContainer.scrollTop = currentScroll;
    collectData();
    await new Promise(resolve => setTimeout(resolve, delay));
    currentScroll += step;
    
    if (currentScroll % 8000 === 0) {
      console.log(`Progression : ${Math.round((currentScroll / scrollContainer.scrollHeight) * 100)}% | ${textureDataMap.size} textures classées.`);
    }
  }

  scrollContainer.scrollTop = 0;
  collectData();

  const results = [];
  textureDataMap.forEach((meta, url) => {
    results.push({
      url: url,
      category: meta.category,
      subcategory: meta.subcategory
    });
  });

  if (results.length === 0) {
    console.log("❌ Aucune texture trouvée. Ouvrez le catalogue de textures avant de lancer le script.");
    return;
  }

  console.log(`\n✅ Réussite ! ${results.length} textures extraites avec leurs catégories.`);
  
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(results, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", "inkarnate_textures.json");
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
  console.log("📥 Le fichier 'inkarnate_textures.json' structuré a été téléchargé.");
})();
