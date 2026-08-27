// ── Mixeur d'Ambiance Sonore & Soundscapes avec Auto-Ducking ──────────────────
// Générateur audio procédural Web Audio API temps réel (100% autonome, zéro téléchargement)
// avec multi-pistes (Pluie, Feu de camp, Taverne, Donjon, Blizzard, Mystique)
// et atténuation dynamique automatique (Auto-Ducking) pendant la narration vocale.

export interface AmbianceTrack {
  id: string;
  name: string;
  emoji: string;
  volume: number; // 0.0 à 1.0
  active: boolean;
}

class AmbianceStore {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private duckingGain: GainNode | null = null;

  // Noeuds audio par piste
  private activeNodes: Map<string, { gain: GainNode; stop: () => void }> = new Map();

  masterVolume = $state<number>(0.7);
  isMuted = $state<boolean>(false);
  isDucked = $state<boolean>(false);

  tracks = $state<AmbianceTrack[]>([
    { id: 'rain', name: 'Pluie & Orage', emoji: '🌧️', volume: 0.5, active: false },
    { id: 'fire', name: 'Feu de Camp', emoji: '🔥', volume: 0.5, active: false },
    { id: 'tavern', name: 'Taverne Animée', emoji: '🕯️', volume: 0.5, active: false },
    { id: 'dungeon', name: 'Donjon Sombre', emoji: '🏰', volume: 0.5, active: false },
    { id: 'blizzard', name: 'Vent & Blizzard', emoji: '🌬️', volume: 0.5, active: false },
    { id: 'mystic', name: 'Magie & Mystère', emoji: '🔮', volume: 0.5, active: false },
  ]);

  private initAudio() {
    if (this.ctx) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtx();
      
      this.duckingGain = this.ctx.createGain();
      this.duckingGain.gain.value = 1.0;

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.masterVolume;

      this.duckingGain.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);
    } catch (e) {
      console.warn('AudioContext non initialisé:', e);
    }
  }

  // ── Préréglages rapides (Presets d'ambiance) ──
  loadPreset(presetId: 'camp' | 'dungeon' | 'tavern' | 'storm' | 'mystic' | 'clear') {
    this.stopAll();
    if (presetId === 'clear') return;

    if (presetId === 'camp') {
      this.setTrackState('fire', true, 0.7);
      this.setTrackState('blizzard', true, 0.2);
    } else if (presetId === 'dungeon') {
      this.setTrackState('dungeon', true, 0.8);
      this.setTrackState('rain', true, 0.3);
    } else if (presetId === 'tavern') {
      this.setTrackState('tavern', true, 0.7);
      this.setTrackState('fire', true, 0.4);
    } else if (presetId === 'storm') {
      this.setTrackState('rain', true, 0.8);
      this.setTrackState('blizzard', true, 0.6);
    } else if (presetId === 'mystic') {
      this.setTrackState('mystic', true, 0.8);
      this.setTrackState('dungeon', true, 0.4);
    }
  }

  toggleTrack(trackId: string) {
    const t = this.tracks.find(x => x.id === trackId);
    if (!t) return;
    this.setTrackState(trackId, !t.active, t.volume);
  }

  setTrackState(trackId: string, active: boolean, volume?: number) {
    this.initAudio();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    const track = this.tracks.find(t => t.id === trackId);
    if (!track) return;

    track.active = active;
    if (volume !== undefined) track.volume = volume;

    if (active) {
      this.startProceduralTrack(trackId, track.volume);
    } else {
      this.stopProceduralTrack(trackId);
    }
  }

  setTrackVolume(trackId: string, volume: number) {
    const track = this.tracks.find(t => t.id === trackId);
    if (!track) return;
    track.volume = volume;

    const activeNode = this.activeNodes.get(trackId);
    if (activeNode && this.ctx) {
      activeNode.gain.gain.setTargetAtTime(volume, this.ctx.currentTime, 0.1);
    }
  }

  setMasterVolume(volume: number) {
    this.masterVolume = volume;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.isMuted ? 0 : volume, this.ctx.currentTime, 0.05);
    }
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    this.setMasterVolume(this.masterVolume);
  }

  /**
   * Auto-Ducking : Atténue doucement la musique de fond quand la voix IA parle
   */
  setDucking(isSpeaking: boolean) {
    this.isDucked = isSpeaking;
    if (!this.duckingGain || !this.ctx) return;

    const targetGain = isSpeaking ? 0.35 : 1.0; // Baisse à 35% pendant la voix
    const rampTime = isSpeaking ? 0.25 : 0.6; // Descente rapide, remontée douce
    this.duckingGain.gain.setTargetAtTime(targetGain, this.ctx.currentTime, rampTime);
  }

  stopAll() {
    for (const [id] of this.activeNodes) {
      this.stopProceduralTrack(id);
    }
    for (const t of this.tracks) {
      t.active = false;
    }
  }

  // ── Générateurs Procéduraux Web Audio ──

  private startProceduralTrack(trackId: string, volume: number) {
    if (!this.ctx || !this.duckingGain) return;
    this.stopProceduralTrack(trackId);

    const trackGain = this.ctx.createGain();
    trackGain.gain.value = volume;
    trackGain.connect(this.duckingGain);

    let stopFn = () => {};

    if (trackId === 'rain') {
      stopFn = this.createRainGenerator(trackGain);
    } else if (trackId === 'fire') {
      stopFn = this.createFireGenerator(trackGain);
    } else if (trackId === 'tavern') {
      stopFn = this.createTavernGenerator(trackGain);
    } else if (trackId === 'dungeon') {
      stopFn = this.createDungeonGenerator(trackGain);
    } else if (trackId === 'blizzard') {
      stopFn = this.createBlizzardGenerator(trackGain);
    } else if (trackId === 'mystic') {
      stopFn = this.createMysticGenerator(trackGain);
    }

    this.activeNodes.set(trackId, { gain: trackGain, stop: stopFn });
  }

  private stopProceduralTrack(trackId: string) {
    const node = this.activeNodes.get(trackId);
    if (node) {
      node.stop();
      this.activeNodes.delete(trackId);
    }
  }

  // 🌧️ Générateur Pluie & Orage
  private createRainGenerator(dest: GainNode): () => void {
    if (!this.ctx) return () => {};
    const bufferSize = 2 * this.ctx.sampleRate;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      output[i] = (b0 + b1 + b2 + white * 0.5362) * 0.15;
    }

    const whiteNoise = this.ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;
    whiteNoise.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1100;

    whiteNoise.connect(filter);
    filter.connect(dest);
    whiteNoise.start();

    return () => {
      try { whiteNoise.stop(); whiteNoise.disconnect(); } catch {}
    };
  }

  // 🔥 Générateur Feu de Camp Crépitant
  private createFireGenerator(dest: GainNode): () => void {
    if (!this.ctx) return () => {};
    const bufferSize = this.ctx.sampleRate;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      output[i] = (last + (0.02 * white)) / 1.02;
      last = output[i];
      output[i] *= 2.5;
    }

    const brownNoise = this.ctx.createBufferSource();
    brownNoise.buffer = noiseBuffer;
    brownNoise.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 450;
    filter.Q.value = 1.2;

    brownNoise.connect(filter);
    filter.connect(dest);
    brownNoise.start();

    return () => {
      try { brownNoise.stop(); brownNoise.disconnect(); } catch {}
    };
  }

  // 🕯️ Générateur Taverne
  private createTavernGenerator(dest: GainNode): () => void {
    if (!this.ctx) return () => {};
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 350;

    osc1.frequency.value = 110; // La
    osc2.frequency.value = 164.81; // Mi
    osc1.type = 'triangle';
    osc2.type = 'sine';

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(dest);

    osc1.start();
    osc2.start();

    return () => {
      try { osc1.stop(); osc2.stop(); } catch {}
    };
  }

  // 🏰 Générateur Donjon Sombre
  private createDungeonGenerator(dest: GainNode): () => void {
    if (!this.ctx) return () => {};
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = 55; // Sub-bass 55Hz

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 120;

    osc.connect(filter);
    filter.connect(dest);
    osc.start();

    return () => {
      try { osc.stop(); } catch {}
    };
  }

  // 🌬️ Générateur Blizzard & Vents
  private createBlizzardGenerator(dest: GainNode): () => void {
    if (!this.ctx) return () => {};
    const bufferSize = 2 * this.ctx.sampleRate;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const whiteNoise = this.ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;
    whiteNoise.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 380;
    filter.Q.value = 3.0;

    whiteNoise.connect(filter);
    filter.connect(dest);
    whiteNoise.start();

    return () => {
      try { whiteNoise.stop(); } catch {}
    };
  }

  // 🔮 Générateur Mystique & Féerique
  private createMysticGenerator(dest: GainNode): () => void {
    if (!this.ctx) return () => {};
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const osc3 = this.ctx.createOscillator();

    osc1.type = 'sine';
    osc2.type = 'sine';
    osc3.type = 'sine';

    osc1.frequency.value = 220; // La 3
    osc2.frequency.value = 277.18; // Do# 4
    osc3.frequency.value = 329.63; // Mi 4

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 600;

    osc1.connect(filter);
    osc2.connect(filter);
    osc3.connect(filter);
    filter.connect(dest);

    osc1.start();
    osc2.start();
    osc3.start();

    return () => {
      try { osc1.stop(); osc2.stop(); osc3.stop(); } catch {}
    };
  }
}

export const ambianceStore = new AmbianceStore();
