<script lang="ts">
  // NPC Relationship Map — graphe SVG drag-and-drop

  type NpcNode = {
    id: string;
    name: string;
    role: string;
    x: number;
    y: number;
    color: string;
  };

  type NpcEdge = {
    id: string;
    from: string;
    to: string;
    label: string;
    type: 'ally' | 'enemy' | 'neutral' | 'family' | 'secret';
  };

  const EDGE_COLORS: Record<NpcEdge['type'], string> = {
    ally: '#22c55e', enemy: '#ef4444', neutral: '#8899b7', family: '#e5a853', secret: '#a855f7',
  };

  const NODE_COLORS = ['#3b82f6','#ef4444','#22c55e','#e5a853','#a855f7','#ec4899','#14b8a6','#f97316'];

  let nodes = $state<NpcNode[]>([]);
  let edges = $state<NpcEdge[]>([]);

  // Formulaire ajout nœud
  let newName = $state('');
  let newRole = $state('');
  let newColor = $state(NODE_COLORS[0]);

  // Formulaire ajout lien
  let edgeFrom = $state('');
  let edgeTo = $state('');
  let edgeLabel = $state('');
  let edgeType = $state<NpcEdge['type']>('neutral');

  // Drag
  let draggingId: string | null = null;
  let dragOffX = 0;
  let dragOffY = 0;
  let svgEl: SVGSVGElement;

  // Ajout nœud centré dans le SVG
  function addNode() {
    if (!newName.trim()) return;
    const id = Math.random().toString(36).slice(2);
    nodes = [...nodes, {
      id, name: newName.trim(), role: newRole.trim(),
      x: 200 + Math.random() * 200, y: 120 + Math.random() * 120,
      color: newColor,
    }];
    newName = ''; newRole = '';
  }

  function removeNode(id: string) {
    nodes = nodes.filter(n => n.id !== id);
    edges = edges.filter(e => e.from !== id && e.to !== id);
  }

  function addEdge() {
    if (!edgeFrom || !edgeTo || edgeFrom === edgeTo) return;
    edges = [...edges, { id: Math.random().toString(36).slice(2), from: edgeFrom, to: edgeTo, label: edgeLabel, type: edgeType }];
    edgeLabel = ''; edgeFrom = ''; edgeTo = '';
  }

  function removeEdge(id: string) { edges = edges.filter(e => e.id !== id); }

  function onNodeMouseDown(e: MouseEvent, id: string) {
    e.preventDefault();
    draggingId = id;
    const node = nodes.find(n => n.id === id)!;
    const svgRect = svgEl.getBoundingClientRect();
    const vbW = 600, vbH = 400;
    const scaleX = vbW / svgRect.width;
    const scaleY = vbH / svgRect.height;
    dragOffX = (e.clientX - svgRect.left) * scaleX - node.x;
    dragOffY = (e.clientY - svgRect.top) * scaleY - node.y;
  }

  function onSvgMouseMove(e: MouseEvent) {
    if (!draggingId) return;
    const svgRect = svgEl.getBoundingClientRect();
    const vbW = 600, vbH = 400;
    const scaleX = vbW / svgRect.width;
    const scaleY = vbH / svgRect.height;
    const nx = (e.clientX - svgRect.left) * scaleX - dragOffX;
    const ny = (e.clientY - svgRect.top) * scaleY - dragOffY;
    nodes = nodes.map(n => n.id === draggingId ? { ...n, x: Math.max(30, Math.min(570, nx)), y: Math.max(30, Math.min(370, ny)) } : n);
  }

  function onSvgMouseUp() { draggingId = null; }

  function exportSvg() {
    const svgData = svgEl.outerHTML;
    const blob = new Blob([svgData], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'relations-pnj.svg'; a.click();
    URL.revokeObjectURL(url);
  }

  function getNodeById(id: string) { return nodes.find(n => n.id === id); }

  // Midpoint label position for edges
  function edgeMid(e: NpcEdge) {
    const f = getNodeById(e.from), t = getNodeById(e.to);
    if (!f || !t) return { x: 0, y: 0 };
    return { x: (f.x + t.x) / 2, y: (f.y + t.y) / 2 };
  }
</script>

<div class="nrm-wrap">
  <!-- SVG graphe -->
  <svg
    bind:this={svgEl}
    viewBox="0 0 600 400"
    class="nrm-svg"
    onmousemove={onSvgMouseMove}
    onmouseup={onSvgMouseUp}
    onmouseleave={onSvgMouseUp}
    role="img"
    aria-label="Graphe des relations PNJ"
  >
    <defs>
      {#each Object.entries(EDGE_COLORS) as [type, color]}
        <marker id="arrow-{type}" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
          <path d="M0,0 L0,6 L8,3 z" fill={color} />
        </marker>
      {/each}
    </defs>

    <!-- Arêtes -->
    {#each edges as edge (edge.id)}
      {@const f = getNodeById(edge.from)}
      {@const t = getNodeById(edge.to)}
      {@const mid = edgeMid(edge)}
      {#if f && t}
        <line
          x1={f.x} y1={f.y} x2={t.x} y2={t.y}
          stroke={EDGE_COLORS[edge.type]}
          stroke-width="2"
          stroke-dasharray={edge.type === 'secret' ? '6 4' : undefined}
          marker-end="url(#arrow-{edge.type})"
          opacity="0.75"
        />
        {#if edge.label}
          <text x={mid.x} y={mid.y - 5} text-anchor="middle" font-size="10" fill={EDGE_COLORS[edge.type]} opacity="0.9">{edge.label}</text>
        {/if}
        <circle cx={mid.x} cy={mid.y} r="5" fill="rgba(0,0,0,0.4)" class="edge-del" onclick={() => removeEdge(edge.id)} style="cursor:pointer" />
        <text x={mid.x} y={mid.y + 4} text-anchor="middle" font-size="8" fill="#ef4444" style="cursor:pointer;pointer-events:none">✕</text>
      {/if}
    {/each}

    <!-- Nœuds -->
    {#each nodes as node (node.id)}
      <g
        transform="translate({node.x},{node.y})"
        onmousedown={(e) => onNodeMouseDown(e, node.id)}
        style="cursor:grab"
        role="button"
        tabindex="0"
        aria-label={node.name}
      >
        <circle r="28" fill={node.color} fill-opacity="0.2" stroke={node.color} stroke-width="2" />
        <text y="4" text-anchor="middle" font-size="11" font-weight="bold" fill="white">{node.name.slice(0, 10)}</text>
        {#if node.role}
          <text y="17" text-anchor="middle" font-size="9" fill="rgba(255,255,255,0.6)">{node.role.slice(0, 14)}</text>
        {/if}
        <!-- Bouton supprimer -->
        <circle cx="22" cy="-22" r="7" fill="#ef4444" fill-opacity="0.85" onclick={(e) => { e.stopPropagation(); removeNode(node.id); }} style="cursor:pointer" />
        <text x="22" y="-18" text-anchor="middle" font-size="9" fill="white" style="pointer-events:none">✕</text>
      </g>
    {/each}

    {#if nodes.length === 0}
      <text x="300" y="200" text-anchor="middle" font-size="13" fill="rgba(255,255,255,0.25)">Ajoutez des PNJs pour commencer</text>
    {/if}
  </svg>

  <!-- Panneau latéral -->
  <div class="nrm-panel">
    <!-- Ajouter PNJ -->
    <div class="nrm-section">
      <div class="nrm-sec-title">+ PNJ</div>
      <input class="nrm-input" bind:value={newName} placeholder="Nom" />
      <input class="nrm-input" bind:value={newRole} placeholder="Rôle (ex: Maire)" />
      <div class="nrm-color-row">
        {#each NODE_COLORS as c}
          <button
            class="nrm-color-btn"
            class:selected={newColor === c}
            style="background:{c}"
            onclick={() => newColor = c}
          ></button>
        {/each}
      </div>
      <button class="nrm-btn" onclick={addNode}>Ajouter</button>
    </div>

    <!-- Ajouter lien -->
    <div class="nrm-section">
      <div class="nrm-sec-title">Lien</div>
      <select class="nrm-input" bind:value={edgeFrom}>
        <option value="">De…</option>
        {#each nodes as n}<option value={n.id}>{n.name}</option>{/each}
      </select>
      <select class="nrm-input" bind:value={edgeTo}>
        <option value="">Vers…</option>
        {#each nodes as n}<option value={n.id}>{n.name}</option>{/each}
      </select>
      <input class="nrm-input" bind:value={edgeLabel} placeholder="Étiquette" />
      <select class="nrm-input" bind:value={edgeType}>
        <option value="neutral">Neutre</option>
        <option value="ally">Allié</option>
        <option value="enemy">Ennemi</option>
        <option value="family">Famille</option>
        <option value="secret">Secret</option>
      </select>
      <button class="nrm-btn" onclick={addEdge}>Relier</button>
    </div>

    <button class="nrm-btn nrm-export" onclick={exportSvg}>💾 Export SVG</button>
  </div>
</div>

<style>
  .nrm-wrap {
    display: flex; gap: 10px;
    height: 100%;
    min-height: 420px;
  }
  .nrm-svg {
    flex: 1;
    background: var(--bg-tertiary, #1c2233);
    border: 1px solid var(--border, #2d3748);
    border-radius: 8px;
    min-height: 380px;
    user-select: none;
  }
  .nrm-panel {
    width: 160px;
    display: flex; flex-direction: column; gap: 10px;
    flex-shrink: 0;
  }
  .nrm-section {
    background: var(--bg-secondary, #161b22);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 8px;
    display: flex; flex-direction: column; gap: 5px;
  }
  .nrm-sec-title { font-size: 11px; font-weight: 700; color: var(--accent, #e5a853); }
  .nrm-input {
    background: var(--bg-tertiary); border: 1px solid var(--border);
    border-radius: 4px; color: var(--text-primary, #c9d1d9);
    padding: 4px 6px; font-size: 11px; width: 100%; box-sizing: border-box;
  }
  .nrm-color-row { display: flex; gap: 4px; flex-wrap: wrap; }
  .nrm-color-btn {
    width: 16px; height: 16px; border-radius: 50%; border: 2px solid transparent; cursor: pointer;
  }
  .nrm-color-btn.selected { border-color: white; }
  .nrm-btn {
    background: var(--accent, #e5a853); color: #000;
    border: none; border-radius: 5px; padding: 5px 8px;
    font-size: 11px; font-weight: 700; cursor: pointer;
    width: 100%;
  }
  .nrm-btn:hover { filter: brightness(1.1); }
  .nrm-export { background: var(--bg-tertiary); color: var(--text-muted); border: 1px solid var(--border); }
  .edge-del { transition: opacity 0.1s; }
</style>
