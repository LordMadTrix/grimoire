<script lang="ts">
  import { sceneRunnerStore, type PreparedScene } from '$lib/stores/sceneRunner.svelte';
  import { notifStore } from '$lib/stores/notifications.svelte';

  let showModal = $state<boolean>(false);
  let editingScene = $state<Partial<PreparedScene>>({
    name: '',
    weather: 'none',
    lighting: 'day',
    notes: ''
  });
  let isEditing = $state<boolean>(false);

  function openCreate() {
    editingScene = {
      name: `Scène ${sceneRunnerStore.scenes.length + 1}`,
      weather: 'none',
      lighting: 'day',
      audioAtmosphere: 'taverne',
      notes: ''
    };
    isEditing = false;
    showModal = true;
  }

  function openEdit(s: PreparedScene) {
    editingScene = { ...s };
    isEditing = true;
    showModal = true;
  }

  function saveScene() {
    if (!editingScene.name?.trim()) return;
    if (isEditing && editingScene.id) {
      sceneRunnerStore.updateScene(editingScene.id, editingScene);
      notifStore.add('✏️', editingScene.name, 'Scène mise à jour', 'info', 2000);
    } else {
      sceneRunnerStore.addScene(editingScene as any);
      notifStore.add('🎬', editingScene.name, 'Nouvelle scène enregistrée', 'success', 2500);
    }
    showModal = false;
  }
</script>

{#if sceneRunnerStore.isOpen}
  <div class="scene-runner-dock">
    <div class="sr-brand">
      <span class="sr-icon">🎬</span>
      <span class="sr-title">Scénario</span>
    </div>

    <!-- Liste horizontale des scènes -->
    <div class="sr-chips-scroll">
      {#each sceneRunnerStore.scenes as s (s.id)}
        {@const isActive = s.id === sceneRunnerStore.activeSceneId}
        <div class="sr-chip-wrapper" class:active={isActive}>
          <button
            type="button"
            class="sr-scene-btn"
            class:active={isActive}
            onclick={() => sceneRunnerStore.activateScene(s)}
            title="Activer cette scène (Météo: {s.weather}, Lumière: {s.lighting})"
          >
            <span class="sr-scene-name">{s.name}</span>
            <span class="sr-meta-tag">
              {#if s.lighting === 'day'}☀️{:else if s.lighting === 'dusk'}🌅{:else if s.lighting === 'night'}🌙{:else}🌑{/if}
              {#if s.weather === 'rain'}🌧️{:else if s.weather === 'storm'}⚡{:else if s.weather === 'snow'}❄️{:else if s.weather === 'fog'}🌫️{:else}✨{/if}
            </span>
          </button>
          <button
            type="button"
            class="sr-btn-dots"
            onclick={() => openEdit(s)}
            title="Modifier cette scène"
          >
            ✏️
          </button>
        </div>
      {/each}
    </div>

    <!-- Actions du bandeau -->
    <div class="sr-actions">
      <button
        type="button"
        class="sr-btn-nav"
        onclick={() => sceneRunnerStore.prevScene()}
        title="Scène précédente"
      >
        ◀
      </button>
      <button
        type="button"
        class="sr-btn-nav"
        onclick={() => sceneRunnerStore.nextScene()}
        title="Scène suivante"
      >
        ▶
      </button>
      <button
        type="button"
        class="sr-btn-add"
        onclick={openCreate}
        title="Créer une nouvelle scène"
      >
        + Nouvelle
      </button>
      <button
        type="button"
        class="sr-btn-close"
        onclick={() => sceneRunnerStore.close()}
        title="Fermer le dérouleur"
      >
        ✕
      </button>
    </div>
  </div>
{/if}

<!-- Modal d'édition de scène -->
{#if showModal}
  <div class="sr-modal-backdrop" onclick={() => showModal = false} role="presentation">
    <div class="sr-modal" onclick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
      <div class="sr-modal-header">
        <h3>{isEditing ? 'Modifier la Scène' : 'Nouvelle Scène de Séance'}</h3>
        <button type="button" class="sr-modal-x" onclick={() => showModal = false}>✕</button>
      </div>

      <div class="sr-modal-body">
        <label class="sr-field">
          <span>Nom de la scène</span>
          <input type="text" bind:value={editingScene.name} placeholder="ex: 1. Auberge de la Truite" />
        </label>

        <div class="sr-fields-row">
          <label class="sr-field">
            <span>Éclairage</span>
            <select bind:value={editingScene.lighting}>
              <option value="day">☀️ Plein Jour</option>
              <option value="dusk">🌅 Crépuscule</option>
              <option value="night">🌙 Nuit Sombre</option>
              <option value="pitch_black">🌑 Ténèbres Donjon</option>
            </select>
          </label>

          <label class="sr-field">
            <span>Météo</span>
            <select bind:value={editingScene.weather}>
              <option value="none">☀️ Dégagé</option>
              <option value="rain">🌧️ Pluie</option>
              <option value="storm">⚡ Orage Violent</option>
              <option value="snow">❄️ Chute de Neige</option>
              <option value="fog">🌫️ Brouillard Épais</option>
              <option value="embers">🔥 Braises & Cendres</option>
            </select>
          </label>
        </div>

        <label class="sr-field">
          <span>Ambiance Sonore Clé</span>
          <select bind:value={editingScene.audioAtmosphere}>
            <option value="taverne">🍻 Taverne & Auberge</option>
            <option value="foret">🌲 Forêt & Nature</option>
            <option value="tempete">⚡ Nuit de Tempête</option>
            <option value="donjon">🦇 Donjon & Crypte</option>
            <option value="pluie">🌧️ Pluie Apaisante</option>
          </select>
        </label>

        <label class="sr-field">
          <span>Notes MJ & Accroche de Scène</span>
          <textarea
            bind:value={editingScene.notes}
            rows="3"
            placeholder="Ce que les héros voient et entendent en arrivant..."
          ></textarea>
        </label>
      </div>

      <div class="sr-modal-footer">
        {#if isEditing && editingScene.id}
          <button
            type="button"
            class="sr-btn-delete"
            onclick={() => {
              if (editingScene.id) sceneRunnerStore.deleteScene(editingScene.id);
              showModal = false;
            }}
          >
            🗑️ Supprimer
          </button>
        {/if}
        <button type="button" class="sr-btn-cancel" onclick={() => showModal = false}>Annuler</button>
        <button type="button" class="sr-btn-save" onclick={saveScene}>Enregistrer</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .scene-runner-dock {
    position: absolute;
    top: 52px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 45;
    display: flex;
    align-items: center;
    gap: 8px;
    background: rgba(15, 23, 42, 0.92);
    backdrop-filter: blur(12px);
    border: 1px solid rgba(229, 168, 83, 0.35);
    border-radius: 9999px;
    padding: 4px 12px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.65), inset 0 1px 0 rgba(255, 255, 255, 0.1);
    max-width: 90vw;
  }

  .sr-brand {
    display: flex;
    align-items: center;
    gap: 5px;
    padding-right: 8px;
    border-right: 1px solid rgba(255, 255, 255, 0.1);
    font-size: 11px;
    font-weight: 800;
    color: #e5a853;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    white-space: nowrap;
  }

  .sr-chips-scroll {
    display: flex;
    align-items: center;
    gap: 6px;
    overflow-x: auto;
    max-width: 55vw;
    scrollbar-width: none;
    padding: 2px 0;
  }
  .sr-chips-scroll::-webkit-scrollbar {
    display: none;
  }

  .sr-chip-wrapper {
    display: flex;
    align-items: center;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 20px;
    padding: 2px 4px 2px 8px;
    transition: all 0.2s ease;
    white-space: nowrap;
  }
  .sr-chip-wrapper.active {
    background: rgba(229, 168, 83, 0.22);
    border-color: #e5a853;
    box-shadow: 0 0 12px rgba(229, 168, 83, 0.25);
  }

  .sr-scene-btn {
    background: none;
    border: none;
    color: #cbd5e1;
    font-size: 11.5px;
    font-weight: 600;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 2px 4px;
  }
  .sr-scene-btn.active {
    color: #fbbf24;
    font-weight: 800;
  }

  .sr-meta-tag {
    font-size: 10px;
    opacity: 0.85;
  }

  .sr-btn-dots {
    background: none;
    border: none;
    font-size: 10px;
    cursor: pointer;
    opacity: 0.5;
    padding: 2px;
    border-radius: 4px;
    transition: opacity 0.15s;
  }
  .sr-btn-dots:hover {
    opacity: 1;
    background: rgba(255, 255, 255, 0.1);
  }

  .sr-actions {
    display: flex;
    align-items: center;
    gap: 4px;
    padding-left: 8px;
    border-left: 1px solid rgba(255, 255, 255, 0.1);
  }

  .sr-btn-nav, .sr-btn-close {
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #e2e8f0;
    border-radius: 9999px;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    font-size: 11px;
    transition: all 0.15s;
  }
  .sr-btn-nav:hover, .sr-btn-close:hover {
    background: rgba(255, 255, 255, 0.15);
    color: #fff;
  }

  .sr-btn-add {
    background: rgba(229, 168, 83, 0.15);
    border: 1px solid rgba(229, 168, 83, 0.4);
    color: #e5a853;
    border-radius: 9999px;
    padding: 3px 10px;
    font-size: 11px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.15s;
  }
  .sr-btn-add:hover {
    background: #e5a853;
    color: #000;
  }

  /* Modal */
  .sr-modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(4px);
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .sr-modal {
    background: #0f172a;
    border: 1px solid rgba(229, 168, 83, 0.4);
    border-radius: 16px;
    width: 90%;
    max-width: 440px;
    padding: 20px;
    color: #e2e8f0;
    box-shadow: 0 16px 40px rgba(0, 0, 0, 0.7);
  }
  .sr-modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
  }
  .sr-modal-header h3 {
    margin: 0;
    font-size: 16px;
    color: #fbbf24;
    font-weight: 800;
  }
  .sr-modal-x {
    background: none;
    border: none;
    color: #94a3b8;
    font-size: 18px;
    cursor: pointer;
  }
  .sr-modal-body {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .sr-field {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 12px;
    color: #94a3b8;
  }
  .sr-fields-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }
  .sr-field input, .sr-field select, .sr-field textarea {
    background: #1e293b;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 8px;
    padding: 8px 10px;
    color: #fff;
    font-size: 13px;
    outline: none;
  }
  .sr-field input:focus, .sr-field select:focus, .sr-field textarea:focus {
    border-color: #e5a853;
  }
  .sr-modal-footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 18px;
  }
  .sr-btn-cancel, .sr-btn-delete, .sr-btn-save {
    padding: 8px 14px;
    border-radius: 8px;
    font-size: 12.5px;
    font-weight: 700;
    cursor: pointer;
    border: none;
  }
  .sr-btn-cancel {
    background: rgba(255, 255, 255, 0.08);
    color: #cbd5e1;
  }
  .sr-btn-delete {
    background: rgba(239, 68, 68, 0.15);
    color: #f87171;
    margin-right: auto;
  }
  .sr-btn-save {
    background: #e5a853;
    color: #000;
  }
</style>
