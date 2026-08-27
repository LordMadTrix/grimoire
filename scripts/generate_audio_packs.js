import fs from 'fs';
import path from 'path';

const basePublic = path.resolve('public/assets/audio');
const baseVault = path.resolve('wfrp_vault/assets/audio');

const categories = [
  'Ambiances',
  'Musiques_Combat',
  'Musiques_Exploration',
  'Bruitages_SFX'
];

for (const cat of categories) {
  fs.mkdirSync(path.join(basePublic, cat), { recursive: true });
  fs.mkdirSync(path.join(baseVault, cat), { recursive: true });
}

// Helper: Create 16-bit stereo WAV buffer
function createWavBuffer(samplesLeft, samplesRight, sampleRate = 44100) {
  const numSamples = samplesLeft.length;
  const buffer = Buffer.alloc(44 + numSamples * 4);

  // RIFF identifier
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + numSamples * 4, 4);
  buffer.write('WAVE', 8);

  // fmt subchunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // subchunk1 size
  buffer.writeUInt16LE(1, 20);  // PCM format
  buffer.writeUInt16LE(2, 22);  // 2 channels (Stereo)
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 4, 28); // byte rate
  buffer.writeUInt16LE(4, 32);  // block align
  buffer.writeUInt16LE(16, 34); // 16 bits per sample

  // data subchunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(numSamples * 4, 40);

  for (let i = 0; i < numSamples; i++) {
    const sL = Math.max(-1, Math.min(1, samplesLeft[i]));
    const sR = Math.max(-1, Math.min(1, samplesRight[i]));
    const valL = sL < 0 ? sL * 0x8000 : sL * 0x7FFF;
    const valR = sR < 0 ? sR * 0x8000 : sR * 0x7FFF;
    buffer.writeInt16LE(Math.floor(valL), 44 + i * 4);
    buffer.writeInt16LE(Math.floor(valR), 44 + i * 4 + 2);
  }

  return buffer;
}

const sampleRate = 44100;

function saveAudio(category, filename, samplesL, samplesR) {
  const buffer = createWavBuffer(samplesL, samplesR, sampleRate);
  const pathPub = path.join(basePublic, category, filename);
  const pathVlt = path.join(baseVault, category, filename);
  fs.writeFileSync(pathPub, buffer);
  fs.writeFileSync(pathVlt, buffer);
  console.log(`✓ Généré et classé: [${category}] ${filename} (${(buffer.length / 1024 / 1024).toFixed(2)} MB)`);
}

// ── 1. AMBIANCES ─────────────────────────────────────────────────────────────

// Pluie et Tonnerre (15s Loopable)
function genRainAndThunder() {
  const duration = 15;
  const N = sampleRate * duration;
  const L = new Float32Array(N);
  const R = new Float32Array(N);

  let lastOutL = 0;
  let lastOutR = 0;

  for (let i = 0; i < N; i++) {
    const t = i / sampleRate;
    // Pink noise rain
    const whiteL = Math.random() * 2 - 1;
    const whiteR = Math.random() * 2 - 1;
    lastOutL = (lastOutL * 0.92) + (whiteL * 0.08);
    lastOutR = (lastOutR * 0.92) + (whiteR * 0.08);
    
    // Rain droplets (high frequency clicks)
    const drop = (Math.random() < 0.005) ? (Math.random() - 0.5) * 0.25 : 0;

    // Thunder rumble at t = 3s and t = 10s
    let thunder = 0;
    if (t >= 2.5 && t <= 7.0) {
      const tt = t - 2.5;
      const env = Math.exp(-tt * 0.9) * Math.sin(tt * 4);
      thunder += (Math.random() * 2 - 1) * env * 0.6 * Math.sin(tt * 35);
    }
    if (t >= 9.5 && t <= 14.0) {
      const tt = t - 9.5;
      const env = Math.exp(-tt * 0.8) * Math.sin(tt * 3);
      thunder += (Math.random() * 2 - 1) * env * 0.45 * Math.sin(tt * 28);
    }

    L[i] = (lastOutL * 0.4 + drop + thunder) * 0.8;
    R[i] = (lastOutR * 0.4 + drop + thunder * 0.9) * 0.8;
  }
  return { L, R };
}

// Feu de Camp (15s Loopable)
function genCampfire() {
  const duration = 15;
  const N = sampleRate * duration;
  const L = new Float32Array(N);
  const R = new Float32Array(N);
  let rumble = 0;

  for (let i = 0; i < N; i++) {
    const t = i / sampleRate;
    // Low frequency warmth rumble
    const noise = Math.random() * 2 - 1;
    rumble = (rumble * 0.96) + (noise * 0.04);

    // Wood crackles and pops
    let crackle = 0;
    if (Math.random() < 0.003) {
      crackle = (Math.random() - 0.5) * 0.7;
    }
    if (Math.random() < 0.0008) {
      crackle = (Math.random() - 0.5) * 1.2;
    }

    // Flame flutter
    const flutter = Math.sin(t * 12 + Math.sin(t * 3) * 2) * 0.1;

    L[i] = (rumble * 1.2 + crackle + flutter * 0.5) * 0.75;
    R[i] = (rumble * 1.1 + crackle * 0.9 + flutter * 0.6) * 0.75;
  }
  return { L, R };
}

// Vent Glacial / Tempête (15s)
function genIcyWind() {
  const duration = 15;
  const N = sampleRate * duration;
  const L = new Float32Array(N);
  const R = new Float32Array(N);
  let lpL = 0, lpR = 0;

  for (let i = 0; i < N; i++) {
    const t = i / sampleRate;
    const howlMod = Math.sin(t * 0.6) * 0.4 + Math.sin(t * 1.4) * 0.2 + 0.5;
    const whiteL = Math.random() * 2 - 1;
    const whiteR = Math.random() * 2 - 1;

    lpL = lpL * 0.97 + (whiteL * Math.sin(t * 220 * howlMod)) * 0.03;
    lpR = lpR * 0.97 + (whiteR * Math.sin(t * 240 * howlMod)) * 0.03;

    L[i] = lpL * 2.2 * howlMod;
    R[i] = lpR * 2.2 * howlMod;
  }
  return { L, R };
}

// Crypte Maudite & Ténèbres (15s)
function genCursedCrypt() {
  const duration = 15;
  const N = sampleRate * duration;
  const L = new Float32Array(N);
  const R = new Float32Array(N);

  for (let i = 0; i < N; i++) {
    const t = i / sampleRate;
    // Low sub drone (55 Hz & 82.4 Hz)
    const drone1 = Math.sin(2 * Math.PI * 55 * t) * 0.35;
    const drone2 = Math.sin(2 * Math.PI * 82.4 * t + Math.sin(t * 0.2)) * 0.25;
    const drone3 = Math.sin(2 * Math.PI * 110 * t) * 0.15 * (Math.sin(t * 0.5) * 0.5 + 0.5);

    // Whispery airy noise
    const air = (Math.random() * 2 - 1) * 0.04 * (Math.sin(t * 0.8) * 0.5 + 0.5);

    L[i] = (drone1 + drone2 + drone3 * 0.8 + air) * 0.85;
    R[i] = (drone1 * 0.9 + drone2 * 1.1 + drone3 + air) * 0.85;
  }
  return { L, R };
}

// ── 2. MUSIQUES DE COMBAT ───────────────────────────────────────────────────

// Tambours de Guerre (12s Loop)
function genWarDrums() {
  const duration = 12;
  const N = sampleRate * duration;
  const L = new Float32Array(N);
  const R = new Float32Array(N);

  const bpm = 120;
  const beatLen = 60 / bpm; // 0.5s per beat

  for (let i = 0; i < N; i++) {
    const t = i / sampleRate;
    const beatIndex = Math.floor(t / beatLen);
    const beatPos = (t % beatLen);

    let drum = 0;
    // Heavy bass drum on beats 0, 1.5, 2, 3
    if (beatPos < 0.25) {
      const env = Math.exp(-beatPos * 25);
      const freq = 65 * Math.exp(-beatPos * 15);
      drum += Math.sin(2 * Math.PI * freq * beatPos) * env * 0.8;
    }

    // War Tom on sub-beats
    const subPos = (t % (beatLen / 2));
    if (subPos < 0.18) {
      const envTom = Math.exp(-subPos * 30);
      const freqTom = 130 * Math.exp(-subPos * 18);
      drum += Math.sin(2 * Math.PI * freqTom * subPos) * envTom * 0.45;
    }

    // Metallic hit on 4th beat
    if (beatIndex % 4 === 3 && beatPos < 0.3) {
      const envRim = Math.exp(-beatPos * 18);
      drum += (Math.random() * 2 - 1) * envRim * 0.35;
    }

    L[i] = drum * 0.85;
    R[i] = drum * 0.85;
  }
  return { L, R };
}

// Tension et Péril (12s Loop)
function genCombatTension() {
  const duration = 12;
  const N = sampleRate * duration;
  const L = new Float32Array(N);
  const R = new Float32Array(N);

  for (let i = 0; i < N; i++) {
    const t = i / sampleRate;
    // Fast pulsing bass (16th notes at 130 BPM)
    const pulseT = t % (60 / 130 / 4);
    const pulseEnv = Math.exp(-pulseT * 40);
    const bass = Math.sin(2 * Math.PI * 73.4 * t) * pulseEnv * 0.5;

    // Discordant string sweep
    const swell = Math.sin(t * 0.5) * 0.5 + 0.5;
    const discord = (Math.sin(2 * Math.PI * 220 * t) + Math.sin(2 * Math.PI * 233.08 * t)) * 0.15 * swell;

    L[i] = (bass + discord) * 0.85;
    R[i] = (bass + discord * 0.9) * 0.85;
  }
  return { L, R };
}

// ── 3. MUSIQUES D'EXPLORATION ───────────────────────────────────────────────

// Voyage en Empire / Luth Médiéval (14s Loop)
function genMedievalJourney() {
  const duration = 14;
  const N = sampleRate * duration;
  const L = new Float32Array(N);
  const R = new Float32Array(N);

  // Notes: D minor pentatonic (D3, F3, G3, A3, C4, D4)
  const freqs = [146.83, 174.61, 196.00, 220.00, 261.63, 293.66];
  const noteDuration = 0.4;

  for (let i = 0; i < N; i++) {
    const t = i / sampleRate;
    const noteIdx = Math.floor(t / noteDuration) % freqs.length;
    const noteT = t % noteDuration;
    const f = freqs[noteIdx];

    // Lute pluck synthesis (fundamental + harmonics with quick exponential decay)
    const env = Math.exp(-noteT * 7);
    const pluck = (
      Math.sin(2 * Math.PI * f * noteT) * 0.5 +
      Math.sin(2 * Math.PI * f * 2 * noteT) * 0.25 +
      Math.sin(2 * Math.PI * f * 3 * noteT) * 0.12
    ) * env;

    // Ambient warm string background
    const bgPad = (Math.sin(2 * Math.PI * 146.83 * t) + Math.sin(2 * Math.PI * 220 * t)) * 0.12;

    L[i] = (pluck * 0.7 + bgPad) * 0.8;
    R[i] = (pluck * 0.8 + bgPad) * 0.8;
  }
  return { L, R };
}

// Mystère des Ruines Anciennes (14s Loop)
function genAncientRuins() {
  const duration = 14;
  const N = sampleRate * duration;
  const L = new Float32Array(N);
  const R = new Float32Array(N);

  for (let i = 0; i < N; i++) {
    const t = i / sampleRate;
    // Chime resonance every 3.5s
    const chimeT = t % 3.5;
    const chimeEnv = Math.exp(-chimeT * 1.5);
    const chime = (Math.sin(2 * Math.PI * 587.33 * chimeT) + Math.sin(2 * Math.PI * 880 * chimeT)) * chimeEnv * 0.25;

    // Wind & deep pad
    const pad = Math.sin(2 * Math.PI * 110 * t + Math.sin(t * 0.3)) * 0.2;
    const wind = (Math.random() * 2 - 1) * 0.03 * (Math.sin(t * 0.4) * 0.5 + 0.5);

    L[i] = (chime + pad + wind) * 0.8;
    R[i] = (chime * 0.9 + pad + wind) * 0.8;
  }
  return { L, R };
}

// ── 4. BRUITAGES SFX (ONE-SHOT) ─────────────────────────────────────────────

// Lancer de Dés (1.2s)
function genDiceRoll() {
  const duration = 1.2;
  const N = sampleRate * duration;
  const L = new Float32Array(N);
  const R = new Float32Array(N);

  const bounces = [0.0, 0.12, 0.23, 0.35, 0.46, 0.56, 0.65, 0.73, 0.80, 0.86, 0.92];
  for (let i = 0; i < N; i++) {
    const t = i / sampleRate;
    let s = 0;
    for (let b = 0; b < bounces.length; b++) {
      const bt = t - bounces[b];
      if (bt >= 0 && bt < 0.06) {
        const env = Math.exp(-bt * 80) * (1 - b / bounces.length);
        const freq = 450 + b * 60 + Math.sin(b * 12) * 50;
        s += Math.sin(2 * Math.PI * freq * bt) * env * 0.7;
        s += (Math.random() * 2 - 1) * env * 0.3;
      }
    }
    L[i] = s * 0.8;
    R[i] = s * 0.8;
  }
  return { L, R };
}

// Sortilège de Feu (1.8s)
function genFireSpell() {
  const duration = 1.8;
  const N = sampleRate * duration;
  const L = new Float32Array(N);
  const R = new Float32Array(N);

  for (let i = 0; i < N; i++) {
    const t = i / sampleRate;
    const env = t < 0.4 ? t / 0.4 : Math.exp(-(t - 0.4) * 3);
    const noise = (Math.random() * 2 - 1) * env;
    const sweep = Math.sin(2 * Math.PI * (120 + t * 350) * t) * env * 0.5;
    const crackle = (Math.random() < 0.02) ? (Math.random() - 0.5) * env * 1.2 : 0;

    L[i] = (noise * 0.5 + sweep + crackle) * 0.8;
    R[i] = (noise * 0.55 + sweep + crackle) * 0.8;
  }
  return { L, R };
}

// Sortilège de Glace & Cristal (1.8s)
function genIceSpell() {
  const duration = 1.8;
  const N = sampleRate * duration;
  const L = new Float32Array(N);
  const R = new Float32Array(N);

  for (let i = 0; i < N; i++) {
    const t = i / sampleRate;
    const env = Math.exp(-t * 2.2);
    const chime1 = Math.sin(2 * Math.PI * 1760 * t) * env * 0.3;
    const chime2 = Math.sin(2 * Math.PI * 2637 * t) * env * 0.25;
    const chime3 = Math.sin(2 * Math.PI * 3520 * t) * env * 0.2;
    const freezeNoise = (Math.random() * 2 - 1) * Math.exp(-t * 4) * 0.15;

    L[i] = (chime1 + chime2 + chime3 + freezeNoise) * 0.85;
    R[i] = (chime1 * 0.8 + chime2 * 1.1 + chime3 + freezeNoise) * 0.85;
  }
  return { L, R };
}

// Porte de Donjon Grinçante (2.0s)
function genCreakyDoor() {
  const duration = 2.0;
  const N = sampleRate * duration;
  const L = new Float32Array(N);
  const R = new Float32Array(N);

  for (let i = 0; i < N; i++) {
    const t = i / sampleRate;
    const env = t < 1.4 ? Math.sin((t / 1.4) * Math.PI) : 0;
    const creakFreq = 180 + Math.sin(t * 18) * 80 + (t * 60);
    const creak = Math.sin(2 * Math.PI * creakFreq * t) * env * 0.6;
    const grit = (Math.random() * 2 - 1) * env * 0.2;

    // Heavy thud at end (t = 1.6s)
    let slam = 0;
    if (t >= 1.55 && t <= 1.9) {
      const st = t - 1.55;
      slam = Math.sin(2 * Math.PI * 50 * st) * Math.exp(-st * 20) * 0.8;
    }

    L[i] = (creak + grit + slam) * 0.8;
    R[i] = (creak + grit + slam) * 0.8;
  }
  return { L, R };
}

// Coffre au Trésor & Pièces d'Or (1.5s)
function genTreasureChest() {
  const duration = 1.5;
  const N = sampleRate * duration;
  const L = new Float32Array(N);
  const R = new Float32Array(N);

  for (let i = 0; i < N; i++) {
    const t = i / sampleRate;
    // Click at start
    let click = 0;
    if (t < 0.1) {
      click = Math.sin(2 * Math.PI * 800 * t) * Math.exp(-t * 60) * 0.7;
    }

    // Coins jingling
    let coins = 0;
    if (t > 0.15) {
      const ct = t - 0.15;
      const coinEnv = Math.exp(-ct * 3);
      coins = (
        Math.sin(2 * Math.PI * 1975 * ct) * 0.3 +
        Math.sin(2 * Math.PI * 2349 * ct) * 0.25 +
        Math.sin(2 * Math.PI * 3135 * ct) * 0.2
      ) * coinEnv;
    }

    L[i] = (click + coins) * 0.85;
    R[i] = (click + coins) * 0.85;
  }
  return { L, R };
}

// Boire une Potion (1.6s)
function genDrinkPotion() {
  const duration = 1.6;
  const N = sampleRate * duration;
  const L = new Float32Array(N);
  const R = new Float32Array(N);

  for (let i = 0; i < N; i++) {
    const t = i / sampleRate;
    // Cork pop at t = 0
    let pop = 0;
    if (t < 0.15) {
      pop = Math.sin(2 * Math.PI * (250 - t * 800) * t) * Math.exp(-t * 35) * 0.8;
    }

    // Liquid gulping at 0.3s, 0.7s, 1.1s
    let gulp = 0;
    const gulps = [0.3, 0.7, 1.1];
    for (const g of gulps) {
      if (t >= g && t < g + 0.25) {
        const gt = t - g;
        gulp += Math.sin(2 * Math.PI * (180 + Math.sin(gt * 30) * 80) * gt) * Math.exp(-gt * 15) * 0.5;
      }
    }

    // Magical chime at end
    let shimmer = 0;
    if (t > 1.2) {
      const st = t - 1.2;
      shimmer = Math.sin(2 * Math.PI * 2093 * st) * Math.exp(-st * 6) * 0.3;
    }

    L[i] = (pop + gulp + shimmer) * 0.8;
    R[i] = (pop + gulp + shimmer) * 0.8;
  }
  return { L, R };
}

// Déclenchement Piège (1.4s)
function genTrapTrigger() {
  const duration = 1.4;
  const N = sampleRate * duration;
  const L = new Float32Array(N);
  const R = new Float32Array(N);

  for (let i = 0; i < N; i++) {
    const t = i / sampleRate;
    // Click at 0s
    let click = (t < 0.08) ? (Math.random() * 2 - 1) * Math.exp(-t * 90) * 0.9 : 0;

    // Heavy blade snap at 0.18s
    let snap = 0;
    if (t >= 0.15 && t < 0.7) {
      const st = t - 0.15;
      snap = (
        Math.sin(2 * Math.PI * 1200 * st) * Math.exp(-st * 25) * 0.5 +
        Math.sin(2 * Math.PI * 80 * st) * Math.exp(-st * 12) * 0.7
      );
    }

    L[i] = (click + snap) * 0.85;
    R[i] = (click + snap) * 0.85;
  }
  return { L, R };
}

// Rugissement de Monstre (2.2s)
function genMonsterRoar() {
  const duration = 2.2;
  const N = sampleRate * duration;
  const L = new Float32Array(N);
  const R = new Float32Array(N);

  for (let i = 0; i < N; i++) {
    const t = i / sampleRate;
    const env = t < 0.4 ? (t / 0.4) : Math.exp(-(t - 0.4) * 1.5);
    const roarFreq = (110 - t * 35) + Math.sin(t * 35) * 20;
    const voice = Math.sin(2 * Math.PI * roarFreq * t) * env * 0.6;
    const rasp = (Math.random() * 2 - 1) * env * 0.4;

    L[i] = (voice + rasp) * 0.85;
    R[i] = (voice + rasp * 0.9) * 0.85;
  }
  return { L, R };
}

console.log('--- GÉNÉRATION DES PACKS AUDIO GRIMOIRE ---');

// 1. AMBIANCES
let res = genRainAndThunder(); saveAudio('Ambiances', 'Pluie_et_Tonnerre.wav', res.L, res.R);
res = genCampfire(); saveAudio('Ambiances', 'Feu_de_Camp.wav', res.L, res.R);
res = genIcyWind(); saveAudio('Ambiances', 'Vent_Glacial.wav', res.L, res.R);
res = genCursedCrypt(); saveAudio('Ambiances', 'Crypte_Maudite.wav', res.L, res.R);

// 2. MUSIQUES DE COMBAT
res = genWarDrums(); saveAudio('Musiques_Combat', 'Tambours_de_Guerre.wav', res.L, res.R);
res = genCombatTension(); saveAudio('Musiques_Combat', 'Tension_de_Combat.wav', res.L, res.R);

// 3. MUSIQUES D'EXPLORATION
res = genMedievalJourney(); saveAudio('Musiques_Exploration', 'Voyage_en_Empire.wav', res.L, res.R);
res = genAncientRuins(); saveAudio('Musiques_Exploration', 'Mystere_des_Ruines.wav', res.L, res.R);

// 4. BRUITAGES SFX
res = genDiceRoll(); saveAudio('Bruitages_SFX', 'Lancer_de_Des.wav', res.L, res.R);
res = genFireSpell(); saveAudio('Bruitages_SFX', 'Sortilege_Feu.wav', res.L, res.R);
res = genIceSpell(); saveAudio('Bruitages_SFX', 'Sortilege_Glace.wav', res.L, res.R);
res = genCreakyDoor(); saveAudio('Bruitages_SFX', 'Porte_Donjon_Grincante.wav', res.L, res.R);
res = genTreasureChest(); saveAudio('Bruitages_SFX', 'Coffre_au_Tresor.wav', res.L, res.R);
res = genDrinkPotion(); saveAudio('Bruitages_SFX', 'Boire_Potion.wav', res.L, res.R);
res = genTrapTrigger(); saveAudio('Bruitages_SFX', 'Declenchement_Piege.wav', res.L, res.R);
res = genMonsterRoar(); saveAudio('Bruitages_SFX', 'Rugissement_Monstre.wav', res.L, res.R);

console.log('--- TOUS LES PACKS AUDIO SONT PRÊTS ET CLASSÉS DANS LE COFFRE ET GRIMOIRE ! ---');
