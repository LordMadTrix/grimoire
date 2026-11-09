<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { ttsReader } from '$lib/stores/ttsReader.svelte';
  import { NEURAL_VOICES, type NeuralVoice } from '$lib/services/edgeTts';
  import {
    parseMultiVoiceSegments,
    VOICE_PROFILES,
    inferSpeakerVoice,
    type NarrationSegment
  } from '$lib/services/dialogueParser';
  import { narrationStudioStore } from '$lib/stores/narrationStudio.svelte';
  import { askOllama, broadcastToPlayers } from '$lib/api';
  import { getAiModel } from '$lib/stores/settings.svelte';
  import { notifStore } from '$lib/stores/notifications.svelte';

  // ── Onglets & États ──
  type StudioTab = 'staged' | 'raw_text';
  let activeTab = $state<StudioTab>('staged');

  let rawSourceText = $state<string>('');
  let segments = $state<NarrationSegment[]>([]);
  let isGeneratingAi = $state<boolean>(false);
  let aiPromptInput = $state<string>('');
  let playbackRate = $state<number>(1.0);

  // Exemples de scènes immersives prêtes à jouer
  const PRESET_SCENES = [
    {
      title: '🏰 La Crypte Ancestrale',
      text: `Narrateur : Le froid de la pierre vous mord les os tandis que le vent s'engouffre dans la nef funéraire.
Gardien : « Qui ose troubler le repos des Ducs de Carstein ? Reculez, ou votre sang abreuvera ces dalles ! »
Narrateur : Des runes spectrales s'allument alors sur son armure rouillée d'un éclat bleuté menaçant.
Magicienne : « Attendez ! Nous ne cherchons que l'anneau scellé du grand mage Aldred ! »
Gardien : « Nul vivant ne franchira ce seuil sans payer le tribut des âmes ! »`
    },
    {
      title: '🍺 La Taverne du Sanglier',
      text: `Narrateur : Une odeur de suif et de bière houblonnée emplit la salle comble de l'auberge.
Tavernier : « Approchez donc voyageurs ! Prenez une pinte et mettez-vous au chaud près de la cheminée. »
Aventurier : « Nous cherchons un guide pour traverser les marais interdits avant la nuit tombée. »
Tavernier : « Les marais ? Vous êtes fous ! La bête à cornes en a déjà dévoré trois cette semaine ! »
Barde : « Ah, mais les légendes racontent aussi qu'un trésor d'or pur gît sous les nénuphars géants... »`
    },
    {
      title: '🔮 L\'Oracle de la Tour',
      text: `Narrateur : Au sommet de la tour de verre, les constellations semblent tourner à portée de main.
Oracle : « Je vous attendais, enfants du destin. Les étoiles ont murmuré votre venue dans mes songes. »
Guerrier : « Assez d'énigmes, oracle. Dis-nous où se cache l'armée des orcs des collines ! »
Oracle : « Ce n'est pas le fer des orcs que vous devez craindre... mais le traître qui marche à vos côtés. »`
    }
  ];

  onMount(() => {
    // Si un texte initial a été passé via le store
    if (narrationStudioStore.initialText) {
      rawSourceText = narrationStudioStore.initialText;
    } else {
      rawSourceText = PRESET_SCENES[0].text;
    }
    parseAndLoadSegments();
  });

  onDestroy(() => {
    // Ne pas couper la voix automatiquement si l'utilisateur ferme la fenêtre pour écouter en jouant sur la carte
  });

  function parseAndLoadSegments() {
    if (!rawSourceText.trim()) {
      segments = [];
      return;
    }
    segments = parseMultiVoiceSegments(rawSourceText);
  }

  function loadPreset(presetText: string) {
    ttsReader.stop();
    rawSourceText = presetText;
    parseAndLoadSegments();
    notifStore.add('📜', 'Scène Chargée', 'Scénario prêt pour la narration vocale !', 'info', 2000);
  }

  // ── Génération de Scène Narrative par l'IA Locale (Ollama) ──
  async function generateSceneWithAi() {
    const promptTheme = aiPromptInput.trim() || 'Une dispute animée dans une auberge entre un garde et un voleur';
    isGeneratingAi = true;

    try {
      const fullPrompt = `Tu es un scénariste expert de jeu de rôle dark fantasy.
Rédige une scène narrative courte, immersive et percutante (10 à 15 lignes maximum) sur le thème suivant :
« ${promptTheme} »

RÈGLES IMPORTANTES POUR LE MULTI-VOIX :
1. Alterne entre les interventions du Narrateur et les dialogues des PNJ.
2. Chaque réplique doit OBLIGATOIREMENT commencer par le nom du personnage suivi de deux points, par exemple :
Narrateur : Description de la pièce...
Garde : « Vos papiers ou vous finissez aux fers ! »
Voleur : « Doucement l'ami, je ne faisais que chercher mon briquet. »
3. Sois expressif, théâtral et soigné dans le style en français.
Écris UNIQUEMENT la scène (pas d'intro ni de conclusion).`;

      const model = getAiModel() || '';
      const reply = await askOllama(fullPrompt, model, 'Tu es un scénariste de jeu de rôle d\'élite.');

      if (reply && reply.trim().length > 0) {
        ttsReader.stop();
        rawSourceText = reply.trim();
        parseAndLoadSegments();
        activeTab = 'staged';
        notifStore.add('✨', 'Scène IA Générée', 'Les voix des personnages ont été détectées avec succès !', 'success', 3500);
      }
    } catch (err: any) {
      alert('Erreur lors de la génération IA : ' + (err?.message || err));
    } finally {
      isGeneratingAi = false;
    }
  }

  // ── Contrôles de Lecture Audio ──
  function handlePlayAll() {
    if (ttsReader.isPlaying) {
      if (ttsReader.isPaused) {
        ttsReader.resume();
      } else {
        ttsReader.pause();
      }
    } else {
      if (segments.length === 0) parseAndLoadSegments();
      ttsReader.speakSegments(segments);
    }
  }

  function handleStop() {
    ttsReader.stop();
  }

  function handlePlaySingle(seg: NarrationSegment) {
    ttsReader.speakSingleSegment(seg);
  }

  function handleRateChange(newRate: number) {
    playbackRate = newRate;
    ttsReader.setRate(newRate);
  }

  function updateSegmentVoice(segIndex: number, newVoiceId: string) {
    const voiceObj = NEURAL_VOICES.find(v => v.id === newVoiceId);
    if (voiceObj && segments[segIndex]) {
      segments[segIndex].voiceId = newVoiceId;
      const emojiMatch = voiceObj.name.match(/^(\p{Emoji})/u);
      if (emojiMatch) segments[segIndex].voiceEmoji = emojiMatch[1];
    }
  }

  function addEmptySegment() {
    const newSeg: NarrationSegment = {
      id: `seg_${Date.now()}`,
      text: 'Nouvelle réplique...',
      isDialogue: true,
      speakerName: 'Nouveau PNJ',
      voiceId: 'fr-FR-RemyMultilingualNeural',
      voiceEmoji: '⚔️'
    };
    segments = [...segments, newSeg];
  }

  function removeSegment(index: number) {
    segments = segments.filter((_, i) => i !== index);
  }

  async function broadcastNarrationToPlayers() {
    const textToSend = segments.map(s => `${s.speakerName} : ${s.text}`).join('\n\n');
    try {
      await broadcastToPlayers('chat', {
        from: '🎙️ Narration MJ',
        message: textToSend
      });
      notifStore.add('📱', 'Diffusé aux Joueurs', 'Le texte de la scène a été envoyé sur les smartphones !', 'success', 3000);
    } catch (e) {
      console.warn('Erreur diffusion mobile:', e);
    }
  }

  function copyFormattedText() {
    const formatted = segments.map(s => `${s.speakerName} : ${s.text}`).join('\n\n');
    navigator.clipboard.writeText(formatted);
    notifStore.add('📋', 'Copié dans le presse-papier', 'Vous pouvez le coller dans vos notes de scénario !', 'info', 2000);
  }
</script>

<div class="ns-overlay" onclick={(e) => { if (e.target === e.currentTarget) narrationStudioStore.close(); }} role="dialog" aria-modal="true">
  <div class="ns-card">
    <!-- En-tête -->
    <div class="ns-header">
      <div class="ns-header-left">
        <span class="ns-icon">🎙️</span>
        <div>
          <div class="ns-title-row">
            <h2 class="ns-title">Studio de Narration & Voix IA</h2>
            <span class="ns-badge neural">Azure Neural HD</span>
            <span class="ns-badge auto-ducking">Auto-Ducking Ambiance</span>
          </div>
          <p class="ns-subtitle">Lecture théâtrale multi-acteurs en temps réel · Découpage automatique Narrateur & PNJ</p>
        </div>
      </div>
      <div class="ns-header-actions">
        <button class="ns-btn-close" onclick={() => narrationStudioStore.close()} title="Fermer (Échap)">✕</button>
      </div>
    </div>

    <!-- Barre d'outils Presets & IA -->
    <div class="ns-ai-bar">
      <div class="ns-presets-row">
        <span class="ns-label-dim">Scènes Rapides :</span>
        {#each PRESET_SCENES as preset}
          <button type="button" class="ns-preset-btn" onclick={() => loadPreset(preset.text)}>
            {preset.title}
          </button>
        {/each}
      </div>

      <div class="ns-generator-row">
        <div class="ns-ai-input-wrap">
          <span class="ns-ai-spark">🪄</span>
          <input
            type="text"
            class="ns-ai-input"
            placeholder="Ex : Un prêtre maudit met en garde les PJ dans les égouts..."
            bind:value={aiPromptInput}
            onkeydown={(e) => { if (e.key === 'Enter') generateSceneWithAi(); }}
            disabled={isGeneratingAi}
          />
        </div>
        <button
          type="button"
          class="ns-btn-ai-gen"
          onclick={generateSceneWithAi}
          disabled={isGeneratingAi}
        >
          {#if isGeneratingAi}
            ⏳ Écriture IA en cours…
          {:else}
            ✨ Générer la Scène (IA)
          {/if}
        </button>
      </div>
    </div>

    <!-- Navigation Onglets -->
    <div class="ns-tabs">
      <button
        type="button"
        class="ns-tab-btn"
        class:active={activeTab === 'staged'}
        onclick={() => { parseAndLoadSegments(); activeTab = 'staged'; }}
      >
        🎭 Régie des Voix & Acteurs ({segments.length} répliques)
      </button>
      <button
        type="button"
        class="ns-tab-btn"
        class:active={activeTab === 'raw_text'}
        onclick={() => activeTab = 'raw_text'}
      >
        📝 Texte Brut & Scénario
      </button>
    </div>

    <!-- Corps Principal -->
    <div class="ns-body">
      {#if activeTab === 'staged'}
        <!-- Vue Régie Multi-Voix -->
        <div class="ns-segments-list">
          {#if segments.length === 0}
            <div class="ns-empty-state">
              <span style="font-size: 36px">📜</span>
              <p>Aucun dialogue ni narration détecté.</p>
              <button class="ns-btn-secondary" onclick={() => loadPreset(PRESET_SCENES[0].text)}>
                Charger un exemple de scène
              </button>
            </div>
          {:else}
            {#each segments as seg, idx (idx)}
              {@const isSpeakingNow = ttsReader.isPlaying && ttsReader.currentSentenceIndex === idx}
              <div
                class="ns-segment-card"
                class:speaking={isSpeakingNow}
                class:is-dialogue={seg.isDialogue}
              >
                <!-- Barre supérieure du segment -->
                <div class="ns-seg-top">
                  <div class="ns-seg-speaker-block">
                    <span class="ns-speaker-emoji">{seg.voiceEmoji || '🧙‍♂️'}</span>
                    <input
                      type="text"
                      class="ns-speaker-name-input"
                      bind:value={seg.speakerName}
                      placeholder="Nom de l'orateur"
                    />
                    <span class="ns-seg-type-pill" class:dlg={seg.isDialogue}>
                      {seg.isDialogue ? 'Dialogue PNJ' : 'Narration'}
                    </span>
                  </div>

                  <div class="ns-seg-voice-select-wrap">
                    <label class="ns-voice-label">Voix IA :</label>
                    <select
                      class="ns-voice-select"
                      value={seg.voiceId}
                      onchange={(e) => updateSegmentVoice(idx, (e.target as HTMLSelectElement).value)}
                    >
                      {#each NEURAL_VOICES as nv}
                        <option value={nv.id}>{nv.name}</option>
                      {/each}
                    </select>

                    <button
                      type="button"
                      class="ns-btn-preview-voice"
                      onclick={() => handlePlaySingle(seg)}
                      title="Écouter cette réplique seule"
                    >
                      🔊 Test
                    </button>
                    <button
                      type="button"
                      class="ns-btn-del-seg"
                      onclick={() => removeSegment(idx)}
                      title="Supprimer cette réplique"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                <!-- Texte de la réplique -->
                <textarea
                  class="ns-seg-textarea"
                  bind:value={seg.text}
                  rows={Math.max(2, Math.ceil(seg.text.length / 80))}
                  placeholder="Texte de la réplique ou narration..."
                ></textarea>
              </div>
            {/each}

            <div style="display:flex; justify-content:center; padding: 12px 0;">
              <button type="button" class="ns-btn-add-line" onclick={addEmptySegment}>
                ➕ Ajouter une réplique / narration
              </button>
            </div>
          {/if}
        </div>
      {:else}
        <!-- Vue Texte Brut / Éditeur -->
        <div class="ns-raw-editor-wrap">
          <p class="ns-hint-box">
            💡 <strong>Astuce :</strong> Écrivez votre texte librement. Pour assigner des voix automatiquement, écrivez <code>Nom : « Réplique »</code> ou utilisez des guillemets français <code>« »</code> ou anglais <code>" "</code>.
          </p>
          <textarea
            class="ns-raw-textarea"
            bind:value={rawSourceText}
            placeholder="Tapez ou collez votre scénario ici..."
          ></textarea>
          <div class="ns-raw-actions">
            <button
              type="button"
              class="ns-btn-primary"
              onclick={() => { parseAndLoadSegments(); activeTab = 'staged'; }}
            >
              ✨ Analyser & Répartir les Voix Multi-Acteurs
            </button>
          </div>
        </div>
      {/if}
    </div>

    <!-- Barre de Contrôle Audio Flottante (Sticky Footer) -->
    <div class="ns-footer">
      <div class="ns-footer-status">
        {#if ttsReader.isPlaying}
          <div class="ns-playing-pulse">
            <span class="ns-pulse-dot"></span>
            <span class="ns-now-speaker">
              {ttsReader.currentSpeakerEmoji} {ttsReader.currentSpeakerName}
            </span>
            <span class="ns-progress-count">
              (Réplique {ttsReader.currentSentenceIndex + 1} / {segments.length})
            </span>
          </div>
        {:else}
          <span class="ns-idle-status">⚪ Studio prêt · {segments.length} répliques</span>
        {/if}
      </div>

      <div class="ns-footer-controls">
        <!-- Vitesse -->
        <div class="ns-rate-picker">
          <span class="ns-label-dim">Vitesse :</span>
          <button
            type="button"
            class="ns-rate-btn"
            class:active={playbackRate === 0.85}
            onclick={() => handleRateChange(0.85)}
          >0.85x</button>
          <button
            type="button"
            class="ns-rate-btn"
            class:active={playbackRate === 1.0}
            onclick={() => handleRateChange(1.0)}
          >1.0x</button>
          <button
            type="button"
            class="ns-rate-btn"
            class:active={playbackRate === 1.15}
            onclick={() => handleRateChange(1.15)}
          >1.15x</button>
        </div>

        <!-- Bouton Principal Lecture -->
        <button
          type="button"
          class="ns-btn-play-master"
          class:playing={ttsReader.isPlaying}
          onclick={handlePlayAll}
        >
          {#if ttsReader.isPlaying}
            {#if ttsReader.isPaused}
              ▶️ Reprendre
            {:else}
              ⏸️ Pause
            {/if}
          {:else}
            ▶️ Lancer la Narration Multi-Voix
          {/if}
        </button>

        {#if ttsReader.isPlaying}
          <button type="button" class="ns-btn-stop" onclick={handleStop} title="Arrêter la lecture">
            ⏹️ Stop
          </button>
        {/if}

        <div class="ns-sep-vertical"></div>

        <!-- Outils secondaires -->
        <button
          type="button"
          class="ns-btn-tool"
          onclick={broadcastNarrationToPlayers}
          title="Envoyer le texte aux smartphones des joueurs (Hub Mobile)"
        >
          📱 Diffuser aux Joueurs
        </button>
        <button
          type="button"
          class="ns-btn-tool"
          onclick={copyFormattedText}
          title="Copier le texte formaté"
        >
          📋 Copier
        </button>
      </div>
    </div>
  </div>
</div>

<style>
  .ns-overlay {
    position: fixed;
    inset: 0;
    z-index: 9999;
    background: rgba(0, 0, 0, 0.78);
    backdrop-filter: blur(6px);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    animation: nsFadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  }

  @keyframes nsFadeIn {
    from { opacity: 0; transform: scale(0.98); }
    to { opacity: 1; transform: scale(1); }
  }

  .ns-card {
    background: #11141c;
    border: 1px solid rgba(229, 168, 83, 0.35);
    border-radius: 16px;
    width: 100%;
    max-width: 960px;
    height: 88vh;
    max-height: 820px;
    display: flex;
    flex-direction: column;
    box-shadow: 0 24px 64px rgba(0, 0, 0, 0.7), 0 0 40px rgba(229, 168, 83, 0.08);
    overflow: hidden;
  }

  /* ── Header ── */
  .ns-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 20px;
    background: linear-gradient(180deg, rgba(229, 168, 83, 0.08) 0%, rgba(17, 20, 28, 0.95) 100%);
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .ns-header-left {
    display: flex;
    align-items: center;
    gap: 14px;
  }

  .ns-icon {
    font-size: 32px;
    line-height: 1;
    filter: drop-shadow(0 0 8px rgba(229, 168, 83, 0.5));
  }

  .ns-title-row {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .ns-title {
    margin: 0;
    font-size: 19px;
    font-weight: 800;
    color: #e5a853;
    letter-spacing: -0.01em;
  }

  .ns-badge {
    font-size: 10px;
    font-weight: 700;
    padding: 2px 8px;
    border-radius: 6px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .ns-badge.neural {
    background: rgba(99, 102, 241, 0.2);
    border: 1px solid rgba(99, 102, 241, 0.5);
    color: #a5b4fc;
  }

  .ns-badge.auto-ducking {
    background: rgba(34, 197, 94, 0.15);
    border: 1px solid rgba(34, 197, 94, 0.4);
    color: #86efac;
  }

  .ns-subtitle {
    margin: 3px 0 0 0;
    font-size: 12px;
    color: #94a3b8;
  }

  .ns-btn-close {
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 8px;
    color: #94a3b8;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 15px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .ns-btn-close:hover {
    background: rgba(239, 68, 68, 0.2);
    border-color: rgba(239, 68, 68, 0.5);
    color: #ef4444;
  }

  /* ── Barre IA & Presets ── */
  .ns-ai-bar {
    padding: 12px 20px;
    background: rgba(0, 0, 0, 0.25);
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .ns-presets-row {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .ns-label-dim {
    font-size: 11px;
    color: #64748b;
    font-weight: 600;
  }

  .ns-preset-btn {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #cbd5e1;
    font-size: 11px;
    font-weight: 600;
    padding: 4px 10px;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .ns-preset-btn:hover {
    background: rgba(229, 168, 83, 0.15);
    border-color: rgba(229, 168, 83, 0.4);
    color: #e5a853;
  }

  .ns-generator-row {
    display: flex;
    gap: 8px;
  }

  .ns-ai-input-wrap {
    flex: 1;
    position: relative;
    display: flex;
    align-items: center;
  }

  .ns-ai-spark {
    position: absolute;
    left: 10px;
    font-size: 14px;
    pointer-events: none;
  }

  .ns-ai-input {
    width: 100%;
    padding: 8px 12px 8px 32px;
    background: rgba(0, 0, 0, 0.4);
    border: 1px solid rgba(99, 102, 241, 0.35);
    border-radius: 8px;
    color: #e2e8f0;
    font-size: 12px;
    outline: none;
    transition: border-color 0.2s;
  }

  .ns-ai-input:focus {
    border-color: #818cf8;
    box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.2);
  }

  .ns-btn-ai-gen {
    background: linear-gradient(135deg, rgba(99, 102, 241, 0.35) 0%, rgba(139, 92, 246, 0.35) 100%);
    border: 1px solid rgba(139, 92, 246, 0.5);
    color: #c4b5fd;
    font-size: 12px;
    font-weight: 700;
    padding: 0 16px;
    border-radius: 8px;
    cursor: pointer;
    white-space: nowrap;
    transition: all 0.2s;
  }

  .ns-btn-ai-gen:hover:not(:disabled) {
    background: linear-gradient(135deg, rgba(99, 102, 241, 0.55) 0%, rgba(139, 92, 246, 0.55) 100%);
    color: #fff;
    transform: translateY(-1px);
  }

  .ns-btn-ai-gen:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  /* ── Onglets ── */
  .ns-tabs {
    display: flex;
    background: rgba(0, 0, 0, 0.3);
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    padding: 0 20px;
    gap: 6px;
  }

  .ns-tab-btn {
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    color: #94a3b8;
    font-size: 13px;
    font-weight: 600;
    padding: 10px 16px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .ns-tab-btn:hover {
    color: #e2e8f0;
  }

  .ns-tab-btn.active {
    color: #e5a853;
    border-bottom-color: #e5a853;
  }

  /* ── Corps défilant ── */
  .ns-body {
    flex: 1;
    overflow-y: auto;
    padding: 16px 20px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  /* ── Régie Multi-Voix ── */
  .ns-segments-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .ns-segment-card {
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 10px;
    padding: 10px 14px;
    transition: all 0.2s ease;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .ns-segment-card.is-dialogue {
    background: rgba(229, 168, 83, 0.03);
    border-left: 3px solid #e5a853;
  }

  .ns-segment-card.speaking {
    background: rgba(229, 168, 83, 0.12);
    border: 1px solid #e5a853;
    box-shadow: 0 0 16px rgba(229, 168, 83, 0.25);
    transform: scale(1.005);
  }

  .ns-seg-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }

  .ns-seg-speaker-block {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;
    min-width: 220px;
  }

  .ns-speaker-emoji {
    font-size: 18px;
  }

  .ns-speaker-name-input {
    background: transparent;
    border: 1px solid transparent;
    border-radius: 6px;
    color: #f1f5f9;
    font-size: 13px;
    font-weight: 700;
    padding: 2px 6px;
    outline: none;
    transition: all 0.15s;
    width: 140px;
  }

  .ns-speaker-name-input:hover, .ns-speaker-name-input:focus {
    background: rgba(0, 0, 0, 0.3);
    border-color: rgba(255, 255, 255, 0.15);
  }

  .ns-seg-type-pill {
    font-size: 10px;
    font-weight: 700;
    padding: 2px 6px;
    border-radius: 4px;
    background: rgba(148, 163, 184, 0.12);
    color: #94a3b8;
  }

  .ns-seg-type-pill.dlg {
    background: rgba(229, 168, 83, 0.15);
    color: #e5a853;
  }

  .ns-seg-voice-select-wrap {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .ns-voice-label {
    font-size: 11px;
    color: #64748b;
  }

  .ns-voice-select {
    background: #0d1017;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 6px;
    color: #e2e8f0;
    font-size: 11px;
    padding: 4px 8px;
    outline: none;
    cursor: pointer;
  }

  .ns-btn-preview-voice {
    background: rgba(99, 102, 241, 0.15);
    border: 1px solid rgba(99, 102, 241, 0.35);
    color: #a5b4fc;
    font-size: 11px;
    font-weight: 600;
    padding: 3px 8px;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .ns-btn-preview-voice:hover {
    background: rgba(99, 102, 241, 0.3);
    color: #fff;
  }

  .ns-btn-del-seg {
    background: none;
    border: none;
    color: #64748b;
    font-size: 13px;
    cursor: pointer;
    padding: 2px 6px;
    border-radius: 4px;
    transition: all 0.15s;
  }

  .ns-btn-del-seg:hover {
    color: #ef4444;
    background: rgba(239, 68, 68, 0.12);
  }

  .ns-seg-textarea {
    width: 100%;
    background: rgba(0, 0, 0, 0.25);
    border: 1px solid rgba(255, 255, 255, 0.05);
    border-radius: 6px;
    color: #e2e8f0;
    font-size: 13px;
    line-height: 1.5;
    padding: 8px 10px;
    resize: vertical;
    outline: none;
    box-sizing: border-box;
    font-family: inherit;
    transition: border-color 0.15s;
  }

  .ns-seg-textarea:focus {
    border-color: rgba(229, 168, 83, 0.4);
    background: rgba(0, 0, 0, 0.4);
  }

  .ns-btn-add-line {
    background: rgba(255, 255, 255, 0.04);
    border: 1px dashed rgba(255, 255, 255, 0.2);
    border-radius: 8px;
    color: #94a3b8;
    font-size: 12px;
    font-weight: 600;
    padding: 8px 18px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .ns-btn-add-line:hover {
    background: rgba(229, 168, 83, 0.08);
    border-color: #e5a853;
    color: #e5a853;
  }

  /* ── Éditeur Texte Brut ── */
  .ns-raw-editor-wrap {
    display: flex;
    flex-direction: column;
    gap: 10px;
    height: 100%;
  }

  .ns-hint-box {
    margin: 0;
    padding: 8px 12px;
    background: rgba(229, 168, 83, 0.08);
    border: 1px solid rgba(229, 168, 83, 0.25);
    border-radius: 8px;
    color: #cbd5e1;
    font-size: 12px;
  }

  .ns-hint-box code {
    background: rgba(0, 0, 0, 0.4);
    padding: 2px 5px;
    border-radius: 4px;
    color: #e5a853;
    font-size: 11px;
  }

  .ns-raw-textarea {
    flex: 1;
    min-height: 380px;
    background: #0d1017;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    color: #f1f5f9;
    font-size: 13px;
    line-height: 1.6;
    padding: 12px;
    resize: none;
    outline: none;
    font-family: inherit;
    box-sizing: border-box;
  }

  .ns-raw-actions {
    display: flex;
    justify-content: flex-end;
  }

  .ns-btn-primary {
    background: linear-gradient(135deg, #e5a853 0%, #d48b28 100%);
    border: none;
    border-radius: 8px;
    color: #000;
    font-size: 13px;
    font-weight: 800;
    padding: 10px 20px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .ns-btn-primary:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(229, 168, 83, 0.35);
  }

  /* ── Pied de Page Fixe / Contrôles ── */
  .ns-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 20px;
    background: #0d1017;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    gap: 16px;
    flex-wrap: wrap;
  }

  .ns-footer-status {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 240px;
  }

  .ns-idle-status {
    font-size: 12px;
    color: #64748b;
  }

  .ns-playing-pulse {
    display: flex;
    align-items: center;
    gap: 8px;
    background: rgba(229, 168, 83, 0.12);
    border: 1px solid rgba(229, 168, 83, 0.3);
    padding: 4px 10px;
    border-radius: 20px;
  }

  .ns-pulse-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #e5a853;
    animation: nsBlink 1s infinite alternate ease-in-out;
  }

  @keyframes nsBlink {
    from { opacity: 0.3; transform: scale(0.8); }
    to { opacity: 1; transform: scale(1.2); }
  }

  .ns-now-speaker {
    font-size: 12px;
    font-weight: 700;
    color: #e5a853;
  }

  .ns-progress-count {
    font-size: 11px;
    color: #94a3b8;
  }

  .ns-footer-controls {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .ns-rate-picker {
    display: flex;
    align-items: center;
    gap: 4px;
    background: rgba(255, 255, 255, 0.03);
    padding: 3px 6px;
    border-radius: 6px;
    border: 1px solid rgba(255, 255, 255, 0.06);
  }

  .ns-rate-btn {
    background: none;
    border: none;
    color: #94a3b8;
    font-size: 11px;
    font-weight: 600;
    padding: 2px 6px;
    border-radius: 4px;
    cursor: pointer;
  }

  .ns-rate-btn.active {
    background: rgba(229, 168, 83, 0.2);
    color: #e5a853;
  }

  .ns-btn-play-master {
    background: linear-gradient(135deg, #e5a853 0%, #d48b28 100%);
    border: none;
    border-radius: 8px;
    color: #000;
    font-size: 13px;
    font-weight: 800;
    padding: 9px 18px;
    cursor: pointer;
    transition: all 0.15s;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .ns-btn-play-master:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 14px rgba(229, 168, 83, 0.4);
  }

  .ns-btn-play-master.playing {
    background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
  }

  .ns-btn-stop {
    background: rgba(239, 68, 68, 0.15);
    border: 1px solid rgba(239, 68, 68, 0.4);
    color: #fca5a5;
    font-size: 12px;
    font-weight: 700;
    padding: 9px 12px;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .ns-btn-stop:hover {
    background: rgba(239, 68, 68, 0.3);
    color: #fff;
  }

  .ns-sep-vertical {
    width: 1px;
    height: 24px;
    background: rgba(255, 255, 255, 0.12);
    margin: 0 4px;
  }

  .ns-btn-tool {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.12);
    color: #cbd5e1;
    font-size: 12px;
    font-weight: 600;
    padding: 8px 12px;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .ns-btn-tool:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
  }

  .ns-empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px;
    color: #64748b;
    gap: 12px;
  }

  .ns-btn-secondary {
    background: rgba(229, 168, 83, 0.12);
    border: 1px solid rgba(229, 168, 83, 0.35);
    color: #e5a853;
    font-size: 12px;
    font-weight: 700;
    padding: 8px 16px;
    border-radius: 8px;
    cursor: pointer;
  }
</style>

