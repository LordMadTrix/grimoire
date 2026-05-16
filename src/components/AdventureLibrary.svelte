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
    edition: string;
    source: string;
    url?: string;
    description?: string;
    difficulty?: string;
    tags?: string[];
  }

  interface SessionEntry {
    date: string;
    summary: string;
    players?: string;
  }

  interface Act {
    title: string;
    done: boolean;
  }

  interface NpcEntry {
    name: string;
    role: string;
  }

  interface UserData {
    status?: string;
    notes?: string;
    sessionLog?: SessionEntry[];
    prep?: {
      acts: Act[];
      npcs: NpcEntry[];
      locations: string[];
      objective: string;
      secrets: string;
    };
  }

  // ── Built-in data ─────────────────────────────────────────────────────────────

  const BASE = 'http://marteau.warhammer.free.fr/scenarii/';

  const BUILTIN: Scenario[] = [
    { id: 'tarkenberg',      title: 'Le Mystère de Tarkenberg',              author: 'Stéphane Guyon',                   edition: 'FR',  source: 'marteau', url: BASE + 'Le mystere de Tarkenberg.pdf',                tags: ['mystère','enquête'] },
    { id: 'el-hassan',       title: 'Le Projet El Hassan',                   author: 'Stéphane Guyon',                   edition: 'FR',  source: 'marteau', url: BASE + 'Le projet El Hassan.pdf',                    tags: ['exotique'] },
    { id: 'puits-noye',      title: 'Le Puits du Noyé',                      author: 'John Foody (trad. E. Granier)',     edition: 'FR',  source: 'marteau', url: BASE + 'Le_Puits_du_Noye.pdf',                      tags: ['horreur','enquête'] },
    { id: 'crime-chatiment', title: 'Crime ou Châtiment',                    author: 'Association Ordalie',              edition: 'FR',  source: 'marteau', url: BASE + 'crime.PDF',                                  tags: ['urbain','enquête'] },
    { id: 'raban',           title: "Ra'Ban d'Ig, la Nation du Soleil",      author: 'Denis Duperthuis',                 edition: 'FR',  source: 'marteau', url: BASE + 'RA_BAN_IG_LA_NATION_DU_SOLEIL.PDF',          tags: ['exotique','aventure'] },
    { id: 'rocs',            title: 'Rocs and Orques Altitude',              author: 'Christophe Loyre',                 edition: 'FR',  source: 'marteau', url: BASE + 'Rocs.PDF',                                   tags: ['orques','montagne'] },
    { id: 'une-amie',        title: 'Une Amie est Morte',                    author: 'Association Ordalie',              edition: 'FR',  source: 'marteau', url: BASE + 'uneamie.PDF',                                tags: ['enquête','mort'] },
    { id: 'moira',           title: 'Le Moïra est de Retour',                author: 'Association Ordalie',              edition: 'FR',  source: 'marteau', url: BASE + 'WARHA95.PDF',                                tags: ['classique'] },
    { id: 'beeckerhaven',    title: 'Le Monstre de Beeckerhaven',            author: 'Stéphane Guyon',                   edition: 'FR',  source: 'marteau', url: BASE + 'BEECKERHAVEN.PDF',                          tags: ['monstre','village'] },
    { id: 'bebes',           title: 'Des Bébés, en Veux-tu en Voilà!',      author: 'Tristan Lhomme',                   edition: 'FR',  source: 'marteau', url: BASE + 'Des_bebes.pdf',                              tags: ['horreur','humour'] },
    { id: 'allons-bois',     title: '1...2...3... Allons au Bois',           author: 'Nyogtha',                          edition: 'FR',  source: 'marteau', url: BASE + 'allons_au_bois.PDF',                         tags: ['forêt','horreur'] },
    { id: 'ange-exter',      title: "L'Ange Exterminateur",                  author: 'Inconnu',                          edition: 'FR',  source: 'marteau', url: BASE + 'ange_exterminateur.htm',                     tags: ['divin','horreur'] },
    { id: 'apprenti-sorc',   title: "L'Apprenti Sorcier",                    author: 'Alex Day',                         edition: 'FR',  source: 'marteau', url: BASE + 'apprenti_sorcier.PDF', difficulty: 'débutant', tags: ['magie','débutant'] },
    { id: 'coeur-dragon',    title: 'Le Cœur de Dragon',                     author: 'Antoine Fournier',                 edition: 'FR',  source: 'marteau', url: BASE + 'coeur_dragon.PDF',                          tags: ['dragon','aventure'] },
    { id: 'gros-prob',       title: 'Gros Problèmes',                        author: 'DEMS Samir',                       edition: 'FR',  source: 'marteau', url: BASE + 'gros_problemes.PDF',                        tags: ['humour','action'] },
    { id: 'hopital',         title: "L'Hôpital",                             author: 'Alerim le Grand',                  edition: 'FR',  source: 'marteau', url: BASE + 'HOPITAL.PDF',                                tags: ['urbain','horreur'] },
    { id: 'kensburg',        title: 'Kensburg pour Toujours',                author: 'Ripcurlpro',                       edition: 'FR',  source: 'marteau', url: BASE + 'kensburg.PDF',                               tags: ['village','mystère'] },
    { id: 'forteresse',      title: 'La Forteresse',                         author: 'Adrien',                           edition: 'FR',  source: 'marteau', url: BASE + 'La_Forteresse.PDF',                          tags: ['fort','combat'] },
    { id: 'liste-noire',     title: 'La Liste Noire',                        author: 'Kildor',                           edition: 'FR',  source: 'marteau', url: BASE + 'Liste_Noire.PDF',                            tags: ['politique','enquête'] },
    { id: 'parle-loup',      title: 'Quand on Parle du Loup...',             author: 'Syko',                             edition: 'FR',  source: 'marteau', url: BASE + 'Quand_on_parle_du_loup.pdf',                 tags: ['loup-garou','horreur'] },
    { id: 'route-est',       title: "La Route de l'Est",                     author: 'Anduril',                          edition: 'FR',  source: 'marteau', url: BASE + 'Rout_de_Est.PDF',                            tags: ['voyage','aventure'] },
    { id: 'ordre-damnes',    title: "L'Ordre Damnés",                        author: 'Kan Dan',                          edition: 'FR',  source: 'marteau', url: BASE + 'Ordre_Damnes.PDF',                          tags: ['chaos','culte'] },
    { id: 'sartosa',         title: 'Sartosa nous Voilà !',                  author: 'Sébastien Boudaud',                edition: 'FR',  source: 'marteau', url: BASE + 'Sartosa%20nous%20voila.htm',                 tags: ['piraterie','île'] },
    // ── Classiques officiels ──
    { id: 'oldenhaller',     title: 'The Oldenhaller Contract',              author: 'Games Workshop',                   edition: '1e',  source: 'officiel', description: "Scénario d'intro officiel 1ère édition. Idéal débutants.", difficulty: 'débutant',      tags: ['débutant','urbain','classique','officiel'] },
    { id: 'shadows-bog',     title: "Shadows Over Bögenhafen",               author: 'GW / Hogshead',                    edition: '1e',  source: 'officiel', description: "Premier acte de La Campagne du Chaos. Enquête sur un culte du Chaos.", difficulty: 'intermédiaire', tags: ['campagne','chaos','urbain','officiel'] },
    { id: 'death-reik',      title: 'Death on the Reik',                     author: 'GW / Hogshead',                    edition: '1e',  source: 'officiel', description: "Second acte — voyage fluvial parsemé de périls.",  difficulty: 'intermédiaire', tags: ['campagne','voyage','fluvial','officiel'] },
    { id: 'power-throne',    title: 'Power Behind the Throne',               author: 'GW / Hogshead',                    edition: '1e',  source: 'officiel', description: "Troisième acte — politique impériale à Middenheim.", difficulty: 'avancé',        tags: ['campagne','politique','officiel'] },
    { id: 'rough-nights',    title: 'Rough Nights & Hard Days',              author: 'Cubicle 7',                        edition: '4e',  source: 'officiel', description: "Cinq aventures courtes interconnectées, idéales pour débuter en 4e.", difficulty: 'débutant',  tags: ['débutant','taverne','officiel','4e'] },
    { id: 'night-of-blood',  title: 'Night of Blood',                        author: 'GW',                               edition: '1e',  source: 'officiel', description: "One-shot d'horreur classique. Groupe bloqué dans une auberge.",  difficulty: 'débutant', tags: ['débutant','horreur','one-shot','officiel'] },
  ];

  // ── State ─────────────────────────────────────────────────────────────────────

  let userData = $state<Record<string, UserData>>({});
  let search       = $state('');
  let filterEdition  = $state('');
  let filterStatus   = $state('');
  let filterTag      = $state('');
  let filterDiff     = $state('');
  let sortBy         = $state<'title'|'sessions'|'status'>('title');
  let sortDir        = $state<'asc'|'desc'>('asc');
  let showAddForm    = $state(false);
  let expandedId     = $state<string | null>(null);
  let copiedId       = $state('');
  let custom         = $state<Scenario[]>([]);

  let allScenarios = $derived([...BUILTIN, ...custom]);

  const STATUS_ORDER: Record<string, number> = { ongoing: 0, planned: 1, idle: 2, done: 3 };

  let filtered = $derived(() => {
    const q = search.toLowerCase();
    let list = allScenarios.filter(s => {
      const ud = userData[s.id] ?? {};
      if (filterEdition && s.edition !== filterEdition) return false;
      if (filterStatus && (ud.status ?? 'idle') !== filterStatus) return false;
      if (filterTag && !s.tags?.includes(filterTag)) return false;
      if (filterDiff && s.difficulty !== filterDiff) return false;
      if (!q) return true;
      return s.title.toLowerCase().includes(q)
          || s.author.toLowerCase().includes(q)
          || (s.description ?? '').toLowerCase().includes(q)
          || (s.tags ?? []).some(t => t.includes(q));
    });
    list = [...list].sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'title')    cmp = a.title.localeCompare(b.title);
      if (sortBy === 'sessions') cmp = ((userData[b.id]?.sessionLog?.length ?? 0) - (userData[a.id]?.sessionLog?.length ?? 0));
      if (sortBy === 'status')   cmp = (STATUS_ORDER[userData[a.id]?.status ?? 'idle'] ?? 2) - (STATUS_ORDER[userData[b.id]?.status ?? 'idle'] ?? 2);
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return list;
  });

  let allTags = $derived([...new Set(allScenarios.flatMap(s => s.tags ?? []))].sort());

  let stats = $derived({
    total: allScenarios.length,
    planned:  allScenarios.filter(s => userData[s.id]?.status === 'planned').length,
    ongoing:  allScenarios.filter(s => userData[s.id]?.status === 'ongoing').length,
    done:     allScenarios.filter(s => userData[s.id]?.status === 'done').length,
    sessions: Object.values(userData).reduce((n, d) => n + (d.sessionLog?.length ?? 0), 0),
  });

  // ── Persistence ───────────────────────────────────────────────────────────────

  async function load() {
    const vp = getVaultPath();
    if (!vp) return;
    try {
      const raw = await readFile(vp, '.grimoire/adventures.json');
      const data = JSON.parse(raw);
      // Migrate old format: meta.sessions (number) → sessionLog
      const migrated: Record<string, UserData> = {};
      for (const [id, v] of Object.entries((data.meta ?? {}) as Record<string, any>)) {
        migrated[id] = {
          status: v.status,
          notes: v.notes,
          sessionLog: v.sessionLog ?? (v.sessions ? [] : []),
          prep: v.prep,
        };
      }
      userData = migrated;
      custom = data.custom ?? [];
    } catch { userData = {}; custom = []; }
  }

  async function save() {
    const vp = getVaultPath();
    if (!vp) return;
    const data = JSON.stringify({ meta: userData, custom }, null, 2);
    try { await writeFile(vp, '.grimoire/adventures.json', data); }
    catch {
      await createDirectory(vp, '.grimoire');
      await writeFile(vp, '.grimoire/adventures.json', data);
    }
  }

  function ud(id: string): UserData { return userData[id] ?? {}; }

  function setStatus(id: string, status: string) {
    userData = { ...userData, [id]: { ...ud(id), status } };
    save();
  }
  function setNotes(id: string, notes: string) {
    userData = { ...userData, [id]: { ...ud(id), notes } };
    save();
  }

  // ── Session log ───────────────────────────────────────────────────────────────

  function addSession(id: string) {
    const today = new Date().toISOString().slice(0, 10);
    const log = [...(ud(id).sessionLog ?? []), { date: today, summary: '', players: '' }];
    userData = { ...userData, [id]: { ...ud(id), sessionLog: log } };
    save();
  }
  function updateSession(id: string, idx: number, field: keyof SessionEntry, val: string) {
    const log = [...(ud(id).sessionLog ?? [])];
    log[idx] = { ...log[idx], [field]: val };
    userData = { ...userData, [id]: { ...ud(id), sessionLog: log } };
    save();
  }
  function deleteSession(id: string, idx: number) {
    const log = (ud(id).sessionLog ?? []).filter((_, i) => i !== idx);
    userData = { ...userData, [id]: { ...ud(id), sessionLog: log } };
    save();
  }

  // ── Prep ─────────────────────────────────────────────────────────────────────

  function getPrep(id: string) {
    return ud(id).prep ?? { acts: [], npcs: [], locations: [], objective: '', secrets: '' };
  }
  function setPrep(id: string, prep: UserData['prep']) {
    userData = { ...userData, [id]: { ...ud(id), prep } };
    save();
  }

  function addAct(id: string)    { const p = getPrep(id); setPrep(id, { ...p, acts: [...p.acts, { title: 'Acte '+(p.acts.length+1), done: false }] }); }
  function toggleAct(id: string, i: number) { const p = getPrep(id); const acts = [...p.acts]; acts[i]={...acts[i],done:!acts[i].done}; setPrep(id,{...p,acts}); }
  function updateAct(id: string, i: number, title: string) { const p = getPrep(id); const acts=[...p.acts]; acts[i]={...acts[i],title}; setPrep(id,{...p,acts}); }
  function removeAct(id: string, i: number) { const p=getPrep(id); setPrep(id,{...p,acts:p.acts.filter((_,j)=>j!==i)}); }

  function addNpc(id: string)    { const p=getPrep(id); setPrep(id,{...p,npcs:[...p.npcs,{name:'',role:''}]}); }
  function updateNpc(id: string, i: number, f: keyof NpcEntry, v: string) { const p=getPrep(id); const npcs=[...p.npcs]; npcs[i]={...npcs[i],[f]:v}; setPrep(id,{...p,npcs}); }
  function removeNpc(id: string, i: number) { const p=getPrep(id); setPrep(id,{...p,npcs:p.npcs.filter((_,j)=>j!==i)}); }

  function updateObjective(id: string, v: string) { setPrep(id,{...getPrep(id),objective:v}); }
  function updateSecrets(id: string, v: string)   { setPrep(id,{...getPrep(id),secrets:v}); }

  // ── URL ───────────────────────────────────────────────────────────────────────

  async function openUrl(url: string) {
    try { await invoke('open_url', { url }); } catch { await copyUrl(url); }
  }
  async function copyUrl(url: string, id?: string) {
    try { await navigator.clipboard.writeText(url); if (id) { copiedId = id; setTimeout(() => copiedId = '', 2000); } } catch {}
  }

  // ── Export MD ─────────────────────────────────────────────────────────────────

  async function exportSummary(s: Scenario) {
    const ud_ = ud(s.id);
    const prep = getPrep(s.id);
    let md = `# ${s.title}\n\n**Auteur :** ${s.author}  \n**Édition :** ${s.edition}  \n**Statut :** ${ud_.status ?? 'idle'}\n`;
    if (s.description) md += `\n${s.description}\n`;
    if (prep.objective) md += `\n## Objectif session\n${prep.objective}\n`;
    if (prep.acts.length) md += `\n## Actes\n${prep.acts.map(a => `- [${a.done?'x':' '}] ${a.title}`).join('\n')}\n`;
    if (prep.npcs.length) md += `\n## PNJs\n${prep.npcs.map(n => `- **${n.name}** — ${n.role}`).join('\n')}\n`;
    if (ud_.notes) md += `\n## Notes MJ\n${ud_.notes}\n`;
    const sessions = ud_.sessionLog ?? [];
    if (sessions.length) md += `\n## Journal (${sessions.length} sessions)\n${sessions.map(s => `- ${s.date}: ${s.summary}`).join('\n')}\n`;
    await navigator.clipboard.writeText(md);
    alert('Résumé copié dans le presse-papier !');
  }

  // ── Add custom ────────────────────────────────────────────────────────────────

  let newTitle = $state(''); let newAuthor = $state(''); let newEdition = $state('FR');
  let newUrl = $state(''); let newDesc = $state(''); let newTags = $state('');
  let newDiff = $state('');

  function addCustom() {
    if (!newTitle.trim()) return;
    const sc: Scenario = {
      id: Date.now().toString(36),
      title: newTitle.trim(), author: newAuthor.trim() || 'Inconnu',
      edition: newEdition, source: 'custom',
      url: newUrl.trim() || undefined,
      description: newDesc.trim() || undefined,
      difficulty: newDiff || undefined,
      tags: newTags.split(',').map(t => t.trim()).filter(Boolean),
    };
    custom = [...custom, sc];
    newTitle=''; newAuthor=''; newEdition='FR'; newUrl=''; newDesc=''; newTags=''; newDiff='';
    showAddForm = false;
    save();
  }
  function deleteCustom(id: string) { custom = custom.filter(s => s.id !== id); save(); }

  $effect(() => { if (visible) load(); });

  const STATUS_LABELS: Record<string, { label: string; color: string }> = {
    idle:    { label: '—',           color: 'var(--text-muted)' },
    planned: { label: '📋 Prévu',    color: '#60a5fa' },
    ongoing: { label: '▶️ En cours', color: 'var(--accent)' },
    done:    { label: '✅ Terminé',  color: 'var(--green)' },
  };
  const EDITION_COLORS: Record<string, string> = {
    '1e': '#e5a853', '2e': '#60a5fa', '4e': '#a78bfa', 'FR': '#22c55e',
  };
  const DIFF_COLORS: Record<string, string> = {
    'débutant': '#22c55e', 'intermédiaire': '#eab308', 'avancé': '#ef4444',
  };
</script>

<button class="al-toggle" onclick={toggle} title="Bibliothèque de Scénarios">📜</button>

{#if visible}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="al-backdrop" onclick={() => visible = false}>
    <div class="al-panel" onclick={e => e.stopPropagation()}>

      <div class="al-header">
        <span>📜 Scénarios <span class="al-count">({filtered().length}/{allScenarios.length})</span></span>
        <button class="al-close" onclick={() => visible = false}>✕</button>
      </div>

      <!-- Stats bar -->
      <div class="al-stats">
        <span class="al-stat-pill">{stats.total} scénarios</span>
        {#if stats.ongoing > 0}
          <span class="al-stat-pill al-stat-ongoing">▶️ {stats.ongoing} en cours</span>
        {/if}
        {#if stats.planned > 0}
          <span class="al-stat-pill al-stat-planned">📋 {stats.planned} prévus</span>
        {/if}
        {#if stats.done > 0}
          <span class="al-stat-pill al-stat-done">✅ {stats.done} terminés</span>
        {/if}
        {#if stats.sessions > 0}
          <span class="al-stat-pill">⏱️ {stats.sessions} sessions</span>
        {/if}
      </div>

      <!-- Filters -->
      <div class="al-filters">
        <div class="al-search-row">
          <input class="al-search" bind:value={search} placeholder="🔍 Titre, auteur, tag…"/>
          <select class="al-select al-sort-sel" bind:value={sortBy}>
            <option value="title">Titre</option>
            <option value="sessions">Sessions</option>
            <option value="status">Statut</option>
          </select>
          <button class="al-sort-dir" onclick={() => sortDir = sortDir === 'asc' ? 'desc' : 'asc'} title="Inverser le tri">
            {sortDir === 'asc' ? '↑' : '↓'}
          </button>
        </div>
        <div class="al-filter-row">
          <select class="al-select" bind:value={filterEdition}>
            <option value="">Toutes éditions</option>
            <option value="FR">🇫🇷 FR</option>
            <option value="1e">1ère éd.</option>
            <option value="2e">2ème éd.</option>
            <option value="4e">4ème éd.</option>
          </select>
          <select class="al-select" bind:value={filterDiff}>
            <option value="">Toutes difficultés</option>
            <option value="débutant">Débutant</option>
            <option value="intermédiaire">Intermédiaire</option>
            <option value="avancé">Avancé</option>
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
          {@const meta = ud(s.id)}
          {@const st = meta.status ?? 'idle'}
          {@const prep = getPrep(s.id)}
          {@const sessions = meta.sessionLog ?? []}
          {@const isExpanded = expandedId === s.id}

          <div class="al-item" class:al-done={st === 'done'} class:al-ongoing={st === 'ongoing'} class:al-expanded={isExpanded}>

            <!-- Card header (click to expand) -->
            <div class="al-item-header" onclick={() => expandedId = isExpanded ? null : s.id} role="button" tabindex="0"
              onkeydown={(e) => e.key === 'Enter' && (expandedId = isExpanded ? null : s.id)}>
              <div>
                <div class="al-item-title">{s.title}</div>
                <div class="al-author">par {s.author}
                  {#if s.source === 'marteau'}<span class="al-src">marteau.warhammer</span>{/if}
                  {#if s.source === 'custom'}<span class="al-src al-custom">custom</span>{/if}
                </div>
              </div>
              <div class="al-badges-col">
                <span class="al-badge" style="background:color-mix(in srgb,{EDITION_COLORS[s.edition]??'#8899b7'} 20%,transparent);color:{EDITION_COLORS[s.edition]??'#8899b7'};border-color:{EDITION_COLORS[s.edition]??'#8899b7'}">{s.edition}</span>
                {#if s.difficulty}
                  <span class="al-badge" style="background:color-mix(in srgb,{DIFF_COLORS[s.difficulty]??'#a78bfa'} 15%,transparent);color:{DIFF_COLORS[s.difficulty]??'#a78bfa'};border-color:{DIFF_COLORS[s.difficulty]??'#a78bfa'}">{s.difficulty}</span>
                {/if}
                {#if sessions.length > 0}
                  <span class="al-badge al-sess-badge">⏱️ {sessions.length}</span>
                {/if}
                <span class="al-expand-arrow">{isExpanded ? '▲' : '▼'}</span>
              </div>
            </div>

            {#if s.description && !isExpanded}
              <div class="al-desc">{s.description}</div>
            {/if}

            {#if s.tags && s.tags.length && !isExpanded}
              <div class="al-tags">
                {#each s.tags as tag}
                  <button class="al-tag" onclick={(e) => { e.stopPropagation(); filterTag = filterTag === tag ? '' : tag; }}>{tag}</button>
                {/each}
              </div>
            {/if}

            <!-- Quick actions (always visible) -->
            <div class="al-item-actions" onclick={e => e.stopPropagation()}>
              {#if s.url}
                <button class="al-btn al-btn-open" onclick={() => openUrl(s.url!)}>🌐</button>
                <button class="al-btn al-btn-copy" onclick={() => copyUrl(s.url!, s.id)}>
                  {copiedId === s.id ? '✓' : '📋'}
                </button>
              {/if}
              <select class="al-status-sel" style="color:{STATUS_LABELS[st].color}" value={st}
                onchange={(e) => setStatus(s.id, (e.target as HTMLSelectElement).value)}>
                {#each Object.entries(STATUS_LABELS) as [v, lbl]}
                  <option value={v}>{lbl.label}</option>
                {/each}
              </select>
              <button class="al-btn al-btn-copy" onclick={() => exportSummary(s)} title="Exporter résumé en Markdown">📤</button>
              {#if s.source === 'custom'}
                <button class="al-btn al-btn-del" onclick={() => deleteCustom(s.id)}>🗑️</button>
              {/if}
            </div>

            <!-- ── Expanded prep view ── -->
            {#if isExpanded}
              <div class="al-prep" onclick={e => e.stopPropagation()}>

                <!-- Description -->
                {#if s.description}
                  <div class="al-prep-desc">{s.description}</div>
                {/if}

                <!-- Tags (editable in expanded) -->
                {#if s.tags && s.tags.length}
                  <div class="al-tags" style="margin-bottom:4px">
                    {#each s.tags as tag}
                      <button class="al-tag" onclick={() => filterTag = filterTag === tag ? '' : tag}>{tag}</button>
                    {/each}
                  </div>
                {/if}

                <!-- Objectif session -->
                <div class="al-prep-section">
                  <div class="al-prep-title">🎯 Objectif de session</div>
                  <textarea class="al-inp" rows="2" placeholder="Objectif principal pour la prochaine session…"
                    value={prep.objective}
                    oninput={(e) => updateObjective(s.id, (e.target as HTMLTextAreaElement).value)}
                  ></textarea>
                </div>

                <!-- Actes / chapitres -->
                <div class="al-prep-section">
                  <div class="al-prep-title-row">
                    <span class="al-prep-title">📖 Actes / Chapitres</span>
                    <button class="al-mini-btn" onclick={() => addAct(s.id)}>+ Acte</button>
                  </div>
                  {#if prep.acts.length}
                    <div class="al-acts">
                      {#each prep.acts as act, i}
                        <div class="al-act-row">
                          <button class="al-act-check" class:al-act-done={act.done} onclick={() => toggleAct(s.id, i)}>
                            {act.done ? '☑' : '☐'}
                          </button>
                          <input class="al-act-inp" value={act.title} class:al-act-title-done={act.done}
                            oninput={(e) => updateAct(s.id, i, (e.target as HTMLInputElement).value)} />
                          <button class="al-del-btn" onclick={() => removeAct(s.id, i)}>×</button>
                        </div>
                      {/each}
                    </div>
                  {:else}
                    <div class="al-empty-hint">Aucun acte — cliquez + Acte pour en ajouter</div>
                  {/if}
                </div>

                <!-- PNJs clés -->
                <div class="al-prep-section">
                  <div class="al-prep-title-row">
                    <span class="al-prep-title">🧑 PNJs clés</span>
                    <button class="al-mini-btn" onclick={() => addNpc(s.id)}>+ PNJ</button>
                  </div>
                  {#if prep.npcs.length}
                    <div class="al-npcs">
                      {#each prep.npcs as npc, i}
                        <div class="al-npc-row">
                          <input class="al-npc-name" placeholder="Nom" value={npc.name}
                            oninput={(e) => updateNpc(s.id, i, 'name', (e.target as HTMLInputElement).value)} />
                          <input class="al-npc-role" placeholder="Rôle" value={npc.role}
                            oninput={(e) => updateNpc(s.id, i, 'role', (e.target as HTMLInputElement).value)} />
                          <button class="al-del-btn" onclick={() => removeNpc(s.id, i)}>×</button>
                        </div>
                      {/each}
                    </div>
                  {:else}
                    <div class="al-empty-hint">Aucun PNJ — cliquez + PNJ pour en ajouter</div>
                  {/if}
                </div>

                <!-- Secrets MJ -->
                <div class="al-prep-section">
                  <div class="al-prep-title">🔐 Secrets MJ</div>
                  <textarea class="al-inp al-secrets" rows="2" placeholder="Informations secrètes, révélations, twist…"
                    value={prep.secrets}
                    oninput={(e) => updateSecrets(s.id, (e.target as HTMLTextAreaElement).value)}
                  ></textarea>
                </div>

                <!-- Notes générales -->
                <div class="al-prep-section">
                  <div class="al-prep-title">📝 Notes MJ</div>
                  <textarea class="al-inp" rows="3" placeholder="Notes libres…"
                    value={meta.notes ?? ''}
                    oninput={(e) => setNotes(s.id, (e.target as HTMLTextAreaElement).value)}
                  ></textarea>
                </div>

                <!-- Journal de sessions -->
                <div class="al-prep-section">
                  <div class="al-prep-title-row">
                    <span class="al-prep-title">📅 Journal de sessions ({sessions.length})</span>
                    <button class="al-mini-btn" onclick={() => addSession(s.id)}>+ Session</button>
                  </div>
                  {#each sessions as sess, i}
                    <div class="al-session">
                      <div class="al-sess-header">
                        <span class="al-sess-num">S{i+1}</span>
                        <input type="date" class="al-sess-date" value={sess.date}
                          onchange={(e) => updateSession(s.id, i, 'date', (e.target as HTMLInputElement).value)} />
                        <input class="al-sess-players" placeholder="Joueurs présents…" value={sess.players ?? ''}
                          oninput={(e) => updateSession(s.id, i, 'players', (e.target as HTMLInputElement).value)} />
                        <button class="al-del-btn" onclick={() => deleteSession(s.id, i)}>×</button>
                      </div>
                      <textarea class="al-inp al-sess-sum" rows="2" placeholder="Résumé de la session…"
                        value={sess.summary}
                        oninput={(e) => updateSession(s.id, i, 'summary', (e.target as HTMLTextAreaElement).value)}
                      ></textarea>
                    </div>
                  {/each}
                  {#if sessions.length === 0}
                    <div class="al-empty-hint">Aucune session enregistrée</div>
                  {/if}
                </div>

              </div>
            {/if}

          </div>
        {/each}

        {#if filtered().length === 0}
          <div class="al-empty">Aucun scénario trouvé</div>
        {/if}
      </div>

      <!-- Add custom -->
      <div class="al-footer">
        {#if !showAddForm}
          <button class="al-add-btn" onclick={() => showAddForm = true}>+ Ajouter un scénario personnalisé</button>
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
              <select class="al-select" bind:value={newDiff} style="flex:1">
                <option value="">Difficulté…</option>
                <option value="débutant">Débutant</option>
                <option value="intermédiaire">Intermédiaire</option>
                <option value="avancé">Avancé</option>
              </select>
            </div>
            <input class="al-inp" bind:value={newUrl} placeholder="URL PDF / ressource…"/>
            <textarea class="al-inp" bind:value={newDesc} placeholder="Description…" rows="2" style="resize:vertical"></textarea>
            <input class="al-inp" bind:value={newTags} placeholder="Tags : enquête, urbain, débutant…"/>
            <div style="display:flex;gap:6px;margin-top:4px">
              <button class="al-add-btn" style="flex:2" onclick={addCustom}>Ajouter</button>
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
    background: var(--bg-secondary); border: 1px solid var(--border);
    border-radius: 4px; padding: 3px 8px; font-size: 14px; cursor: pointer;
  }
  .al-toggle:hover { background: var(--bg-hover); }

  .al-backdrop {
    position: fixed; inset: 0; background: rgba(0,0,0,.45); z-index: 9200;
    display: flex; align-items: center; justify-content: center;
  }
  .al-panel {
    background: var(--bg-secondary); border: 1px solid var(--border); border-radius: 12px;
    width: 660px; max-width: 95vw; max-height: 88vh;
    display: flex; flex-direction: column;
    box-shadow: 0 16px 48px rgba(0,0,0,.5);
    animation: slideDown .15s ease-out;
  }
  @keyframes slideDown { from { opacity:0; transform:translateY(-8px) } to { opacity:1; transform:translateY(0) } }

  .al-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 14px 16px; border-bottom: 1px solid var(--border);
    font-size: 14px; font-weight: 600; color: var(--text-primary);
    background: var(--bg-secondary); border-radius: 12px 12px 0 0; flex-shrink: 0;
  }
  .al-count { font-size: 11px; color: var(--text-muted); font-weight: 400; margin-left: 6px; }
  .al-close { background:transparent; border:none; color:var(--text-muted); cursor:pointer; font-size:14px; padding:2px 6px; border-radius:4px; }
  .al-close:hover { background: var(--bg-hover); }

  .al-stats {
    display: flex; gap: 6px; flex-wrap: wrap;
    padding: 8px 14px; border-bottom: 1px solid var(--border); flex-shrink: 0;
  }
  .al-stat-pill {
    font-size: 11px; padding: 2px 8px; border-radius: 10px;
    background: var(--bg-tertiary); border: 1px solid var(--border); color: var(--text-muted);
  }
  .al-stat-ongoing { border-color: rgba(229,168,83,.4); color: var(--accent); background: rgba(229,168,83,.08); }
  .al-stat-planned { border-color: rgba(96,165,250,.4); color: #60a5fa; background: rgba(96,165,250,.08); }
  .al-stat-done    { border-color: rgba(34,197,94,.4);  color: var(--green); background: rgba(34,197,94,.08); }

  .al-filters {
    padding: 8px 14px; border-bottom: 1px solid var(--border);
    display: flex; flex-direction: column; gap: 6px; flex-shrink: 0;
  }
  .al-search-row { display: flex; gap: 6px; }
  .al-search {
    flex: 1; padding: 7px 10px;
    background: var(--bg-tertiary); border: 1px solid var(--border); border-radius: 6px;
    color: var(--text-primary); font-size: 13px; outline: none;
  }
  .al-search:focus { border-color: var(--accent); }
  .al-sort-sel { flex: 0 0 auto; min-width: 90px; }
  .al-sort-dir {
    padding: 4px 8px; background: var(--bg-tertiary); border: 1px solid var(--border);
    border-radius: 5px; color: var(--text-muted); cursor: pointer; font-size: 14px; font-weight: 700;
  }
  .al-sort-dir:hover { border-color: var(--accent); color: var(--accent); }
  .al-filter-row { display: flex; gap: 6px; }
  .al-select {
    flex: 1; padding: 5px 6px;
    background: var(--bg-tertiary); border: 1px solid var(--border); border-radius: 5px;
    color: var(--text-primary); font-size: 11px; outline: none; cursor: pointer;
  }

  .al-list {
    flex: 1; overflow-y: auto; padding: 8px 12px;
    display: flex; flex-direction: column; gap: 8px;
  }

  .al-item {
    background: var(--bg-tertiary); border: 1px solid var(--border);
    border-radius: 8px; padding: 10px 12px;
    display: flex; flex-direction: column; gap: 5px;
    transition: border-color .1s;
  }
  .al-item:hover { border-color: color-mix(in srgb, var(--accent) 30%, var(--border)); }
  .al-ongoing { border-left: 3px solid var(--accent); }
  .al-done    { opacity: .55; }
  .al-expanded { border-color: var(--accent); }

  .al-item-header {
    display: flex; justify-content: space-between; gap: 8px; cursor: pointer;
    user-select: none;
  }
  .al-item-title { font-size: 13px; font-weight: 600; color: var(--text-primary); line-height: 1.3; }
  .al-author { font-size: 11px; color: var(--text-muted); margin-top: 2px; }
  .al-badges-col { display: flex; flex-direction: column; align-items: flex-end; gap: 3px; flex-shrink: 0; }
  .al-badge {
    font-size: 9px; font-weight: 700; padding: 2px 6px;
    border-radius: 10px; border: 1px solid; text-transform: uppercase; letter-spacing: .05em; white-space: nowrap;
  }
  .al-sess-badge { background: rgba(255,255,255,.06); color: var(--text-muted); border-color: var(--border); }
  .al-expand-arrow { font-size: 10px; color: var(--text-muted); margin-top: 2px; }

  .al-src {
    display: inline-block; margin-left: 6px; font-size: 9px; padding: 1px 5px; border-radius: 8px;
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

  /* ── Prep view ── */
  .al-prep {
    border-top: 1px solid var(--border); padding-top: 10px; margin-top: 4px;
    display: flex; flex-direction: column; gap: 12px;
  }
  .al-prep-desc {
    font-size: 12px; color: var(--text-secondary); line-height: 1.5;
    background: rgba(229,168,83,.05); border: 1px solid rgba(229,168,83,.15);
    border-radius: 6px; padding: 8px 10px;
  }
  .al-prep-section { display: flex; flex-direction: column; gap: 5px; }
  .al-prep-title { font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: .07em; }
  .al-prep-title-row { display: flex; justify-content: space-between; align-items: center; }
  .al-mini-btn {
    font-size: 10px; padding: 2px 8px; border-radius: 5px; cursor: pointer;
    background: var(--bg-secondary); border: 1px solid var(--border); color: var(--text-muted);
  }
  .al-mini-btn:hover { border-color: var(--accent); color: var(--accent); }
  .al-empty-hint { font-size: 11px; color: var(--text-muted); font-style: italic; padding: 4px 0; }

  .al-acts { display: flex; flex-direction: column; gap: 4px; }
  .al-act-row { display: flex; align-items: center; gap: 6px; }
  .al-act-check {
    background: none; border: none; cursor: pointer; font-size: 16px; color: var(--text-muted);
    flex-shrink: 0; padding: 0; line-height: 1;
  }
  .al-act-check.al-act-done { color: var(--green); }
  .al-act-inp {
    flex: 1; background: var(--bg-secondary); border: 1px solid var(--border); border-radius: 4px;
    color: var(--text-primary); font-size: 12px; padding: 4px 8px; outline: none;
  }
  .al-act-inp:focus { border-color: var(--accent); }
  .al-act-title-done { text-decoration: line-through; color: var(--text-muted); }
  .al-del-btn {
    background: none; border: none; cursor: pointer; color: var(--text-muted); font-size: 16px;
    flex-shrink: 0; padding: 0 2px; line-height: 1;
  }
  .al-del-btn:hover { color: #ef4444; }

  .al-npcs { display: flex; flex-direction: column; gap: 4px; }
  .al-npc-row { display: flex; gap: 6px; align-items: center; }
  .al-npc-name {
    width: 110px; flex-shrink: 0;
    background: var(--bg-secondary); border: 1px solid var(--border); border-radius: 4px;
    color: var(--text-primary); font-size: 12px; padding: 4px 7px; outline: none; font-weight: 600;
  }
  .al-npc-role {
    flex: 1;
    background: var(--bg-secondary); border: 1px solid var(--border); border-radius: 4px;
    color: var(--text-secondary); font-size: 12px; padding: 4px 7px; outline: none;
  }
  .al-npc-name:focus, .al-npc-role:focus { border-color: var(--accent); }

  .al-secrets { border-color: rgba(239,68,68,.25) !important; }
  .al-secrets:focus { border-color: rgba(239,68,68,.5) !important; }

  /* ── Session log ── */
  .al-session {
    background: var(--bg-secondary); border: 1px solid var(--border); border-radius: 6px;
    padding: 8px 10px; display: flex; flex-direction: column; gap: 5px; margin-bottom: 4px;
  }
  .al-sess-header { display: flex; align-items: center; gap: 6px; }
  .al-sess-num { font-size: 10px; font-weight: 700; color: var(--accent); flex-shrink: 0; min-width: 20px; }
  .al-sess-date {
    background: var(--bg-tertiary); border: 1px solid var(--border); border-radius: 4px;
    color: var(--text-secondary); font-size: 11px; padding: 3px 6px; outline: none; flex-shrink: 0;
  }
  .al-sess-players {
    flex: 1; background: var(--bg-tertiary); border: 1px solid var(--border); border-radius: 4px;
    color: var(--text-muted); font-size: 11px; padding: 3px 6px; outline: none;
  }
  .al-sess-sum { font-size: 12px; }

  .al-inp {
    width: 100%; padding: 6px 8px; font-size: 12px;
    background: var(--bg-secondary); border: 1px solid var(--border); border-radius: 5px;
    color: var(--text-primary); outline: none; font-family: inherit; resize: vertical; line-height: 1.4;
    box-sizing: border-box;
  }
  .al-inp:focus { border-color: var(--accent); }

  .al-empty { text-align: center; padding: 32px; color: var(--text-muted); font-size: 13px; }

  .al-footer {
    padding: 10px 14px; border-top: 1px solid var(--border); flex-shrink: 0;
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
</style>
