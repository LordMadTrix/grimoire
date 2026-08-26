use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::{command, AppHandle, Emitter, Manager};

// ─────────────────────────────────────────────────────────────────────────────
// Types publics
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AddonManifest {
    pub id: String,
    pub name: String,
    pub version: String,
    pub category: String, // "maps" | "tokens" | "tiles" | "other"
    pub description: String,
    pub author: String,
    pub thumbnail: Option<String>,
    pub download_url: String,
    pub size_bytes: Option<u64>,
    pub file_count: Option<u32>,
    pub destination: String, // sous-dossier cible dans public/ : "maps", "tokens", "tiles/custom"
    pub tags: Option<Vec<String>>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct InstalledAddon {
    pub id: String,
    pub name: String,
    pub version: String,
    pub installed_at: String,
    pub destination: String,
    pub files: Vec<String>, // chemins relatifs depuis destination
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DriveFileItem {
    pub id: String,
    pub name: String,
    pub filename: String,
    pub path: Option<String>,
    pub category: Option<String>,
    pub destination: Option<String>,
    pub subfolder: Option<String>,
    pub url: Option<String>,
    pub high_res_url: Option<String>,
    pub thumb_url: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct AddonCatalog {
    version: String,
    addons: Vec<AddonManifest>,
}

// ─────────────────────────────────────────────────────────────────────────────
// Chemin du registre local
// ─────────────────────────────────────────────────────────────────────────────

fn registry_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join("addon-registry.json"))
}

fn load_registry(app: &AppHandle) -> Result<Vec<InstalledAddon>, String> {
    let path = registry_path(app)?;
    if !path.exists() {
        return Ok(vec![]);
    }
    let data = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    serde_json::from_str(&data).map_err(|e| e.to_string())
}

fn save_registry(app: &AppHandle, registry: &[InstalledAddon]) -> Result<(), String> {
    let path = registry_path(app)?;
    let data = serde_json::to_string_pretty(registry).map_err(|e| e.to_string())?;
    std::fs::write(path, data).map_err(|e| e.to_string())
}

/// Nettoie un chemin relatif pour préserver l'arborescence de sous-dossiers en toute sécurité
pub fn sanitize_relative_path(path_str: &str) -> PathBuf {
    let mut clean = PathBuf::new();
    for comp in path_str.split(['/', '\\']) {
        let trimmed = comp.trim();
        if trimmed.is_empty() || trimmed == "." || trimmed == ".." {
            continue;
        }
        let safe_comp: String = trimmed.chars()
            .map(|c| if ['<', '>', ':', '"', '|', '?', '*'].contains(&c) { '_' } else { c })
            .collect();
        clean.push(safe_comp);
    }
    clean
}

/// Résout le dossier public/ du projet Grimoire depuis l'exe Tauri.
/// En dev : <project_root>/public/<dest>
/// En prod : <app_data_dir>/public/<dest> (toujours accessible en écriture sans droits admin)
pub(crate) fn resolve_public_dir(app: &AppHandle, destination: &str) -> Result<PathBuf, String> {
    // 1. En mode développement, remonter les ancêtres pour trouver la racine du projet contenant package.json
    if cfg!(debug_assertions) {
        if let Ok(exe) = std::env::current_exe() {
            for ancestor in exe.ancestors() {
                if ancestor.join("package.json").exists() {
                    let dev_public = ancestor.join("public").join(destination);
                    let _ = std::fs::create_dir_all(&dev_public);
                    if dev_public.exists() {
                        return Ok(dev_public);
                    }
                }
            }
        }
        if let Ok(cwd) = std::env::current_dir() {
            for ancestor in cwd.ancestors() {
                if ancestor.join("package.json").exists() {
                    let dev_public = ancestor.join("public").join(destination);
                    let _ = std::fs::create_dir_all(&dev_public);
                    if dev_public.exists() {
                        return Ok(dev_public);
                    }
                }
            }
        }
    }

    // 2. En production, utiliser app_data_dir (dossier utilisateur garanti en écriture sans droit admin)
    if let Ok(app_data) = app.path().app_data_dir() {
        let user_public = app_data.join("public").join(destination);
        if let Ok(_) = std::fs::create_dir_all(&user_public) {
            return Ok(user_public);
        }
    }

    // 3. Fallback dossier exe parent
    if let Ok(exe) = std::env::current_exe() {
        if let Some(parent) = exe.parent() {
            let dir = parent.join("public").join(destination);
            let _ = std::fs::create_dir_all(&dir);
            if dir.exists() {
                return Ok(dir);
            }
        }
    }

    // 4. Dernier fallback resource_dir
    let base = app.path().resource_dir().map_err(|e| e.to_string())?;
    let candidate = base.join("public").join(destination);
    let _ = std::fs::create_dir_all(&candidate);
    Ok(candidate)
}

/// Télécharge les données brutes d'une image/fichier depuis Google Drive en testant successivement tous les endpoints CDN
async fn fetch_google_drive_bytes(
    client: &reqwest::Client,
    file_id: &str,
    passed_url: Option<&str>,
) -> Result<Vec<u8>, String> {
    let mut candidate_urls = Vec::new();
    if let Some(u) = passed_url {
        if !u.trim().is_empty() {
            candidate_urls.push(u.to_string());
        }
    }
    // Endpoints rapides Google CDN sans captcha/cookies
    candidate_urls.push(format!("https://lh3.googleusercontent.com/d/{file_id}=s0"));
    candidate_urls.push(format!("https://lh3.googleusercontent.com/d/{file_id}"));
    candidate_urls.push(format!("https://drive.usercontent.google.com/download?id={file_id}&export=download&authuser=0&confirm=t"));
    candidate_urls.push(format!("https://drive.google.com/uc?export=download&id={file_id}"));
    candidate_urls.push(format!("https://drive.google.com/thumbnail?id={file_id}&sz=w4000"));

    let mut last_err = String::new();

    for url in candidate_urls {
        let req = client.get(&url)
            .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
            .header("Accept", "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8");

        match req.send().await {
            Ok(resp) if resp.status().is_success() => {
                if let Ok(bytes) = resp.bytes().await {
                    if bytes.len() > 100 {
                        let header_preview = String::from_utf8_lossy(&bytes[..std::cmp::min(bytes.len(), 120)]).to_lowercase();
                        if !header_preview.contains("<!doctype html") && !header_preview.contains("<html") {
                            return Ok(bytes.to_vec());
                        }
                    }
                }
            }
            Ok(resp) => {
                last_err = format!("HTTP {}", resp.status());
            }
            Err(e) => {
                last_err = e.to_string();
            }
        }
    }

    Err(format!("Échec du téléchargement pour ({file_id}) : {last_err}"))
}

// ─────────────────────────────────────────────────────────────────────────────
// Commandes Tauri
// ─────────────────────────────────────────────────────────────────────────────

/// Récupère le catalogue d'addons depuis une URL JSON distante.
#[command]
pub async fn addon_fetch_catalog(catalog_url: String) -> Result<Vec<AddonManifest>, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| e.to_string())?;

    let resp = client.get(&catalog_url)
        .send().await.map_err(|e| e.to_string())?;

    if !resp.status().is_success() {
        return Err(format!("Erreur catalogue : HTTP {}", resp.status()));
    }

    let text = resp.text().await.map_err(|e| e.to_string())?;
    if let Ok(catalog) = serde_json::from_str::<AddonCatalog>(&text) {
        return Ok(catalog.addons);
    }
    serde_json::from_str::<Vec<AddonManifest>>(&text).map_err(|e| {
        format!("Format catalogue invalide : {e}")
    })
}

/// Retourne la liste des addons installés localement.
#[command]
pub fn addon_list_installed(app: AppHandle) -> Result<Vec<InstalledAddon>, String> {
    load_registry(&app)
}

/// Liste les fichiers actuellement installés / présents sur disque dans public/{destination}
#[command]
pub fn addon_check_installed_files(app: AppHandle, destination: String) -> Result<Vec<String>, String> {
    let dest_dir = resolve_public_dir(&app, &destination)?;
    if !dest_dir.exists() {
        return Ok(vec![]);
    }
    let mut files = Vec::new();
    for entry in walkdir::WalkDir::new(&dest_dir).into_iter().filter_map(|e| e.ok()) {
        if entry.file_type().is_file() {
            if let Ok(rel) = entry.path().strip_prefix(&dest_dir) {
                files.push(rel.to_string_lossy().replace('\\', "/"));
            }
        }
    }
    Ok(files)
}

/// Télécharge un fichier individuel depuis Google Drive et l'enregistre dans son arborescence de sous-dossiers
#[command]
pub async fn addon_download_file(
    app: AppHandle,
    file_id: String,
    filename: String,
    destination: String,
    subfolder: Option<String>,
    url: Option<String>,
    rel_path: Option<String>,
) -> Result<String, String> {
    let base_dir = resolve_public_dir(&app, &destination)?;
    
    // Déterminer le chemin relatif exact en préservant tous les sous-dossiers
    let target_rel = if let Some(ref p) = rel_path {
        let mut clean_p = p.trim().to_string();
        if let Some(stripped) = clean_p.strip_prefix(&format!("{}/", destination)) {
            clean_p = stripped.to_string();
        }
        sanitize_relative_path(&clean_p)
    } else if let Some(ref sub) = subfolder {
        let mut sub_clean = sub.trim().to_string();
        if let Some(stripped) = sub_clean.strip_prefix(&format!("{}/", destination)) {
            sub_clean = stripped.to_string();
        }
        sanitize_relative_path(&sub_clean).join(sanitize_relative_path(&filename))
    } else {
        sanitize_relative_path(&filename)
    };

    let target_path = base_dir.join(&target_rel);

    if let Some(parent) = target_path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(45))
        .build()
        .map_err(|e| e.to_string())?;

    let bytes = fetch_google_drive_bytes(&client, &file_id, url.as_deref()).await?;
    std::fs::write(&target_path, &bytes).map_err(|e| format!("Erreur écriture fichier : {e}"))?;

    let rel_str = target_rel.to_string_lossy().replace('\\', "/");

    // Enregistrer dans le registre local
    let pack_id = format!("file-{}", file_id);
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs().to_string())
        .unwrap_or_else(|_| "0".to_string());
    
    let installed_item = InstalledAddon {
        id: pack_id.clone(),
        name: filename.clone(),
        version: "1.0.0".to_string(),
        installed_at: now,
        destination: destination.clone(),
        files: vec![rel_str.clone()],
    };

    let mut registry = load_registry(&app).unwrap_or_default();
    if let Some(pos) = registry.iter().position(|a| a.id == pack_id) {
        registry[pos] = installed_item;
    } else {
        registry.push(installed_item);
    }
    let _ = save_registry(&app, &registry);

    Ok(rel_str)
}

/// Télécharge un pack ou un sous-dossier complet depuis Google Drive en recréant toute l'arborescence de sous-dossiers
#[command]
pub async fn addon_download_pack(
    app: AppHandle,
    pack_id: String,
    pack_name: String,
    destination: String,
    subfolder: Option<String>,
    files: Vec<DriveFileItem>,
) -> Result<InstalledAddon, String> {
    if files.is_empty() {
        return Err("Aucun fichier dans ce pack.".to_string());
    }

    let base_dir = resolve_public_dir(&app, &destination)?;
    std::fs::create_dir_all(&base_dir).map_err(|e| e.to_string())?;

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(45))
        .build()
        .map_err(|e| e.to_string())?;

    let total = files.len();
    let mut downloaded_files = Vec::new();

    for (i, file_item) in files.iter().enumerate() {
        let target_rel = if let Some(ref p) = file_item.path {
            let mut clean_p = p.trim().to_string();
            if let Some(stripped) = clean_p.strip_prefix(&format!("{}/", destination)) {
                clean_p = stripped.to_string();
            }
            sanitize_relative_path(&clean_p)
        } else if let Some(ref sub) = subfolder {
            let mut sub_clean = sub.trim().to_string();
            if let Some(stripped) = sub_clean.strip_prefix(&format!("{}/", destination)) {
                sub_clean = stripped.to_string();
            }
            sanitize_relative_path(&sub_clean).join(sanitize_relative_path(&file_item.filename))
        } else {
            sanitize_relative_path(&file_item.filename)
        };

        let target_path = base_dir.join(&target_rel);

        if let Some(parent) = target_path.parent() {
            let _ = std::fs::create_dir_all(parent);
        }

        if !target_path.exists() {
            if let Ok(bytes) = fetch_google_drive_bytes(&client, &file_item.id, file_item.url.as_deref()).await {
                let _ = std::fs::write(&target_path, &bytes);
            }
        }

        let rel_str = target_rel.to_string_lossy().replace('\\', "/");
        downloaded_files.push(rel_str);

        // Émission de l'événement de progression
        let _ = app.emit("addon://progress", serde_json::json!({
            "addon_id": pack_id,
            "done": i + 1,
            "total": total,
            "file": file_item.filename
        }));
    }

    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs().to_string())
        .unwrap_or_else(|_| "0".to_string());

    let installed = InstalledAddon {
        id: pack_id.clone(),
        name: pack_name,
        version: "1.0.0".to_string(),
        installed_at: now,
        destination: destination.clone(),
        files: downloaded_files,
    };

    let mut registry = load_registry(&app).unwrap_or_default();
    if let Some(pos) = registry.iter().position(|a| a.id == pack_id) {
        registry[pos] = installed.clone();
    } else {
        registry.push(installed.clone());
    }
    save_registry(&app, &registry)?;

    Ok(installed)
}

fn extract_and_register_zip(
    app: &AppHandle,
    bytes: &[u8],
    addon: &AddonManifest,
) -> Result<InstalledAddon, String> {
    let dest_dir = resolve_public_dir(app, &addon.destination)?;
    let cursor = std::io::Cursor::new(bytes);
    let mut archive = zip::ZipArchive::new(cursor).map_err(|e| format!("Format d'archive ZIP invalide : {e}"))?;

    let total = archive.len();
    let mut extracted_files: Vec<String> = Vec::new();

    for i in 0..total {
        let mut entry = archive.by_index(i).map_err(|e| e.to_string())?;
        let name = entry.name().to_string();

        let components: Vec<&str> = name.split(['/', '\\']).filter(|c| !c.is_empty()).collect();
        if name.ends_with('/')
            || components.is_empty()
            || components.iter().any(|c| c.starts_with('.') || *c == "__MACOSX")
        {
            continue;
        }

        if components.iter().any(|c| *c == ".." || c.contains(':')) {
            continue;
        }
        let rel_path: PathBuf = components.iter().collect();

        let out_path = dest_dir.join(&rel_path);
        if let Some(parent) = out_path.parent() {
            std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        let mut out_file = std::fs::File::create(&out_path).map_err(|e| e.to_string())?;
        std::io::copy(&mut entry, &mut out_file).map_err(|e| e.to_string())?;

        extracted_files.push(rel_path.to_string_lossy().replace('\\', "/"));

        let _ = app.emit("addon://progress", serde_json::json!({
            "addon_id": addon.id,
            "done": i + 1,
            "total": total,
            "file": name
        }));
    }

    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs().to_string())
        .unwrap_or_else(|_| "0".to_string());
    let installed = InstalledAddon {
        id: addon.id.clone(),
        name: addon.name.clone(),
        version: addon.version.clone(),
        installed_at: now,
        destination: addon.destination.clone(),
        files: extracted_files,
    };

    let mut registry = load_registry(app)?;
    if let Some(pos) = registry.iter().position(|a| a.id == addon.id) {
        registry[pos] = installed.clone();
    } else {
        registry.push(installed.clone());
    }
    save_registry(app, &registry)?;

    Ok(installed)
}

/// Télécharge et extrait un addon ZIP depuis une URL distante.
#[command]
pub async fn addon_install(
    app: AppHandle,
    addon: AddonManifest,
) -> Result<InstalledAddon, String> {
    let registry = load_registry(&app)?;
    if registry.iter().any(|a| a.id == addon.id && a.version == addon.version) {
        return Err(format!("Addon '{}' déjà installé.", addon.name));
    }

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(300))
        .build()
        .map_err(|e| e.to_string())?;

    let resp = client.get(&addon.download_url)
        .send().await.map_err(|e| e.to_string())?;

    if !resp.status().is_success() {
        return Err(format!(
            "Téléchargement échoué (HTTP {}). Le pack n'est pas encore disponible sur ce miroir.",
            resp.status()
        ));
    }

    let bytes = resp.bytes().await.map_err(|e| e.to_string())?;
    extract_and_register_zip(&app, &bytes, &addon)
}

/// Importe et extrait un pack ZIP ou .grimoirepack localement depuis le disque.
#[command]
pub async fn addon_install_local_file(
    app: AppHandle,
    file_path: String,
    destination: String,
    name: Option<String>,
) -> Result<InstalledAddon, String> {
    let path = PathBuf::from(&file_path);
    if !path.exists() {
        return Err(format!("Fichier introuvable : {file_path}"));
    }

    let bytes = std::fs::read(&path).map_err(|e| format!("Erreur de lecture du fichier : {e}"))?;

    let file_stem = path.file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("addon-local");

    let addon_name = name.unwrap_or_else(|| file_stem.replace(['-', '_'], " "));
    let addon_id = format!("local-{}", file_stem.to_lowercase().replace(' ', "-"));

    let manifest = AddonManifest {
        id: addon_id,
        name: addon_name,
        version: "1.0.0".to_string(),
        category: destination.clone(),
        description: format!("Pack importé localement depuis {}", path.file_name().unwrap_or_default().to_string_lossy()),
        author: "Local".to_string(),
        thumbnail: None,
        download_url: file_path,
        size_bytes: Some(bytes.len() as u64),
        file_count: None,
        destination,
        tags: Some(vec!["local".to_string(), "import".to_string()]),
    };

    extract_and_register_zip(&app, &bytes, &manifest)
}

/// Désinstalle un addon : supprime ses fichiers et retire du registre.
#[command]
pub fn addon_uninstall(app: AppHandle, addon_id: String) -> Result<(), String> {
    let mut registry = load_registry(&app)?;
    let pos = registry.iter().position(|a| a.id == addon_id)
        .ok_or(format!("Addon '{addon_id}' introuvable dans le registre"))?;

    let addon = registry[pos].clone();
    let dest_dir = resolve_public_dir(&app, &addon.destination)?;

    for file in &addon.files {
        let path = dest_dir.join(file);
        if path.exists() {
            let _ = std::fs::remove_file(&path);
        }
    }

    // Supprimer les dossiers parents vides si possible
    for file in &addon.files {
        let rel = PathBuf::from(file);
        let mut cur = rel.parent();
        while let Some(p) = cur {
            if p.as_os_str().is_empty() {
                break;
            }
            let full = dest_dir.join(p);
            if full.exists() && full != dest_dir {
                let _ = std::fs::remove_dir(&full);
            }
            cur = p.parent();
        }
    }

    registry.remove(pos);
    save_registry(&app, &registry)?;
    Ok(())
}

/// Ouvre le dossier de destination (maps, tokens, audio, etc.) dans l'Explorateur Windows.
#[command]
pub fn addon_open_folder(app: AppHandle, destination: String) -> Result<(), String> {
    let dir = resolve_public_dir(&app, &destination)?;
    opener::open(&dir).map_err(|e| e.to_string())
}
