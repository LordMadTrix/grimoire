// ── Audio Acoustics DSP Processor ──────────────────────────────────────────
// Fournit des effets acoustiques en temps réel (Caverne, Grande Cathédrale, Télépathie, Écho)
// pour les voix de narration et de dialogues PNJ via le Web Audio API.

export type AcousticPreset = 'normal' | 'cave' | 'cathedral' | 'telepathy' | 'spectral';

class AudioAcousticsEngine {
  private ctx: AudioContext | null = null;
  private currentPreset: AcousticPreset = 'normal';
  private reverbBufferCache: Map<string, AudioBuffer> = new Map();

  private getContext(): AudioContext {
    if (!this.ctx || this.ctx.state === 'closed') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  setPreset(preset: AcousticPreset) {
    this.currentPreset = preset;
  }

  getPreset(): AcousticPreset {
    return this.currentPreset;
  }

  /**
   * Génère un buffer d'impulsion synthétique pour simuler la réverbération d'une pièce
   */
  private getImpulseBuffer(duration: number, decay: number): AudioBuffer {
    const ctx = this.getContext();
    const cacheKey = `${duration}_${decay}`;
    if (this.reverbBufferCache.has(cacheKey)) {
      return this.reverbBufferCache.get(cacheKey)!;
    }

    const sampleRate = ctx.sampleRate;
    const length = Math.floor(sampleRate * duration);
    const impulse = ctx.createBuffer(2, length, sampleRate);

    for (let channel = 0; channel < 2; channel++) {
      const data = impulse.getChannelData(channel);
      for (let i = 0; i < length; i++) {
        // Bruit blanc atténué de façon exponentielle
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
      }
    }

    this.reverbBufferCache.set(cacheKey, impulse);
    return impulse;
  }

  /**
   * Connecte un élément <audio> à la chaîne d'effets selon le preset choisi
   */
  applyEffects(audioElement: HTMLAudioElement, preset: AcousticPreset = this.currentPreset): { disconnect: () => void } {
    if (preset === 'normal') {
      // Pas de traitement DSP, lecture directe propre
      return { disconnect: () => {} };
    }

    try {
      const ctx = this.getContext();
      // On wrap avec un MediaElementSource
      const source = ctx.createMediaElementSource(audioElement);
      const output = ctx.destination;

      if (preset === 'cave') {
        // 🪨 Caverne : Écho court + Réverbération sombre
        const convolver = ctx.createConvolver();
        convolver.buffer = this.getImpulseBuffer(2.2, 2.5);

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 2400; // Son étouffé par la roche

        const delay = ctx.createDelay();
        delay.delayTime.value = 0.18; // Écho de parois

        const delayGain = ctx.createGain();
        delayGain.gain.value = 0.35;

        // Routage Dry / Wet
        const dryGain = ctx.createGain();
        dryGain.gain.value = 0.85;

        const wetGain = ctx.createGain();
        wetGain.gain.value = 0.55;

        source.connect(dryGain);
        dryGain.connect(output);

        source.connect(filter);
        filter.connect(convolver);
        convolver.connect(wetGain);
        wetGain.connect(output);

        source.connect(delay);
        delay.connect(delayGain);
        delayGain.connect(output);

        return {
          disconnect: () => {
            try {
              source.disconnect();
              dryGain.disconnect();
              wetGain.disconnect();
              convolver.disconnect();
              delay.disconnect();
            } catch {}
          }
        };
      }

      if (preset === 'cathedral') {
        // 🏰 Cathédrale / Nef : Très longue réverbération majestueuse
        const convolver = ctx.createConvolver();
        convolver.buffer = this.getImpulseBuffer(4.0, 1.8);

        const dryGain = ctx.createGain();
        dryGain.gain.value = 0.75;

        const wetGain = ctx.createGain();
        wetGain.gain.value = 0.7;

        source.connect(dryGain);
        dryGain.connect(output);

        source.connect(convolver);
        convolver.connect(wetGain);
        wetGain.connect(output);

        return {
          disconnect: () => {
            try {
              source.disconnect();
              dryGain.disconnect();
              wetGain.disconnect();
              convolver.disconnect();
            } catch {}
          }
        };
      }

      if (preset === 'telepathy') {
        // 🔮 Télépathie : Voix mentale claire filtrée + léger doublage de fréquence
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 1400;
        filter.Q.value = 2.2;

        const delay = ctx.createDelay();
        delay.delayTime.value = 0.04; // 40ms micro-doublage mental

        const wetGain = ctx.createGain();
        wetGain.gain.value = 0.6;

        const dryGain = ctx.createGain();
        dryGain.gain.value = 0.8;

        source.connect(dryGain);
        dryGain.connect(output);

        source.connect(filter);
        filter.connect(delay);
        delay.connect(wetGain);
        wetGain.connect(output);

        return {
          disconnect: () => {
            try {
              source.disconnect();
              filter.disconnect();
              delay.disconnect();
            } catch {}
          }
        };
      }

      if (preset === 'spectral') {
        // 👻 Spectre / Démon : Écho spectral et balayage fantomatique
        const convolver = ctx.createConvolver();
        convolver.buffer = this.getImpulseBuffer(3.0, 1.5);

        const highpass = ctx.createBiquadFilter();
        highpass.type = 'highpass';
        highpass.frequency.value = 450;

        const delay = ctx.createDelay();
        delay.delayTime.value = 0.28;

        const feedback = ctx.createGain();
        feedback.gain.value = 0.4;

        delay.connect(feedback);
        feedback.connect(delay);

        const dryGain = ctx.createGain();
        dryGain.gain.value = 0.7;

        source.connect(dryGain);
        dryGain.connect(output);

        source.connect(highpass);
        highpass.connect(convolver);
        convolver.connect(output);

        source.connect(delay);
        delay.connect(output);

        return {
          disconnect: () => {
            try {
              source.disconnect();
              convolver.disconnect();
              delay.disconnect();
              feedback.disconnect();
            } catch {}
          }
        };
      }
    } catch (err) {
      console.warn('Acoustics DSP fallback (direct output):', err);
    }

    return { disconnect: () => {} };
  }
}

export const audioAcoustics = new AudioAcousticsEngine();

