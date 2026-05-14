import re
import os
import requests
import sys
import time

# Config
BASE_URL = "https://tabletopaudio.com/"
DOWNLOAD_URL_TEMPLATE = "https://sounds.tabletopaudio.com/{}.mp3"
TARGET_DIR = "wfrp_vault/assets/audio/TabletopAudio"
USER_AGENT = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"

def parse_tracks(html):
    # Split by mix div to isolate each track
    blocks = re.split(r'<div class="[^"]*mix', html)[1:]
    
    tracks = []
    for block in blocks:
        # Extract categories
        cat_match = re.search(r'^([^"]+)"', block)
        categories = []
        if cat_match:
            cats_raw = cat_match.group(1).strip().split()
            categories = [c for c in cats_raw if c not in ['col-md-3', 'mix']]

        # Extract Track ID from saveAs
        id_match = re.search(r"onclick=\"saveAs\('([^']+)'\)\"", block)
        if not id_match:
            continue
        track_id = id_match.group(1)

        # Extract Name from h3
        name_match = re.search(r'<h3[^>]*>([^<]+)</h3>', block)
        name = name_match.group(1).strip() if name_match else track_id

        tracks.append({
            'id': track_id,
            'name': name,
            'categories': categories
        })
    return tracks

def get_best_category(categories):
    # Filter out 'music' if others exist
    filtered = [c for c in categories if c.lower() != 'music']
    if not filtered:
        return "Music" if categories else "Uncategorized"
    return filtered[0].capitalize()

def download_track(track, limit_folder=None):
    category = get_best_category(track['categories'])
    dest_dir = os.path.join(TARGET_DIR, category)
    if not os.path.exists(dest_dir):
        os.makedirs(dest_dir)

    filename = f"{track['name']}.mp3".replace("/", "-") # Basic sanitization
    dest_path = os.path.join(dest_dir, filename)

    if os.path.exists(dest_path):
        return "Exists"

    url = DOWNLOAD_URL_TEMPLATE.format(track['id'])
    
    try:
        headers = {
            "User-Agent": USER_AGENT,
            "Referer": BASE_URL
        }
        response = requests.get(url, stream=True, headers=headers, timeout=30)
        response.raise_for_status()
        
        with open(dest_path, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)
        return "Downloaded"
    except Exception as e:
        return f"Error: {e}"

def main():
    if not os.path.exists(TARGET_DIR):
        os.makedirs(TARGET_DIR)

    print("Fetching Tabletop Audio track list...")
    try:
        resp = requests.get(BASE_URL, headers={"User-Agent": USER_AGENT})
        resp.raise_for_status()
        html = resp.text
    except Exception as e:
        print(f"Failed to fetch site: {e}")
        return

    tracks = parse_tracks(html)
    print(f"Found {len(tracks)} tracks.")

    limit = None
    if len(sys.argv) > 1 and sys.argv[1] == "--limit":
        limit = int(sys.argv[2])
        print(f"Limiting to {limit} downloads for testing.")
        tracks = tracks[:limit]

    count = 0
    total = len(tracks)
    for track in tracks:
        count += 1
        print(f"[{count}/{total}] Processing: {track['name']}...", end=" ", flush=True)
        status = download_track(track)
        print(status)
        
        # Polite delay to avoid IP block
        if status == "Downloaded":
            time.sleep(1)

    print("\nDone!")

if __name__ == "__main__":
    main()
