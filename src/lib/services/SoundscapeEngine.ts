/**
 * Moteur sonore immersif Web Audio API pour Grimoire.
 * Fournit un singleton AudioContext avec crossfade logarithmique et spatialisation stéréo.
 */
export class SoundscapeEngine {
  private static ctx: AudioContext | null = null;
  private static activeSource: AudioBufferSourceNode | null = null;
  private static activeGain: GainNode | null = null;
  private static masterGain: GainNode | null = null;

  /**
   * Initialise ou réveille le contexte Web Audio API (requis après interaction utilisateur).
   */
  public static getContext(): AudioContext {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.8, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  /**
   * Définit le volume global du moteur.
   */
  public static setMasterVolume(val: number): void {
    const clamped = Math.max(0, Math.min(1, val));
    const ctx = this.getContext();
    if (this.masterGain) {
      this.masterGain.gain.setValueAtTime(clamped, ctx.currentTime);
    }
  }

  /**
   * Décode un buffer binaire en AudioBuffer exploitable.
   */
  public static async decodeAudio(arrayBuffer: ArrayBuffer): Promise<AudioBuffer> {
    const ctx = this.getContext();
    return await ctx.decodeAudioData(arrayBuffer);
  }

  /**
   * Joue une ambiance avec transition en fondu croisé (crossfade) logarithmique sans clic.
   * @param buffer AudioBuffer de la piste sonore
   * @param fadeSeconds Durée de transition en secondes
   */
  public static playWithCrossfade(buffer: AudioBuffer, fadeSeconds: number = 2.0): void {
    const ctx = this.getContext();
    const now = ctx.currentTime;

    const newSource = ctx.createBufferSource();
    newSource.buffer = buffer;
    newSource.loop = true;

    const newGain = ctx.createGain();
    newGain.gain.setValueAtTime(0.0001, now);
    newGain.gain.exponentialRampToValueAtTime(1.0, now + fadeSeconds);

    newSource.connect(newGain);
    if (this.masterGain) {
      newGain.connect(this.masterGain);
    } else {
      newGain.connect(ctx.destination);
    }

    newSource.start();

    // Fade-out et arrêt de la piste précédente
    if (this.activeSource && this.activeGain) {
      const oldSource = this.activeSource;
      const oldGain = this.activeGain;

      oldGain.gain.setValueAtTime(Math.max(0.0001, oldGain.gain.value), now);
      oldGain.gain.exponentialRampToValueAtTime(0.0001, now + fadeSeconds);

      setTimeout(() => {
        try {
          oldSource.stop();
          oldSource.disconnect();
          oldGain.disconnect();
        } catch {
          // Déjà stoppé
        }
      }, fadeSeconds * 1000 + 100);
    }

    this.activeSource = newSource;
    this.activeGain = newGain;
  }

  /**
   * Coupe doucement l'ambiance active avec fade-out.
   */
  public static stop(fadeSeconds: number = 1.0): void {
    if (!this.ctx || !this.activeSource || !this.activeGain) return;
    const now = this.ctx.currentTime;
    const oldSource = this.activeSource;
    const oldGain = this.activeGain;

    oldGain.gain.setValueAtTime(Math.max(0.0001, oldGain.gain.value), now);
    oldGain.gain.exponentialRampToValueAtTime(0.0001, now + fadeSeconds);

    setTimeout(() => {
      try {
        oldSource.stop();
        oldSource.disconnect();
        oldGain.disconnect();
      } catch {
        // Déjà stoppé
      }
    }, fadeSeconds * 1000 + 50);

    this.activeSource = null;
    this.activeGain = null;
  }
}
