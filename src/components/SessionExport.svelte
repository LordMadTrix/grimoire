<script lang="ts">
  import { vttStore } from '$lib/stores/vtt.svelte';
  import { readFile } from '$lib/api';
  import { getVaultPath } from '$lib/stores/vault.svelte';

  let visible = $state(false);
  let exporting = $state(false);

  export function toggle() { visible = !visible; }

  const TYPE_LABELS: Record<string, string> = {
    session: 'Session', battle: 'Bataille', death: 'Mort',
    discovery: 'Découverte', rest: 'Repos', other: 'Autre',
    plot: 'Intrigue',
  };

  const WEATHER_LABELS: Record<string, string> = {
    none: 'Aucune', rain: 'Pluie', snow: 'Neige', fog: 'Brouillard', embers: 'Braises',
  };

  async function loadTimelineEvents(): Promise<any[]> {
    const vp = getVaultPath();
    if (!vp) return [];
    try {
      const raw = await readFile(vp, '.grimoire/timeline.json');
      return JSON.parse(raw) ?? [];
    } catch { return []; }
  }

  async function loadCalendarEvents(): Promise<any[]> {
    const vp = getVaultPath();
    if (!vp) return [];
    try {
      const raw = await readFile(vp, '.grimoire/calendar.json');
      const d = JSON.parse(raw);
      return d.events ?? [];
    } catch { return []; }
  }

  async function generateHtml(): Promise<string> {
    const timeline = await loadTimelineEvents();
    const calEvents = await loadCalendarEvents();
    const now = new Date().toLocaleDateString('fr-FR', { dateStyle: 'long' });

    const tokens = vttStore.tokens;
    const combatants = vttStore.combatants;
    const weather = WEATHER_LABELS[vttStore.weather] ?? vttStore.weather;
    const mapName = vttStore.currentMapRelPath?.split('/').pop()?.replace(/\.[^.]+$/, '') ?? '—';

    const tokenRows = tokens.map(t => `
      <tr>
        <td>${escHtml(t.name)}</td>
        <td>${t.hp ?? '—'}/${t.maxHp ?? '—'}</td>
        <td>${t.isEnemy ? '⚔️ Ennemi' : '🛡️ Allié'}</td>
        <td>${(t.conditions ?? []).join(', ') || '—'}</td>
        <td style="max-width:200px;font-size:11px">${escHtml(t.notes ?? '')}</td>
      </tr>`).join('');

    const combatRows = combatants.map((c, i) => `
      <tr class="${i === vttStore.currentTurn ? 'active-turn' : ''}">
        <td>${i + 1}</td>
        <td>${escHtml(c.name)}</td>
        <td>${c.initiative}</td>
        <td>${c.hp}/${c.maxHp}</td>
        <td>${c.isEnemy ? '⚔️' : '🛡️'}</td>
      </tr>`).join('');

    const timelineRows = timeline.slice(-20).map((e: any) => `
      <tr>
        <td>${escHtml(e.date ?? '')}</td>
        <td>${TYPE_LABELS[e.type] ?? e.type}</td>
        <td>${escHtml(e.title ?? '')}</td>
        <td style="font-size:11px">${escHtml(e.description ?? '')}</td>
      </tr>`).join('');

    const calRows = calEvents.slice(-20).map((e: any) => `
      <tr>
        <td>J.${e.day} — ${e.month}/${e.year}</td>
        <td>${TYPE_LABELS[e.type] ?? e.type}</td>
        <td>${escHtml(e.title ?? '')}</td>
      </tr>`).join('');

    return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Export de Session — Grimoire</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Georgia', serif; background: #0e1117; color: #c9d1d9; padding: 40px; max-width: 900px; margin: 0 auto; }
  h1 { color: #e5a853; font-size: 28px; margin-bottom: 4px; border-bottom: 2px solid #e5a853; padding-bottom: 8px; }
  h2 { color: #8899b7; font-size: 16px; margin: 28px 0 10px; text-transform: uppercase; letter-spacing: 2px; }
  .meta { color: #8899b7; font-size: 13px; margin: 8px 0 24px; display: flex; gap: 24px; flex-wrap: wrap; }
  .meta span { display: flex; align-items: center; gap: 6px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 20px; }
  th { background: #1c2233; color: #8899b7; padding: 8px 10px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; }
  td { padding: 7px 10px; border-bottom: 1px solid #1c2233; vertical-align: top; }
  tr:hover td { background: rgba(229,168,83,0.04); }
  .active-turn td { border-left: 3px solid #e5a853; color: #e5a853; }
  .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #1c2233; font-size: 11px; color: #4a5568; text-align: center; }
  @media print { body { background: white; color: black; } h1 { color: #b07830; } }
</style>
</head>
<body>
<h1>📜 Rapport de Session</h1>
<div class="meta">
  <span>📅 ${now}</span>
  <span>🗺️ Carte : ${escHtml(mapName)}</span>
  <span>🌤️ Météo : ${weather}</span>
  <span>⚔️ Round : ${vttStore.combatRound}</span>
  <span>👥 Tokens : ${tokens.length}</span>
</div>

${tokens.length > 0 ? `
<h2>🎭 Pions sur la Carte</h2>
<table>
  <thead><tr><th>Nom</th><th>PV</th><th>Type</th><th>Conditions</th><th>Notes</th></tr></thead>
  <tbody>${tokenRows}</tbody>
</table>` : ''}

${combatants.length > 0 ? `
<h2>⚔️ Ordre de Combat (Round ${vttStore.combatRound})</h2>
<table>
  <thead><tr><th>#</th><th>Nom</th><th>Initiative</th><th>PV</th><th>Faction</th></tr></thead>
  <tbody>${combatRows}</tbody>
</table>` : ''}

${calEvents.length > 0 ? `
<h2>📅 Calendrier — Événements Récents</h2>
<table>
  <thead><tr><th>Date</th><th>Type</th><th>Événement</th></tr></thead>
  <tbody>${calRows}</tbody>
</table>` : ''}

${timeline.length > 0 ? `
<h2>📜 Timeline — Événements Récents</h2>
<table>
  <thead><tr><th>Date</th><th>Type</th><th>Titre</th><th>Description</th></tr></thead>
  <tbody>${timelineRows}</tbody>
</table>` : ''}

<div class="footer">Généré par Grimoire · ${now}</div>
</body>
</html>`;
  }

  function escHtml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  async function exportHtml() {
    exporting = true;
    try {
      const html = await generateHtml();
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `grimoire-session-${new Date().toISOString().slice(0,10)}.html`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      exporting = false;
    }
  }

  async function printReport() {
    exporting = true;
    try {
      const html = await generateHtml();
      const win = window.open('', '_blank');
      if (!win) return;
      win.document.write(html);
      win.document.close();
      win.focus();
      setTimeout(() => win.print(), 400);
    } finally {
      exporting = false;
    }
  }
</script>

<button class="export-toggle" onclick={toggle} title="Exporter le rapport de session">📋</button>

{#if visible}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="export-backdrop" onclick={() => visible = false}>
    <div class="export-panel" onclick={e => e.stopPropagation()}>
      <div class="export-header">
        <span>📋 Exporter la Session</span>
        <button class="close-btn" onclick={() => visible = false}>✕</button>
      </div>

      <div class="export-body">
        <div class="export-preview">
          <div class="preview-row">
            <span class="preview-label">🗺️ Carte active</span>
            <span class="preview-val">{vttStore.currentMapRelPath?.split('/').pop()?.replace(/\.[^.]+$/, '') ?? '—'}</span>
          </div>
          <div class="preview-row">
            <span class="preview-label">🎭 Tokens</span>
            <span class="preview-val">{vttStore.tokens.length}</span>
          </div>
          <div class="preview-row">
            <span class="preview-label">⚔️ Combattants</span>
            <span class="preview-val">{vttStore.combatants.length} (Round {vttStore.combatRound})</span>
          </div>
          <div class="preview-row">
            <span class="preview-label">🌤️ Météo</span>
            <span class="preview-val">{vttStore.weather}</span>
          </div>
          <div class="preview-row">
            <span class="preview-label">🗺️ Scènes</span>
            <span class="preview-val">{vttStore.maps.length}</span>
          </div>
        </div>

        <p class="export-desc">
          Génère un rapport HTML complet incluant tokens, combat, calendrier et timeline.
        </p>

        <div class="export-actions">
          <button class="btn-export" onclick={exportHtml} disabled={exporting}>
            {exporting ? '⏳ Génération…' : '💾 Télécharger HTML'}
          </button>
          <button class="btn-print" onclick={printReport} disabled={exporting}>
            🖨️ Imprimer / PDF
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .export-toggle {
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 3px 8px;
    font-size: 14px;
    cursor: pointer;
    transition: all 0.15s;
  }
  .export-toggle:hover { background: var(--bg-hover); }

  .export-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.4);
    z-index: 9000;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .export-panel {
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 12px;
    width: 380px;
    box-shadow: 0 16px 48px rgba(0,0,0,0.5);
    animation: slideDown 0.15s ease-out;
    overflow: hidden;
  }

  @keyframes slideDown {
    from { opacity: 0; transform: translateY(-8px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  .export-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 16px;
    border-bottom: 1px solid var(--border);
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .close-btn {
    background: transparent;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    font-size: 14px;
    padding: 2px 6px;
    border-radius: 4px;
  }
  .close-btn:hover { background: var(--bg-hover); }

  .export-body { padding: 16px; display: flex; flex-direction: column; gap: 14px; }

  .export-preview {
    background: var(--bg-tertiary);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .preview-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 12px;
  }

  .preview-label { color: var(--text-muted); }
  .preview-val { color: var(--text-primary); font-weight: 500; font-family: monospace; }

  .export-desc {
    font-size: 12px;
    color: var(--text-muted);
    line-height: 1.5;
  }

  .export-actions {
    display: flex;
    gap: 8px;
  }

  .btn-export, .btn-print {
    flex: 1;
    padding: 8px 12px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.1s;
  }

  .btn-export {
    background: var(--accent);
    border: none;
    color: #000;
  }
  .btn-export:hover:not(:disabled) { opacity: 0.85; }
  .btn-export:disabled { opacity: 0.5; cursor: wait; }

  .btn-print {
    background: var(--bg-tertiary);
    border: 1px solid var(--border);
    color: var(--text-primary);
  }
  .btn-print:hover:not(:disabled) { background: var(--bg-hover); }
  .btn-print:disabled { opacity: 0.5; cursor: wait; }
</style>
