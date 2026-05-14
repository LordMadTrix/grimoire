<script lang="ts">
  import { readFile, writeFile, createDirectory } from '$lib/api';
  import { getVaultPath } from '$lib/stores/vault.svelte';
  import { invoke } from '@tauri-apps/api/core';

  let visible = $state(false);
  export function toggle() { visible = !visible; }

  // ── Types ────────────────────────────────────────────────────────────────────

  interface Scenario {
    id: string;
    title: string;
    author: string;
    edition: string;   // '1e' | '2e' | '4e' | 'FR'
    source: string;    // 'marteau' | 'custom' | 'reddit'
    url?: string;
    description?: string;
    difficulty?: string;
    tags?: string[];
    // User data (persisted)
    status?: 'idle' | 'planned' | 'ongoing' | 'done';
    notes?: string;
    sessions?: number;
  }

  // ── Built-in data (marteau.warhammer.free.fr + classics) ─────────────────────

  const BASE = 'http://marteau.warhammer.free.fr/scenarii/';

  const BUILTIN: Scenario[] = [
    // ── Marteau.warhammer — scénarios français ──
    { id: 'tarkenberg', title: 'Le Mystère de Tarkenberg', author: 'Stéphane Guyon', edition: 'FR', source: 'marteau', url: BASE + 'Le mystere de Tarkenberg.pdf', tags: ['mystère', 'enquête'] },
    { id: 'el-hassan', title: 'Le Projet El Hassan', author: 'Stéphane Guyon', edition: 'FR', source: 'marteau', url: BASE + 'Le projet El Hassan.pdf', tags: ['exotique'] },
    { id: 'puits-noye', title: 'Le Puits du Noyé', author: 'John Foody (trad. E. Granier)', edition: 'FR', source: 'marteau', url: BASE + 'Le_Puits_du_Noye.pdf', tags: ['horreur', 'enquête'] },
    { id: 'crime-chatiment', title: 'Crime ou Châtiment', author: 'Association Ordalie', edition: 'FR', source: 'marteau', url: BASE + 'crime.PDF', tags: ['urbain', 'enquête'] },
    { id: 'raban', title: "Ra'Ban d'Ig, la Nation du Soleil", author: 'Denis Duperthuis', edition: 'FR', source: 'marteau', url: BASE + 'RA_BAN_IG_LA_NATION_DU_SOLEIL.PDF', tags: ['exotique', 'aventure'] },
    { id: 'rocs', title: 'Rocs and Orques Altitude', author: 'Christophe Loyre', edition: 'FR', source: 'marteau', url: BASE + 'Rocs.PDF', tags: ['orques', 'montagne'] },
    { id: 'une-amie', title: 'Une Amie est Morte', author: 'Association Ordalie', edition: 'FR', source: 'marteau', url: BASE + 'uneamie.PDF', tags: ['enquête', 'mort'] },
    { id: 'moira', title: 'Le Moïra est de Retour', author: 'Association Ordalie', edition: 'FR', source: 'marteau', url: BASE + 'WARHA95.PDF', tags: ['classique'] },
    { id: 'beeckerhaven', title: 'Le Monstre de Beeckerhaven', author: 'Stéphane Guyon', edition: 'FR', source: 'marteau', url: BASE + 'BEECKERHAVEN.PDF', tags: ['monstre', 'village'] },
    { id: 'bebes', title: 'Des Bébés, en Veux-tu en Voilà!', author: 'Tristan Lhomme', edition: 'FR', source: 'marteau', url: BASE + 'Des_bebes.pdf', tags: ['horreur', 'humour'] },
    { id: 'accoucheur', title: "L'Accoucheur d'Esprit", author: 'Inconnu', edition: 'FR', source: 'marteau', url: BASE + 'accoucheur_esprit.htm', tags: ['surnaturel'] },
    { id: 'allons-bois', title: '1...2...3... Allons au Bois', author: 'Nyogtha', edition: 'FR', source: 'marteau', url: BASE + 'allons_au_bois.PDF', tags: ['forêt', 'horreur'] },
    { id: 'ange-exter', title: "L'Ange Exterminateur", author: 'Inconnu', edition: 'FR', source: 'marteau', url: BASE + 'ange_exterminateur.htm', tags: ['divin', 'horreur'] },
    { id: 'apprenti-sorc', title: "L'Apprenti Sorcier", author: 'Alex Day', edition: 'FR', source: 'marteau', url: BASE + 'apprenti_sorcier.PDF', difficulty: 'débutant', tags: ['magie', 'débutant'] },
    { id: 'coeur-dragon', title: 'Le Cœur de Dragon', author: 'Antoine Fournier', edition: 'FR', source: 'marteau', url: BASE + 'coeur_dragon.PDF', tags: ['dragon', 'aventure'] },
    { id: 'graal-athos', title: "Le Graal d'Athos", author: 'Crow Soul', edition: 'FR', source: 'marteau', url: BASE + 'Graal_athos.htm', tags: ['graal', 'quête'] },
    { id: 'gros-prob', title: 'Gros Problèmes', author: 'DEMS Samir', edition: 'FR', source: 'marteau', url: BASE + 'gros_problemes.PDF', tags: ['humour', 'action'] },
    { id: 'histoire-recettes', title: 'Une Histoire de Recettes', author: 'Sébastien Boudaud', edition: 'FR', source: 'marteau', url: BASE + 'Halfelings.htm', tags: ['halflings', 'humour'] },
    { id: 'hopital', title: "L'Hôpital", author: 'Alerim le Grand', edition: 'FR', source: 'marteau', url: BASE + 'HOPITAL.PDF', tags: ['urbain', 'horreur'] },
    { id: 'mootland', title: 'Intrigues au Mootland', author: 'Karl Franz', edition: 'FR', source: 'marteau', url: BASE + 'Intrigues_Mootland.PDF', tags: ['politique', 'halflings'] },
    { id: 'kensburg', title: 'Kensburg pour Toujours', author: 'Ripcurlpro', edition: 'FR', source: 'marteau', url: BASE + 'kensburg.PDF', tags: ['village', 'mystère'] },
    { id: 'forteresse', title: 'La Forteresse', author: 'Adrien', edition: 'FR', source: 'marteau', url: BASE + 'La_Forteresse.PDF', tags: ['fort', 'combat'] },
    { id: 'mission-nain', title: 'La Mission du Nain', author: 'Inconnu', edition: 'FR', source: 'marteau', url: BASE + 'La_Mission_du_Nain.htm', tags: ['nain', 'quête'] },
    { id: 'victime', title: 'La Victime', author: 'Syko', edition: 'FR', source: 'marteau', url: BASE + 'La_victime.PDF', tags: ['enquête', 'urbain'] },
    { id: 'maire-bizarre', title: 'Le Maire de la Ville est Bizarre...', author: 'Crow Soul', edition: 'FR', source: 'marteau', url: BASE + 'le%20maire%20de%20la%20ville.htm', tags: ['politique', 'mystère'] },
    { id: 'epee-sacree', title: "L'Épée Sacrée", author: 'Inconnu', edition: 'FR', source: 'marteau', url: BASE + "l%27Ep%E9e%20Sacr%E9e.htm", tags: ['artefact', 'quête'] },
    { id: 'arcanes-skaven', title: 'Les Arcanes Skavens', author: 'Sébastien Boudaud', edition: 'FR', source: 'marteau', url: BASE + 'Les_Arcanes_Skavens.PDF', tags: ['skavens', 'magie'] },
    { id: 'bebes-lune', title: 'Les Bébés Naissent à la Pleine Lune', author: 'Snake', edition: 'FR', source: 'marteau', url: BASE + 'LES_BEBES_NAISSENT_PLEINE_LUNE.PDF', tags: ['horreur', 'nuit'] },
    { id: 'liste-noire', title: 'La Liste Noire', author: 'Kildor', edition: 'FR', source: 'marteau', url: BASE + 'Liste_Noire.PDF', tags: ['politique', 'enquête'] },
    { id: 'meurtre-redding', title: 'Meurtre à Redding', author: 'Inconnu', edition: 'FR', source: 'marteau', url: BASE + 'meurtre%20%E0%20redding.htm', tags: ['meurtre', 'enquête'] },
    { id: 'molay', title: "L'Épée de Jacques de Molay", author: 'Hortaliss', edition: 'FR', source: 'marteau', url: BASE + 'Molay.pdf', tags: ['historique', 'artefact'] },
    { id: 'ordre-damnes', title: "L'Ordre Damnés", author: 'Kan Dan', edition: 'FR', source: 'marteau', url: BASE + 'Ordre_Damnes.PDF', tags: ['chaos', 'culte'] },
    { id: 'raisons-perso', title: 'Pour Raisons Personnelles', author: 'Énaméril', edition: 'FR', source: 'marteau', url: BASE + 'Pour_raisons_personnelles.zip', tags: ['personnel', 'enquête'] },
    { id: 'parle-loup', title: 'Quand on Parle du Loup...', author: 'Syko', edition: 'FR', source: 'marteau', url: BASE + 'Quand_on_parle_du_loup.pdf', tags: ['loup-garou', 'horreur'] },
    { id: 'bete-meure', title: 'Que la Bête Meure !', author: 'Inconnu', edition: 'FR', source: 'marteau', url: BASE + 'Que%20la%20b%EAte%20meure.htm', tags: ['monstre', 'chasse'] },
    { id: 'route-est', title: "La Route de l'Est", author: 'Anduril', edition: 'FR', source: 'marteau', url: BASE + 'Rout_de_Est.PDF', tags: ['voyage', 'aventure'] },
    { id: 'royaume-morts', title: 'Le Royaume des Morts', author: 'Inconnu', edition: 'FR', source: 'marteau', url: BASE + 'royaume_des_morts.PDF', tags: ['mort', 'mort-vivants'] },
    { id: 'sartosa', title: 'Sartosa nous Voilà !', author: 'Sébastien Boudaud', edition: 'FR', source: 'marteau', url: BASE + 'Sartosa%20nous%20voila.htm', tags: ['piraterie', 'île'] },
    { id: 'tenebres-lumiere', title: 'Des Ténèbres à la Lumière', author: 'Inconnu', edition: 'FR', source: 'marteau', url: BASE + 'tenebre_lumiere.PDF', tags: ['lumière', 'chaos'] },
    { id: 'tresor-ilendil', title: "Trésor d'Ilendil", author: 'Inconnu', edition: 'FR', source: 'marteau', url: BASE + 'tresor_ilendil.PDF', tags: ['trésor', 'quête'] },
    { id: 'nom-dieux', title: 'Au Nom de tous les Dieux', author: 'Mario Heimburger', edition: 'FR', source: 'marteau', url: 'http://eastenwest.free.fr/?type=articles&ID=81', tags: ['religion', 'dieux'] },
    { id: 'tresor-auberge', title: "Le Trésor de l'Aubergiste", author: 'Mario Heimburger', edition: 'FR', source: 'marteau', url: 'http://eastenwest.free.fr/?type=articles&ID=12', difficulty: 'débutant', tags: ['débutant', 'taverne'] },
    // ── Scénarios officiels classiques ──
    { id: 'oldenhaller', title: 'The Oldenhaller Contract', author: 'Games Workshop', edition: '1e', source: 'officiel', description: "Scénario d'introduction officiel de la 1ère édition. Idéal pour débutants.", difficulty: 'débutant', tags: ['débutant', 'urbain', 'classique', 'officiel'] },
    { id: 'shadows-ratcatcher', title: "Shadows Over Bögenhafen", author: 'GW / Hogshead', edition: '1e', source: 'officiel', description: "Premier acte de La Campagne du Chaos. Enquête sur un culte du Chaos dans une ville.", difficulty: 'intermédiaire', tags: ['campagne', 'chaos', 'urbain', 'officiel'] },
    { id: 'death-on-the-reik', title: 'Death on the Reik', author: 'GW / Hogshead', edition: '1e', source: 'officiel', description: "Second acte — voyage fluvial parsemé de périls.", difficulty: 'intermédiaire', tags: ['campagne', 'voyage', 'fluvial', 'officiel'] },
    { id: 'power-behind-throne', title: 'Power Behind the Throne', author: 'GW / Hogshead', edition: '1e', source: 'officiel', description: "Troisième acte — politique impériale à Middenheim.", difficulty: 'avancé', tags: ['campagne', 'politique', 'officiel'] },
    { id: 'rough-nights', title: 'Rough Nights & Hard Days', author: 'Cubicle 7', edition: '4e', source: 'officiel', description: "Cinq aventures courtes interconnectées, idéales pour débuter en 4e édition.", difficulty: 'débutant', tags: ['débutant', 'taverne', 'officiel', '4e'] },
    { id: 'starter-4e', title: "WFRP Starter Set — L'Ennemi Intérieur Vol.1", author: 'Cubicle 7', edition: '4e', source: 'officiel', description: "Ubersreik Adventures + Dark Heritage. Premier arc de la campagne phare de la 4e.", difficulty: 'débutant', tags: ['débutant', 'campagne', 'officiel', '4e'] },
    { id: 'night-of-blood', title: 'Night of Blood', author: 'GW', edition: '1e', source: 'officiel', description: "Classique one-shot d'horreur. Groupe bloqué dans une auberge isolée. Parfait pour une soirée.", difficulty: 'débutant', tags: ['débutant', 'horreur', 'one-shot', 'classique', 'officiel'] },
  ];

  // ── State ─────────────────────────────────────────────────────────────────────

  let userMeta = $state<Record<string, { status?: string; notes?: string; sessions?: number }>>({});
  let search = $state('');
  let filterEdition = $state('');
  let filterStatus = $state('');
  let filterTag = $state('');
  let showAddForm = $state(false);
  let copiedId = $state('');

  // Custom scenarios saved to vault
  let custom = $state<Scenario[]>([]);

  let allScenarios = $derived([...BUILTIN, ...custom]);

  let filtered = $derived(() => {
    const q = search.toLowerCase();
    return allScenarios.filter(s => {
      const meta = userMeta[s.id] ?? {};
      if (filterEdition && s.edition !== filterEdition) return false;
      if (filterStatus && (meta.status ?? 'idle') !== filterStatus) return false;
      if (filterTag && !s.tags?.includes(filterTag)) return false;
      if (!q) return true;
      return s.title.toLowerCase().includes(q)
        || s.author.toLowerCase().includes(q)
        || (s.description ?? '').toLowerCase().includes(q)
        || (s.tags ?? []).some(t => t.includes(q));
    });
  });

  // All unique tags from builtin+custom
  let allTags = $derived([...new Set(allScenarios.flatMap(s => s.tags ?? []))].sort());

  // ── Persistence ───────────────────────────────────────────────────────────────

  async function load() {
    const vp = getVaultPath();
    if (!vp) return;
    try {
      const raw = await readFile(vp, '.grimoire/adventures.json');
      const data = JSON.parse(raw);
      userMeta = data.meta ?? {};
      custom = data.custom ?? [];
    } catch { userMeta = {}; custom = []; }
  }

  async function save() {
    const vp = getVaultPath();
    if (!vp) return;
    const data = JSON.stringify({ meta: userMeta, custom }, null, 2);
    try {
      await writeFile(vp, '.grimoire/adventures.json', data);
    } catch {
      await createDirectory(vp, '.grimoire');
      await writeFile(vp, '.grimoire/adventures.json', data);
    }
  }

  function setStatus(id: string, status: string) {
    userMeta = { ...userMeta, [id]: { ...(userMeta[id] ?? {}), status } };
    save();
  }

  function setNotes(id: string, notes: string) {
    userMeta = { ...userMeta, [id]: { ...(userMeta[id] ?? {}), notes } };
    save();
  }

  // ── URL opening ───────────────────────────────────────────────────────────────

  async function openUrl(url: string) {
    try {
      await invoke('open_url', { url });
    } catch {
      // Fallback: copy to clipboard
      await copyUrl(url);
    }
  }

  async function copyUrl(url: string, id?: string) {
    try {
      await navigator.clipboard.writeText(url);
      if (id) { copiedId = id; setTimeout(() => copiedId = '', 2000); }
    } catch {}
  }

  // ── Add custom ────────────────────────────────────────────────────────────────

  let newTitle = $state('');
  let newAuthor = $state('');
  let newEdition = $state('FR');
  let newUrl = $state('');
  let newDesc = $state('');
  let newTags = $state('');

  function addCustom() {
    if (!newTitle.trim()) return;
    const sc: Scenario = {
      id: Date.now().toString(36),
      title: newTitle.trim(),
      author: newAuthor.trim() || 'Inconnu',
      edition: newEdition,
      source: 'custom',
      url: newUrl.trim() || undefined,
      description: newDesc.trim() || undefined,
      tags: newTags.split(',').map(t => t.trim()).filter(Boolean),
    };
    custom = [...custom, sc];
    newTitle = ''; newAuthor = ''; newEdition = 'FR'; newUrl = ''; newDesc = ''; newTags = '';
    showAddForm = false;
    save();
  }

  function deleteCustom(id: string) {
    custom = custom.filter(s => s.id !== id);
    save();
  }

  // ── Load on mount ─────────────────────────────────────────────────────────────
  $effect(() => { if (visible) load(); });

  const STATUS_LABELS: Record<string, { label: string; color: string }> = {
    idle:    { label: '—',         color: 'var(--muted)' },
    planned: { label: '📋 Prévu',  color: '#60a5fa' },
    ongoing: { label: '▶️ En cours', color: 'var(--accent)' },
    done:    { label: '✅ Terminé', color: 'var(--green)' },
  };

  const EDITION_COLORS: Record<string, string> = {
    '1e': '#e5a853', '2e': '#60a5fa', '4e': '#a78bfa', 'FR': '#22c55e',
  };
</script>

<button class="al-toggle" onclick={toggle} title="Bibliothèque de Scénarios">📜</button>

{#if visible}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="al-backdrop" onclick={() => visible = false}>
    <div class="al-panel" onclick={e => e.stopPropagation()}>

      <div class="al-header">
        <span>📜 Bibliothèque de Scénarios <span class="al-count">({filtered().length}/{allScenarios.length})</span></span>
        <button class="al-close" onclick={() => visible = false}>✕</button>
      </div>

      <!-- Filters -->
      <div class="al-filters">
        <input class="al-search" bind:value={search} placeholder="🔍 Titre, auteur, tag…"/>
        <div class="al-filter-row">
          <select class="al-select" bind:value={filterEdition}>
            <option value="">Toutes éditions</option>
            <option value="FR">🇫🇷 FR</option>
            <option value="1e">1ère éd.</option>
            <option value="2e">2ème éd.</option>
            <option value="4e">4ème éd.</option>
          </select>
          <select class="al-select" bind:value={filterStatus}>
            <option value="">Tout statut</option>
            <option value="idle">Non planifié</option>
            <option value="planned">Prévu</option>
            <option value="ongoing">En cours</option>
            <option value="done">Terminé</option>
          </select>
          <select class="al-select" bind:value={filterTag}>
            <option value="">Tous tags</option>
            {#each allTags as tag}
              <option value={tag}>{tag}</option>
            {/each}
          </select>
        </div>
      </div>

      <!-- List -->
      <div class="al-list">
        {#each filtered() as s}
          {@const meta = userMeta[s.id] ?? {}}
          {@const st = meta.status ?? 'idle'}
          <div class="al-item" class:al-done={st === 'done'}>
            <div class="al-item-header">
              <div class="al-item-title">{s.title}</div>
              <div class="al-badges">
                <span class="al-badge" style="background:color-mix(in srgb,{EDITION_COLORS[s.edition] ?? '#8899b7'} 20%,transparent);color:{EDITION_COLORS[s.edition] ?? '#8899b7'};border-color:{EDITION_COLORS[s.edition] ?? '#8899b7'}">{s.edition}</span>
                {#if s.difficulty}
                  <span class="al-badge al-diff">{s.difficulty}</span>
                {/if}
              </div>
            </div>

            <div class="al-author">par {s.author}
              {#if s.source === 'marteau'}<span class="al-src">marteau.warhammer</span>{/if}
              {#if s.source === 'custom'}<span class="al-src al-custom">custom</span>{/if}
            </div>

            {#if s.description}
              <div class="al-desc">{s.description}</div>
            {/if}

            {#if s.tags && s.tags.length}
              <div class="al-tags">
                {#each s.tags as tag}
                  <button class="al-tag" onclick={() => filterTag = filterTag === tag ? '' : tag}>{tag}</button>
                {/each}
              </div>
            {/if}

            <div class="al-item-actions">
              <!-- URL buttons -->
              {#if s.url}
                <button class="al-btn al-btn-open" onclick={() => openUrl(s.url!)}>🌐 Ouvrir</button>
                <button class="al-btn al-btn-copy" onclick={() => copyUrl(s.url!, s.id)}>
                  {copiedId === s.id ? '✓ Copié' : '📋 URL'}
                </button>
              {/if}

              <!-- Status -->
              <select class="al-status-sel" style="color:{STATUS_LABELS[st].color}" value={st}
                onchange={(e) => setStatus(s.id, (e.target as HTMLSelectElement).value)}>
                {#each Object.entries(STATUS_LABELS) as [v, lbl]}
                  <option value={v}>{lbl.label}</option>
                {/each}
              </select>

              {#if s.source === 'custom'}
                <button class="al-btn al-btn-del" onclick={() => deleteCustom(s.id)}>🗑️</button>
              {/if}
            </div>

            <!-- Notes -->
            <textarea
              class="al-notes"
              placeholder="Notes MJ…"
              rows="2"
              value={meta.notes ?? ''}
              oninput={(e) => setNotes(s.id, (e.target as HTMLTextAreaElement).value)}
            ></textarea>
          </div>
        {/each}

        {#if filtered().length === 0}
          <div class="al-empty">Aucun scénario trouvé</div>
        {/if}
      </div>

      <!-- Add custom -->
      <div class="al-footer">
        {#if !showAddForm}
          <button class="al-add-btn" onclick={() => showAddForm = true}>+ Ajouter un scénario</button>
        {:else}
          <div class="al-form">
            <div class="al-form-title">Nouveau scénario</div>
            <input class="al-inp" bind:value={newTitle} placeholder="Titre *"/>
            <input class="al-inp" bind:value={newAuthor} placeholder="Auteur"/>
            <div style="display:flex;gap:6px">
              <select class="al-select" bind:value={newEdition} style="flex:1">
                <option value="FR">🇫🇷 FR</option>
                <option value="1e">1ère éd.</option>
                <option value="2e">2ème éd.</option>
                <option value="4e">4ème éd.</option>
              </select>
              <input class="al-inp" bind:value={newUrl} placeholder="URL PDF…" style="flex:2"/>
            </div>
            <textarea class="al-inp" bind:value={newDesc} placeholder="Description…" rows="2" style="resize:vertical"></textarea>
            <input class="al-inp" bind:value={newTags} placeholder="Tags : enquête, urbain, débutant…"/>
            <div style="display:flex;gap:6px;margin-top:4px">
              <button class="al-add-btn" onclick={addCustom}>Ajouter</button>
              <button class="al-cancel-btn" onclick={() => showAddForm = false}>Annuler</button>
            </div>
          </div>
        {/if}
      </div>

    </div>
  </div>
{/if}

<style>
  .al-toggle {
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 3px 8px;
    font-size: 14px;
    cursor: pointer;
    transition: all 0.15s;
  }
  .al-toggle:hover { background: var(--bg-hover); }

  .al-backdrop {
    position: fixed; inset: 0;
    background: rgba(0,0,0,0.45);
    z-index: 9200;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .al-panel {
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 12px;
    width: 620px;
    max-width: 95vw;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 16px 48px rgba(0,0,0,0.5);
    animation: slideDown 0.15s ease-out;
  }
  @keyframes slideDown {
    from { opacity: 0; transform: translateY(-8px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  .al-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 14px 16px;
    border-bottom: 1px solid var(--border);
    font-size: 14px; font-weight: 600; color: var(--text-primary);
    position: sticky; top: 0;
    background: var(--bg-secondary);
    border-radius: 12px 12px 0 0;
    flex-shrink: 0;
  }
  .al-count { font-size: 11px; color: var(--text-muted); font-weight: 400; margin-left: 6px; }
  .al-close {
    background: transparent; border: none; color: var(--text-muted);
    cursor: pointer; font-size: 14px; padding: 2px 6px; border-radius: 4px;
  }
  .al-close:hover { background: var(--bg-hover); }

  .al-filters {
    padding: 10px 14px;
    border-bottom: 1px solid var(--border);
    display: flex; flex-direction: column; gap: 6px;
    flex-shrink: 0;
  }
  .al-search {
    width: 100%; padding: 7px 10px;
    background: var(--bg-tertiary); border: 1px solid var(--border); border-radius: 6px;
    color: var(--text-primary); font-size: 13px; outline: none;
  }
  .al-search:focus { border-color: var(--accent); }
  .al-filter-row { display: flex; gap: 6px; }
  .al-select {
    flex: 1; padding: 5px 6px;
    background: var(--bg-tertiary); border: 1px solid var(--border); border-radius: 5px;
    color: var(--text-primary); font-size: 11px; outline: none; cursor: pointer;
  }

  .al-list {
    flex: 1; overflow-y: auto;
    padding: 8px 12px;
    display: flex; flex-direction: column; gap: 8px;
  }

  .al-item {
    background: var(--bg-tertiary);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 10px 12px;
    display: flex; flex-direction: column; gap: 5px;
    transition: border-color 0.1s;
  }
  .al-item:hover { border-color: color-mix(in srgb, var(--accent) 40%, var(--border)); }
  .al-done { opacity: 0.55; }

  .al-item-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; }
  .al-item-title { font-size: 13px; font-weight: 600; color: var(--text-primary); line-height: 1.3; }
  .al-badges { display: flex; gap: 4px; flex-shrink: 0; flex-wrap: wrap; justify-content: flex-end; }
  .al-badge {
    font-size: 9px; font-weight: 700; padding: 2px 6px;
    border-radius: 10px; border: 1px solid; text-transform: uppercase; letter-spacing: .05em;
  }
  .al-diff { background: rgba(139,92,246,.15); color: #a78bfa; border-color: rgba(139,92,246,.3); }

  .al-author { font-size: 11px; color: var(--text-muted); }
  .al-src {
    display: inline-block; margin-left: 6px;
    font-size: 9px; padding: 1px 5px; border-radius: 8px;
    background: rgba(229,168,83,.1); color: var(--accent); border: 1px solid rgba(229,168,83,.25);
  }
  .al-custom { background: rgba(34,197,94,.1); color: var(--green); border-color: rgba(34,197,94,.25); }

  .al-desc { font-size: 11px; color: var(--text-secondary); line-height: 1.4; }

  .al-tags { display: flex; flex-wrap: wrap; gap: 4px; }
  .al-tag {
    font-size: 10px; padding: 2px 7px;
    background: var(--bg-secondary); border: 1px solid var(--border); border-radius: 10px;
    color: var(--text-muted); cursor: pointer;
  }
  .al-tag:hover { color: var(--accent); border-color: var(--accent); }

  .al-item-actions { display: flex; gap: 5px; align-items: center; flex-wrap: wrap; margin-top: 2px; }
  .al-btn {
    padding: 4px 9px; font-size: 11px; font-weight: 600;
    border-radius: 5px; cursor: pointer; border: 1px solid; transition: all .1s;
  }
  .al-btn-open { background: rgba(229,168,83,.1); color: var(--accent); border-color: rgba(229,168,83,.3); }
  .al-btn-open:hover { background: rgba(229,168,83,.2); }
  .al-btn-copy { background: var(--bg-secondary); color: var(--text-secondary); border-color: var(--border); }
  .al-btn-copy:hover { border-color: var(--accent); color: var(--accent); }
  .al-btn-del { background: transparent; color: var(--text-muted); border-color: transparent; }
  .al-btn-del:hover { color: #ef4444; }
  .al-status-sel {
    margin-left: auto; padding: 4px 6px; font-size: 11px; font-weight: 600;
    background: var(--bg-secondary); border: 1px solid var(--border); border-radius: 5px;
    cursor: pointer; outline: none;
  }

  .al-notes {
    width: 100%; padding: 6px 8px; font-size: 11px;
    background: var(--bg-secondary); border: 1px solid var(--border); border-radius: 5px;
    color: var(--text-secondary); outline: none; resize: none;
    font-family: inherit; line-height: 1.4;
  }
  .al-notes:focus { border-color: var(--accent); }

  .al-empty { text-align: center; padding: 32px; color: var(--text-muted); font-size: 13px; }

  .al-footer {
    padding: 10px 14px;
    border-top: 1px solid var(--border);
    flex-shrink: 0;
  }
  .al-add-btn {
    width: 100%; padding: 8px; font-size: 12px; font-weight: 600;
    background: transparent; border: 1px dashed var(--border); border-radius: 6px;
    color: var(--text-muted); cursor: pointer;
  }
  .al-add-btn:hover { border-color: var(--accent); color: var(--accent); }
  .al-cancel-btn {
    flex: 1; padding: 8px; font-size: 12px;
    background: transparent; border: 1px solid var(--border); border-radius: 6px;
    color: var(--text-muted); cursor: pointer;
  }
  .al-form { display: flex; flex-direction: column; gap: 6px; }
  .al-form-title { font-size: 12px; font-weight: 600; color: var(--text-primary); margin-bottom: 2px; }
  .al-inp {
    width: 100%; padding: 7px 9px;
    background: var(--bg-tertiary); border: 1px solid var(--border); border-radius: 5px;
    color: var(--text-primary); font-size: 12px; outline: none; font-family: inherit;
  }
  .al-inp:focus { border-color: var(--accent); }
</style>
