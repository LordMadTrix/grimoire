// ── Moteur d'Éclairage Dynamique 2D & Torches PixiJS v8 ───────────────────────
// Gère le rendu des halos de lumière (torches, lanternes, sorts lumineux, vision dans le noir)
// avec scintillement dynamique (flicker) et révélation du brouillard de guerre.

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

/**
 * Dessine un halo lumineux doux avec dégradé radial et scintillement
 */
export function drawLightHalo(
  g: PIXI.Graphics,
  config: LightHaloConfig,
  time: number
) {
  const { x, y, radius, color, alpha, flicker } = config;
  
  // Calcul du scintillement organique stochastique (3 composantes de fréquence pour torches & flammes vivantes)
  let actualRadius = radius;
  let actualAlpha = alpha;
  let offsetX = 0;
  let offsetY = 0;

  if (flicker) {
    const h1 = Math.sin(time * 5.2 + (x * 0.07)) * 0.045;
    const h2 = Math.sin(time * 12.7 + (y * 0.05)) * 0.025;
    const h3 = Math.cos(time * 23.1 + ((x + y) * 0.03)) * 0.015;
    const noise = h1 + h2 + h3;

    actualRadius = radius * (1 + noise);
    actualAlpha = Math.max(0.08, Math.min(1.0, alpha * (1 + noise * 1.8)));

    // Micro-oscillation du centre de la flamme au gré de l'air
    offsetX = Math.sin(time * 7.1 + (x * 0.1)) * 1.4;
    offsetY = Math.cos(time * 8.9 + (y * 0.1)) * 1.1;
  }

  const cx = x + offsetX;
  const cy = y + offsetY;

  // 1. Cœur incandescent hyper-lumineux (blanc chaud)
  g.circle(cx, cy, actualRadius * 0.15);
  g.fill({ color: 0xfffdf5, alpha: actualAlpha * 0.7 });

  // 2. Halo intérieur vibrant
  g.circle(cx, cy, actualRadius * 0.35);
  g.fill({ color, alpha: actualAlpha * 0.45 });

  // 3. Diffusion intermédiaire
  g.circle(cx, cy, actualRadius * 0.60);
  g.fill({ color, alpha: actualAlpha * 0.25 });

  // 4. Pénombre étendue
  g.circle(cx, cy, actualRadius * 0.85);
  g.fill({ color, alpha: actualAlpha * 0.12 });

  // 5. Frange douce d'atténuation
  g.circle(cx, cy, actualRadius);
  g.fill({ color, alpha: actualAlpha * 0.04 });
}

/**
 * Met à jour le calque d'éclairage complet pour tous les jetons et sources de lumière actives
 */
export function updateDynamicLighting(
  lightingGraphics: PIXI.Graphics,
  tokens: Token[],
  customLights: LightSource[] = [],
  timeSeconds: number
) {
  lightingGraphics.clear();

  // 1. Rendu des torches et lanternes portées par les pions (Tokens)
  for (const token of tokens) {
    // Si le pion a une torche ou une source de lumière
    if (token.lightRadius && token.lightRadius > 0) {
      let color = 0xffaa44; // Ambre chaleureux de torche par défaut
      if (token.lightColor) {
        const parsed = parseInt(token.lightColor.replace('#', ''), 16);
        if (!isNaN(parsed)) color = parsed;
      }

      drawLightHalo(lightingGraphics, {
        x: token.x,
        y: token.y,
        radius: token.lightRadius * 5, // Conversion échelle pixels
        color,
        alpha: 0.65,
        flicker: token.lightFlicker !== false
      }, timeSeconds);
    }

    // Vision dans le noir (Darkvision : halo bleuté/violet subtil)
    if (token.darkvision) {
      drawLightHalo(lightingGraphics, {
        x: token.x,
        y: token.y,
        radius: (token.visionRange || 60) * 3,
        color: 0x818cf8, // Violet bleuté nocturne
        alpha: 0.2,
        flicker: false
      }, timeSeconds);
    }
  }

  // 2. Rendu des sources de lumière fixes de la carte
  for (const light of customLights) {
    let color = 0xffb703;
    if (light.type === 'magical') color = 0x38bdf8; // Bleu magique
    else if (light.type === 'candle') color = 0xfdba74; // Bougie

    drawLightHalo(lightingGraphics, {
      x: light.x,
      y: light.y,
      radius: light.radius,
      color,
      alpha: light.intensity || 0.6,
      flicker: light.flicker ?? true
    }, timeSeconds);
  }
}
