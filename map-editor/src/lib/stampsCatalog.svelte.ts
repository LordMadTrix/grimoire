// Chargement à la demande du catalogue de tampons (26 242 entrées, 5,7 Mo).
//
// Architecture en 3 niveaux (artefacts générés par scripts/generate-stamps-catalog.mjs) :
//  1. MANIFESTE (~18 ko) : arborescence {catégorie, sous-catégorie, nombre} —
//     chargé dès l'ouverture du catalogue pour afficher l'arbre complet.
//  2. FRAGMENTS (~35 ko pièce) : entrées complètes d'une sous-catégorie,
//     importées dynamiquement quand l'utilisateur la sélectionne.
//  3. REGISTRE (~950 ko) : id → fragment, chargé uniquement pour les
//     favoris, la recherche globale et la résolution d'un id précis.
//
// Compatibilité : `stampsCatalog.loaded` est un tableau réactif qui s'enrichit
// au fil des chargements ; les composants qui lisaient `importedStamps`
// fonctionnent avec, moyennant quelques adaptations locales.

export interface StampEntry {
  id: string;
  name: string;
  file: string;
  category: string;
  subcategory: string;
}

interface ManifestRow {
  /** Catégorie. */
  c: string;
  /** Sous-catégorie. */
  s: string;
  /** Nombre d'entrées. */
  n: number;
  /** Chemin relatif du fragment (pour import.meta.glob). */
  p: string;
}

// Tous les fragments compilés par Vite en chunks distincts (lazy chunks).
const fragmentModules = import.meta.glob('./stamps_fragments/**/*.json');

// État réactif (runes Svelte 5 — fichier .svelte.ts requis).
class StampsCatalogState {
  /** Entrées chargées jusqu'ici (fusion des fragments demandés). */
  loaded = $state<StampEntry[]>([]);
  /** Arborescence (chargée avec le manifeste). */
  tree = $state<ManifestRow[]>([]);
  indexLoading = $state(false);
  indexReady = $state(false);
  /** Clés "cat/subcat" des fragments en cours de chargement. */
  pending = $state<Record<string, boolean>>({});
  /** Clés "cat/subcat" des fragments disponibles. */
  loadedKeys = $state<Record<string, boolean>>({});
  /** Registre id → [ordinal de fragment, nom] (chargé à la demande). */
  registry = $state<Record<string, [number, string]> | null>(null);
}

export const stampsCatalog = new StampsCatalogState();

// Index mémoire id → entrée complète (fragments chargés uniquement).
const entryIndex = new Map<string, StampEntry>();

let manifestPromise: Promise<void> | null = null;
let registryPromise: Promise<Record<string, [number, string]>> | null = null;

function keyOf(cat: string, sub: string): string {
  return `${cat}/${sub}`;
}

/** Charge le manifeste (arborescence) une seule fois. */
export async function ensureStampsTree(): Promise<void> {
  if (manifestPromise) return manifestPromise;
  stampsCatalog.indexLoading = true;
  manifestPromise = (async () => {
    try {
      const mod = await import('./stamps_manifest.json');
      stampsCatalog.tree = (mod.default ?? mod) as ManifestRow[];
      stampsCatalog.indexReady = true;
    } finally {
      stampsCatalog.indexLoading = false;
    }
  })();
  return manifestPromise;
}

/** Charge le registre id → [fragment ordinal, nom] (favoris, recherche, résolution). */
export async function ensureStampsRegistry(): Promise<Record<string, [number, string]>> {
  if (stampsCatalog.registry) return stampsCatalog.registry;
  if (!registryPromise) {
    registryPromise = import('./stamps_registry.json').then(
      (mod) => {
        const reg = (mod.default ?? mod) as unknown as Record<string, [number, string]>;
        stampsCatalog.registry = reg;
        return reg;
      },
      (error) => {
        registryPromise = null;
        throw error;
      }
    );
  }
  return registryPromise;
}

/**
 * Charge les entrées d'une sous-catégorie si nécessaire. Idempotent.
 * Retourne la liste des entrées de la sous-catégorie.
 */
export async function ensureSubcategory(cat: string, sub: string): Promise<StampEntry[]> {
  await ensureStampsTree();
  const key = keyOf(cat, sub);
  if (stampsCatalog.loadedKeys[key]) {
    return stampsCatalog.loaded.filter((e) => e.category === cat && e.subcategory === sub);
  }
  if (stampsCatalog.pending[key]) {
    // Attendre le chargement en cours.
    await waitForPending(key);
    return stampsCatalog.loaded.filter((e) => e.category === cat && e.subcategory === sub);
  }

  const row = stampsCatalog.tree.find((m) => m.c === cat && m.s === sub);
  if (!row) return [];

  stampsCatalog.pending[key] = true;
  try {
    const loader = fragmentModules[row.p];
    if (!loader) {
      console.error(`Fragment de tampons introuvable : ${row.p}`);
      stampsCatalog.loadedKeys[key] = true; // éviter les re-tentatives en boucle
      return [];
    }
    const mod = (await loader()) as { default: StampEntry[] };
    const entries = mod.default ?? [];
    const existing = new Set(stampsCatalog.loaded.map((e) => e.id));
    const fresh = entries.filter((e) => !existing.has(e.id));
    for (const e of fresh) entryIndex.set(e.id, e);
    stampsCatalog.loaded = [...stampsCatalog.loaded, ...fresh];
    stampsCatalog.loadedKeys[key] = true;
    return entries;
  } finally {
    delete stampsCatalog.pending[key];
  }
}

function waitForPending(key: string): Promise<void> {
  return new Promise((resolve) => {
    const check = () => {
      if (!stampsCatalog.pending[key]) resolve();
      else setTimeout(check, 50);
    };
    check();
  });
}

/** Toutes les catégories (ordre du manifeste, alphabétique). */
export function stampsCategories(): string[] {
  return [...new Set(stampsCatalog.tree.map((m) => m.c))];
}

/** Sous-catégories d'une catégorie, avec leurs tailles. */
export function stampsSubcategories(cat: string): ManifestRow[] {
  return stampsCatalog.tree.filter((m) => m.c === cat);
}

/** Méta complète d'un tampon si son fragment est chargé, sinon undefined. */
export function getLoadedStampMeta(id: string): StampEntry | undefined {
  return entryIndex.get(id);
}

/**
 * Résout la méta d'un tampon par id, en chargeant au besoin le fragment
 * qui le contient (via le registre). Utilisé pour le tampon actif, les
 * favoris et les slots de donjon.
 */
export async function resolveStampMeta(id: string): Promise<StampEntry | undefined> {
  const local = entryIndex.get(id);
  if (local) return local;
  const reg = await ensureStampsRegistry();
  const entry = reg[id];
  if (!entry) return undefined;
  const [ordinal] = entry;
  const row = stampsCatalog.tree[ordinal];
  if (!row) return undefined;
  const list = await ensureSubcategory(row.c, row.s);
  return list.find((e) => e.id === id);
}
