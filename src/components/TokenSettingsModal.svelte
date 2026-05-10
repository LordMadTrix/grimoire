<script lang="ts">
  import type { Token } from '$lib/stores/vtt.svelte';

  import { getVaultTree } from '$lib/stores/vault.svelte';

  let { token, onClose, onSave, onDelete }: {
    token: Token | null;
    onClose: () => void;
    onSave: (updatedToken: Token) => void;
    onDelete: (id: string) => void;
  } = $props();

  let editToken = $state<Token | null>(null);
  let colorHex = $state('#3b82f6');
  let availableImages = $state<{name: string, path: string}[]>([]);

  $effect(() => {
    if (token && !editToken) {
      editToken = { ...token };
      colorHex = pixiToHex(token.color ?? 0x3b82f6);
    }
    
    // Remplir la liste des images disponibles dans le Vault
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
  <div class="modal-backdrop" onclick={onClose} onkeydown={handleKeydown}>
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div class="modal-content" onclick={e => e.stopPropagation()}>
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
          <option value="">Aucune image (Cercle de couleur)</option>
          {#each availableImages as img}
            <option value={img.path}>{img.path}</option>
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
          <label>&nbsp;</label>
          <label class="checkbox-label">
            <input type="checkbox" bind:checked={editToken.isEnemy} />
            Ennemi (rouge)
          </label>
        </div>
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
  label { font-size: 12px; color: var(--text-secondary); }
  label { font-size: 12px; color: var(--text-secondary); }
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
