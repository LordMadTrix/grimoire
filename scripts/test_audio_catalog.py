import json
import os

with open('public/drive-catalog.json', 'r', encoding='utf-8') as f:
    drive_data = json.load(f)

with open('public/assets/audio/Grimoire_Audio/audio_manifest.json', 'r', encoding='utf-8') as f:
    audio_data = json.load(f)

print(f"Drive files: {len(drive_data.get('files', []))}")
print(f"Audio items: {len(audio_data.get('items', []))}")

audio_files = []
for idx, item in enumerate(audio_data.get('items', [])):
    item_type = item.get('type', 'sfx')
    item_id = f"audio_{item_type}_{item.get('id', idx)}"
    rel_path = f"assets/audio/Grimoire_Audio/{item['path']}"
    name = item.get('frenchTitle') or item.get('title')
    audio_files.append([item_id, rel_path, name])

print(f"Total audio catalog items: {len(audio_files)}")
print(f"Sample: {audio_files[0]}")
