use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

use crate::commands::addons::sanitize_relative_path;

/// Entrée dans l'arbre de fichiers du vault
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct VaultEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub children: Option<Vec<VaultEntry>>,
    pub extension: Option<String>,
    pub size: Option<u64>,
}

/// Ouvre un vault et retourne son arbre de fichiers
#[tauri::command]
pub fn open_vault(path: String) -> Result<Vec<VaultEntry>, String> {
    let vault_path = Path::new(&path);
    if !vault_path.exists() {
        return Err(format!("Vault path does not exist: {}", path));
    }
    if !vault_path.is_dir() {
        return Err(format!("Vault path is not a directory: {}", path));
    }

    scan_directory(vault_path, vault_path)
}

/// Liste le contenu d'un répertoire du vault
#[tauri::command]
pub fn list_directory(vault_path: String, relative_path: String) -> Result<Vec<VaultEntry>, String> {
    let full_path = Path::new(&vault_path).join(sanitize_relative_path(&relative_path));
    if !full_path.exists() || !full_path.is_dir() {
        return Err(format!("Directory not found: {}", relative_path));
    }
    let base = Path::new(&vault_path);
    scan_directory(&full_path, base)
}

/// Lit le contenu d'un fichier du vault
#[tauri::command]
pub fn read_file(vault_path: String, relative_path: String) -> Result<String, String> {
    let full_path = Path::new(&vault_path).join(&relative_path);

    // Sécurité : vérifier que le chemin est bien dans le vault
    let canonical = full_path.canonicalize().map_err(|e| e.to_string())?;
    let vault_canonical = Path::new(&vault_path).canonicalize().map_err(|e| e.to_string())?;
    if !canonical.starts_with(&vault_canonical) {
        return Err("Path traversal detected".to_string());
    }

    std::fs::read_to_string(&full_path).map_err(|e| e.to_string())
}

use base64::{Engine as _, engine::general_purpose};

/// Lit un fichier binaire et le retourne en base64
#[tauri::command]
pub fn read_file_base64(path: String) -> Result<String, String> {
    let p = Path::new(&path);
    if !p.exists() {
        return Err(format!("File not found: {}", path));
    }
    if !p.is_file() {
        return Err(format!("Path is not a file: {}", path));
    }
    let metadata = std::fs::metadata(p).map_err(|e| e.to_string())?;
    const MAX_BASE64_READ_BYTES: u64 = 100 * 1024 * 1024; // 100 MiB
    if metadata.len() > MAX_BASE64_READ_BYTES {
        return Err(format!(
            "File too large for base64 read ({} bytes, max {} bytes)",
            metadata.len(),
            MAX_BASE64_READ_BYTES
        ));
    }
    let bytes = std::fs::read(p).map_err(|e| e.to_string())?;
    Ok(general_purpose::STANDARD.encode(bytes))
}

/// Lit un fichier binaire et le retourne sous forme de buffer brut IPC (zéro encodage base64, streaming natif)
#[tauri::command]
pub fn read_file_binary(path: String) -> Result<tauri::ipc::Response, String> {
    let p = Path::new(&path);
    if !p.exists() {
        return Err(format!("Fichier non trouvé: {}", path));
    }
    if !p.is_file() {
        return Err(format!("Le chemin n'est pas un fichier: {}", path));
    }
    let bytes = std::fs::read(p).map_err(|e| e.to_string())?;
    Ok(tauri::ipc::Response::new(bytes))
}

use std::io::Write;

/// Écriture atomique anti-corruption : écriture dans un .tmp adjacent, fsync matériel puis rename atomique de l'OS
pub fn write_atomic(target_path: &Path, data: &[u8]) -> Result<(), String> {
    let parent = target_path
        .parent()
        .ok_or_else(|| "Dossier parent invalide".to_string())?;
    std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;

    let tmp_file_name = format!(".tmp_{}", uuid::Uuid::new_v4());
    let tmp_path = parent.join(tmp_file_name);

    {
        let mut file = std::fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&tmp_path)
            .map_err(|e| format!("Erreur création fichier temporaire : {}", e))?;

        file.write_all(data).map_err(|e| {
            let _ = std::fs::remove_file(&tmp_path);
            format!("Erreur écriture fichier temporaire : {}", e)
        })?;

        file.sync_all().map_err(|e| {
            let _ = std::fs::remove_file(&tmp_path);
            format!("Erreur fsync matériel : {}", e)
        })?;
    }

    std::fs::rename(&tmp_path, target_path).map_err(|e| {
        let _ = std::fs::remove_file(&tmp_path);
        format!("Erreur swap atomique du fichier : {}", e)
    })?;

    Ok(())
}

/// Écrit des données base64 (ex: image PNG générée par le Map Editor) dans un fichier du vault de façon atomique
#[tauri::command]
pub fn write_file_base64(vault_path: String, relative_path: String, base64_content: String) -> Result<(), String> {
    let full_path = Path::new(&vault_path).join(sanitize_relative_path(&relative_path));

    let clean_b64 = if let Some(idx) = base64_content.find(',') {
        &base64_content[idx + 1..]
    } else {
        &base64_content
    };

    let bytes = general_purpose::STANDARD.decode(clean_b64).map_err(|e| format!("Invalid base64: {}", e))?;

    write_atomic(&full_path, &bytes)
}

fn get_history_dir(vault_path: &str, relative_path: &str) -> PathBuf {
    let safe_folder: String = relative_path
        .replace('/', "_")
        .replace('\\', "_")
        .replace(':', "_");
    Path::new(vault_path)
        .join(".grimoire")
        .join("history")
        .join(safe_folder)
}

fn save_snapshot(vault_path: &str, relative_path: &str, content: &str) {
    let hist_dir = get_history_dir(vault_path, relative_path);
    let _ = std::fs::create_dir_all(&hist_dir);

    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);

    let file_name = format!("{timestamp}.md");
    let snapshot_file = hist_dir.join(file_name);
    let _ = write_atomic(&snapshot_file, content.as_bytes());

    // Garder seulement les 10 snapshots les plus récents
    if let Ok(entries) = std::fs::read_dir(&hist_dir) {
        let mut files: Vec<PathBuf> = entries
            .filter_map(|e| e.ok().map(|e| e.path()))
            .filter(|p| p.extension().map_or(false, |ext| ext == "md"))
            .collect();
        files.sort();
        if files.len() > 10 {
            for old in files.iter().take(files.len() - 10) {
                let _ = std::fs::remove_file(old);
            }
        }
    }
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct NoteSnapshot {
    pub id: String,
    pub timestamp: u64,
    pub date_formatted: String,
    pub size: usize,
    pub preview: String,
}

#[tauri::command]
pub fn get_file_history(vault_path: String, relative_path: String) -> Result<Vec<NoteSnapshot>, String> {
    let hist_dir = get_history_dir(&vault_path, &relative_path);
    if !hist_dir.exists() {
        return Ok(Vec::new());
    }

    let mut snapshots = Vec::new();
    if let Ok(entries) = std::fs::read_dir(&hist_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().map_or(false, |ext| ext == "md") {
                let stem = path.file_stem().and_then(|s| s.to_str()).unwrap_or("");
                if let Ok(ts) = stem.parse::<u64>() {
                    let content = std::fs::read_to_string(&path).unwrap_or_default();
                    let size = content.len();
                    let preview = content.chars().take(200).collect::<String>();
                    let date_formatted = chrono::DateTime::from_timestamp(ts as i64, 0)
                        .map(|dt| dt.format("%d/%m/%Y %H:%M:%S").to_string())
                        .unwrap_or_else(|| format!("{ts}"));
                    snapshots.push(NoteSnapshot {
                        id: stem.to_string(),
                        timestamp: ts,
                        date_formatted,
                        size,
                        preview,
                    });
                }
            }
        }
    }
    snapshots.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));
    Ok(snapshots)
}

#[tauri::command]
pub fn restore_file_snapshot(
    db: tauri::State<'_, crate::commands::search::DbState>,
    vault_path: String,
    relative_path: String,
    snapshot_id: String,
) -> Result<String, String> {
    let hist_dir = get_history_dir(&vault_path, &relative_path);
    let snapshot_file = hist_dir.join(format!("{}.md", snapshot_id));
    if !snapshot_file.exists() {
        return Err("Snapshot introuvable".to_string());
    }
    let content = std::fs::read_to_string(&snapshot_file).map_err(|e| e.to_string())?;
    write_file(db, vault_path, relative_path, content.clone())?;
    Ok(content)
}

/// Écrit du contenu dans un fichier du vault de manière atomique et met à jour l'index FTS5 en temps réel
#[tauri::command]
pub fn write_file(
    db: tauri::State<'_, crate::commands::search::DbState>,
    vault_path: String,
    relative_path: String,
    content: String,
) -> Result<(), String> {
    let full_path = Path::new(&vault_path).join(sanitize_relative_path(&relative_path));

    // Si le fichier existe déjà et que c'est un fichier markdown (.md), sauvegarder un snapshot
    if full_path.is_file() && relative_path.ends_with(".md") {
        if let Ok(old_content) = std::fs::read_to_string(&full_path) {
            if old_content != content && !old_content.trim().is_empty() {
                save_snapshot(&vault_path, &relative_path, &old_content);
            }
        }
    }

    write_atomic(&full_path, content.as_bytes())?;

    // Indexation incrémentale immédiate dans SQLite FTS5 (< 2ms)
    if relative_path.ends_with(".md") {
        if let Ok(conn) = db.0.lock() {
            let _ = crate::indexer::index_single_file(&conn, &relative_path, &content);
        }
    }

    Ok(())
}

/// Crée un nouveau dossier dans le vault
#[tauri::command]
pub fn create_directory(vault_path: String, relative_path: String) -> Result<(), String> {
    let full_path = Path::new(&vault_path).join(sanitize_relative_path(&relative_path));
    std::fs::create_dir_all(&full_path).map_err(|e| e.to_string())
}

/// Supprime un fichier du vault et le retire de l'index FTS5
#[tauri::command]
pub fn delete_file(
    db: tauri::State<'_, crate::commands::search::DbState>,
    vault_path: String,
    relative_path: String,
) -> Result<(), String> {
    let full_path = Path::new(&vault_path).join(&relative_path);

    let vault_canonical = Path::new(&vault_path).canonicalize().map_err(|e| e.to_string())?;
    let canonical = full_path.canonicalize().map_err(|e| e.to_string())?;
    if !canonical.starts_with(&vault_canonical) {
        return Err("Path traversal detected".to_string());
    }

    if full_path.is_dir() {
        std::fs::remove_dir_all(&full_path).map_err(|e| e.to_string())?;
    } else {
        std::fs::remove_file(&full_path).map_err(|e| e.to_string())?;
    }

    // Retrait immédiat de l'index FTS5
    if relative_path.ends_with(".md") {
        if let Ok(conn) = db.0.lock() {
            let _ = crate::indexer::remove_from_index(&conn, &relative_path);
        }
    }

    Ok(())
}

/// Renomme un fichier ou dossier et synchronise l'index FTS5
#[tauri::command]
pub fn rename_entry(
    db: tauri::State<'_, crate::commands::search::DbState>,
    vault_path: String,
    old_path: String,
    new_path: String,
) -> Result<(), String> {
    let old_full = Path::new(&vault_path).join(sanitize_relative_path(&old_path));
    let new_full = Path::new(&vault_path).join(sanitize_relative_path(&new_path));

    // Créer les dossiers parents du nouveau chemin
    if let Some(parent) = new_full.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    std::fs::rename(&old_full, &new_full).map_err(|e| e.to_string())?;

    // Mettre à jour l'index FTS5 si c'est un fichier markdown
    if new_path.ends_with(".md") {
        if let Ok(conn) = db.0.lock() {
            let _ = crate::indexer::remove_from_index(&conn, &old_path);
            if let Ok(content) = std::fs::read_to_string(&new_full) {
                let _ = crate::indexer::index_single_file(&conn, &new_path, &content);
            }
        }
    }

    Ok(())
}

// ── Helpers ──────────────────────────────────────────────────────

fn scan_directory(dir: &Path, base: &Path) -> Result<Vec<VaultEntry>, String> {
    let mut entries = Vec::new();

    let read_dir = std::fs::read_dir(dir).map_err(|e| e.to_string())?;

    for entry in read_dir {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();

        // Ignorer les fichiers/dossiers cachés et .grimoire
        if name.starts_with('.') || name == "node_modules" {
            continue;
        }

        let relative = path.strip_prefix(base)
            .unwrap_or(&path)
            .to_string_lossy()
            .replace('\\', "/");

        if path.is_dir() {
            let children = scan_directory(&path, base).ok();
            entries.push(VaultEntry {
                name,
                path: relative,
                is_dir: true,
                children,
                extension: None,
                size: None,
            });
        } else {
            let ext = path.extension()
                .map(|e| e.to_string_lossy().to_string());
            let size = std::fs::metadata(&path).ok().map(|m| m.len());

            entries.push(VaultEntry {
                name,
                path: relative,
                is_dir: false,
                children: None,
                extension: ext,
                size,
            });
        }
    }

    // Dossiers d'abord, puis fichiers, triés par nom
    entries.sort_by(|a, b| {
        match (a.is_dir, b.is_dir) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
        }
    });

    Ok(entries)
}

/// Ouvre une URL dans le navigateur par défaut du système (cross-platform)
#[tauri::command]
pub fn open_url(url: String) -> Result<(), String> {
    if !url.starts_with("http://") && !url.starts_with("https://") {
        return Err("Only http/https URLs are allowed".to_string());
    }
    opener::open_browser(&url).map_err(|e| e.to_string())
}

/// Sauvegarde un fichier binaire (STL, zip, etc.) sur le disque à l'emplacement choisi par l'utilisateur
#[tauri::command]
pub fn save_binary_file_to_disk(file_path: String, base64_content: String) -> Result<(), String> {
    use base64::{engine::general_purpose, Engine as _};
    let clean_b64 = if let Some(idx) = base64_content.find(',') {
        &base64_content[idx + 1..]
    } else {
        &base64_content
    };
    let bytes = general_purpose::STANDARD.decode(clean_b64).map_err(|e| format!("Invalid base64: {}", e))?;
    std::fs::write(&file_path, bytes).map_err(|e| e.to_string())?;
    Ok(())
}

/// Ouvre un fichier ou chemin local dans l'application par défaut de l'OS (navigateur, slicer 3D, etc.)
#[tauri::command]
pub fn open_file_in_os(path: String) -> Result<(), String> {
    opener::open(&path).map_err(|e| e.to_string())
}

/// Écrit un fichier HTML temporaire et l'ouvre directement dans le navigateur par défaut pour impression
#[tauri::command]
pub fn save_temp_html_and_open(filename: String, html_content: String) -> Result<String, String> {
    let temp_dir = std::env::temp_dir();
    // Basename uniquement : un nom fourni avec des séparateurs (`../` ou un
    // chemin absolu) ne doit pas écrire hors du dossier temporaire.
    let safe_name = Path::new(&filename)
        .file_name()
        .map(|s| s.to_string_lossy().to_string())
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| "grimoire-impression.html".to_string());
    let file_path = temp_dir.join(safe_name);
    std::fs::write(&file_path, html_content).map_err(|e| e.to_string())?;
    let path_str = file_path.to_string_lossy().to_string();
    opener::open(&path_str).map_err(|e| e.to_string())?;
    Ok(path_str)
}

/// Détecte le type MIME d'une image à partir de ses premiers octets (magic bytes)
fn detect_image_mime(bytes: &[u8]) -> &'static str {
    if bytes.starts_with(b"\x89PNG\r\n\x1a\n") {
        "image/png"
    } else if bytes.starts_with(b"\xff\xd8\xff") {
        "image/jpeg"
    } else if bytes.len() > 12 && &bytes[0..4] == b"RIFF" && &bytes[8..12] == b"WEBP" {
        "image/webp"
    } else if bytes.starts_with(b"GIF87a") || bytes.starts_with(b"GIF89a") {
        "image/gif"
    } else if bytes.starts_with(b"<svg") || bytes.starts_with(b"<?xml") {
        "image/svg+xml"
    } else {
        "image/png"
    }
}

/// Extrait l'ID de fichier Google Drive depuis diverses formes d'URLs
fn extract_gdrive_id(url: &str) -> Option<String> {
    if !url.contains("google") {
        return None;
    }
    // Forme id=...
    if let Some(pos) = url.find("id=") {
        let after = &url[pos + 3..];
        let end = after.find('&').unwrap_or(after.len());
        let id = &after[..end];
        if !id.is_empty() {
            return Some(id.to_string());
        }
    }
    // Forme /d/...
    if let Some(pos) = url.find("/d/") {
        let after = &url[pos + 3..];
        let end = after.find('/').or_else(|| after.find('=')).or_else(|| after.find('?')).unwrap_or(after.len());
        let id = &after[..end];
        if !id.is_empty() {
            return Some(id.to_string());
        }
    }
    // Forme file/d/...
    if let Some(pos) = url.find("file/d/") {
        let after = &url[pos + 7..];
        let end = after.find('/').unwrap_or(after.len());
        let id = &after[..end];
        if !id.is_empty() {
            return Some(id.to_string());
        }
    }
    None
}

/// Télécharge ou lit une image locale/distante et la retourne sous forme de Data URL (base64)
/// Permet de contourner à 100% les restrictions CORS du navigateur (ex. Google Drive, Unsplash)
/// et d'éviter l'erreur 'Tainted canvases may not be exported' lors de l'export PNG.
#[tauri::command]
pub async fn download_image_base64(url: String) -> Result<String, String> {
    if url.starts_with("data:") {
        return Ok(url);
    }

    // Cas 1 : Chemin local absolu sur le disque ou relatif à public/
    let p = Path::new(&url);
    if p.exists() && p.is_file() {
        let bytes = std::fs::read(p).map_err(|e| e.to_string())?;
        let mime = detect_image_mime(&bytes);
        return Ok(format!("data:{};base64,{}", mime, general_purpose::STANDARD.encode(bytes)));
    }

    // Chemin relatif (ex: /tokens/library/enemies/dragon.png)
    let clean_rel = url.trim_start_matches('/').trim_start_matches('\\');
    let candidates_local = [
        PathBuf::from(clean_rel),
        PathBuf::from("public").join(clean_rel),
        PathBuf::from("../public").join(clean_rel),
    ];
    for lp in &candidates_local {
        if lp.exists() && lp.is_file() {
            if let Ok(bytes) = std::fs::read(lp) {
                let mime = detect_image_mime(&bytes);
                return Ok(format!("data:{};base64,{}", mime, general_purpose::STANDARD.encode(bytes)));
            }
        }
    }

    // Cas 2 : Téléchargement distant via reqwest
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(20))
        .redirect(reqwest::redirect::Policy::limited(10))
        .build()
        .map_err(|e| e.to_string())?;

    let mut candidate_urls = Vec::new();

    // Endpoints optimisés pour Google Drive
    if let Some(file_id) = extract_gdrive_id(&url) {
        candidate_urls.push(format!("https://lh3.googleusercontent.com/d/{file_id}=s0"));
        candidate_urls.push(format!("https://lh3.googleusercontent.com/d/{file_id}=w1000"));
        candidate_urls.push(format!("https://drive.usercontent.google.com/download?id={file_id}&export=download&authuser=0&confirm=t"));
        candidate_urls.push(format!("https://drive.google.com/thumbnail?id={file_id}&sz=w1000"));
        candidate_urls.push(format!("https://drive.google.com/uc?export=download&id={file_id}"));
    }

    // Toujours tester l'URL d'origine en premier ou en complément
    candidate_urls.insert(0, url.clone());

    let mut last_err = String::from("Aucune source valide trouvée");

    for target_url in candidate_urls {
        let req = client
            .get(&target_url)
            .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36")
            .header("Accept", "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8");

        match req.send().await {
            Ok(res) if res.status().is_success() => {
                if let Ok(bytes) = res.bytes().await {
                    if bytes.len() > 64 {
                        let preview = String::from_utf8_lossy(&bytes[..std::cmp::min(bytes.len(), 120)]).to_lowercase();
                        if !preview.contains("<!doctype html") && !preview.contains("<html") {
                            let mime = detect_image_mime(&bytes);
                            let b64 = general_purpose::STANDARD.encode(&bytes);
                            return Ok(format!("data:{};base64,{}", mime, b64));
                        }
                    }
                }
            }
            Ok(res) => {
                last_err = format!("HTTP {}", res.status());
            }
            Err(e) => {
                last_err = e.to_string();
            }
        }
    }

    Err(format!("Impossible de convertir l'image distante ({}) : {}", url, last_err))
}


