<script lang="ts">
  import { vttStore, replaceGmToken, removeGmToken, setSpotlightToken, duplicateGmToken, showSpeechBubble, triggerVttProjectile } from '$lib/stores/vtt.svelte';
  import { emitToPlayerView, askOllama } from '$lib/api';
  import { notifStore } from '$lib/stores/notifications.svelte';
  import { getAiModel } from '$lib/stores/settings.svelte';
  import { ttsReader } from '$lib/stores/ttsReader.svelte';
  import { synthesizeNeuralSpeech } from '$lib/services/edgeTts';
  import { computeProjectileTarget } from '$lib/vtt/lighting';

  let { tokenId, x, y, onclose, onEdit, onDelete }: {
    tokenId: string;
    x: number;
    y: number;
    onclose: () => void;
    onEdit?: (token: any) => void;
    onDelete?: (id: string) => void;
  } = $props();

  const token = $derived(vttStore.tokens.find(t => t.id === tokenId));

  let menuWidth = $state(280);
  let menuHeight = $state(520);

  // Ajustement position écran dynamique : ne déborde jamais ni en bas, ni à droite, ni en haut, ni à gauche
  const menuX = $derived.by(() => {
    const winW = typeof window !== 'undefined' ? window.innerWidth : 1200;
    const w = menuWidth || 280;
    return Math.max(10, Math.min(x, winW - w - 12));
  });

  const menuY = $derived.by(() => {
    const winH = typeof window !== 'undefined' ? window.innerHeight : 800;
    const h = menuHeight || 520;
    return Math.max(10, Math.min(y, winH - h - 12));
  });

  function changeHp(delta: number) {
    if (!token) return;
    const cur = token.hp ?? 10;
    const max = token.maxHp ?? 10;
    const nextHp = Math.max(0, Math.min(max * 2, cur + delta));
    replaceGmToken({ ...token, hp: nextHp });
    notifStore.add('❤️', token.name, `PV : ${nextHp}/${max}`, delta > 0 ? 'success' : 'warn', 1500);
  }

  // ── Vision & Portée ──
  function setVisionRange(val: number) {
    if (!token) return;
    replaceGmToken({ ...token, visionRange: val });
    notifStore.add('👁️', token.name, val === 0 ? 'Vision désactivée (Aveugle)' : `Portée de vue : ${val} cases (${val * 5} ft)`, 'info', 1500);
  }

  function setVisionAngle(angle: number) {
    if (!token) return;
    replaceGmToken({ ...token, visionAngle: angle });
    const lbl = angle >= 360 ? '360° (Omni)' : `${angle}° (Cône)`;
    notifStore.add('📐', token.name, `Champ de vision : ${lbl}`, 'info', 1500);
  }

  function setRotation(rot: number) {
    if (!token) return;
    const normalized = (rot % 360 + 360) % 360;
    replaceGmToken({ ...token, rotation: normalized, physicalRotation: normalized });
  }

  function rotateBy(delta: number) {
    if (!token) return;
    const cur = token.rotation ?? token.physicalRotation ?? 0;
    setRotation(cur + delta);
  }

  function toggleDarkvision() {
    if (!token) return;
    const nextVal = !token.darkvision;
    replaceGmToken({ ...token, darkvision: nextVal });
    notifStore.add('🌙', token.name, nextVal ? 'Vision nocturne activée' : 'Vision nocturne désactivée', 'info', 1500);
  }

  function toggleTorch() {
    if (!token) return;
    const isTorchOn = (token.lightRadius ?? 0) > 0;
    if (isTorchOn) {
      replaceGmToken({ ...token, lightRadius: 0, lightFlicker: false });
      notifStore.add('💨', token.name, 'Torche éteinte', 'info', 1500);
    } else {
      replaceGmToken({
        ...token,
        lightRadius: 6,
        lightColor: '#ffaa44',
        lightFlicker: true
      });
      notifStore.add('🔥', token.name, 'Torche allumée (6 cases / 30 ft)', 'success', 1500);
    }
  }

  function toggleVisibility() {
    if (!token) return;
    const nextVis = token.visible === false ? true : false;
    replaceGmToken({ ...token, visible: nextVis });
    notifStore.add('👁️', token.name, nextVis ? 'Révélé aux joueurs (forcé)' : 'Masqué aux joueurs (apparaît en vision PJ)', 'info', 2000);
    onclose();
  }

  function toggleSpotlight() {
    if (!token) return;
    if (vttStore.spotlightTokenId === token.id) {
      setSpotlightToken(null);
    } else {
      setSpotlightToken(token.id);
      notifStore.add('🌟', token.name, 'Mis en lumière (Spotlight)', 'info', 2000);
    }
    onclose();
  }

  function toggleConcentration() {
    if (!token) return;
    replaceGmToken({ ...token, concentrating: !token.concentrating });
    onclose();
  }

  const QUICK_CONDITIONS = [
    { id: 'bleeding', emoji: '🩸', label: 'Saignement' },
    { id: 'poisoned', emoji: '🤢', label: 'Empoisonné' },
    { id: 'stunned',  emoji: '⚡', label: 'Étourdi' },
    { id: 'prone',    emoji: '⬇️', label: 'À terre' },
    { id: 'burning',  emoji: '🔥', label: 'Brûlure' },
    { id: 'blinded',  emoji: '🙈', label: 'Aveuglé' },
  ];

  function toggleCondition(cid: string) {
    if (!token) return;
    const cur = token.conditions ?? [];
    const next = cur.includes(cid) ? cur.filter(c => c !== cid) : [...cur, cid];
    replaceGmToken({ ...token, conditions: next });
  }

  function hasCond(cid: string) {
    return (token?.conditions ?? []).includes(cid);
  }

  let showProjectilesBox = $state(false);

  function fireProjectile(type: 'arrow' | 'fire' | 'magic' | 'lightning') {
    if (!token) return;
    const { toX, toY, targetEnemy, mode } = computeProjectileTarget(token, vttStore.tokens, 450);
    triggerVttProjectile(token.x, token.y, toX, toY, type);

    const typeLabel = type === 'arrow' ? 'Flèche' : type === 'fire' ? 'Boule de feu' : type === 'lightning' ? 'Éclair' : 'Sortilège';
    if (targetEnemy) {
      notifStore.add('🎯', token.name, `${typeLabel} tiré vers ${targetEnemy.name} !`, 'info', 2200);
    } else if (mode === 'fov_direction') {
      const rot = token.rotation ?? token.physicalRotation ?? 0;
      notifStore.add('🏹', token.name, `${typeLabel} tiré dans l'angle de vision (${rot}°) !`, 'info', 2200);
    } else {
      notifStore.add('⚡', token.name, `${typeLabel} lancé !`, 'info', 2000);
    }
    onclose();
  }

  function handleDuplicate(count: number = 1) {
    if (!token) return;
    duplicateGmToken(token.id, count);
    notifStore.add('👥', token.name, `${count} pion${count > 1 ? 's' : ''} dupliqué${count > 1 ? 's' : ''} sur la carte !`, 'success', 2500);
    onclose();
  }

  function handleOpenStudio() {
    vttStore.showTokenEditorModal = true;
    onclose();
  }

  // ── 🎭 Répartie d'Improvisation Immédiate sur PNJ (IA Vocale) ──
  let showImprovBox = $state(false);
  let improvQuestion = $state('');
  let isImprovising = $state(false);

  async function generateAndSpeakNpc(customPrompt?: string) {
    if (!token || isImprovising) return;
    isImprovising = true;
    const q = (customPrompt || improvQuestion).trim() || "Qui es-tu et que fais-tu ici ?";
    notifStore.add('🎭', token.name, 'Improvisation en cours...', 'info', 2000);

    try {
      const prompt = `Tu incarnes le PNJ nommé "${token.name}". Les joueurs te demandent : "${q}". Réponds avec UNE SEULE réplique orale, courte, vivante, immersive et percutante (maximum 20 mots). Pas d'explications hors-rôle.`;
      const model = getAiModel() || '';
      let reply = '';
      try {
        reply = await askOllama(prompt, model, 'Tu es un acteur de jeu de rôle d\'élite. Réponds uniquement par la réplique du personnage entre guillemets.');
      } catch (e) {
        reply = `"Par les dieux ! Que me voulez-vous encore ?"`;
      }

      // Nettoyer la réponse
      let cleanReply = (reply || `"Par les dieux ! Que me voulez-vous encore ?"`)
        .replace(/^["'«\s]+|["'»\s]+$/g, '')
        .trim();

      if (!cleanReply) cleanReply = "Que cherchez-vous dans mes parages ?";

      // Afficher immédiatement la bulle de dialogue sur le token
      showSpeechBubble(token.name, cleanReply, token.id, 6500);
      notifStore.add('🗣️', token.name, cleanReply, 'success', 4000);

      // Synthétiser la parole avec la voix du Narrateur ou PNJ
      const voice = ttsReader.selectedVoiceName || 'fr-FR-HenriNeural';
      const audioUrl = await synthesizeNeuralSpeech(cleanReply, voice, 1.0, 1.0);
      const audio = new Audio(audioUrl);
      audio.play().catch(() => {});

      showImprovBox = false;
      improvQuestion = '';
      onclose();
    } catch (err) {
      console.warn('Erreur improvisation PNJ:', err);
      notifStore.add('⚠️', token.name, 'Échec de la génération vocale', 'warn', 2500);
    } finally {
      isImprovising = false;
    }
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="ctx-backdrop" onclick={onclose}>
  <div 
    class="ctx-menu" 
    bind:clientWidth={menuWidth}
    bind:clientHeight={menuHeight}
    style="left: {menuX}px; top: {menuY}px;" 
    onclick={(e) => e.stopPropagation()}
    role="menu"
    tabindex="-1"
  >
    {#if token}
      <!-- Header avec Nom et Avatar -->
      <div class="ctx-header">
        <div class="ctx-avatar-col">
          {#if token.imageUrl}
            <img src={token.imageUrl} alt={token.name} class="ctx-img" />
          {:else}
            <div class="ctx-avatar-fallback" style="background-color: #{((token.color || 0x3b82f6) & 0xffffff).toString(16).padStart(6, '0')}">
              {token.name.charAt(0).toUpperCase()}
            </div>
          {/if}
        </div>
        <div class="ctx-title-col">
          <span class="ctx-name" title={token.name}>{token.name}</span>
          <span class="ctx-sub">
            {token.isEnemy ? 'Adversaire' : 'Joueur / Allié'} · {token.hp ?? 10}/{token.maxHp ?? 10} PV
          </span>
        </div>
        <button class="ctx-close-btn" onclick={onclose}>✕</button>
      </div>

      <!-- ACTIONS MAJEURES : ÉDITION & MULTIPLICATION -->
      <div class="ctx-section action-highlight-box">
        <div class="primary-actions-row">
          <button class="ctx-big-btn edit" onclick={() => { onEdit?.(token); onclose(); }} title="Modifier le nom, PV, CA, taille et image">
            <span class="btn-icon">✏️</span>
            <span class="btn-txt">Éditer (Fiche)</span>
          </button>
          <button class="ctx-big-btn studio" onclick={handleOpenStudio} title="Personnaliser dans l'Éditeur Studio Grimoire (Bordures, frises, cartouches)">
            <span class="btn-icon">🎨</span>
            <span class="btn-txt">Studio Pions</span>
          </button>
        </div>

        <div class="dupl-box">
          <div class="dupl-header">
            <span class="dupl-label">👥 Multiplier sur la carte :</span>
            <button class="dupl-quick-btn single" onclick={() => handleDuplicate(1)} title="Dupliquer 1 fois (raccourci : Ctrl+D)">
              +1 Copie
            </button>
          </div>
          <div class="dupl-multi-row">
            <button class="multi-btn" onclick={() => handleDuplicate(2)} title="Générer 2 pions">+2</button>
            <button class="multi-btn" onclick={() => handleDuplicate(3)} title="Générer 3 pions">+3</button>
            <button class="multi-btn" onclick={() => handleDuplicate(5)} title="Générer 5 pions">+5</button>
            <button class="multi-btn" onclick={() => handleDuplicate(10)} title="Générer 10 pions">+10</button>
          </div>
        </div>
      </div>

      <!-- Action rapide PV -->
      <div class="ctx-section">
        <div class="ctx-section-label">Ajuster Points de Vie</div>
        <div class="hp-buttons-row">
          <button class="hp-btn dmg" onclick={() => changeHp(-5)} title="-5 PV">-5</button>
          <button class="hp-btn dmg" onclick={() => changeHp(-1)} title="-1 PV">-1</button>
          <button class="hp-btn heal" onclick={() => changeHp(1)} title="+1 PV">+1</button>
          <button class="hp-btn heal" onclick={() => changeHp(5)} title="+5 PV">+5</button>
        </div>
      </div>

      <!-- SECTION : Vision & Champ de Vue -->
      <div class="ctx-section vision-box">
        <div class="ctx-section-header">
          <span class="ctx-section-label">👁️ Portée & Champ de Vue</span>
          <span class="vision-current-badge">
            {token.visionRange ?? 0}c · {token.visionAngle ?? 360}°
          </span>
        </div>

        <!-- 1. Portée de vue -->
        <div class="vision-sub-row">
          <span class="vision-sub-label">Portée : <strong>{(token.visionRange ?? 0) * 5} ft</strong></span>
          <div class="preset-pill-group">
            <button class="pill-btn" class:active={(token.visionRange ?? 0) === 0} onclick={() => setVisionRange(0)} title="Aveugle (0)">0</button>
            <button class="pill-btn" class:active={token.visionRange === 6} onclick={() => setVisionRange(6)} title="Courte (30 ft / 6 cases)">30ft</button>
            <button class="pill-btn" class:active={token.visionRange === 12} onclick={() => setVisionRange(12)} title="Standard (60 ft / 12 cases)">60ft</button>
            <button class="pill-btn" class:active={token.visionRange === 24} onclick={() => setVisionRange(24)} title="Longue (120 ft / 24 cases)">120ft</button>
            <button class="pill-btn" class:active={token.visionRange === 99} onclick={() => setVisionRange(99)} title="Illimité">∞</button>
          </div>
        </div>
        <input 
          type="range" 
          class="vision-range-slider" 
          min="0" 
          max="30" 
          step="1" 
          value={Math.min(30, token.visionRange ?? 0)} 
          oninput={(e) => setVisionRange(Number((e.target as HTMLInputElement).value))} 
        />

        <!-- 2. Angle du Champ de Vue (FOV) -->
        <div class="vision-sub-row">
          <span class="vision-sub-label">Angle cône :</span>
          <div class="preset-pill-group">
            <button class="pill-btn" class:active={(token.visionAngle ?? 360) >= 360} onclick={() => setVisionAngle(360)} title="360° Omnidirectionnel">360°</button>
            <button class="pill-btn" class:active={token.visionAngle === 180} onclick={() => setVisionAngle(180)} title="180° Demi-cercle">180°</button>
            <button class="pill-btn" class:active={token.visionAngle === 120} onclick={() => setVisionAngle(120)} title="120° Humain large">120°</button>
            <button class="pill-btn" class:active={token.visionAngle === 90} onclick={() => setVisionAngle(90)} title="90° Cône tactique">90°</button>
            <button class="pill-btn" class:active={token.visionAngle === 60} onclick={() => setVisionAngle(60)} title="60° Focalisé">60°</button>
          </div>
        </div>

        <!-- 3. Orientation du Regard (Direction) -->
        <div class="vision-sub-row">
          <span class="vision-sub-label">Regard : <strong>{(token.rotation ?? token.physicalRotation ?? 0)}°</strong></span>
          <div class="orient-btn-group">
            <button class="pill-btn dir" onclick={() => rotateBy(-45)} title="Pivoter 45° gauche (↶)">↶</button>
            <button class="pill-btn dir" class:active={(token.rotation ?? 0) === 0} onclick={() => setRotation(0)} title="Nord (Haut)">▲ N</button>
            <button class="pill-btn dir" class:active={(token.rotation ?? 0) === 90} onclick={() => setRotation(90)} title="Est (Droite)">▶ E</button>
            <button class="pill-btn dir" class:active={(token.rotation ?? 0) === 180} onclick={() => setRotation(180)} title="Sud (Bas)">▼ S</button>
            <button class="pill-btn dir" class:active={(token.rotation ?? 0) === 270} onclick={() => setRotation(270)} title="Ouest (Gauche)">◀ O</button>
            <button class="pill-btn dir" onclick={() => rotateBy(45)} title="Pivoter 45° droite (↷)">↷</button>
          </div>
        </div>

        <!-- 4. Toggles Rapides Lumière & Pénombre -->
        <div class="vision-toggles-row">
          <button 
            class="vision-toggle-chip" 
            class:active={token.darkvision}
            onclick={toggleDarkvision}
            title="Vision dans le noir (halo bleuté nocturne)"
          >
            <span>🌙</span>
            <span>Vision Noire</span>
          </button>
          <button 
            class="vision-toggle-chip" 
            class:active={(token.lightRadius ?? 0) > 0}
            onclick={toggleTorch}
            title="Porter une torche allumée (30 ft / 6 cases)"
          >
            <span>🔥</span>
            <span>{(token.lightRadius ?? 0) > 0 ? 'Torche ON' : 'Torche'}</span>
          </button>
        </div>
      </div>

      <!-- Actions Principales -->
      <div class="ctx-list">
        <!-- 🎭 Improvisation Vocale Immédiate -->
        <button 
          class="ctx-item ai-speak-btn"
          class:active-item={showImprovBox}
          onclick={() => showImprovBox = !showImprovBox}
          title="Faire parler ce PNJ immédiatement avec l'IA et une bulle de dialogue sur la carte"
        >
          <span class="item-icon">🎭</span>
          <span>Faire parler ce PNJ (IA Vocale)</span>
        </button>

        {#if showImprovBox}
          <div class="improv-box">
            <input 
              class="improv-input" 
              type="text" 
              bind:value={improvQuestion} 
              placeholder="Question des PJ ou situation..."
              onkeydown={(e) => e.key === 'Enter' && generateAndSpeakNpc()}
            />
            <div class="improv-actions">
              <button class="improv-quick-btn" onclick={() => generateAndSpeakNpc("Qui es-tu et que fais-tu ici ?")} title="Répartie spontanée">
                🎲 Spontané
              </button>
              <button class="improv-quick-btn" onclick={() => generateAndSpeakNpc("Une menace approche, que dis-tu ?")} title="Alerte">
                ⚠️ Alerte
              </button>
              <button 
                class="improv-confirm-btn" 
                onclick={() => generateAndSpeakNpc()}
                disabled={isImprovising}
              >
                {isImprovising ? '⏳ Parole…' : '🎙️ Parler !'}
              </button>
            </div>
          </div>
        {/if}

        <!-- ⚡ FX Projectile & Sort -->
        <button 
          class="ctx-item"
          class:active-item={showProjectilesBox}
          onclick={() => showProjectilesBox = !showProjectilesBox}
          title="Tirer un projectile magique ou une flèche animée vers une cible"
        >
          <span class="item-icon">⚡</span>
          <span>Tirer Projectile / Sort</span>
        </button>

        {#if showProjectilesBox}
          <div class="improv-box" style="gap: 5px;">
            <div style="font-size: 10.5px; color: var(--accent); font-weight: 700; text-transform: uppercase;">Type de projectile :</div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px;">
              <button class="improv-quick-btn" onclick={() => fireProjectile('arrow')} title="Tir à l'arc">🏹 Flèche</button>
              <button class="improv-quick-btn" onclick={() => fireProjectile('fire')} title="Boule de feu">🔥 Feu</button>
              <button class="improv-quick-btn" onclick={() => fireProjectile('lightning')} title="Éclair foudroyant">⚡ Éclair</button>
              <button class="improv-quick-btn" onclick={() => fireProjectile('magic')} title="Projectile arcanique">🔮 Magie</button>
            </div>
          </div>
        {/if}

        <button class="ctx-item primary" onclick={() => { onEdit?.(token); onclose(); }}>
          <span class="item-icon">⚙️</span>
          <span>Modifier le Token (Fiche)</span>
        </button>

        <button class="ctx-item" onclick={toggleVisibility} title={token.visible === false ? 'Rendre visible aux joueurs' : 'Masquer aux joueurs (le pion apparaîtra automatiquement dès qu\'un PJ le verra)'}>
          <span class="item-icon">{token.visible === false ? '👁️' : '🙈'}</span>
          <span>{token.visible === false ? 'Révéler aux joueurs' : 'Masquer (vision PJ auto)'}</span>
        </button>

        <button class="ctx-item" class:active-item={vttStore.spotlightTokenId === token.id} onclick={toggleSpotlight}>
          <span class="item-icon">🌟</span>
          <span>{vttStore.spotlightTokenId === token.id ? 'Désactiver le Spotlight' : 'Mettre en lumière (Spotlight)'}</span>
        </button>

        <button class="ctx-item" class:active-item={token.concentrating} onclick={toggleConcentration}>
          <span class="item-icon">🔮</span>
          <span>{token.concentrating ? 'Arrêter concentration' : 'Canaliser concentration'}</span>
        </button>
      </div>

      <!-- États & Conditions rapides -->
      <div class="ctx-section">
        <div class="ctx-section-label">Conditions Rapides</div>
        <div class="cond-grid">
          {#each QUICK_CONDITIONS as cond}
            <button 
              class="cond-chip" 
              class:selected={hasCond(cond.id)}
              onclick={() => toggleCondition(cond.id)}
              title={cond.label}
            >
              <span>{cond.emoji}</span>
              <span class="cond-text">{cond.label}</span>
            </button>
          {/each}
        </div>
      </div>

      <div class="ctx-divider"></div>

      <!-- Astuce Déplacement -->
      <div class="move-hint-box">
        <span class="hint-icon">💡</span>
        <span class="hint-text"><strong>Déplacer :</strong> Glissez à la souris (clic gauche), ou sélectionnez le pion puis <em>Clic Droit</em> sur la case voulue, ou utilisez les <strong>Flèches du clavier</strong>.</span>
      </div>

      <!-- Supprimer le token -->
      <button class="ctx-item danger" onclick={() => { onDelete?.(token.id); onclose(); }}>
        <span class="item-icon">🗑️</span>
        <span>Retirer ce pion de la carte (Suppr)</span>
      </button>
    {/if}
  </div>
</div>

<style>
  .ctx-backdrop {
    position: fixed;
    inset: 0;
    z-index: 9999;
    background: rgba(0, 0, 0, 0.25);
  }

  .ctx-menu {
    position: fixed;
    width: 280px;
    max-height: calc(100vh - 24px);
    overflow-y: auto;
    background: #0f172a;
    border: 1px solid rgba(245, 158, 11, 0.45);
    border-radius: 12px;
    box-shadow: 0 16px 36px rgba(0, 0, 0, 0.75), 0 0 20px rgba(245, 158, 11, 0.15);
    padding: 10px;
    color: #f8fafc;
    font-family: inherit;
    display: flex;
    flex-direction: column;
    gap: 8px;
    user-select: none;
    animation: popIn 0.12s ease-out;
    scrollbar-width: thin;
    scrollbar-color: rgba(245, 158, 11, 0.3) transparent;
    overscroll-behavior: contain;
    z-index: 10000;
  }

  @keyframes popIn {
    from { opacity: 0; transform: scale(0.95); }
    to { opacity: 1; transform: scale(1); }
  }

  .ctx-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding-bottom: 8px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .ctx-avatar-col {
    flex-shrink: 0;
  }

  .ctx-img {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    object-fit: cover;
    border: 1.5px solid #fbbf24;
  }

  .ctx-avatar-fallback {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 13px;
    color: #fff;
    border: 1.5px solid rgba(255, 255, 255, 0.3);
  }

  .ctx-title-col {
    flex: 1;
    min-width: 0;
  }

  .ctx-name {
    font-size: 13px;
    font-weight: 700;
    color: #fbbf24;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    display: block;
  }

  .ctx-sub {
    font-size: 10px;
    color: #94a3b8;
    display: block;
  }

  .ctx-close-btn {
    background: transparent;
    border: none;
    color: #64748b;
    font-size: 13px;
    cursor: pointer;
    padding: 2px 4px;
    border-radius: 4px;
  }

  .ctx-close-btn:hover {
    color: #f1f5f9;
  }

  .ctx-section {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .ctx-section-label {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    color: #64748b;
    letter-spacing: 0.4px;
  }

  .hp-buttons-row {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 4px;
  }

  .hp-btn {
    padding: 4px 0;
    font-size: 11px;
    font-weight: 700;
    border-radius: 6px;
    border: 1px solid transparent;
    cursor: pointer;
    transition: all 0.12s;
  }

  .hp-btn.dmg {
    background: rgba(239, 68, 68, 0.18);
    border-color: rgba(239, 68, 68, 0.4);
    color: #fca5a5;
  }

  .hp-btn.dmg:hover {
    background: rgba(239, 68, 68, 0.35);
    color: #fff;
  }

  .hp-btn.heal {
    background: rgba(34, 197, 94, 0.18);
    border-color: rgba(34, 197, 94, 0.4);
    color: #86efac;
  }

  .hp-btn.heal:hover {
    background: rgba(34, 197, 94, 0.35);
    color: #fff;
  }

  .ctx-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .ctx-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
    border-radius: 6px;
    border: none;
    background: transparent;
    color: #e2e8f0;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    text-align: left;
    transition: background 0.12s, color 0.12s;
  }

  .ctx-item:hover {
    background: rgba(255, 255, 255, 0.08);
    color: #fff;
  }

  .ctx-item.primary {
    background: rgba(245, 158, 11, 0.15);
    color: #fef08a;
    font-weight: 600;
  }

  .ctx-item.ai-speak-btn {
    background: linear-gradient(135deg, rgba(168, 85, 247, 0.25), rgba(59, 130, 246, 0.25));
    border: 1px solid rgba(168, 85, 247, 0.5);
    color: #e9d5ff;
    font-weight: 700;
  }

  .ctx-item.ai-speak-btn:hover {
    background: linear-gradient(135deg, rgba(168, 85, 247, 0.4), rgba(59, 130, 246, 0.4));
    box-shadow: 0 0 12px rgba(168, 85, 247, 0.35);
  }

  .improv-box {
    background: rgba(15, 23, 42, 0.8);
    border: 1px solid rgba(168, 85, 247, 0.4);
    border-radius: 8px;
    padding: 8px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-bottom: 4px;
    animation: popIn 0.15s ease-out;
  }

  .improv-input {
    background: #020617;
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 6px;
    padding: 6px 8px;
    color: #f8fafc;
    font-size: 11px;
    outline: none;
  }

  .improv-input:focus {
    border-color: #a855f7;
    box-shadow: 0 0 8px rgba(168, 85, 247, 0.3);
  }

  .improv-actions {
    display: flex;
    gap: 4px;
  }

  .improv-quick-btn {
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.15);
    color: #cbd5e1;
    font-size: 10px;
    border-radius: 4px;
    padding: 3px 6px;
    cursor: pointer;
    flex: 1;
    white-space: nowrap;
    transition: all 0.12s;
  }

  .improv-quick-btn:hover {
    background: rgba(255, 255, 255, 0.18);
    color: #fff;
  }

  .improv-confirm-btn {
    background: #a855f7;
    border: none;
    color: #fff;
    font-weight: 700;
    font-size: 11px;
    border-radius: 4px;
    padding: 3px 8px;
    cursor: pointer;
    transition: background 0.15s;
  }

  .improv-confirm-btn:hover:not(:disabled) {
    background: #9333ea;
  }

  .improv-confirm-btn:disabled {
    opacity: 0.6;
    cursor: wait;
  }

  .ctx-item.primary:hover {
    background: rgba(245, 158, 11, 0.3);
  }

  .ctx-item.active-item {
    background: rgba(59, 130, 246, 0.2);
    color: #93c5fd;
  }

  .ctx-item.danger {
    color: #f87171;
  }

  .ctx-item.danger:hover {
    background: rgba(239, 68, 68, 0.2);
    color: #fca5a5;
  }

  .item-icon {
    font-size: 14px;
    width: 16px;
    display: inline-flex;
    justify-content: center;
  }

  .cond-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 4px;
  }

  .cond-chip {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 3px 6px;
    font-size: 10px;
    border-radius: 6px;
    background: rgba(30, 41, 59, 0.6);
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: #94a3b8;
    cursor: pointer;
    transition: all 0.12s;
  }

  .cond-chip:hover {
    background: rgba(51, 65, 85, 0.8);
    color: #f1f5f9;
  }

  .cond-chip.selected {
    background: rgba(168, 85, 247, 0.25);
    border-color: #a855f7;
    color: #e9d5ff;
    font-weight: 700;
  }

  .cond-text {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .ctx-divider {
    height: 1px;
    background: rgba(255, 255, 255, 0.08);
    margin: 2px 0;
  }

  /* ── Styles Vision & Champ de Vue ── */
  .vision-box {
    background: rgba(15, 23, 42, 0.65);
    border: 1px solid rgba(56, 189, 248, 0.2);
    border-radius: 8px;
    padding: 7px;
    gap: 6px;
  }

  .ctx-section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .vision-current-badge {
    font-size: 10px;
    font-weight: 700;
    color: #38bdf8;
    background: rgba(56, 189, 248, 0.12);
    padding: 1px 6px;
    border-radius: 9999px;
    border: 1px solid rgba(56, 189, 248, 0.3);
  }

  .vision-sub-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 4px;
    font-size: 10px;
    color: #94a3b8;
  }

  .vision-sub-label strong {
    color: #f1f5f9;
  }

  .preset-pill-group {
    display: flex;
    gap: 2px;
  }

  .pill-btn {
    background: rgba(30, 41, 59, 0.8);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #cbd5e1;
    font-size: 9px;
    font-weight: 600;
    padding: 2px 5px;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.1s;
    line-height: 1.2;
  }

  .pill-btn:hover {
    background: rgba(56, 189, 248, 0.2);
    color: #fff;
    border-color: rgba(56, 189, 248, 0.4);
  }

  .pill-btn.active {
    background: #0284c7;
    color: #fff;
    border-color: #38bdf8;
    font-weight: 700;
    box-shadow: 0 0 6px rgba(56, 189, 248, 0.4);
  }

  .vision-range-slider {
    width: 100%;
    height: 4px;
    accent-color: #38bdf8;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 2px;
    cursor: pointer;
    margin: 1px 0;
  }

  .orient-btn-group {
    display: flex;
    gap: 2px;
  }

  .pill-btn.dir {
    font-size: 9px;
    padding: 2px 4px;
  }

  .vision-toggles-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 4px;
    margin-top: 2px;
  }

  .vision-toggle-chip {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    padding: 4px 6px;
    font-size: 10px;
    font-weight: 600;
    border-radius: 6px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(30, 41, 59, 0.7);
    color: #cbd5e1;
    cursor: pointer;
    transition: all 0.12s;
  }

  .vision-toggle-chip:hover {
    background: rgba(51, 65, 85, 0.9);
    color: #fff;
  }

  .vision-toggle-chip.active {
    background: rgba(245, 158, 11, 0.22);
    border-color: #f59e0b;
    color: #fde68a;
    font-weight: 700;
    box-shadow: 0 0 8px rgba(245, 158, 11, 0.25);
  }

  /* Actions Majeures & Duplication */
  .action-highlight-box {
    background: rgba(30, 41, 59, 0.6);
    border: 1px solid rgba(245, 158, 11, 0.25);
    border-radius: 8px;
    padding: 8px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .primary-actions-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
  }

  .ctx-big-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 8px 6px;
    border-radius: 6px;
    font-size: 11px;
    font-weight: 700;
    cursor: pointer;
    border: 1px solid transparent;
    transition: all 0.15s ease;
  }

  .ctx-big-btn.edit {
    background: #1e293b;
    border-color: rgba(59, 130, 246, 0.5);
    color: #60a5fa;
  }

  .ctx-big-btn.edit:hover {
    background: rgba(59, 130, 246, 0.2);
    border-color: #60a5fa;
    color: #fff;
  }

  .ctx-big-btn.studio {
    background: #1e293b;
    border-color: rgba(245, 158, 11, 0.5);
    color: #fbbf24;
  }

  .ctx-big-btn.studio:hover {
    background: rgba(245, 158, 11, 0.2);
    border-color: #fbbf24;
    color: #fff;
  }

  .dupl-box {
    background: rgba(15, 23, 42, 0.6);
    border: 1px dashed rgba(245, 158, 11, 0.35);
    border-radius: 6px;
    padding: 6px 8px;
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  .dupl-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .dupl-label {
    font-size: 10px;
    font-weight: 700;
    color: #e2e8f0;
  }

  .dupl-quick-btn {
    font-size: 10px;
    font-weight: 700;
    background: #d97706;
    color: #fff;
    border: none;
    border-radius: 4px;
    padding: 2px 7px;
    cursor: pointer;
    transition: background 0.15s;
  }

  .dupl-quick-btn:hover {
    background: #b45309;
  }

  .dupl-multi-row {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 4px;
  }

  .multi-btn {
    background: rgba(51, 65, 85, 0.7);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #f8fafc;
    border-radius: 4px;
    padding: 4px 2px;
    font-size: 11px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.12s;
  }

  .multi-btn:hover {
    background: #3b82f6;
    border-color: #60a5fa;
    color: #fff;
  }

  .move-hint-box {
    display: flex;
    align-items: flex-start;
    gap: 6px;
    background: rgba(15, 23, 42, 0.5);
    border-left: 2px solid #38bdf8;
    padding: 6px 8px;
    border-radius: 4px;
    font-size: 10px;
    line-height: 1.35;
    color: #94a3b8;
  }

  .move-hint-box strong {
    color: #38bdf8;
  }

  .move-hint-box em {
    color: #e2e8f0;
    font-style: normal;
    text-decoration: underline;
  }
</style>

