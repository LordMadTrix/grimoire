<script lang="ts">
  import { getGameConfig, getRaceBaseStats, rollStat } from '$lib/stores/gameConfig.svelte';
  import type { RaceDef, CareerDef } from '$lib/stores/gameConfig.svelte';
  import { broadcastToPlayers, getPlayerConnections } from '$lib/api';
  import type { PlayerInfo } from '$lib/api';

  let visible = $state(false);
  export function toggle() { visible = !visible; }

  // ── Steps ────────────────────────────────────────────────────────
  let step = $state<'race' | 'career' | 'stats' | 'info'>('race');

  // ── Character being built ────────────────────────────────────────
  let selectedRace = $state<RaceDef | null>(null);
  let selectedCareer = $state<CareerDef | null>(null);
  let charName = $state('');
  let charNotes = $state('');
  let rolledStats = $state<Record<string, number>>({});  // bonus dés
  let baseStats = $state<Record<string, number>>({});    // base raciale
  let filterCategory = $state('');

  // ── Connected players ────────────────────────────────────────────
  let players = $state<PlayerInfo[]>([]);
  let targetPlayer = $state<string>('');

  const cfg = $derived(getGameConfig());

  const categories = $derived(
    cfg ? [...new Set(cfg.careers.map(c => c.category))] : []
  );

  const filteredCareers = $derived(
    cfg
      ? cfg.careers.filter(c => !filterCategory || c.category === filterCategory)
      : []
  );

  // Calcul des stats actuelles = base + dés lancés
  const currentStats = $derived.by(() => {
    const result: Record<string, number> = {};
    if (!cfg) return result;
    for (const s of cfg.stats) {
      result[s.key] = (baseStats[s.key] ?? 0) + (rolledStats[s.key] ?? 0);
    }
    return result;
  });

  function selectRace(race: RaceDef) {
    selectedRace = race;
    if (!cfg) return;
    baseStats = getRaceBaseStats(race, cfg.stats);
    rolledStats = {};
  }

  function rollOneStat(key: string, rollDef: string) {
    rolledStats = { ...rolledStats, [key]: rollStat(rollDef) };
  }

  function rollAllStats() {
    if (!cfg || !selectedRace) return;
    const newRolled: Record<string, number> = {};
    for (const s of cfg.stats) {
      if (s.roll) newRolled[s.key] = rollStat(s.roll);
    }
    rolledStats = newRolled;
  }

  function reset() {
    step = 'race';
    selectedRace = null;
    selectedCareer = null;
    charName = '';
    charNotes = '';
    rolledStats = {};
    baseStats = {};
    filterCategory = '';
    targetPlayer = '';
  }

  async function refreshPlayers() {
    try { players = await getPlayerConnections(); } catch { players = []; }
  }

  function buildCharacter() {
    if (!selectedRace || !selectedCareer || !cfg) return null;
    const stats = currentStats;

    // Profil WFRP: initial = base race, plan = carrière, actuel = base+dés
    const profil: Record<string, Record<string, number|string>> = {
      init: { ...baseStats },
      plan: {},
      act: { ...stats },
    };
    // Marquer les stats du plan de carrière
    for (const sk of selectedCareer.stat_plan) {
      profil.plan[sk] = '+10';
    }

    return {
      nom: charName || `${selectedRace.name} ${selectedCareer.name}`,
      race: selectedRace.name,
      voc: selectedCareer.name,
      car: selectedCareer.name,
      profil,
      bless: stats[cfg.hp_stat] ?? 0,
      fate: selectedRace.fate,
      corruption: 0,
      mutations: [],
      critical_wounds: [],
      notes: charNotes,
      comps: selectedCareer.skills,
      deb: selectedCareer.exits.join(', '),
      // For GM panel display
      class: `${selectedRace.emoji} ${selectedRace.name} — ${selectedCareer.name}`,
      hp: stats[cfg.hp_stat] ?? 0,
      maxhp: stats[cfg.hp_stat] ?? 0,
    };
  }

  async function sendToPlayer() {
    const char = buildCharacter();
    if (!char || !targetPlayer) return;
    try {
      await broadcastToPlayers('push_character', { playerId: targetPlayer, character: char });
      visible = false;
      reset();
    } catch (e) {
      console.error('Failed to send character:', e);
    }
  }

  function copyCharacter() {
    const char = buildCharacter();
    if (!char) return;
    navigator.clipboard.writeText(JSON.stringify(char, null, 2));
  }

  $effect(() => {
    if (step === 'info') refreshPlayers();
  });
</script>

{#if cfg}
  <button class="cc-toggle" onclick={toggle} title="Créateur de personnage">
    ⚔️ Perso
  </button>
{/if}

{#if visible && cfg}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="cc-backdrop" onclick={() => { visible = false; reset(); }}>
    <div class="cc-modal" onclick={e => e.stopPropagation()}>

      <!-- Header -->
      <div class="cc-header">
        <div class="cc-title">⚔️ Créateur de Personnage — {cfg.system}</div>
        <button class="cc-close" onclick={() => { visible = false; reset(); }}>✕</button>
      </div>

      <!-- Steps indicator -->
      <div class="cc-steps">
        {#each ([['race','🧬 Race'],['career','💼 Carrière'],['stats','🎲 Stats'],['info','📝 Infos']] as const) as [id, label]}
          <div class="cc-step" class:active={step === id} class:done={
            (id === 'race' && (step === 'career' || step === 'stats' || step === 'info')) ||
            (id === 'career' && (step === 'stats' || step === 'info')) ||
            (id === 'stats' && step === 'info')
          }>
            {label}
          </div>
        {/each}
      </div>

      <div class="cc-body">

        <!-- STEP 1: Race -->
        {#if step === 'race'}
          <div class="cc-section-title">Choisissez une race</div>
          <div class="cc-races">
            {#each cfg.races as race}
              <button
                class="cc-race-card"
                class:selected={selectedRace?.name === race.name}
                onclick={() => selectRace(race)}
              >
                <div class="cc-race-emoji">{race.emoji}</div>
                <div class="cc-race-name">{race.name}</div>
                <div class="cc-race-desc">{race.description}</div>
                {#if race.special.length > 0}
                  <div class="cc-race-special">
                    {#each race.special as sp}
                      <span class="cc-tag">✦ {sp}</span>
                    {/each}
                  </div>
                {/if}
                <div class="cc-race-fate">✨ {race.fate} Points de Destin</div>
              </button>
            {/each}
          </div>
          <div class="cc-actions">
            <button class="cc-btn cc-btn-primary" disabled={!selectedRace} onclick={() => step = 'career'}>
              Suivant →
            </button>
          </div>

        <!-- STEP 2: Career -->
        {:else if step === 'career'}
          <div class="cc-section-title">Choisissez une carrière de départ</div>
          <div class="cc-filter-row">
            <span class="cc-filter-label">Catégorie :</span>
            <button class="cc-filter-btn" class:active={filterCategory === ''} onclick={() => filterCategory = ''}>Toutes</button>
            {#each categories as cat}
              <button class="cc-filter-btn" class:active={filterCategory === cat} onclick={() => filterCategory = cat}>{cat}</button>
            {/each}
          </div>
          <div class="cc-careers">
            {#each filteredCareers as career}
              <button
                class="cc-career-card"
                class:selected={selectedCareer?.name === career.name}
                onclick={() => selectedCareer = career}
              >
                <div class="cc-career-name">{career.name}</div>
                <div class="cc-career-category">{career.category}</div>
                <div class="cc-career-detail">
                  <span class="cc-career-label">Plan :</span>
                  {career.stat_plan.map(s => s.toUpperCase()).join(', ')}
                </div>
                <div class="cc-career-detail">
                  <span class="cc-career-label">Compétences :</span>
                  {career.skills.join(', ')}
                </div>
                <div class="cc-career-detail">
                  <span class="cc-career-label">Débouchés :</span>
                  {career.exits.join(', ')}
                </div>
              </button>
            {/each}
          </div>
          <div class="cc-actions">
            <button class="cc-btn" onclick={() => step = 'race'}>← Retour</button>
            <button class="cc-btn cc-btn-primary" disabled={!selectedCareer} onclick={() => step = 'stats'}>
              Suivant →
            </button>
          </div>

        <!-- STEP 3: Stats -->
        {:else if step === 'stats'}
          <div class="cc-section-title">Profil de {selectedRace?.name} — {selectedCareer?.name}</div>
          <div class="cc-stats-help">
            La colonne <strong>Base</strong> est la valeur raciale fixe. Cliquez sur 🎲 pour lancer les dés bonus.
          </div>
          <button class="cc-roll-all" onclick={rollAllStats}>🎲 Lancer tous les dés</button>
          <table class="cc-stat-table">
            <thead>
              <tr>
                <th>Stat</th>
                <th>Base</th>
                <th>Dés</th>
                <th>Total</th>
                <th>Plan</th>
              </tr>
            </thead>
            <tbody>
              {#each cfg.stats as stat}
                {@const base = baseStats[stat.key] ?? 0}
                {@const bonus = rolledStats[stat.key] ?? 0}
                {@const inPlan = selectedCareer?.stat_plan.includes(stat.key)}
                <tr class:in-plan={inPlan}>
                  <td class="stat-key">
                    <span class="stat-code">{stat.key.toUpperCase()}</span>
                    <span class="stat-label">{stat.label}</span>
                  </td>
                  <td class="stat-base">{base}</td>
                  <td class="stat-roll">
                    {#if stat.roll}
                      <button class="cc-dice-btn" onclick={() => rollOneStat(stat.key, stat.roll!)}>
                        🎲 {bonus > 0 ? `+${bonus}` : stat.roll}
                      </button>
                    {:else}
                      <span class="stat-fixed">—</span>
                    {/if}
                  </td>
                  <td class="stat-total" class:high={base + bonus >= 40}>
                    {base + bonus}
                  </td>
                  <td class="stat-plan-mark">{inPlan ? '✦' : ''}</td>
                </tr>
              {/each}
            </tbody>
          </table>
          <div class="cc-actions">
            <button class="cc-btn" onclick={() => step = 'career'}>← Retour</button>
            <button class="cc-btn cc-btn-primary" onclick={() => step = 'info'}>Suivant →</button>
          </div>

        <!-- STEP 4: Info & Send -->
        {:else if step === 'info'}
          <div class="cc-section-title">Finaliser le personnage</div>
          <div class="cc-info-form">
            <label class="cc-label">
              Nom du personnage
              <input class="cc-input" type="text" bind:value={charName} placeholder="{selectedRace?.name} sans nom..." />
            </label>
            <label class="cc-label">
              Notes / background
              <textarea class="cc-textarea" bind:value={charNotes} placeholder="Origine, motivations, secrets..."></textarea>
            </label>
          </div>

          <!-- Résumé -->
          <div class="cc-summary">
            <div class="cc-summary-row">
              <span class="cc-summary-label">Race</span>
              <span>{selectedRace?.emoji} {selectedRace?.name}</span>
            </div>
            <div class="cc-summary-row">
              <span class="cc-summary-label">Carrière</span>
              <span>{selectedCareer?.name}</span>
            </div>
            <div class="cc-summary-row">
              <span class="cc-summary-label">Blessures</span>
              <span>{currentStats[cfg.hp_stat] ?? 0}</span>
            </div>
            <div class="cc-summary-row">
              <span class="cc-summary-label">Points de Destin</span>
              <span>{selectedRace?.fate}</span>
            </div>
          </div>

          <!-- Envoi au joueur -->
          {#if players.length > 0}
            <div class="cc-send-section">
              <div class="cc-send-label">Envoyer la fiche à un joueur connecté :</div>
              <div class="cc-send-row">
                <select class="cc-select" bind:value={targetPlayer}>
                  <option value="">— Choisir un joueur —</option>
                  {#each players as p}
                    <option value={p.id}>{p.name || p.id}</option>
                  {/each}
                </select>
                <button class="cc-btn cc-btn-send" disabled={!targetPlayer} onclick={sendToPlayer}>
                  📲 Envoyer
                </button>
              </div>
            </div>
          {:else}
            <div class="cc-no-players">Aucun joueur connecté — copiez le JSON pour l'importer manuellement.</div>
          {/if}

          <div class="cc-actions">
            <button class="cc-btn" onclick={() => step = 'stats'}>← Retour</button>
            <button class="cc-btn cc-btn-copy" onclick={copyCharacter}>📋 Copier JSON</button>
          </div>
        {/if}

      </div>
    </div>
  </div>
{/if}

<style>
  .cc-toggle {
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    color: var(--text-secondary);
    padding: 3px 9px;
    border-radius: 4px;
    font-size: 12px;
    cursor: pointer;
    white-space: nowrap;
    transition: all 0.15s;
  }
  .cc-toggle:hover { background: var(--bg-hover); color: var(--text-primary); }

  .cc-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.6);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
  }

  .cc-modal {
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 12px;
    width: 760px;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 24px 64px rgba(0,0,0,0.6);
    overflow: hidden;
    animation: slideDown 0.15s ease-out;
  }
  @keyframes slideDown {
    from { opacity: 0; transform: translateY(-12px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  .cc-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }
  .cc-title { font-size: 15px; font-weight: 700; color: var(--accent); }
  .cc-close {
    background: transparent; border: none; color: var(--text-muted);
    cursor: pointer; font-size: 18px; padding: 2px 6px; border-radius: 4px;
  }
  .cc-close:hover { background: var(--bg-hover); }

  /* Steps */
  .cc-steps {
    display: flex;
    gap: 0;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }
  .cc-step {
    flex: 1;
    padding: 10px;
    text-align: center;
    font-size: 12px;
    color: var(--text-muted);
    border-right: 1px solid var(--border);
    transition: all 0.15s;
  }
  .cc-step:last-child { border-right: none; }
  .cc-step.active { color: var(--accent); background: rgba(229,168,83,0.08); font-weight: 600; }
  .cc-step.done { color: var(--text-secondary); background: rgba(34,197,94,0.05); }

  .cc-body {
    flex: 1;
    overflow-y: auto;
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .cc-section-title {
    font-size: 13px;
    font-weight: 700;
    color: var(--text-primary);
    letter-spacing: 0.05em;
  }

  /* Races */
  .cc-races {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 10px;
  }
  .cc-race-card {
    background: var(--bg-primary);
    border: 2px solid var(--border);
    border-radius: 8px;
    padding: 14px;
    text-align: left;
    cursor: pointer;
    transition: all 0.15s;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .cc-race-card:hover { border-color: var(--accent); background: rgba(229,168,83,0.05); }
  .cc-race-card.selected { border-color: var(--accent); background: rgba(229,168,83,0.12); }

  .cc-race-emoji { font-size: 28px; }
  .cc-race-name { font-size: 15px; font-weight: 700; color: var(--text-primary); }
  .cc-race-desc { font-size: 11px; color: var(--text-muted); line-height: 1.4; }
  .cc-race-special { display: flex; flex-wrap: wrap; gap: 4px; }
  .cc-tag { font-size: 10px; background: rgba(124,106,245,0.15); color: #a78bfa; padding: 2px 6px; border-radius: 10px; }
  .cc-race-fate { font-size: 11px; color: var(--accent); margin-top: 4px; }

  /* Career filter */
  .cc-filter-row {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }
  .cc-filter-label { font-size: 11px; color: var(--text-muted); }
  .cc-filter-btn {
    background: var(--bg-primary);
    border: 1px solid var(--border);
    color: var(--text-secondary);
    padding: 3px 10px;
    border-radius: 12px;
    font-size: 11px;
    cursor: pointer;
    transition: all 0.12s;
  }
  .cc-filter-btn:hover, .cc-filter-btn.active {
    border-color: var(--accent); color: var(--accent);
    background: rgba(229,168,83,0.1);
  }

  /* Careers */
  .cc-careers {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 8px;
  }
  .cc-career-card {
    background: var(--bg-primary);
    border: 2px solid var(--border);
    border-radius: 8px;
    padding: 12px;
    text-align: left;
    cursor: pointer;
    transition: all 0.15s;
    display: flex;
    flex-direction: column;
    gap: 5px;
  }
  .cc-career-card:hover { border-color: var(--accent); background: rgba(229,168,83,0.05); }
  .cc-career-card.selected { border-color: var(--accent); background: rgba(229,168,83,0.12); }
  .cc-career-name { font-size: 13px; font-weight: 700; color: var(--text-primary); }
  .cc-career-category { font-size: 10px; color: var(--accent); font-weight: 600; text-transform: uppercase; letter-spacing: 0.07em; }
  .cc-career-detail { font-size: 11px; color: var(--text-muted); line-height: 1.4; }
  .cc-career-label { color: var(--text-secondary); font-weight: 600; }

  /* Stats table */
  .cc-stats-help { font-size: 12px; color: var(--text-muted); }

  .cc-roll-all {
    align-self: flex-start;
    background: rgba(229,168,83,0.1);
    border: 1px solid rgba(229,168,83,0.3);
    color: var(--accent);
    padding: 6px 14px;
    border-radius: 6px;
    font-size: 12px;
    cursor: pointer;
    transition: all 0.15s;
  }
  .cc-roll-all:hover { background: rgba(229,168,83,0.2); }

  .cc-stat-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
  }
  .cc-stat-table th {
    text-align: left;
    padding: 6px 10px;
    background: var(--bg-primary);
    color: var(--text-muted);
    font-weight: 600;
    font-size: 11px;
    border-bottom: 1px solid var(--border);
  }
  .cc-stat-table td {
    padding: 5px 10px;
    border-bottom: 1px solid rgba(255,255,255,0.04);
    vertical-align: middle;
  }
  .cc-stat-table tr.in-plan { background: rgba(229,168,83,0.06); }
  .cc-stat-table tr.in-plan td:first-child { border-left: 2px solid var(--accent); }

  .stat-key { display: flex; flex-direction: column; gap: 1px; }
  .stat-code { font-weight: 700; color: var(--text-primary); font-size: 12px; }
  .stat-label { font-size: 10px; color: var(--text-muted); }
  .stat-base { color: var(--text-secondary); }
  .stat-fixed { color: var(--text-muted); }
  .stat-total { font-weight: 700; color: var(--text-primary); }
  .stat-total.high { color: #22c55e; }
  .stat-plan-mark { color: var(--accent); font-size: 14px; text-align: center; }

  .cc-dice-btn {
    background: rgba(124,106,245,0.1);
    border: 1px solid rgba(124,106,245,0.3);
    color: #a78bfa;
    padding: 3px 8px;
    border-radius: 4px;
    font-size: 11px;
    cursor: pointer;
    transition: all 0.12s;
    white-space: nowrap;
  }
  .cc-dice-btn:hover { background: rgba(124,106,245,0.2); }

  /* Info step */
  .cc-info-form { display: flex; flex-direction: column; gap: 12px; }
  .cc-label { display: flex; flex-direction: column; gap: 5px; font-size: 12px; color: var(--text-muted); }
  .cc-input, .cc-textarea, .cc-select {
    background: var(--bg-primary);
    border: 1px solid var(--border);
    color: var(--text-primary);
    padding: 8px 12px;
    border-radius: 6px;
    font-size: 13px;
    outline: none;
    transition: border-color 0.15s;
  }
  .cc-input:focus, .cc-textarea:focus, .cc-select:focus { border-color: var(--accent); }
  .cc-textarea { min-height: 80px; resize: vertical; font-family: inherit; }
  .cc-select { cursor: pointer; }

  .cc-summary {
    background: var(--bg-primary);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 12px 16px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .cc-summary-row { display: flex; justify-content: space-between; font-size: 12px; }
  .cc-summary-label { color: var(--text-muted); }

  .cc-send-section {
    background: rgba(34,197,94,0.05);
    border: 1px solid rgba(34,197,94,0.2);
    border-radius: 8px;
    padding: 12px 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .cc-send-label { font-size: 12px; color: var(--text-secondary); }
  .cc-send-row { display: flex; gap: 8px; align-items: center; }

  .cc-no-players {
    font-size: 12px;
    color: var(--text-muted);
    background: var(--bg-primary);
    padding: 10px 14px;
    border-radius: 6px;
    border: 1px solid var(--border);
  }

  /* Actions */
  .cc-actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
    margin-top: auto;
    padding-top: 8px;
    border-top: 1px solid var(--border);
  }

  .cc-btn {
    background: var(--bg-primary);
    border: 1px solid var(--border);
    color: var(--text-secondary);
    padding: 8px 18px;
    border-radius: 6px;
    font-size: 13px;
    cursor: pointer;
    transition: all 0.15s;
  }
  .cc-btn:hover:not(:disabled) { background: var(--bg-hover); color: var(--text-primary); }
  .cc-btn:disabled { opacity: 0.4; cursor: not-allowed; }

  .cc-btn-primary {
    background: rgba(229,168,83,0.15);
    border-color: rgba(229,168,83,0.4);
    color: var(--accent);
    font-weight: 600;
  }
  .cc-btn-primary:hover:not(:disabled) { background: rgba(229,168,83,0.25); }

  .cc-btn-send {
    background: rgba(34,197,94,0.12);
    border-color: rgba(34,197,94,0.3);
    color: #22c55e;
    font-weight: 600;
  }
  .cc-btn-send:hover:not(:disabled) { background: rgba(34,197,94,0.22); }

  .cc-btn-copy {
    background: rgba(124,106,245,0.1);
    border-color: rgba(124,106,245,0.3);
    color: #a78bfa;
  }
  .cc-btn-copy:hover { background: rgba(124,106,245,0.2); }
</style>
