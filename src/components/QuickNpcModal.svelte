<script lang="ts">
  import { getGameConfig } from '$lib/stores/gameConfig.svelte';
  import { addGmToken } from '$lib/stores/vtt.svelte';
  import { askOllama } from '$lib/api';

  let { onclose }: { onclose: () => void } = $props();

  const PRENOMS = ['Aldric','Brunhilde','Konrad','Elspeth','Sigmar','Gretel','Wilhelm','Isolde','Ulrich','Marta','Friedrich','Hedwig','Klaus','Ingrid','Dieter','Brunhild','Mathilda','Gottfried','Agathe','Rolf','Verena','Boris','Ilse','Gerhard','Trudi','Ernst','Hilda','Otto','Liesel','Karl'];
  const NOMS = ['Braun','Müller','Krause','Schneider','Fischer','Weber','Hofmann','Schreiber','Richter','Koch','Brauer','Lang','Hartmann','Becker','Gruber','Lehmann','Schäfer','Winkler','Brunner','Vogel'];
  const TRAITS = ['Méfiance exacerbée', 'Chaleureux et bavard', 'Regard fuyant et nerveux', 'Arrogant et fier', 'Voix rauque et chuchotée', 'Bredouille sous la panique', 'Obsédé par les pièces d\'or', 'Mystique et fataliste'];
  const SECRETS = ['A volé une relique de la guilde', 'Espionne pour un culte interdit', 'Fuit une dette de jeu colossale', 'Recherche désespérément sa sœur disparue', 'Possède une dague ensorcelée cachée dans sa botte'];

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
      trait: pick(TRAITS),
      secret: pick(SECRETS),
      aiDetails: '',
      hostile: false,
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
  let isGeneratingAi = $state(false);

  function reroll() { npc = generateNpc(); spawnedMsg = ''; }

  async function generateWithAi() {
    isGeneratingAi = true;
    try {
      const prompt = `Génère en 2 phrases percutantes pour le JDR le portrait de ce PNJ (${npc.name}, ${npc.race} ${npc.career}) : son trait marquant, son secret dangereux et sa réplique aux PJ. Sois bref et immersif.`;
      const res = await askOllama(prompt, '', 'Tu es un assistant de jeu de rôle dark fantasy concis et évocateur.');
      if (res && !res.includes("requiert l'application")) {
        npc.aiDetails = res.trim();
      }
    } catch (e) {
      console.warn("Échec génération IA PNJ:", e);
    } finally {
      isGeneratingAi = false;
    }
  }

  function confirm() {
    if (spawnOnMap) {
      const notes = [
        `${npc.name} (${npc.race} - ${npc.career})`,
        `Caractère : ${npc.trait}`,
        `Secret : ${npc.secret}`,
        npc.aiDetails ? `Détails : ${npc.aiDetails}` : ''
      ].filter(Boolean).join('\n');

      addGmToken({
        id: Math.random().toString(36).slice(2),
        name: npc.name,
        x: 400 + rnd(-80, 80),
        y: 400 + rnd(-80, 80),
        size: 50,
        visible: false, // Caché par défaut : révélé par le MJ ou par portée visuelle des PJ
        isEnemy: npc.hostile,
        hp: npc.bless,
        maxHp: npc.bless,
        notes,
      });
      spawnedMsg = `✨ ${npc.name} déposé sur la carte VTT !`;
      setTimeout(() => { spawnedMsg = ''; onclose(); }, 1200);
    } else {
      onclose();
    }
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<div class="npc-backdrop" onclick={onclose} role="presentation">
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div class="npc-modal" onclick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" tabindex="-1">
    <div class="npc-header">
      <span>🧙‍♂️ PNJ Express & VTT</span>
      <button class="npc-close" onclick={onclose}>×</button>
    </div>

    <div class="npc-name-row">
      <span class="npc-name">{npc.name}</span>
      <span class="npc-sub">{npc.race} · {npc.career}</span>
    </div>

    <div class="npc-traits-box">
      <div class="trait-row"><span class="trait-k">🎭 Attitude :</span> <span class="trait-v">{npc.trait}</span></div>
      <div class="trait-row"><span class="trait-k">🤫 Secret :</span> <span class="trait-v">{npc.secret}</span></div>
      {#if npc.aiDetails}
        <div class="ai-box">🪄 {npc.aiDetails}</div>
      {/if}
    </div>

    <div class="npc-stats">
      {#each [['CC',npc.cc],['CT',npc.ct],['F',npc.f],['E',npc.e],['Bless',npc.bless],['I',npc.i],['Ag',npc.ag],['Int',npc.int],['FM',npc.fm],['Soc',npc.soc]] as [k,v]}
        <div class="npc-stat">
          <span class="npc-stat-k">{k}</span>
          <span class="npc-stat-v">{v}</span>
        </div>
      {/each}
    </div>

    <div class="npc-options-row">
      <label class="npc-hostile-row">
        <input type="checkbox" bind:checked={npc.hostile} />
        Hostile (Ennemi)
      </label>

      <label class="npc-hostile-row">
        <input type="checkbox" bind:checked={spawnOnMap} />
        Poser sur la carte
      </label>
    </div>

    {#if spawnedMsg}
      <div class="npc-spawned">{spawnedMsg}</div>
    {/if}

    <div class="npc-actions">
      <button class="npc-btn npc-btn-sec" onclick={reroll} title="Tirer un autre profil">🎲 Relancer</button>
      <button class="npc-btn npc-btn-ai" onclick={generateWithAi} disabled={isGeneratingAi} title="Enrichir avec Ollama">
        {isGeneratingAi ? '⏳ Réflexion...' : '🪄 Détails IA'}
      </button>
      <button class="npc-btn npc-btn-pri" onclick={confirm}>✔ Valider</button>
    </div>
  </div>
</div>

<style>
  .npc-backdrop {
    position: fixed; inset: 0; background: rgba(0,0,0,.7); z-index: 1500;
    display: flex; align-items: center; justify-content: center;
    backdrop-filter: blur(4px);
  }
  .npc-modal {
    background: #0f172a;
    border: 1px solid rgba(229, 168, 83, 0.4);
    border-radius: 12px;
    padding: 18px;
    width: 380px;
    max-width: 95vw;
    box-shadow: 0 16px 40px rgba(0,0,0,0.8), 0 0 15px rgba(229,168,83,0.15);
  }
  .npc-header {
    display: flex; justify-content: space-between; align-items: center;
    font-size: 13px; font-weight: 700; color: var(--accent, #e5a853);
    margin-bottom: 12px; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 6px;
  }
  .npc-close { background: none; border: none; color: #94a3b8; font-size: 16px; cursor: pointer; }
  .npc-name-row { display: flex; flex-direction: column; margin-bottom: 10px; }
  .npc-name { font-size: 16px; font-weight: 700; color: #f8fafc; }
  .npc-sub { font-size: 11px; color: var(--accent, #e5a853); font-weight: 600; }
  .npc-traits-box {
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 6px;
    padding: 8px 10px;
    margin-bottom: 10px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 11px;
  }
  .trait-k { color: #94a3b8; font-weight: 600; }
  .trait-v { color: #e2e8f0; }
  .ai-box {
    margin-top: 4px;
    padding-top: 4px;
    border-top: 1px dashed rgba(255, 255, 255, 0.1);
    color: #38bdf8;
    font-style: italic;
    line-height: 1.4;
  }
  .npc-stats {
    display: grid; grid-template-columns: repeat(5, 1fr); gap: 5px;
    margin-bottom: 12px;
  }
  .npc-stat {
    background: rgba(255,255,255,0.04); border-radius: 4px; padding: 4px 2px;
    text-align: center; border: 1px solid rgba(255,255,255,0.06);
  }
  .npc-stat-k { display: block; font-size: 9px; color: #94a3b8; font-weight: 700; }
  .npc-stat-v { font-size: 12px; font-weight: 700; color: #f8fafc; }
  .npc-options-row {
    display: flex; justify-content: space-between; align-items: center;
    margin-bottom: 12px; font-size: 11px; color: #cbd5e1;
  }
  .npc-hostile-row { display: flex; align-items: center; gap: 6px; cursor: pointer; }
  .npc-actions { display: flex; gap: 6px; }
  .npc-btn {
    flex: 1; padding: 7px 10px; border-radius: 6px; font-size: 11px; font-weight: 700;
    cursor: pointer; border: none; transition: all 0.15s;
  }
  .npc-btn-sec { background: rgba(255,255,255,0.08); color: #cbd5e1; }
  .npc-btn-sec:hover { background: rgba(255,255,255,0.15); }
  .npc-btn-ai { background: linear-gradient(135deg, #6366f1, #4f46e5); color: white; }
  .npc-btn-ai:hover { background: linear-gradient(135deg, #818cf8, #6366f1); }
  .npc-btn-pri { background: linear-gradient(135deg, #10b981, #059669); color: white; }
  .npc-btn-pri:hover { background: linear-gradient(135deg, #34d399, #10b981); }
  .npc-spawned {
    text-align: center; font-size: 11px; color: #34d399; font-weight: 700;
    margin-bottom: 8px;
  }
</style>
