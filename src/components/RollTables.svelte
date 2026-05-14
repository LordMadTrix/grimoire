<script lang="ts">
  import { readFile, writeFile, createDirectory } from '$lib/api';
  import { getVaultPath } from '$lib/stores/vault.svelte';

  let show = $state(false);

  const BUILTIN_TABLES = [
    { id: 'pnj-traits', name: 'Traits PNJ', emoji: '👤', items: ['Avide', 'Loyal jusqu\'à la mort', 'Craintif', 'Arrogant', 'Généreux', 'Paranoïaque', 'Mélancolique', 'Enthousiaste', 'Calculateur', 'Naïf', 'Cruel', 'Compatissant', 'Discret', 'Bruyant', 'Mystérieux', 'Franc', 'Indécis', 'Déterminé', 'Nostalgique', 'Ambitieux'] },
    { id: 'weather', name: 'Météo', emoji: '🌤️', items: ['Soleil éclatant', 'Nuages lourds', 'Pluie battante', 'Brouillard épais', 'Vent violent', 'Orage électrique', 'Neige légère', 'Tempête de neige', 'Crachin froid', 'Chaleur étouffante', 'Nuit claire étoilée', 'Grêle soudaine'] },
    { id: 'encounter-urban', name: 'Rencontre urbaine', emoji: '🏙️', items: ['Un pickpocket tente sa chance', 'Un noble en litige avec un commerçant', 'Un garde ivre bloque le passage', 'Un enfant demande de l\'aide', 'Une rixe dans une taverne déborde', 'Un prédicateur annonce la fin du monde', 'Un étrange colporteur propose des herbes rares', 'Un messager cherche quelqu\'un', 'Un artiste de rue joue une chanson connue', 'Alerte incendie dans un bâtiment proche'] },
    { id: 'encounter-wild', name: 'Rencontre sauvage', emoji: '🌲', items: ['Une meute de loups surveille de loin', 'Un ermite fou parle aux arbres', 'Une caravane attaquée par des bandits', 'Traces de dragon fraîches', 'Un campement abandonné en urgence', 'Un voyageur blessé sur la route', 'Un troupeau d\'animaux en fuite', 'Un dolmen aux runes inconnues', 'Une rivière soudainement rouge', 'Un brouillard qui chuchote des noms'] },
    { id: 'dungeon-rooms', name: 'Salles de donjon', emoji: '🏚️', items: ['Salle de torture abandonnée', 'Bibliothèque envahie de moisissures', 'Autel à une divinité oubliée', 'Prison avec des ossements récents', 'Cuisine infestée de rats géants', 'Salle du trône en ruine', 'Réserve de nourriture avariée', 'Atelier de forgeron mystérieux', 'Chambre secrète derrière une bibliothèque', 'Puits central sans fond apparent'] },
    { id: 'complications', name: 'Complications', emoji: '💥', items: ['Un allié trahit le groupe au pire moment', 'L\'objet clé est un faux', 'Un PJ connaît l\'antagoniste personnellement', 'La deadline est avancée de 24h', 'Un tiers neutre vient de prendre parti contre le groupe', 'La route est coupée par un éboulement', 'Un PJ doit choisir entre l\'objectif et sauver un innocent', 'Le donjon est déjà pillé mais quelqu\'un est encore là', 'Il pleut à verse, tout est glissant', 'Un personnage est sous mind-control'] },
    { id: 'loot', name: 'Trésor', emoji: '💰', items: ['50 pièces d\'or dans une bourse', 'Une gemme de la taille du poing', 'Une carte au trésor illisible', 'Un anneau avec des initiales gravées', 'Un grimoire en langue ancienne', 'Une arme de qualité supérieure', 'Un flacon de potion inconnue', 'Des pièces d\'une civilisation disparue', 'Un billet à ordre d\'une banque lointaine', 'Un sifflet en os sculpté', 'Une statuette d\'un dieu mineur', 'Des gemmes dans un sachet en soie'] },
    { id: 'npc-names', name: 'Prénoms', emoji: '📛', items: ['Aldric', 'Mira', 'Thorvald', 'Seraphine', 'Barak', 'Lyria', 'Dorn', 'Isadora', 'Fenwick', 'Zara', 'Korvus', 'Elara', 'Ragnar', 'Tessaly', 'Grimm', 'Nadia', 'Loric', 'Vessa', 'Edvard', 'Sylvaine'] },
    // ── WFRP ──────────────────────────────────────────────────────────
    { id: 'wfrp-voyage', name: 'WFRP — Voyage (d66)', emoji: '🗺️', items: [
      '11 — Massacre : chariot en feu, passager agonisant proche d\'un joueur',
      '14 — Séisme : faille infranchissable s\'ouvre sur la route',
      '15 — Étranger : voyageur propose un raccourci contre paiement',
      '23 — Peste : ville en quarantaine, routes bloquées',
      '26 — Invités : festival local, groupe forcé de festoyer (contre paiement)',
      '34 — Mauvaise carte : destination est un hameau sans équipement',
      '35 — Bassin des Rêves : vision mystique, +bonus défense au prochain combat',
      '36 — Foudre : membre du groupe frappé par un éclair',
      '45 — Quelle route ? : groupe perdu, arrive dans un village imprévu',
      '46 — Embuscade : attaque nocturne par des Gobelins des Forêts',
      '52 — Blizzard : refuge obligatoire dans le village le plus proche',
      '53 — Demi-tour : après des jours de marche, retour au point de départ',
      '61 — Milice : patrouille méfiante exige un pot-de-vin',
      '63 — Ménestrel : barde se joint au groupe (peut faciliter ou bloquer l\'entrée en ville)',
      '66 — Tempête : orage emporte une partie de l\'équipement ou des trésors',
    ] },
    { id: 'wfrp-donjon', name: 'WFRP — Événements Donjon', emoji: '🏚️', items: [
      '13 — Nain mourant : donne la clé d\'une herse avant de mourir',
      '14 — Guerrier solitaire : survivant d\'un autre groupe, donne le plan du donjon',
      '15 — Petit sournois : Snotling suit le groupe, peut trahir en combat',
      '21 — Gaz empoisonné : nuage dans le couloir, jet d\'Endurance ou intoxication',
      '22 — Chute de pierres : bruit attire les monstres, risque de blessure',
      '24 — Trésor piégé : coffre avec aiguille empoisonnée',
      '31 — Inscription ruinique : avertissement ou malédiction en vieux nain',
      '32 — Puits sans fond : chute de torche révèle une salle secrète en dessous',
      '33 — Voix fantomatique : demande l\'aide des joueurs en ancien Reikspiel',
      '41 — Champignons géants : comestibles ou hallucinogènes ?',
      '42 — Miroir maudit : réflexion montre le futur ou le passé',
      '43 — Prisonnier oublié : humain ou demi-humain, affaibli, reconnaissant',
      '51 — Autel du Chaos : corruption si on s\'en approche trop',
      '52 — Coffre vide : déjà pillé, mais traces fraîches de bottes',
      '61 — Monstre endormi : passage possible sans bruit',
      '66 — Porte scellée : nécessite un objet trouvé ailleurs dans le donjon',
    ] },
    { id: 'wfrp-potions', name: 'WFRP — Potions', emoji: '⚗️', items: [
      'Potion de Force : +1 F pendant 1 tour (6 sur dé = permanent pour l\'aventure)',
      'Potion de Force Puissante : +1d6 F pendant 1 tour',
      'Breuvage Béni (Sorcières du Graal) : +3 Bonus de Force pendant 1 heure',
      'Potion d\'Endurance : +1 E pendant 1 tour (6 sur dé = permanent)',
      'Potion d\'Endurance Puissante : +3 E direct pendant 1 tour',
      'Potion de Bataille : +1 Attaque pendant 1 tour',
      'Potion de Rapidité : +1d6 Initiative pendant 1 tour',
      'Potion de Guérison Mineure : restaure 1d6 Blessures immédiatement',
      'Potion de Guérison Majeure : restaure toutes les Blessures',
      'Philtre de Lâcheté : cible doit tester Commandement ou fuir',
      'Potion de Vision : voit l\'invisible et dans le noir pendant 1 heure',
      'Élixir d\'Invisibilité : invisible pendant 1d6 tours, annulé par attaque',
      'Potion de Vitalité : immunise aux poisons pendant 24h',
      'Antidote Universel : neutralise tout poison actif',
      'Poison de Contact : victime perd 1d6 F jusqu\'à soins (CT 35 pour détecter)',
    ] },
    { id: 'wfrp-enchantements', name: 'WFRP — Enchantements', emoji: '✨', items: [
      'Chercheur de Cœur (épée) : relance 1 attaque manquée par tour',
      'Lame de Cuivre Bondissant : +1 Attaque supplémentaire',
      'Lame de Découpe : +2 dégâts permanent à chaque coup',
      'Épée de Puissance : +15 Force au porteur',
      'Lame d\'Or des Mers : ignore le 1er point d\'armure adverse',
      'Lame de Givre : tue instantanément toute créature blessée (1×/aventure)',
      'Épée de Feu Infernal : sur 6 naturel, 1d6 dégâts/niveau aux adjacents',
      'Épée de Destruction : annule toute magie active au contact',
      'Bouclier de Réflexion : renvoie les sorts de projectiles sur le lanceur',
      'Armure de l\'Ours : +2 E et immunité à la peur',
      'Heaume de Résistance : +2 à tous les jets de résistance mentale',
      'Anneau de Régénération : guérit 1 Blessure par round en combat',
      'Amulette de Protection : 1×/jour, annule un coup critique sur le porteur',
      'Gemme de Vision Nocturne : voir dans le noir complet jusqu\'à 30m',
      'Parchemin de Bannissement : bannit un démon ou mort-vivant (1 usage)',
    ] },
    { id: 'wfrp-noms', name: 'WFRP — Noms (Empire)', emoji: '📛', items: [
      'Klaus Gruber', 'Hanna Steinweg', 'Friedrich von Holt', 'Greta Metzger',
      'Wilhelm Schreiber', 'Lieselotte Bauer', 'Otto Kessler', 'Brunhilde Ritter',
      'Ernst Hoffman', 'Marta Schwarz', 'Johann Weiss', 'Helga Braun',
      'Siegfried Kramer', 'Ingrid Fleischer', 'Dietrich Wolf', 'Ursula Zimmermann',
      'Albrecht Fuchs', 'Hildegard Richter', 'Konrad Becker', 'Elsa Fischer',
      'Gerhard Wagner', 'Mathilde Huber', 'Ruprecht Schneider', 'Katrina Möller',
    ] },
    { id: 'wfrp-carriere', name: 'WFRP — Carrières de Départ', emoji: '⚔️', items: [
      'Soldat : profil combattant, accès aux armes lourdes',
      'Mercenaire : vétéran endurci, bonus en milieu urbain et voyages',
      'Apprenti Sorcier : magie de base, rejeté par la société',
      'Ratier : expert des égouts, survie en milieu insalubre',
      'Cocher : conduite, navigation, discrétion lors des voyages',
      'Charretier : force brute, commerce, réseau de contacts ruraux',
      'Fermier : endurance, connaissance de la nature locale',
      'Bûcheron : force, survie en forêt, accès aux haches',
      'Aubergiste : réseau social, cuisine, gestion de conflits mineurs',
      'Mendiant : discrétion, furtivité, réseau des rues',
      'Brigand : combat vicieux, intimidation, connaissance des routes',
      'Étudiant : érudition, langues, magie théorique',
      'Médecin des Rues : soins basiques, alchimie de fortune',
      'Ecclésiastique : foi, cérémonies, lettres',
      'Garde de la Cité : droit, intimidation, combat urbain',
      'Ingénieur Nain : mécanique, explosifs, runes basiques',
    ] },
  ];

  interface RollTable { id: string; name: string; emoji: string; items: string[]; }

  let customTables = $state<RollTable[]>([]);
  let allTables = $derived([...BUILTIN_TABLES, ...customTables]);

  let selectedTableId = $state(BUILTIN_TABLES[0].id);
  let selectedTable = $derived(allTables.find(t => t.id === selectedTableId) ?? allTables[0]);

  let rollHistory = $state<{ result: string; table: string; ts: number }[]>([]);
  let lastRoll = $state('');

  // Persistance dans .grimoire/tables.json
  async function loadTables() {
    const vp = getVaultPath();
    if (!vp) return;
    try {
      const raw = await readFile(vp, '.grimoire/tables.json');
      customTables = JSON.parse(raw) ?? [];
    } catch { customTables = []; }
  }

  async function saveTables() {
    const vp = getVaultPath();
    if (!vp) return;
    try {
      await writeFile(vp, '.grimoire/tables.json', JSON.stringify(customTables, null, 2));
    } catch {
      await createDirectory(vp, '.grimoire');
      await writeFile(vp, '.grimoire/tables.json', JSON.stringify(customTables, null, 2));
    }
  }

  function roll() {
    if (!selectedTable || selectedTable.items.length === 0) return;
    const idx = Math.floor(Math.random() * selectedTable.items.length);
    const result = selectedTable.items[idx];
    lastRoll = result;
    rollHistory = [{ result, table: selectedTable.name, ts: Date.now() }, ...rollHistory].slice(0, 20);
  }

  function copyResult() {
    if (lastRoll) navigator.clipboard?.writeText(lastRoll);
  }

  function insertResult() {
    if (!lastRoll) return;
    document.dispatchEvent(new CustomEvent('insert-text', { detail: { text: lastRoll } }));
  }

  // Nouvelle table custom
  let showNewTable = $state(false);
  let newTableName = $state('');
  let newTableEmoji = $state('🎲');
  let newTableItems = $state('');

  function createTable() {
    const name = newTableName.trim();
    const items = newTableItems.split('\n').map(s => s.trim()).filter(Boolean);
    if (!name || items.length === 0) return;
    customTables = [...customTables, { id: Date.now().toString(36), name, emoji: newTableEmoji, items }];
    saveTables();
    newTableName = ''; newTableEmoji = '🎲'; newTableItems = '';
    showNewTable = false;
    selectedTableId = customTables[customTables.length - 1].id;
  }

  function deleteCustomTable(id: string) {
    if (!window.confirm('Supprimer cette table ?')) return;
    customTables = customTables.filter(t => t.id !== id);
    saveTables();
    if (selectedTableId === id) selectedTableId = allTables[0]?.id ?? '';
  }

  // Toggle via Ctrl+T
  function handleKey(e: KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && e.key === 't') { e.preventDefault(); toggle(); }
    if (e.key === 'Escape' && show) { show = false; }
  }

  export function toggle() { show = !show; if (show) loadTables(); }

  import { onMount } from 'svelte';
  onMount(() => {
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  });
</script>

{#if show}
  <div class="rt-panel">
    <div class="rt-header">
      <span class="rt-title">🎲 Tables</span>
      <button class="rt-close" onclick={() => show = false}>✕</button>
    </div>

    <div class="rt-body">
      <!-- Liste des tables -->
      <div class="rt-list">
        {#if customTables.length > 0}
          <div class="rt-section-label">INTÉGRÉES</div>
        {/if}
        {#each BUILTIN_TABLES as t}
          <button class="rt-tab" class:active={selectedTableId === t.id} onclick={() => selectedTableId = t.id}>
            {t.emoji} {t.name}
          </button>
        {/each}
        {#if customTables.length > 0}
          <div class="rt-section-label">PERSONNALISÉES</div>
          {#each customTables as t}
            <div class="rt-tab-row">
              <button class="rt-tab rt-tab-custom" class:active={selectedTableId === t.id} onclick={() => selectedTableId = t.id}>
                {t.emoji} {t.name}
              </button>
              <button class="rt-del" onclick={() => deleteCustomTable(t.id)} title="Supprimer">✕</button>
            </div>
          {/each}
        {/if}
        <button class="rt-new-btn" onclick={() => showNewTable = !showNewTable}>+ Créer</button>

        {#if showNewTable}
          <div class="rt-new-form">
            <div class="rt-form-row">
              <input class="rt-input rt-emoji-input" bind:value={newTableEmoji} maxlength="4" placeholder="🎲" />
              <input class="rt-input" bind:value={newTableName} placeholder="Nom de la table" />
            </div>
            <textarea class="rt-textarea" bind:value={newTableItems} placeholder="Un item par ligne…" rows="5"></textarea>
            <button class="rt-confirm" onclick={createTable}>✓ Créer</button>
          </div>
        {/if}
      </div>

      <!-- Zone de résultat -->
      <div class="rt-roll-area">
        {#if selectedTable}
          <div class="rt-table-info">
            <span class="rt-table-emoji">{selectedTable.emoji}</span>
            <span class="rt-table-name">{selectedTable.name}</span>
            <span class="rt-table-count">{selectedTable.items.length} entrées</span>
          </div>

          <button class="rt-roll-btn" onclick={roll}>
            🎲 Lancer ({selectedTable.items.length})
          </button>

          {#if lastRoll}
            <div class="rt-result">
              <div class="rt-result-text">{lastRoll}</div>
              <div class="rt-result-actions">
                <button onclick={copyResult} title="Copier">📋</button>
                <button onclick={insertResult} title="Insérer dans la note">📝</button>
              </div>
            </div>
          {/if}

          {#if rollHistory.length > 0}
            <div class="rt-history-label">Historique</div>
            <div class="rt-history">
              {#each rollHistory as h}
                <div class="rt-history-item">
                  <span class="rt-history-result">{h.result}</span>
                  <span class="rt-history-table">{h.table}</span>
                </div>
              {/each}
            </div>
          {/if}
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .rt-panel {
    position: fixed;
    bottom: 40px;
    right: 16px;
    width: 520px;
    max-height: 500px;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 10px;
    box-shadow: 0 16px 48px rgba(0, 0, 0, 0.5);
    display: flex;
    flex-direction: column;
    z-index: 8000;
    animation: slideUp 0.15s ease-out;
  }

  @keyframes slideUp {
    from { opacity: 0; transform: translateY(10px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  .rt-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 14px;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }

  .rt-title { font-size: 14px; font-weight: 700; color: var(--text-primary); }

  .rt-close {
    background: transparent; border: none; color: var(--text-muted);
    cursor: pointer; font-size: 14px; padding: 2px 6px; border-radius: 3px;
  }
  .rt-close:hover { background: var(--bg-hover); }

  .rt-body {
    display: grid;
    grid-template-columns: 180px 1fr;
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  .rt-list {
    border-right: 1px solid var(--border);
    overflow-y: auto;
    padding: 6px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .rt-section-label {
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.08em;
    color: var(--text-muted);
    padding: 6px 6px 2px;
  }

  .rt-tab {
    width: 100%;
    text-align: left;
    padding: 5px 8px;
    background: transparent;
    border: none;
    border-radius: 5px;
    font-size: 12px;
    color: var(--text-secondary);
    cursor: pointer;
    transition: background 0.1s;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .rt-tab:hover { background: var(--bg-hover); color: var(--text-primary); }
  .rt-tab.active { background: var(--accent-bg); color: var(--accent); font-weight: 600; }

  .rt-tab-row { display: flex; align-items: center; gap: 2px; }
  .rt-tab-custom { flex: 1; }

  .rt-del {
    background: transparent; border: none; color: var(--text-muted);
    cursor: pointer; font-size: 10px; padding: 4px; border-radius: 3px; flex-shrink: 0;
  }
  .rt-del:hover { color: #f85149; background: rgba(248,81,73,0.1); }

  .rt-new-btn {
    width: 100%; margin-top: 6px; padding: 5px 8px;
    background: transparent; border: 1px dashed var(--border);
    border-radius: 5px; font-size: 11px; color: var(--text-muted);
    cursor: pointer; transition: all 0.1s; text-align: center;
  }
  .rt-new-btn:hover { border-color: var(--accent); color: var(--accent); }

  .rt-new-form {
    display: flex; flex-direction: column; gap: 6px;
    padding: 8px 4px 4px; border-top: 1px solid var(--border); margin-top: 4px;
  }

  .rt-form-row { display: flex; gap: 4px; }

  .rt-input {
    background: var(--bg-tertiary); border: 1px solid var(--border);
    border-radius: 4px; color: var(--text-primary); font-size: 11px;
    padding: 4px 6px; outline: none; flex: 1;
  }
  .rt-emoji-input { width: 36px; flex: none; text-align: center; font-size: 14px; }
  .rt-input:focus { border-color: var(--accent); }

  .rt-textarea {
    background: var(--bg-tertiary); border: 1px solid var(--border);
    border-radius: 4px; color: var(--text-primary); font-size: 11px;
    padding: 4px 6px; outline: none; resize: vertical; font-family: inherit; width: 100%;
    box-sizing: border-box;
  }

  .rt-confirm {
    background: var(--accent); border: none; border-radius: 4px;
    color: #000; font-size: 11px; font-weight: 700; padding: 4px;
    cursor: pointer; width: 100%;
  }

  /* ── Roll area ─────────────────────────────────────────────────── */

  .rt-roll-area {
    padding: 14px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    overflow-y: auto;
  }

  .rt-table-info {
    display: flex; align-items: center; gap: 8px;
  }
  .rt-table-emoji { font-size: 22px; }
  .rt-table-name { font-size: 14px; font-weight: 600; color: var(--text-primary); flex: 1; }
  .rt-table-count { font-size: 11px; color: var(--text-muted); }

  .rt-roll-btn {
    width: 100%; padding: 10px;
    background: rgba(229, 168, 83, 0.12);
    border: 1px solid var(--accent);
    border-radius: 8px;
    color: var(--accent);
    font-size: 14px; font-weight: 700;
    cursor: pointer;
    transition: all 0.15s;
  }
  .rt-roll-btn:hover { background: rgba(229, 168, 83, 0.22); }
  .rt-roll-btn:active { transform: scale(0.97); }

  .rt-result {
    background: var(--bg-tertiary);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 12px 14px;
    display: flex;
    align-items: center;
    gap: 10px;
    animation: pop 0.2s ease;
  }

  @keyframes pop {
    0%   { transform: scale(0.95); opacity: 0.7; }
    60%  { transform: scale(1.02); }
    100% { transform: scale(1); opacity: 1; }
  }

  .rt-result-text { flex: 1; font-size: 15px; color: var(--text-primary); font-weight: 500; }

  .rt-result-actions {
    display: flex; gap: 4px;
  }
  .rt-result-actions button {
    background: transparent; border: 1px solid var(--border);
    border-radius: 4px; cursor: pointer; padding: 4px 8px; font-size: 13px;
    transition: background 0.1s;
  }
  .rt-result-actions button:hover { background: var(--bg-hover); }

  .rt-history-label {
    font-size: 10px; font-weight: 700; letter-spacing: 0.08em;
    color: var(--text-muted); padding-top: 2px;
  }

  .rt-history { display: flex; flex-direction: column; gap: 3px; }

  .rt-history-item {
    display: flex; align-items: center; gap: 8px;
    padding: 4px 8px;
    background: var(--bg-tertiary);
    border-radius: 4px;
    font-size: 12px;
  }
  .rt-history-result { flex: 1; color: var(--text-secondary); }
  .rt-history-table { font-size: 10px; color: var(--text-muted); flex-shrink: 0; }
</style>
