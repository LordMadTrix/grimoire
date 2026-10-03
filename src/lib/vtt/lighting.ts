// ── Moteur d'Éclairage Dynamique 2D & Torches PixiJS v8 ───────────────────────
// Gère le rendu des halos de lumière (torches, lanternes, sorts lumineux, vision dans le noir)
// avec scintillement dynamique (flicker) et rendu Sprite GPU zéro-allocation CPU.

import * as PIXI from 'pixi.js';
import type { Token, LightSource } from '$lib/stores/vtt.svelte';

export interface LightHaloConfig {
  x: number;
  y: number;
  radius: number;
  color: number;
  alpha: number;
  flicker?: boolean;
}

let cachedRadialTexture: PIXI.Texture | null = null;

/**
 * Génère une texture de halo radial doux une seule fois sur le GPU (128x128)
 */
export function getRadialLightTexture(): PIXI.Texture {
  if (cachedRadialTexture && cachedRadialTexture.source) {
    return cachedRadialTexture;
  }
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    grad.addColorStop(0.2, 'rgba(255, 255, 255, 0.7)');
    grad.addColorStop(0.5, 'rgba(255, 255, 255, 0.25)');
    grad.addColorStop(0.8, 'rgba(255, 255, 255, 0.05)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);
  }
  cachedRadialTexture = PIXI.Texture.from(canvas);
  return cachedRadialTexture;
}

/**
 * Met à jour le calque d'éclairage complet pour tous les jetons et sources de lumière actives
 * sans aucune réallocation ni tessellation CPU (Sprites GPU quads avec mise à l'échelle & teinte)
 */
export function updateDynamicLighting(
  container: PIXI.Container,
  tokens: Token[],
  customLights: LightSource[] = [],
  timeSeconds: number
) {
  const lightTexture = getRadialLightTexture();
  const activeConfigs: LightHaloConfig[] = [];

  // 1. Rendu des torches et lanternes portées par les pions (Tokens)
  for (const token of tokens) {
    if (token.lightRadius && token.lightRadius > 0) {
      let color = 0xffaa44; // Ambre chaleureux par défaut
      if (token.lightColor) {
        const parsed = parseInt(token.lightColor.replace('#', ''), 16);
        if (!isNaN(parsed)) color = parsed;
      }

      activeConfigs.push({
        x: token.x,
        y: token.y,
        radius: token.lightRadius * 5, // Conversion échelle pixels
        color,
        alpha: 0.75,
        flicker: token.lightFlicker !== false
      });
    }

    // Vision dans le noir (Darkvision : halo bleuté/violet nocturne)
    if (token.darkvision) {
      activeConfigs.push({
        x: token.x,
        y: token.y,
        radius: (token.visionRange || 60) * 3,
        color: 0x818cf8,
        alpha: 0.25,
        flicker: false
      });
    }
  }

  // 2. Rendu des sources de lumière fixes de la carte
  for (const light of customLights) {
    let color = 0xffb703;
    if (light.type === 'magical') color = 0x38bdf8;
    else if (light.type === 'candle') color = 0xfdba74;

    activeConfigs.push({
      x: light.x,
      y: light.y,
      radius: light.radius,
      color,
      alpha: light.intensity || 0.6,
      flicker: light.flicker ?? true
    });
  }

  // Synchronisation du pool de Sprites GPU
  while (container.children.length < activeConfigs.length) {
    const sprite = new PIXI.Sprite(lightTexture);
    sprite.anchor.set(0.5);
    sprite.blendMode = 'add';
    container.addChild(sprite);
  }
  while (container.children.length > activeConfigs.length) {
    const removed = container.removeChild(container.children[container.children.length - 1]);
    removed.destroy();
  }

  // Mise à jour continue (pure transformation matricielle GPU sans coût CPU)
  for (let i = 0; i < activeConfigs.length; i++) {
    const cfg = activeConfigs[i];
    const sprite = container.children[i] as PIXI.Sprite;
    let actualRadius = cfg.radius;
    let actualAlpha = cfg.alpha;
    let offsetX = 0;
    let offsetY = 0;

    if (cfg.flicker) {
      const h1 = Math.sin(timeSeconds * 5.2 + (cfg.x * 0.07)) * 0.045;
      const h2 = Math.sin(timeSeconds * 12.7 + (cfg.y * 0.05)) * 0.025;
      const noise = h1 + h2;
      actualRadius = cfg.radius * (1 + noise);
      actualAlpha = Math.max(0.08, Math.min(1.0, cfg.alpha * (1 + noise * 1.8)));
      offsetX = Math.sin(timeSeconds * 7.1 + (cfg.x * 0.1)) * 1.4;
      offsetY = Math.cos(timeSeconds * 8.9 + (cfg.y * 0.1)) * 1.1;
    }

    sprite.x = cfg.x + offsetX;
    sprite.y = cfg.y + offsetY;
    const diameter = actualRadius * 2;
    sprite.width = diameter;
    sprite.height = diameter;
    sprite.tint = cfg.color;
    sprite.alpha = actualAlpha;
    sprite.visible = true;
  }
}
