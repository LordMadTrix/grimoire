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

## 📦 Releases & Distribution (Windows SmartScreen / Chrome)
- **Active Development Status**: Grimoire is in active development. Binaries (.msi, .exe) distributed via GitHub Releases may trigger Windows SmartScreen ("Windows a protégé votre ordinateur") or Chrome ("Fichier non couramment téléchargé") warnings due to the lack of long-term reputation and commercial code signing.
- **Release Workflow**: Configured in `.github/workflows/build.yml` (triggered on tag push `v*`). It automatically generates release notes instructing users how to proceed ("Informations complémentaires" -> "Exécuter quand même" / Chrome "Conserver").
- **Future Stable Steps**:
  - Submit major release binaries to [Microsoft Security Intelligence](https://www.microsoft.com/en-us/wdsi/filesubmission) (free developer sample submission for false positive resolution).
  - Submit Grimoire to **WinGet** (`microsoft/winget-pkgs`) for single-command safe installations.
