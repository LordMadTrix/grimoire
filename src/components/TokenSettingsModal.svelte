<script lang="ts">
  import type { Token } from '$lib/stores/vtt.svelte';
  import { getVaultTree, getVaultPath } from '$lib/stores/vault.svelte';
  import { getArucoDataUrl } from '$lib/vtt/arucoGenerator';
  import { readFileBase64 } from '$lib/api';

  const CONDITIONS = [
    { id: 'poisoned',   emoji: '🤢', label: 'Empoisonné' },
    { id: 'stunned',    emoji: '⚡', label: 'Étourdi' },
    { id: 'bleeding',   emoji: '🩸', label: 'Saignement' },
    { id: 'burning',    emoji: '🔥', label: 'Brûlure' },
    { id: 'frozen',     emoji: '❄️', label: 'Gelé' },
    { id: 'frightened', emoji: '😱', label: 'Apeuré' },
    { id: 'charmed',    emoji: '💫', label: 'Charmé' },
    { id: 'invisible',  emoji: '👻', label: 'Invisible' },
    { id: 'prone',      emoji: '⬇️', label: 'À terre' },
    { id: 'silenced',   emoji: '🔇', label: 'Silencieux' },
    { id: 'blinded',    emoji: '🙈', label: 'Aveuglé' },
    { id: 'dead',       emoji: '💀', label: 'Mort' },
  ];

  type TabId = 'general' | 'appearance' | 'vision' | 'conditions' | 'notes';

  let { token, onClose, onSave, onDelete }: {
    token: Token | null;
    onClose: () => void;
    onSave: (updatedToken: Token) => void;
    onDelete: (id: string) => void;
  } = $props();

  let activeTab = $state<TabId>('general');
  let editToken = $state<Token | null>(null);
  let colorHex = $state('#3b82f6');
  let auraColorHex = $state('#3b82f6');
  let availableImages = $state<{name: string, path: string}[]>([]);
  let previewUrl = $state<string>('');

  let hpPercent = $derived(
    Math.max(0, Math.min(100, Math.round(((editToken?.hp ?? 0) / Math.max(1, (editToken?.maxHp ?? 10))) * 100)))
  );

  // Initialisation à chaque token sélectionné
  $effect(() => {
    const t = token;
    if (t?.id !== editToken?.id) {
      if (t) {
        editToken = { ...t };
        colorHex = pixiToHex(t.color ?? 0x3b82f6);
        auraColorHex = pixiToHex(t.auraColor ?? 0x3b82f6);
      } else {
        editToken = null;
      }
    }
  });

  // Aperçu dynamique du portrait
  $effect(() => {
    const imgPath = editToken?.imageUrl;
    if (!imgPath) {
      previewUrl = '';
      return;
    }
    if (imgPath.startsWith('data:') || imgPath.startsWith('http') || imgPath.startsWith('/')) {
      previewUrl = imgPath;
      return;
    }
    const vp = getVaultPath();
    if (vp) {
      const fullPath = vp + '/' + imgPath;
      readFileBase64(fullPath).then(b64 => {
        let mime = 'image/png';
        if (b64.startsWith('/9j/')) mime = 'image/jpeg';
        else if (b64.startsWith('iVBORw')) mime = 'image/png';
        else if (b64.startsWith('R0lGOD')) mime = 'image/gif';
        else if (b64.startsWith('UklGR')) mime = 'image/webp';
        previewUrl = `data:${mime};base64,${b64}`;
      }).catch(() => {
        previewUrl = '';
      });
    }
  });

  // Liste des images du vault
  $effect(() => {
    const tree = getVaultTree();
    const images: {name: string, path: string}[] = [];
    function traverse(nodes: any[], parent = '') {
      if (!nodes) return;
      for (const n of nodes) {
        const fullPath = parent ? `${parent}/${n.name}` : n.name;
        if (n.is_dir) {
          traverse(n.children, fullPath);
        } else {
          const ext = n.name.split('.').pop()?.toLowerCase();
          if (ext && ['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext)) {
            images.push({ name: n.name, path: fullPath });
          }
        }
      }
    }
    traverse(tree);
    availableImages = images.sort((a, b) => a.path.localeCompare(b.path));
  });

  // Grouper les images par dossier
  let groupedImages = $derived((() => {
    const groups = new Map<string, {name: string, path: string}[]>();
    for (const img of availableImages) {
      const parts = img.path.split('/');
      const folder = parts.length > 1 ? parts.slice(0, -1).join('/') : '';
      if (!groups.has(folder)) groups.set(folder, []);
      groups.get(folder)!.push(img);
    }
    return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  })());

  function pixiToHex(num: number): string {
    return '#' + num.toString(16).padStart(6, '0');
  }

  function hexToPixi(hex: string): number {
    return parseInt(hex.slice(1), 16);
  }

  function handleColorChange(e: Event) {
    colorHex = (e.target as HTMLInputElement).value;
    if (editToken) editToken.color = hexToPixi(colorHex);
  }

  function adjustHp(amount: number) {
    if (!editToken) return;
    const cur = editToken.hp ?? 10;
    const max = editToken.maxHp ?? 10;
    editToken.hp = Math.max(0, Math.min(max, cur + amount));
  }

  function setFullHp() {
    if (!editToken) return;
    editToken.hp = editToken.maxHp ?? 10;
  }

  function setPresetSize(px: number) {
    if (!editToken) return;
    editToken.size = px;
  }

  function save() {
    if (editToken) {
      editToken.color = hexToPixi(colorHex);
      editToken.auraColor = hexToPixi(auraColorHex);
      onSave(editToken);
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if ((e.key === 'Enter' && (e.ctrlKey || e.metaKey)) || (e.key === 'Enter' && (e.target as HTMLElement)?.tagName !== 'TEXTAREA')) {
      e.preventDefault();
      save();
    }
    if (e.key === 'Escape') onClose();
  }
</script>

{#if editToken}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="modal-backdrop" onclick={onClose} onkeydown={handleKeydown} role="presentation">
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div class="modal-card" onclick={e => e.stopPropagation()} role="dialog" aria-modal="true" tabindex="-1">
      
      <!-- ── En-tête Moderne avec Aperçu Rapide ── -->
      <div class="modal-header">
        <div class="header-token-preview" style="border-color: {editToken.isEnemy ? '#ef4444' : colorHex};">
          {#if previewUrl}
            <img src={previewUrl} alt={editToken.name} class="token-thumb" />
          {:else}
            <div class="token-color-dot" style="background-color: {editToken.isEnemy ? '#ef4444' : colorHex};"></div>
          {/if}
        </div>

        <div class="header-titles">
          <input
            type="text"
            class="header-name-input"
            bind:value={editToken.name}
            placeholder="Nom du pion..."
            title="Cliquez pour renommer"
          />
          <div class="header-badges">
            <button
              type="button"
              class="badge-toggle allegiance"
              class:enemy={editToken.isEnemy}
              onclick={() => { if (editToken) editToken.isEnemy = !editToken.isEnemy; }}
              title="Cliquer pour basculer Allié / Ennemi"
            >
              {editToken.isEnemy ? '💀 Ennemi' : '🛡️ Allié / PJ'}
            </button>
            <button
              type="button"
              class="badge-toggle visibility"
              class:hidden={editToken.visible === false}
              onclick={() => { if (editToken) editToken.visible = editToken.visible === false ? true : false; }}
              title="Cliquer pour masquer ou forcer la visibilité aux joueurs"
            >
              {editToken.visible === false ? '👁️‍🗨️ Caché aux Joueurs' : '👁️ Visible Joueurs'}
            </button>
            {#if editToken.concentrating}
              <span class="badge concentration">🔮 Concentration</span>
            {/if}
          </div>
        </div>

        <button class="header-close-btn" onclick={onClose} title="Fermer (Échap)">✕</button>
      </div>

      <!-- ── Barre d'Onglets Ergonomique ── -->
      <nav class="modal-tabs" aria-label="Sections des paramètres">
        <button
          type="button"
          class="tab-btn"
          class:active={activeTab === 'general'}
          onclick={() => activeTab = 'general'}
        >
          🛡️ Combat & PV
        </button>
        <button
          type="button"
          class="tab-btn"
          class:active={activeTab === 'appearance'}
          onclick={() => activeTab = 'appearance'}
        >
          🎨 Portrait & Forme
        </button>
        <button
          type="button"
          class="tab-btn"
          class:active={activeTab === 'vision'}
          onclick={() => activeTab = 'vision'}
        >
          👁️ Vision & Lumière
        </button>
        <button
          type="button"
          class="tab-btn"
          class:active={activeTab === 'conditions'}
          onclick={() => activeTab = 'conditions'}
        >
          ⚡ Conditions {#if (editToken.conditions ?? []).length > 0}<span class="tab-badge">{(editToken.conditions ?? []).length}</span>{/if}
        </button>
        <button
          type="button"
          class="tab-btn"
          class:active={activeTab === 'notes'}
          onclick={() => activeTab = 'notes'}
        >
          🏷️ Notes & 3D
        </button>
      </nav>

      <!-- ── Corps Défilant du Formulaire ── -->
      <div class="modal-body">
        
        <!-- ONGLET 1 : COMBAT & PV -->
        {#if activeTab === 'general'}
          <div class="tab-pane animate-fade">
            <!-- Jauge & Ajustement de Santé -->
            <div class="section-box hp-box">
              <div class="section-header">
                <span class="section-title">💚 Points de Vie & Santé</span>
                <span class="hp-ratio">{(editToken.hp ?? 0)} / {(editToken.maxHp ?? 10)} PV</span>
              </div>

              <!-- Barre visuelle interactive -->
              <div class="hp-bar-track">
                <div class="hp-bar-fill" style="width: {hpPercent}%; background-color: {hpPercent > 50 ? '#10b981' : hpPercent > 20 ? '#f59e0b' : '#ef4444'};"></div>
              </div>

              <div class="hp-inputs-grid">
                <div class="input-field">
                  <label for="t-hp">PV Actuels</label>
                  <input type="number" id="t-hp" bind:value={editToken.hp} min="0" />
                </div>
                <div class="input-field">
                  <label for="t-maxhp">PV Max</label>
                  <input type="number" id="t-maxhp" bind:value={editToken.maxHp} min="1" />
                </div>
                <div class="input-field">
                  <label for="t-ac">Classe d'Armure (CA)</label>
                  <input type="number" id="t-ac" bind:value={editToken.ac} min="0" placeholder="ex: 15" />
                </div>
              </div>

              <!-- Boutons d'ajustement rapide -->
              <div class="hp-quick-buttons">
                <span class="quick-label">Ajustement rapide :</span>
                <button type="button" class="btn-quick neg" onclick={() => adjustHp(-5)}>-5</button>
                <button type="button" class="btn-quick neg" onclick={() => adjustHp(-1)}>-1</button>
                <button type="button" class="btn-quick pos" onclick={() => adjustHp(1)}>+1</button>
                <button type="button" class="btn-quick pos" onclick={() => adjustHp(5)}>+5</button>
                <button type="button" class="btn-quick full" onclick={setFullHp} title="Restaurer au maximum">Plein PV</button>
              </div>
            </div>

            <!-- Taille & Échelle -->
            <div class="section-box">
              <div class="section-header">
                <span class="section-title">📏 Taille sur la Carte</span>
                <span class="size-val">{editToken.size} px</span>
              </div>
              <div class="size-row">
                <input type="range" class="slider-full" min="20" max="300" step="5" bind:value={editToken.size} />
              </div>
              <div class="preset-pills">
                <button type="button" class="pill-btn" class:active={editToken.size === 35} onclick={() => setPresetSize(35)}>Petit (0.75x)</button>
                <button type="button" class="pill-btn" class:active={editToken.size === 50} onclick={() => setPresetSize(50)}>Moyen (1x case)</button>
                <button type="button" class="pill-btn" class:active={editToken.size === 100} onclick={() => setPresetSize(100)}>Grand (2x2)</button>
                <button type="button" class="pill-btn" class:active={editToken.size === 150} onclick={() => setPresetSize(150)}>Très Grand (3x3)</button>
              </div>
            </div>
          </div>
        {/if}

        <!-- ONGLET 2 : PORTRAIT & APPARENCE -->
        {#if activeTab === 'appearance'}
          <div class="tab-pane animate-fade">
            <div class="section-box appearance-box">
              <div class="portrait-preview-container">
                {#if previewUrl}
                  <img src={previewUrl} alt="Portrait" class="large-token-preview" />
                {:else}
                  <div class="large-color-preview" style="background-color: {colorHex};"></div>
                {/if}
              </div>

              <div class="appearance-controls">
                <div class="input-field">
                  <label for="t-image">Image du Pion (Bibliothèque ou Coffre)</label>
                  <select id="t-image" bind:value={editToken.imageUrl} class="select-full">
                    <option value="">— Cercle de couleur unie —</option>
                    {#if editToken.imageUrl && editToken.imageUrl.startsWith('data:')}
                      <option value={editToken.imageUrl}>✨ Pion personnalisé (Éditeur de Tokens)</option>
                    {/if}
                    {#each groupedImages as [folder, imgs]}
                      <optgroup label={folder || 'Racine'}>
                        {#each imgs as img}
                          <option value={img.path}>{img.name}</option>
                        {/each}
                      </optgroup>
                    {/each}
                  </select>
                </div>

                <div class="input-field">
                  <label for="t-color">Couleur du contour / Fond</label>
                  <div class="color-picker-wrap">
                    <input
                      type="color"
                      id="t-color"
                      value={colorHex}
                      oninput={handleColorChange}
                      class:disabled={editToken.isEnemy}
                      disabled={editToken.isEnemy}
                    />
                    <span class="color-text">{colorHex}</span>
                    {#if editToken.isEnemy}
                      <small class="hint-warn">(Fixée en rouge car Ennemi)</small>
                    {/if}
                  </div>
                </div>
              </div>
            </div>

            <!-- Aura Magique -->
            <div class="section-box">
              <span class="section-title">✨ Aura Magique Circulaire</span>
              <div class="grid-2col">
                <div class="input-field">
                  <label for="t-aura-r">Rayon d'aura (px, 0 = désactivé)</label>
                  <input type="number" id="t-aura-r" bind:value={editToken.auraRadius} min="0" max="400" step="5" placeholder="0" />
                </div>
                <div class="input-field">
                  <label for="t-aura-c">Couleur de l'aura</label>
                  <div class="color-picker-wrap">
                    <input
                      type="color"
                      id="t-aura-c"
                      value={auraColorHex}
                      oninput={(e) => { auraColorHex = (e.target as HTMLInputElement).value; if (editToken) editToken.auraColor = hexToPixi(auraColorHex); }}
                    />
                    <span class="color-text">{auraColorHex}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        {/if}

        <!-- ONGLET 3 : VISION & LUMIÈRE -->
        {#if activeTab === 'vision'}
          <div class="tab-pane animate-fade">
            <!-- Champ Visuel du Pion -->
            <div class="section-box">
              <span class="section-title">👁️ Vision Dynamique & Brouillard</span>
              <div class="grid-2col">
                <div class="input-field">
                  <label for="t-vision">Portée visuelle (cases)</label>
                  <input type="number" id="t-vision" bind:value={editToken.visionRange} min="0" step="1" placeholder="ex: 12 cases" />
                  <small class="field-help">0 = Découverte automatique désactivée</small>
                </div>
                <div class="input-field">
                  <label for="t-fov">Ouverture du Champ de Vision (°)</label>
                  <select id="t-fov" bind:value={editToken.visionAngle} class="select-full">
                    <option value={360}>360° — Omnidirectionnel (Standard)</option>
                    <option value={180}>180° — Demi-cercle</option>
                    <option value={120}>120° — Vision large</option>
                    <option value={90}>90° — Cône standard</option>
                    <option value={60}>60° — Faisceau torche étroit</option>
                  </select>
                </div>
              </div>

              <div class="grid-2col" style="margin-top: 10px;">
                <div class="input-field">
                  <label for="t-rot">Orientation du Regard (0 à 359°)</label>
                  <div class="rotation-control">
                    <input type="number" id="t-rot" bind:value={editToken.rotation} min="0" max="359" step="15" placeholder="0°=Nord" />
                    <div class="preset-dirs">
                      <button type="button" class="dir-btn" onclick={() => { if (editToken) editToken.rotation = 0; }}>N</button>
                      <button type="button" class="dir-btn" onclick={() => { if (editToken) editToken.rotation = 90; }}>E</button>
                      <button type="button" class="dir-btn" onclick={() => { if (editToken) editToken.rotation = 180; }}>S</button>
                      <button type="button" class="dir-btn" onclick={() => { if (editToken) editToken.rotation = 270; }}>O</button>
                    </div>
                  </div>
                </div>

                <div class="input-field toggle-field">
                  <label class="switch-row">
                    <input type="checkbox" bind:checked={editToken.darkvision} />
                    <span class="switch-label">🕶️ Vision dans le Noir (Darkvision)</span>
                  </label>
                  <small class="field-help">Ignore la pénombre ambiante</small>
                </div>
              </div>
            </div>

            <!-- Source de Lumière Émise -->
            <div class="section-box">
              <span class="section-title">💡 Éclairage Émis (Torche / Lanterne)</span>
              <div class="grid-2col">
                <div class="input-field">
                  <label for="t-light">Rayon de lumière (cases)</label>
                  <input type="number" id="t-light" bind:value={editToken.lightRadius} min="0" step="1" placeholder="0 = éteint" />
                </div>
                <div class="input-field">
                  <label for="t-light-col">Teinte de la lumière</label>
                  <div class="color-picker-wrap">
                    <input type="color" id="t-light-col" bind:value={editToken.lightColor} />
                    <span class="color-text">{editToken.lightColor || '#ffffff'}</span>
                  </div>
                </div>
              </div>

              <div class="toggle-field" style="margin-top: 10px;">
                <label class="switch-row">
                  <input type="checkbox" bind:checked={editToken.lightFlicker} />
                  <span class="switch-label">🔥 Effet Scintillement Torche Réaliste</span>
                </label>
              </div>
            </div>
          </div>
        {/if}

        <!-- ONGLET 4 : CONDITIONS & ÉTATS -->
        {#if activeTab === 'conditions'}
          <div class="tab-pane animate-fade">
            <div class="section-box">
              <div class="section-header">
                <span class="section-title">⚡ États Préjudiciables & Bonus</span>
                <label class="concentration-toggle">
                  <input type="checkbox" bind:checked={editToken.concentrating} />
                  <span>🔮 Concentration Active</span>
                </label>
              </div>

              <div class="conditions-cards-grid">
                {#each CONDITIONS as cond}
                  {@const active = (editToken.conditions ?? []).includes(cond.id)}
                  <div class="cond-card" class:active>
                    <label class="cond-card-label">
                      <input
                        type="checkbox"
                        checked={active}
                        onchange={(e) => {
                          if (!editToken) return;
                          const set = new Set(editToken.conditions ?? []);
                          if ((e.target as HTMLInputElement).checked) set.add(cond.id);
                          else {
                            set.delete(cond.id);
                            const d = { ...(editToken.conditionDurations ?? {}) };
                            delete d[cond.id];
                            editToken.conditionDurations = d;
                          }
                          editToken.conditions = [...set];
                        }}
                      />
                      <span class="cond-icon">{cond.emoji}</span>
                      <span class="cond-name">{cond.label}</span>
                    </label>

                    {#if active}
                      <div class="cond-duration-wrap" title="Durée en tours de combat (vide = permanent)">
                        <input
                          type="number"
                          class="cond-duration-input"
                          min="1" max="99" step="1"
                          placeholder="∞"
                          value={(editToken.conditionDurations ?? {})[cond.id] ?? ''}
                          oninput={(e) => {
                            if (!editToken) return;
                            const v = parseInt((e.target as HTMLInputElement).value);
                            const d = { ...(editToken.conditionDurations ?? {}) };
                            if (isNaN(v) || v <= 0) delete d[cond.id];
                            else d[cond.id] = v;
                            editToken.conditionDurations = d;
                          }}
                        />
                        <span class="tours-unit">tr</span>
                      </div>
                    {/if}
                  </div>
                {/each}
              </div>
            </div>
          </div>
        {/if}

        <!-- ONGLET 5 : NOTES & 3D -->
        {#if activeTab === 'notes'}
          <div class="tab-pane animate-fade">
            <!-- Notes MJ -->
            <div class="section-box">
              <label for="t-notes" class="section-title">📝 Notes Secrètes du MJ</label>
              <textarea
                id="t-notes"
                bind:value={editToken.notes}
                rows="4"
                placeholder="Statistiques rapides, intentions tactiques, trésor transporté..."
                class="notes-textarea"
              ></textarea>
            </div>

            <!-- Marqueur Physique 3D ArUco -->
            <div class="section-box">
              <span class="section-title">🏷️ Marqueur Physique 3D (ArUco ID pour Webcam)</span>
              <div class="aruco-row">
                <input
                  type="number"
                  id="t-physical-id"
                  min="0"
                  max="49"
                  placeholder="— Aucun tag — (ex: 4)"
                  value={editToken.physicalMarkerId ?? ''}
                  oninput={(e) => {
                    if (!editToken) return;
                    const val = parseInt((e.target as HTMLInputElement).value);
                    editToken.physicalMarkerId = isNaN(val) ? null : val;
                  }}
                  class="aruco-input"
                />
                {#if editToken.physicalMarkerId !== null && editToken.physicalMarkerId !== undefined && editToken.physicalMarkerId >= 0 && editToken.physicalMarkerId <= 49}
                  <div class="aruco-preview" title="Tag ArUco #{editToken.physicalMarkerId}">
                    <img src={getArucoDataUrl(editToken.physicalMarkerId, 32)} alt="Tag #{editToken.physicalMarkerId}" class="aruco-img" />
                    <span class="aruco-tag-label">Tag #{editToken.physicalMarkerId}</span>
                  </div>
                {/if}
              </div>
              <small class="field-help" style="margin-top: 6px; display: block;">
                Collez un marqueur ArUco sous votre figurine physique pour qu'elle soit détectée en direct par la caméra au-dessus de la table.
              </small>
            </div>
          </div>
        {/if}

      </div>

      <!-- ── Pied de Page Fixe avec Actions Claires ── -->
      <div class="modal-footer">
        <button
          type="button"
          class="btn-footer danger"
          onclick={() => {
            if (editToken && window.confirm(`Supprimer le pion « ${editToken.name} » de la carte ?`)) {
              onDelete(editToken.id);
            }
          }}
          title="Supprimer définitivement ce pion de la carte"
        >
          🗑️ Supprimer de la Carte
        </button>

        <div class="footer-right-buttons">
          <button type="button" class="btn-footer secondary" onclick={onClose}>
            Annuler
          </button>
          <button type="button" class="btn-footer primary" onclick={save}>
            💾 Enregistrer
          </button>
        </div>
      </div>

    </div>
  </div>
{/if}

<style>
  /* ── Backdrop ── */
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.72);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    padding: 16px;
  }

  /* ── Carte du Modal ── */
  .modal-card {
    background: #18181f;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 12px;
    width: min(620px, 94vw);
    max-height: min(88vh, 720px);
    display: flex;
    flex-direction: column;
    box-shadow: 0 16px 40px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(229, 168, 83, 0.15);
    overflow: hidden;
  }

  /* ── Header ── */
  .modal-header {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 16px 20px;
    background: #1f1f2a;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .header-token-preview {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    border: 2px solid #3b82f6;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #111;
    flex-shrink: 0;
    box-shadow: 0 2px 8px rgba(0,0,0,0.4);
  }

  .token-thumb {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .token-color-dot {
    width: 100%;
    height: 100%;
    border-radius: 50%;
  }

  .header-titles {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .header-name-input {
    background: transparent;
    border: 1px solid transparent;
    border-radius: 4px;
    color: #fff;
    font-size: 17px;
    font-weight: 700;
    padding: 2px 6px;
    outline: none;
    width: 100%;
    transition: all 0.15s;
  }

  .header-name-input:hover, .header-name-input:focus {
    background: rgba(255, 255, 255, 0.05);
    border-color: rgba(229, 168, 83, 0.4);
  }

  .header-badges {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .badge-toggle {
    border: none;
    padding: 3px 10px;
    border-radius: 20px;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s;
  }

  .badge-toggle.allegiance {
    background: rgba(59, 130, 246, 0.2);
    color: #93c5fd;
    border: 1px solid rgba(59, 130, 246, 0.35);
  }

  .badge-toggle.allegiance.enemy {
    background: rgba(239, 68, 68, 0.2);
    color: #fca5a5;
    border-color: rgba(239, 68, 68, 0.35);
  }

  .badge-toggle.visibility {
    background: rgba(16, 185, 129, 0.2);
    color: #6ee7b7;
    border: 1px solid rgba(16, 185, 129, 0.35);
  }

  .badge-toggle.visibility.hidden {
    background: rgba(156, 163, 175, 0.15);
    color: #9ca3af;
    border-color: rgba(156, 163, 175, 0.3);
  }

  .badge.concentration {
    background: rgba(168, 85, 247, 0.2);
    color: #d8b4fe;
    border: 1px solid rgba(168, 85, 247, 0.4);
    padding: 2px 8px;
    border-radius: 20px;
    font-size: 11px;
    font-weight: 600;
  }

  .header-close-btn {
    background: transparent;
    border: none;
    color: #888;
    font-size: 18px;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .header-close-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
  }

  /* ── Tabs ── */
  .modal-tabs {
    display: flex;
    background: #14141b;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    padding: 0 16px;
    gap: 4px;
    overflow-x: auto;
  }

  .tab-btn {
    background: transparent;
    border: none;
    color: #9ca3af;
    padding: 10px 14px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    border-bottom: 2px solid transparent;
    transition: all 0.15s;
    white-space: nowrap;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .tab-btn:hover {
    color: #e5e7eb;
  }

  .tab-btn.active {
    color: #e5a853;
    border-bottom-color: #e5a853;
    background: rgba(229, 168, 83, 0.06);
  }

  .tab-badge {
    background: #e5a853;
    color: #000;
    font-size: 10px;
    padding: 1px 5px;
    border-radius: 10px;
    font-weight: bold;
  }

  /* ── Corps Défilant ── */
  .modal-body {
    flex: 1;
    overflow-y: auto;
    padding: 18px 20px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .tab-pane {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .animate-fade {
    animation: fadeIn 0.15s ease-out;
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(4px); }
    to { opacity: 1; transform: translateY(0); }
  }

  /* ── Section Box ── */
  .section-box {
    background: #1e1e28;
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 8px;
    padding: 14px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .section-title {
    font-size: 13px;
    font-weight: 700;
    color: #f3f4f6;
  }

  /* ── PV Box & Barre ── */
  .hp-ratio {
    font-size: 13px;
    font-weight: bold;
    color: #10b981;
  }

  .hp-bar-track {
    width: 100%;
    height: 8px;
    background: rgba(0, 0, 0, 0.4);
    border-radius: 4px;
    overflow: hidden;
  }

  .hp-bar-fill {
    height: 100%;
    transition: width 0.25s ease, background-color 0.25s ease;
  }

  .hp-inputs-grid {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 12px;
  }

  .hp-quick-buttons {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
    margin-top: 4px;
  }

  .quick-label {
    font-size: 11px;
    color: #888;
  }

  .btn-quick {
    border: none;
    padding: 3px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.1s;
  }

  .btn-quick.neg {
    background: rgba(239, 68, 68, 0.2);
    color: #fca5a5;
  }
  .btn-quick.neg:hover { background: rgba(239, 68, 68, 0.35); }

  .btn-quick.pos {
    background: rgba(16, 185, 129, 0.2);
    color: #6ee7b7;
  }
  .btn-quick.pos:hover { background: rgba(16, 185, 129, 0.35); }

  .btn-quick.full {
    background: rgba(59, 130, 246, 0.2);
    color: #93c5fd;
  }
  .btn-quick.full:hover { background: rgba(59, 130, 246, 0.35); }

  /* ── Sliders & Pills ── */
  .slider-full {
    width: 100%;
    accent-color: #e5a853;
  }

  .preset-pills {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }

  .pill-btn {
    background: #14141b;
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #bbb;
    padding: 4px 10px;
    border-radius: 14px;
    font-size: 11px;
    cursor: pointer;
    transition: all 0.1s;
  }

  .pill-btn:hover { background: rgba(255, 255, 255, 0.08); color: #fff; }
  .pill-btn.active {
    background: rgba(229, 168, 83, 0.2);
    border-color: #e5a853;
    color: #e5a853;
    font-weight: bold;
  }

  /* ── Appearance Box ── */
  .appearance-box {
    display: flex;
    flex-direction: row;
    gap: 16px;
    align-items: center;
  }

  .portrait-preview-container {
    width: 96px;
    height: 96px;
    border-radius: 8px;
    border: 2px solid rgba(229, 168, 83, 0.4);
    background: #111;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .large-token-preview {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .large-color-preview {
    width: 100%;
    height: 100%;
  }

  .appearance-controls {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  /* ── Inputs Généraux ── */
  .input-field {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .input-field label {
    font-size: 11px;
    font-weight: 600;
    color: #9ca3af;
  }

  input[type="text"], input[type="number"], select {
    background: #121218;
    border: 1px solid rgba(255, 255, 255, 0.12);
    color: #fff;
    padding: 7px 10px;
    border-radius: 6px;
    font-size: 13px;
    outline: none;
    box-sizing: border-box;
    transition: border-color 0.15s;
  }

  input:focus, select:focus, textarea:focus {
    border-color: #e5a853;
  }

  .select-full {
    width: 100%;
  }

  .grid-2col {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }

  .color-picker-wrap {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  input[type="color"] {
    width: 38px;
    height: 32px;
    padding: 2px;
    border-radius: 6px;
    border: 1px solid rgba(255, 255, 255, 0.15);
    background: #121218;
    cursor: pointer;
  }

  .color-text {
    font-family: monospace;
    font-size: 12px;
    color: #ccc;
  }

  .hint-warn {
    font-size: 11px;
    color: #f87171;
  }

  .field-help {
    font-size: 11px;
    color: #777;
  }

  /* ── Rotation Controls ── */
  .rotation-control {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .preset-dirs {
    display: flex;
    gap: 3px;
  }

  .dir-btn {
    background: #14141b;
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #bbb;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 11px;
    cursor: pointer;
  }
  .dir-btn:hover { background: rgba(255, 255, 255, 0.1); color: #fff; }

  /* ── Toggle Switch ── */
  .switch-row {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    user-select: none;
  }

  .switch-label {
    font-size: 12px;
    color: #ddd;
    font-weight: 500;
  }

  .concentration-toggle {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: #d8b4fe;
    font-weight: 600;
    cursor: pointer;
  }

  /* ── Condition Cards ── */
  .conditions-cards-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
    gap: 8px;
  }

  .cond-card {
    background: #14141b;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 6px;
    padding: 6px 8px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    transition: all 0.12s;
  }

  .cond-card.active {
    background: rgba(229, 168, 83, 0.15);
    border-color: #e5a853;
  }

  .cond-card-label {
    display: flex;
    align-items: center;
    gap: 6px;
    cursor: pointer;
    flex: 1;
    min-width: 0;
  }

  .cond-card-label input {
    display: none;
  }

  .cond-icon {
    font-size: 14px;
  }

  .cond-name {
    font-size: 11px;
    color: #ccc;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .cond-card.active .cond-name {
    color: #fff;
    font-weight: 600;
  }

  .cond-duration-wrap {
    display: flex;
    align-items: center;
    gap: 2px;
    background: #111;
    padding: 2px 4px;
    border-radius: 4px;
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .cond-duration-input {
    width: 28px !important;
    padding: 1px 2px !important;
    font-size: 10px !important;
    background: transparent !important;
    border: none !important;
    text-align: center;
    color: #e5a853 !important;
    font-weight: bold;
  }

  .tours-unit {
    font-size: 9px;
    color: #777;
  }

  /* ── Notes Textarea ── */
  .notes-textarea {
    width: 100%;
    background: #121218;
    border: 1px solid rgba(255, 255, 255, 0.12);
    color: #fff;
    padding: 10px;
    border-radius: 6px;
    resize: vertical;
    font-family: inherit;
    font-size: 13px;
    box-sizing: border-box;
  }

  /* ── ArUco ── */
  .aruco-row {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .aruco-input {
    flex: 1;
  }

  .aruco-preview {
    display: flex;
    align-items: center;
    gap: 8px;
    background: #14141b;
    padding: 4px 10px;
    border-radius: 6px;
    border: 1px solid rgba(229, 168, 83, 0.3);
  }

  .aruco-img {
    width: 28px;
    height: 28px;
    border: 1px solid #000;
    background: #fff;
  }

  .aruco-tag-label {
    font-size: 11px;
    font-weight: bold;
    color: #e5a853;
  }

  /* ── Footer Fixe ── */
  .modal-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 20px;
    background: #161620;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
  }

  .footer-right-buttons {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .btn-footer {
    border: none;
    padding: 8px 18px;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s;
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  .btn-footer.primary {
    background: #e5a853;
    color: #121218;
  }
  .btn-footer.primary:hover {
    background: #f0b768;
    box-shadow: 0 0 12px rgba(229, 168, 83, 0.35);
  }

  .btn-footer.secondary {
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.15);
    color: #ccc;
  }
  .btn-footer.secondary:hover {
    background: rgba(255, 255, 255, 0.08);
    color: #fff;
  }

  .btn-footer.danger {
    background: rgba(239, 68, 68, 0.12);
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: #fca5a5;
  }
  .btn-footer.danger:hover {
    background: rgba(239, 68, 68, 0.25);
    color: #fff;
  }
</style>
