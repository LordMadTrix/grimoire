#!/usr/bin/env bash
# ==============================================================================
#  🧙 Grimoire - Normalisation des noms d'assets de release
# ==============================================================================
# Renomme les assets d'une release GitHub au format normalisé :
#   Grimoire_V{VERSION}_X86.exe / .msi / .AppImage / .deb / .rpm
#
# Idempotent : les assets déjà renommés ou absents sont ignorés.
# Variables d'environnement :
#   GITHUB_TOKEN       (requis) token avec droits écriture sur le dépôt
#   GITHUB_REPOSITORY  (défaut : LordMadTrix/grimoire)
#   RELEASES_API_BASE  (défaut : https://api.github.com — surcharge pour tests)
#
# Usage : scripts/normalize-release-assets.sh [version]
#   (version par défaut : celle de package.json)
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

VERSION="${1:-$(grep '"version"' "$ROOT_DIR/package.json" | head -n 1 | awk -F '"' '{print $4}')}"
REPO="${GITHUB_REPOSITORY:-LordMadTrix/grimoire}"
API_BASE="${RELEASES_API_BASE:-https://api.github.com}"
TAG="v$VERSION"

: "${GITHUB_TOKEN:?GITHUB_TOKEN requis (portée repo, droits contents:write)}"

echo "🧙 Normalisation des assets de la release $TAG ($REPO)..."

API_HEADERS=(
  -H "Authorization: Bearer $GITHUB_TOKEN"
  -H "Accept: application/vnd.github+json"
  -H "X-GitHub-Api-Version: 2022-11-28"
)

RELEASE_JSON=$(curl -sSf "${API_HEADERS[@]}" "$API_BASE/repos/$REPO/releases/tags/$TAG")

# Correspondance ancien nom → nom normalisé
declare -A RENAMES=(
  ["Grimoire_${VERSION}_x64-setup.exe"]="Grimoire_V${VERSION}_X86.exe"
  ["Grimoire_${VERSION}_x64_en-US.msi"]="Grimoire_V${VERSION}_X86.msi"
  ["Grimoire_${VERSION}_amd64.AppImage"]="Grimoire_V${VERSION}_X86.AppImage"
  ["Grimoire_${VERSION}_amd64.deb"]="Grimoire_V${VERSION}_X86.deb"
  ["Grimoire-${VERSION}-1.x86_64.rpm"]="Grimoire_V${VERSION}_X86.rpm"
  ["Grimoire_${VERSION}_aarch64.dmg"]="Grimoire_V${VERSION}_X86.dmg"
  # NB : Grimoire_aarch64.app.tar.gz (bundle updater macOS) volontairement non renommé —
  # son URL doit rester référençable par l'updater Tauri.
)

# Noms déjà présents sur la release
EXISTING=$(printf '%s' "$RELEASE_JSON" | node -e '
  let d = "";
  process.stdin.on("data", c => d += c).on("end", () => {
    for (const a of JSON.parse(d).assets) console.log(a.name);
  });
')

asset_id() {
  printf '%s' "$RELEASE_JSON" | node -e '
    let d = "";
    process.stdin.on("data", c => d += c).on("end", () => {
      const a = JSON.parse(d).assets.find(x => x.name === process.argv[1]);
      console.log(a ? a.id : "");
    });
  ' "$1"
}

RENAMED=0
SKIPPED=0
for OLD in "${!RENAMES[@]}"; do
  NEW="${RENAMES[$OLD]}"
  ID=$(asset_id "$OLD")
  if [ -z "$ID" ]; then
    echo "⚠️  $OLD absent — ignoré"
    SKIPPED=$((SKIPPED + 1))
    continue
  fi
  if printf '%s\n' "$EXISTING" | grep -qxF "$NEW"; then
    echo "⚠️  $NEW existe déjà — ignoré"
    SKIPPED=$((SKIPPED + 1))
    continue
  fi
  STATUS=$(curl -sS -o /dev/null -w "%{http_code}" -X PATCH \
    "${API_HEADERS[@]}" -H "Content-Type: application/json" \
    -d "{\"name\":\"$NEW\"}" \
    "$API_BASE/repos/$REPO/releases/assets/$ID")
  if [ "$STATUS" = "200" ]; then
    echo "✅ $OLD → $NEW"
    RENAMED=$((RENAMED + 1))
  else
    echo "❌ $OLD → $NEW (HTTP $STATUS)"
    exit 1
  fi
done

echo "🎯 Terminé : $RENAMED renommé(s), $SKIPPED ignoré(s)."
