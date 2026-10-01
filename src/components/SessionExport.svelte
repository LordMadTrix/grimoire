<script lang="ts">
  import { vttStore } from '$lib/stores/vtt.svelte';
  import { readFile, askOllama, transcribeStatus, transcribeDownloadModel, transcribeOpenBinFolder, transcribeAudio, type TranscribeStatus } from '$lib/api';
  import { getVaultPath } from '$lib/stores/vault.svelte';
  import { listen } from '@tauri-apps/api/event';
  import { open as openFileDialog } from '@tauri-apps/plugin-dialog';

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

  async function exportGrimoirePack() {
    exporting = true;
    try {
      const pack = {
        format: 'grimoirepack',
        version: 1,
        createdAt: new Date().toISOString(),
        campaignTitle: vttStore.campaignTitle || 'Aventure Grimoire',
        currentMapRelPath: vttStore.currentMapRelPath,
        currentMap: vttStore.currentMap, // Data URL
        fowShapes: vttStore.fowShapes,
        tokens: vttStore.tokens,
        pins: vttStore.pins,
        spells: vttStore.spells,
        walls: vttStore.walls,
        audioZones: vttStore.audioZones,
        weather: vttStore.weather,
        ambientLight: vttStore.ambientLight,
        lights: vttStore.lights,
        combatants: vttStore.combatants,
        dungeonTiles: vttStore.dungeonTiles,
        maps: vttStore.maps
      };

      const jsonStr = JSON.stringify(pack, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const cleanTitle = (vttStore.campaignTitle || 'aventure').toLowerCase().replace(/[^a-z0-9]/g, '-');
      a.download = `${cleanTitle}-${new Date().toISOString().slice(0,10)}.grimoirepack`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      exporting = false;
    }
  }

  function handleImportPack(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const raw = e.target?.result as string;
        const pack = JSON.parse(raw);
        if (pack.format !== 'grimoirepack') {
          alert('Fichier invalide : ce n\'est pas un format .grimoirepack valide.');
          return;
        }

        if (pack.currentMap) vttStore.currentMap = pack.currentMap;
        if (pack.currentMapRelPath) vttStore.currentMapRelPath = pack.currentMapRelPath;
        if (pack.fowShapes) vttStore.fowShapes = pack.fowShapes;
        if (pack.tokens) vttStore.tokens = pack.tokens;
        if (pack.pins) vttStore.pins = pack.pins;
        if (pack.spells) vttStore.spells = pack.spells;
        if (pack.walls) vttStore.walls = pack.walls;
        if (pack.audioZones) vttStore.audioZones = pack.audioZones;
        if (pack.weather) vttStore.weather = pack.weather;
        if (pack.ambientLight) vttStore.ambientLight = pack.ambientLight;
        if (pack.lights) vttStore.lights = pack.lights;
        if (pack.combatants) vttStore.combatants = pack.combatants;
        if (pack.dungeonTiles) vttStore.dungeonTiles = pack.dungeonTiles;
        if (pack.maps) vttStore.maps = pack.maps;
        if (pack.campaignTitle) vttStore.campaignTitle = pack.campaignTitle;

        alert('✅ Pack d\'Aventure chargé avec succès !');
        visible = false;
      } catch (err) {
        alert('Erreur lors du chargement du pack : ' + String(err));
      }
    };
    reader.readAsText(file);
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

  // ── Chronique de séance automatique (IA locale) ────────────────────────────
  let chronicle = $state('');
  let generatingChronicle = $state(false);

  /** Rassemble les faits bruts de la séance pour le prompt IA */
  async function buildSessionFacts(): Promise<string> {
    const combatants = vttStore.combatants;
    const [timeline, calEvents] = await Promise.all([loadTimelineEvents(), loadCalendarEvents()]);
    const parts: string[] = [];
    parts.push(`Carte active : ${vttStore.currentMapRelPath?.split('/').pop()?.replace(/\.[^.]+$/, '') ?? 'aucune'} (météo : ${vttStore.weather}, round de combat : ${vttStore.combatRound}).`);
    if (vttStore.campaignTitle) parts.push(`Campagne : ${vttStore.campaignTitle}.`);
    if (combatants.length > 0) {
      parts.push(`Combat (round ${vttStore.combatRound}) : ${combatants.map(c => `${c.name} (init ${c.initiative}, ${c.hp}/${c.maxHp} PV, ${c.isEnemy ? 'ennemi' : 'allie'})`).join('; ')}.`);
    }
    if (timeline.length > 0) {
      parts.push(`Événements récents : ${timeline.slice(-15).map((e: any) => `${e.date ?? ''} ${e.title ?? ''}${e.description ? ` (${e.description})` : ''}`).join('; ')}.`);
    }
    if (calEvents.length > 0) {
      parts.push(`Calendrier : ${calEvents.slice(-10).map((e: any) => `jour ${e.day} ${e.month}/${e.year} — ${e.title}`).join('; ')}.`);
    }
    const players = vttStore.tokens.filter(t => !t.isEnemy).map(t => t.name);
    if (players.length > 0) parts.push(`Personnages présents sur la table : ${players.join(', ')}.`);
    return parts.join('\n');
  }

  async function generateChronicle() {
    if (generatingChronicle) return;
    generatingChronicle = true;
    try {
      const facts = await buildSessionFacts();
      const prompt = `Tu es le scribe d'une campagne de jeu de rôle sombre et réaliste.\nÀ partir des FAITS DE LA SÉANCE ci-dessous, rédige une chronique narrative immersive de la séance (300 à 500 mots, en français, style récit au passé).\nStructure : un titre évocateur en première ligne, puis 3 à 5 paragraphes qui racontent ce qui s'est passé en s'appuyant UNIQUEMENT sur les faits fournis (ne rien inventer de contradictoire). Termine par une ligne « À suivre » avec un hook narratif.\n\nFAITS DE LA SÉANCE :\n${facts}`;
      chronicle = await askOllama(prompt, '', '');
    } catch (e) {
      alert('Génération de la chronique impossible : ' + String(e));
    } finally {
      generatingChronicle = false;
    }
  }

  async function exportChronicleHtml() {
    const now = new Date().toLocaleDateString('fr-FR', { dateStyle: 'long' });
    const html = `<!DOCTYPE html>\n<html lang="fr">\n<head><meta charset="UTF-8"><title>Chronique de séance — Grimoire</title>\n<style>body{font-family:Georgia,serif;background:#0e1117;color:#c9d1d9;padding:40px;max-width:800px;margin:0 auto;line-height:1.7}h1{color:#e5a853;border-bottom:2px solid #e5a853;padding-bottom:8px}.date{color:#8899b7;margin-bottom:24px}p{margin:0 0 14px}@media print{body{background:white;color:black}h1{color:#b07830}}</style></head>\n<body><h1>📖 Chronique de Séance</h1><div class="date">${now}</div>${chronicle.split(/\n{2,}/).map(p => `<p>${escHtml(p).replace(/\n/g, '<br>')}</p>`).join('')}\n<div style="margin-top:40px;padding-top:16px;border-top:1px solid #1c2233;font-size:11px;color:#4a5568;text-align:center">Généré par Grimoire · ${now}</div></body></html>`;
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chronique-${new Date().toISOString().slice(0, 10)}.html`;
    a.click();
    URL.revokeObjectURL(url);
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

  // ── Transcription locale de la séance (whisper.cpp) ───────────────────────
  let trStatus = $state<TranscribeStatus | null>(null);
  let trDownloadPct = $state(-1);
  let trTranscribing = $state(false);
  let trResult = $state('');
  let trError = $state('');

  async function refreshTrStatus() {
    try { trStatus = await transcribeStatus(); } catch { trStatus = null; }
  }

  const trReady = $derived(!!trStatus?.binary_exists && !!trStatus?.model_exists);

  async function trDownload() {
    trDownloadPct = 0;
    try {
      await transcribeDownloadModel();
      await refreshTrStatus();
    } catch (e) {
      trError = String(e);
    } finally {
      trDownloadPct = -1;
    }
  }

  async function trPickAndTranscribe() {
    if (trTranscribing) return;
    trError = '';
    try {
      const selected = await openFileDialog({
        multiple: false,
        directory: false,
        filters: [{ name: 'Audio', extensions: ['wav', 'mp3', 'ogg', 'flac', 'm4a'] }],
      });
      if (!selected) return;
      trTranscribing = true;
      trResult = '';
      trResult = await transcribeAudio(selected as string);
    } catch (e) {
      trError = String(e);
    } finally {
      trTranscribing = false;
    }
  }
</script>

<button class="export-toggle" onclick={toggle} title="Exporter / Importer le rapport de session">📋</button>

{#if visible}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="export-backdrop" onclick={() => visible = false} role="presentation">
    <div class="export-panel" onclick={e => e.stopPropagation()} role="dialog" aria-modal="true" tabindex="-1">
      <div class="export-header">
        <span>📋 Gestionnaire de Session & Packs</span>
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
            <span class="preview-label">🌤️ Météo / Lumière</span>
            <span class="preview-val">{vttStore.weather} / {vttStore.ambientLight}</span>
          </div>
          <div class="preview-row">
            <span class="preview-label">🗺️ Scènes</span>
            <span class="preview-val">{vttStore.maps.length}</span>
          </div>
        </div>

        <div style="font-size:11px;font-weight:bold;color:var(--accent);text-transform:uppercase;margin-top:2px">
          📦 Pack d'Aventure Complet (.grimoirepack)
        </div>
        <div class="export-actions">
          <button class="btn-pack-export" onclick={exportGrimoirePack} disabled={exporting}>
            📦 Exporter Pack .grimoirepack
          </button>
          <label class="btn-pack-import">
            📂 Importer Pack
            <input type="file" accept=".grimoirepack,.json" onchange={handleImportPack} style="display:none"/>
          </label>
        </div>

        <div style="font-size:11px;font-weight:bold;color:var(--accent);text-transform:uppercase;margin-top:4px">
          📖 Chronique de Séance (IA locale)
        </div>
        {#if !chronicle}
          <button class="btn-export" style="width:100%" onclick={generateChronicle} disabled={generatingChronicle}>
            {generatingChronicle ? '⏳ Le scribe rédige…' : '✨ Générer la chronique de la séance'}
          </button>
        {:else}
          <textarea class="chronicle-edit" bind:value={chronicle} rows="9" placeholder="La chronique apparaîtra ici — vous pouvez la corriger avant export."></textarea>
          <div class="export-actions">
            <button class="btn-export" onclick={exportChronicleHtml} disabled={exporting}>💾 Chronique HTML</button>
            <button class="btn-export" onclick={generateChronicle} disabled={generatingChronicle}>{generatingChronicle ? '⏳ …' : '🔄 Régénérer'}</button>
          </div>
        {/if}

        <div style="font-size:11px;font-weight:bold;color:var(--accent);text-transform:uppercase;margin-top:4px">
          🎙️ Transcription de table (100% local, whisper)
        </div>
        {#if !trStatus}
          <button class="btn-export" style="width:100%" onclick={refreshTrStatus}>Vérifier l'installation…</button>
        {:else if !trReady}
          <div style="font-size:11px;color:var(--text-muted);line-height:1.5">
            {!trStatus.binary_exists
              ? `Binaire whisper-cli requis : placez-le dans ${trStatus.binary_path}`
              : 'Modèle whisper manquant (≈142 Mo, téléchargé une fois).'}
          </div>
          {#if trStatus.binary_exists && !trStatus.model_exists}
            {#if trDownloadPct >= 0}
              <div style="font-size:11px">⏳ Téléchargement du modèle… {trDownloadPct}%</div>
            {:else}
              <button class="btn-export" style="width:100%" onclick={trDownload}>⬇️ Télécharger le modèle whisper</button>
            {/if}
          {:else}
            <button class="btn-export" style="width:100%" onclick={() => transcribeOpenBinFolder()}>📂 Ouvrir le dossier d'installation</button>
          {/if}
        {:else}
          <button class="btn-export" style="width:100%" onclick={trPickAndTranscribe} disabled={trTranscribing}>
            {trTranscribing ? '⏳ Transcription en cours…' : '🎙️ Transcrire un enregistrement de séance'}
          </button>
        {/if}
        {#if trError}
          <div style="font-size:11px;color:#f85149">{trError}</div>
        {/if}
        {#if trResult}
          <textarea class="chronicle-edit" bind:value={trResult} rows="6" placeholder="Transcription…"></textarea>
        {/if}

        <div style="font-size:11px;font-weight:bold;color:var(--text-muted);text-transform:uppercase;margin-top:4px">
          📜 Rapport Imprimable
        </div>
        <div class="export-actions">
          <button class="btn-export" onclick={exportHtml} disabled={exporting}>
            {exporting ? '⏳ Génération…' : '💾 Rapport HTML'}
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

  .export-actions {
    display: flex;
    gap: 8px;
  }

  .btn-export, .btn-print, .btn-pack-export, .btn-pack-import {
    flex: 1;
    padding: 8px 12px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.1s;
    text-align: center;
    display: inline-block;
  }

  .btn-pack-export {
    background: #e5a853;
    border: none;
    color: #000;
  }
  .btn-pack-export:hover:not(:disabled) { opacity: 0.85; }
  .btn-pack-export:disabled { opacity: 0.5; cursor: wait; }

  .btn-pack-import {
    background: #1f6feb;
    border: none;
    color: #fff;
  }
  .btn-pack-import:hover { background: #388bfd; }

  .chronicle-edit {
    width: 100%;
    background: var(--bg-tertiary);
    border: 1px solid var(--border);
    border-radius: 6px;
    color: var(--text-primary);
    font-family: Georgia, serif;
    font-size: 12.5px;
    line-height: 1.6;
    padding: 10px;
    resize: vertical;
  }
  .chronicle-edit:focus { outline: 1px solid var(--accent); }

  .btn-export {
    background: var(--bg-tertiary);
    border: 1px solid var(--border);
    color: var(--text-primary);
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
