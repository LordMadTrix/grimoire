<script lang="ts">
  import { readFile, writeFile, createDirectory } from '$lib/api';
  import { getVaultPath } from '$lib/stores/vault.svelte';

  const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
  const MONTHS = [
    'Première Lune', 'Lune de Gel', 'Lune de Fonte',
    'Lune des Pluies', 'Lune de Croissance', 'Lune de Feu',
    'Lune de Moisson', 'Lune des Vents', 'Lune d\'Ambre',
    'Lune de Brume', 'Lune Froide', 'Lune de Nuit',
  ];
  const DAYS_PER_MONTH = 30;
  const MONTHS_PER_YEAR = 12;

  interface CalEvent { id: string; day: number; month: number; year: number; title: string; type: string; }

  interface CalState {
    day: number;
    month: number;
    year: number;
    events: CalEvent[];
  }

  let cal: CalState = $state({ day: 1, month: 1, year: 1432, events: [] });
  let loaded = $state(false);

  $effect(() => {
    const vp = getVaultPath();
    if (!vp || loaded) return;
    readFile(vp, '.grimoire/calendar.json').then(raw => {
      try { const d = JSON.parse(raw); cal.day = d.day ?? 1; cal.month = d.month ?? 1; cal.year = d.year ?? 1432; cal.events = d.events ?? []; }
      catch {}
      loaded = true;
    }).catch(() => { loaded = true; });
  });

  async function save() {
    const vp = getVaultPath();
    if (!vp) return;
    try {
      await writeFile(vp, '.grimoire/calendar.json', JSON.stringify({ day: cal.day, month: cal.month, year: cal.year, events: cal.events }, null, 2));
    } catch {
      try { await createDirectory(vp, '.grimoire'); await writeFile(vp, '.grimoire/calendar.json', JSON.stringify({ day: cal.day, month: cal.month, year: cal.year, events: cal.events }, null, 2)); }
      catch {}
    }
  }

  function advance(days: number) {
    let d = cal.day + days;
    let m = cal.month;
    let y = cal.year;
    while (d > DAYS_PER_MONTH) { d -= DAYS_PER_MONTH; m++; }
    while (m > MONTHS_PER_YEAR) { m -= MONTHS_PER_YEAR; y++; }
    cal.day = d; cal.month = m; cal.year = y;
    save();
  }

  function retreat(days: number) {
    let d = cal.day - days;
    let m = cal.month;
    let y = cal.year;
    while (d < 1) { d += DAYS_PER_MONTH; m--; }
    while (m < 1) { m += MONTHS_PER_YEAR; y--; }
    cal.day = d; cal.month = m; cal.year = y;
    save();
  }

  let dayOfWeek = $derived(((cal.day - 1 + (cal.month - 1) * DAYS_PER_MONTH + (cal.year - 1) * DAYS_PER_MONTH * MONTHS_PER_YEAR) % 7 + 7) % 7);

  let monthEvents = $derived(cal.events.filter((e: CalEvent) => e.month === cal.month && e.year === cal.year));

  let showForm = $state(false);
  let formTitle = $state('');
  let formType = $state('session');
  let formDay = $state(cal.day);

  function addEvent() {
    if (!formTitle.trim()) return;
    cal.events = [...cal.events, { id: Math.random().toString(36).slice(2), day: formDay, month: cal.month, year: cal.year, title: formTitle.trim(), type: formType }];
    save();
    showForm = false;
    formTitle = '';
  }

  function removeEvent(id: string) {
    cal.events = cal.events.filter((e: CalEvent) => e.id !== id);
    save();
  }

  const TYPE_ICONS: Record<string, string> = {
    session: '📅', battle: '⚔️', death: '💀', discovery: '🔍', rest: '🏕️', other: '📌',
  };
</script>

<div class="calendar">
  <div class="cal-date-display">
    <div class="cal-dayname">{DAYS[dayOfWeek]}</div>
    <div class="cal-main-date">
      <span class="cal-day">{cal.day}</span>
      <span class="cal-sep">/</span>
      <span class="cal-month">{MONTHS[cal.month - 1]}</span>
      <span class="cal-sep">/</span>
      <span class="cal-year">An {cal.year}</span>
    </div>
  </div>

  <div class="cal-controls">
    <div class="cal-group">
      <button onclick={() => retreat(1)} title="-1 jour">◀ J</button>
      <button onclick={() => retreat(7)} title="-7 jours">◀ S</button>
      <button onclick={() => retreat(DAYS_PER_MONTH)} title="-1 mois">◀ M</button>
    </div>
    <div class="cal-group">
      <button onclick={() => advance(1)} title="+1 jour">J ▶</button>
      <button onclick={() => advance(7)} title="+7 jours">S ▶</button>
      <button onclick={() => advance(DAYS_PER_MONTH)} title="+1 mois">M ▶</button>
    </div>
  </div>

  <div class="cal-events-header">
    <span>Événements — {MONTHS[cal.month - 1]}</span>
    <button class="cal-add-btn" onclick={() => { showForm = !showForm; formDay = cal.day; }}>＋</button>
  </div>

  {#if showForm}
    <div class="cal-form">
      <input type="number" bind:value={formDay} min="1" max={DAYS_PER_MONTH} class="form-day" placeholder="Jour" />
      <select bind:value={formType} class="form-type">
        {#each Object.entries(TYPE_ICONS) as [k, v]}
          <option value={k}>{v} {k}</option>
        {/each}
      </select>
      <input type="text" bind:value={formTitle} placeholder="Titre de l'événement…" class="form-title" onkeydown={(e) => e.key === 'Enter' && addEvent()} />
      <button onclick={addEvent} class="form-ok">✓</button>
    </div>
  {/if}

  <div class="cal-events">
    {#if monthEvents.length === 0}
      <div class="cal-empty">Aucun événement ce mois-ci</div>
    {:else}
      {#each monthEvents.sort((a, b) => a.day - b.day) as ev}
        <div class="cal-event" class:today={ev.day === cal.day}>
          <span class="ev-day">J.{ev.day}</span>
          <span class="ev-icon">{TYPE_ICONS[ev.type] ?? '📌'}</span>
          <span class="ev-title">{ev.title}</span>
          <button class="ev-del" onclick={() => removeEvent(ev.id)}>✕</button>
        </div>
      {/each}
    {/if}
  </div>
</div>

<style>
  .calendar {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0;
    padding: 20px;
    overflow-y: auto;
    max-width: 600px;
    margin: 0 auto;
    width: 100%;
  }

  .cal-date-display {
    text-align: center;
    padding: 24px 0 16px;
    border-bottom: 1px solid var(--border);
    margin-bottom: 16px;
  }

  .cal-dayname {
    font-size: 13px;
    color: var(--text-muted);
    letter-spacing: 3px;
    text-transform: uppercase;
    margin-bottom: 8px;
  }

  .cal-main-date {
    display: flex;
    align-items: baseline;
    justify-content: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .cal-day {
    font-size: 56px;
    font-weight: 800;
    color: var(--accent);
    font-family: 'JetBrains Mono', monospace;
    line-height: 1;
  }

  .cal-sep { color: var(--text-muted); font-size: 24px; }

  .cal-month {
    font-size: 22px;
    font-weight: 600;
    color: var(--text-primary);
    font-style: italic;
  }

  .cal-year {
    font-size: 16px;
    color: var(--text-secondary);
    font-family: monospace;
  }

  .cal-controls {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 20px;
  }

  .cal-group {
    display: flex;
    gap: 4px;
  }

  .cal-controls button {
    background: var(--bg-tertiary);
    border: 1px solid var(--border);
    color: var(--text-secondary);
    padding: 5px 12px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 12px;
    font-weight: 600;
    transition: all 0.1s;
  }
  .cal-controls button:hover { background: var(--bg-hover); color: var(--text-primary); border-color: var(--accent); }

  .cal-events-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.08em;
    color: var(--text-muted);
    text-transform: uppercase;
    padding: 0 0 8px;
    border-bottom: 1px solid var(--border);
    margin-bottom: 8px;
  }

  .cal-add-btn {
    background: var(--accent);
    border: none;
    color: #000;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    cursor: pointer;
    font-size: 14px;
    font-weight: 700;
    line-height: 1;
  }

  .cal-form {
    display: flex;
    gap: 6px;
    padding: 8px 0;
    border-bottom: 1px solid var(--border);
    margin-bottom: 8px;
    flex-wrap: wrap;
  }

  .form-day {
    width: 52px;
    background: var(--bg-tertiary);
    border: 1px solid var(--border);
    color: var(--text-primary);
    padding: 6px 8px;
    border-radius: 6px;
    font-size: 12px;
    outline: none;
    -moz-appearance: textfield;
  }
  .form-day::-webkit-inner-spin-button { -webkit-appearance: none; }

  .form-type {
    background: var(--bg-tertiary);
    border: 1px solid var(--border);
    color: var(--text-primary);
    padding: 6px 8px;
    border-radius: 6px;
    font-size: 12px;
    outline: none;
  }

  .form-title {
    flex: 1;
    min-width: 120px;
    background: var(--bg-tertiary);
    border: 1px solid var(--border);
    color: var(--text-primary);
    padding: 6px 10px;
    border-radius: 6px;
    font-size: 12px;
    outline: none;
  }
  .form-title:focus { border-color: var(--accent); }

  .form-ok {
    background: var(--accent);
    border: none;
    color: #000;
    padding: 6px 12px;
    border-radius: 6px;
    cursor: pointer;
    font-weight: 700;
  }

  .cal-events { display: flex; flex-direction: column; gap: 4px; }

  .cal-event {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
    border-radius: 6px;
    background: var(--bg-tertiary);
    border: 1px solid var(--border);
    transition: background 0.1s;
  }
  .cal-event.today {
    border-color: var(--accent);
    background: rgba(229, 168, 83, 0.08);
  }

  .ev-day {
    font-size: 10px;
    color: var(--text-muted);
    font-family: monospace;
    width: 30px;
    flex-shrink: 0;
  }

  .ev-icon { font-size: 14px; flex-shrink: 0; }

  .ev-title {
    flex: 1;
    font-size: 13px;
    color: var(--text-primary);
  }

  .ev-del {
    background: transparent;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    font-size: 11px;
    padding: 2px 4px;
    border-radius: 3px;
    flex-shrink: 0;
  }
  .ev-del:hover { background: rgba(239,68,68,0.15); color: #ef4444; }

  .cal-empty {
    text-align: center;
    padding: 24px;
    font-size: 13px;
    color: var(--text-muted);
  }
</style>
