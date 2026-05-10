<script lang="ts">
  import { onMount } from 'svelte';
  import { getOllamaModels } from '$lib/api';
  import {
    getAiModel, setAiModel,
    getAiSystemPrompt, setAiSystemPrompt
  } from '$lib/stores/settings.svelte';

  let { onClose = () => {} }: { onClose: () => void } = $props();

  let models: string[] = $state([]);
  let isLoadingModels = $state(true);
  let errorMsg = $state('');

  let currentModel = $state(getAiModel());
  let currentPrompt = $state(getAiSystemPrompt());

  onMount(async () => {
    try {
      models = await getOllamaModels();
      if (models.length === 0) {
        errorMsg = "Aucun modèle trouvé sur Ollama.";
      }
    } catch (e) {
      errorMsg = "Impossible de se connecter à Ollama (est-il bien lancé ?).";
      console.error(e);
    } finally {
      isLoadingModels = false;
    }
  });

  function saveAndClose() {
    setAiModel(currentModel);
    setAiSystemPrompt(currentPrompt);
    onClose();
  }
</script>

<div class="modal-backdrop" onclick={onClose} role="presentation" onkeydown={(e) => e.key === 'Escape' && onClose()}>
  <div class="modal-content" onclick={e => e.stopPropagation()} role="dialog" onkeydown={e => e.stopPropagation()}>
    <h2>⚙️ Paramètres du Grimoire</h2>

    <section class="settings-section">
      <h3>IA Locale (Ollama)</h3>
      
      <div class="form-group">
        <label for="ai-model">Modèle d'IA</label>
        {#if isLoadingModels}
          <div class="loading">Recherche des modèles...</div>
        {:else if errorMsg}
          <div class="error">{errorMsg}</div>
          <input type="text" id="ai-model" bind:value={currentModel} placeholder="ex: llama3.2" />
        {:else}
          <select id="ai-model" bind:value={currentModel}>
            {#each models as model}
              <option value={model}>{model}</option>
            {/each}
          </select>
        {/if}
        <small>Le modèle qui rédigera vos descriptions (doit être installé via Ollama).</small>
      </div>

      <div class="form-group">
        <label for="ai-prompt">Prompt Système (Comportement de l'IA)</label>
        <textarea 
          id="ai-prompt" 
          bind:value={currentPrompt} 
          rows="3"
          placeholder="ex: Tu es un Maître du Jeu de dark fantasy..."
        ></textarea>
        <small>Donnez la tonalité de l'IA. Elle l'utilisera comme contexte avant chaque génération.</small>
      </div>
    </section>

    <div class="modal-actions">
      <button class="btn-cancel" onclick={onClose}>Annuler</button>
      <button class="btn-save" onclick={saveAndClose}>Enregistrer</button>
    </div>
  </div>
</div>

<style>
  .modal-backdrop {
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
  }

  .modal-content {
    background: var(--bg-primary);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 24px;
    width: 90%;
    max-width: 500px;
    box-shadow: 0 16px 48px rgba(0, 0, 0, 0.5);
  }

  h2 {
    margin: 0 0 24px 0;
    color: var(--text-primary);
  }

  .settings-section {
    background: var(--bg-secondary);
    padding: 16px;
    border-radius: 6px;
    margin-bottom: 24px;
  }

  h3 {
    margin: 0 0 16px 0;
    font-size: 14px;
    color: var(--accent);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .form-group {
    margin-bottom: 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .form-group:last-child {
    margin-bottom: 0;
  }

  label {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-primary);
  }

  input, select, textarea {
    background: var(--bg-tertiary);
    border: 1px solid var(--border);
    color: var(--text-primary);
    padding: 10px;
    border-radius: 4px;
    font-family: inherit;
    font-size: 14px;
  }

  input:focus, select:focus, textarea:focus {
    outline: none;
    border-color: var(--accent);
  }

  small {
    color: var(--text-muted);
    font-size: 12px;
  }

  .loading {
    color: var(--text-muted);
    font-style: italic;
  }

  .error {
    color: #ef4444;
    font-size: 13px;
    margin-bottom: 4px;
  }

  .modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
  }

  button {
    padding: 8px 16px;
    border-radius: 4px;
    cursor: pointer;
    font-weight: 600;
    transition: all 0.2s;
  }

  .btn-cancel {
    background: transparent;
    border: 1px solid var(--border);
    color: var(--text-secondary);
  }
  .btn-cancel:hover { background: var(--bg-hover); }

  .btn-save {
    background: var(--accent);
    border: none;
    color: white;
  }
  .btn-save:hover { background: var(--accent-secondary); }
</style>
