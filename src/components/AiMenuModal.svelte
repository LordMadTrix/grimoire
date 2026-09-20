<script lang="ts">
  import { onMount } from 'svelte';
  import { askOllama } from '$lib/api';
  import {
    getAiModel,
    getAiToneId,
    setAiToneId,
    getAiSystemPrompt,
    AI_TONE_PRESETS
  } from '$lib/stores/settings.svelte';

  let {
    targetText = '',
    fullDocText = '',
    onApply = (text: string, mode: 'replace' | 'insert_below') => {},
    onClose = () => {}
  }: {
    targetText: string;
    fullDocText?: string;
    onApply: (text: string, mode: 'replace' | 'insert_below') => void;
    onClose: () => void;
  } = $props();

  let activeToneId = $state(getAiToneId());
  let currentModel = $state(getAiModel());
  let customPrompt = $state('');
  let isGenerating = $state(false);
  let errorMsg = $state('');
  let generatedResult = $state('');
  let lastAction = $state<string>('');
  let copied = $state(false);

  const selectedPreset = $derived(
    AI_TONE_PRESETS.find(t => t.id === activeToneId) || AI_TONE_PRESETS[0]
  );

  function handleSelectTone(id: string) {
    activeToneId = id;
    setAiToneId(id);
  }

  async function executeAction(actionType: string) {
    isGenerating = true;
    errorMsg = '';
    generatedResult = '';
    lastAction = actionType;

    const subject = targetText.trim() || fullDocText.trim() || 'Notes de jeu de rôle';
    let prompt = '';
    let systemPrompt = getAiSystemPrompt();

    switch (actionType) {
      case 'correct':
        // Pour la correction d'orthographe, on utilise un prompt strict qui interdit d'inventer des histoires de dark fantasy !
        systemPrompt = "Tu es un correcteur professionnel de langue française pour jeu de rôle. Corrige minutieusement l'orthographe, la grammaire, la conjugaison et la ponctuation du texte fourni. RÈGLES STRICTES : Ne modifie pas le sens, n'invente AUCUNE histoire ni élément narratif, et renvoie UNIQUEMENT le texte corrigé brut, sans guillemets, sans formule de politesse ni commentaire.";
        prompt = `Corrige attentivement ce texte en conservant sa structure originale :\n\n${subject}`;
        break;

      case 'continue':
        prompt = `Poursuis naturellement et avec fluidité le récit ou la description suivante en respectant le style et le contexte établi. Rédige 1 à 2 paragraphes bien rythmés sans répétitions :\n\n${subject}`;
        break;

      case 'describe':
        prompt = `Rédige une description vivante, évocatrice et sensorielle (visuel marquant, sons, odeurs, luminosité, atmosphère générale) pour immerger les joueurs dans ce lieu ou cette scène :\n\n${subject}`;
        break;

      case 'npc':
        prompt = `À partir de "${subject}", génère une fiche synthétique de PNJ rôliste structurée ainsi :\n- **Nom & Rôle**\n- **Apparence distinctive**\n- **Personnalité & Manies**\n- **Secret ou Motivation cachée**\n- **2 Répliques de dialogue typiques**`;
        break;

      case 'plot':
        prompt = `Génère 3 péripéties imprévues, complications ou rebondissements dramatiques immédiats liés à la situation suivante, avec des choix captivants pour les joueurs :\n\n${subject}`;
        break;

      case 'loot':
        prompt = `Génère une table de 4 objets de butin, reliques, ingrédients rares ou indices mystérieux en rapport direct avec ceci, avec un détail insolite ou magique pour chacun :\n\n${subject}`;
        break;

      case 'tavern':
        prompt = `Génère une taverne médiévale-fantastique complète et vivante en rapport avec "${subject}" :\n- **Nom & Enseigne évocatrice**\n- **Ambiance sonore, odeurs & Clientèle type**\n- **Le Tavernier / La Tenancière (Nom, apparence marquante, caractère)**\n- **Menu du jour (Plat roboratif & Boisson locale typique)**\n- **3 Rumeurs ou accroches d'aventure entendues au comptoir**`;
        break;

      case 'encounter':
        prompt = `Conçois une rencontre impromptue et palpitante adaptée à cette situation ou cet environnement ("${subject}") :\n- **Menace ou Créatures en présence (Nom, effectif, comportement)**\n- **Accroche dramatique (ce qui se passe immédiatement à l'arrivée des PJ)**\n- **Terrain & Éléments tactiques exploitables (hauteurs, obstacles, dangers)**\n- **Issue alternative (négociation, fuite ou retournement de situation)**`;
        break;

      case 'trap':
        prompt = `Conçois une énigme ou un piège mécanique/magique ingénieux lié à "${subject}" :\n- **Nom & Nature du défi**\n- **Description sensorielle pour les joueurs (indices visuels, sonores ou tactiles)**\n- **Déclencheur & Conséquence si déclenché**\n- **Indice dissimulé dans la pièce**\n- **Solution ou méthode de désamorçage créative**`;
        break;

      case 'summary':
        prompt = `Résume de manière structurée, claire et concise sous forme de points clés les informations majeures de ce document pour le Maître du Jeu :\n\n${subject}`;
        break;

      case 'custom':
        if (!customPrompt.trim()) {
          isGenerating = false;
          return;
        }
        prompt = `${customPrompt.trim()} :\n\n${subject}`;
        break;
    }

    try {
      const res = await askOllama(prompt, currentModel, systemPrompt);
      generatedResult = res.trim();
    } catch (err: any) {
      errorMsg = typeof err === 'string' ? err : (err?.message || `Erreur IA : ${err}`);
    } finally {
      isGenerating = false;
    }
  }

  function applyResult(mode: 'replace' | 'insert_below') {
    if (!generatedResult) return;
    onApply(generatedResult, mode);
    onClose();
  }

  async function copyResult() {
    if (!generatedResult) return;
    try {
      await navigator.clipboard.writeText(generatedResult);
      copied = true;
      setTimeout(() => copied = false, 2500);
    } catch {}
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'Enter' && !isGenerating) {
      if (generatedResult) {
        // Appliquer par défaut en remplacement si correction, sinon insérer
        applyResult(lastAction === 'correct' ? 'replace' : 'insert_below');
      } else if (customPrompt.trim()) {
        executeAction('custom');
      }
    }
  }
</script>

<svelte:window onkeydown={handleKeyDown} />

<!-- svelte-ignore a11y_click_events_have_key_events -->
<div class="ai-modal-backdrop" onclick={onClose} role="presentation">
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div class="ai-modal-card glass-panel" onclick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" tabindex="-1">
    <!-- Header -->
    <div class="ai-modal-header">
      <div class="header-left">
        <span class="ai-sparkle">🪄</span>
        <div>
          <h3>Assistant IA du Grimoire</h3>
          <span class="model-tag" title="Modèle local actuellement actif">⚡ {currentModel}</span>
        </div>
      </div>
      <button type="button" class="btn-close" onclick={onClose} title="Fermer (Échap)">✕</button>
    </div>

    <!-- Tone Selector Bar -->
    <div class="tone-bar">
      <span class="tone-label">Ambiance :</span>
      <div class="tone-pills">
        {#each AI_TONE_PRESETS as tone}
          <button
            type="button"
            class="tone-pill"
            class:active={activeToneId === tone.id}
            onclick={() => handleSelectTone(tone.id)}
            title={tone.desc}
          >
            <span class="tone-icon">{tone.icon}</span>
            <span class="tone-name">{tone.name}</span>
          </button>
        {/each}
      </div>
    </div>

    <!-- Target snippet preview -->
    <div class="snippet-box">
      <span class="snippet-tag">Texte ciblé :</span>
      <p class="snippet-text">
        {targetText.trim() ? `« ${targetText.trim().slice(0, 180)}${targetText.trim().length > 180 ? '...' : ''} »` : 'L\'ensemble de la note courante'}
      </p>
    </div>

    <!-- Actions & Output Area -->
    {#if !generatedResult && !isGenerating}
      <div class="actions-grid">
        <button type="button" class="action-card highlight" onclick={() => executeAction('correct')}>
          <div class="action-icon">🔤</div>
          <div class="action-details">
            <strong>Corriger l'orthographe & style</strong>
            <span>Corrige fautes et accords proprement sans inventer d'histoire</span>
          </div>
        </button>

        <button type="button" class="action-card" onclick={() => executeAction('continue')}>
          <div class="action-icon">✍️</div>
          <div class="action-details">
            <strong>Continuer l'écriture</strong>
            <span>Prolonge naturellement le texte ou le paragraphe</span>
          </div>
        </button>

        <button type="button" class="action-card" onclick={() => executeAction('describe')}>
          <div class="action-icon">🏰</div>
          <div class="action-details">
            <strong>Décrire un lieu / Décor</strong>
            <span>Ambiance sensorielle, détails visuels et atmosphère</span>
          </div>
        </button>

        <button type="button" class="action-card" onclick={() => executeAction('npc')}>
          <div class="action-icon">👤</div>
          <div class="action-details">
            <strong>Créer / Développer un PNJ</strong>
            <span>Profil, apparence, secret inavouable et répliques</span>
          </div>
        </button>

        <button type="button" class="action-card" onclick={() => executeAction('plot')}>
          <div class="action-icon">⚔️</div>
          <div class="action-details">
            <strong>Péripétie & Rebondissement</strong>
            <span>3 événements inattendus pour relancer l'action</span>
          </div>
        </button>

        <button type="button" class="action-card" onclick={() => executeAction('loot')}>
          <div class="action-icon">🎲</div>
          <div class="action-details">
            <strong>Table de Butin & Trésor</strong>
            <span>Objets insolites, trésors ou indices mystérieux</span>
          </div>
        </button>

        <button type="button" class="action-card" onclick={() => executeAction('tavern')}>
          <div class="action-icon">🍺</div>
          <div class="action-details">
            <strong>Taverne Express</strong>
            <span>Enseigne, ambiance, patron, menu & rumeurs</span>
          </div>
        </button>

        <button type="button" class="action-card" onclick={() => executeAction('encounter')}>
          <div class="action-icon">⚔️</div>
          <div class="action-details">
            <strong>Rencontre Imprévue</strong>
            <span>Créatures, accroche dramatique et tactique</span>
          </div>
        </button>

        <button type="button" class="action-card" onclick={() => executeAction('trap')}>
          <div class="action-icon">🧩</div>
          <div class="action-details">
            <strong>Piège & Énigme</strong>
            <span>Mécanisme, indices subtils et désamorçage</span>
          </div>
        </button>

        <button type="button" class="action-card" onclick={() => executeAction('summary')}>
          <div class="action-icon">📜</div>
          <div class="action-details">
            <strong>Résumer la note</strong>
            <span>Synthèse concise et structurée en points clés</span>
          </div>
        </button>
      </div>

      <!-- Custom Prompt Box -->
      <div class="custom-prompt-row">
        <input
          type="text"
          class="custom-input"
          placeholder="Ou tapez une consigne sur mesure (ex: 'Traduis en vers', 'Donne 5 noms de taverne')..."
          bind:value={customPrompt}
          onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); executeAction('custom'); } }}
        />
        <button
          type="button"
          class="btn-send"
          disabled={!customPrompt.trim()}
          onclick={() => executeAction('custom')}
        >
          Générer ↵
        </button>
      </div>

    {:else if isGenerating}
      <div class="loading-box">
        <div class="ai-spinner"></div>
        <h4>Réflexion de l'IA ({currentModel})...</h4>
        <p class="loading-sub">
          {selectedPreset.name} : {selectedPreset.desc}
        </p>
      </div>

    {:else if generatedResult}
      <!-- Result view with preview and apply buttons -->
      <div class="result-container">
        <div class="result-header">
          <span class="result-badge">
            {lastAction === 'correct' ? '✓ Texte corrigé' : '✨ Contenu généré'}
          </span>
          <button type="button" class="btn-copy-small" onclick={copyResult}>
            {copied ? '✓ Copié !' : '📋 Copier'}
          </button>
        </div>

        <div class="result-preview">
          <pre>{generatedResult}</pre>
        </div>

        <div class="result-actions">
          <button type="button" class="btn-secondary" onclick={() => { generatedResult = ''; }}>
            ↩ Autre action
          </button>
          
          {#if lastAction === 'correct'}
            <button type="button" class="btn-secondary" onclick={() => applyResult('insert_below')}>
              Insérer en dessous
            </button>
            <button type="button" class="btn-primary highlight-gold" onclick={() => applyResult('replace')}>
              ✓ Remplacer dans la note (Entrée)
            </button>
          {:else}
            <button type="button" class="btn-secondary" onclick={() => applyResult('replace')}>
              Remplacer la sélection
            </button>
            <button type="button" class="btn-primary highlight-gold" onclick={() => applyResult('insert_below')}>
              ✓ Insérer à la suite (Entrée)
            </button>
          {/if}
        </div>
      </div>
    {/if}

    {#if errorMsg}
      <div class="error-banner">
        <span>⚠️ {errorMsg}</span>
      </div>
    {/if}
  </div>
</div>

<style>
  .ai-modal-backdrop {
    position: fixed;
    inset: 0;
    z-index: 9999;
    background: rgba(8, 10, 15, 0.75);
    backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
    animation: fadeIn 0.15s ease-out;
  }

  .ai-modal-card {
    background: #161922;
    border: 1px solid rgba(229, 168, 83, 0.35);
    border-radius: 12px;
    width: 100%;
    max-width: 680px;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 16px 48px rgba(0, 0, 0, 0.7), 0 0 24px rgba(229, 168, 83, 0.1);
    overflow: hidden;
  }

  .ai-modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(22, 25, 34, 0.8);
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .ai-sparkle {
    font-size: 24px;
  }

  .header-left h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 700;
    color: var(--text-primary, #fff);
  }

  .model-tag {
    font-size: 11px;
    color: var(--accent, #e5a853);
    font-weight: 600;
  }

  .btn-close {
    background: transparent;
    border: none;
    color: var(--text-muted, #8b949e);
    font-size: 18px;
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 4px;
    transition: all 0.12s;
  }
  .btn-close:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
  }

  .tone-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 20px;
    background: rgba(0, 0, 0, 0.25);
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    overflow-x: auto;
  }

  .tone-label {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    color: var(--text-muted, #8b949e);
    letter-spacing: 0.5px;
    white-space: nowrap;
  }

  .tone-pills {
    display: flex;
    gap: 6px;
  }

  .tone-pill {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 20px;
    color: var(--text-muted, #8b949e);
    font-size: 11px;
    font-weight: 600;
    padding: 4px 10px;
    display: flex;
    align-items: center;
    gap: 5px;
    cursor: pointer;
    white-space: nowrap;
    transition: all 0.15s ease;
  }
  .tone-pill:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
  }
  .tone-pill.active {
    background: rgba(229, 168, 83, 0.2);
    border-color: var(--accent, #e5a853);
    color: var(--accent, #e5a853);
  }

  .snippet-box {
    padding: 10px 20px;
    background: rgba(255, 255, 255, 0.02);
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    display: flex;
    align-items: baseline;
    gap: 10px;
  }

  .snippet-tag {
    font-size: 11px;
    font-weight: 700;
    color: var(--accent, #e5a853);
    white-space: nowrap;
  }

  .snippet-text {
    margin: 0;
    font-size: 12px;
    color: var(--text-muted, #8b949e);
    font-style: italic;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .actions-grid {
    padding: 16px 20px;
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 10px;
    max-height: 380px;
    overflow-y: auto;
  }

  .action-card {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    padding: 12px;
    display: flex;
    align-items: flex-start;
    gap: 10px;
    text-align: left;
    cursor: pointer;
    transition: all 0.15s ease;
  }
  .action-card:hover {
    background: rgba(229, 168, 83, 0.1);
    border-color: rgba(229, 168, 83, 0.4);
    transform: translateY(-1px);
  }
  .action-card.highlight {
    background: rgba(76, 175, 80, 0.08);
    border-color: rgba(76, 175, 80, 0.35);
  }
  .action-card.highlight:hover {
    background: rgba(76, 175, 80, 0.18);
    border-color: #4caf50;
  }

  .action-icon {
    font-size: 20px;
    line-height: 1;
  }

  .action-details {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .action-details strong {
    font-size: 13px;
    color: var(--text-primary, #fff);
  }

  .action-details span {
    font-size: 11px;
    color: var(--text-muted, #8b949e);
    line-height: 1.3;
  }

  .custom-prompt-row {
    padding: 14px 20px;
    display: flex;
    gap: 10px;
    background: rgba(0, 0, 0, 0.3);
    border-top: 1px solid rgba(255, 255, 255, 0.08);
  }

  .custom-input {
    flex: 1;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 6px;
    color: #fff;
    padding: 10px 14px;
    font-size: 13px;
    outline: none;
    transition: border-color 0.15s;
  }
  .custom-input:focus {
    border-color: var(--accent, #e5a853);
  }

  .btn-send {
    background: var(--accent, #e5a853);
    color: #12141a;
    border: none;
    font-weight: 700;
    font-size: 12px;
    padding: 0 16px;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.15s;
    white-space: nowrap;
  }
  .btn-send:hover:not(:disabled) {
    background: #f3b764;
    transform: translateY(-1px);
  }
  .btn-send:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .loading-box {
    padding: 40px 20px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 14px;
    text-align: center;
  }

  .ai-spinner {
    width: 38px;
    height: 38px;
    border: 3px solid rgba(229, 168, 83, 0.2);
    border-top-color: var(--accent, #e5a853);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  .loading-box h4 {
    margin: 0;
    font-size: 15px;
    color: var(--text-primary, #fff);
  }

  .loading-sub {
    margin: 0;
    font-size: 12px;
    color: var(--text-muted, #8b949e);
  }

  .result-container {
    padding: 16px 20px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    max-height: 480px;
    overflow-y: auto;
  }

  .result-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .result-badge {
    background: rgba(76, 175, 80, 0.15);
    border: 1px solid #4caf50;
    color: #81c784;
    font-size: 11px;
    font-weight: 700;
    padding: 3px 8px;
    border-radius: 4px;
  }

  .btn-copy-small {
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.15);
    color: #ccc;
    font-size: 11px;
    padding: 3px 8px;
    border-radius: 4px;
    cursor: pointer;
  }

  .result-preview {
    background: rgba(0, 0, 0, 0.4);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    padding: 14px;
    max-height: 260px;
    overflow-y: auto;
  }

  .result-preview pre {
    margin: 0;
    font-family: inherit;
    font-size: 13px;
    line-height: 1.6;
    color: var(--text-primary, #fff);
    white-space: pre-wrap;
    word-break: break-word;
    overflow-wrap: break-word;
  }

  .result-actions {
    display: flex;
    gap: 10px;
    justify-content: flex-end;
  }

  .btn-primary, .btn-secondary {
    padding: 9px 16px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s;
  }

  .btn-secondary {
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.15);
    color: var(--text-primary, #fff);
  }
  .btn-secondary:hover {
    background: rgba(255, 255, 255, 0.12);
  }

  .btn-primary {
    background: var(--accent, #e5a853);
    border: none;
    color: #12141a;
  }
  .btn-primary:hover {
    background: #f3b764;
    transform: translateY(-1px);
  }

  .error-banner {
    padding: 10px 20px;
    background: rgba(244, 67, 54, 0.15);
    border-top: 1px solid rgba(244, 67, 54, 0.4);
    color: #ef5350;
    font-size: 12px;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
</style>
