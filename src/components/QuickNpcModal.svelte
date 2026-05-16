<script lang="ts">
  import { getGameConfig } from '$lib/stores/gameConfig.svelte';
  import { addGmToken } from '$lib/stores/vtt.svelte';

  let { onclose }: { onclose: () => void } = $props();

  const PRENOMS = ['Aldric','Brunhilde','Konrad','Elspeth','Sigmar','Gretel','Wilhelm','Isolde','Ulrich','Marta','Friedrich','Hedwig','Klaus','Ingrid','Dieter','Brunhild','Mathilda','Gottfried','Agathe','Rolf','Verena','Boris','Ilse','Gerhard','Trudi','Ernst','Hilda','Otto','Liesel','Karl'];
  const NOMS = ['Braun','Müller','Krause','Schneider','Fischer','Weber','Hofmann','Schreiber','Richter','Koch','Brauer','Lang','Hartmann','Becker','Gruber','Lehmann','Schäfer','Winkler','Brunner','Vogel'];

  function rnd(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min; }
  function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

  function generateNpc() {
    const cfg = getGameConfig();
    const race = cfg?.races?.length ? pick(cfg.races) : null;
    const career = cfg?.careers?.length ? pick(cfg.careers) : null;
    const rb = race?.stats ?? {};
    const name = `${pick(PRENOMS)} ${pick(NOMS)}`;
    const e = rnd(2, 4) + (rb['e'] ?? 0);
    return {
      name,
      race: race?.name ?? 'Humain',
      career: career?.name ?? 'Roturier',
      hostile: true,
      cc:  rnd(25, 45) + (rb['cc']  ?? 0),
      ct:  rnd(20, 40) + (rb['ct']  ?? 0),
      f:   rnd(2,  4)  + (rb['f']   ?? 0),
      e,
      bless: e * 2 + rnd(0, 3),
      i:   rnd(25, 45) + (rb['i']   ?? 0),
      ag:  rnd(25, 45) + (rb['ag']  ?? 0),
      int: rnd(20, 35) + (rb['int'] ?? 0),
      fm:  rnd(20, 35) + (rb['fm']  ?? 0),
      soc: rnd(20, 35) + (rb['soc'] ?? 0),
    };
  }

  let npc = $state(generateNpc());
  let spawnOnMap = $state(true);
  let spawnedMsg = $state('');

  function reroll() { npc = generateNpc(); spawnedMsg = ''; }

  function confirm() {
    if (spawnOnMap) {
      addGmToken({
        id: Math.random().toString(36).slice(2),
        name: npc.name,
        x: 400 + rnd(-80, 80),
        y: 400 + rnd(-80, 80),
        size: 50,
        visible: true,
        isEnemy: npc.hostile,
        hp: npc.bless,
        maxHp: npc.bless,
      });
      spawnedMsg = `${npc.name} ajouté sur la carte !`;
      setTimeout(() => { spawnedMsg = ''; onclose(); }, 1200);
    } else {
      onclose();
    }
  }
</script>

<div class="npc-backdrop" onclick={onclose} role="none">
  <div class="npc-modal" onclick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
    <div class="npc-header">
      <span>🧟 PNJ Rapide</span>
      <button class="npc-close" onclick={onclose}>×</button>
    </div>

    <div class="npc-name-row">
      <span class="npc-name">{npc.name}</span>
      <span class="npc-sub">{npc.race} · {npc.career}</span>
    </div>

    <div class="npc-stats">
      {#each [['CC',npc.cc],['CT',npc.ct],['F',npc.f],['E',npc.e],['Bless',npc.bless],['I',npc.i],['Ag',npc.ag],['Int',npc.int],['FM',npc.fm],['Soc',npc.soc]] as [k,v]}
        <div class="npc-stat">
          <span class="npc-stat-k">{k}</span>
          <span class="npc-stat-v">{v}</span>
        </div>
      {/each}
    </div>

    <label class="npc-hostile-row">
      <input type="checkbox" bind:checked={npc.hostile} />
      Hostile (token ennemi)
    </label>

    <label class="npc-hostile-row">
      <input type="checkbox" bind:checked={spawnOnMap} />
      Placer sur la carte
    </label>

    {#if spawnedMsg}
      <div class="npc-spawned">{spawnedMsg}</div>
    {/if}

    <div class="npc-actions">
      <button class="npc-btn npc-btn-sec" onclick={reroll}>🎲 Relancer</button>
      <button class="npc-btn npc-btn-pri" onclick={confirm}>✔ Confirmer</button>
    </div>
  </div>
</div>

<style>
  .npc-backdrop {
    position: fixed; inset: 0; background: rgba(0,0,0,.6); z-index: 1500;
    display: flex; align-items: center; justify-content: center;
  }
  .npc-modal {
    background: var(--bg-secondary, #161b22);
    border: 1px solid var(--border, #2d3748);
    border-radius: 12px;
    padding: 20px;
    width: 340px;
    max-width: 95vw;
    display: flex; flex-direction: column; gap: 14px;
    box-shadow: 0 12px 40px rgba(0,0,0,.7);
  }
  .npc-header {
    display: flex; justify-content: space-between; align-items: center;
    font-size: 14px; font-weight: 700; color: var(--accent, #e5a853);
  }
  .npc-close {
    background: none; border: none; color: var(--text-muted); cursor: pointer; font-size: 20px; line-height: 1;
  }
  .npc-name-row { display: flex; flex-direction: column; gap: 2px; }
  .npc-name { font-size: 18px; font-weight: 700; color: var(--text-primary, #c9d1d9); }
  .npc-sub { font-size: 12px; color: var(--text-muted, #8899b7); }
  .npc-stats {
    display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px;
  }
  .npc-stat {
    background: var(--bg-tertiary, #1c2233);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 5px 4px;
    display: flex; flex-direction: column; align-items: center; gap: 2px;
  }
  .npc-stat-k { font-size: 9px; color: var(--text-muted); text-transform: uppercase; letter-spacing: .07em; }
  .npc-stat-v { font-size: 15px; font-weight: 700; color: var(--text-primary); }
  .npc-hostile-row {
    display: flex; align-items: center; gap: 8px;
    font-size: 13px; color: var(--text-muted); cursor: pointer;
  }
  .npc-spawned { font-size: 12px; color: #22c55e; text-align: center; }
  .npc-actions { display: flex; gap: 8px; }
  .npc-btn {
    flex: 1; padding: 9px; border-radius: 7px; font-size: 13px; font-weight: 700; cursor: pointer; border: none;
  }
  .npc-btn-sec { background: var(--bg-tertiary, #1c2233); border: 1px solid var(--border); color: var(--text-muted); }
  .npc-btn-pri { background: var(--accent, #e5a853); color: #000; }
  .npc-btn-sec:hover { border-color: var(--accent); color: var(--accent); }
</style>
