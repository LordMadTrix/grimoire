<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import * as d3 from 'd3';
  import { invoke } from '@tauri-apps/api/core';
  import { setActiveFile, setActiveContent } from '$lib/stores/vault.svelte';
  import { readFile } from '$lib/api';
  import { getVaultPath } from '$lib/stores/vault.svelte';

  let svg: SVGSVGElement;
  let width = $state(0);
  let height = $state(0);

  type Node = { id: string, title: string, group: string, x?: number, y?: number };
  type Link = { source: any, target: any, label: string, rel_type: string };

  const REL_COLORS: Record<string, string> = {
    ally: '#22c55e', friend: '#22c55e', allié: '#22c55e',
    enemy: '#ef4444', ennemi: '#ef4444', rival: '#ef4444',
    family: '#f59e0b', famille: '#f59e0b',
    neutral: '#8899b7', default: '#4a5568',
  };

  let rawData = $state<{ nodes: Node[], links: Link[] }>({ nodes: [], links: [] });
  let selectedFilter = $state<'all' | 'npc' | 'location' | 'quest' | 'other'>('all');
  let searchQuery = $state('');
  let zoomBehavior: d3.ZoomBehavior<SVGSVGElement, unknown> | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let simulation: d3.Simulation<any, any> | null = null;

  let filteredNodes = $derived(
    rawData.nodes.filter(n => {
      const matchFilter = selectedFilter === 'all'
        ? true
        : selectedFilter === 'other'
          ? !['npc', 'location', 'quest'].includes(n.group)
          : n.group === selectedFilter;
      const matchSearch = searchQuery.trim() === ''
        ? true
        : n.title.toLowerCase().includes(searchQuery.toLowerCase()) || n.id.toLowerCase().includes(searchQuery.toLowerCase());
      return matchFilter && matchSearch;
    })
  );

  let filteredLinks = $derived.by(() => {
    const nodeIds = new Set(filteredNodes.map(n => n.id));
    return rawData.links.filter(l => {
      const sId = typeof l.source === 'object' ? l.source.id : l.source;
      const tId = typeof l.target === 'object' ? l.target.id : l.target;
      return nodeIds.has(sId) && nodeIds.has(tId);
    });
  });

  async function loadData() {
    try {
      const res: { nodes: Node[], links: Link[] } = await invoke('get_graph_data');
      rawData = res;
      renderGraph();
    } catch (err) {
      console.error('Failed to load graph data:', err);
    }
  }

  function resetZoom() {
    if (!svg || !zoomBehavior) return;
    d3.select(svg).transition().duration(500).call(zoomBehavior.transform, d3.zoomIdentity);
  }

  function renderGraph() {
    if (!svg || filteredNodes.length === 0) {
      if (svg) d3.select(svg).selectAll('*').remove();
      return;
    }

    if (simulation) { simulation.stop(); simulation = null; }

    const d3svg = d3.select(svg);
    d3svg.selectAll('*').remove();

    const g = d3svg.append('g');

    // Zoom behavior
    zoomBehavior = d3.zoom<SVGSVGElement, unknown>().on('zoom', (event) => {
      g.attr('transform', event.transform);
    });
    d3svg.call(zoomBehavior);

    const nodesCopy = filteredNodes.map(d => ({ ...d }));
    const linksCopy = filteredLinks.map(d => ({
      ...d,
      source: typeof d.source === 'object' ? d.source.id : d.source,
      target: typeof d.target === 'object' ? d.target.id : d.target,
    }));

    simulation = d3.forceSimulation(nodesCopy as any)
      .force('link', d3.forceLink(linksCopy).id((d: any) => d.id).distance(110))
      .force('charge', d3.forceManyBody().strength(-240))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(35));

    // Arrowhead marker
    const defs = d3svg.append('defs');
    defs.append('marker')
      .attr('id', 'arrow')
      .attr('viewBox', '0 -4 8 8')
      .attr('refX', 16).attr('refY', 0)
      .attr('markerWidth', 6).attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path').attr('d', 'M0,-4L8,0L0,4').attr('fill', '#4a5568');

    const link = g.append('g')
      .attr('stroke-opacity', 0.7)
      .selectAll('line')
      .data(linksCopy)
      .join('line')
      .attr('stroke-width', (d: any) => d.label ? 2 : 1.2)
      .attr('stroke', (d: any) => REL_COLORS[d.rel_type] ?? REL_COLORS[d.label] ?? REL_COLORS.default)
      .attr('marker-end', 'url(#arrow)');

    // Edge labels
    const linkLabel = g.append('g')
      .selectAll('text')
      .data(linksCopy.filter((l: any) => l.label))
      .join('text')
      .attr('text-anchor', 'middle')
      .style('font-size', '9px')
      .style('font-family', 'sans-serif')
      .style('fill', (d: any) => REL_COLORS[d.rel_type] ?? REL_COLORS[d.label] ?? '#8899b7')
      .style('pointer-events', 'none')
      .text((d: any) => d.label);

    const node = g.append('g')
      .selectAll('g')
      .data(nodesCopy)
      .join('g')
      .style('cursor', 'pointer')
      .on('click', async (event, d: any) => {
        const vaultPath = getVaultPath();
        if (vaultPath) {
          const content = await readFile(vaultPath, d.id);
          setActiveFile(d.id);
          setActiveContent(content);
        }
      });

    node.append('circle')
      .attr('r', (d: any) => d.group === 'npc' ? 8 : d.group === 'location' ? 9 : 7)
      .attr('fill', (d: any) => {
        switch (d.group) {
          case 'npc': return '#ef4444';
          case 'location': return '#3b82f6';
          case 'quest': return '#eab308';
          default: return '#10b981';
        }
      })
      .attr('stroke', '#ffffff')
      .attr('stroke-width', 2);

    node.append('text')
      .text((d: any) => d.title)
      .attr('x', 12)
      .attr('y', 4)
      .style('font-size', '11px')
      .style('font-weight', '500')
      .style('font-family', 'sans-serif')
      .style('fill', '#e2e8f0')
      .style('pointer-events', 'none');

    simulation.on('tick', () => {
      link
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y);

      linkLabel
        .attr('x', (d: any) => (d.source.x + d.target.x) / 2)
        .attr('y', (d: any) => (d.source.y + d.target.y) / 2 - 4);

      node.attr('transform', (d: any) => `translate(${d.x},${d.y})`);
    });
  }

  onMount(() => {
    loadData();
  });

  onDestroy(() => {
    if (simulation) { simulation.stop(); simulation = null; }
  });

  $effect(() => {
    filteredNodes; filteredLinks; width; height;
    renderGraph();
  });
</script>

<div class="graph-container" bind:clientWidth={width} bind:clientHeight={height}>
  <div class="graph-toolbar">
    <div class="filter-pills">
      <button class="pill" class:active={selectedFilter === 'all'} onclick={() => selectedFilter = 'all'}>🌐 Tous</button>
      <button class="pill npc-pill" class:active={selectedFilter === 'npc'} onclick={() => selectedFilter = 'npc'}>👤 PNJ</button>
      <button class="pill loc-pill" class:active={selectedFilter === 'location'} onclick={() => selectedFilter = 'location'}>🏰 Lieux</button>
      <button class="pill quest-pill" class:active={selectedFilter === 'quest'} onclick={() => selectedFilter = 'quest'}>📜 Quêtes</button>
      <button class="pill other-pill" class:active={selectedFilter === 'other'} onclick={() => selectedFilter = 'other'}>✨ Autres</button>
    </div>
    <div class="search-box">
      <input
        type="text"
        placeholder="🔍 Filtrer les notes…"
        bind:value={searchQuery}
        class="graph-search-input"
      />
      {#if searchQuery}
        <button class="clear-search-btn" onclick={() => searchQuery = ''}>✕</button>
      {/if}
    </div>
    <div class="graph-stats">
      <span>{filteredNodes.length} nœuds</span>
      <span>•</span>
      <span>{filteredLinks.length} liens</span>
    </div>
    <div class="graph-actions">
      <button class="action-btn" onclick={resetZoom} title="Réinitialiser la vue et le centrage">⌂ Centrer</button>
      <button class="action-btn" onclick={loadData} title="Recharger le graphe">🔄</button>
    </div>
  </div>

  <svg bind:this={svg} {width} {height}></svg>
</div>

<style>
  .graph-container {
    width: 100%;
    height: 100%;
    background: var(--bg-primary);
    position: relative;
    overflow: hidden;
  }
  svg { display: block; width: 100%; height: 100%; }

  .graph-toolbar {
    position: absolute;
    top: 12px;
    left: 12px;
    right: 12px;
    display: flex;
    align-items: center;
    gap: 12px;
    background: rgba(18, 20, 29, 0.85);
    backdrop-filter: blur(8px);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 8px 14px;
    z-index: 10;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
  }

  .filter-pills {
    display: flex;
    gap: 6px;
  }

  .pill {
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    color: var(--text-muted);
    font-size: 11px;
    font-weight: 500;
    padding: 4px 10px;
    border-radius: 20px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .pill:hover {
    color: var(--text-primary);
    border-color: var(--accent);
  }

  .pill.active {
    background: var(--accent);
    color: #000;
    border-color: var(--accent);
    font-weight: 600;
  }

  .search-box {
    position: relative;
    display: flex;
    align-items: center;
    min-width: 180px;
  }

  .graph-search-input {
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    color: var(--text-primary);
    font-size: 11px;
    padding: 4px 26px 4px 10px;
    border-radius: 6px;
    width: 100%;
    outline: none;
  }

  .graph-search-input:focus {
    border-color: var(--accent);
  }

  .clear-search-btn {
    position: absolute;
    right: 6px;
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    font-size: 10px;
    padding: 0;
  }

  .graph-stats {
    display: flex;
    gap: 6px;
    font-size: 11px;
    color: var(--text-muted);
    margin-left: auto;
  }

  .graph-actions {
    display: flex;
    gap: 6px;
  }

  .action-btn {
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    color: var(--text-primary);
    padding: 4px 10px;
    border-radius: 6px;
    font-size: 11px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .action-btn:hover {
    border-color: var(--accent);
    color: var(--accent);
  }
</style>
