// ── Soundscape Audio Engine (Web Audio Procedural Synthesis + Custom Tracks) ──
// Permet de générer des ambiances réalistes infinies sans fichiers lourds,
// et de mixer plusieurs pistes simultanément.

export interface SoundTrack {
  id: string;
  name: string;
  icon: string;
  category: 'weather' | 'nature' | 'places' | 'dungeon';
  active: boolean;
  volume: number; // 0.0 to 1.0
  type: 'synth' | 'file';
  fileUrl?: string;
  node?: any;
}

export interface SoundPreset {
  id: string;
  name: string;
  icon: string;
  tracks: Record<string, number>; // trackId -> volume
}

class SoundscapeStore {
  audioCtx: AudioContext | null = null;
  masterGain: GainNode | null = null;
  masterVolume = $state(0.7);
  isMuted = $state(false);

  tracks = $state<SoundTrack[]>([
    { id: 'rain', name: 'Pluie battante', icon: '🌧️', category: 'weather', active: false, volume: 0.6, type: 'synth' },
    { id: 'thunder', name: 'Orage & Tonnerre', icon: '⚡', category: 'weather', active: false, volume: 0.5, type: 'synth' },
    { id: 'fire', name: 'Feu de camp', icon: '🔥', category: 'nature', active: false, volume: 0.7, type: 'synth' },
    { id: 'wind', name: 'Vent des plaines', icon: '💨', category: 'weather', active: false, volume: 0.5, type: 'synth' },
    { id: 'forest', name: 'Forêt & Oiseaux', icon: '🌲', category: 'nature', active: false, volume: 0.6, type: 'synth' },
    { id: 'ocean', name: 'Vagues & Océan', icon: '🌊', category: 'nature', active: false, volume: 0.6, type: 'synth' },
    { id: 'tavern', name: 'Ambiance Taverne', icon: '🍺', category: 'places', active: false, volume: 0.6, type: 'synth' },
    { id: 'dungeon', name: 'Donjon Sombre', icon: '🕯️', category: 'dungeon', active: false, volume: 0.6, type: 'synth' },
    { id: 'combat', name: 'Tension de Combat', icon: '⚔️', category: 'dungeon', active: false, volume: 0.6, type: 'synth' }
  ]);

  presets: SoundPreset[] = [
    {
      id: 'storm',
      name: 'Nuit de Tempête',
      icon: '⛈️',
      tracks: { rain: 0.8, thunder: 0.6, wind: 0.7 }
    },
    {
      id: 'tavern',
      name: 'Auberge Chaleureuse',
      icon: '🍻',
      tracks: { tavern: 0.7, fire: 0.5 }
    },
    {
      id: 'camp',
      name: 'Bivouac Sauvage',
      icon: '🏕️',
      tracks: { fire: 0.7, forest: 0.5, wind: 0.3 }
    },
    {
      id: 'dungeon',
      name: 'Crypte Maudite',
      icon: '💀',
      tracks: { dungeon: 0.8, wind: 0.4 }
    },
    {
      id: 'sea',
      name: 'Voyage en Mer',
      icon: '⛵',
      tracks: { ocean: 0.8, wind: 0.6 }
    }
  ];

  // Active synthesizers instances
  private activeNodes: Map<string, { gain: GainNode; stop: () => void }> = new Map();

  private initAudio() {
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.audioCtx = new AudioContextClass();
      this.masterGain = this.audioCtx.createGain();
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : this.masterVolume, this.audioCtx.currentTime);
      this.masterGain.connect(this.audioCtx.destination);
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  setMasterVolume(val: number) {
    this.masterVolume = Math.max(0, Math.min(1, val));
    if (this.masterGain && this.audioCtx) {
      this.masterGain.gain.setTargetAtTime(this.isMuted ? 0 : this.masterVolume, this.audioCtx.currentTime, 0.05);
    }
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.masterGain && this.audioCtx) {
      this.masterGain.gain.setTargetAtTime(this.isMuted ? 0 : this.masterVolume, this.audioCtx.currentTime, 0.05);
    }
  }

  setTrackVolume(trackId: string, val: number) {
    const t = this.tracks.find(x => x.id === trackId);
    if (!t) return;
    t.volume = Math.max(0, Math.min(1, val));
    const active = this.activeNodes.get(trackId);
    if (active && this.audioCtx) {
      active.gain.gain.setTargetAtTime(t.volume, this.audioCtx.currentTime, 0.05);
    }
  }

  toggleTrack(trackId: string) {
    const t = this.tracks.find(x => x.id === trackId);
    if (!t) return;
    if (t.active) {
      this.stopTrack(trackId);
    } else {
      this.startTrack(trackId);
    }
  }

  applyPreset(presetId: string) {
    const p = this.presets.find(x => x.id === presetId);
    if (!p) return;
    this.stopAll();
    for (const [id, vol] of Object.entries(p.tracks)) {
      const t = this.tracks.find(x => x.id === id);
      if (t) {
        t.volume = vol;
        this.startTrack(id);
      }
    }
  }

  stopAll() {
    for (const t of this.tracks) {
      if (t.active) {
        this.stopTrack(t.id);
      }
    }
  }

  get activeTracksCount(): number {
    return this.tracks.filter(t => t.active).length;
  }

  startTrack(trackId: string) {
    this.initAudio();
    if (!this.audioCtx || !this.masterGain) return;

    const t = this.tracks.find(x => x.id === trackId);
    if (!t) return;

    // Arrêter si déjà en cours
    this.stopTrack(trackId);

    const ctx = this.audioCtx;
    const trackGain = ctx.createGain();
    trackGain.gain.setValueAtTime(0.001, ctx.currentTime);
    trackGain.gain.exponentialRampToValueAtTime(Math.max(0.001, t.volume), ctx.currentTime + 1.2); // Fondu d'ouverture 1.2s
    trackGain.connect(this.masterGain);

    let stopFn: () => void = () => {};

    // ── Synthétiseurs Procéduraux ──
    if (trackId === 'rain') {
      stopFn = this.createRainSynth(ctx, trackGain);
    } else if (trackId === 'thunder') {
      stopFn = this.createThunderSynth(ctx, trackGain);
    } else if (trackId === 'fire') {
      stopFn = this.createFireSynth(ctx, trackGain);
    } else if (trackId === 'wind') {
      stopFn = this.createWindSynth(ctx, trackGain);
    } else if (trackId === 'forest') {
      stopFn = this.createForestSynth(ctx, trackGain);
    } else if (trackId === 'ocean') {
      stopFn = this.createOceanSynth(ctx, trackGain);
    } else if (trackId === 'tavern') {
      stopFn = this.createTavernSynth(ctx, trackGain);
    } else if (trackId === 'dungeon') {
      stopFn = this.createDungeonSynth(ctx, trackGain);
    } else if (trackId === 'combat') {
      stopFn = this.createCombatSynth(ctx, trackGain);
    }

    t.active = true;
    this.activeNodes.set(trackId, { gain: trackGain, stop: stopFn });
  }

  stopTrack(trackId: string) {
    const active = this.activeNodes.get(trackId);
    const t = this.tracks.find(x => x.id === trackId);
    if (t) t.active = false;

    if (active && this.audioCtx) {
      const ctx = this.audioCtx;
      active.gain.gain.setTargetAtTime(0.001, ctx.currentTime, 0.4);
      setTimeout(() => {
        try {
          active.stop();
          active.gain.disconnect();
        } catch {}
      }, 500);
      this.activeNodes.delete(trackId);
    }
  }

  // ── One-shot SFX generator ──
  playSFX(type: 'dice' | 'sword' | 'magic' | 'trap' | 'monster') {
    this.initAudio();
    if (!this.audioCtx || !this.masterGain) return;
    const ctx = this.audioCtx;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(this.masterVolume * 0.9, ctx.currentTime);
    gain.connect(this.masterGain);

    if (type === 'dice') {
      // 3 petits clics d'impact de dés
      for (let i = 0; i < 4; i++) {
        const time = ctx.currentTime + i * 0.08 + Math.random() * 0.03;
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.frequency.setValueAtTime(450 + Math.random() * 300, time);
        osc.frequency.exponentialRampToValueAtTime(120, time + 0.06);
        g.gain.setValueAtTime(0.8, time);
        g.gain.exponentialRampToValueAtTime(0.01, time + 0.06);
        osc.connect(g);
        g.connect(gain);
        osc.start(time);
        osc.stop(time + 0.07);
      }
    } else if (type === 'magic') {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(320, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1280, ctx.currentTime + 0.6);
      osc.frequency.exponentialRampToValueAtTime(640, ctx.currentTime + 1.2);
      gain.gain.setValueAtTime(0.5, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1.2);
      osc.connect(gain);
      osc.start();
      osc.stop(ctx.currentTime + 1.25);
    } else if (type === 'sword') {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1800, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.25);
      gain.gain.setValueAtTime(0.7, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.connect(gain);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } else if (type === 'trap') {
      const osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.setValueAtTime(150, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.4);
      gain.gain.setValueAtTime(0.9, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
      osc.connect(gain);
      osc.start();
      osc.stop(ctx.currentTime + 0.45);
    } else if (type === 'monster') {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(90, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(120, ctx.currentTime + 0.3);
      osc.frequency.exponentialRampToValueAtTime(45, ctx.currentTime + 0.9);
      gain.gain.setValueAtTime(0.7, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.9);
      osc.connect(gain);
      osc.start();
      osc.stop(ctx.currentTime + 0.95);
    }
  }

  // ── Procedural Sound Synthesis Algorithms ──

  private createNoiseBuffer(ctx: AudioContext, duration = 4): AudioBuffer {
    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  private createRainSynth(ctx: AudioContext, output: GainNode) {
    const noise = ctx.createBufferSource();
    noise.buffer = this.createNoiseBuffer(ctx, 4);
    noise.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1200;

    const highpass = ctx.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.value = 400;

    noise.connect(filter);
    filter.connect(highpass);
    highpass.connect(output);
    noise.start();

    return () => { try { noise.stop(); noise.disconnect(); } catch {} };
  }

  private createThunderSynth(ctx: AudioContext, output: GainNode) {
    let timer: any = null;

    const rumble = () => {
      if (ctx.state === 'closed') return;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(70, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(25, ctx.currentTime + 2.5);

      g.gain.setValueAtTime(0.8, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 2.5);

      osc.connect(g);
      g.connect(output);
      osc.start();
      osc.stop(ctx.currentTime + 2.6);

      timer = setTimeout(rumble, 8000 + Math.random() * 12000);
    };

    rumble();
    return () => { if (timer) clearTimeout(timer); };
  }

  private createFireSynth(ctx: AudioContext, output: GainNode) {
    const noise = ctx.createBufferSource();
    noise.buffer = this.createNoiseBuffer(ctx, 3);
    noise.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 800;
    filter.Q.value = 2.0;

    noise.connect(filter);
    filter.connect(output);
    noise.start();

    // Crackles timer
    let crackleTimer: any = null;
    const crackle = () => {
      if (ctx.state === 'closed') return;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.frequency.value = 1500 + Math.random() * 2500;
      g.gain.setValueAtTime(0.4, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.04);
      osc.connect(g);
      g.connect(output);
      osc.start();
      osc.stop(ctx.currentTime + 0.05);

      crackleTimer = setTimeout(crackle, 200 + Math.random() * 800);
    };
    crackle();

    return () => {
      try { noise.stop(); } catch {}
      if (crackleTimer) clearTimeout(crackleTimer);
    };
  }

  private createWindSynth(ctx: AudioContext, output: GainNode) {
    const noise = ctx.createBufferSource();
    noise.buffer = this.createNoiseBuffer(ctx, 4);
    noise.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 350;
    filter.Q.value = 4.0;

    // Modulation lente du vent
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.2; // 0.2 Hz
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 250;
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);

    noise.connect(filter);
    filter.connect(output);
    noise.start();
    lfo.start();

    return () => {
      try { noise.stop(); lfo.stop(); } catch {}
    };
  }

  private createForestSynth(ctx: AudioContext, output: GainNode) {
    // Breeze + bird chirps
    const windStop = this.createWindSynth(ctx, output);

    let birdTimer: any = null;
    const chirp = () => {
      if (ctx.state === 'closed') return;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      const startFreq = 2200 + Math.random() * 800;
      osc.frequency.setValueAtTime(startFreq, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(startFreq + 600, ctx.currentTime + 0.08);
      osc.frequency.linearRampToValueAtTime(startFreq - 200, ctx.currentTime + 0.16);

      g.gain.setValueAtTime(0.2, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.18);

      osc.connect(g);
      g.connect(output);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);

      birdTimer = setTimeout(chirp, 3000 + Math.random() * 6000);
    };
    birdTimer = setTimeout(chirp, 1500);

    return () => {
      windStop();
      if (birdTimer) clearTimeout(birdTimer);
    };
  }

  private createOceanSynth(ctx: AudioContext, output: GainNode) {
    const noise = ctx.createBufferSource();
    noise.buffer = this.createNoiseBuffer(ctx, 5);
    noise.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 300;

    // Cyclic wave swell
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.1; // 10s wave cycle
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 400;
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);

    noise.connect(filter);
    filter.connect(output);
    noise.start();
    lfo.start();

    return () => {
      try { noise.stop(); lfo.stop(); } catch {}
    };
  }

  private createTavernSynth(ctx: AudioContext, output: GainNode) {
    // Murmure chaleureux + verres qui s'entrechoquent
    const noise = ctx.createBufferSource();
    noise.buffer = this.createNoiseBuffer(ctx, 4);
    noise.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 550;
    filter.Q.value = 1.5;

    noise.connect(filter);
    filter.connect(output);
    noise.start();

    // Tintement de verres
    let glassTimer: any = null;
    const clink = () => {
      if (ctx.state === 'closed') return;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(3200 + Math.random() * 600, ctx.currentTime);
      g.gain.setValueAtTime(0.15, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.005, ctx.currentTime + 0.35);
      osc.connect(g);
      g.connect(output);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);

      glassTimer = setTimeout(clink, 4000 + Math.random() * 8000);
    };
    glassTimer = setTimeout(clink, 2000);

    return () => {
      try { noise.stop(); } catch {}
      if (glassTimer) clearTimeout(glassTimer);
    };
  }

  private createDungeonSynth(ctx: AudioContext, output: GainNode) {
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = 45; // Sub-bass drone

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 180;

    const noise = ctx.createBufferSource();
    noise.buffer = this.createNoiseBuffer(ctx, 4);
    noise.loop = true;
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.value = 180;
    noiseFilter.Q.value = 5.0;

    osc.connect(filter);
    filter.connect(output);
    noise.connect(noiseFilter);
    noiseFilter.connect(output);

    osc.start();
    noise.start();

    return () => {
      try { osc.stop(); noise.stop(); } catch {}
    };
  }

  private createCombatSynth(ctx: AudioContext, output: GainNode) {
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = 65;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 240;

    const lfo = ctx.createOscillator();
    lfo.frequency.value = 2.0; // Tension pulse 120 bpm
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 120;
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);

    osc.connect(filter);
    filter.connect(output);
    osc.start();
    lfo.start();

    return () => {
      try { osc.stop(); lfo.stop(); } catch {}
    };
  }
}

export const soundscape = new SoundscapeStore();
