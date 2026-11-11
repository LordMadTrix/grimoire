<script lang="ts">
  import { onMount } from 'svelte';
  import { getOllamaModels, checkEdgeTtsStatus, installEdgeTtsAuto, type EdgeTtsStatus } from '$lib/api';
  import { notifStore } from '$lib/stores/notifications.svelte';
  import { ttsReader } from '$lib/stores/ttsReader.svelte';
  import {
    getAiModel, setAiModel,
    getAiToneId, setAiToneId,
    getAiSystemPrompt, setAiSystemPrompt,
    AI_TONE_PRESETS
  } from '$lib/stores/settings.svelte';
  import {
    getSpellcheckEnabled, setSpellcheckEnabled,
    getSpellcheckLang, setSpellcheckLang,
    getCustomWords, addCustomWord, removeCustomWord
  } from '$lib/spellcheck/spellcheckStore.svelte';
  import type { SpellcheckLang } from '$lib/spellcheck/spellcheckStore.svelte';
  import OpticalTrackingSettingsView from './vtt/OpticalTrackingSettingsView.svelte';

  let { onClose = () => {}, onTriggerOnboarding = () => {} }: { onClose: () => void, onTriggerOnboarding: () => void } = $props();

  let models: string[] = $state([]);
  let isLoadingModels = $state(true);
  let errorMsg = $state('');

  let currentModel = $state(getAiModel());
  let currentToneId = $state(getAiToneId());
  let currentPrompt = $state(getAiSystemPrompt());

  let currentSpellEnabled = $state(getSpellcheckEnabled());
  let currentSpellLang = $state<SpellcheckLang>(getSpellcheckLang());
  let customWordsList = $state<string[]>(getCustomWords());
  let newCustomWord = $state('');

  // ── Statut & Installation Voix IA (Edge-TTS) ──
  let ttsStatus = $state<EdgeTtsStatus | null>(null);
  let isInstallingTts = $state<boolean>(false);

  async function refreshTts() {
    try {
      ttsStatus = await checkEdgeTtsStatus();
    } catch (e) {
      console.warn('tts status check failed:', e);
    }
  }

  async function handleInstallTts() {
    isInstallingTts = true;
    try {
      const msg = await installEdgeTtsAuto();
      notifStore.add('🎉', 'Voix IA Prêtes', msg, 'success', 4500);
      await refreshTts();
      ttsReader.buildVoiceList();
    } catch (err: any) {
      notifStore.add('❌', 'Erreur Installation', err?.message || String(err), 'danger', 6000);
    } finally {
      isInstallingTts = false;
    }
  }

  function handleAddWord() {
    const trimmed = newCustomWord.trim();
    if (trimmed) {
      addCustomWord(trimmed);
      customWordsList = getCustomWords();
      newCustomWord = '';
    }
  }

  function handleRemoveWord(w: string) {
    removeCustomWord(w);
    customWordsList = getCustomWords();
  }

  onMount(async () => {
    refreshTts();
    try {
      models = await getOllamaModels();
      if (models.length === 0) {
        errorMsg = "Aucun modèle trouvé sur Ollama.";
      } else {
        const match = models.find(m => m === currentModel || m.startsWith(currentModel) || currentModel.startsWith(m));
        if (match) {
          currentModel = match;
          setAiModel(match);
        } else {
          currentModel = models[0];
          setAiModel(models[0]);
        }
      }
    } catch (e) {
      errorMsg = "Impossible de se connecter à Ollama (est-il bien lancé ?).";
      console.error(e);
    } finally {
      isLoadingModels = false;
    }
  });

  function handleToneChange() {
    const preset = AI_TONE_PRESETS.find(t => t.id === currentToneId);
    if (preset) {
      currentPrompt = preset.systemPrompt;
    }
  }

  function saveAndClose() {
    setAiModel(currentModel);
    setAiToneId(currentToneId);
    setAiSystemPrompt(currentPrompt);
    setSpellcheckEnabled(currentSpellEnabled);
    setSpellcheckLang(currentSpellLang);
    onClose();
  }
</script>

<div class="modal-backdrop" onclick={onClose} role="presentation" onkeydown={(e) => e.key === 'Escape' && onClose()}>
  <div class="modal-content" onclick={e => e.stopPropagation()} role="dialog" aria-modal="true" tabindex="-1" onkeydown={e => e.stopPropagation()}>
    <h2>⚙️ Paramètres du Grimoire</h2>

    <section class="settings-section">
      <h3>IA Locale (Ollama)</h3>
      
      <div class="form-group">
        <label for="ai-model">Modèle d'IA</label>
        {#if isLoadingModels}
          <div class="loading">Recherche des modèles...</div>
        {:else if errorMsg}
          <div class="error">{errorMsg}</div>
          <div style="display: flex; gap: 8px; align-items: center;">
            <input type="text" id="ai-model" bind:value={currentModel} placeholder="ex: llama3.2" style="flex: 1; margin: 0;" />
            <button type="button" onclick={onTriggerOnboarding} style="padding: 10px; font-size: 12px; white-space: nowrap; background: rgba(229, 168, 83, 0.1); border: 1px solid var(--accent); color: var(--accent); margin: 0;">
              🔧 Installer l'IA
            </button>
          </div>
        {:else}
          <div style="display: flex; gap: 8px; align-items: center;">
            <select id="ai-model" bind:value={currentModel} style="flex: 1; margin: 0;">
              {#each models as model}
                <option value={model}>{model}</option>
              {/each}
            </select>
            <button type="button" onclick={onTriggerOnboarding} style="padding: 10px; font-size: 12px; white-space: nowrap; background: rgba(229, 168, 83, 0.1); border: 1px solid var(--accent); color: var(--accent); margin: 0;">
              🔧 Assistant IA
            </button>
          </div>
        {/if}
        <small>Le modèle qui rédigera vos descriptions (doit être installé via Ollama).</small>
      </div>

      <div class="form-group">
        <label for="ai-tone">Ambiance & Genre narratif de l'IA</label>
        <select id="ai-tone" bind:value={currentToneId} onchange={handleToneChange}>
          {#each AI_TONE_PRESETS as tone}
            <option value={tone.id}>{tone.icon} {tone.name} — {tone.desc}</option>
          {/each}
        </select>
        <small>Adapte le vocabulaire et l'ambiance des générations (évite de parler uniquement des ombres !).</small>
      </div>

      <div class="form-group">
        <label for="ai-prompt">Prompt Système Personnalisé</label>
        <textarea 
          id="ai-prompt" 
          bind:value={currentPrompt} 
          rows="3"
          placeholder="ex: Tu es un Maître du Jeu..."
        ></textarea>
        <small>Donnez la tonalité de l'IA. Elle l'utilisera comme contexte avant chaque génération.</small>
      </div>
    </section>

    <!-- Section Voix Neuronales & Narration IA -->
    <section class="settings-section">
      <div class="tts-section-header">
        <div>
          <h3>🎙️ Voix Neuronales & Narration IA (Edge-TTS)</h3>
          <small>13 voix françaises haute fidélité (Azure Neural) pour la lecture de scènes et le multi-casting.</small>
        </div>
        {#if ttsStatus?.ready}
          <span class="tts-status-pill success">🟢 Opérationnel</span>
        {:else if ttsStatus && !ttsStatus.ready}
          <span class="tts-status-pill warning">⚡ Non installé</span>
        {/if}
      </div>

      <div class="tts-status-box" class:installed={ttsStatus?.ready}>
        <div class="tts-status-content">
          {#if ttsStatus?.ready}
            <div class="tts-status-text">
              <strong>Module vocal activé</strong> : {ttsStatus.edge_tts_version || 'edge-tts'} ({ttsStatus.python_path || 'Python'})
              <div class="tts-voices-hint">Toutes les voix (Vivienne, Remy, Henri, Eloise...) sont prêtes dans le Studio de Narration.</div>
            </div>
            <button
              type="button"
              class="btn-tts-action secondary"
              onclick={handleInstallTts}
              disabled={isInstallingTts}
              title="Réinstaller ou mettre à jour edge-tts"
            >
              {#if isInstallingTts}⏳ Mise à jour...{:else}🔄 Mettre à jour{/if}
            </button>
          {:else}
            <div class="tts-status-text">
              <strong>Voix neuronales non détectées</strong> sur ce système.
              <div class="tts-voices-hint">Cliquez sur le bouton ci-contre pour installer automatiquement le moteur vocal en 1 clic.</div>
            </div>
            <button
              type="button"
              class="btn-tts-action primary"
              onclick={handleInstallTts}
              disabled={isInstallingTts}
            >
              {#if isInstallingTts}
                ⏳ Installation en cours...
              {:else}
                ⚡ Installer Automatiquement (Gratuit)
              {/if}
            </button>
          {/if}
        </div>
      </div>
    </section>

    <section class="settings-section">
      <h3>🔤 Correcteur d'orthographe</h3>

      <div class="form-group checkbox-group">
        <label class="checkbox-label" for="spell-enable-check">
          <input type="checkbox" id="spell-enable-check" bind:checked={currentSpellEnabled} />
          <span>Activer le correcteur dans l'éditeur</span>
        </label>
        <small>Détecte les fautes et propose des suggestions sans ralentir la frappe.</small>
      </div>

      {#if currentSpellEnabled}
        <div class="form-group">
          <label for="spell-lang">Langue du dictionnaire</label>
          <select id="spell-lang" bind:value={currentSpellLang}>
            <option value="fr">🇫🇷 Français (Grammalecte)</option>
            <option value="en">🇬🇧 English</option>
          </select>
          <small>Dictionnaire utilisé pour vérifier les mots et suggérer des corrections.</small>
        </div>

        <div class="form-group">
          <label for="new-custom-word">Dictionnaire personnalisé & Termes JdR ({customWordsList.length} mot{customWordsList.length !== 1 ? 's' : ''})</label>
          <div class="custom-word-row">
            <input
              type="text"
              id="new-custom-word"
              bind:value={newCustomWord}
              placeholder="ex: Gobelin, Tarrasque, Phandaline..."
              onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddWord(); } }}
            />
            <button type="button" class="btn-add-word" onclick={handleAddWord} disabled={!newCustomWord.trim()}>
              ➕ Ajouter
            </button>
          </div>
          <small>Ces termes ne seront plus signalés comme des erreurs dans vos notes.</small>

          {#if customWordsList.length > 0}
            <div class="custom-words-list">
              {#each customWordsList as w}
                <span class="word-chip">
                  <span>{w}</span>
                  <button type="button" class="chip-delete" onclick={() => handleRemoveWord(w)} title="Supprimer du dictionnaire">×</button>
                </span>
              {/each}
            </div>
          {/if}
        </div>
      {/if}
    </section>

    <!-- Tracking Optique & Figurines 3D -->
    <OpticalTrackingSettingsView />

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
    max-width: 640px;
    max-height: 88vh;
    overflow-y: auto;
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

  .checkbox-group {
    margin-bottom: 14px;
  }

  /* ── Voix Neuronales & Edge-TTS ── */
  .tts-section-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
    margin-bottom: 12px;
  }
  .tts-status-pill {
    padding: 3px 8px;
    border-radius: 9999px;
    font-size: 11px;
    font-weight: 700;
    white-space: nowrap;
  }
  .tts-status-pill.success {
    background: rgba(34, 197, 94, 0.15);
    border: 1px solid rgba(34, 197, 94, 0.35);
    color: #4ade80;
  }
  .tts-status-pill.warning {
    background: rgba(234, 179, 8, 0.15);
    border: 1px solid rgba(234, 179, 8, 0.35);
    color: #facc15;
  }
  .tts-status-box {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    padding: 12px 14px;
  }
  .tts-status-box.installed {
    border-color: rgba(34, 197, 94, 0.2);
    background: rgba(34, 197, 94, 0.03);
  }
  .tts-status-content {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 14px;
  }
  .tts-status-text {
    font-size: 13px;
    color: var(--text-primary);
    line-height: 1.4;
  }
  .tts-voices-hint {
    font-size: 11px;
    color: var(--text-muted);
    margin-top: 2px;
  }
  .btn-tts-action {
    padding: 8px 14px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
    white-space: nowrap;
    transition: all 0.15s ease;
    flex-shrink: 0;
  }
  .btn-tts-action.primary {
    background: linear-gradient(135deg, #e5a853 0%, #d97706 100%);
    color: #000;
    border: none;
    box-shadow: 0 2px 8px rgba(229, 168, 83, 0.3);
  }
  .btn-tts-action.primary:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(229, 168, 83, 0.45);
  }
  .btn-tts-action.secondary {
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.15);
    color: var(--text-primary);
  }
  .btn-tts-action.secondary:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.14);
  }
  .btn-tts-action:disabled {
    opacity: 0.6;
    cursor: wait;
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 10px;
    cursor: pointer;
    font-size: 14px;
    color: var(--text-primary);
  }

  .checkbox-label input[type="checkbox"] {
    cursor: pointer;
    accent-color: var(--accent);
    width: 18px;
    height: 18px;
    margin: 0;
  }

  .custom-word-row {
    display: flex;
    gap: 8px;
    align-items: center;
    margin-top: 4px;
  }

  .custom-word-row input {
    flex: 1;
    margin: 0;
  }

  .btn-add-word {
    background: rgba(229, 168, 83, 0.12);
    border: 1px solid var(--accent);
    color: var(--accent);
    padding: 10px 14px;
    font-size: 13px;
    white-space: nowrap;
    border-radius: 4px;
  }
  .btn-add-word:disabled {
    opacity: 0.4;
    cursor: not-allowed;
    border-color: var(--border);
    color: var(--text-muted);
  }
  .btn-add-word:not(:disabled):hover {
    background: rgba(229, 168, 83, 0.25);
  }

  .custom-words-list {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    max-height: 120px;
    overflow-y: auto;
    padding: 8px;
    background: var(--bg-tertiary);
    border: 1px solid var(--border);
    border-radius: 6px;
    margin-top: 8px;
  }

  .word-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: var(--bg-secondary);
    border: 1px solid rgba(229, 168, 83, 0.3);
    color: var(--text-primary);
    padding: 3px 8px;
    border-radius: 12px;
    font-size: 12px;
  }

  .chip-delete {
    background: transparent;
    border: none;
    color: var(--text-muted);
    font-size: 14px;
    padding: 0 2px;
    line-height: 1;
    cursor: pointer;
  }
  .chip-delete:hover {
    color: #ef4444;
  }
</style>
