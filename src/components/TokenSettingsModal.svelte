<script lang="ts">
  import type { Token } from '$lib/stores/vtt.svelte';
  import { getVaultTree } from '$lib/stores/vault.svelte';

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

  let { token, onClose, onSave, onDelete }: {
    token: Token | null;
    onClose: () => void;
    onSave: (updatedToken: Token) => void;
    onDelete: (id: string) => void;
  } = $props();

  let editToken = $state<Token | null>(null);
  let colorHex = $state('#3b82f6');
  let auraColorHex = $state('#3b82f6');
  let availableImages = $state<{name: string, path: string}[]>([]);

  // Reset editToken à chaque changement de token (comparaison par ID)
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

  // Liste des images du vault (indépendant du token courant)
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
            if (fullPath.split('/').includes('tokens')) {
              images.push({ name: n.name, path: fullPath });
            }
          }
        }
      }
    }
    traverse(tree);
    availableImages = images.sort((a, b) => a.path.localeCompare(b.path));
  });

  // Grouper les images par dossier parent pour les <optgroup>
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

  function save() {
    if (editToken) {
      editToken.color = hexToPixi(colorHex);
      editToken.auraColor = hexToPixi(auraColorHex);
      onSave(editToken);
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') save();
    if (e.key === 'Escape') onClose();
  }
</script>

{#if editToken}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="modal-backdrop" onclick={onClose} onkeydown={handleKeydown} role="presentation">
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div class="modal-content" onclick={e => e.stopPropagation()} role="dialog" aria-modal="true" tabindex="-1">
      <h2>⚙️ Paramètres du Pion</h2>

      <div class="form-group">
        <label for="t-name">Nom</label>
        <input type="text" id="t-name" bind:value={editToken.name} />
      </div>

      <div class="form-row">
        <div class="form-group">
          <label for="t-hp">PV Actuels</label>
          <input type="number" id="t-hp" bind:value={editToken.hp} min="0" />
        </div>
        <div class="form-group">
          <label for="t-maxhp">PV Max</label>
          <input type="number" id="t-maxhp" bind:value={editToken.maxHp} min="0" />
        </div>
      </div>

      <div class="form-group">
        <label for="t-image">Image (optionnel)</label>
        <select id="t-image" bind:value={editToken.imageUrl}>
          <option value="">— Aucune image (cercle de couleur) —</option>
          {#each groupedImages as [folder, imgs]}
            <optgroup label={folder || '/'}>
              {#each imgs as img}
                <option value={img.path}>{img.name}</option>
              {/each}
            </optgroup>
          {/each}
        </select>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label for="t-size">Taille (px)</label>
          <input type="number" id="t-size" bind:value={editToken.size} min="10" max="200" step="5" />
        </div>
        <div class="form-group">
          <label for="t-vision">Vision (cases)</label>
          <input type="number" id="t-vision" bind:value={editToken.visionRange} min="0" step="1" />
        </div>
      </div>

      <div class="form-row align-end">
        <div class="form-group">
          <label for="t-color">Couleur</label>
          <div class="color-row">
            <input
              type="color"
              id="t-color"
              value={colorHex}
              oninput={handleColorChange}
              class:disabled={editToken.isEnemy}
              disabled={editToken.isEnemy}
            />
            <span class="color-hint">{colorHex}</span>
          </div>
        </div>
        <div class="form-group">
          <span class="spacer"></span>
          <label class="checkbox-label">
            <input type="checkbox" bind:checked={editToken.isEnemy} />
            Ennemi (rouge)
          </label>
          <label class="checkbox-label">
            <input type="checkbox" checked={editToken.visible !== false}
              onchange={(e) => { if (editToken) editToken.visible = (e.target as HTMLInputElement).checked; }} />
            Visible joueurs
          </label>
        </div>
      </div>

      <div class="form-group">
        <span class="field-label">Conditions</span>
        <div class="conditions-grid">
          {#each CONDITIONS as cond}
            {@const active = (editToken.conditions ?? []).includes(cond.id)}
            <div class="cond-row">
              <label class="cond-chip" class:active>
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
                {cond.emoji} {cond.label}
              </label>
              {#if active}
                <input
                  type="number"
                  class="cond-dur-input"
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
                  title="Durée (tours, vide = infinie)"
                />
              {/if}
            </div>
          {/each}
        </div>
      </div>

      <div class="form-group">
        <label>
          <input type="checkbox" bind:checked={editToken.concentrating} />
          🔮 Concentration active
        </label>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label for="t-aura-r">Aura (px, 0=off)</label>
          <input type="number" id="t-aura-r" bind:value={editToken.auraRadius} min="0" max="300" step="5" placeholder="0" />
        </div>
        <div class="form-group">
          <label for="t-aura-c">Couleur aura</label>
          <input type="color" id="t-aura-c" value={auraColorHex}
            oninput={(e) => { auraColorHex = (e.target as HTMLInputElement).value; if (editToken) editToken.auraColor = hexToPixi(auraColorHex); }} />
        </div>
        <div class="form-group">
          <label for="t-light">Lumière (cases)</label>
          <input type="number" id="t-light" bind:value={editToken.lightRadius} min="0" step="1" placeholder="0" />
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label for="t-light-col">Couleur lumière</label>
          <input type="color" id="t-light-col" bind:value={editToken.lightColor} />
        </div>
        <div class="form-group" style="display:flex;align-items:center;padding-top:20px;gap:8px">
          <label style="cursor:pointer;display:flex;align-items:center;gap:6px">
            <input type="checkbox" bind:checked={editToken.lightFlicker} />
            🔥 Torche (Scintillement)
          </label>
        </div>
        <div class="form-group" style="display:flex;align-items:center;padding-top:20px;gap:8px">
          <label style="cursor:pointer;display:flex;align-items:center;gap:6px">
            <input type="checkbox" bind:checked={editToken.darkvision} />
            👁️ Vision Nocturne
          </label>
        </div>
      </div>

      <div class="form-group">
        <label for="t-notes">Notes</label>
        <textarea id="t-notes" bind:value={editToken.notes} rows="2" placeholder="Notes rapides sur ce token…"></textarea>
      </div>

      <div class="modal-actions">
        <button class="btn-delete" onclick={() => editToken && onDelete(editToken.id)}>🗑️ Supprimer</button>
        <button class="btn-cancel" onclick={onClose}>Annuler</button>
        <button class="btn-save" onclick={save}>Enregistrer</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0,0,0,0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
  }
  .modal-content {
    background: var(--bg-primary);
    padding: 24px;
    border-radius: 8px;
    border: 1px solid var(--border);
    width: 420px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  h2 { margin: 0; color: var(--text-primary); font-size: 18px; }
  .form-group { display: flex; flex-direction: column; gap: 6px; }
  .form-row { display: flex; gap: 16px; }
  .form-row.align-end .form-group { flex: 1; }
  .form-row .form-group { flex: 1; }
  .field-label, label { font-size: 12px; color: var(--text-secondary); }
  input[type="text"], input[type="number"], select {
    background: var(--bg-tertiary);
    border: 1px solid var(--border);
    color: var(--text-primary);
    padding: 8px;
    border-radius: 4px;
    outline: none;
    width: 100%;
    box-sizing: border-box;
  }
  input:focus, select:focus { border-color: var(--accent); }

  .color-row {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  input[type="color"] {
    width: 44px;
    height: 36px;
    padding: 2px;
    border-radius: 4px;
    border: 1px solid var(--border);
    background: var(--bg-tertiary);
    cursor: pointer;
  }
  input[type="color"].disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }
  .color-hint {
    font-size: 12px;
    color: var(--text-muted);
    font-family: monospace;
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    color: var(--text-primary);
    cursor: pointer;
    padding: 8px 0;
  }

  .conditions-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: flex-start;
  }

  .cond-chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    border-radius: 20px;
    border: 1px solid var(--border);
    background: var(--bg-tertiary);
    font-size: 12px;
    cursor: pointer;
    color: var(--text-secondary);
    transition: all 0.1s;
    user-select: none;
  }
  .cond-chip input { display: none; }
  .cond-chip.active {
    border-color: var(--accent);
    background: rgba(229, 168, 83, 0.15);
    color: var(--text-primary);
    font-weight: 600;
  }
  .cond-chip:hover { background: var(--bg-hover); }

  .cond-row {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .cond-dur-input {
    width: 44px;
    padding: 2px 4px;
    font-size: 11px;
    background: var(--bg-tertiary);
    border: 1px solid var(--border);
    color: var(--text-primary);
    border-radius: 4px;
    text-align: center;
  }

  textarea {
    background: var(--bg-tertiary);
    border: 1px solid var(--border);
    color: var(--text-primary);
    padding: 8px;
    border-radius: 4px;
    outline: none;
    width: 100%;
    box-sizing: border-box;
    resize: vertical;
    font-family: inherit;
    font-size: 13px;
  }
  textarea:focus { border-color: var(--accent); }

  .modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    margin-top: 4px;
  }
  .btn-delete {
    margin-right: auto;
    background: transparent;
    border: 1px solid var(--error, #f85149);
    color: var(--error, #f85149);
  }
  .btn-delete:hover { background: rgba(248, 81, 73, 0.1); }
  button {
    padding: 8px 16px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 13px;
    font-weight: 500;
  }
  .btn-cancel {
    background: transparent;
    border: 1px solid var(--border);
    color: var(--text-secondary);
  }
  .btn-save {
    background: var(--accent);
    border: none;
    color: #000;
  }
</style>
