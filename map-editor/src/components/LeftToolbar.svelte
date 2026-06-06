<script lang="ts">
  import { mapStore } from '../lib/stores/mapStore.svelte';

  let { 
    onSave = () => {},
    onToggleGrid = () => {}
  }: { 
    onSave?: () => void;
    onToggleGrid?: () => void;
  } = $props();

  // Liste des outils de la navigation gauche d'Inkarnate
  // grid -> Select, paint -> Brush, stamp -> Stamp, path -> Line, text -> Text
  const TOOLS = [
    { id: 'grid', label: 'Select', svgPath: 'M7.12849 2.58075C6.8952 2.36489 6.52359 2.53034 6.52794 2.84813L6.66554 12.9362C6.66973 13.2419 7.02158 13.4115 7.25442 13.2201L9.2347 11.5919C9.41332 11.445 9.6833 11.5119 9.77899 11.7269L11.3586 15.2748C11.519 15.6349 11.9356 15.7993 12.2892 15.6418L12.781 15.4229C13.1346 15.2654 13.2913 14.8459 13.1309 14.4857L11.5513 10.9378C11.4556 10.7229 11.5865 10.4775 11.8152 10.443L14.3502 10.0608C14.6483 10.0159 14.7577 9.64089 14.5333 9.43324L7.12849 2.58075Z', viewBox: '0 0 19 18' },
    { id: 'paint', label: 'Brush', svgPath: 'M13.2032 16.3395C12.3361 16.4135 11.4396 16.1804 10.6897 15.6154C9.65163 14.8331 9.14752 13.605 9.24327 12.3986C9.3116 11.5368 9.71935 10.7372 10.3314 10.1267L17.0259 3.45038C17.8044 2.67419 19.0352 2.58889 19.9132 3.2505C20.7811 3.90447 21.0437 5.09293 20.5325 6.05197L16.0937 14.3762C15.5122 15.4667 14.4345 16.2344 13.2032 16.3395ZM5.59913 16.7108C6.79975 15.4147 8.83784 15.2676 10.2237 16.3631C11.6749 17.5101 11.9838 19.5685 10.8304 21.0992C9.40424 22.9917 7.26495 23.6338 4.87977 22.2356C2.38899 20.7755 2.13465 18.811 2.16839 17.8985C2.17593 17.6922 2.41837 17.5862 2.57367 17.722C3.23684 18.3024 3.80803 18.5358 4.28595 18.5728C4.52019 18.5909 4.728 18.4348 4.78517 18.2068C4.92005 17.6697 5.18845 17.1542 5.59913 16.7108Z', viewBox: '0 0 24 24' },
    { id: 'stamp', label: 'Stamp', svgPath: 'M17.2327 7.36565H6.41609C5.5916 7.36565 4.92317 6.69722 4.92317 5.87254V4.86508V4.1539V3.16535C4.92317 2.52183 5.44482 2 6.08834 2C6.73185 2 7.25368 2.52183 7.25368 3.16535V4.1539H8.74697V3.16535C8.74697 2.52183 9.2688 2 9.91232 2C10.556 2 11.0777 2.52183 11.0777 3.16535V4.1539H12.5711V3.16535C12.5711 2.52183 13.0928 2 13.7363 2C14.38 2 14.9016 2.52183 14.9016 3.16535V4.1539H16.3951V3.16535C16.3951 2.52183 16.9168 2 17.5605 2C18.204 2 18.7256 2.52183 18.7256 3.16535V4.1539V4.86508V5.87254C18.7256 6.69722 18.0572 7.36565 17.2327 7.36565ZM9.77109 20.765H14.0352V16.5554C14.0352 15.3779 13.0807 14.4232 11.9032 14.4232C10.7256 14.4232 9.77109 15.3779 9.77109 16.5554V20.765ZM18.6772 20.2912H20.5228C20.9555 20.2912 21.3063 20.6419 21.3063 21.0748C21.3063 21.5075 20.9555 21.8584H18.9711H4.87162H3.28357C2.85068 21.8584 2.5 21.5075 2.5 21.0748C2.5 20.6419 2.85068 20.2912 3.28357 20.2912H5.16555L7.23796 9.24798H16.6048L18.6772 20.2912Z', viewBox: '0 0 24 24' },
    { id: 'path', label: 'Line', svgPath: 'M19.9116 11.0954C18.9467 12.8767 17.3325 14.25 15 14.25C14.0042 14.25 13.2402 14.1074 12.6002 13.8425C11.9817 13.5866 11.5521 13.2427 11.244 12.996C11.2356 12.9893 11.2273 12.9827 11.2191 12.9761C10.9039 12.7239 10.7149 12.5796 10.4439 12.4675C10.1777 12.3574 9.7542 12.25 9 12.25C7.83254 12.25 6.9467 12.8767 6.28661 14.0954C5.60523 15.3533 5.25 17.1281 5.25 19H2.75C2.75 16.8719 3.14477 14.6467 4.08839 12.9046C5.0533 11.1233 6.66746 9.75 9 9.75C9.9958 9.75 10.7598 9.89263 11.3998 10.1575C12.0183 10.4134 12.4479 10.7573 12.756 11.004C12.7644 11.0107 12.7727 11.0173 12.7809 11.0239C13.0961 11.2761 13.2851 11.4204 13.5561 11.5325C13.8223 11.6426 14.2458 11.75 15 11.75C16.1675 11.75 17.0533 11.1233 17.7134 9.90465C18.3948 8.6467 18.75 6.8719 18.75 5H21.25C21.25 7.1281 20.8552 9.3533 19.9116 11.0954Z', viewBox: '0 0 24 24' },
    { id: 'shape', label: 'Forme', svgPath: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm-4-4h8V8H8v8z', viewBox: '0 0 24 24' },
    { id: 'text', label: 'Text', svgPath: 'M16.9409 21.5V20.9816H16.3128C15.7731 20.9816 15.3474 20.8905 15.0357 20.7083C14.724 20.5262 14.5146 20.3137 14.4076 20.0708C14.3006 19.8279 14.2471 19.2207 14.2471 18.2493V18.2493V3.59292H15.6568C16.5408 3.59292 17.1596 3.67699 17.5131 3.84513C18.1459 4.15339 18.6437 4.56674 19.0066 5.08518C19.3695 5.60361 19.6998 6.456 19.9975 7.64233V7.64233H20.5V2.5H3.5V7.64233H4.03038C4.24439 6.24115 4.75616 5.16224 5.56568 4.4056C6.14258 3.86382 7.06842 3.59292 8.34319 3.59292V3.59292H9.711V18.2493C9.711 19.2021 9.65982 19.7906 9.55747 20.0147C9.4179 20.3323 9.22715 20.5565 8.98522 20.6873C8.65025 20.8835 8.20826 20.9816 7.65928 20.9816V20.9816H7.0312V21.5H16.9409Z', viewBox: '0 0 24 24' },
    { id: 'dungeon', label: 'Générateur de Donjon', svgPath: 'M19 4H5c-1.11 0-2 .9-2 2v12c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 14H5V6h14v12zm-8-2h2v-2h-2v2zm0-4h2V8h-2v4z', viewBox: '0 0 24 24' },
    { id: 'background', label: 'Arrière-plan', svgPath: 'M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z', viewBox: '0 0 24 24' },
  ];

  // Outils utilitaires additionnels d'Inkarnate (Room, Note, Zoom, Save)
  const UTILS = [
    { id: 'room', label: 'Room', svgPath: 'M16 5C16 3.89543 15.1046 3 14 3H5C3.89543 3 3 3.89543 3 5V14C3 15.1046 3.89543 16 5 16H8V19C8 20.1046 8.89543 21 10 21H19C20.1046 21 21 20.1046 21 19V10C21 8.89543 20.1046 8 19 8H16V5ZM5.5 5.5H13.5V10.5H18.5V18.5H10.5V13.5H5.5V5.5Z', viewBox: '0 0 24 24', action: 'grid_toggle' },
    { id: 'note', label: 'Note', svgPath: 'M14.5395 7.22464V5.33468L16.2369 7.22464H14.5395ZM6.7803 18.9137V4.7803H12.7592V8.11479C12.7592 8.60651 13.1577 9.00494 13.6494 9.00494H16.9034V18.9137H6.7803ZM14.8358 3H6.62007C5.72529 3 5 3.72529 5 4.62042V19.0736C5 19.9684 5.72529 20.694 6.62007 20.694H17.0633C17.9584 20.694 18.6837 19.9684 18.6837 19.0736V7.28481L14.8358 3ZM14.2329 10.9485H9.48659C9.03547 10.9485 8.66979 11.3142 8.66979 11.7653V12.0177C8.66979 12.4692 9.03547 12.8349 9.48659 12.8349H14.2329C14.684 12.8349 15.0497 12.4692 15.0497 12.0177V11.7653C15.0497 11.3142 14.684 10.9485 14.2329 10.9485ZM9.48659 14.0607H14.2329C14.684 14.0607 15.0497 14.4264 15.0497 14.8775V15.1299C15.0497 15.5814 14.684 15.9471 14.2329 15.9471H9.48659C9.03547 15.9471 8.66979 15.5814 8.66979 15.1299V14.8775C8.66979 14.4264 9.03547 14.0607 9.48659 14.0607Z', viewBox: '0 0 24 24', action: 'show_notes' },
    { id: 'zoom', label: 'Zoom', svgPath: 'M10.4791 9.9242H11.0961L14.9933 13.8293L13.8296 14.993L9.92454 11.0957V10.4787L9.71366 10.26C8.8233 11.0254 7.6674 11.4862 6.40996 11.4862C3.60611 11.4862 1.33334 9.21348 1.33334 6.40962C1.33334 3.60577 3.60611 1.33301 6.40996 1.33301C9.21381 1.33301 11.4866 3.60577 11.4866 6.40962C11.4866 7.66706 11.0258 8.82297 10.2604 9.71333L10.4791 9.9242ZM2.89538 6.40962C2.89538 8.35436 4.46522 9.9242 6.40996 9.9242C8.35469 9.9242 9.92454 8.35436 9.92454 6.40962C9.92454 4.46489 8.35469 2.89504 6.40996 2.89504C4.46522 2.89504 2.89538 4.46489 2.89538 6.40962ZM6.80047 6.80013H8.3625V6.01911H6.80047V4.45708H6.01945V6.01911H4.45741V6.80013H6.01945V8.36217H6.80047V6.80013Z', viewBox: '0 0 16 16', action: 'zoom_reset' },
    { id: 'save', label: 'Save', svgPath: 'M433.941 129.941l-83.882-83.882A48 48 0 0 0 316.118 32H48C21.49 32 0 53.49 0 80v352c0 26.51 21.49 48 48 48h352c26.51 0 48-21.49 48-48V163.882a48 48 0 0 0-14.059-33.941zM224 416c-35.346 0-64-28.654-64-64 0-35.346 28.654-64 64-64s64 28.654 64 64c0 35.346-28.654 64-64 64zm96-304.52V212c0 6.627-5.373 12-12 12H76c-6.627 0-12-5.373-12-12V108c0-6.627 5.373-12 12-12h228.52c3.183 0 6.235 1.264 8.485 3.515l3.48 3.48A11.996 11.996 0 0 1 320 111.48z', viewBox: '0 0 448 512', action: 'save_project' },
  ];

  function handleUtilAction(action: string) {
    if (action === 'save_project') {
      onSave();
    } else if (action === 'grid_toggle') {
      mapStore.showGrid = !mapStore.showGrid;
    } else if (action === 'zoom_reset') {
      mapStore.zoom = 0.6;
      mapStore.panX = 50;
      mapStore.panY = 50;
    } else if (action === 'show_notes') {
      alert("Notes de Carte : Utilisez l'outil texte pour placer des notes et des étiquettes directement sur la carte !");
    }
  }

  // Vérifier si un outil de dessin de la liste principale est actif
  function isToolActive(toolId: string) {
    if (toolId === 'paint') {
      return mapStore.activeTool === 'paint' || mapStore.activeTool === 'sculpt';
    }
    return mapStore.activeTool === toolId;
  }

  function selectTool(toolId: any) {
    // Si on clique sur Brush et que l'outil est sculpt ou paint, on toggle
    const isBrush = toolId === 'paint';
    const isCurrentlyBrushActive = mapStore.activeTool === 'paint' || mapStore.activeTool === 'sculpt';
    
    if ((isBrush && isCurrentlyBrushActive) || (!isBrush && mapStore.activeTool === toolId)) {
      mapStore.showPanel = !mapStore.showPanel;
    } else {
      mapStore.activeTool = toolId;
      mapStore.showPanel = true;
    }
  }
</script>

<div class="left-nav">
  <!-- Liste des Outils Principaux d'Inkarnate -->
  <div class="nav-tools">
    {#each TOOLS as tool}
      <button
        type="button"
        class="nav-btn"
        class:active={isToolActive(tool.id)}
        onclick={() => selectTool(tool.id)}
        title={tool.label}
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox={tool.viewBox} fill="none" class="icon">
          <path fill-rule="evenodd" clip-rule="evenodd" d={tool.svgPath} fill="currentColor"></path>
        </svg>
      </button>
    {/each}
  </div>

  <!-- Séparateur vertical d'Inkarnate -->
  <div class="nav-divider"></div>

  <!-- Outils Utilitaires d'Inkarnate (Grid, Notes, Zoom, Save) -->
  <div class="nav-utils">
    {#each UTILS as util}
      <button
        type="button"
        class="nav-btn"
        class:active={util.id === 'room' && mapStore.showGrid}
        onclick={() => handleUtilAction(util.action)}
        title={util.label}
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox={util.viewBox} fill="none" class="icon">
          <path fill-rule="evenodd" clip-rule="evenodd" d={util.svgPath} fill="currentColor"></path>
        </svg>
      </button>
    {/each}
  </div>
</div>

<style>
  .left-nav {
    width: var(--left-nav-width);
    height: 100%;
    background-color: var(--bg-dark-primary);
    border-right: 1px solid var(--border-color);
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 8px 0;
    box-sizing: border-box;
    z-index: 150;
    flex-shrink: 0;
  }

  .nav-tools, .nav-utils {
    display: flex;
    flex-direction: column;
    gap: 6px;
    align-items: center;
    width: 100%;
  }

  .nav-divider {
    width: 60%;
    height: 1px;
    background-color: rgba(255, 255, 255, 0.08);
    margin: 8px 0;
  }

  .nav-btn {
    width: 38px;
    height: 38px;
    background: transparent;
    border: none;
    border-radius: 4px;
    color: var(--color-text-muted);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
    position: relative;
    padding: 0;
  }

  .nav-btn:hover {
    background-color: rgba(255, 255, 255, 0.04);
    color: var(--color-text-primary);
  }

  .nav-btn.active {
    background-color: rgba(255, 204, 90, 0.1); /* Teinte orange/gold */
    color: var(--accent-orange);
    border: 1px solid rgba(255, 204, 90, 0.25);
    box-shadow: 0 0 8px rgba(255, 204, 90, 0.1);
  }

  .icon {
    width: 20px;
    height: 20px;
    display: block;
    transition: transform 0.1s ease;
  }

  .nav-btn:active .icon {
    transform: scale(0.9);
  }
</style>
