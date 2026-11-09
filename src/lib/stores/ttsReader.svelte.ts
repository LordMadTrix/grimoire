// ── TTS Voice Reader Engine (Multi-Voix PNJ + Auto-Ducking Ambiance) ────────
// Permet la lecture vocale fluide, ultra-réaliste et naturelle (Microsoft Azure Neural AI)
// avec alternance automatique Narrateur / Dialogues PNJ, synchronisation avec le mixeur
// d'ambiance sonore (Auto-Ducking) et surlignage interactif en temps réel.

import { NEURAL_VOICES, synthesizeNeuralSpeech, type NeuralVoice } from '$lib/services/edgeTts';
import { clusterTextIntoNaturalSentences, formatTextForNaturalSpeech } from '$lib/services/naturalSpeech';
import { parseMultiVoiceSegments, type NarrationSegment } from '$lib/services/dialogueParser';
import { ambianceStore } from '$lib/stores/ambianceStore.svelte';
import { soundscape } from '$lib/stores/soundscape.svelte';
import { voiceProfilesStore } from '$lib/stores/voiceProfiles.svelte';
import { audioAcoustics } from '$lib/services/audioAcoustics';
import { vttStore, showSpeechBubble, clearSpeechBubble } from '$lib/stores/vtt.svelte';

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
  selectedVoiceName = $state<string>('fr-FR-HenriNeural'); // Voix Narrateur par défaut
  isMultiVoiceEnabled = $state<boolean>(true); // Mode dialogue multi-acteurs activé par défaut
  
  isPlaying = $state<boolean>(false);
  isPaused = $state<boolean>(false);
  isLoadingAudio = $state<boolean>(false);
  rate = $state<number>(1.0);
  pitch = $state<number>(1.0);
  
  currentFullText = $state<string>('');
  sentences = $state<string[]>([]);
  segments = $state<NarrationSegment[]>([]);
  currentSentenceIndex = $state<number>(-1);
  currentSpeakerName = $state<string>('🧙‍♂️ Narrateur');
  currentSpeakerEmoji = $state<string>('🧙‍♂️');

  // Audio HTML5 pour les voix neuronales IA
  private currentAudio: HTMLAudioElement | null = null;
  private currentBlobUrl: string | null = null;
  private preloadedUrls = new Map<number, string>();

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

    // 1. Ajouter tous les profils de voix personnalisés et archétypes MJ
    for (const vp of voiceProfilesStore.profiles) {
      list.push({
        name: `${vp.emoji} ${vp.name}`,
        lang: 'fr-FR',
        isAi: true,
        aiId: vp.id,
        personality: vp.description
      });
    }

    // 2. Ajouter les voix neuronales brutes si elles ne sont pas déjà sous forme de profil
    for (const nv of NEURAL_VOICES) {
      if (!list.some(v => v.aiId === nv.id)) {
        list.push({
          name: nv.name,
          lang: nv.lang,
          isAi: true,
          aiId: nv.id,
          personality: nv.personality
        });
      }
    }

    // 3. Ajouter les voix locales de l'ordinateur (SAPI/Web Speech)
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

    if (!this.selectedVoiceName || !list.some(v => v.aiId === this.selectedVoiceName || v.name === this.selectedVoiceName)) {
      this.selectedVoiceName = 'narrator';
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
        // stop() vient de remettre isPlaying à false ; speakFromSentence() s'arrête
        // immédiatement si !isPlaying, donc il faut le remettre à true pour reprendre.
        this.isPlaying = true;
        this.speakFromSentence(curIdx);
      }
    }
  }

  toggleMultiVoice() {
    this.isMultiVoiceEnabled = !this.isMultiVoiceEnabled;
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

    if (this.isMultiVoiceEnabled) {
      // Mode Multi-Voix : Découper en segments de rôles (Narrateur vs PNJ)
      const parsedSegments = parseMultiVoiceSegments(text, this.selectedVoiceName);
      if (parsedSegments.length === 0) return;

      this.segments = parsedSegments;
      this.sentences = parsedSegments.map(s => s.text);
    } else {
      // Mode Simple Voix
      const s = this.splitIntoSentences(text);
      if (s.length === 0) return;
      this.sentences = s;
      this.segments = s.map(txt => ({
        text: txt,
        isDialogue: false,
        speakerName: 'Narrateur',
        voiceId: this.selectedVoiceName,
        voiceEmoji: '🧙‍♂️'
      }));
    }

    this.currentFullText = text;
    this.currentSentenceIndex = 0;
    this.isPlaying = true;
    this.isPaused = false;
    this.preloadedUrls.clear();

    // Activer l'Auto-Ducking de la musique de fond (ambianceStore ET soundscape,
    // ce sont deux moteurs audio distincts — le Mixeur d'Ambiance du VTT utilise soundscape)
    ambianceStore.setDucking(true);
    soundscape.setDucking(true);

    this.speakFromSentence(0);
  }

  /**
   * Lit directement une suite de segments pré-découpés et personnalisés (Studio de Narration)
   */
  speakSegments(customSegments: NarrationSegment[]) {
    this.stop();
    if (!customSegments || customSegments.length === 0) return;

    this.segments = customSegments.map(s => ({ ...s }));
    this.sentences = customSegments.map(s => s.text);
    this.currentFullText = customSegments.map(s => s.text).join(' ');
    this.currentSentenceIndex = 0;
    this.isPlaying = true;
    this.isPaused = false;
    this.preloadedUrls.clear();

    ambianceStore.setDucking(true);
    soundscape.setDucking(true);

    this.speakFromSentence(0);
  }

  /**
   * Écoute une réplique unique isolée (prévisualisation de voix)
   */
  speakSingleSegment(segment: NarrationSegment) {
    this.stop();
    this.segments = [{ ...segment }];
    this.sentences = [segment.text];
    this.currentFullText = segment.text;
    this.currentSentenceIndex = 0;
    this.isPlaying = true;
    this.isPaused = false;
    this.preloadedUrls.clear();

    ambianceStore.setDucking(true);
    soundscape.setDucking(true);

    this.speakFromSentence(0);
  }

  /**
   * Saute directement à un segment précis pendant la lecture
   */
  jumpToSegment(index: number) {
    if (index >= 0 && index < this.sentences.length) {
      if (this.currentAudio) {
        this.currentAudio.pause();
        this.currentAudio = null;
      }
      if (this.synth) {
        try { this.synth.cancel(); } catch {}
      }
      this.isPlaying = true;
      this.isPaused = false;
      this.speakFromSentence(index);
    }
  }

  private async speakFromSentence(index: number) {
    if (index >= this.sentences.length || !this.isPlaying) {
      this.stop();
      return;
    }

    this.currentSentenceIndex = index;
    const segment = this.segments[index] || {
      text: this.sentences[index],
      isDialogue: false,
      speakerName: 'Narrateur',
      voiceId: this.selectedVoiceName,
      voiceEmoji: '🧙‍♂️'
    };

    this.currentSpeakerName = segment.speakerName;
    this.currentSpeakerEmoji = segment.voiceEmoji;

    const rawText = segment.text;
    const voiceToUse = segment.voiceId || this.selectedVoiceName;

    // ── 1. Balises Sonores Synchronisées [sfx: <id>] ──
    const sfxMatch = rawText.match(/\[sfx:\s*([a-zA-Z0-9_\-]+)\]/i);
    if (sfxMatch) {
      const sfxId = sfxMatch[1].toLowerCase();
      try {
        soundscape.playSfx(sfxId, true);
      } catch (e) {
        console.warn('SFX auto-trigger error:', e);
      }
    }

    // ── 2. Acoustique DSP & Lieux ──
    let acousticPreset = segment.acoustics || (vttStore as any).acousticsPreset || 'normal';
    const acousticTagMatch = rawText.match(/\[(cave|cathedral|telepathy|spectral|normal)\]/i);
    if (acousticTagMatch) {
      acousticPreset = acousticTagMatch[1].toLowerCase() as any;
    }

    // Nettoyage complet des balises techniques pour que la voix ne les lise pas à voix haute
    const cleanSpeechText = rawText
      .replace(/\[sfx:\s*[a-zA-Z0-9_\-]+\]/gi, '')
      .replace(/\[(cave|cathedral|telepathy|spectral|normal)\]/gi, '')
      .replace(/>\s*\[!ACOUSTIQUE:[^\]]+\]/gi, '')
      .trim();

    // ── 3. Bulle de Dialogue & Halo Vocal VTT ──
    if (cleanSpeechText.length > 0) {
      showSpeechBubble(segment.speakerName, cleanSpeechText, (segment as any).tokenId);
    }

    const selectedVoice = this.availableVoices.find(
      v => v.aiId === voiceToUse || v.name === voiceToUse
    );

    // ── Cas 1 : Voix Neuronale IA Ultra-Réaliste ──
    if (selectedVoice?.isAi && selectedVoice.aiId) {
      this.isLoadingAudio = true;
      try {
        let audioUrl = this.preloadedUrls.get(index);

        const profile = voiceProfilesStore.getVoice(selectedVoice.aiId);
        const actualBaseVoice = profile?.baseVoiceId || selectedVoice.aiId;
        const segmentRate = segment.rate ?? profile?.rate ?? 1.0;
        const segmentPitch = segment.pitch ?? profile?.pitch ?? 1.0;
        const actualRate = segmentRate * this.rate;
        const actualPitch = segmentPitch * this.pitch;

        if (!audioUrl) {
          audioUrl = await synthesizeNeuralSpeech(cleanSpeechText, actualBaseVoice, actualRate, actualPitch);
        }

        if (!this.isPlaying || this.currentSentenceIndex !== index) return;

        this.isLoadingAudio = false;
        this.cleanupAudio();

        const audio = new Audio(audioUrl);
        audio.playbackRate = this.rate;
        this.currentAudio = audio;
        this.currentBlobUrl = audioUrl;

        // Application de l'acoustique de la pièce / DSP
        if (acousticPreset && acousticPreset !== 'normal') {
          audioAcoustics.applyEffects(audio, acousticPreset as any);
        }

        // Pré-charger la phrase suivante en arrière-plan avec sa propre voix et ses réglages de pitch/tempo
        if (index + 1 < this.sentences.length && !this.preloadedUrls.has(index + 1)) {
          const nextSegment = this.segments[index + 1];
          const nextVoiceKey = nextSegment?.voiceId || selectedVoice.aiId;
          const nextProfile = voiceProfilesStore.getVoice(nextVoiceKey);
          const nextBaseVoice = nextProfile?.baseVoiceId || nextVoiceKey;
          const nextRate = (nextSegment?.rate ?? nextProfile?.rate ?? 1.0) * this.rate;
          const nextPitch = (nextSegment?.pitch ?? nextProfile?.pitch ?? 1.0) * this.pitch;
          const nextClean = (this.sentences[index + 1] || '')
            .replace(/\[sfx:\s*[a-zA-Z0-9_\-]+\]/gi, '')
            .replace(/\[(cave|cathedral|telepathy|spectral|normal)\]/gi, '')
            .replace(/>\s*\[!ACOUSTIQUE:[^\]]+\]/gi, '')
            .trim();

          synthesizeNeuralSpeech(nextClean, nextBaseVoice, nextRate, nextPitch)
            .then(nextUrl => {
              if (this.isPlaying) this.preloadedUrls.set(index + 1, nextUrl);
            })
            .catch(() => {});
        }

        audio.onended = () => {
          clearSpeechBubble();
          if (this.isPlaying && !this.isPaused) {
            this.speakFromSentence(index + 1);
          }
        };

        audio.onerror = (e) => {
          console.warn('Erreur lecture audio IA:', e);
          clearSpeechBubble();
          if (this.isPlaying) this.speakFromSentence(index + 1);
        };

        await audio.play();
      } catch (err) {
        console.warn('Synthèse vocale IA échouée, bascule sur voix système...', err);
        this.isLoadingAudio = false;
        this.speakWithWebSpeech(cleanSpeechText, index);
      }
    } else {
      // ── Cas 2 : Voix Système Locale ──
      this.speakWithWebSpeech(cleanSpeechText, index);
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
    ambianceStore.setDucking(false); // Rétablir le volume de fond quand la voix est en pause
    soundscape.setDucking(false);

    if (this.currentAudio) {
      this.currentAudio.pause();
    } else if (this.synth) {
      this.synth.pause();
    }
  }

  resume() {
    if (!this.isPlaying) return;
    this.isPaused = false;
    ambianceStore.setDucking(true); // Re-baisser le volume de fond
    soundscape.setDucking(true);

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
    this.currentSpeakerName = '🧙‍♂️ Narrateur';
    clearSpeechBubble();

    // Rétablir la musique de fond
    ambianceStore.setDucking(false);
    soundscape.setDucking(false);

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
