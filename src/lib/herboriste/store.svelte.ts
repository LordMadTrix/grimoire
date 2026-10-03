import type { Plant, Creature } from './types/herb';
import type { Gem } from './types/gem';
import { INITIAL_PLANTS } from './data/herbalistData';
import { INITIAL_CREATURES } from './data/bestiaryData';
import { GEMS_LIST } from './data/gemData';

export interface HerboSharePayload {
  type: 'plant' | 'gem' | 'potion' | 'poison' | 'jewelry' | 'surge';
  item: any;
  isMystery?: boolean;
  gmNotes?: string;
  clues?: string[];
}

function loadCustomPlants(): Plant[] {
  try {
    const saved = localStorage.getItem('dnd_herbalist_custom_plants');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed.filter((p: Plant) => p.custom);
    }
  } catch (e) {
    console.error('Error loading saved plants', e);
  }
  return [];
}

function loadCustomCreatures(): Creature[] {
  try {
    const saved = localStorage.getItem('dnd_herbalist_custom_creatures');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed.filter((c: Creature) => c.custom);
    }
  } catch (e) {
    console.error('Error loading saved creatures', e);
  }
  return [];
}

function loadFavorites(key: string, fallback: string[]): string[] {
  try {
    const saved = localStorage.getItem(key);
    if (saved) return JSON.parse(saved);
  } catch (e) {
    console.error('Error loading favorites', e);
  }
  return fallback;
}

function createHerboristeStore() {
  let customPlants = $state<Plant[]>(loadCustomPlants());
  let customCreatures = $state<Creature[]>(loadCustomCreatures());
  let favoritePlantIds = $state<string[]>(loadFavorites('dnd_herbalist_favorite_plants', ['athelas', 'lotus_dor', 'fleur_de_lune']));
  let favoriteCreatureIds = $state<string[]>(loadFavorites('dnd_herbalist_favorite_creatures', ['dragon_vert', 'loup_garou']));
  let selectedPlant = $state<Plant | null>(null);
  let selectedCreatureId = $state<string | null>(null);
  let selectedGemId = $state<string | null>(null);
  let isAddModalOpen = $state(false);
  let handoutItem = $state<{ type: 'plant' | 'gem'; item: any } | null>(null);
  let shareModalItem = $state<HerboSharePayload | null>(null);

  const plants = $derived<Plant[]>([...customPlants, ...INITIAL_PLANTS]);
  const creatures = $derived<Creature[]>([...customCreatures, ...INITIAL_CREATURES]);

  return {
    get plants() { return plants; },
    get customPlants() { return customPlants; },
    get creatures() { return creatures; },
    get customCreatures() { return customCreatures; },
    get favoritePlantIds() { return favoritePlantIds; },
    get favoriteCreatureIds() { return favoriteCreatureIds; },
    get selectedPlant() { return selectedPlant; },
    set selectedPlant(p: Plant | null) { selectedPlant = p; },
    get selectedCreatureId() { return selectedCreatureId; },
    set selectedCreatureId(id: string | null) { selectedCreatureId = id; },
    get selectedGemId() { return selectedGemId; },
    set selectedGemId(id: string | null) { selectedGemId = id; },
    get isAddModalOpen() { return isAddModalOpen; },
    set isAddModalOpen(v: boolean) { isAddModalOpen = v; },
    get handoutItem() { return handoutItem; },
    set handoutItem(item: { type: 'plant' | 'gem'; item: any } | null) { handoutItem = item; },
    get gems(): Gem[] { return GEMS_LIST; },
    get currentMoonPhase(): string { return 'Pleine Lune'; },
    get satchel(): { plantId: string; plantName: string; quantity: number }[] { return []; },
    get shareModalItem() { return shareModalItem; },
    set shareModalItem(item: HerboSharePayload | null) { shareModalItem = item; },

    openShareModal(type: HerboSharePayload['type'], item: any, isMystery: boolean = false) {
      shareModalItem = { type, item, isMystery };
    },

    addCustomPlant(plant: Plant) {
      customPlants = [...customPlants, plant];
      try {
        localStorage.setItem('dnd_herbalist_custom_plants', JSON.stringify(customPlants));
      } catch (e) {
        console.error('Error saving custom plants', e);
      }
    },

    addCustomCreature(creature: Creature) {
      customCreatures = [creature, ...customCreatures];
      try {
        localStorage.setItem('dnd_herbalist_custom_creatures', JSON.stringify(customCreatures));
      } catch (e) {
        console.error('Error saving custom creatures', e);
      }
    },

    toggleFavoritePlant(id: string) {
      favoritePlantIds = favoritePlantIds.includes(id)
        ? favoritePlantIds.filter(f => f !== id)
        : [...favoritePlantIds, id];
      try {
        localStorage.setItem('dnd_herbalist_favorite_plants', JSON.stringify(favoritePlantIds));
      } catch (e) {
        console.error('Error saving favorite plants', e);
      }
    },

    toggleFavoriteCreature(id: string) {
      favoriteCreatureIds = favoriteCreatureIds.includes(id)
        ? favoriteCreatureIds.filter(f => f !== id)
        : [...favoriteCreatureIds, id];
      try {
        localStorage.setItem('dnd_herbalist_favorite_creatures', JSON.stringify(favoriteCreatureIds));
      } catch (e) {
        console.error('Error saving favorite creatures', e);
      }
    },
  };
}

export const herboristeStore = createHerboristeStore();
