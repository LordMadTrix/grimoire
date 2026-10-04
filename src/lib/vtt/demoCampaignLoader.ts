// ── Chargeur de Démo Clé en Main "Le Sanctuaire Oublié" ───────────────────────
// Permet à tout Maître du Jeu de tester instantanément l'intégralité des fonctionnalités
// de Grimoire en 1 clic : Table Virtuelle, Murs LOS, Éclairage, Brume, Tokens avec ArUco.

import { vttStore, type Token, type LightSource, type WallDef } from '$lib/stores/vtt.svelte';
import { notifStore } from '$lib/stores/notifications.svelte';

export function loadSanctuaryDemo() {
  // 1. Image de la Battlemap
  vttStore.currentMap = '/maps/sanctuaire.png';
  vttStore.currentMapRelPath = 'maps/sanctuaire.png';
  vttStore.gridSize = 70;
  vttStore.showGrid = true;

  // 2. Ambiance & Éclairage (Donjon sombre avec torches)
  vttStore.ambientLight = 'pitch_black';
  vttStore.weather = 'fog';
  vttStore.fowEnabled = true;

  // 3. Torches murales pré-placées
  const demoTorches: LightSource[] = [
    {
      id: 'torch_entrance_1',
      x: 350,
      y: 780,
      radius: 180,
      color: '#f59e0b',
      intensity: 0.9,
      flicker: true,
      type: 'torch',
      label: 'Brasero d\'entrée Ouest'
    },
    {
      id: 'torch_entrance_2',
      x: 520,
      y: 780,
      radius: 180,
      color: '#f59e0b',
      intensity: 0.9,
      flicker: true,
      type: 'torch',
      label: 'Brasero d\'entrée Est'
    },
    {
      id: 'torch_corridor',
      x: 700,
      y: 520,
      radius: 200,
      color: '#f97316',
      intensity: 0.85,
      flicker: true,
      type: 'torch',
      label: 'Torche du Couloir'
    },
    {
      id: 'torch_sanctuary',
      x: 1050,
      y: 350,
      radius: 260,
      color: '#8b5cf6',
      intensity: 0.95,
      flicker: true,
      type: 'magical',
      label: 'Foyer Runique du Sanctuaire'
    }
  ];
  vttStore.lights = demoTorches;

  // 4. Murs et Portes Blueprint
  const demoWalls: WallDef[] = [
    {
      id: 'wall_entrance_left',
      points: [{ x: 260, y: 880 }, { x: 260, y: 720 }, { x: 420, y: 720 }],
      type: 'opaque'
    },
    {
      id: 'wall_entrance_right',
      points: [{ x: 620, y: 720 }, { x: 620, y: 880 }],
      type: 'opaque'
    },
    {
      id: 'door_antechamber',
      points: [{ x: 420, y: 720 }, { x: 500, y: 720 }],
      type: 'door',
      isOpen: false
    }
  ];
  vttStore.walls = demoWalls;

  // 5. Tokens de Héros et Monstres avec ArUco IDs pré-attribués
  const demoTokens: Token[] = [
    {
      id: 'token_paladin',
      name: 'Sir Gareth (Paladin)',
      x: 420,
      y: 840,
      size: 60,
      color: 0x3b82f6,
      hp: 42,
      maxHp: 42,
      ac: 18,
      visionRange: 6,
      lightRadius: 4,
      lightColor: '#fbbf24',
      lightFlicker: true,
      imageUrl: '/tokens/online/heroes/paladin.png',
      physicalMarkerId: 1,
      physicalRotation: 0,
      notes: 'Héros en armure lourde. Muni d\'une torche et d\'un bouclier runique.'
    },
    {
      id: 'token_mage',
      name: 'Dame Elanor (Mage)',
      x: 350,
      y: 840,
      size: 55,
      color: 0xa855f7,
      hp: 26,
      maxHp: 26,
      ac: 12,
      visionRange: 5,
      concentrating: true,
      imageUrl: '/tokens/online/heroes/mage.png',
      physicalMarkerId: 2,
      physicalRotation: 0,
      notes: 'Canalise une concentration arcanique (boule de feu préparée).'
    },
    {
      id: 'token_ranger',
      name: 'Varis (Rôdeur)',
      x: 490,
      y: 840,
      size: 55,
      color: 0x10b981,
      hp: 34,
      maxHp: 34,
      ac: 15,
      visionRange: 7,
      imageUrl: '/tokens/online/heroes/rodeur.png',
      physicalMarkerId: 3,
      physicalRotation: 0,
      notes: 'Vigilant avec vision nocturne supérieure.'
    },
    {
      id: 'token_skeleton_1',
      name: 'Garde Squelette #1',
      x: 680,
      y: 480,
      size: 50,
      isEnemy: true,
      color: 0xef4444,
      hp: 14,
      maxHp: 14,
      ac: 13,
      visionRange: 4,
      imageUrl: '/tokens/online/enemies/squelette.png',
      physicalMarkerId: 4,
      notes: 'Posté en embuscade dans le couloir central.'
    },
    {
      id: 'token_skeleton_2',
      name: 'Garde Squelette #2',
      x: 740,
      y: 520,
      size: 50,
      isEnemy: true,
      color: 0xef4444,
      hp: 14,
      maxHp: 14,
      ac: 13,
      visionRange: 4,
      imageUrl: '/tokens/online/enemies/squelette.png',
      physicalMarkerId: 5,
      notes: 'Armé d\'un vieil arc court rouillé.'
    },
    {
      id: 'token_boss',
      name: 'Le Minotaure des Ombres (Boss)',
      x: 1050,
      y: 350,
      size: 90,
      isEnemy: true,
      color: 0x991b1b,
      hp: 76,
      maxHp: 76,
      ac: 16,
      visionRange: 8,
      imageUrl: '/tokens/online/enemies/minotaure.png',
      physicalMarkerId: 6,
      auraRadius: 30,
      auraColor: 0x7c3aed,
      notes: 'Colosse cornu terré dans la crypte. Déclenche une aura de terreur.'
    }
  ];
  vttStore.tokens = demoTokens;

  // 6. Brouillard de guerre : Réserve une ouverture sur le hall d'entrée
  vttStore.fowShapes = [
    {
      type: 'circle',
      op: 'reveal',
      x: 420,
      y: 840,
      radius: 280
    }
  ];

  // 7. Notification d'accueil
  notifStore.add(
    '🏰',
    'Démo Clé en Main Chargée !',
    'Le Sanctuaire Oublié est prêt : héros (IDs ArUco 1-3), monstres (IDs 4-6), éclairage dynamique et brouillard de guerre activés !',
    'success',
    7000
  );
}
