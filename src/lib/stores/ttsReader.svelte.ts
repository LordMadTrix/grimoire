// ── TTS Voice Reader Engine (IA Neuronale HD + Fallback Web Speech) ───────────
// Permet la lecture vocale fluide, ultra-réaliste et naturelle (Microsoft Azure Neural AI)
// avec surlignage de phrases en temps réel, pré-chargement en arrière-plan et
// fallback automatique sur les voix locales hors-ligne.

import { NEURAL_VOICES, synthesizeNeuralSpeech, type NeuralVoice } from '$lib/services/edgeTts';
import { clusterTextIntoNaturalSentences, formatTextForNaturalSpeech } from '$lib/services/naturalSpeech';

export interface VoiceOption {
  name: string;
  lang: string;
  isAi?: boolean;
  aiId?: string;
  personality?: string;
}

class TtsReaderStore {
  synth: SpeechSynthesis | null = null;
  
  availableVoices = $state<VoiceOption[]>([]);
  selectedVoiceName = $state<string>('fr-FR-HenriNeural'); // Voix IA Henri Narrateur par défaut
  
  isPlaying = $state<boolean>(false);
  isPaused = $state<boolean>(false);
  isLoadingAudio = $state<boolean>(false);
  rate = $state<number>(1.0);
  pitch = $state<number>(1.0);
  
  currentFullText = $state<string>('');
  sentences = $state<string[]>([]);
  currentSentenceIndex = $state<number>(-1);

  // Audio HTML5 pour les voix neuronales IA
  private currentAudio: HTMLAudioElement | null = null;
  private currentBlobUrl: string | null = null;
  private preloadedUrls = new Map<number, string>();
  private abortController: AbortController | null = null;

  constructor() {
    this.buildVoiceList();

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.synth = window.speechSynthesis;
      if (this.synth.onvoiceschanged !== undefined) {
        this.synth.onvoiceschanged = () => this.buildVoiceList();
      }
      setTimeout(() => this.buildVoiceList(), 500);
      setTimeout(() => this.buildVoiceList(), 1500);
    }
  }

  buildVoiceList() {
    const list: VoiceOption[] = [];

    // 1. Ajouter toutes les voix neuronales IA Ultra-Réalistes
    for (const nv of NEURAL_VOICES) {
      list.push({
        name: nv.name,
        lang: nv.lang,
        isAi: true,
        aiId: nv.id,
        personality: nv.personality
      });
    }

    // 2. Ajouter les voix locales de l'ordinateur (SAPI/Web Speech)
    if (this.synth) {
      const systemVoices = this.synth.getVoices() || [];
      const frVoices = systemVoices.filter(v => v.lang.toLowerCase().startsWith('fr'));
      const otherVoices = systemVoices.filter(v => !v.lang.toLowerCase().startsWith('fr'));

      for (const sv of [...frVoices, ...otherVoices]) {
        list.push({
          name: `💻 ${sv.name} (${sv.lang})`,
          lang: sv.lang,
          isAi: false
        });
      }
    }

    this.availableVoices = list;

    // Définir la voix par défaut sur Henri Narrateur IA si pas encore défini
    if (!this.selectedVoiceName || !list.some(v => v.aiId === this.selectedVoiceName || v.name === this.selectedVoiceName)) {
      this.selectedVoiceName = 'fr-FR-HenriNeural';
    }
  }

  setRate(newRate: number) {
    this.rate = Math.max(0.5, Math.min(2.0, newRate));
    if (this.currentAudio) {
      this.currentAudio.playbackRate = this.rate;
    }
  }

  setVoice(voiceKey: string) {
    this.selectedVoiceName = voiceKey;
    if (this.isPlaying && !this.isPaused) {
      const curIdx = this.currentSentenceIndex;
      this.stop();
      if (curIdx >= 0 && curIdx < this.sentences.length) {
        this.speakFromSentence(curIdx);
      }
    }
  }

  /**
   * Découpe intelligemment le texte en blocs de narration cohérents et mélodiques
   */
  splitIntoSentences(text: string): string[] {
    return clusterTextIntoNaturalSentences(text);
  }

  /**
   * Démarre la lecture vocale d'un texte ou d'une page
   */
  speakText(text: string) {
    this.stop();

    const sentences = this.splitIntoSentences(text);
    if (sentences.length === 0) return;

    this.currentFullText = text;
    this.sentences = sentences;
    this.currentSentenceIndex = 0;
    this.isPlaying = true;
    this.isPaused = false;
    this.preloadedUrls.clear();

    this.speakFromSentence(0);
  }

  private async speakFromSentence(index: number) {
    if (index >= this.sentences.length || !this.isPlaying) {
      this.stop();
      return;
    }

    this.currentSentenceIndex = index;
    const sentenceText = this.sentences[index];
    const selectedVoice = this.availableVoices.find(
      v => v.aiId === this.selectedVoiceName || v.name === this.selectedVoiceName
    );

    // ── Cas 1 : Voix Neuronale IA Ultra-Réaliste ──
    if (selectedVoice?.isAi && selectedVoice.aiId) {
      this.isLoadingAudio = true;
      try {
        let audioUrl = this.preloadedUrls.get(index);

        if (!audioUrl) {
          audioUrl = await synthesizeNeuralSpeech(sentenceText, selectedVoice.aiId, this.rate, this.pitch);
        }

        if (!this.isPlaying || this.currentSentenceIndex !== index) return;

        this.isLoadingAudio = false;
        this.cleanupAudio();

        const audio = new Audio(audioUrl);
        audio.playbackRate = this.rate;
        this.currentAudio = audio;
        this.currentBlobUrl = audioUrl;

        // Pré-charger la phrase suivante en arrière-plan pour une fluidité absolue
        if (index + 1 < this.sentences.length && !this.preloadedUrls.has(index + 1)) {
          synthesizeNeuralSpeech(this.sentences[index + 1], selectedVoice.aiId, this.rate, this.pitch)
            .then(nextUrl => {
              if (this.isPlaying) this.preloadedUrls.set(index + 1, nextUrl);
            })
            .catch(() => {});
        }

        audio.onended = () => {
          if (this.isPlaying && !this.isPaused) {
            this.speakFromSentence(index + 1);
          }
        };

        audio.onerror = (e) => {
          console.warn('Erreur lecture audio IA:', e);
          if (this.isPlaying) this.speakFromSentence(index + 1);
        };

        await audio.play();
      } catch (err) {
        console.warn('Synthèse vocale IA échouée, bascule sur voix système...', err);
        this.isLoadingAudio = false;
        // Fallback local Web Speech si pas de connexion internet
        this.speakWithWebSpeech(sentenceText, index);
      }
    } else {
      // ── Cas 2 : Voix Système Locale ──
      this.speakWithWebSpeech(sentenceText, index);
    }
  }

  private speakWithWebSpeech(sentenceText: string, index: number) {
    if (!this.synth) {
      this.stop();
      return;
    }

    const utterance = new SpeechSynthesisUtterance(sentenceText);
    utterance.rate = this.rate;
    utterance.pitch = this.pitch;
    utterance.lang = 'fr-FR';

    if (this.selectedVoiceName) {
      const all = this.synth.getVoices();
      const matched = all.find(v => v.name === this.selectedVoiceName || `💻 ${v.name} (${v.lang})` === this.selectedVoiceName);
      if (matched) {
        utterance.voice = matched;
        utterance.lang = matched.lang || 'fr-FR';
      }
    }

    utterance.onend = () => {
      if (this.isPlaying && !this.isPaused) {
        if (index + 1 < this.sentences.length) {
          this.speakFromSentence(index + 1);
        } else {
          this.stop();
        }
      }
    };

    utterance.onerror = (e) => {
      console.warn('Erreur TTS utterance:', e);
      if (this.isPlaying) {
        if (index + 1 < this.sentences.length) {
          this.speakFromSentence(index + 1);
        } else {
          this.stop();
        }
      }
    };

    if (typeof window !== 'undefined') {
      (window as any).__grimoire_tts_utterance = utterance;
    }

    try {
      this.synth.resume();
      this.synth.speak(utterance);
    } catch (e) {
      console.error('Erreur speak:', e);
    }
  }

  pause() {
    if (!this.isPlaying) return;
    this.isPaused = true;
    if (this.currentAudio) {
      this.currentAudio.pause();
    } else if (this.synth) {
      this.synth.pause();
    }
  }

  resume() {
    if (!this.isPlaying) return;
    this.isPaused = false;
    if (this.currentAudio) {
      this.currentAudio.play().catch(() => {});
    } else if (this.synth) {
      this.synth.resume();
    }
  }

  stop() {
    this.isPlaying = false;
    this.isPaused = false;
    this.isLoadingAudio = false;
    this.currentSentenceIndex = -1;

    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio = null;
    }
    this.cleanupAudio();

    if (this.synth) {
      try {
        this.synth.cancel();
      } catch {}
    }
  }

  private cleanupAudio() {
    if (this.currentBlobUrl) {
      URL.revokeObjectURL(this.currentBlobUrl);
      this.currentBlobUrl = null;
    }
  }
}

export const ttsReader = new TtsReaderStore();
