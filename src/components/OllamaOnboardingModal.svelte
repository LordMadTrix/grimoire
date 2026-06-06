<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { listen } from '@tauri-apps/api/event';
  import { checkOllamaStatus, downloadOllamaBinary, pullOllamaModel } from '$lib/api';
  import { setAiModel } from '$lib/stores/settings.svelte';

  let { onClose = () => {} }: { onClose: () => void } = $props();

  type Step = 'intro' | 'download_bin' | 'download_model' | 'complete';
  let step = $state<Step>('intro');
  
  let isLoadingStatus = $state(true);
  let binaryExists = $state(false);
  let serverRunning = $state(false);
  let existingModels = $state<string[]>([]);
  
  let downloadProgress = $state(0); // 0-100, 101 = extraction, 102 = done
  let pullPercent = $state(0);
  let pullStatus = $state('');
  
  let selectedModel = $state('gemma2:2b');
  let errorMsg = $state('');
  
  const modelsOptions = [
    { id: 'gemma2:2b', name: 'Gemma 2 (2B)', desc: 'Recommandé. Excellent en français, très précis et léger (1.4 Go).', size: '~1.4 Go' },
    { id: 'llama3.2:1b', name: 'Llama 3.2 (1B)', desc: 'Ultra-rapide. Conçu pour les ordinateurs portables et configurations modestes (1.2 Go).', size: '~1.2 Go' },
    { id: 'llama3.2:3b', name: 'Llama 3.2 (3B)', desc: 'Créatif. Idéal si vous avez un PC de jeu avec carte graphique dédiée (2.0 Go).', size: '~2.0 Go' }
  ];

  let unlistenDownload: (() => void) | null = null;
  let unlistenPull: (() => void) | null = null;

  onMount(async () => {
    try {
      await refreshStatus();
      if (binaryExists && existingModels.length > 0) {
        // Déjà tout configuré ! On ferme ou on affiche le succès
        step = 'complete';
      }
    } catch (e) {
      console.error("Erreur de vérification Ollama :", e);
    } finally {
      isLoadingStatus = false;
    }

    // Écouter le téléchargement du binaire
    unlistenDownload = await listen<number>('ollama-download-progress', (event) => {
      downloadProgress = event.payload;
      if (downloadProgress === 102) {
        binaryExists = true;
        // Passer à la sélection du modèle
        step = 'download_model';
      }
    });

    // Écouter le téléchargement du modèle
    unlistenPull = await listen<any>('ollama-pull-progress', (event) => {
      const payload = event.payload;
      if (payload.total > 0 && payload.completed !== undefined) {
        const pct = Math.round((payload.completed / payload.total) * 100);
        pullPercent = pct;
        pullStatus = `Téléchargement : ${pct}% (Fichier ${payload.digest ? payload.digest.slice(7, 15) : ''})`;
      } else if (payload.status) {
        // Autres status (ex: "verifying sha256", "success")
        pullStatus = payload.status.charAt(0).toUpperCase() + payload.status.slice(1);
        if (payload.status === 'success') {
          pullPercent = 100;
          setAiModel(selectedModel);
          step = 'complete';
        }
      }
    });
  });

  onDestroy(() => {
    if (unlistenDownload) unlistenDownload();
    if (unlistenPull) unlistenPull();
  });

  async function refreshStatus() {
    const status = await checkOllamaStatus();
    binaryExists = status.binary_exists;
    serverRunning = status.server_running;
    existingModels = status.models;
  }

  async function startSetup() {
    if (!binaryExists) {
      step = 'download_bin';
      try {
        errorMsg = '';
        await downloadOllamaBinary();
      } catch (err: any) {
        errorMsg = `Erreur de téléchargement du moteur : ${err}`;
        step = 'intro';
      }
    } else {
      step = 'download_model';
    }
  }

  async function installModel() {
    step = 'download_model'; // pour forcer l'affichage de la progression
    pullPercent = 0;
    pullStatus = "Initialisation du téléchargement...";
    errorMsg = '';

    try {
      // Lancer en arrière-plan et attendre
      await pullOllamaModel(selectedModel);
      // Mettre à jour le modèle par défaut dans les réglages de l'application
      setAiModel(selectedModel);
      step = 'complete';
    } catch (err: any) {
      errorMsg = `Erreur d'installation du modèle : ${err}`;
    }
  }

  function finish() {
    onClose();
  }
</script>

<div class="modal-backdrop">
  <div class="modal-content glass-effect">
    {#if isLoadingStatus}
      <div class="loading-state">
        <div class="spinner"></div>
        <p>Vérification de l'environnement IA...</p>
      </div>
    {:else}
      <!-- HEADER -->
      <div class="modal-header">
        <span class="sparkle-icon">✨</span>
        <h2>Assistant IA de Grimoire</h2>
      </div>

      <!-- MAIN LAYOUT -->
      <div class="modal-body">
        {#if errorMsg}
          <div class="error-banner">
            <strong>⚠️ Une erreur est survenue :</strong>
            <p>{errorMsg}</p>
          </div>
        {/if}

        {#if step === 'intro'}
          <div class="step-intro">
            <h3>Activez l'Intelligence Artificielle Locale</h3>
            <p class="desc">
              Grimoire intègre un assistant d'écriture propulsé par une IA qui tourne 
              <strong>entièrement hors-ligne sur votre ordinateur</strong>.
            </p>

            <div class="feature-list">
              <div class="feature-item">
                <span class="feat-icon">🎲</span>
                <div class="feat-text">
                  <strong>Génération de contenu</strong>
                  <p>Créez instantanément des descriptions immersives de salles, des profils de PNJ ou des idées de butin.</p>
                </div>
              </div>
              <div class="feature-item">
                <span class="feat-icon">🔒</span>
                <div class="feat-text">
                  <strong>100% Privé et Gratuit</strong>
                  <p>Aucune donnée n'est envoyée dans le cloud. Pas d'abonnement, fonctionne même sans connexion internet.</p>
                </div>
              </div>
              <div class="feature-item">
                <span class="feat-icon">⚙️</span>
                <div class="feat-text">
                  <strong>Indépendant (Port 11435)</strong>
                  <p>Fonctionne de manière isolée dans Grimoire sans entrer en conflit avec d'autres installations d'Ollama.</p>
                </div>
              </div>
            </div>

            <div class="actions">
              <button class="btn-secondary" onclick={onClose}>
                Plus tard
              </button>
              <button class="btn-primary" onclick={startSetup}>
                {#if binaryExists}Choisir le modèle{:else}Installer l'IA localement (recommandé){/if}
              </button>
            </div>
          </div>

        {:else if step === 'download_bin'}
          <div class="step-progress">
            <h3>Téléchargement d'Ollama Portable</h3>
            <p class="desc">Nous récupérons le moteur Ollama (~280 Mo) pour le placer directement dans le répertoire de Grimoire.</p>
            
            <div class="progress-container">
              <div class="progress-bar-bg">
                <div class="progress-bar-fill" style="width: {downloadProgress > 100 ? 100 : downloadProgress}%"></div>
              </div>
              
              <div class="progress-meta">
                {#if downloadProgress === 101}
                  <span class="status-pulse">Extraction des fichiers...</span>
                {:else if downloadProgress === 102}
                  <span>Moteur installé !</span>
                {:else}
                  <span>Téléchargement : {downloadProgress}%</span>
                {/if}
              </div>
            </div>
            <div class="spinner-small" class:visible={downloadProgress === 101}></div>
          </div>

        {:else if step === 'download_model'}
          {#if pullPercent > 0 || pullStatus}
            <div class="step-progress">
              <h3>Téléchargement du Modèle : <span class="model-badge">{selectedModel}</span></h3>
              <p class="desc">Ollama télécharge et configure le modèle de neurones de l'IA (entre 1.2 Go et 2 Go selon votre choix).</p>
              
              <div class="progress-container">
                <div class="progress-bar-bg">
                  <div class="progress-bar-fill accent-color" style="width: {pullPercent}%"></div>
                </div>
                
                <div class="progress-meta">
                  <span class="status-pulse">{pullStatus}</span>
                  <span>{pullPercent}%</span>
                </div>
              </div>
            </div>
          {:else}
            <div class="step-model">
              <h3>Choisissez votre modèle d'IA</h3>
              <p class="desc">Sélectionnez le modèle le plus adapté à la puissance de votre ordinateur :</p>

              <div class="model-cards">
                {#each modelsOptions as opt}
                  <button 
                    class="model-card" 
                    class:selected={selectedModel === opt.id}
                    onclick={() => selectedModel = opt.id}
                  >
                    <div class="model-card-header">
                      <strong class="model-name">{opt.name}</strong>
                      <span class="model-size">{opt.size}</span>
                    </div>
                    <p class="model-desc">{opt.desc}</p>
                  </button>
                {/each}
              </div>

              <div class="actions">
                <button class="btn-secondary" onclick={() => step = 'intro'}>
                  Retour
                </button>
                <button class="btn-primary" onclick={installModel}>
                  Télécharger et Configurer
                </button>
              </div>
            </div>
          {/if}

        {:else if step === 'complete'}
          <div class="step-complete">
            <div class="success-icon">✨</div>
            <h3>Votre IA Locale est Prête !</h3>
            <p class="desc">
              Le moteur Ollama portable a été correctement déployé sur le port <strong>11435</strong>, 
              et le modèle <strong>{selectedModel}</strong> est maintenant opérationnel.
            </p>
            
            <div class="info-card">
              💡 <strong>Astuce :</strong> Vous pouvez lancer des générations automatiques de texte dans l'éditeur de notes à tout moment en utilisant le raccourci <kbd>Ctrl</kbd> + <kbd>J</kbd> !
            </div>

            <div class="actions">
              <button class="btn-primary full" onclick={finish}>
                Commencer à utiliser Grimoire
              </button>
            </div>
          </div>
        {/if}
      </div>
    {/if}
  </div>
</div>

<style>
  .modal-backdrop {
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(8, 6, 12, 0.85);
    backdrop-filter: blur(10px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 20000;
  }

  .modal-content {
    background: linear-gradient(145deg, #1b1624, #120e18);
    border: 1px solid rgba(229, 168, 83, 0.15);
    border-radius: 16px;
    padding: 32px;
    width: 92%;
    max-width: 580px;
    box-shadow: 0 24px 64px rgba(0, 0, 0, 0.7), 
                0 0 40px rgba(229, 168, 83, 0.05);
    position: relative;
    overflow: hidden;
  }

  /* Glassmorphism effect overlay */
  .modal-content::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0; height: 4px;
    background: linear-gradient(90deg, var(--accent, #e5a853), #f4cf8f, var(--accent, #e5a853));
  }

  .loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px 0;
    gap: 16px;
    color: #e3dbe8;
  }

  .spinner {
    width: 40px;
    height: 40px;
    border: 3px solid rgba(229, 168, 83, 0.1);
    border-top-color: var(--accent, #e5a853);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /* Header */
  .modal-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 24px;
  }

  .sparkle-icon {
    font-size: 28px;
    animation: sparkle 2s ease-in-out infinite;
  }

  @keyframes sparkle {
    0%, 100% { transform: scale(1) rotate(0deg); filter: drop-shadow(0 0 2px rgba(229, 168, 83, 0.3)); }
    50% { transform: scale(1.15) rotate(15deg); filter: drop-shadow(0 0 10px rgba(229, 168, 83, 0.6)); }
  }

  h2 {
    margin: 0;
    font-size: 22px;
    font-weight: 800;
    color: #f4cf8f;
    letter-spacing: -0.5px;
  }

  h3 {
    margin: 0 0 8px 0;
    font-size: 18px;
    color: #ffffff;
    font-weight: 700;
  }

  .desc {
    color: #b0a7b8;
    font-size: 14.5px;
    line-height: 1.5;
    margin: 0 0 24px 0;
  }

  /* Feature List */
  .feature-list {
    display: flex;
    flex-direction: column;
    gap: 18px;
    margin-bottom: 28px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.05);
    border-radius: 12px;
    padding: 16px;
  }

  .feature-item {
    display: flex;
    gap: 14px;
    align-items: flex-start;
  }

  .feat-icon {
    font-size: 20px;
    background: rgba(229, 168, 83, 0.1);
    padding: 8px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .feat-text strong {
    color: #e3dbe8;
    font-size: 14px;
    display: block;
    margin-bottom: 2px;
  }

  .feat-text p {
    margin: 0;
    color: #9c91a5;
    font-size: 13px;
    line-height: 1.4;
  }

  /* Model Cards Selection */
  .model-cards {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-bottom: 28px;
  }

  .model-card {
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 10px;
    padding: 14px 18px;
    text-align: left;
    cursor: pointer;
    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    width: 100%;
  }

  .model-card:hover {
    background: rgba(229, 168, 83, 0.04);
    border-color: rgba(229, 168, 83, 0.3);
    transform: translateY(-2px);
  }

  .model-card.selected {
    background: rgba(229, 168, 83, 0.08);
    border-color: rgba(229, 168, 83, 0.7);
    box-shadow: 0 0 16px rgba(229, 168, 83, 0.1);
  }

  .model-card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 6px;
  }

  .model-name {
    color: #ffffff;
    font-size: 15px;
    font-weight: 700;
  }

  .model-card.selected .model-name {
    color: #f4cf8f;
  }

  .model-size {
    background: rgba(255, 255, 255, 0.08);
    color: #b0a7b8;
    font-size: 11px;
    font-weight: 700;
    padding: 2px 6px;
    border-radius: 4px;
  }

  .model-desc {
    margin: 0;
    color: #9c91a5;
    font-size: 13px;
    line-height: 1.4;
  }

  /* Progress bars */
  .progress-container {
    background: rgba(0, 0, 0, 0.2);
    border: 1px solid rgba(255, 255, 255, 0.05);
    border-radius: 12px;
    padding: 20px;
    margin-bottom: 16px;
  }

  .progress-bar-bg {
    background: rgba(255, 255, 255, 0.05);
    height: 8px;
    border-radius: 4px;
    overflow: hidden;
    margin-bottom: 12px;
  }

  .progress-bar-fill {
    background: linear-gradient(90deg, #e5a853, #f4cf8f);
    height: 100%;
    border-radius: 4px;
    transition: width 0.3s ease-out;
  }

  .progress-bar-fill.accent-color {
    background: linear-gradient(90deg, #bd7ee0, #e8a6f9);
  }

  .progress-meta {
    display: flex;
    justify-content: space-between;
    color: #e3dbe8;
    font-size: 13px;
    font-weight: 600;
  }

  .status-pulse {
    animation: pulse 1.5s infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 0.6; }
    50% { opacity: 1; }
  }

  /* Success & Complete */
  .step-complete {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
  }

  .success-icon {
    font-size: 56px;
    margin-bottom: 16px;
    animation: floating 3s ease-in-out infinite;
  }

  @keyframes floating {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-8px); }
  }

  .info-card {
    background: rgba(229, 168, 83, 0.06);
    border: 1px solid rgba(229, 168, 83, 0.15);
    border-radius: 10px;
    padding: 14px 18px;
    color: #d1c4b2;
    font-size: 13.5px;
    line-height: 1.5;
    text-align: left;
    margin-bottom: 28px;
  }

  kbd {
    background: rgba(255, 255, 255, 0.12);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 4px;
    padding: 1px 5px;
    font-family: monospace;
    font-size: 11px;
    color: white;
  }

  /* Error Banner */
  .error-banner {
    background: rgba(239, 68, 68, 0.08);
    border: 1px solid rgba(239, 68, 68, 0.25);
    border-radius: 8px;
    padding: 12px 16px;
    color: #fca5a5;
    margin-bottom: 20px;
    font-size: 13px;
  }

  .error-banner strong {
    display: block;
    margin-bottom: 4px;
  }

  .error-banner p {
    margin: 0;
    line-height: 1.4;
  }

  /* Buttons */
  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
  }

  button {
    font-family: inherit;
    font-size: 13.5px;
    font-weight: 700;
    padding: 10px 20px;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .btn-primary {
    background: linear-gradient(135deg, #e5a853, #cd913c);
    border: none;
    color: #120e18;
    box-shadow: 0 4px 14px rgba(229, 168, 83, 0.25);
  }

  .btn-primary:hover {
    transform: translateY(-1.5px);
    box-shadow: 0 6px 20px rgba(229, 168, 83, 0.35);
    background: linear-gradient(135deg, #f4cf8f, #e5a853);
  }

  .btn-primary.full {
    width: 100%;
    padding: 12px;
  }

  .btn-secondary {
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: #b0a7b8;
  }

  .btn-secondary:hover {
    background: rgba(255, 255, 255, 0.08);
    color: #ffffff;
    border-color: rgba(255, 255, 255, 0.15);
  }

  .spinner-small {
    width: 20px;
    height: 20px;
    border: 2px solid rgba(255, 255, 255, 0.1);
    border-top-color: #e5a853;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin: 10px auto 0 auto;
    opacity: 0;
    transition: opacity 0.2s;
  }

  .spinner-small.visible {
    opacity: 1;
  }

  .model-badge {
    background: rgba(189, 126, 224, 0.15);
    color: #e8a6f9;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 13px;
    font-weight: 700;
  }
</style>
