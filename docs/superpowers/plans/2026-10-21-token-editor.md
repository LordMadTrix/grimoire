# Token Editor (Éditeur de Tokens) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a complete fantasy Token Editor inside Grimoire with adaptive SVG borders (circle, hex, shield), Celestial Library & local art integration, pan & zoom image framing, draggable name banner, modular on/off toggles, saving to the GM vault (`tokens/`), and 1-click placement onto the active VTT map.

**Architecture:** A standalone renderer module (`tokenRenderer.ts`) produces adaptive vector SVG borders and exports 512x512 transparent PNG tokens via Canvas. A vault token service (`tokenService.ts`) handles saving and indexing tokens in the GM vault. A celestial picker component (`CelestialArtPickerModal.svelte`) interfaces with Grimoire's `celestialCache.ts`. The main interactive modal (`TokenEditorModal.svelte`) coordinates live preview, drag-and-drop, zoom, presets, and triggers `addGmToken` in `vtt.svelte.ts`.

**Tech Stack:** Svelte 5 (Runes `$state`, `$derived`, `$props`), PixiJS v8 / VTT Store, HTML5 Canvas, SVG, Tauri v2 APIs (FS & Dialog).

**Spec:** [docs/superpowers/specs/2026-10-21-token-editor-design.md](file:///c:/Users/madtr/Downloads/Devlopement/grimoire/docs/superpowers/specs/2026-10-21-token-editor-design.md)

## Global Constraints
- Svelte 5 with modern Runes syntax (`$state`, `$derived`, `$props`, `$effect`).
- Zero clipping or cropping of the token name banner: must remain 100% readable.
- The ornate border MUST adapt dynamically to the selected shape (hex, shield, circle) instead of staying a circle.
- Every tactical/visual feature (Name, Border, HP Arc, Status Badge, Aura) MUST have its own independent toggle switch.
- Tokens must be saved cleanly in `{vaultPath}/tokens/` as transparent PNGs + JSON descriptors.

## Review Focus
1. Non-circular shapes (Hexagon, Shield) clipping the portrait: verify SVG `clipPath` matches the inner border geometry exactly.
2. Cross-origin / Google Drive images in Canvas export: verify image proxy or blob URL handling to avoid `SecurityError: The operation is insecure` on canvas export.
3. Vault path unavailability (when no vault is open): provide fallback download as PNG and friendly notice.
4. Scale on VTT: ensure tokens spawned via `Placer sur la Map VTT` respect the grid size (1x1, 2x2, 3x3) and center properly in current view.
5. Touch / Mouse coordinate offsets on pan & zoom: ensure pointer events compute relative delta correctly regardless of screen DPI.

---

### Task 1: Core Token Generator & Canvas Exporter

**Files:**
- Create: `src/lib/utils/tokenRenderer.ts`
- Create: `src/lib/types/tokenEditor.ts`

**Interfaces:**
- Produces: `TokenDesignData`, `renderTokenSvgString(data: TokenDesignData): string`, `renderTokenToCanvas(data: TokenDesignData, size: number): Promise<HTMLCanvasElement>`, `exportTokenToBlob(data: TokenDesignData): Promise<Blob>`

- [ ] **Step 1: Define TypeScript interfaces in `src/lib/types/tokenEditor.ts`**
  - Define `TokenShape` ('circle' | 'hex' | 'shield'), `TokenMetal` ('gold' | 'steel' | 'runic' | 'copper' | 'dark-spikes').
  - Define `TokenDesignData` including name, image transform (x, y, scale), border, hp, status, aura, grid scale.

- [ ] **Step 2: Implement SVG border generator and Canvas export in `src/lib/utils/tokenRenderer.ts`**
  - Generate precise vector paths and stroke gradients for hexagon (6 facets, corner rivets, ornamental pearls), shield (crested top, tapered bottom), and circle.
  - Implement canvas drawing function combining aura filter, clipped image, border, optional status badge, optional HP arc, and name banner.
  - Return high-res canvas / PNG Blob.

- [ ] **Step 3: Verification**
  - Verify type correctness with `npm run check`.

---

### Task 2: Token Vault Service & VTT Integration

**Files:**
- Create: `src/lib/services/tokenService.ts`
- Modify: `src/lib/stores/vtt.svelte.ts`

**Interfaces:**
- Consumes: `getVaultPath` from `$lib/stores/vault.svelte`, `writeFile`, `createDirectory` from `$lib/api`, `addGmToken` from `$lib/stores/vtt.svelte`
- Produces: `saveTokenToVault(design: TokenDesignData, pngBlob: Blob): Promise<string>`, `listVaultTokens(): Promise<SavedTokenItem[]>`, `placeTokenOnActiveMap(design: TokenDesignData, pngDataUrl: string): void`

- [ ] **Step 1: Implement `tokenService.ts`**
  - Create directory `{vaultPath}/tokens` if it does not exist.
  - Convert Blob to Uint8Array and write `{vaultPath}/tokens/{slug}.png` and `{slug}.json`.
  - List files in `{vaultPath}/tokens` to discover saved tokens.
  - Implement `placeTokenOnActiveMap`: calculate viewport center, construct `Token` object, call `addGmToken`.

- [ ] **Step 2: Verification**
  - Verify type correctness with `npm run check`.

---

### Task 3: Celestial Art Picker Modal

**Files:**
- Create: `src/components/CelestialArtPickerModal.svelte`

**Interfaces:**
- Consumes: `getCelestialCatalog`, `ensureCelestialFolders`, `DriveFile` from `$lib/stores/celestialCache`
- Produces: `onselect(fileUrl: string, name: string)` event, `onclose()` event

- [ ] **Step 1: Implement `CelestialArtPickerModal.svelte`**
  - Fetch catalog tree for `stamps` and `tokens` / portraits.
  - Filter by search query (e.g. "tavernier", "garde", "gobelin", "dragon").
  - Category selector buttons: "Tous", "PNJ & Villageois", "Combattants", "Magie", "Monstres".
  - Grid cards with thumbnail, title and click-to-select.
  - Include file upload button (`<input type="file">`) and quick emoji picker.

- [ ] **Step 2: Verification**
  - Verify Svelte 5 runes syntax and types with `npm run check`.

---

### Task 4: Main Token Editor Modal

**Files:**
- Create: `src/components/TokenEditorModal.svelte`

**Interfaces:**
- Consumes: `tokenRenderer.ts`, `tokenService.ts`, `CelestialArtPickerModal.svelte`
- Props: `isOpen: boolean`, `initialData?: Partial<TokenDesignData>`, `onclose: () => void`

- [ ] **Step 1: Implement `TokenEditorModal.svelte` layout & state**
  - Presets sidebar: Tavernier Madtrix, Capitaine du Guet, Chef Gobelin, Archimage Stellaire, Paladin Divin, Dragon Rouge.
  - Interactive central canvas with live Pan & Zoom (pointer events on inner image, mouse wheel zoom).
  - Freely draggable name pod with visual handle and quick snap buttons (En bas, En haut, Au centre, Incrusté).
  - Right panel with independent On/Off toggle switches (Nom, Frise, Jauge PV, Pastille, Aura).
  - Zoom slider, color picker, shape pills, and metal select.

- [ ] **Step 2: Wire Actions**
  - "🌌 Choisir dans la Bibliothèque Céleste" button opening `CelestialArtPickerModal`.
  - "📁 Enregistrer dans le Dossier MJ" calling `saveTokenToVault` with success toast.
  - "🗺️ Placer sur la Map VTT" calling `placeTokenOnActiveMap` and closing modal.

- [ ] **Step 3: Verification**
  - Run `npm run check` to verify zero errors.

---

### Task 5: Integration into Grimoire VTT Toolbar & Menus

**Files:**
- Modify: `src/components/VTTToolbar.svelte`
- Modify: `src/App.svelte`

**Interfaces:**
- Mounts: `<TokenEditorModal isOpen={showTokenEditor} onclose={() => showTokenEditor = false} />`

- [ ] **Step 1: Add Token Editor button in `VTTToolbar.svelte`**
  - Add button `🪙 Éditeur de Tokens` in the VTT token tools menu and toolbar.
  - Add state `showTokenEditor = $state(false)`.

- [ ] **Step 2: Add keyboard shortcut and menu access**
  - Allow launching via VTT toolbar or right-click map context menu.

- [ ] **Step 3: Full End-to-End Build & Validation**
  - Run `npm run build` and `npm run check`.

---

### Task 6: Version Bump, Git Commit, Push & GitHub Release

**Files:**
- Modify: `package.json` (bump to 0.8.6)
- Modify: `src-tauri/tauri.conf.json` (bump to 0.8.6)

- [ ] **Step 1: Bump version to `0.8.6`**
- [ ] **Step 2: Verify git status and commit all changes**
- [ ] **Step 3: Push commits and create git tag `v0.8.6` on GitHub**
