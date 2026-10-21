<script lang="ts">
  import { onMount } from 'svelte';
  import { getCelestialCatalog, ensureCelestialFolders, type DriveFile } from '$lib/stores/celestialCache';

  const { onselect, onclose } = $props<{
    onselect: (url: string, name?: string, isEmoji?: boolean) => void;
    onclose: () => void;
  }>();

  let searchQuery = $state('');
  let selectedCategory = $state<'all' | 'pnj' | 'warrior' | 'mage' | 'monster'>('all');
  let isLoading = $state(true);
  let files = $state<DriveFile[]>([]);
  let fileInputRef: HTMLInputElement | null = null;

  // Émojis rapides prêts à l'emploi
  const fantasyEmojis = [
    '🍺', '⚔️', '🛡️', '🏹', '🔮', '👑', '🐺', '🐉', '💀', '🧙',
    '🧝', '🧛', '🧟', '🦁', '🦅', '🐴', '🗡️', '🪵', '🔥', '💧'
  ];

  // Exemples d'illustrations fantasy locales / haute résolution
  const sampleArts = [
    { name: 'Tavernier Barbu', url: 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=400&auto=format&fit=crop&q=80', cat: 'pnj' },
    { name: 'Aubergiste du Relais', url: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=400&auto=format&fit=crop&q=80', cat: 'pnj' },
    { name: 'Capitaine en Armure', url: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=400&auto=format&fit=crop&q=80', cat: 'warrior' },
    { name: 'Rôdeuse Elfe', url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=400&auto=format&fit=crop&q=80', cat: 'warrior' },
    { name: 'Sorcier Arcaniste', url: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=400&auto=format&fit=crop&q=80', cat: 'mage' },
    { name: 'Dragon Éveillé', url: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=400&auto=format&fit=crop&q=80', cat: 'monster' },
  ];

  onMount(async () => {
    isLoading = true;
    try {
      await ensureCelestialFolders(['stamps']).catch(() => {});
      const catalog = await getCelestialCatalog();
      if (catalog && catalog.files) {
        // Filtrer les fichiers images pertinents
        files = catalog.files.filter((f: DriveFile) => {
          const p = (f.path || '').toLowerCase();
          return p.includes('stamp') || p.includes('token') || p.endsWith('.png') || p.endsWith('.webp') || p.endsWith('.jpg');
        });
      }
    } catch (err) {
      console.warn('Erreur chargement catalogue Céleste:', err);
    } finally {
      isLoading = false;
    }
  });

  // Filtrage combiné recherche + catégories
  const filteredList = $derived(() => {
    const q = searchQuery.trim().toLowerCase();
    
    // Si on a des fichiers du cache Céleste
    let result = files.map(f => ({
      name: f.name.replace(/\.[^/.]+$/, ''),
      url: f.thumbUrl || f.url,
      cat: f.path.toLowerCase().includes('monster') ? 'monster' : 'pnj',
    }));

    // Fusion avec les exemples
    result = [...sampleArts, ...result];

    if (selectedCategory !== 'all') {
      result = result.filter(item => {
        if (selectedCategory === 'pnj') return item.cat === 'pnj' || item.name.toLowerCase().includes('tavern') || item.name.toLowerCase().includes('marchand');
        if (selectedCategory === 'warrior') return item.cat === 'warrior' || item.name.toLowerCase().includes('garde') || item.name.toLowerCase().includes('soldat');
        if (selectedCategory === 'mage') return item.cat === 'mage' || item.name.toLowerCase().includes('mage') || item.name.toLowerCase().includes('sorcier');
        if (selectedCategory === 'monster') return item.cat === 'monster' || item.name.toLowerCase().includes('gobelin') || item.name.toLowerCase().includes('dragon');
        return true;
      });
    }

    if (q) {
      result = result.filter(item => item.name.toLowerCase().includes(q));
    }

    return result.slice(0, 100);
  });

  function handleFileUpload(e: Event) {
    const target = e.target as HTMLInputElement;
    if (target.files && target.files[0]) {
      const file = target.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          onselect(event.target.result as string, file.name.replace(/\.[^/.]+$/, ''));
        }
      };
      reader.readAsDataURL(file);
    }
  }
</script>

<!-- Backdrop Modal -->
<div class="fixed inset-0 bg-black/80 backdrop-blur-md z-[9999] flex items-center justify-center p-4">
  <div class="bg-[#14151b] border border-[#7c3aed]/50 rounded-2xl w-full max-w-4xl max-h-[88vh] flex flex-col shadow-2xl shadow-purple-950/40 overflow-hidden text-gray-200">
    
    <!-- Header -->
    <div class="p-4 sm:p-5 bg-[#1a1b24] border-b border-[#2d2e3f] flex items-center justify-between">
      <div class="flex items-center gap-3">
        <span class="text-2xl">🌌</span>
        <div>
          <h3 class="text-lg font-bold text-white flex items-center gap-2">
            Bibliothèque Céleste — Galerie de Portraits & Tampons
          </h3>
          <p class="text-xs text-gray-400">Choisis une illustration pour l'insérer dans ton pion personnalisé</p>
        </div>
      </div>
      <button 
        class="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition-all text-sm font-semibold"
        onclick={onclose}
      >
        ✕ Fermer
      </button>
    </div>

    <!-- Barre d'actions & Recherche -->
    <div class="p-3 sm:p-4 bg-[#101116] border-b border-[#242533] flex flex-wrap gap-2.5 items-center justify-between">
      <div class="flex-1 min-w-[220px]">
        <input 
          type="text" 
          bind:value={searchQuery}
          placeholder="🔍 Rechercher : Tavernier, Garde, Gobelin, Mage..."
          class="w-full bg-[#1e202c] border border-white/10 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-[#a78bfa]"
        />
      </div>

      <!-- Import local & Émojis -->
      <div class="flex gap-2">
        <input 
          type="file" 
          accept="image/*" 
          class="hidden" 
          bind:this={fileInputRef} 
          onchange={handleFileUpload} 
        />
        <button 
          class="px-3 py-2 bg-[#252838] hover:bg-[#32364c] border border-white/10 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all"
          onclick={() => fileInputRef?.click()}
        >
          📂 Mon Image (PC)
        </button>
      </div>
    </div>

    <!-- Filtres de Catégories & Barre d'émojis -->
    <div class="px-4 py-2 bg-[#161720] border-b border-[#242533] flex items-center justify-between gap-2 overflow-x-auto">
      <div class="flex gap-1.5 shrink-0">
        <button 
          class="px-2.5 py-1 rounded text-xs font-semibold transition-all {selectedCategory === 'all' ? 'bg-[#7c3aed] text-white' : 'bg-white/5 text-gray-300 hover:bg-white/10'}"
          onclick={() => selectedCategory = 'all'}
        >
          Tous
        </button>
        <button 
          class="px-2.5 py-1 rounded text-xs font-semibold transition-all {selectedCategory === 'pnj' ? 'bg-[#7c3aed] text-white' : 'bg-white/5 text-gray-300 hover:bg-white/10'}"
          onclick={() => selectedCategory = 'pnj'}
        >
          🍺 PNJ & Taverne
        </button>
        <button 
          class="px-2.5 py-1 rounded text-xs font-semibold transition-all {selectedCategory === 'warrior' ? 'bg-[#7c3aed] text-white' : 'bg-white/5 text-gray-300 hover:bg-white/10'}"
          onclick={() => selectedCategory = 'warrior'}
        >
          ⚔️ Gardes & Guerriers
        </button>
        <button 
          class="px-2.5 py-1 rounded text-xs font-semibold transition-all {selectedCategory === 'mage' ? 'bg-[#7c3aed] text-white' : 'bg-white/5 text-gray-300 hover:bg-white/10'}"
          onclick={() => selectedCategory = 'mage'}
        >
          🔮 Magie & Arcanes
        </button>
        <button 
          class="px-2.5 py-1 rounded text-xs font-semibold transition-all {selectedCategory === 'monster' ? 'bg-[#7c3aed] text-white' : 'bg-white/5 text-gray-300 hover:bg-white/10'}"
          onclick={() => selectedCategory = 'monster'}
        >
          🐉 Monstres
        </button>
      </div>

      <!-- Émojis rapides -->
      <div class="flex items-center gap-1 shrink-0 pl-2 border-l border-white/10">
        <span class="text-[11px] text-gray-500 mr-1">Émojis :</span>
        {#each fantasyEmojis.slice(0, 8) as emoji}
          <button 
            class="w-6 h-6 flex items-center justify-center hover:scale-125 transition-transform"
            onclick={() => onselect('', emoji, true)}
          >
            {emoji}
          </button>
        {/each}
      </div>
    </div>

    <!-- Grille de cartes -->
    <div class="p-4 overflow-y-auto flex-1 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
      {#if isLoading}
        <div class="col-span-full py-16 flex flex-col items-center justify-center gap-2 text-gray-400">
          <div class="w-8 h-8 border-2 border-[#7c3aed] border-t-transparent rounded-full animate-spin"></div>
          <span class="text-sm">Chargement de la Bibliothèque Céleste...</span>
        </div>
      {:else if filteredList().length === 0}
        <div class="col-span-full py-16 text-center text-gray-500">
          Aucun portrait ou tampon trouvé pour « {searchQuery} ».
        </div>
      {:else}
        {#each filteredList() as item}
          <button 
            class="bg-[#1c1e2a] hover:bg-[#25283a] border border-[#2e3146] hover:border-[#a78bfa] rounded-xl p-2 flex flex-col items-center text-center group transition-all hover:-translate-y-1 hover:shadow-lg hover:shadow-purple-900/30 cursor-pointer"
            onclick={() => onselect(item.url, item.name)}
          >
            <div class="w-full aspect-square rounded-lg overflow-hidden bg-black/40 mb-2 flex items-center justify-center">
              <img 
                src={item.url} 
                alt={item.name} 
                class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                loading="lazy"
              />
            </div>
            <span class="text-xs font-semibold text-gray-200 truncate w-full group-hover:text-[#c4b5fd]">
              {item.name}
            </span>
          </button>
        {/each}
      {/if}
    </div>

  </div>
</div>
