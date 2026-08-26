import gdown
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
OUTPUT_CATALOG = os.path.join(os.path.dirname(__file__), '..', 'public', 'drive-catalog.json')
OUTPUT_CATALOG = os.path.abspath(OUTPUT_CATALOG)

ALLOWED_EXTENSIONS = (
    '.png', '.jpg', '.jpeg', '.webp', '.svg', '.gif',
    '.pdf', '.mp3', '.ogg', '.wav', '.md', '.txt'
)

def format_readable_name(filename):
    name = os.path.splitext(filename)[0]
    name = re.sub(r'[_-]+', ' ', name)
    name = re.sub(r'([a-z])([A-Z])', r'\1 \2', name).strip()
    return name.title()

def build_catalog():
    print(f"📡 Interrogation de Google Drive (Dossier: {FOLDER_ID})...")
    folder_url = f'https://drive.google.com/drive/folders/{FOLDER_ID}'
    items = gdown.download_folder(url=folder_url, skip_download=True, quiet=False)
    
    print(f"📦 {len(items)} éléments découverts dans Google Drive.")
    
    files_list = []
    pdf_count = 0
    img_count = 0
    audio_count = 0
    
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
        
        if ext == '.pdf':
            pdf_count += 1
        elif ext in ('.mp3', '.ogg', '.wav'):
            audio_count += 1
        else:
            img_count += 1
            
        # Format compact: [file_id, rel_path, readable_name]
        files_list.append([file_id, rel_path, readable_name])
        
    catalog = {
        "version": "3.1.0",
        "updated": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "folderId": FOLDER_ID,
        "totalFiles": len(files_list),
        "files": files_list
    }
    
    os.makedirs(os.path.dirname(OUTPUT_CATALOG), exist_ok=True)
    with open(OUTPUT_CATALOG, 'w', encoding='utf-8') as f:
        json.dump(catalog, f, ensure_ascii=False)
        
    print(f"✨ Catalogue Google Drive généré avec succès dans {OUTPUT_CATALOG} !")
    print(f"📊 Statistiques : {len(files_list)} fichiers au total ({pdf_count} PDFs, {img_count} Images, {audio_count} Audio).")

if __name__ == '__main__':
    build_catalog()
