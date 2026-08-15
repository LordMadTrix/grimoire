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

/// Résout le dossier public/ du projet Grimoire depuis l'exe Tauri.
/// En dev : <project_root>/public/<dest>
/// En prod : <resource_dir>/public/<dest> (ou à côté de l'exe si packagé)
pub(crate) fn resolve_public_dir(app: &AppHandle, destination: &str) -> Result<PathBuf, String> {
    // Tauri expose le resource_dir qui contient les assets embarqués
    let base = app.path().resource_dir().map_err(|e| e.to_string())?;
    // En Tauri v2 avec externalBin, les ressources sont dans _up/public en dev
    // On cherche public/ relatif à l'exe
    let candidate = base.join("public").join(destination);
    if candidate.exists() || cfg!(debug_assertions) {
        // En dev, remonter jusqu'à trouver public/
        if cfg!(debug_assertions) {
            // Remonter depuis le manifest dir
            let exe = std::env::current_exe().map_err(|e| e.to_string())?;
            // src-tauri/target/debug/grimoire.exe → remonter 3 niveaux
            if let Some(p) = exe.ancestors().nth(3) {
                let dev_public = p.join("public").join(destination);
                std::fs::create_dir_all(&dev_public).map_err(|e| e.to_string())?;
                return Ok(dev_public);
            }
        }
        std::fs::create_dir_all(&candidate).map_err(|e| e.to_string())?;
        return Ok(candidate);
    }
    // Fallback : à côté de l'exe
    let exe = std::env::current_exe().map_err(|e| e.to_string())?;
    let dir = exe.parent().ok_or("Impossible de trouver le dossier exe")?
        .join("public").join(destination);
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
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

    // Supporte deux formats : tableau direct ou { "addons": [...] }
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

/// Télécharge et extrait un addon ZIP.
/// Émet des événements Tauri `addon://progress` avec { done, total, file }.
#[command]
pub async fn addon_install(
    app: AppHandle,
    addon: AddonManifest,
) -> Result<InstalledAddon, String> {
    // Vérifier si déjà installé
    let mut registry = load_registry(&app)?;
    if registry.iter().any(|a| a.id == addon.id && a.version == addon.version) {
        return Err(format!("Addon '{}' déjà installé.", addon.name));
    }

    // Télécharger le ZIP
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(300))
        .build()
        .map_err(|e| e.to_string())?;

    let resp = client.get(&addon.download_url)
        .send().await.map_err(|e| e.to_string())?;

    if !resp.status().is_success() {
        return Err(format!("Téléchargement échoué : HTTP {}", resp.status()));
    }

    let bytes = resp.bytes().await.map_err(|e| e.to_string())?;

    // Extraire le ZIP
    let dest_dir = resolve_public_dir(&app, &addon.destination)?;
    let cursor = std::io::Cursor::new(&bytes[..]);
    let mut archive = zip::ZipArchive::new(cursor).map_err(|e| e.to_string())?;

    let total = archive.len();
    let mut extracted_files: Vec<String> = Vec::new();

    for i in 0..total {
        let mut entry = archive.by_index(i).map_err(|e| e.to_string())?;
        let name = entry.name().to_string();

        // Ignorer les dossiers, métadonnées macOS et fichiers cachés (à tout niveau)
        let components: Vec<&str> = name.split(['/', '\\']).filter(|c| !c.is_empty()).collect();
        if name.ends_with('/')
            || components.is_empty()
            || components.iter().any(|c| c.starts_with('.') || *c == "__MACOSX")
        {
            continue;
        }

        // Sécurité : rejeter path traversal et chemins absolus, en préservant
        // l'arborescence du ZIP (l'aplatir ferait s'écraser les fichiers homonymes)
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

        // Émettre la progression
        let _ = app.emit("addon://progress", serde_json::json!({
            "addon_id": addon.id,
            "done": i + 1,
            "total": total,
            "file": name
        }));
    }

    // Enregistrer dans le registre
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

    registry.push(installed.clone());
    save_registry(&app, &registry)?;

    Ok(installed)
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
            std::fs::remove_file(&path).map_err(|e| e.to_string())?;
        }
    }

    registry.remove(pos);
    save_registry(&app, &registry)?;
    Ok(())
}
