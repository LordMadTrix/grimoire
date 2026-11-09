// ── Voice Profiles Store & Manager (Grimoire Custom Voices) ──────────────────
// Gère la création, modification, suppression et détection intelligente des profils
// de voix IA personnalisés avec modulation de hauteur (pitch) et vitesse (rate).

import { NEURAL_VOICES, synthesizeNeuralSpeech } from '$lib/services/edgeTts';

export interface CustomVoiceProfile {
  id: string;
  name: string;
  emoji: string;
  baseVoiceId: string;
  rate: number;   // Multiplicateur de vitesse (0.6x à 1.5x)
  pitch: number;  // Multiplicateur de pitch (0.5x à 1.5x -> -50Hz à +50Hz)
  description: string;
  keywords: string[];
  isBuiltin?: boolean;
}

export const DEFAULT_VOICE_PROFILES: CustomVoiceProfile[] = [
  {
    id: 'narrator',
    name: 'Henri (Narrateur Fantastique)',
    emoji: '🧙‍♂️',
    baseVoiceId: 'fr-FR-HenriNeural',
    rate: 1.0,
    pitch: 1.0,
    description: 'Voix posée et immersive, idéale pour le récit et les descriptions d\'ambiance.',
    keywords: ['narrateur', 'description', 'récit', 'ambiance', 'lore'],
    isBuiltin: true
  },
  {
    id: 'epic_female',
    name: 'Denise (Conteuse Épique)',
    emoji: '🧝‍♀️',
    baseVoiceId: 'fr-FR-DeniseNeural',
    rate: 1.0,
    pitch: 1.0,
    description: 'Voix douce, captivante et solennelle.',
    keywords: ['conteuse', 'femme', 'dame', 'châtelaine', 'duchesse'],
    isBuiltin: true
  },
  {
    id: 'mage_female',
    name: 'Éloïse (Magicienne & Mystique)',
    emoji: '🔮',
    baseVoiceId: 'fr-FR-EloiseNeural',
    rate: 1.05,
    pitch: 1.1,
    description: 'Voix jeune, vive et cristalline.',
    keywords: ['magicienne', 'sorcière', 'mage', 'sort', 'apprentie', 'illusion'],
    isBuiltin: true
  },
  {
    id: 'hero_male',
    name: 'Rémy (Héros & Aventurier)',
    emoji: '⚔️',
    baseVoiceId: 'fr-FR-RemyMultilingualNeural',
    rate: 1.0,
    pitch: 1.0,
    description: 'Voix héroïque, claire et martiale.',
    keywords: ['héros', 'aventurier', 'guerrier', 'paladin', 'combattant'],
    isBuiltin: true
  },
  {
    id: 'noble_female',
    name: 'Vivienne (Reine & Châtelaine)',
    emoji: '👑',
    baseVoiceId: 'fr-FR-VivienneMultilingualNeural',
    rate: 0.95,
    pitch: 1.0,
    description: 'Voix souveraine, royale et majestueuse.',
    keywords: ['reine', 'princesse', 'impératrice', 'haute dame', 'noble'],
    isBuiltin: true
  },
  {
    id: 'guard_male',
    name: 'Jean (Garde du Guet & Soldat)',
    emoji: '🛡️',
    baseVoiceId: 'fr-CA-JeanNeural',
    rate: 1.0,
    pitch: 0.95,
    description: 'Voix directe, robuste et disciplinée.',
    keywords: ['garde', 'soldat', 'milicien', 'capitaine', 'guet', 'sentinelle'],
    isBuiltin: true
  },
  {
    id: 'innkeeper_male',
    name: 'Antoine (Tavernier & Marchand)',
    emoji: '🍺',
    baseVoiceId: 'fr-CA-AntoineNeural',
    rate: 1.0,
    pitch: 0.95,
    description: 'Voix chaleureuse, ronde et joviale.',
    keywords: ['tavernier', 'aubergiste', 'marchand', 'commerçant', 'patron', 'hôte'],
    isBuiltin: true
  },
  {
    id: 'dark_warrior_male',
    name: 'Thierry (Nain, Orc & Guerrier Sombre)',
    emoji: '💀',
    baseVoiceId: 'fr-CA-ThierryNeural',
    rate: 0.9,
    pitch: 0.75,
    description: 'Voix rauque, très grave, bourrue et menaçante.',
    keywords: ['nain', 'orc', 'gobelin', 'barbare', 'bourru', 'brute', 'troll', 'monstre', 'grogna'],
    isBuiltin: true
  },
  {
    id: 'fairy_female',
    name: 'Sylvie (Fée & Enchanteresse)',
    emoji: '✨',
    baseVoiceId: 'fr-CA-SylvieNeural',
    rate: 1.1,
    pitch: 1.25,
    description: 'Voix féerique, aiguë et aérienne.',
    keywords: ['fée', 'pixie', 'sylphide', 'nymphe', 'esprit', 'enchanteresse'],
    isBuiltin: true
  },
  {
    id: 'druid_female',
    name: 'Charline (Prêtresse & Guérisseuse)',
    emoji: '🌿',
    baseVoiceId: 'fr-BE-CharlineNeural',
    rate: 0.95,
    pitch: 1.0,
    description: 'Voix bienveillante, douce et lumineuse.',
    keywords: ['prêtresse', 'druidesse', 'soigneuse', 'guérisseuse', 'nature', 'arbre'],
    isBuiltin: true
  },
  {
    id: 'sage_male',
    name: 'Gérard (Vieux Sage & Érudit)',
    emoji: '📜',
    baseVoiceId: 'fr-BE-GerardNeural',
    rate: 0.9,
    pitch: 0.9,
    description: 'Voix d\'ancien savant, calme, lente et posée.',
    keywords: ['vieux', 'sage', 'érudit', 'moine', 'ancien', 'savant', 'archiviste', 'vieillard'],
    isBuiltin: true
  },
  {
    id: 'ranger_female',
    name: 'Ariane (Rôdeuse & Amazone)',
    emoji: '🏹',
    baseVoiceId: 'fr-CH-ArianeNeural',
    rate: 1.05,
    pitch: 1.0,
    description: 'Voix vive, alerte et déterminée.',
    keywords: ['rôdeuse', 'chasseresse', 'amazone', 'archère', 'elfe des bois'],
    isBuiltin: true
  },
  {
    id: 'bard_male',
    name: 'Fabrice (Barde & Voyageur)',
    emoji: '🎭',
    baseVoiceId: 'fr-CH-FabriceNeural',
    rate: 1.05,
    pitch: 1.05,
    description: 'Voix narrative, enjouée, expressive et théâtrale.',
    keywords: ['barde', 'ménestrel', 'voleur', 'filou', 'jongleur', 'voyageur', 'musicien'],
    isBuiltin: true
  }
];

const STORAGE_KEY = 'grimoire_custom_voice_profiles_v1';

class VoiceProfilesStore {
  profiles = $state<CustomVoiceProfile[]>([]);
  isTesting = $state<boolean>(false);
  testingProfileId = $state<string | null>(null);
  private testAudio: HTMLAudioElement | null = null;

  constructor() {
    this.loadFromStorage();
  }

  loadFromStorage() {
    if (typeof window === 'undefined') {
      this.profiles = [...DEFAULT_VOICE_PROFILES];
      return;
    }

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.profiles = parsed;
          return;
        }
      }
    } catch (e) {
      console.warn('Erreur chargement profils de voix:', e);
    }

    this.profiles = [...DEFAULT_VOICE_PROFILES];
    this.saveToStorage();
  }

  saveToStorage() {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.profiles));
    } catch (e) {
      console.warn('Erreur sauvegarde profils de voix:', e);
    }
  }

  getVoice(idOrVoiceKey: string): CustomVoiceProfile | undefined {
    return this.profiles.find(p => p.id === idOrVoiceKey || p.baseVoiceId === idOrVoiceKey);
  }

  addVoice(voice: Omit<CustomVoiceProfile, 'id'>): CustomVoiceProfile {
    const id = `custom_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const newProfile: CustomVoiceProfile = {
      ...voice,
      id,
      isBuiltin: false
    };
    this.profiles = [...this.profiles, newProfile];
    this.saveToStorage();
    return newProfile;
  }

  updateVoice(id: string, updates: Partial<CustomVoiceProfile>) {
    this.profiles = this.profiles.map(p => {
      if (p.id === id) {
        return { ...p, ...updates };
      }
      return p;
    });
    this.saveToStorage();
  }

  deleteVoice(id: string) {
    this.profiles = this.profiles.filter(p => p.id !== id);
    this.saveToStorage();
  }

  resetToDefaults() {
    this.profiles = [...DEFAULT_VOICE_PROFILES];
    this.saveToStorage();
  }

  /**
   * Trouve le profil de voix le plus adapté selon le nom de l'orateur ou le texte
   */
  inferVoiceFor(speakerName: string, contextText = ''): CustomVoiceProfile {
    const combined = `${speakerName} ${contextText}`.toLowerCase();

    // 1. Chercher d'abord dans les voix custom si un mot-clé ou le nom match exactement
    for (const p of this.profiles) {
      if (speakerName && (p.name.toLowerCase().includes(speakerName.toLowerCase()) || speakerName.toLowerCase().includes(p.name.toLowerCase()))) {
        return p;
      }
      for (const kw of p.keywords) {
        if (kw && combined.includes(kw.toLowerCase())) {
          return p;
        }
      }
    }

    // 2. Fallback héroïque par défaut
    return this.profiles.find(p => p.id === 'hero_male') || this.profiles[0] || DEFAULT_VOICE_PROFILES[0];
  }

  /**
   * Teste en direct une voix avec ses réglages de pitch et vitesse
   */
  async testVoice(profile: CustomVoiceProfile, sampleText?: string) {
    this.stopTest();
    this.isTesting = true;
    this.testingProfileId = profile.id;

    const textToSay = sampleText || `Bonjour voyageur ! Je suis ${profile.name}. Que le destin veille sur votre quête.`;

    try {
      const audioUrl = await synthesizeNeuralSpeech(
        textToSay,
        profile.baseVoiceId,
        profile.rate,
        profile.pitch
      );

      const audio = new Audio(audioUrl);
      this.testAudio = audio;

      audio.onended = () => {
        this.isTesting = false;
        this.testingProfileId = null;
        this.testAudio = null;
        URL.revokeObjectURL(audioUrl);
      };

      audio.onerror = () => {
        this.isTesting = false;
        this.testingProfileId = null;
        this.testAudio = null;
        URL.revokeObjectURL(audioUrl);
      };

      await audio.play();
    } catch (err) {
      console.error('Erreur test voix:', err);
      this.isTesting = false;
      this.testingProfileId = null;
      this.testAudio = null;
    }
  }

  stopTest() {
    if (this.testAudio) {
      this.testAudio.pause();
      this.testAudio = null;
    }
    this.isTesting = false;
    this.testingProfileId = null;
  }
}

export const voiceProfilesStore = new VoiceProfilesStore();

