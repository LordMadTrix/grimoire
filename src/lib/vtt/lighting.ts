// ── Moteur d'Éclairage Dynamique 2D & Torches PixiJS v8 ───────────────────────
// Gère le rendu des halos de lumière (torches, lanternes, sorts lumineux, vision dans le noir)
// avec scintillement dynamique (flicker) et rendu Sprite GPU zéro-allocation CPU.

import * as PIXI from 'pixi.js';
import type { Token, LightSource, WallDef } from '$lib/stores/vtt.svelte';

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

// ── Géométrie Vision, Line of Sight & Champ de Vue (FOV) ─────────────────────

/**
 * Détermine si deux segments [p1, p2] et [p3, p4] s'intersectent strictement
 */
export function segmentsIntersect(
  p1x: number, p1y: number, p2x: number, p2y: number,
  p3x: number, p3y: number, p4x: number, p4y: number
): boolean {
  const d = (p2x - p1x) * (p4y - p3y) - (p2y - p1y) * (p4x - p3x);
  if (Math.abs(d) < 1e-9) return false;
  const t = ((p3x - p1x) * (p4y - p3y) - (p3y - p1y) * (p4x - p3x)) / d;
  const u = ((p3x - p1x) * (p2y - p1y) - (p3y - p1y) * (p2x - p1x)) / d;
  return t > 0.002 && t < 0.998 && u > 0.002 && u < 0.998;
}

/**
 * Vérifie si la ligne de vue directe entre deux points (ex: observateur et cible)
 * est dégagée ou bloquée par un mur opaque (Line of Sight). Les portes ouvertes laissent passer la vue.
 */
export function hasLineOfSight(
  x1: number, y1: number,
  x2: number, y2: number,
  walls: WallDef[]
): boolean {
  if (!walls || walls.length === 0) return true;
  for (const wall of walls) {
    if (wall.type === 'door' && wall.isOpen) continue;
    if (!wall.points || wall.points.length < 2) continue;
    for (let i = 0; i < wall.points.length - 1; i++) {
      const a = wall.points[i];
      const b = wall.points[i + 1];
      if (segmentsIntersect(x1, y1, x2, y2, a.x, a.y, b.x, b.y)) {
        return false;
      }
    }
  }
  return true;
}

/**
 * Vérifie si un point cible (tx, ty) se situe à l'intérieur du champ de vision
 * orienté de l'observateur (ox, oy).
 * @param rotDeg Orientation du regard en degrés (0 = Nord, 90 = Est, 180 = Sud, 270 = Ouest)
 * @param fovAngle Angle d'ouverture en degrés (360 = cercle omnidirectionnel)
 */
export function isPointInFieldOfView(
  ox: number, oy: number, rotDeg: number, fovAngle: number,
  tx: number, ty: number
): boolean {
  if (!fovAngle || fovAngle >= 360) return true;
  // Angle du vecteur (ox, oy) -> (tx, ty) en radians
  const angleRad = Math.atan2(ty - oy, tx - ox);
  // Direction de visée du token (0° = Nord = -PI/2)
  const dirRad = ((rotDeg - 90) * Math.PI) / 180;
  // Différence d'angle normalisée dans [-PI, PI]
  let diff = angleRad - dirRad;
  while (diff > Math.PI) diff -= 2 * Math.PI;
  while (diff < -Math.PI) diff += 2 * Math.PI;
  const halfFovRad = (fovAngle * Math.PI) / 360;
  return Math.abs(diff) <= halfFovRad;
}

export interface ProjectileShooterLike {
  id: string;
  name: string;
  x: number;
  y: number;
  isEnemy?: boolean;
  rotation?: number;
  physicalRotation?: number;
  visionAngle?: number;
  visionRange?: number;
}

/**
 * Calcule la cible d'un tir de projectile :
 * 1. Dans l'angle de vision du tireur :
 *    - Vers l'ennemi situé dans son champ de vision si présent.
 *    - Sinon tout droit le long de son angle de regard.
 * 2. Si le tireur n'a pas d'angle défini (rotation indéterminée) :
 *    - Vise l'ennemi le plus proche sur la carte.
 * 3. Si aucun ennemi : tir droit devant.
 */
export function computeProjectileTarget<T extends ProjectileShooterLike>(
  shooter: T,
  tokens: T[],
  rangeDistance: number = 420
): { toX: number; toY: number; targetEnemy?: T; mode: 'fov_enemy' | 'fov_direction' | 'nearest_enemy' | 'default_direction' } {
  const rotDeg = shooter.rotation ?? shooter.physicalRotation;
  const hasAngle = rotDeg !== undefined && rotDeg !== null;

  // Filtrer les ennemis du tireur (un PJ vise un ennemi, un ennemi vise un PJ)
  const enemies = tokens.filter(t => t.id !== shooter.id && !!t.isEnemy !== !!shooter.isEnemy);

  if (hasAngle) {
    const dirRad = ((rotDeg - 90) * Math.PI) / 180;
    const fov = (shooter.visionAngle && shooter.visionAngle < 360) ? shooter.visionAngle : 90;

    // 1. Chercher un ennemi dans le champ de vision du tireur
    const enemiesInFov = enemies.filter(e =>
      isPointInFieldOfView(shooter.x, shooter.y, rotDeg, fov, e.x, e.y)
    );

    if (enemiesInFov.length > 0) {
      // Ennemi le plus proche dans le champ de vision
      enemiesInFov.sort((a, b) => {
        const da = Math.hypot(a.x - shooter.x, a.y - shooter.y);
        const db = Math.hypot(b.x - shooter.x, b.y - shooter.y);
        return da - db;
      });
      const target = enemiesInFov[0];
      return { toX: target.x, toY: target.y, targetEnemy: target, mode: 'fov_enemy' };
    }

    // 2. Pas d'ennemi dans le champ de vision : tire dans l'angle de vision du tireur
    const dist = shooter.visionRange ? Math.max(rangeDistance, shooter.visionRange * 50) : rangeDistance;
    return {
      toX: Math.round(shooter.x + Math.cos(dirRad) * dist),
      toY: Math.round(shooter.y + Math.sin(dirRad) * dist),
      mode: 'fov_direction'
    };
  }

  // 3. Pas d'angle de vision défini : tirer vers l'ennemi le plus proche sur la carte
  if (enemies.length > 0) {
    enemies.sort((a, b) => {
      const da = Math.hypot(a.x - shooter.x, a.y - shooter.y);
      const db = Math.hypot(b.x - shooter.x, b.y - shooter.y);
      return da - db;
    });
    const target = enemies[0];
    return { toX: target.x, toY: target.y, targetEnemy: target, mode: 'nearest_enemy' };
  }

  // 4. Aucun ennemi : tir par défaut vers l'avant (Est)
  return {
    toX: shooter.x + rangeDistance,
    toY: shooter.y,
    mode: 'default_direction'
  };
}
