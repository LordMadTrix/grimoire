<script lang="ts">
  let { onclose }: { onclose: () => void } = $props();

  const LOCATIONS = ['Forêt dense','Taverne sombre','Égout','Ruines elfiques','Route de campagne','Marais','Port','Château','Donjon','Plaine ouverte','Montagne','Village abandonné'];
  const TIMES = ['Aube','Matin','Midi','Après-midi','Crépuscule','Nuit','Minuit'];
  const THREATS = [
    { name:'Bandes de Skavens',      type:'ennemi',  diff:'facile',    icon:'🐀' },
    { name:'Patrouille de soldats',  type:'neutre',  diff:'variable',  icon:'⚔️' },
    { name:'Sorcier fou',            type:'ennemi',  diff:'difficile', icon:'🧙' },
    { name:'Troupe de gobelins',     type:'ennemi',  diff:'facile',    icon:'👺' },
    { name:'Marchand en détresse',   type:'allié',   diff:'social',    icon:'🧑‍💼' },
    { name:'Ogre solitaire',         type:'ennemi',  diff:'difficile', icon:'👹' },
    { name:'Cultistes de Nurgle',    type:'ennemi',  diff:'difficile', icon:'☣️' },
    { name:'Déserteur impérial',     type:'neutre',  diff:'social',    icon:'🏃' },
    { name:'Fantôme vengeur',        type:'ennemi',  diff:'moyen',     icon:'👻' },
    { name:'Seigneur du crime',      type:'ennemi',  diff:'moyen',     icon:'🗡️' },
    { name:'Brigands routiers',      type:'ennemi',  diff:'facile',    icon:'💰' },
    { name:'Inquisiteur de Sigmar',  type:'neutre',  diff:'social',    icon:'🔥' },
    { name:'Troupeau de Beastmen',   type:'ennemi',  diff:'moyen',     icon:'🐗' },
    { name:'Nécromancien itinérant', type:'ennemi',  diff:'difficile', icon:'💀' },
    { name:'Pèlerins paniqués',      type:'neutre',  diff:'social',    icon:'🙏' },
  ];
  const TWISTS = [
    'Un des ennemis est en réalité un espion impérial.',
    'Des innocents sont pris en otage.',
    'L\'affrontement se déroule près d\'un portail warpique instable.',
    'Une tempête éclate au milieu du combat.',
    'Un troisième groupe intervient au pire moment.',
    'L\'un des ennemis demande grâce et offre une information.',
    'Le terrain s\'effondre sous les combattants.',
    'Une odeur de corruption de Chaos imprègne les lieux.',
    'Des témoins pourraient alerter les autorités.',
    'L\'ennemi principal fuit dès la première blessure grave.',
  ];

  function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
  function rnd(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min; }

  type Encounter = { location: string; time: string; threat: typeof THREATS[0]; count: number; twist: string };
  let encounter = $state<Encounter | null>(null);
  let location = $state('');
  let time = $state('');

  function generate() {
    const threat = pick(THREATS);
    encounter = {
      location: location || pick(LOCATIONS),
      time: time || pick(TIMES),
      threat,
      count: rnd(2, 8),
      twist: pick(TWISTS),
    };
  }

  const DIFF_COLOR: Record<string, string> = { facile:'#22c55e', moyen:'#eab308', difficile:'#ef4444', social:'#3b82f6', variable:'#a855f7' };

  function copyMd() {
    if (!encounter) return;
    const md = `## Rencontre — ${encounter.location} (${encounter.time})\n\n**Menace :** ${encounter.threat.icon} ${encounter.threat.name} ×${encounter.count}\n**Difficulté :** ${encounter.threat.diff}\n\n**Twist :** _${encounter.twist}_`;
    navigator.clipboard.writeText(md);
  }

  generate();
</script>

<div class="eg-backdrop" onclick={onclose} role="none">
  <div class="eg-modal" onclick={e => e.stopPropagation()} role="dialog" aria-modal="true">
    <div class="eg-header">
      <span>⚔️ Rencontre Aléatoire</span>
      <button class="eg-close" onclick={onclose}>×</button>
    </div>

    <div class="eg-filters">
      <select class="eg-select" bind:value={location}>
        <option value="">Lieu aléatoire</option>
        {#each LOCATIONS as l}<option value={l}>{l}</option>{/each}
      </select>
      <select class="eg-select" bind:value={time}>
        <option value="">Heure aléatoire</option>
        {#each TIMES as t}<option value={t}>{t}</option>{/each}
      </select>
    </div>

    {#if encounter}
      <div class="eg-card">
        <div class="eg-location">{encounter.location} · {encounter.time}</div>
        <div class="eg-threat">
          <span class="eg-icon">{encounter.threat.icon}</span>
          <div class="eg-threat-info">
            <div class="eg-threat-name">{encounter.threat.name}</div>
            <div class="eg-meta">
              <span class="eg-count">×{encounter.count}</span>
              <span class="eg-diff" style="color:{DIFF_COLOR[encounter.threat.diff]}">{encounter.threat.diff}</span>
              <span class="eg-type">{encounter.threat.type}</span>
            </div>
          </div>
        </div>
        <div class="eg-twist-label">🌀 Twist</div>
        <div class="eg-twist">{encounter.twist}</div>
      </div>
    {/if}

    <div class="eg-actions">
      <button class="eg-btn eg-sec" onclick={copyMd}>📋 Copier MD</button>
      <button class="eg-btn eg-pri" onclick={generate}>🎲 Relancer</button>
      <button class="eg-btn eg-sec" onclick={onclose}>✔ Fermer</button>
    </div>
  </div>
</div>

<style>
  .eg-backdrop { position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:1500;display:flex;align-items:center;justify-content:center; }
  .eg-modal { background:var(--bg-secondary,#161b22);border:1px solid var(--border,#2d3748);border-radius:12px;padding:20px;width:360px;max-width:95vw;display:flex;flex-direction:column;gap:12px;box-shadow:0 12px 40px rgba(0,0,0,.7); }
  .eg-header { display:flex;justify-content:space-between;align-items:center;font-size:14px;font-weight:700;color:#e5a853; }
  .eg-close { background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:20px; }
  .eg-filters { display:flex;gap:8px; }
  .eg-select { flex:1;background:var(--bg-tertiary,#1c2233);border:1px solid var(--border);border-radius:6px;color:var(--text-primary,#c9d1d9);padding:6px 8px;font-size:12px; }
  .eg-card { background:var(--bg-tertiary);border:1px solid var(--border);border-radius:8px;padding:14px;display:flex;flex-direction:column;gap:8px; }
  .eg-location { font-size:12px;color:var(--text-muted);font-style:italic; }
  .eg-threat { display:flex;gap:10px;align-items:center; }
  .eg-icon { font-size:32px; }
  .eg-threat-name { font-size:16px;font-weight:700;color:var(--text-primary,#c9d1d9); }
  .eg-meta { display:flex;gap:8px;font-size:11px;margin-top:3px; }
  .eg-count { color:var(--accent,#e5a853);font-weight:700; }
  .eg-diff { font-weight:700; }
  .eg-type { color:var(--text-muted); }
  .eg-twist-label { font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.07em; }
  .eg-twist { font-size:12px;color:var(--text-primary);font-style:italic;line-height:1.5; }
  .eg-actions { display:flex;gap:6px; }
  .eg-btn { flex:1;padding:8px;border-radius:6px;font-size:12px;font-weight:700;cursor:pointer;border:none; }
  .eg-pri { background:#e5a853;color:#000; }
  .eg-sec { background:var(--bg-tertiary);border:1px solid var(--border);color:var(--text-muted); }
  .eg-sec:hover { border-color:var(--accent);color:var(--accent); }
</style>
