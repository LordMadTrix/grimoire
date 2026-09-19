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
  let isInstallingModel = $state(false);
  
  let selectedModel = $state('gemma2:2b');
  let errorMsg = $state('');
  let copiedCmd = $state(false);
  
  const modelsOptions = [
    { id: 'gemma2:2b', name: 'Gemma 2 (2B)', desc: 'Recommandé. Excellent en français, très précis et léger (1.4 Go).', size: '~1.4 Go' },
    { id: 'llama3.2:1b', name: 'Llama 3.2 (1B)', desc: 'Ultra-rapide. Idéal pour ordinateurs portables et configurations modestes (1.2 Go).', size: '~1.2 Go' },
    { id: 'llama3.2:3b', name: 'Llama 3.2 (3B)', desc: 'Plus créatif. Idéal avec une carte graphique dédiée (2.0 Go).', size: '~2.0 Go' }
  ];

  let unlistenDownload: (() => void) | null = null;
  let unlistenPull: (() => void) | null = null;

  onMount(async () => {
    try {
      await refreshStatus();
      if (binaryExists && existingModels.length > 0) {
        step = 'complete';
      } else if (binaryExists) {
        // Le moteur est déjà présent sur la machine, passer directement au choix du modèle !
        step = 'download_model';
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
        step = 'download_model';
      }
    });

    // Écouter le téléchargement du modèle
    unlistenPull = await listen<any>('ollama-pull-progress', (event) => {
      const payload = event.payload;

      // 1. Détection d'erreur immédiate renvoyée par Ollama ou Rust
      if (payload.error) {
        errorMsg = typeof payload.error === 'string' ? payload.error : JSON.stringify(payload.error);
        pullStatus = '';
        isInstallingModel = false;
        return;
      }

      // 2. Progression en octets (pourcentage et Mo téléchargés)
      if (payload.total > 0 && payload.completed !== undefined) {
        const totalMb = (payload.total / (1024 * 1024)).toFixed(0);
        const completedMb = (payload.completed / (1024 * 1024)).toFixed(0);
        const pct = Math.min(100, Math.round((payload.completed / payload.total) * 100));

        // Couches lourdes (> 50 Mo, les poids du modèle)
        if (payload.total > 50 * 1024 * 1024) {
          pullPercent = pct;
          pullStatus = `Téléchargement des poids : ${completedMb} Mo / ${totalMb} Mo (${pct}%)`;
        } else {
          // Petites couches annexes (manifeste, configuration)
          pullStatus = `Configuration des métadonnées (${completedMb} Mo / ${totalMb} Mo)...`;
        }
      } else if (payload.status) {
        // Statuts textuels (ex: "verifying sha256 digest", "writing manifest", "success")
        pullStatus = payload.status.charAt(0).toUpperCase() + payload.status.slice(1);
        if (payload.status === 'success') {
          pullPercent = 100;
        }
      }
    });
  });

  onDestroy(() => {
    if (unlistenDownload) unlistenDownload();
    if (unlistenPull) unlistenPull();
  });

  function isModelInstalled(id: string): boolean {
    return existingModels.some(m => m === id || m.startsWith(id) || id.startsWith(m) || m.split(':')[0] === id.split(':')[0]);
  }

  async function refreshStatus() {
    try {
      const status = await checkOllamaStatus();
      binaryExists = status.binary_exists;
      serverRunning = status.server_running;
      existingModels = status.models;
      if (existingModels && existingModels.length > 0) {
        const match = existingModels.find(m => m === selectedModel || m.startsWith(selectedModel) || selectedModel.startsWith(m) || m.split(':')[0] === selectedModel.split(':')[0]);
        if (match) {
          selectedModel = match;
        } else {
          selectedModel = existingModels[0];
        }
        setAiModel(selectedModel);
      }
      if (binaryExists && step === 'intro') {
        step = (existingModels && existingModels.length > 0) ? 'complete' : 'download_model';
      }
    } catch (e: any) {
      console.warn("Échec du rafraîchissement d'état Ollama :", e);
    }
  }

  async function startSetup() {
    if (!binaryExists) {
      step = 'download_bin';
      downloadProgress = 0;
      errorMsg = '';
      try {
        await downloadOllamaBinary();
        binaryExists = true;
        step = 'download_model';
      } catch (err: any) {
        errorMsg = typeof err === 'string' ? err : (err?.message || `Erreur de téléchargement : ${err}`);
        step = 'intro';
      }
    } else {
      step = 'download_model';
    }
  }

  async function copyInstallCommand() {
    try {
      await navigator.clipboard.writeText('curl -fsSL https://ollama.com/install.sh | sh');
      copiedCmd = true;
      setTimeout(() => copiedCmd = false, 3000);
    } catch {
      // Ignore clipboard fallback
    }
  }

  async function installModel() {
    if (isModelInstalled(selectedModel)) {
      const match = existingModels.find(m => m === selectedModel || m.startsWith(selectedModel) || selectedModel.startsWith(m) || m.split(':')[0] === selectedModel.split(':')[0]);
      const finalModel = match || selectedModel;
      setAiModel(finalModel);
      selectedModel = finalModel;
      step = 'complete';
      return;
    }

    isInstallingModel = true;
    pullPercent = 0;
    pullStatus = "Connexion au moteur Ollama...";
    errorMsg = '';

    try {
      await pullOllamaModel(selectedModel);
      // Confirmer que le modèle est bien présent
      await refreshStatus();
      setAiModel(selectedModel);
      step = 'complete';
    } catch (err: any) {
      errorMsg = typeof err === 'string' ? err : (err?.message || `Erreur d'installation : ${err}`);
      pullStatus = '';
    } finally {
      isInstallingModel = false;
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
        <div class="header-title">
          <span class="sparkle-icon">✨</span>
          <h2>Assistant IA de Grimoire</h2>
        </div>
        <button class="btn-close" onclick={onClose} title="Fermer" aria-label="Fermer">✕</button>
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
                  <strong>Génération de contenu rōliste</strong>
                  <p>Créez instantanément des descriptions immersives de salles, des profils de PNJ ou des idées de butin.</p>
                </div>
              </div>
              <div class="feature-item">
                <span class="feat-icon">🔒</span>
                <div class="feat-text">
                  <strong>100% Privé et Gratuit</strong>
                  <p>Aucune donnée n'est envoyée dans le cloud. Vos notes restent strictement sur votre machine.</p>
                </div>
              </div>
              <div class="feature-item">
                <span class="feat-icon">⚙️</span>
                <div class="feat-text">
                  <strong>Standard Ollama (Port 11434)</strong>
                  <p>Compatible avec votre installation existante ou configuré automatiquement par Grimoire.</p>
                </div>
              </div>
            </div>

            {#if !binaryExists}
              <div class="terminal-box">
                <span class="terminal-box-title">🐧 Vous êtes sous Linux ? (Option recommandée)</span>
                <p>Vous pouvez installer le moteur officiel en une seule commande dans votre terminal :</p>
                <div class="code-copy-row">
                  <code>curl -fsSL https://ollama.com/install.sh | sh</code>
                  <button class="btn-copy" onclick={copyInstallCommand}>
                    {copiedCmd ? '✓ Copié !' : '📋 Copier'}
                  </button>
                </div>
              </div>
            {/if}

            <div class="actions">
              <button class="btn-secondary" onclick={onClose}>
                Plus tard
              </button>
              {#if !binaryExists}
                <button class="btn-secondary" onclick={refreshStatus} title="Vérifier si Ollama a été installé">
                  🔄 Vérifier la détection
                </button>
                <button class="btn-primary" onclick={startSetup}>
                  Télécharger automatiquement
                </button>
              {:else}
                <button class="btn-primary" onclick={startSetup}>
                  Choisir le modèle
                </button>
              {/if}
            </div>
          </div>

        {:else if step === 'download_bin'}
          <div class="step-progress">
            <h3>Téléchargement du moteur Ollama</h3>
            <p class="desc">Nous récupérons le moteur Ollama pour le configurer dans votre espace utilisateur.</p>
            
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

            {#if errorMsg}
              <div class="actions" style="margin-top: 20px;">
                <button class="btn-secondary" onclick={() => { errorMsg = ''; step = 'intro'; }}>
                  Retour
                </button>
                <button class="btn-primary" onclick={startSetup}>
                  Réessayer
                </button>
              </div>
            {/if}
          </div>

        {:else if step === 'download_model'}
          {#if isInstallingModel}
            <div class="step-progress">
              <h3>Téléchargement du Modèle : <span class="model-badge">{selectedModel}</span></h3>
              <p class="desc">
                Ollama télécharge les neurones de l'IA ({modelsOptions.find(m => m.id === selectedModel)?.size || '1-2 Go'}).
                Veuillez patienter pendant le téléchargement.
              </p>
              
              <div class="progress-container">
                <div class="progress-bar-bg">
                  <div class="progress-bar-fill accent-color" style="width: {pullPercent}%"></div>
                </div>
                
                <div class="progress-meta">
                  <span class="status-pulse">{pullStatus || 'Téléchargement en cours...'}</span>
                  <span>{pullPercent}%</span>
                </div>
              </div>
              <div class="spinner-small visible"></div>
            </div>
          {:else}
            <div class="step-model">
              <h3>Choisissez votre modèle d'IA</h3>
              <p class="desc">Sélectionnez le modèle le plus adapté à votre ordinateur :</p>

              <div class="model-cards">
                {#each modelsOptions as opt}
                  {@const installed = isModelInstalled(opt.id)}
                  <button 
                    type="button"
                    class="model-card" 
                    class:selected={selectedModel === opt.id || (installed && (selectedModel === opt.id || !modelsOptions.some(o => o.id === selectedModel)))}
                    onclick={() => selectedModel = opt.id}
                  >
                    <div class="model-card-header">
                      <strong class="model-name">{opt.name}</strong>
                      {#if installed}
                        <span style="background: rgba(46, 125, 50, 0.2); border: 1px solid #4caf50; color: #81c784; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: bold;">✓ Installé</span>
                      {:else}
                        <span class="model-size">{opt.size}</span>
                      {/if}
                    </div>
                    <p class="model-desc">{opt.desc}</p>
                  </button>
                {/each}
              </div>

              {#if existingModels.length > 0}
                <div style="margin-top: 15px; padding: 12px; background: rgba(46, 125, 50, 0.1); border: 1px solid rgba(76, 175, 80, 0.3); border-radius: 8px;">
                  <strong style="color: #81c784; font-size: 13px;">💡 Modèle{existingModels.length > 1 ? 's' : ''} détecté{existingModels.length > 1 ? 's' : ''} sur votre machine :</strong>
                  <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-top: 8px;">
                    {#each existingModels as em}
                      <button 
                        type="button" 
                        class="btn-secondary" 
                        class:btn-primary={selectedModel === em}
                        style="padding: 6px 12px; font-size: 12px;"
                        onclick={() => { selectedModel = em; setAiModel(em); step = 'complete'; }}
                      >
                        ✓ Activer {em}
                      </button>
                    {/each}
                  </div>
                </div>
              {/if}

              <div class="actions">
                <button class="btn-secondary" onclick={() => { errorMsg = ''; pullStatus = ''; pullPercent = 0; step = 'intro'; }}>
                  Retour
                </button>
                <button class="btn-primary" onclick={installModel}>
                  {isModelInstalled(selectedModel) ? 'Utiliser ce modèle' : (errorMsg ? 'Réessayer le téléchargement' : 'Télécharger et Configurer')}
                </button>
              </div>
            </div>
          {/if}

        {:else if step === 'complete'}
          <div class="step-complete">
            <div class="success-icon">✨</div>
            <h3>Votre IA Locale est Prête !</h3>
            <p class="desc">
              Le moteur Ollama est opérationnel et le modèle <strong>{selectedModel}</strong> est configuré pour vos créations.
            </p>
            
            <div class="info-card">
              💡 <strong>Astuce :</strong> Vous pouvez lancer des générations automatiques de texte dans l'éditeur de notes à tout moment en utilisant le raccourci <kbd>Ctrl</kbd> + <kbd>J</kbd> !
            </div>

            <div class="actions full">
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
    justify-content: space-between;
    margin-bottom: 24px;
  }

  .header-title {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .btn-close {
    background: transparent;
    border: none;
    color: #9c91a5;
    font-size: 18px;
    cursor: pointer;
    padding: 6px 10px;
    border-radius: 6px;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    line-height: 1;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .btn-close:hover {
    color: #ffffff;
    background: rgba(255, 255, 255, 0.08);
    transform: scale(1.05);
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
    font-size: 14px;
    line-height: 1.5;
    margin: 0 0 20px 0;
  }

  /* Feature List */
  .feature-list {
    display: flex;
    flex-direction: column;
    gap: 14px;
    margin-bottom: 20px;
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

  /* Terminal box */
  .terminal-box {
    background: rgba(0, 0, 0, 0.35);
    border: 1px solid rgba(229, 168, 83, 0.2);
    border-radius: 10px;
    padding: 14px 16px;
    margin-bottom: 20px;
  }

  .terminal-box-title {
    font-size: 13px;
    font-weight: 700;
    color: #f4cf8f;
    margin-bottom: 6px;
    display: block;
  }

  .terminal-box p {
    font-size: 12.5px;
    color: #b0a7b8;
    margin: 0 0 10px 0;
  }

  .code-copy-row {
    display: flex;
    align-items: center;
    gap: 8px;
    background: rgba(0, 0, 0, 0.5);
    border-radius: 6px;
    padding: 8px 12px;
    border: 1px solid rgba(255, 255, 255, 0.08);
  }

  .code-copy-row code {
    flex: 1;
    font-family: monospace;
    font-size: 12px;
    color: #e8d0aa;
    overflow-x: auto;
    white-space: nowrap;
  }

  .btn-copy {
    background: rgba(229, 168, 83, 0.15);
    border: 1px solid rgba(229, 168, 83, 0.3);
    color: #f4cf8f;
    font-size: 11px;
    font-weight: 700;
    padding: 5px 10px;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.2s;
    white-space: nowrap;
  }

  .btn-copy:hover {
    background: rgba(229, 168, 83, 0.25);
    color: #ffffff;
  }

  /* Model Cards Selection */
  .model-cards {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-bottom: 24px;
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
    background: rgba(0, 0, 0, 0.25);
    border: 1px solid rgba(255, 255, 255, 0.06);
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
    align-items: center;
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
    margin-bottom: 24px;
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
    white-space: pre-wrap;
  }

  /* Buttons */
  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
  }

  .actions.full {
    width: 100%;
  }

  button {
    font-family: inherit;
    font-size: 13.5px;
    font-weight: 700;
    padding: 10px 18px;
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
