# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 🛠 Common Commands

### Development
- **Start Desktop App (Tauri + Svelte)**: `npm run tauri dev`
- **Start Web Development (Vite only)**: `npm run vite-dev` (launches main app and map-editor on port 5174)
- **Build Project**: `npm run build` (builds both main app and map-editor)
- **Preview Build**: `npm run preview`

### Quality Assurance
- **Check Types & Svelte**: `npm run check` (runs `svelte-check` and `tsc`)

## 🏗 Architecture & Structure

### High-Level Overview
Grimoire is a TTRPG toolkit combining a Markdown wiki, a Virtual TableTop (VTT), and local AI integration. It uses a hybrid architecture:
- **Frontend**: Svelte 5 (using Runes) and PixiJS v8 for high-performance VTT rendering.
- **Desktop Shell**: Tauri v2 (Rust) providing filesystem access, SQLite FTS5 for fast search, and a WebSocket server for the Mobile HUB.
- **Map Editor**: A dedicated Svelte project located in `map-editor/` for designing encounter maps.

### Directory Structure
- `src/`: Main application frontend (Svelte components, assets, and logic).
- `src-tauri/`: Rust backend source code.
- `map-editor/`: Source code for the standalone map editor tool.
- `public/`: Static assets and images.
- `docs/`: Documentation and guides.

### Key Technical Details
- **Rendering**: The VTT relies on PixiJS for GPU-accelerated rendering of tiles, tokens, and lighting (LOS).
- **Data**: Uses SQLite with FTS5 for the notebook's full-text search capabilities.
- **AI**: Integrates with local Ollama instances for text generation.
- **Mobile**: The Rust backend serves a mobile-optimized web app to players via QR code.
