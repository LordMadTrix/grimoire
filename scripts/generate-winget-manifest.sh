#!/usr/bin/env bash
# ==============================================================================
#  🧙 Grimoire - WinGet Manifest Generator
# ==============================================================================
# Génère les fichiers manifests YAML conformes aux spécifications de winget-pkgs
# pour publication sur le catalogue officiel Microsoft WinGet.
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

VERSION=$(grep '"version"' "$ROOT_DIR/package.json" | head -n 1 | awk -F '"' '{print $4}')
IDENTIFIER="madtrix.Grimoire"
PUBLISHER="madtrix"
REPO="LordMadTrix/grimoire"
OUTPUT_DIR="$ROOT_DIR/dist-manifests/winget/$VERSION"

echo "🧙 Génération du manifest WinGet pour Grimoire v$VERSION..."
mkdir -p "$OUTPUT_DIR"

EXE_URL="https://github.com/$REPO/releases/download/v$VERSION/Grimoire_${VERSION}_x64-setup.exe"
MSI_URL="https://github.com/$REPO/releases/download/v$VERSION/Grimoire_${VERSION}_x64_en-US.msi"

get_sha256() {
  local url="$1"
  local tmp_file
  tmp_file=$(mktemp)
  if curl -sLf "$url" -o "$tmp_file"; then
    sha256sum "$tmp_file" | awk '{print $1}'
    rm -f "$tmp_file"
  else
    echo "SHA256_A_REMPLIR_APRES_RELEASE"
    rm -f "$tmp_file"
  fi
}

echo "📥 Récupération des empreintes SHA256 des installateurs Windows..."
EXE_SHA=$(get_sha256 "$EXE_URL")
MSI_SHA=$(get_sha256 "$MSI_URL")

# 1. Version Manifest
cat <<YAML > "$OUTPUT_DIR/$IDENTIFIER.yaml"
# Created using Grimoire Manifest Generator
# yaml-language-server: \$schema=https://aka.ms/winget-manifest.version.1.6.0.schema.json

PackageIdentifier: $IDENTIFIER
PackageVersion: $VERSION
DefaultLocale: fr-FR
ManifestType: version
ManifestVersion: 1.6.0
YAML

# 2. Installer Manifest
cat <<YAML > "$OUTPUT_DIR/$IDENTIFIER.installer.yaml"
# Created using Grimoire Manifest Generator
# yaml-language-server: \$schema=https://aka.ms/winget-manifest.installer.1.6.0.schema.json

PackageIdentifier: $IDENTIFIER
PackageVersion: $VERSION
InstallerType: inno
Scope: machine
InstallModes:
  - interactive
  - silent
UpgradeBehavior: install
Commands:
  - grimoire
FileExtensions:
  - md
Installers:
  - Architecture: x64
    InstallerType: inno
    InstallerUrl: $EXE_URL
    InstallerSha256: $EXE_SHA
  - Architecture: x64
    InstallerType: wix
    InstallerUrl: $MSI_URL
    InstallerSha256: $MSI_SHA
ManifestType: installer
ManifestVersion: 1.6.0
YAML

# 3. Locale Manifest
cat <<YAML > "$OUTPUT_DIR/$IDENTIFIER.locale.fr-FR.yaml"
# Created using Grimoire Manifest Generator
# yaml-language-server: \$schema=https://aka.ms/winget-manifest.defaultLocale.1.6.0.schema.json

PackageIdentifier: $IDENTIFIER
PackageVersion: $VERSION
PackageLocale: fr-FR
Publisher: $PUBLISHER
PublisherUrl: https://github.com/LordMadTrix
Author: MadTrix
PackageName: Grimoire
PackageUrl: https://github.com/LordMadTrix/grimoire
License: MIT
LicenseUrl: https://github.com/LordMadTrix/grimoire/blob/main/LICENSE
Copyright: Copyright (c) MadTrix
ShortDescription: L'outil ultime pour les Maîtres du Jeu : Éditeur Markdown + VTT + IA Locale + HUB Mobile.
Description: |
  Grimoire est une application Desktop pour Maîtres du Jeu TTRPG combinant
  un éditeur Markdown (style Obsidian), une Table Virtuelle (VTT) haute performance (PixiJS v8),
  un serveur compagnon mobile PWA et une IA locale (Ollama).
Tags:
  - ttrpg
  - vtt
  - rpg
  - tabletop
  - jdr
  - markdown
  - wfrp
  - dnd
ReleaseNotesUrl: https://github.com/$REPO/releases/tag/v$VERSION
ManifestType: defaultLocale
ManifestVersion: 1.6.0
YAML

echo "✅ Manifests générés dans : $OUTPUT_DIR"
echo "👉 Pour soumettre à WinGet : wingetcreate submit $OUTPUT_DIR"
