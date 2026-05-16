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
  type Link = { source: string, target: string, label: string, rel_type: string };

  const REL_COLORS: Record<string, string> = {
    ally: '#22c55e', friend: '#22c55e', allié: '#22c55e',
    enemy: '#ef4444', ennemi: '#ef4444', rival: '#ef4444',
    family: '#f59e0b', famille: '#f59e0b',
    neutral: '#8899b7', default: '#4a5568',
  };

  let data = $state<{ nodes: Node[], links: Link[] }>({ nodes: [], links: [] });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let simulation: d3.Simulation<any, any> | null = null;

  async function loadData() {
    try {
      data = await invoke('get_graph_data');
      renderGraph();
    } catch (err) {
      console.error('Failed to load graph data:', err);
    }
  }

  function renderGraph() {
    if (!svg || data.nodes.length === 0) return;

    if (simulation) { simulation.stop(); simulation = null; }

    const d3svg = d3.select(svg);
    d3svg.selectAll('*').remove();

    const g = d3svg.append('g');

    // Zoom behavior
    d3svg.call(d3.zoom<SVGSVGElement, unknown>().on('zoom', (event) => {
      g.attr('transform', event.transform);
    }));

    simulation = d3.forceSimulation(data.nodes as any)
      .force('link', d3.forceLink(data.links).id((d: any) => d.id).distance(100))
      .force('charge', d3.forceManyBody().strength(-200))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(30));

    // Arrowhead marker
    const defs = d3svg.append('defs');
    defs.append('marker')
      .attr('id', 'arrow')
      .attr('viewBox', '0 -4 8 8')
      .attr('refX', 14).attr('refY', 0)
      .attr('markerWidth', 6).attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path').attr('d', 'M0,-4L8,0L0,4').attr('fill', '#4a5568');

    const link = g.append('g')
      .attr('stroke-opacity', 0.7)
      .selectAll('line')
      .data(data.links)
      .join('line')
      .attr('stroke-width', (d: any) => d.label ? 2 : 1)
      .attr('stroke', (d: any) => REL_COLORS[d.rel_type] ?? REL_COLORS[d.label] ?? REL_COLORS.default)
      .attr('marker-end', 'url(#arrow)');

    // Edge labels for named relations
    const linkLabel = g.append('g')
      .selectAll('text')
      .data(data.links.filter((l: any) => l.label))
      .join('text')
      .attr('text-anchor', 'middle')
      .style('font-size', '8px')
      .style('fill', (d: any) => REL_COLORS[d.rel_type] ?? REL_COLORS[d.label] ?? '#8899b7')
      .style('pointer-events', 'none')
      .text((d: any) => d.label);

    const node = g.append('g')
      .selectAll('g')
      .data(data.nodes)
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
      .attr('r', 6)
      .attr('fill', (d: any) => {
        switch (d.group) {
          case 'npc': return '#ef4444';
          case 'location': return '#3b82f6';
          case 'quest': return '#eab308';
          default: return '#8899b7';
        }
      })
      .attr('stroke', '#fff')
      .attr('stroke-width', 1.5);

    node.append('text')
      .text((d: any) => d.title)
      .attr('x', 10)
      .attr('y', 4)
      .style('font-size', '10px')
      .style('fill', '#e2e8f0')
      .style('pointer-events', 'none');

    simulation!.on('tick', () => {
      link
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y);

      linkLabel
        .attr('x', (d: any) => (d.source.x + d.target.x) / 2)
        .attr('y', (d: any) => (d.source.y + d.target.y) / 2 - 3);

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
    if (width && height) renderGraph();
  });
</script>

<div class="graph-container" bind:clientWidth={width} bind:clientHeight={height}>
  <svg bind:this={svg} {width} {height}></svg>
  <button class="refresh-btn" onclick={loadData}>🔄</button>
</div>

<style>
  .graph-container {
    width: 100%;
    height: 100%;
    background: var(--bg-primary);
    position: relative;
    overflow: hidden;
  }
  svg { display: block; }
  .refresh-btn {
    position: absolute;
    top: 10px;
    right: 10px;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    color: var(--text-primary);
    padding: 5px;
    border-radius: 4px;
    cursor: pointer;
  }
</style>
