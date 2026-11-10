// ── Store du Dérouleur de Scènes de Session MJ (v0.8.19) ─────────
import { vttStore } from './vtt.svelte';
import { notifStore } from './notifications.svelte';
import { getVaultPath } from './vault.svelte';
import { readFile, writeFile } from '$lib/api';

export interface PreparedScene {
  id: string;
  name: string;
  mapImage?: string;
  weather: 'none' | 'rain' | 'snow' | 'fog' | 'storm' | 'embers';
  lighting: 'day' | 'dusk' | 'night' | 'pitch_black';
  audioAtmosphere?: string;
  notes?: string;
  narrationPrompt?: string;
}

const DEFAULT_SCENES: PreparedScene[] = [
  {
    id: 'scene-1',
    name: '1. 🍻 Halte à l\'Auberge',
    weather: 'none',
    lighting: 'dusk',
    audioAtmosphere: 'taverne',
    notes: 'Les aventuriers se reposent auprès de l\'âtre. Un voyageur encapuchonné les observe depuis l\'alcôve nord.'
  },
  {
    id: 'scene-2',
    name: '2. 🌲 Embuscade dans la Forêt Sombre',
    weather: 'fog',
    lighting: 'dusk',
    audioAtmosphere: 'foret',
    notes: 'Des bruits de pas furtifs résonnent entre les arbres moussus. 3 gobelins archers sont postés en embuscade.'
  },
  {
    id: 'scene-3',
    name: '3. ⚡ Assaut sous l\'Orage',
    weather: 'storm',
    lighting: 'night',
    audioAtmosphere: 'tempete',
    notes: 'Le tonnerre gronde, des éclairs illuminent les créneaux en ruine. L\'eau ruisselle sur les pavés glissants.'
  },
  {
    id: 'scene-4',
    name: '4. 🦇 Donjon des Oubliés',
    weather: 'none',
    lighting: 'pitch_black',
    audioAtmosphere: 'donjon',
    notes: 'L\'air est lourd et vicié. Les torches crépitent faiblement révélant des ossements récents.'
  }
];

let scenes = $state<PreparedScene[]>(DEFAULT_SCENES);
let activeSceneId = $state<string | null>(null);
let isOpen = $state<boolean>(false);

export const sceneRunnerStore = {
  get scenes() { return scenes; },
  get activeSceneId() { return activeSceneId; },
  get activeScene() { return scenes.find(s => s.id === activeSceneId) || null; },
  get isOpen() { return isOpen; },

  toggle() { isOpen = !isOpen; },
  open() { isOpen = true; },
  close() { isOpen = false; },

  addScene(scene: Omit<PreparedScene, 'id'>) {
    const newScene: PreparedScene = {
      ...scene,
      id: 'scene-' + Date.now().toString(36)
    };
    scenes.push(newScene);
    sceneRunnerStore.saveToVault();
  },

  updateScene(id: string, partial: Partial<PreparedScene>) {
    const idx = scenes.findIndex(s => s.id === id);
    if (idx !== -1) {
      scenes[idx] = { ...scenes[idx], ...partial };
      sceneRunnerStore.saveToVault();
    }
  },

  deleteScene(id: string) {
    scenes = scenes.filter(s => s.id !== id);
    if (activeSceneId === id) activeSceneId = null;
    sceneRunnerStore.saveToVault();
  },

  activateScene(scene: PreparedScene) {
    activeSceneId = scene.id;

    // 1. Appliquer Météo & Éclairage VTT
    if (scene.weather) {
      vttStore.weather = scene.weather;
    }
    if (scene.lighting) {
      vttStore.ambientLight = scene.lighting;
    }

    // 2. Changer de carte VTT si spécifiée
    if (scene.mapImage && vttStore.currentMap !== scene.mapImage) {
      vttStore.currentMap = scene.mapImage;
    }

    // 3. Déclencher l'acoustique adaptée
    if (scene.audioAtmosphere === 'donjon' || scene.weather === 'storm') {
      vttStore.acousticsPreset = 'cave';
    } else {
      vttStore.acousticsPreset = 'normal';
    }

    notifStore.add('🎬', scene.name, 'Scène lancée ! Météo, éclairage et décors synchronisés.', 'success', 3500);
  },

  nextScene() {
    if (scenes.length === 0) return;
    const curIdx = scenes.findIndex(s => s.id === activeSceneId);
    const nextIdx = (curIdx + 1) % scenes.length;
    sceneRunnerStore.activateScene(scenes[nextIdx]);
  },

  prevScene() {
    if (scenes.length === 0) return;
    const curIdx = scenes.findIndex(s => s.id === activeSceneId);
    const prevIdx = (curIdx - 1 + scenes.length) % scenes.length;
    sceneRunnerStore.activateScene(scenes[prevIdx]);
  },

  async loadFromVault() {
    const vp = getVaultPath();
    if (!vp) return;
    try {
      const content = await readFile(vp, '.grimoire/scenes.json');
      if (content) {
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed) && parsed.length > 0) {
          scenes = parsed;
        }
      }
    } catch {
      // Utiliser les scènes par défaut
    }
  },

  async saveToVault() {
    const vp = getVaultPath();
    if (!vp) return;
    try {
      await writeFile(vp, '.grimoire/scenes.json', JSON.stringify(scenes, null, 2));
    } catch (e) {
      console.warn('Impossible de sauvegarder scenes.json:', e);
    }
  }
};
