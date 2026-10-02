// Web Audio API procedural soundscape synthesizer for RPG atmosphere
// Zero external files, 100% lightweight procedural sound synthesis

export type SoundscapeType = 'foret' | 'ruisseau' | 'mine' | 'alchimie' | 'none';

class SoundscapeEngine {
  private ctx: AudioContext | null = null;
  private currentType: SoundscapeType = 'none';
  private masterGain: GainNode | null = null;
  private isMuted: boolean = false;
  private volume: number = 0.35;
  private activeNodes: { stop?: () => void; disconnect?: () => void }[] = [];
  private intervalId: number | null = null;

  private initContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public setVolume(val: number) {
    this.volume = Math.max(0, Math.min(1, val));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.isMuted ? 0 : this.volume, this.ctx.currentTime, 0.05);
    }
  }

  public getVolume(): number {
    return this.volume;
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.isMuted ? 0 : this.volume, this.ctx.currentTime, 0.05);
    }
    return this.isMuted;
  }

  public getCurrentType(): SoundscapeType {
    return this.currentType;
  }

  public stop() {
    this.activeNodes.forEach((n) => {
      try { n.stop?.(); } catch {}
      try { n.disconnect?.(); } catch {}
    });
    this.activeNodes = [];
    if (this.intervalId !== null) {
      window.clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.currentType = 'none';
  }

  public play(type: SoundscapeType) {
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    if (this.currentType === type && this.activeNodes.length > 0) {
      this.stop();
      return;
    }

    this.stop();
    this.currentType = type;

    if (type === 'foret') {
      this.startForestSoundscape();
    } else if (type === 'ruisseau') {
      this.startStreamSoundscape();
    } else if (type === 'mine') {
      this.startMineSoundscape();
    } else if (type === 'alchimie') {
      this.startAlchemySoundscape();
    }
  }

  // 1. Forest & Wind through branches
  private startForestSoundscape() {
    if (!this.ctx || !this.masterGain) return;
    const ctx = this.ctx;

    // Pink noise generator for wind
    const bufferSize = ctx.sampleRate * 2;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.04;
      b6 = white * 0.115926;
    }

    const whiteNoise = ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;
    whiteNoise.loop = true;

    // Low-pass filter simulating wind swell
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(320, ctx.currentTime);

    // LFO to slowly modulate wind intensity
    const lfo = ctx.createOscillator();
    lfo.frequency.setValueAtTime(0.12, ctx.currentTime);
    const lfoGain = ctx.createGain();
    lfoGain.gain.setValueAtTime(180, ctx.currentTime);
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);

    const windGain = ctx.createGain();
    windGain.gain.setValueAtTime(0.7, ctx.currentTime);

    whiteNoise.connect(filter);
    filter.connect(windGain);
    windGain.connect(this.masterGain);

    whiteNoise.start();
    lfo.start();

    this.activeNodes.push(whiteNoise, lfo, filter, windGain);

    // Occasional bird chirp / leaf rustle
    this.intervalId = window.setInterval(() => {
      if (Math.random() > 0.45 && this.ctx && this.masterGain) {
        this.playSoftChirp();
      }
    }, 4500);
  }

  private playSoftChirp() {
    if (!this.ctx || !this.masterGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const now = this.ctx.currentTime;
    const baseFreq = 1800 + Math.random() * 800;

    osc.type = 'sine';
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq + 600, now + 0.08);
    osc.frequency.exponentialRampToValueAtTime(baseFreq + 200, now + 0.16);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.04, now + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.25);
  }

  // 2. Stream & Alluvial Water Panning
  private startStreamSoundscape() {
    if (!this.ctx || !this.masterGain) return;
    const ctx = this.ctx;

    // Water babbling noise
    const bufferSize = ctx.sampleRate * 2;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = (Math.random() * 2 - 1) * 0.15;
    }

    const waterNoise = ctx.createBufferSource();
    waterNoise.buffer = noiseBuffer;
    waterNoise.loop = true;

    const bandpass = ctx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.setValueAtTime(650, ctx.currentTime);
    bandpass.Q.setValueAtTime(2.5, ctx.currentTime);

    // Modulation for river flow
    const lfo = ctx.createOscillator();
    lfo.frequency.setValueAtTime(0.35, ctx.currentTime);
    const lfoGain = ctx.createGain();
    lfoGain.gain.setValueAtTime(250, ctx.currentTime);
    lfo.connect(lfoGain);
    lfoGain.connect(bandpass.frequency);

    const waterGain = ctx.createGain();
    waterGain.gain.setValueAtTime(0.65, ctx.currentTime);

    waterNoise.connect(bandpass);
    bandpass.connect(waterGain);
    waterGain.connect(this.masterGain);

    waterNoise.start();
    lfo.start();

    this.activeNodes.push(waterNoise, lfo, bandpass, waterGain);

    // Gentle water droplets / panning gravel clink
    this.intervalId = window.setInterval(() => {
      if (Math.random() > 0.35 && this.ctx && this.masterGain) {
        this.playWaterBubble();
      }
    }, 2800);
  }

  private playWaterBubble() {
    if (!this.ctx || !this.masterGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const now = this.ctx.currentTime;
    const freq = 450 + Math.random() * 350;

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.8, now + 0.09);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.05, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.16);
  }

  // 3. Dwarven Mine & Crystal Cave Echo
  private startMineSoundscape() {
    if (!this.ctx || !this.masterGain) return;
    const ctx = this.ctx;

    // Deep subterranean low rumble
    const rumbleOsc = ctx.createOscillator();
    rumbleOsc.type = 'triangle';
    rumbleOsc.frequency.setValueAtTime(48, ctx.currentTime);

    const rumbleFilter = ctx.createBiquadFilter();
    rumbleFilter.type = 'lowpass';
    rumbleFilter.frequency.setValueAtTime(85, ctx.currentTime);

    const rumbleGain = ctx.createGain();
    rumbleGain.gain.setValueAtTime(0.35, ctx.currentTime);

    rumbleOsc.connect(rumbleFilter);
    rumbleFilter.connect(rumbleGain);
    rumbleGain.connect(this.masterGain);

    rumbleOsc.start();
    this.activeNodes.push(rumbleOsc, rumbleFilter, rumbleGain);

    // Periodic cavern drip or distant pickaxe chime
    this.intervalId = window.setInterval(() => {
      if (this.ctx && this.masterGain) {
        if (Math.random() > 0.4) {
          this.playCavernDrip();
        } else {
          this.playCrystalChime();
        }
      }
    }, 3200);
  }

  private playCavernDrip() {
    if (!this.ctx || !this.masterGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const now = this.ctx.currentTime;
    const freq = 1200 + Math.random() * 600;

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.5, now + 0.06);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.07, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.4);
  }

  private playCrystalChime() {
    if (!this.ctx || !this.masterGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const now = this.ctx.currentTime;
    const freq = 2100 + Math.random() * 800;

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, now);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.03, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.65);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.7);
  }

  // 4. Alchemy Lab & Crucible Hearth
  private startAlchemySoundscape() {
    if (!this.ctx || !this.masterGain) return;
    const ctx = this.ctx;

    // Fire warmth crackle
    const bufferSize = ctx.sampleRate * 2;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = (Math.random() * 2 - 1) * 0.1;
    }

    const fireNoise = ctx.createBufferSource();
    fireNoise.buffer = noiseBuffer;
    fireNoise.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(450, ctx.currentTime);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.4, ctx.currentTime);

    fireNoise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    fireNoise.start();
    this.activeNodes.push(fireNoise, filter, gain);

    // Crucible bubble simmer
    this.intervalId = window.setInterval(() => {
      if (Math.random() > 0.25 && this.ctx && this.masterGain) {
        this.playSimmerBubble();
      }
    }, 1800);
  }

  private playSimmerBubble() {
    if (!this.ctx || !this.masterGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const now = this.ctx.currentTime;
    const freq = 250 + Math.random() * 180;

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.6, now + 0.08);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.04, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.15);
  }
}

export const soundscapeEngine = new SoundscapeEngine();
