// ── TTS Voice Reader Engine (Web Speech API + Reactive Svelte 5 Store) ────────
// Permet la lecture vocale fluide, hors-ligne et gratuite de tout texte/page PDF
// avec surlignage de phrases en temps réel, réglage du débit et sélection des voix.

export interface VoiceOption {
  name: string;
  lang: string;
  isDefault: boolean;
}

class TtsReaderStore {
  synth: SpeechSynthesis | null = null;
  availableVoices = $state<VoiceOption[]>([]);
  selectedVoiceName = $state<string>('');
  
  isPlaying = $state<boolean>(false);
  isPaused = $state<boolean>(false);
  rate = $state<number>(1.0); // 0.75 à 1.5
  pitch = $state<number>(1.0);
  
  currentFullText = $state<string>('');
  sentences = $state<string[]>([]);
  currentSentenceIndex = $state<number>(-1);

  private currentUtterance: SpeechSynthesisUtterance | null = null;

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.synth = window.speechSynthesis;
      this.initVoices();
      if (this.synth.onvoiceschanged !== undefined) {
        this.synth.onvoiceschanged = () => this.initVoices();
      }
    }
  }

  private initVoices() {
    if (!this.synth) return;
    const all = this.synth.getVoices();
    if (!all || all.length === 0) return;

    // Priorité aux voix françaises puis anglaises
    const sorted = [...all].sort((a, b) => {
      const aFr = a.lang.toLowerCase().startsWith('fr');
      const bFr = b.lang.toLowerCase().startsWith('fr');
      if (aFr && !bFr) return -1;
      if (!aFr && bFr) return 1;
      return a.name.localeCompare(b.name);
    });

    this.availableVoices = sorted.map(v => ({
      name: v.name,
      lang: v.lang,
      isDefault: v.default
    }));

    if (!this.selectedVoiceName || !sorted.some(v => v.name === this.selectedVoiceName)) {
      const bestFr = sorted.find(v => v.lang.toLowerCase().startsWith('fr')) || sorted[0];
      if (bestFr) this.selectedVoiceName = bestFr.name;
    }
  }

  setRate(newRate: number) {
    this.rate = Math.max(0.5, Math.min(2.0, newRate));
    if (this.isPlaying && !this.isPaused) {
      // Reprendre à la phrase en cours avec le nouveau débit
      const curIdx = this.currentSentenceIndex;
      this.stop();
      if (curIdx >= 0 && curIdx < this.sentences.length) {
        this.speakFromSentence(curIdx);
      }
    }
  }

  setVoice(voiceName: string) {
    this.selectedVoiceName = voiceName;
    if (this.isPlaying && !this.isPaused) {
      const curIdx = this.currentSentenceIndex;
      this.stop();
      if (curIdx >= 0 && curIdx < this.sentences.length) {
        this.speakFromSentence(curIdx);
      }
    }
  }

  /**
   * Découpe un texte brut en phrases intelligentes pour le surlignage et la lecture séquentielle
   */
  splitIntoSentences(text: string): string[] {
    // Nettoyer les sauts de lignes superflus des PDF
    const clean = text
      .replace(/\r\n/g, '\n')
      .replace(/(\w)-\n(\w)/g, '$1$2') // Réparer les césures de mots de PDF
      .replace(/\n\n+/g, ' § ') // Marqueur de paragraphe
      .replace(/\n/g, ' ')
      .trim();

    if (!clean) return [];

    // Découpage par ponctuation de fin de phrase
    const rawSentences = clean.split(/(?<=[.?!;:])\s+/);
    return rawSentences
      .map(s => s.replace(/§/g, '\n\n').trim())
      .filter(s => s.length > 0);
  }

  /**
   * Démarre la lecture vocale d'un texte ou d'une page
   */
  speakText(text: string) {
    this.stop();
    if (!this.synth) {
      console.warn('SpeechSynthesis non supporté dans cet environnement.');
      return;
    }

    const sentences = this.splitIntoSentences(text);
    if (sentences.length === 0) return;

    this.currentFullText = text;
    this.sentences = sentences;
    this.currentSentenceIndex = 0;
    this.isPlaying = true;
    this.isPaused = false;

    this.speakFromSentence(0);
  }

  private speakFromSentence(index: number) {
    if (!this.synth || index >= this.sentences.length) {
      this.stop();
      return;
    }

    this.currentSentenceIndex = index;
    const sentenceText = this.sentences[index];

    const utterance = new SpeechSynthesisUtterance(sentenceText);
    utterance.rate = this.rate;
    utterance.pitch = this.pitch;

    if (this.selectedVoiceName) {
      const all = this.synth.getVoices();
      const matched = all.find(v => v.name === this.selectedVoiceName);
      if (matched) utterance.voice = matched;
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

    this.currentUtterance = utterance;
    this.synth.speak(utterance);
  }

  pause() {
    if (!this.synth || !this.isPlaying) return;
    this.synth.pause();
    this.isPaused = true;
  }

  resume() {
    if (!this.synth || !this.isPlaying) return;
    this.synth.resume();
    this.isPaused = false;
  }

  togglePlayPause(fallbackText?: string) {
    if (!this.isPlaying) {
      if (fallbackText) this.speakText(fallbackText);
    } else if (this.isPaused) {
      this.resume();
    } else {
      this.pause();
    }
  }

  stop() {
    if (this.synth) {
      this.synth.cancel();
    }
    this.isPlaying = false;
    this.isPaused = false;
    this.currentUtterance = null;
    this.currentSentenceIndex = -1;
  }
}

export const ttsReader = new TtsReaderStore();
