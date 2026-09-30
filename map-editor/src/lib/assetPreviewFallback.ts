// Fallback de miniatures : si un asset local (texture/stamp) est absent
// (machine sans la bibliothèque d'assets téléchargée), on remplace l'image
// de fond par la miniature Google Drive fournie par le catalogue Céleste.
//
// - Sondage différé à la visibilité (IntersectionObserver) pour éviter de
//   mitrailler Google Drive avec des centaines de requêtes simultanées.
// - Chaîne à 2 étages comme la Biblio Céleste : drive.google.com/thumbnail
//   puis lh3.googleusercontent.com en secours.
// - Cache de session pour ne jamais sonder deux fois le même asset.

import type { Action } from 'svelte/action';
import { loadCelestialCatalog } from './celestialCatalog';

interface ThumbPair {
  thumb: string; // drive.google.com/thumbnail?id=…&sz=w400
  alt: string;   // lh3.googleusercontent.com/d/{id}=w400
}

let indexPromise: Promise<Map<string, ThumbPair>> | null = null;

function buildIndex(): Promise<Map<string, ThumbPair>> {
  return loadCelestialCatalog()
    .then((catalog) => {
      const index = new Map<string, ThumbPair>();
      for (const f of catalog.files) {
        // f.path est déjà nettoyé du préfixe "assets/" par parseCatalogJson
        if (f.thumbUrl) {
          index.set(f.path, {
            thumb: f.thumbUrl,
            alt: `https://lh3.googleusercontent.com/d/${f.id}=w400`
          });
        }
      }
      return index;
    })
    .catch(() => new Map<string, ThumbPair>());
}

function getIndex(): Promise<Map<string, ThumbPair>> {
  if (!indexPromise) indexPromise = buildIndex();
  return indexPromise;
}

// Cache de session : url locale -> miniature retenue, ou null si l'asset
// local existe (aucun fallback nécessaire).
const resolutionCache = new Map<string, ThumbPair | null>();

// File d'attente pour limiter la concurrence des requêtes Drive et éviter
// le rate limiting (HTTP 429) observé avec des rafales de sondes.
const MAX_CONCURRENT_PROBES = 4;
let activeProbes = 0;
const probeQueue: (() => void)[] = [];

function scheduleProbe<T>(task: () => Promise<T>): Promise<T> {
  return new Promise((resolve) => {
    const run = () => {
      activeProbes++;
      task().then(resolve, resolve).finally(() => {
        activeProbes--;
        const next = probeQueue.shift();
        if (next) next();
      });
    };
    if (activeProbes < MAX_CONCURRENT_PROBES) run();
    else probeQueue.push(run);
  });
}

function probeImage(url: string): Promise<boolean> {
  return scheduleProbe(
    () =>
      new Promise<boolean>((resolve) => {
        const img = new Image();
        img.onload = () => resolve(true);
        img.onerror = () => resolve(false);
        img.src = url;
      })
  );
}

// Observer partagé : ne sonde que les éléments qui deviennent visibles.
let sharedObserver: IntersectionObserver | null = null;
const visibleCallbacks = new WeakMap<HTMLElement, () => void>();

function getObserver(): IntersectionObserver {
  if (!sharedObserver) {
    sharedObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const cb = visibleCallbacks.get(entry.target as HTMLElement);
          if (cb) {
            visibleCallbacks.delete(entry.target as HTMLElement);
            sharedObserver!.unobserve(entry.target);
            cb();
          }
        }
      },
      { rootMargin: '300px' }
    );
  }
  return sharedObserver;
}

function applyBackground(node: HTMLElement, url: string) {
  node.style.backgroundImage = `url('${url}')`;
  node.style.backgroundSize = 'cover';
  node.style.backgroundPosition = 'center';
}

/**
 * Vérifie si l'image locale existe ; sinon applique la miniature Drive en
 * background-image sur l'élément. Utilisé en action Svelte :
 *   <div use:assetPreview={`/assets/textures/${file}`}></div>
 */
export const assetPreview: Action<HTMLElement, string> = (node, localUrl) => {
  let probeId = 0;
  let currentUrl = localUrl ?? '';

  async function applyFallback(url: string) {
    const index = await getIndex();
    // Normaliser comme parseCatalogJson : sans slashes initiaux ni préfixe "assets/"
    const clean = url.replace(/^\/+/, '').replace(/^assets\//, '');
    const pair = index.get(clean);
    if (!pair) return;
    resolutionCache.set(url, pair);
    // Essai 1 : miniature officielle ; essai 2 : CDN lh3 direct.
    if (await probeImage(pair.thumb)) {
      applyBackground(node, pair.thumb);
    } else if (await probeImage(pair.alt)) {
      applyBackground(node, pair.alt);
    }
  }

  function probe(url: string) {
    const id = ++probeId;
    const cached = resolutionCache.get(url);
    if (cached !== undefined) {
      if (cached) applyBackground(node, cached.thumb);
      return;
    }
    // Attendre que l'élément soit (bientôt) visible avant toute requête.
    visibleCallbacks.set(node, () => {
      if (id !== probeId) return;
      const img = new Image();
      img.onload = () => { resolutionCache.set(url, null); };
      img.onerror = () => {
        if (id !== probeId) return;
        void applyFallback(url);
      };
      img.src = url;
    });
    getObserver().observe(node);
  }

  probe(currentUrl);

  return {
    update(newUrl: string) {
      if (newUrl === currentUrl) return;
      currentUrl = newUrl;
      // Restaurer le fond local (le template le fait aussi, mais garantit
      // l'ordre après un éventuel fallback précédent).
      node.style.backgroundImage = `url('${newUrl}')`;
      node.style.backgroundSize = '';
      node.style.backgroundPosition = '';
      probe(newUrl);
    },
    destroy() {
      probeId++;
      visibleCallbacks.delete(node);
      sharedObserver?.unobserve(node);
    }
  };
};
