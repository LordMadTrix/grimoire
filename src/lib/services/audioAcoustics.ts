// ── Audio Acoustics DSP Processor ──────────────────────────────────────────
// Fournit des effets acoustiques en temps réel (Caverne, Grande Cathédrale, Télépathie, Écho, Voix Divine, Démon)
// ainsi que la synthèse procédurale de bruits de pas et projectiles magiques pour la table VTT.

export type AcousticPreset = 'normal' | 'cave' | 'cathedral' | 'telepathy' | 'spectral' | 'divine' | 'demonic';

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

      if (preset === 'divine') {
        // 👑 Voix Divine / Entité Céleste : Réverbération cathédrale longue + doublement éthéré scintillant
        const convolver = ctx.createConvolver();
        convolver.buffer = this.getImpulseBuffer(3.8, 1.2);

        const highShelf = ctx.createBiquadFilter();
        highShelf.type = 'highshelf';
        highShelf.frequency.value = 3200;
        highShelf.gain.value = 5.0; // Brillance angélique

        const microDelay = ctx.createDelay();
        microDelay.delayTime.value = 0.055; // 55ms dédoublement de voix

        const shimmerGain = ctx.createGain();
        shimmerGain.gain.value = 0.55;

        const dryGain = ctx.createGain();
        dryGain.gain.value = 0.85;

        source.connect(dryGain);
        dryGain.connect(output);

        source.connect(microDelay);
        microDelay.connect(highShelf);
        highShelf.connect(convolver);
        convolver.connect(shimmerGain);
        shimmerGain.connect(output);

        return {
          disconnect: () => {
            try {
              source.disconnect();
              microDelay.disconnect();
              highShelf.disconnect();
              convolver.disconnect();
            } catch {}
          }
        };
      }

      if (preset === 'demonic') {
        // 👹 Voix Démoniaque : Résonance d'outre-tombe, renfort de basses et distorsion caverneuse
        const lowpass = ctx.createBiquadFilter();
        lowpass.type = 'lowpass';
        lowpass.frequency.value = 950;

        const lowShelf = ctx.createBiquadFilter();
        lowShelf.type = 'lowshelf';
        lowShelf.frequency.value = 180;
        lowShelf.gain.value = 8.0; // Grave abyssal

        const convolver = ctx.createConvolver();
        convolver.buffer = this.getImpulseBuffer(2.8, 2.4);

        const wetGain = ctx.createGain();
        wetGain.gain.value = 0.7;

        const dryGain = ctx.createGain();
        dryGain.gain.value = 0.75;

        source.connect(dryGain);
        dryGain.connect(output);

        source.connect(lowShelf);
        lowShelf.connect(lowpass);
        lowpass.connect(convolver);
        convolver.connect(wetGain);
        wetGain.connect(output);

        return {
          disconnect: () => {
            try {
              source.disconnect();
              lowShelf.disconnect();
              lowpass.disconnect();
              convolver.disconnect();
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

  /**
   * Bruit de pas synthétique procédural ultra-léger selon le type de surface
   */
  playFootstep(surface: 'stone' | 'water' | 'wood' | 'foliage' = 'stone', volume: number = 0.22) {
    try {
      const ctx = this.getContext();
      const t0 = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      if (surface === 'water') {
        // Splash liquide
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(320, t0);
        osc.frequency.exponentialRampToValueAtTime(140, t0 + 0.12);
        filter.type = 'lowpass';
        filter.frequency.value = 800;
        gain.gain.setValueAtTime(volume * 0.9, t0);
        gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.12);
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t0);
        osc.stop(t0 + 0.13);
      } else if (surface === 'wood') {
        // Toc de parquet/bois
        osc.type = 'sine';
        osc.frequency.setValueAtTime(180, t0);
        osc.frequency.exponentialRampToValueAtTime(60, t0 + 0.08);
        gain.gain.setValueAtTime(volume * 0.8, t0);
        gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.08);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t0);
        osc.stop(t0 + 0.09);
      } else if (surface === 'foliage') {
        // Bruissement d'herbe (bruit blanc court)
        const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.08), ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
        const src = ctx.createBufferSource();
        src.buffer = buf;
        filter.type = 'bandpass';
        filter.frequency.value = 2400;
        gain.gain.setValueAtTime(volume * 0.7, t0);
        gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.08);
        src.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        src.start(t0);
      } else {
        // Pierre / Donjon : clac sec et sourd
        osc.type = 'sine';
        osc.frequency.setValueAtTime(120, t0);
        osc.frequency.exponentialRampToValueAtTime(45, t0 + 0.07);
        gain.gain.setValueAtTime(volume, t0);
        gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.07);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t0);
        osc.stop(t0 + 0.08);
      }
    } catch {}
  }

  /**
   * Effet sonore synthétique de projectile ou sortilège
   */
  playProjectileSound(type: 'arrow' | 'fire' | 'magic' | 'lightning') {
    try {
      const ctx = this.getContext();
      const t0 = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      if (type === 'arrow') {
        // Sifflement d'empennage
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(800, t0);
        osc.frequency.exponentialRampToValueAtTime(120, t0 + 0.25);
        gain.gain.setValueAtTime(0.25, t0);
        gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.25);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t0);
        osc.stop(t0 + 0.26);
      } else if (type === 'fire') {
        // Vrombissement ardent
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(180, t0);
        osc.frequency.exponentialRampToValueAtTime(70, t0 + 0.35);
        gain.gain.setValueAtTime(0.3, t0);
        gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t0);
        osc.stop(t0 + 0.36);
      } else if (type === 'lightning') {
        // Craquement foudroyant
        osc.type = 'square';
        osc.frequency.setValueAtTime(1200, t0);
        osc.frequency.exponentialRampToValueAtTime(60, t0 + 0.28);
        gain.gain.setValueAtTime(0.35, t0);
        gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.28);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t0);
        osc.stop(t0 + 0.29);
      } else {
        // Magie cristalline
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, t0);
        osc.frequency.linearRampToValueAtTime(880, t0 + 0.15);
        osc.frequency.exponentialRampToValueAtTime(220, t0 + 0.35);
        gain.gain.setValueAtTime(0.28, t0);
        gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t0);
        osc.stop(t0 + 0.36);
      }
    } catch {}
  }
}

export const audioAcoustics = new AudioAcousticsEngine();

