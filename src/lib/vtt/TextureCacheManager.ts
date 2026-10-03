import * as PIXI from 'pixi.js';

/**
 * Gestionnaire de cycle de vie des textures PixiJS v8 pour le VTT.
 * Prévient les fuites de VRAM GPU lors des changements de cartes HD (4K+) et du switch de scènes.
 */
export class TextureCacheManager {
  private static activeTextures: Map<string, PIXI.Texture> = new Map();

  /**
   * Charge une texture de carte à partir d'une URL / chemin local avec mise en cache et contrôle d'erreur.
   */
  public static async loadMapTexture(url: string): Promise<PIXI.Texture> {
    const existing = this.activeTextures.get(url);
    if (existing && !existing.destroyed) {
      return existing;
    }

    try {
      const img = new Image();
      img.referrerPolicy = 'no-referrer';
      img.crossOrigin = 'anonymous';

      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error(`Impossible de charger l'image de la carte : ${url}`));
        img.src = url;
      });

      const texture = PIXI.Texture.from(img);
      this.activeTextures.set(url, texture);
      return texture;
    } catch (err) {
      console.error('[TextureCacheManager] Erreur lors du chargement de la texture :', err);
      throw err;
    }
  }

  /**
   * Décharge proprement une texture spécifique et libère la mémoire GPU associée.
   */
  public static unloadTexture(url: string): void {
    const texture = this.activeTextures.get(url);
    if (texture) {
      if (!texture.destroyed) {
        texture.destroy(true);
      }
      this.activeTextures.delete(url);
      try {
        PIXI.Assets.unload(url).catch(() => {});
      } catch {
        // Ignorer si l'asset n'était pas enregistré dans le loader d'Assets global
      }
    }
  }

  /**
   * Purge toutes les textures en cache lors de la fermeture de la vue VTT.
   */
  public static purgeAll(): void {
    for (const [url, texture] of this.activeTextures.entries()) {
      if (!texture.destroyed) {
        texture.destroy(true);
      }
      try {
        PIXI.Assets.unload(url).catch(() => {});
      } catch {
        // Ignorer
      }
    }
    this.activeTextures.clear();
  }
}
