<script lang="ts">
  import { readFile, writeFile, createDirectory } from '$lib/api';
  import { getVaultPath } from '$lib/stores/vault.svelte';
  import { onMount } from 'svelte';

  interface TimelineEvent {
    id: string;
    date: string;
    title: string;
    description: string;
    type: 'session' | 'battle' | 'death' | 'discovery' | 'plot' | 'other';
  }

  const EVENT_TYPES = [
    { id: 'session',   emoji: '📅', label: 'Session',    color: '#22c55e' },
    { id: 'battle',    emoji: '⚔️', label: 'Combat',     color: '#ef4444' },
    { id: 'death',     emoji: '💀', label: 'Mort',       color: '#6b7280' },
    { id: 'discovery', emoji: '🔍', label: 'Découverte', color: '#3b82f6' },
    { id: 'plot',      emoji: '📖', label: 'Intrigue',   color: '#e5a853' },
    { id: 'other',     emoji: '📌', label: 'Autre',      color: '#a855f7' },
  ];

  const TL_PATH = '.grimoire/timeline.json';

  let events = $state<TimelineEvent[]>([]);
  let loaded = $state(false);

  let showForm = $state(false);
  let editingId = $state<string | null>(null);
  let formDate = $state('');
  let formTitle = $state('');
  let formDesc = $state('');
  let formType = $state<TimelineEvent['type']>('other');

  onMount(loadTimeline);

  async function loadTimeline() {
    const vp = getVaultPath();
    if (!vp) return;
    try {
      const raw = await readFile(vp, TL_PATH);
      events = JSON.parse(raw) ?? [];
    } catch { events = []; }
    loaded = true;
  }

  async function saveTimeline() {
    const vp = getVaultPath();
    if (!vp) return;
    try {
      await writeFile(vp, TL_PATH, JSON.stringify(events, null, 2));
    } catch {
      await createDirectory(vp, '.grimoire');
      await writeFile(vp, TL_PATH, JSON.stringify(events, null, 2));
    }
  }

  function openNewForm() {
    editingId = null;
    formDate = ''; formTitle = ''; formDesc = ''; formType = 'other';
    showForm = true;
  }

  function openEditForm(evt: TimelineEvent) {
    editingId = evt.id;
    formDate = evt.date; formTitle = evt.title; formDesc = evt.description; formType = evt.type;
    showForm = true;
  }

  function submitForm() {
    if (!formTitle.trim()) return;
    if (editingId) {
      events = events.map(e => e.id === editingId
        ? { ...e, date: formDate, title: formTitle, description: formDesc, type: formType }
        : e);
    } else {
      events = [...events, {
        id: Date.now().toString(36), date: formDate, title: formTitle,
        description: formDesc, type: formType,
      }];
    }
    saveTimeline();
    showForm = false;
  }

  function deleteEvent(id: string) {
    if (!window.confirm('Supprimer cet événement ?')) return;
    events = events.filter(e => e.id !== id);
    saveTimeline();
  }

  function getTypeInfo(type: string) {
    return EVENT_TYPES.find(t => t.id === type) ?? EVENT_TYPES[EVENT_TYPES.length - 1];
  }
</script>

<div class="timeline-view">
  <div class="tl-header">
    <h2>📜 Timeline de Campagne</h2>
    <button class="tl-add-btn" onclick={openNewForm}>+ Événement</button>
  </div>

  {#if !loaded}
    <div class="tl-loading">Chargement…</div>
  {:else if events.length === 0}
    <div class="tl-empty">
      <div class="tl-empty-icon">📜</div>
      <p>Aucun événement pour l'instant.</p>
      <button class="tl-add-btn-empty" onclick={openNewForm}>Ajouter le premier événement</button>
    </div>
  {:else}
    <div class="tl-scroll">
      <div class="tl-line"></div>
      {#each events as evt}
        {@const info = getTypeInfo(evt.type)}
        <div class="tl-event">
          <div class="tl-dot" style="background: {info.color}; border-color: {info.color}">
            {info.emoji}
          </div>
          <div class="tl-card">
            <div class="tl-card-header">
              <span class="tl-type-badge" style="color: {info.color}; border-color: {info.color}30; background: {info.color}15">
                {info.emoji} {info.label}
              </span>
              {#if evt.date}
                <span class="tl-date">{evt.date}</span>
              {/if}
              <div class="tl-actions">
                <button onclick={() => openEditForm(evt)} title="Modifier">✏️</button>
                <button onclick={() => deleteEvent(evt.id)} title="Supprimer">🗑️</button>
              </div>
            </div>
            <div class="tl-title">{evt.title}</div>
            {#if evt.description}
              <div class="tl-desc">{evt.description}</div>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

{#if showForm}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="tl-modal-bg" onclick={() => showForm = false}>
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div class="tl-modal" onclick={e => e.stopPropagation()}>
      <h3>{editingId ? '✏️ Modifier' : '➕ Nouvel événement'}</h3>

      <div class="tl-form-group">
        <label>Type</label>
        <div class="tl-type-grid">
          {#each EVENT_TYPES as t}
            <button
              class="tl-type-btn"
              class:active={formType === t.id}
              style={formType === t.id ? `border-color: ${t.color}; background: ${t.color}15; color: ${t.color}` : ''}
              onclick={() => formType = t.id as TimelineEvent['type']}
            >{t.emoji} {t.label}</button>
          {/each}
        </div>
      </div>

      <div class="tl-form-row">
        <div class="tl-form-group">
          <label>Date in-game</label>
          <input type="text" bind:value={formDate} placeholder="ex: Jour 12, An 1432…" />
        </div>
      </div>

      <div class="tl-form-group">
        <label>Titre *</label>
        <input type="text" bind:value={formTitle} placeholder="Titre de l'événement" />
      </div>

      <div class="tl-form-group">
        <label>Description</label>
        <textarea bind:value={formDesc} rows="3" placeholder="Résumé de l'événement…"></textarea>
      </div>

      <div class="tl-modal-actions">
        <button class="tl-cancel" onclick={() => showForm = false}>Annuler</button>
        <button class="tl-save" onclick={submitForm}>{editingId ? 'Mettre à jour' : 'Créer'}</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .timeline-view {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--bg-primary);
    overflow: hidden;
  }

  .tl-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 24px;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }

  .tl-header h2 {
    margin: 0;
    font-size: 18px;
    color: var(--text-primary);
  }

  .tl-add-btn {
    background: rgba(229, 168, 83, 0.12);
    border: 1px solid var(--accent);
    border-radius: 6px;
    color: var(--accent);
    padding: 6px 14px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s;
  }
  .tl-add-btn:hover { background: rgba(229, 168, 83, 0.22); }

  .tl-loading, .tl-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    flex: 1;
    color: var(--text-muted);
    gap: 12px;
  }

  .tl-empty-icon { font-size: 48px; opacity: 0.3; }
  .tl-empty p { font-size: 14px; margin: 0; }

  .tl-add-btn-empty {
    background: transparent;
    border: 1px dashed var(--border);
    border-radius: 8px;
    color: var(--text-muted);
    padding: 8px 20px;
    font-size: 13px;
    cursor: pointer;
    transition: all 0.15s;
  }
  .tl-add-btn-empty:hover { border-color: var(--accent); color: var(--accent); }

  .tl-scroll {
    flex: 1;
    overflow-y: auto;
    padding: 24px 32px;
    position: relative;
  }

  .tl-line {
    position: absolute;
    left: 52px;
    top: 0;
    bottom: 0;
    width: 2px;
    background: linear-gradient(to bottom, transparent, var(--border), transparent);
  }

  .tl-event {
    display: flex;
    gap: 20px;
    margin-bottom: 24px;
    position: relative;
  }

  .tl-dot {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    border: 2px solid;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
    flex-shrink: 0;
    position: relative;
    z-index: 1;
    background: var(--bg-secondary);
  }

  .tl-card {
    flex: 1;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 12px 16px;
    transition: border-color 0.15s;
  }
  .tl-card:hover { border-color: var(--accent); }

  .tl-card-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 6px;
  }

  .tl-type-badge {
    font-size: 11px;
    font-weight: 600;
    padding: 2px 8px;
    border-radius: 12px;
    border: 1px solid;
    flex-shrink: 0;
  }

  .tl-date {
    font-size: 12px;
    color: var(--text-muted);
    font-style: italic;
    flex: 1;
  }

  .tl-actions {
    display: flex;
    gap: 4px;
    opacity: 0;
    transition: opacity 0.1s;
  }
  .tl-card:hover .tl-actions { opacity: 1; }

  .tl-actions button {
    background: transparent; border: none;
    cursor: pointer; font-size: 13px; padding: 2px 4px;
    border-radius: 3px; color: var(--text-muted);
  }
  .tl-actions button:hover { background: var(--bg-hover); color: var(--text-primary); }

  .tl-title {
    font-size: 15px;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 4px;
  }

  .tl-desc {
    font-size: 13px;
    color: var(--text-secondary);
    line-height: 1.5;
    white-space: pre-wrap;
  }

  /* ── Modal ──────────────────────────────────────────────────────── */

  .tl-modal-bg {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.55);
    backdrop-filter: blur(3px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
  }

  .tl-modal {
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 24px;
    width: 480px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    box-shadow: 0 16px 48px rgba(0,0,0,0.5);
    animation: fadeIn 0.15s ease;
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: scale(0.97); }
    to   { opacity: 1; transform: scale(1); }
  }

  .tl-modal h3 { margin: 0; font-size: 16px; color: var(--text-primary); }

  .tl-form-group { display: flex; flex-direction: column; gap: 6px; }
  .tl-form-row { display: flex; gap: 12px; }
  .tl-form-row .tl-form-group { flex: 1; }

  label { font-size: 12px; color: var(--text-secondary); }

  input[type="text"], textarea {
    background: var(--bg-tertiary);
    border: 1px solid var(--border);
    color: var(--text-primary);
    padding: 7px 10px;
    border-radius: 4px;
    outline: none;
    width: 100%;
    box-sizing: border-box;
    font-family: inherit;
    font-size: 13px;
  }
  input:focus, textarea:focus { border-color: var(--accent); }

  textarea { resize: vertical; }

  .tl-type-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .tl-type-btn {
    padding: 5px 12px;
    background: var(--bg-tertiary);
    border: 1px solid var(--border);
    border-radius: 20px;
    font-size: 12px;
    color: var(--text-secondary);
    cursor: pointer;
    transition: all 0.1s;
  }
  .tl-type-btn:hover { background: var(--bg-hover); }
  .tl-type-btn.active { font-weight: 600; }

  .tl-modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    padding-top: 4px;
  }

  .tl-cancel {
    background: transparent; border: 1px solid var(--border);
    border-radius: 4px; color: var(--text-secondary);
    padding: 7px 16px; cursor: pointer; font-size: 13px;
  }
  .tl-save {
    background: var(--accent); border: none; border-radius: 4px;
    color: #000; font-weight: 600; padding: 7px 16px;
    cursor: pointer; font-size: 13px;
  }
</style>
