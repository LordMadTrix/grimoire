import { vttStore, updateGmAudio } from './vtt.svelte';
import { notifStore } from './notifications.svelte';
import { emitToPlayerView, broadcastToPlayers, isTauri, readFileBase64, fetchBinaryAssetUrl, askOllama } from '../api';
import { getVaultPath } from './vault.svelte';
import { ttsReader } from './ttsReader.svelte';
import { soundscape } from './soundscape.svelte';

const STORAGE_KEY_SRC = 'grimoire_intro_audio_src';
const STORAGE_KEY_TITLE = 'grimoire_intro_session_title';
const STORAGE_KEY_SUBTITLE = 'grimoire_intro_session_subtitle';
const STORAGE_KEY_NARRATION = 'grimoire_intro_session_narration';
const STORAGE_KEY_IMAGE = 'grimoire_intro_session_image';
const STORAGE_KEY_THEME = 'grimoire_intro_session_theme';
const STORAGE_KEY_NORMALIZE = 'grimoire_intro_normalize_audio';
const STORAGE_KEY_FADEIN = 'grimoire_intro_auto_fade_in';
const STORAGE_KEY_TEXTMODE = 'grimoire_intro_text_mode';
const STORAGE_KEY_WEATHER = 'grimoire_intro_weather_fx';
const STORAGE_KEY_SHOWHEROES = 'grimoire_intro_show_heroes';

export type IntroVisualTheme = 'cinematic' | 'parchment' | 'cinders' | 'starry';
export type IntroTextMode = 'card' | 'crawl';
export type IntroWeatherEffect = 'none' | 'rain' | 'snow' | 'embers' | 'storm';

export interface HeroCastMember {
  name: string;
  role?: string;
  imageUrl?: string;
}

export interface PlayerIntroPayload {
  active: boolean;
  title: string;
  subtitle: string;
  narration: string;
  imageUrl: string;
  theme: IntroVisualTheme;
  textMode: IntroTextMode;
  weatherEffect: IntroWeatherEffect;
  countdownRemaining: number;
  showHeroes: boolean;
  heroes: HeroCastMember[];
}

export interface IntroAudioPreset {
  id: string;
  name: string;
  icon: string;
  desc: string;
  soundscapePreset: string;
}

export const INTRO_AUDIO_PRESETS: IntroAudioPreset[] = [
  { id: 'preset_epic', name: 'Épopée & Gloire', icon: '⚔️', desc: 'Cuivres épiques, vent des sommets et tension héroïque', soundscapePreset: 'camp' },
  { id: 'preset_mystery', name: 'Mystère & Crypte', icon: '🕯️', desc: 'Brume ténébreuse, murmures et donjon antique', soundscapePreset: 'dungeon' },
  { id: 'preset_tavern', name: 'Auberge Chaleureuse', icon: '🍻', desc: 'Rires, feu de bois et joyeuse convivialité', soundscapePreset: 'tavern' },
  { id: 'preset_storm', name: 'Nuit de Tempête', icon: '⛈️', desc: 'Pluie battante, tonnerre lointain et bourrasques', soundscapePreset: 'storm' },
  { id: 'preset_ocean', name: 'Rivages & Traversée', icon: '⛵', desc: 'Ressac des vagues océaniques et vent marin', soundscapePreset: 'sea' }
];

class SessionIntroStore {
  isOpen = $state(false);
  isMinimized = $state(false);
  isPlaying = $state(false);
  private isLoadingAudio = false;
  
  // Audio sélectionné
  audioSrc = $state<string>('');
  trackName = $state<string>('Thème d\'introduction');
  selectedPresetId = $state<string | null>(null);
  sessionTitle = $state<string>('Début de soirée — Les Héros se rassemblent');
  sessionSubtitle = $state<string>('Acte I — L\'Aventure commence');
  sessionNarration = $state<string>('Après une longue traversée des Terres Maudites, la nuit tombe enfin sur les ruines antiques. Vos pas résonnent dans le silence...');
  sessionImageUrl = $state<string>('');
  visualTheme = $state<IntroVisualTheme>('cinematic');

  // Nouveautés cinématographiques
  textDisplayMode = $state<IntroTextMode>('card');
  weatherEffect = $state<IntroWeatherEffect>('embers');
  showHeroesCasting = $state(true);
  isVoiceOverActive = $state(false);
  isGeneratingAi = $state(false);

  // Compte à rebours avant lancement (0 = inactif)
  countdownDuration = $state(0); // 0, 60, 120, 180, 300
  countdownRemaining = $state(0);
  private countdownTimer: any = null;

  // Normalisation & dynamiques sonores
  normalizeAudio = $state(true);
  autoFadeIn = $state(false);

  // Audio HTML5 natif
  audioElement: HTMLAudioElement | null = null;
  currentTime = $state(0);
  duration = $state(0);
  volume = $state(0.8);
  targetVolume = 0.8;
  fadeInterval: any = null;

  // Web Audio API pour la normalisation
  private audioCtx: AudioContext | null = null;
  private sourceNode: MediaElementAudioSourceNode | null = null;
  private compressorNode: DynamicsCompressorNode | null = null;
  private makeupGainNode: GainNode | null = null;
  private volumeGainNode: GainNode | null = null;

  // Sauvegarde volume VTT & Ducking
  private savedVttVolume: number | null = null;
  private preDuckingVolume: number | null = null;

  // Options cinématographiques
  cinemaBlackout = $state(true);
  showScreenPreview = $state(false);

  constructor() {
    this.loadSavedState();
  }

  private loadSavedState() {
    try {
      const savedSrc = localStorage.getItem(STORAGE_KEY_SRC);
      if (savedSrc) {
        this.audioSrc = savedSrc;
        this.trackName = savedSrc.split('/').pop()?.split('\\').pop()?.replace(/\.[^/.]+$/, '') || 'Thème d\'introduction';
      }
      const savedTitle = localStorage.getItem(STORAGE_KEY_TITLE);
      if (savedTitle) this.sessionTitle = savedTitle;

      const savedSubtitle = localStorage.getItem(STORAGE_KEY_SUBTITLE);
      if (savedSubtitle) this.sessionSubtitle = savedSubtitle;

      const savedNarration = localStorage.getItem(STORAGE_KEY_NARRATION);
      if (savedNarration) this.sessionNarration = savedNarration;

      const savedImage = localStorage.getItem(STORAGE_KEY_IMAGE);
      if (savedImage) this.sessionImageUrl = savedImage;

      const savedTheme = localStorage.getItem(STORAGE_KEY_THEME) as IntroVisualTheme;
      if (savedTheme && ['cinematic', 'parchment', 'cinders', 'starry'].includes(savedTheme)) {
        this.visualTheme = savedTheme;
      }

      const savedNormalize = localStorage.getItem(STORAGE_KEY_NORMALIZE);
      if (savedNormalize !== null) this.normalizeAudio = savedNormalize === 'true';

      const savedFadeIn = localStorage.getItem(STORAGE_KEY_FADEIN);
      if (savedFadeIn !== null) this.autoFadeIn = savedFadeIn === 'true';

      const savedTextMode = localStorage.getItem(STORAGE_KEY_TEXTMODE) as IntroTextMode;
      if (savedTextMode && ['card', 'crawl'].includes(savedTextMode)) this.textDisplayMode = savedTextMode;

      const savedWeather = localStorage.getItem(STORAGE_KEY_WEATHER) as IntroWeatherEffect;
      if (savedWeather && ['none', 'rain', 'snow', 'embers', 'storm'].includes(savedWeather)) this.weatherEffect = savedWeather;

      const savedHeroes = localStorage.getItem(STORAGE_KEY_SHOWHEROES);
      if (savedHeroes !== null) this.showHeroesCasting = savedHeroes === 'true';
    } catch {}
  }

  saveState() {
    try {
      if (this.audioSrc) localStorage.setItem(STORAGE_KEY_SRC, this.audioSrc);
      if (this.sessionTitle) localStorage.setItem(STORAGE_KEY_TITLE, this.sessionTitle);
      if (this.sessionSubtitle) localStorage.setItem(STORAGE_KEY_SUBTITLE, this.sessionSubtitle);
      if (this.sessionNarration) localStorage.setItem(STORAGE_KEY_NARRATION, this.sessionNarration);
      if (this.sessionImageUrl) localStorage.setItem(STORAGE_KEY_IMAGE, this.sessionImageUrl);
      if (this.visualTheme) localStorage.setItem(STORAGE_KEY_THEME, this.visualTheme);
      localStorage.setItem(STORAGE_KEY_NORMALIZE, String(this.normalizeAudio));
      localStorage.setItem(STORAGE_KEY_FADEIN, String(this.autoFadeIn));
      localStorage.setItem(STORAGE_KEY_TEXTMODE, this.textDisplayMode);
      localStorage.setItem(STORAGE_KEY_WEATHER, this.weatherEffect);
      localStorage.setItem(STORAGE_KEY_SHOWHEROES, String(this.showHeroesCasting));
    } catch {}
  }

  open() {
    this.isOpen = true;
    this.isMinimized = false;
  }

  close() {
    this.stop();
    this.isOpen = false;
  }

  toggle() {
    if (this.isOpen) {
      if (this.isMinimized) this.isMinimized = false;
      else this.isOpen = false;
    } else {
      this.open();
    }
  }

  setNormalizeAudio(enabled: boolean) {
    this.normalizeAudio = enabled;
    this.saveState();
    this.updateAudioRouting();
    notifStore.add('🎚️', enabled ? 'Normalisation Activée' : 'Normalisation Désactivée', enabled ? 'Volume égalisé et crêtes stabilisées' : 'Rendu dynamique d\'origine', 'info', 2000);
  }

  setAutoFadeIn(enabled: boolean) {
    this.autoFadeIn = enabled;
    this.saveState();
  }

  setTextDisplayMode(mode: IntroTextMode) {
    this.textDisplayMode = mode;
    this.saveState();
    this.syncPlayerIntroScreen();
  }

  setWeatherEffect(effect: IntroWeatherEffect) {
    this.weatherEffect = effect;
    this.saveState();
    this.syncPlayerIntroScreen();
  }

  setShowHeroesCasting(val: boolean) {
    this.showHeroesCasting = val;
    this.saveState();
    this.syncPlayerIntroScreen();
  }

  setAudio(src: string, name?: string) {
    this.stop();
    this.selectedPresetId = null;
    this.audioSrc = src;
    this.trackName = name || src.split('/').pop()?.split('\\').pop()?.replace(/\.[^/.]+$/, '') || 'Thème MP3';
    this.saveState();
    notifStore.add('🎵', this.trackName, 'Sélectionné pour l\'intro de soirée', 'info', 2000);
  }

  applyAudioPreset(preset: IntroAudioPreset) {
    this.stop();
    this.selectedPresetId = preset.id;
    this.trackName = `${preset.icon} ${preset.name}`;
    this.audioSrc = `preset:${preset.soundscapePreset}`;
    this.saveState();
    notifStore.add(preset.icon, preset.name, preset.desc, 'info', 2500);
  }

  setImage(url: string) {
    this.sessionImageUrl = url;
    this.saveState();
    this.syncPlayerIntroScreen();
  }

  setTheme(theme: IntroVisualTheme) {
    this.visualTheme = theme;
    this.saveState();
    this.syncPlayerIntroScreen();
  }

  getHeroCastList(): HeroCastMember[] {
    const list: HeroCastMember[] = [];
    const seen = new Set<string>();

    // 1. Tokens PJ sur la carte
    for (const t of vttStore.tokens) {
      if (!t.isEnemy && t.name && !seen.has(t.name.toLowerCase())) {
        seen.add(t.name.toLowerCase());
        list.push({
          name: t.name,
          role: t.conditions?.length ? t.conditions.join(', ') : 'Héros du groupe',
          imageUrl: t.imageUrl || undefined,
        });
      }
    }

    // 2. Si aucun token PJ, fallback vers les personnages du groupe
    if (list.length === 0 && vttStore.combatants?.length) {
      for (const c of vttStore.combatants) {
        if (!c.isEnemy && c.name && !seen.has(c.name.toLowerCase())) {
          seen.add(c.name.toLowerCase());
          const tokenImg = c.tokenId ? vttStore.tokens.find(t => t.id === c.tokenId)?.imageUrl : undefined;
          list.push({
            name: c.name,
            role: 'Aventurier',
            imageUrl: tokenImg,
          });
        }
      }
    }

    return list;
  }

  async resolveAudioUrl(src: string): Promise<string> {
    if (!src) return '';
    if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('data:') || src.startsWith('blob:')) {
      return src;
    }
    const vaultPath = getVaultPath();
    const isAbsolute = /^[a-zA-Z]:[\\/]/.test(src) || src.startsWith('/');
    const fullPath = isAbsolute ? src : (vaultPath ? `${vaultPath}/${src}` : src);

    if (isTauri()) {
      try {
        const assetUrl = await fetchBinaryAssetUrl(fullPath);
        if (assetUrl) return assetUrl;
      } catch {}
    }

    try {
      const b64 = await readFileBase64(fullPath);
      const ext = fullPath.split('.').pop()?.toLowerCase();
      const mime = ext === 'wav' ? 'audio/wav' : ext === 'ogg' ? 'audio/ogg' : ext === 'flac' ? 'audio/flac' : 'audio/mpeg';
      return `data:${mime};base64,${b64}`;
    } catch {
      return src;
    }
  }

  private setupWebAudioChain() {
    if (!this.audioElement) return;
    if (this.sourceNode) return;

    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.audioCtx = new AudioContextClass();

      this.sourceNode = this.audioCtx.createMediaElementSource(this.audioElement);

      this.compressorNode = this.audioCtx.createDynamicsCompressor();
      this.compressorNode.threshold.setValueAtTime(-22, this.audioCtx.currentTime);
      this.compressorNode.knee.setValueAtTime(25, this.audioCtx.currentTime);
      this.compressorNode.ratio.setValueAtTime(8, this.audioCtx.currentTime);
      this.compressorNode.attack.setValueAtTime(0.005, this.audioCtx.currentTime);
      this.compressorNode.release.setValueAtTime(0.20, this.audioCtx.currentTime);

      this.makeupGainNode = this.audioCtx.createGain();
      this.makeupGainNode.gain.setValueAtTime(1.25, this.audioCtx.currentTime);

      this.volumeGainNode = this.audioCtx.createGain();
      this.volumeGainNode.gain.setValueAtTime(this.volume, this.audioCtx.currentTime);
      this.volumeGainNode.connect(this.audioCtx.destination);

      this.updateAudioRouting();
    } catch (err) {
      console.warn('Web Audio normalizer initialisation fallback:', err);
    }
  }

  private updateAudioRouting() {
    if (!this.audioCtx || !this.sourceNode || !this.volumeGainNode) return;
    try {
      this.sourceNode.disconnect();
      if (this.compressorNode) this.compressorNode.disconnect();
      if (this.makeupGainNode) this.makeupGainNode.disconnect();

      if (this.normalizeAudio && this.compressorNode && this.makeupGainNode) {
        this.sourceNode.connect(this.compressorNode);
        this.compressorNode.connect(this.makeupGainNode);
        this.makeupGainNode.connect(this.volumeGainNode);
      } else {
        this.sourceNode.connect(this.volumeGainNode);
      }
    } catch (err) {
      console.warn('Erreur mise à jour routage normalisation intro:', err);
    }
  }

  syncPlayerIntroScreen(forcedActive?: boolean) {
    const isActive = forcedActive !== undefined ? forcedActive : (this.isPlaying && this.cinemaBlackout);
    const payload: PlayerIntroPayload = {
      active: isActive,
      title: this.sessionTitle,
      subtitle: this.sessionSubtitle,
      narration: this.sessionNarration,
      imageUrl: this.sessionImageUrl,
      theme: this.visualTheme,
      textMode: this.textDisplayMode,
      weatherEffect: this.weatherEffect,
      countdownRemaining: this.countdownRemaining,
      showHeroes: this.showHeroesCasting,
      heroes: this.getHeroCastList(),
    };

    emitToPlayerView('set_player_intro', payload);
    broadcastToPlayers('set_player_intro', payload).catch(() => {});
  }

  private stopAudioOnly() {
    this.clearIntervals();
    if (this.audioElement) {
      try {
        this.audioElement.pause();
        this.audioElement.currentTime = 0;
      } catch {}
    }
    soundscape.stopAll();
    this.isPlaying = false;
  }

  async play(overrideWithFadeIn?: boolean) {
    if (this.isLoadingAudio) return;
    if (!this.audioSrc) {
      notifStore.add('⚠️', 'Aucun thème sélectionné', 'Veuillez choisir un morceau MP3 ou un préréglage sonore', 'warn', 2500);
      return;
    }

    const useFade = overrideWithFadeIn !== undefined ? overrideWithFadeIn : this.autoFadeIn;
    this.isLoadingAudio = true;

    try {
      this.stopAudioOnly();

      // Mettre en sourdine l'ambiance VTT
      if (vttStore.audioSrc && this.savedVttVolume === null) {
        this.savedVttVolume = vttStore.audioVolume;
        vttStore.audioVolume = 0;
      }

      // Si c'est un preset sonore synthétique
      if (this.audioSrc.startsWith('preset:')) {
        const pId = this.audioSrc.replace('preset:', '');
        soundscape.applyPreset(pId);
        this.isPlaying = true;
      } else {
        const resolvedUrl = await this.resolveAudioUrl(this.audioSrc);

        if (!this.audioElement) {
          this.audioElement = new Audio();
          this.audioElement.crossOrigin = 'anonymous';
          this.audioElement.onended = () => this.handleEnded();
          this.audioElement.ontimeupdate = () => {
            if (this.audioElement) {
              this.currentTime = this.audioElement.currentTime;
              this.duration = this.audioElement.duration || 0;
            }
          };
          this.audioElement.onloadedmetadata = () => {
            if (this.audioElement) {
              this.duration = this.audioElement.duration || 0;
            }
          };

          this.setupWebAudioChain();
        }

        if (this.audioCtx && this.audioCtx.state === 'suspended') {
          await this.audioCtx.resume();
        }

        this.audioElement.src = resolvedUrl;
        this.targetVolume = this.volume;

        if (useFade) {
          this.applyVolumeLevel(0.05);
        } else {
          this.applyVolumeLevel(this.volume);
        }

        await this.audioElement.play();
        this.isPlaying = true;

        if (useFade) {
          this.fadeIn(2500);
        }
      }

      // Lancement du compte à rebours si configuré
      if (this.countdownDuration > 0) {
        this.startCountdown(this.countdownDuration);
      }

      // Synchroniser avec les joueurs
      if (this.cinemaBlackout) {
        emitToPlayerView('toggle_player_blackout', { active: true });
        emitToPlayerView('set_campaign_title', { title: this.sessionTitle });
      }

      this.syncPlayerIntroScreen(true);

      const normMsg = this.normalizeAudio ? ' (Normalisé 🎚️)' : '';
      notifStore.add('🎬', 'Intro de Session', `« ${this.trackName} » lancé !${normMsg}`, 'success', 2500);
    } catch (err) {
      console.error('Erreur lecture intro:', err);
      notifStore.add('❌', 'Erreur Audio', 'Impossible de lancer l\'intro', 'danger', 3000);
    } finally {
      this.isLoadingAudio = false;
    }
  }

  startCountdown(seconds: number) {
    if (this.countdownTimer) clearInterval(this.countdownTimer);
    this.countdownRemaining = seconds;
    this.syncPlayerIntroScreen();

    this.countdownTimer = setInterval(() => {
      this.countdownRemaining--;
      this.syncPlayerIntroScreen();
      if (this.countdownRemaining <= 0) {
        clearInterval(this.countdownTimer);
        this.countdownTimer = null;
        notifStore.add('⏰', 'Compte à rebours terminé', 'Début de la partie !', 'success', 3000);
      }
    }, 1000);
  }

  stopCountdown() {
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }
    this.countdownRemaining = 0;
    this.countdownDuration = 0;
    this.syncPlayerIntroScreen();
  }

  /**
   * Génération de l'accroche narrative par l'IA locale Ollama
   */
  async generateAiNarration() {
    if (this.isGeneratingAi) return;
    this.isGeneratingAi = true;
    notifStore.add('✨', 'IA d\'écriture', 'Rédaction de l\'accroche narrative en cours...', 'info', 3000);
    try {
      const prompt = `Rédige une accroche narrative courte (2 à 3 phrases rythmées et mémorables) pour l'ouverture d'une session de jeu de rôle sur table.
Titre de la session : "${this.sessionTitle || 'Une Nouvelle Quête'}"
Sous-titre / Acte : "${this.sessionSubtitle || 'L\'Heure du Destin'}"
Contexte : Dark Fantasy / JDR d'aventure héroïque.
Ton : Épique, théâtral, poétique et immersif.
IMPORTANT : Réponds UNIQUEMENT avec le texte narratif en français, sans titre, sans guillemets, ni formule de politesse.`;

      const res = await askOllama(prompt, '', 'Tu es un Maître du Jeu expert en narration théâtrale de prologue.');
      if (res && res.trim()) {
        this.sessionNarration = res.trim();
        this.saveState();
        this.syncPlayerIntroScreen();
        notifStore.add('✨', 'Accroche rédigée !', 'Votre prologue est prêt à être conté', 'success', 3000);
      } else {
        throw new Error('Réponse vide');
      }
    } catch {
      notifStore.add('⚠️', 'Ollama non disponible', 'Vérifiez qu\'Ollama est actif en arrière-plan', 'warn', 3500);
    } finally {
      this.isGeneratingAi = false;
    }
  }

  /**
   * Voix-Off IA avec Auto-Ducking
   */
  toggleVoiceOver() {
    if (ttsReader.isPlaying) {
      ttsReader.stop();
      this.isVoiceOverActive = false;
      this.restoreDuckingVolume();
      notifStore.add('⏹️', 'Voix-off arrêtée', '', 'info', 1500);
    } else {
      if (!this.sessionNarration) {
        notifStore.add('⚠️', 'Texte vide', 'Veuillez saisir ou générer un texte narratif', 'warn', 2500);
        return;
      }
      this.isVoiceOverActive = true;
      this.applyDuckingVolume(0.25);
      ttsReader.speakText(this.sessionNarration);
      notifStore.add('🎙️', 'Voix-Off IA', 'Lecture du prologue avec atténuation musicale...', 'info', 3000);

      const checkEnd = setInterval(() => {
        if (!ttsReader.isPlaying) {
          clearInterval(checkEnd);
          this.isVoiceOverActive = false;
          this.restoreDuckingVolume();
        }
      }, 300);
    }
  }

  private applyDuckingVolume(duckRatio = 0.25) {
    if (this.preDuckingVolume === null) {
      this.preDuckingVolume = this.volume;
      this.applyVolumeLevel(this.volume * duckRatio);
    }
  }

  private restoreDuckingVolume() {
    if (this.preDuckingVolume !== null) {
      this.applyVolumeLevel(this.preDuckingVolume);
      this.preDuckingVolume = null;
    }
  }

  pause() {
    if (this.audioElement && this.isPlaying) {
      this.audioElement.pause();
      this.isPlaying = false;
      notifStore.add('⏸️', 'Intro en pause', '', 'info', 1500);
    }
  }

  stop() {
    this.clearIntervals();
    this.stopCountdown();
    if (this.isVoiceOverActive) {
      ttsReader.stop();
      this.isVoiceOverActive = false;
      this.restoreDuckingVolume();
    }
    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement.currentTime = 0;
      this.currentTime = 0;
    }
    soundscape.stopAll();
    this.isPlaying = false;

    // Rétablir le volume de l'ambiance VTT
    if (this.savedVttVolume !== null) {
      vttStore.audioVolume = this.savedVttVolume;
      this.savedVttVolume = null;
    }

    // Rétablir l'écran joueur
    if (this.cinemaBlackout) {
      emitToPlayerView('toggle_player_blackout', { active: false });
    }
    this.syncPlayerIntroScreen(false);

    broadcastToPlayers('session_intro_stop', {}).catch(() => {});
  }

  private applyVolumeLevel(vol: number) {
    const clamped = Math.max(0, Math.min(1, vol));
    if (this.volumeGainNode && this.audioCtx) {
      this.volumeGainNode.gain.setValueAtTime(clamped, this.audioCtx.currentTime);
    }
    if (this.audioElement) {
      this.audioElement.volume = clamped;
    }
  }

  private fadeIn(durationMs = 2500) {
    this.clearIntervals();
    const steps = 25;
    const intervalTime = durationMs / steps;
    let currentVol = 0.05;
    const volStep = (this.targetVolume - currentVol) / steps;

    this.fadeInterval = setInterval(() => {
      currentVol = Math.min(this.targetVolume, currentVol + volStep);
      this.applyVolumeLevel(currentVol);
      if (currentVol >= this.targetVolume) {
        this.clearIntervals();
      }
    }, intervalTime);
  }

  fadeOut(durationMs = 3500) {
    if (!this.isPlaying) return;
    this.clearIntervals();
    const steps = 30;
    const intervalTime = durationMs / steps;
    let currentVol = this.volume;
    const volStep = currentVol / steps;

    notifStore.add('📉', 'Fondu Voix MJ', 'Baisse progressive du volume pour le début de la partie...', 'info', 2000);

    this.fadeInterval = setInterval(() => {
      currentVol = Math.max(0, currentVol - volStep);
      this.applyVolumeLevel(currentVol);
      if (currentVol <= 0.02) {
        this.clearIntervals();
        this.stop();
        notifStore.add('🎲', 'Bonne session !', 'L\'intro est terminée, place à l\'aventure !', 'success', 3000);
      }
    }, intervalTime);
  }

  seek(seconds: number) {
    if (this.audioElement) {
      this.audioElement.currentTime = seconds;
      this.currentTime = seconds;
    }
  }

  setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
    this.targetVolume = this.volume;
    this.applyVolumeLevel(this.volume);
  }

  private handleEnded() {
    this.isPlaying = false;
    this.stop();
    notifStore.add('🎬', 'Fin du thème d\'intro', 'L\'intro est terminée !', 'success', 3000);
  }

  private clearIntervals() {
    if (this.fadeInterval) {
      clearInterval(this.fadeInterval);
      this.fadeInterval = null;
    }
  }
}

export const sessionIntroStore = new SessionIntroStore();
