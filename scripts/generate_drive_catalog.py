import json
import os
import re
import sys
from datetime import datetime

# Ensure UTF-8 output in Windows console
if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

FOLDER_ID = '16ZM0lg66rgFdsQ9kmFoA2pQZ2a0mciF3'
PUBLIC_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'public'))
OUTPUT_CATALOG = os.path.join(PUBLIC_DIR, 'drive-catalog.json')
AUDIO_MANIFEST = os.path.join(PUBLIC_DIR, 'assets', 'audio', 'Grimoire_Audio', 'audio_manifest.json')

ALLOWED_EXTENSIONS = (
    '.png', '.jpg', '.jpeg', '.webp', '.svg', '.gif',
    '.pdf', '.mp3', '.ogg', '.wav', '.flac', '.m4a', '.md', '.txt'
)

def format_readable_name(filename):
    name = os.path.splitext(filename)[0]
    name = re.sub(r'^\d+[\s_-]*', '', name) # Remove leading numbers like 522_
    name = re.sub(r'[_-]+', ' ', name)
    name = re.sub(r'([a-z])([A-Z])', r'\1 \2', name).strip()
    return name.title()

def load_existing_catalog():
    if os.path.exists(OUTPUT_CATALOG):
        try:
            with open(OUTPUT_CATALOG, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            print(f"⚠️ Impossible de lire le catalogue existant: {e}")
    return None

def load_grimoire_audio():
    audio_files = []
    if not os.path.exists(AUDIO_MANIFEST):
        print(f"⚠️ Fichier audio_manifest.json introuvable: {AUDIO_MANIFEST}")
        return audio_files

    try:
        with open(AUDIO_MANIFEST, 'r', encoding='utf-8') as f:
            manifest = json.load(f)

        for idx, item in enumerate(manifest.get('items', [])):
            item_type = item.get('type', 'sfx')
            item_id = f"audio_{item_type}_{item.get('id', idx)}"
            rel_path = f"assets/audio/Grimoire_Audio/{item['path']}".replace('\\', '/')
            name = item.get('frenchTitle') or item.get('title') or format_readable_name(os.path.basename(item['path']))
            audio_files.append([item_id, rel_path, name])

        print(f"🎵 {len(audio_files)} pistes Grimoire Audio chargées depuis le manifeste.")
    except Exception as e:
        print(f"⚠️ Erreur lors du chargement du manifeste audio: {e}")

    return audio_files

def build_catalog(fetch_drive=False):
    files_list = []
    existing = load_existing_catalog()

    if fetch_drive:
        try:
            import gdown
            print(f"📡 Interrogation de Google Drive (Dossier: {FOLDER_ID})...")
            folder_url = f'https://drive.google.com/drive/folders/{FOLDER_ID}'
            items = gdown.download_folder(url=folder_url, skip_download=True, quiet=False)
            print(f"📦 {len(items)} éléments découverts dans Google Drive.")

            for item in items:
                file_id = item.id
                rel_path = item.path.replace('\\', '/')
                ext = os.path.splitext(rel_path)[1].lower()
                if ext not in ALLOWED_EXTENSIONS:
                    continue
                parts = [p for p in rel_path.split('/') if p]
                if not parts:
                    continue
                filename = parts[-1]
                readable_name = format_readable_name(filename)
                files_list.append([file_id, rel_path, readable_name])
        except Exception as e:
            print(f"⚠️ Erreur lors de l'interrogation Drive ({e}), utilisation du catalogue local.")
            if existing and 'files' in existing:
                # Keep non-audio files from existing catalog
                files_list = [f for f in existing['files'] if not f[1].startswith('assets/audio/')]
    else:
        if existing and 'files' in existing:
            # Filtrer pour ne garder que les fichiers hors Grimoire Audio pour ré-injection propre
            files_list = [f for f in existing['files'] if not f[1].startswith('assets/audio/')]
        print(f"📦 {len(files_list)} fichiers Drive conservés du catalogue actuel.")

    # Ajouter Grimoire Audio
    audio_files = load_grimoire_audio()
    files_list.extend(audio_files)

    # Statistiques
    pdf_count = sum(1 for f in files_list if f[1].lower().endswith('.pdf'))
    audio_count = sum(1 for f in files_list if any(f[1].lower().endswith(x) for x in ('.mp3', '.ogg', '.wav', '.flac', '.m4a')))
    img_count = len(files_list) - pdf_count - audio_count

    catalog = {
        "version": "3.2.0",
        "updated": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "folderId": FOLDER_ID,
        "totalFiles": len(files_list),
        "files": files_list
    }

    os.makedirs(os.path.dirname(OUTPUT_CATALOG), exist_ok=True)
    with open(OUTPUT_CATALOG, 'w', encoding='utf-8') as f:
        json.dump(catalog, f, ensure_ascii=False)

    print(f"✨ Catalogue Bibliothèque Céleste généré avec succès dans {OUTPUT_CATALOG} !")
    print(f"📊 Statistiques : {len(files_list)} fichiers au total ({pdf_count} PDFs, {img_count} Images, {audio_count} Audio).")

if __name__ == '__main__':
    fetch = '--fetch-drive' in sys.argv
    build_catalog(fetch_drive=fetch)
