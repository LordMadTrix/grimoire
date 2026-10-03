// ── Moteur de Démo Interactive de Session de Jeu Rôliste ─────────────────────
// Permet de vivre ou rejouer une véritable session de JdR complète sur Grimoire :
// Déplacements, Fog of War dynamique, Combat tour par tour, Sorts magiques,
// Éclairage d'ambiance et Narration MJ vivante.

import {
  vttStore,
  updateGmToken,
  replaceGmToken,
  triggerTokenAnimation,
  addGmFowShape,
  startCombat,
  stopCombat,
  rollAllInitiatives,
  nextTurn,
  addCombatLogEntry,
  addSpell,
  removeSpell,
  clearSpells,
  setWeather,
  addGmPin,
  revealGmPin,
} from '$lib/stores/vtt.svelte';
import { notifStore } from '$lib/stores/notifications.svelte';
import { loadSanctuaryDemo } from './demoCampaignLoader';

export interface DemoStep {
  act: string;
  title: string;
  badge: string;
  gmNarrative: string;
  speakerName?: string;
  speakerAvatar?: string;
  speakerQuote?: string;
  actionDetail: string;
  diceRollText?: string;
}

class GameSessionDemoStore {
  isActive = $state(false);
  currentStepIndex = $state(0);
  isPlaying = $state(false);
  autoPlayTimer: any = null;
  autoPlaySeconds = $state(6);
  countdown = $state(6);
  countdownTimer: any = null;

  readonly steps: DemoStep[] = [
    {
      act: 'Acte I',
      title: 'Approche dans les Brumes & Éclairage Runique',
      badge: '🌧️ Ambiance & Exploration',
      gmNarrative: 'La pluie battante et un épais brouillard enveloppent la porte scellée du Sanctuaire Oublié. Sir Gareth élève sa torche sacrée pour percer les ténèbres, tandis que Dame Elanor scrute les runes anciennes gravées sur le linteau.',
      speakerName: 'Sir Gareth (Paladin)',
      speakerAvatar: '/tokens/online/heroes/paladin.png',
      speakerQuote: '« Restez sur vos gardes. La pierre vibre d\'une magie corrompue... »',
      actionDetail: 'Avancée du groupe vers le porche, allumage des torches et dissipation partielle du brouillard de guerre.',
      diceRollText: 'Jet de Perception passive : Varis (17) détecte une odeur de rouille et d\'os calcinés.'
    },
    {
      act: 'Acte II',
      title: 'Embuscade Squelettique & Jet d\'Initiative',
      badge: '⚔️ Alerte Combat',
      gmNarrative: 'La lourde herse grince et cède ! Deux gardes squelettes émergent des ombres du couloir en brandissant leurs lames ébréchées ! Le Maître du Jeu déclenche l\'Initiative !',
      speakerName: 'Dame Elanor (Mage)',
      speakerAvatar: '/tokens/online/heroes/mage.png',
      speakerQuote: '« Des sentinelles non-mortes ! Gareth, tiens le goulet d\'étranglement ! »',
      actionDetail: 'Ouverture de la porte, ouverture automatique de l\'Initiative Tracker et jets de dés d20 groupés.',
      diceRollText: 'Initiative : Sir Gareth (19), Dame Elanor (16), Squelette #1 (12), Varis (11), Squelette #2 (8).'
    },
    {
      act: 'Acte III',
      title: 'Charge du Paladin & Choc des Armures',
      badge: '🛡️ Tour 1 — Sir Gareth',
      gmNarrative: 'Sir Gareth charge le premier garde squelette. Son épée à deux mains s\'illumine d\'un châtiment divin et fend l\'armure de plates vermoulue dans une gerbe d\'étincelles !',
      speakerName: 'Sir Gareth (Paladin)',
      speakerAvatar: '/tokens/online/heroes/paladin.png',
      speakerQuote: '« Par la lumière des Justes, retournez à la poussière ! »',
      actionDetail: 'Déplacement tactique au contact, jet d\'attaque d20+6, impact visuel et réduction des PV ennemis (14 ➔ 2 PV).',
      diceRollText: 'Attaque : d20 (14) + 6 = 20 (Touché !) — Dégâts : 2d6+4 = 12 Tranchants !'
    },
    {
      act: 'Acte IV',
      title: 'Incantation Arcanique & Boule de Feu',
      badge: '🔥 Tour 2 — Dame Elanor',
      gmNarrative: 'Dame Elanor achève sa formule ésotérique. Une sphère de flammes crépitante explose au centre du corridor, consumant les squelettes dans un déluge de braises magiques !',
      speakerName: 'Dame Elanor (Mage)',
      speakerAvatar: '/tokens/online/heroes/mage.png',
      speakerQuote: '« Ignis Calamitas ! Brûlez jusqu\'aux cendres ! »',
      actionDetail: 'Déploiement en temps réel d\'un Gabarit de Sort circulaire (Fireball 120px) avec animation d\'incantation et anéantissement des sentinelles.',
      diceRollText: 'Dégâts de Feu : 8d6 = 28 Dégâts ! Les deux sentinelles sont désintégrées.'
    },
    {
      act: 'Acte V',
      title: 'La Crypte Dévoilée & Le Trésor des Anciens',
      badge: '👑 Victoire & Trésor',
      gmNarrative: 'Le silence retombe dans le couloir fumant. Varis s\'infiltre prudemment vers le fond et découvre la porte colossale menant à la Crypte du Minotaure des Ombres, ainsi qu\'un coffre mystique orné d\'émeraudes.',
      speakerName: 'Varis (Rôdeur)',
      speakerAvatar: '/tokens/online/heroes/rodeur.png',
      speakerQuote: '« Le chemin est libre... et le trésor des bâtisseurs nous attend ! »',
      actionDetail: 'Fin de combat, révélation complète du corridor, illumination du coffre au trésor et gain de 350 XP.',
      diceRollText: 'Fouille : d20 (18) + 4 = 22 ! Coffre ouvert : Amulette d\'Aethelgard (+2 CA) et 450 PO.'
    }
  ];

  get currentStep(): DemoStep {
    return this.steps[this.currentStepIndex] || this.steps[0];
  }

  get totalSteps(): number {
    return this.steps.length;
  }

  start() {
    this.isActive = true;
    this.currentStepIndex = 0;
    this.isPlaying = false;
    this.clearTimers();

    // 1. Initialiser le sanctuaire propre
    loadSanctuaryDemo();

    // 2. Exécuter l'acte 1
    this.applyStep(0);

    notifStore.add(
      '🎭',
      'Démo Live : Session de Jeu',
      'Bienvenue dans la session scénarisée ! Utilisez les boutons du lecteur pour vivre chaque action du groupe.',
      'info',
      6000
    );
  }

  stop() {
    this.isActive = false;
    this.isPlaying = false;
    this.clearTimers();
    clearSpells();
    stopCombat();
  }

  next() {
    if (this.currentStepIndex < this.steps.length - 1) {
      this.goToStep(this.currentStepIndex + 1);
    } else {
      this.stopAutoPlay();
      notifStore.add('🏆', 'Fin de la Démo', 'Session de jeu terminée ! Vous pouvez maintenant contrôler la table en mode MJ libre.', 'success', 6000);
    }
  }

  prev() {
    if (this.currentStepIndex > 0) {
      this.goToStep(this.currentStepIndex - 1);
    }
  }

  goToStep(index: number) {
    if (index < 0 || index >= this.steps.length) return;
    this.currentStepIndex = index;
    this.applyStep(index);
    this.resetCountdown();
  }

  togglePlay() {
    if (this.isPlaying) {
      this.stopAutoPlay();
    } else {
      this.startAutoPlay();
    }
  }

  startAutoPlay() {
    this.isPlaying = true;
    this.resetCountdown();
    this.clearTimers();

    this.countdownTimer = setInterval(() => {
      if (this.countdown > 1) {
        this.countdown--;
      } else {
        this.countdown = this.autoPlaySeconds;
        if (this.currentStepIndex < this.steps.length - 1) {
          this.next();
        } else {
          this.stopAutoPlay();
        }
      }
    }, 1000);
  }

  stopAutoPlay() {
    this.isPlaying = false;
    this.clearTimers();
  }

  private resetCountdown() {
    this.countdown = this.autoPlaySeconds;
  }

  private clearTimers() {
    if (this.autoPlayTimer) {
      clearTimeout(this.autoPlayTimer);
      this.autoPlayTimer = null;
    }
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }
  }

  /**
   * Applique les mutations réelles du monde VTT selon l'acte sélectionné
   */
  private applyStep(stepIdx: number) {
    clearSpells();

    switch (stepIdx) {
      case 0: // Acte 1 : Arrivée devant les portes
        setWeather('fog');
        stopCombat();
        // Positionner les héros devant la porte fermée
        updateGmToken('token_paladin', 420, 840);
        updateGmToken('token_mage', 350, 840);
        updateGmToken('token_ranger', 490, 840);
        triggerTokenAnimation('token_paladin', 'none');
        triggerTokenAnimation('token_mage', 'none');
        
        // Brouillard de guerre : juste l'entrée visible
        vttStore.fowShapes = [
          { type: 'circle', op: 'reveal', x: 420, y: 840, radius: 260 }
        ];

        // Porte fermée
        if (vttStore.walls) {
          vttStore.walls = vttStore.walls.map(w => w.id === 'door_antechamber' ? { ...w, isOpen: false } : w);
        }

        addCombatLogEntry({
          type: 'info',
          actor: 'Maître du Jeu',
          detail: '🌧️ Les aventuriers approchent du portail du Sanctuaire Oublié sous un ciel ténébreux.',
        });
        break;

      case 1: // Acte 2 : Embuscade et Combat
        setWeather('fog');
        // Ouvrir la porte
        if (vttStore.walls) {
          vttStore.walls = vttStore.walls.map(w => w.id === 'door_antechamber' ? { ...w, isOpen: true } : w);
        }

        // Révéler le début du couloir dans le brouillard
        addGmFowShape({
          type: 'circle',
          op: 'reveal',
          x: 600,
          y: 650,
          radius: 280
        });

        // Les monstres tremblent (shake animation)
        triggerTokenAnimation('token_skeleton_1', 'shake');
        triggerTokenAnimation('token_skeleton_2', 'shake');

        // Lancer le combat et l'initiative
        startCombat();
        rollAllInitiatives();

        addCombatLogEntry({
          type: 'turn',
          actor: 'Sentinelles Squelettes',
          detail: '⚔️ Embuscade ! Les sentinelles tirent leurs épées et bloquent le couloir.',
        });
        break;

      case 2: // Acte 3 : Attaque du Paladin
        // Déplacer Sir Gareth au contact du Squelette 1
        updateGmToken('token_paladin', 620, 520);
        triggerTokenAnimation('token_paladin', 'attack');

        // Le squelette prend des dégâts
        setTimeout(() => {
          triggerTokenAnimation('token_skeleton_1', 'damage');
          const sk1 = vttStore.tokens.find(t => t.id === 'token_skeleton_1');
          if (sk1) {
            replaceGmToken({ ...sk1, hp: 2 });
          }
          const c1 = vttStore.combatants.find(c => c.tokenId === 'token_skeleton_1' || c.name.includes('Squelette #1'));
          if (c1) {
            c1.hp = 2;
          }
        }, 300);

        addCombatLogEntry({
          type: 'attack',
          actor: 'Sir Gareth',
          detail: '🛡️ Frappe du Paladin : d20 (14) + 6 = 20 au toucher ! Dégâts : 12 tranchants. Le Squelette #1 vacille à 2 PV !',
        });
        break;

      case 3: // Acte 4 : Boule de Feu de Dame Elanor
        // Passer au tour de la magicienne
        vttStore.currentTurn = 1;
        triggerTokenAnimation('token_mage', 'cast');

        // Créer le gabarit de sort flamboyant sur la zone ennemie
        addSpell({
          id: 'demo_fireball_spell',
          x: 710,
          y: 500,
          type: 'fireball',
          shape: 'circle',
          radius: 120,
        });

        // Les deux squelettes subissent le sort
        setTimeout(() => {
          triggerTokenAnimation('token_skeleton_1', 'damage');
          triggerTokenAnimation('token_skeleton_2', 'damage');

          // Squelette 1 détruit (retiré de la carte)
          const sk1 = vttStore.tokens.find(t => t.id === 'token_skeleton_1');
          if (sk1) replaceGmToken({ ...sk1, hp: 0, visible: false });

          // Squelette 2 réduit en cendres
          const sk2 = vttStore.tokens.find(t => t.id === 'token_skeleton_2');
          if (sk2) replaceGmToken({ ...sk2, hp: 0 });

          // Retirer le gabarit après le blast
          setTimeout(() => {
            removeSpell('demo_fireball_spell');
          }, 1800);
        }, 500);

        addCombatLogEntry({
          type: 'spell',
          actor: 'Dame Elanor',
          detail: '🔥 Boule de Feu dévastatrice : 28 dégâts de feu ! Les sentinelles sont carbonisées.',
        });
        break;

      case 4: // Acte 5 : Exploration de la Crypte et Trésor
        stopCombat();
        setWeather('clear');

        // Varis avance dans la crypte
        updateGmToken('token_ranger', 920, 420);
        updateGmToken('token_paladin', 750, 480);
        updateGmToken('token_mage', 620, 520);

        // Dévoiler le corridor jusqu'à l'entrée de la chambre du boss
        addGmFowShape({
          type: 'circle',
          op: 'reveal',
          x: 950,
          y: 400,
          radius: 360
        });

        // Ajouter et révéler une épingle de trésor secrète
        addGmPin({
          id: 'pin_ancient_chest',
          x: 880,
          y: 320,
          label: 'Coffre Runique des Anciens',
          playerVisible: true,
          revealed: true,
          secretText: 'Contient l\'Amulette d\'Aethelgard (+2 CA) et 450 Pièces d\'Or !'
        });

        addCombatLogEntry({
          type: 'reward',
          actor: 'Système',
          detail: '👑 Victoire ! Corridor sécurisé. Trésor déverrouillé. +350 XP attribués à chaque héros.',
        });
        break;
    }
  }
}

export const gameSessionDemo = new GameSessionDemoStore();
