import gdown
import json
import os
import re
import sys

# Ensure UTF-8 output in Windows console
if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

FOLDER_ID = '16ZM0lg66rgFdsQ9kmFoA2pQZ2a0mciF3'
OUTPUT_CATALOG = os.path.join(os.path.dirname(__file__), '..', 'public', 'drive-catalog.json')
OUTPUT_CATALOG = os.path.abspath(OUTPUT_CATALOG)

IMAGE_EXTENSIONS = ('.png', '.jpg', '.jpeg', '.webp', '.svg')

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
    
    packs_dict = {}
    clean_maps = []
    clean_textures = []
    clean_stamps = []
    clean_tokens = []
    
    for item in items:
        file_id = item.id
        rel_path = item.path.replace('\\', '/')
        ext = os.path.splitext(rel_path)[1].lower()
        
        if ext not in IMAGE_EXTENSIONS:
            continue
            
        parts = [p for p in rel_path.split('/') if p]
        if not parts:
            continue
            
        filename = parts[-1]
        readable_name = format_readable_name(filename)
        
        stream_url = f"https://lh3.googleusercontent.com/d/{file_id}"
        thumb_url = f"https://drive.google.com/thumbnail?id={file_id}&sz=w400"
        high_res_url = f"https://lh3.googleusercontent.com/d/{file_id}=w2560"
        
        root_type = parts[0].lower()
        
        if root_type == 'maps' or root_type == 'battlemaps':
            category = 'maps'
            destination = 'maps'
            pack_name = parts[1] if len(parts) > 1 else 'Cartes Diverses'
            clean_maps.append({
                "id": file_id,
                "name": readable_name,
                "folder": pack_name,
                "url": stream_url,
                "highResUrl": high_res_url,
                "thumbUrl": thumb_url,
                "path": rel_path
            })
        elif root_type == 'textures':
            category = 'textures'
            destination = 'tiles/custom'
            pack_name = f'Textures - {parts[1]}' if len(parts) > 1 else 'Textures Diverses'
            clean_textures.append({
                "id": f"drive_tex_{file_id}",
                "name": readable_name,
                "category": parts[1] if len(parts) > 1 else 'Textures',
                "url": stream_url,
                "thumbUrl": thumb_url,
                "path": rel_path
            })
        elif root_type == 'stamps':
            category = 'stamps'
            destination = 'tokens'
            pack_name = f'Tampons - {parts[1]}' if len(parts) > 1 else 'Tampons Divers'
            clean_stamps.append({
                "id": f"drive_stamp_{file_id}",
                "name": readable_name,
                "category": parts[1] if len(parts) > 1 else 'Tampons',
                "url": stream_url,
                "thumbUrl": thumb_url,
                "path": rel_path
            })
        elif root_type == 'tokens':
            category = 'tokens'
            destination = 'tokens'
            pack_name = f'Tokens - {parts[1]}' if len(parts) > 1 else 'Tokens Divers'
            clean_tokens.append({
                "id": file_id,
                "name": readable_name,
                "category": parts[1] if len(parts) > 1 else 'Tokens',
                "url": stream_url,
                "thumbUrl": thumb_url,
                "path": rel_path
            })
        else:
            category = 'other'
            destination = 'maps'
            pack_name = parts[0]
            
        pack_id = re.sub(r'[^a-zA-Z0-9_-]', '-', pack_name.lower())
        
        if pack_id not in packs_dict:
            packs_dict[pack_id] = {
                'id': pack_id,
                'name': pack_name,
                'category': category,
                'destination': destination,
                'subfolder': pack_name,
                'item_count': 0,
                'thumbnail': thumb_url,
                'preview_urls': [],
                'files': []
            }
            
        pack = packs_dict[pack_id]
        pack['item_count'] += 1
        if len(pack['preview_urls']) < 4:
            pack['preview_urls'].append(thumb_url)
            
        pack['files'].append({
            'id': file_id,
            'name': readable_name,
            'filename': filename,
            'path': rel_path,
            'category': category,
            'destination': destination,
            'subfolder': pack_name,
            'url': stream_url,
            'highResUrl': high_res_url,
            'thumbUrl': thumb_url
        })
        
    packs_list = list(packs_dict.values())
    packs_list.sort(key=lambda p: (0 if p['category'] == 'maps' else 1 if p['category'] == 'textures' else 2, p['name']))
    
    catalog = {
        "version": "2.0.0",
        "updated": "2026-08-26",
        "folderId": FOLDER_ID,
        "totalPacks": len(packs_list),
        "totalMaps": len(clean_maps),
        "totalTextures": len(clean_textures),
        "totalStamps": len(clean_stamps),
        "totalTokens": len(clean_tokens),
        "packs": packs_list,
        "maps": clean_maps,
        "textures": clean_textures,
        "stamps": clean_stamps,
        "tokens": clean_tokens
    }
    
    os.makedirs(os.path.dirname(OUTPUT_CATALOG), exist_ok=True)
    with open(OUTPUT_CATALOG, 'w', encoding='utf-8') as f:
        json.dump(catalog, f, indent=2, ensure_ascii=False)
        
    print(f"✨ Catalogue Google Drive généré avec succès dans {OUTPUT_CATALOG} !")
    print(f"📊 Statistiques : {len(packs_list)} Packs ({len(clean_maps)} Cartes | {len(clean_textures)} Textures | {len(clean_stamps)} Tampons).")

if __name__ == '__main__':
    build_catalog()
