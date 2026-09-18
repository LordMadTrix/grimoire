#!/usr/bin/env bash

# ==============================================================================
#  🧙 GRIMOIRE - Launcher & Dependency Checker
# ==============================================================================
# Script de vérification des dépendances et de lancement pour Grimoire.
# Supporte les modes Desktop (Tauri v2) et Web (Vite).
# ==============================================================================

set -uo pipefail

# Couleurs et styles ANSI
BOLD='\033[1m'
DIM='\033[2m'
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Se placer dans la racine du projet
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Flags par défaut
MODE="auto" # "auto", "desktop", "web", "check"
AUTO_FIX=false

print_banner() {
    clear 2>/dev/null || true
    echo -e "${PURPLE}${BOLD}"
    echo "  ╔═══════════════════════════════════════════════════════════════╗"
    echo "  ║                  🐉 GRIMOIRE - LAUNCHER 🧙                    ║"
    echo "  ║            Table Virtuelle & Carnet de Maître du Jeu          ║"
    echo "  ╚═══════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

print_help() {
    echo -e "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -d, --desktop      Lancer directement en mode Desktop (Tauri)"
    echo "  -w, --web          Lancer en mode Web (Vite + Map Editor)"
    echo "  -c, --check        Vérifier les dépendances uniquement sans lancer"
    echo "  -f, --fix          Installer automatiquement les dépendances système manquantes (sudo)"
    echo "  -h, --help         Afficher cette aide"
    echo ""
}

# Parsing des arguments
while [[ $# -gt 0 ]]; do
    case "$1" in
        -d|--desktop)
            MODE="desktop"
            shift
            ;;
        -w|--web)
            MODE="web"
            shift
            ;;
        -c|--check)
            MODE="check"
            shift
            ;;
        -f|--fix)
            AUTO_FIX=true
            shift
            ;;
        -h|--help)
            print_help
            exit 0
            ;;
        *)
            echo -e "${RED}Option inconnue: $1${NC}"
            print_help
            exit 1
            ;;
    esac
done

print_banner

# Variables de statut
MISSING_CORE=0
MISSING_DESKTOP=0
declare -a MISSING_SYS_PKGS=()
declare -a MISSING_DEB_PKGS=()

log_step() {
    echo -e "${BOLD}${BLUE}==>${NC} ${BOLD}$1${NC}"
}

log_ok() {
    echo -e "  ${GREEN}✔${NC} $1"
}

log_warn() {
    echo -e "  ${YELLOW}⚠${NC} $1"
}

log_fail() {
    echo -e "  ${RED}✖${NC} $1"
}

log_info() {
    echo -e "  ${CYAN}ℹ${NC} $1"
}

# ------------------------------------------------------------------------------
# 1. Vérification Node.js et NPM
# ------------------------------------------------------------------------------
log_step "1. Vérification de l'environnement Node.js"

if command -v node >/dev/null 2>&1; then
    NODE_VER=$(node -v)
    log_ok "Node.js est installé : ${BOLD}$NODE_VER${NC}"
else
    log_fail "Node.js n'est pas installé !"
    MISSING_CORE=$((MISSING_CORE + 1))
fi

if command -v npm >/dev/null 2>&1; then
    NPM_VER=$(npm -v)
    log_ok "npm est installé : ${BOLD}v$NPM_VER${NC}"
else
    log_fail "npm n'est pas installé !"
    MISSING_CORE=$((MISSING_CORE + 1))
fi

echo ""

# ------------------------------------------------------------------------------
# 2. Vérification des dépendances JavaScript (node_modules)
# ------------------------------------------------------------------------------
log_step "2. Vérification des paquets NPM (node_modules)"

if [ -d "node_modules" ] && [ -f "node_modules/.package-lock.json" -o -f "node_modules/.bin/vite" ]; then
    log_ok "Modules Grimoire présents"
else
    log_warn "Modules Grimoire manquants ou incomplets. Installation..."
    npm install
    log_ok "Installation des modules Grimoire terminée"
fi

if [ -d "map-editor/node_modules" ]; then
    log_ok "Modules Map Editor présents"
else
    log_warn "Modules Map Editor manquants. Installation..."
    npm install --prefix map-editor
    log_ok "Installation des modules Map Editor terminée"
fi

echo ""

# ------------------------------------------------------------------------------
# 3. Vérification de Rust & Cargo (requis pour Tauri Desktop)
# ------------------------------------------------------------------------------
log_step "3. Vérification de Rust & Cargo (Mode Desktop Tauri)"

if command -v cargo >/dev/null 2>&1 && command -v rustc >/dev/null 2>&1; then
    RUST_VER=$(rustc --version | cut -d' ' -f2)
    log_ok "Rust & Cargo sont installés : ${BOLD}v$RUST_VER${NC}"
else
    log_fail "Rust / Cargo n'est pas installé dans le PATH."
    log_info "Pour installer Rust : ${BOLD}curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh${NC}"
    MISSING_DESKTOP=$((MISSING_DESKTOP + 1))
fi

echo ""

# ------------------------------------------------------------------------------
# 4. Vérification des bibliothèques système Linux (requis pour Tauri v2)
# ------------------------------------------------------------------------------
log_step "4. Vérification des bibliothèques système Linux (Tauri)"

if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    if ! command -v pkg-config >/dev/null 2>&1; then
        log_fail "pkg-config est manquant"
        MISSING_DESKTOP=$((MISSING_DESKTOP + 1))
        MISSING_DEB_PKGS+=("pkg-config")
    else
        log_ok "pkg-config est installé"
    fi

    check_pkg() {
        local pkg_check="$1"
        local display_name="$2"
        local deb_name="$3"

        if pkg-config --exists "$pkg_check" 2>/dev/null; then
            log_ok "Bibliothèque $display_name ($pkg_check)"
        else
            log_fail "Bibliothèque manquante : $display_name ($pkg_check)"
            MISSING_DESKTOP=$((MISSING_DESKTOP + 1))
            MISSING_DEB_PKGS+=("$deb_name")
        fi
    }

    if command -v pkg-config >/dev/null 2>&1; then
        check_pkg "dbus-1" "D-Bus" "libdbus-1-dev"
        check_pkg "webkit2gtk-4.1" "WebKitGTK (4.1)" "libwebkit2gtk-4.1-dev"
        check_pkg "openssl" "OpenSSL" "libssl-dev"
        check_pkg "ayatana-appindicator3-0.1" "AppIndicator" "libayatana-appindicator3-dev"
        check_pkg "librsvg-2.0" "RSVG" "librsvg2-dev"
    fi
else
    log_info "OS non-Linux détecté ($OSTYPE), vérification pkg-config ignorée."
fi

echo ""

# ------------------------------------------------------------------------------
# 5. Services optionnels (Ollama - IA locale)
# ------------------------------------------------------------------------------
log_step "5. Services optionnels"

if curl -s -m 1 http://localhost:11434/api/tags >/dev/null 2>&1; then
    log_ok "Serveur Ollama actif sur http://localhost:11434 (IA locale prête)"
elif command -v ollama >/dev/null 2>&1; then
    log_warn "Ollama est installé mais le serveur n'est pas démarré (commande: 'ollama serve')"
else
    log_info "Ollama n'est pas installé (Optionnel : requis uniquement pour l'IA locale)"
fi

echo ""

# ------------------------------------------------------------------------------
# Résolution des dépendances manquantes
# ------------------------------------------------------------------------------
if [ $MISSING_CORE -gt 0 ]; then
    echo -e "${RED}${BOLD}❌ Erreur critique : Des dépendances fondamentales (Node.js / npm) sont manquantes.${NC}"
    echo "Veuillez installer Node.js (v18+) avant de continuer."
    exit 1
fi

if [ ${#MISSING_DEB_PKGS[@]} -gt 0 ]; then
    echo -e "${YELLOW}${BOLD}⚠️  Certaines dépendances système requises pour le mode Desktop sont manquantes :${NC}"
    echo -e "   ${BOLD}${MISSING_DEB_PKGS[*]}${NC}"
    echo ""

    INSTALL_CMD="sudo apt update && sudo apt install -y ${MISSING_DEB_PKGS[*]}"

    if [ "$AUTO_FIX" = true ] || [ -t 0 ]; then
        if [ "$AUTO_FIX" = false ]; then
            read -p "Souhaitez-vous installer ces paquets automatiquement via sudo ? (o/N) " -n 1 -r
            echo ""
        else
            REPLY="o"
        fi

        if [[ $REPLY =~ ^[OoYy]$ ]]; then
            echo -e "${CYAN}Exécution de : $INSTALL_CMD${NC}"
            if eval "$INSTALL_CMD"; then
                log_ok "Installation des dépendances système réussie !"
                MISSING_DESKTOP=0
            else
                log_fail "L'installation a échoué ou a été annulée."
            fi
        fi
    else
        echo "Pour les installer manuellement, lancez :"
        echo -e "  ${CYAN}${INSTALL_CMD}${NC}"
    fi
    echo ""
fi

# ------------------------------------------------------------------------------
# Mode de vérification seule (-c / --check)
# ------------------------------------------------------------------------------
if [ "$MODE" = "check" ]; then
    echo -e "${BOLD}--- Résumé de la vérification ---${NC}"
    if [ $MISSING_DESKTOP -eq 0 ]; then
        echo -e "${GREEN}${BOLD}✔ Tous les prérequis pour Grimoire (Desktop & Web) sont satisfaits !${NC}"
        exit 0
    else
        echo -e "${YELLOW}ℹ Prérequis Web OK, mais le mode Desktop nécessite des paquets supplémentaires.${NC}"
        exit 1
    fi
fi

# ------------------------------------------------------------------------------
# Choix du mode de lancement
# ------------------------------------------------------------------------------
echo -e "${PURPLE}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

if [ "$MODE" = "auto" ]; then
    if [ $MISSING_DESKTOP -eq 0 ]; then
        TARGET_LAUNCH="desktop"
    else
        echo -e "${YELLOW}Les dépendances Desktop ne sont pas complètes. Basculement en mode Web.${NC}"
        TARGET_LAUNCH="web"
    fi
else
    TARGET_LAUNCH="$MODE"
fi

if [ "$TARGET_LAUNCH" = "desktop" ] && [ $MISSING_DESKTOP -gt 0 ]; then
    echo -e "${RED}${BOLD}Attention : Le mode Desktop a été demandé mais des dépendances sont manquantes.${NC}"
    read -p "Voulez-vous quand même tenter de lancer (t) ou basculer en mode Web (W) ? [t/W] " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Tt]$ ]]; then
        TARGET_LAUNCH="web"
    fi
fi

# ------------------------------------------------------------------------------
# Libération des ports (5173 / 5174) si déjà occupés
# ------------------------------------------------------------------------------
free_ports() {
    local ports=(5173 5174)
    local freed=false
    for port in "${ports[@]}"; do
        if command -v lsof >/dev/null 2>&1 && lsof -i :"$port" >/dev/null 2>&1; then
            log_warn "Le port $port est déjà occupé par une instance précédente. Libération..."
            if command -v fuser >/dev/null 2>&1; then
                fuser -k "${port}/tcp" >/dev/null 2>&1 || true
            else
                kill $(lsof -t -i :"$port") 2>/dev/null || true
            fi
            freed=true
        fi
    done
    if [ "$freed" = true ]; then
        sleep 1
        log_ok "Ports 5173 / 5174 libérés avec succès."
        echo ""
    fi
}

# ------------------------------------------------------------------------------
# Lancement de l'application
# ------------------------------------------------------------------------------
free_ports

if [ "$TARGET_LAUNCH" = "desktop" ]; then
    echo -e "${GREEN}${BOLD}🚀 Lancement de Grimoire en mode Desktop (Tauri v2)...${NC}"
    echo -e "${DIM}Commande : npm run tauri dev${NC}"
    echo ""
    exec npm run tauri dev
elif [ "$TARGET_LAUNCH" = "web" ]; then
    echo -e "${GREEN}${BOLD}🌐 Lancement de Grimoire en mode Web Dev (Vite)...${NC}"
    echo -e "${DIM}Grimoire : http://localhost:5173/ | Map Editor : http://localhost:5174/${NC}"
    echo -e "${DIM}Commande : npm run vite-dev${NC}"
    echo ""
    exec npm run vite-dev
fi

