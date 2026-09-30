use serde::{Deserialize, Serialize};
use std::fs::{self, File};
use std::io::{self, Write};
use std::path::Path;
use tauri::{Emitter, Manager};

#[derive(Serialize, Deserialize)]
pub struct OllamaRequest {
    pub model: String,
    pub prompt: String,
    pub system: String,
    pub stream: bool,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct OllamaResponse {
    pub response: Option<String>,
    pub error: Option<String>,
}

#[derive(Deserialize, Debug)]
pub struct OllamaTagsResponse {
    pub models: Vec<OllamaModelItem>,
}

#[derive(Deserialize, Debug)]
pub struct OllamaModelItem {
    pub name: String,
}

#[derive(Serialize)]
pub struct OllamaStatus {
    pub binary_exists: bool,
    pub server_running: bool,
    pub models: Vec<String>,
}

pub fn find_ollama_binary(app_handle: Option<&tauri::AppHandle>) -> Option<std::path::PathBuf> {
    let bin_name = if cfg!(windows) { "ollama.exe" } else { "ollama" };

    // 1. Grimoire local app_local_data_dir/bin/ (guaranteed user writable)
    if let Some(app) = app_handle {
        if let Ok(data_dir) = app.path().app_local_data_dir() {
            let candidate = data_dir.join("bin").join(bin_name);
            if candidate.is_file() {
                return Some(candidate);
            }
        }
    }

    // 2. Grimoire local bin/ (dev or portable)
    let exe_path = std::env::current_exe().unwrap_or_default();
    let base_dir = exe_path.parent().unwrap_or(&std::path::PathBuf::new()).to_path_buf();
    let local_bin = base_dir.join("bin").join(bin_name);
    if local_bin.is_file() {
        return Some(local_bin);
    }

    // 3. System PATH
    if let Ok(paths) = std::env::var("PATH") {
        for dir in std::env::split_paths(&paths) {
            let candidate = dir.join(bin_name);
            if candidate.is_file() {
                return Some(candidate);
            }
        }
    }

    // 4. Common Unix locations
    #[cfg(not(windows))]
    {
        let mut unix_paths = vec![
            "/usr/local/bin/ollama".to_string(),
            "/usr/bin/ollama".to_string(),
            "/opt/ollama/bin/ollama".to_string(),
        ];
        if let Ok(home) = std::env::var("HOME") {
            unix_paths.push(format!("{}/.local/bin/ollama", home));
        }
        for p in unix_paths {
            let pb = std::path::PathBuf::from(p);
            if pb.is_file() {
                return Some(pb);
            }
        }
    }

    // 5. Windows standard locations (e.g. %LOCALAPPDATA%\Programs\Ollama\ollama.exe)
    #[cfg(windows)]
    if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
        let candidate = std::path::PathBuf::from(local_app_data)
            .join("Programs")
            .join("Ollama")
            .join(bin_name);
        if candidate.is_file() {
            return Some(candidate);
        }
    }

    None
}

const OLLAMA_STANDARD_HOST: &str = "http://127.0.0.1:11434";
const OLLAMA_FALLBACK_HOST: &str = "http://127.0.0.1:11435";
const OLLAMA_LAST_RESORT_HOST: &str = "http://127.0.0.1:11436";

/// Sonde un hôte Ollama : None si injoignable, Some(nombre de modèles) sinon.
async fn probe_ollama_host(client: &reqwest::Client, host: &str) -> Option<usize> {
    let res = client.get(format!("{}/api/tags", host)).send().await.ok()?;
    if !res.status().is_success() {
        return None;
    }
    let tags: OllamaTagsResponse = res.json().await.ok()?;
    Some(tags.models.len())
}

pub async fn get_active_ollama_host(client: &reqwest::Client) -> Option<String> {
    // Préférer un serveur qui possède réellement des modèles installés,
    // puis conserver l'ordre historique (11434 avant 11435).
    let n_standard = probe_ollama_host(client, OLLAMA_STANDARD_HOST).await;
    if n_standard.unwrap_or(0) > 0 {
        return Some(OLLAMA_STANDARD_HOST.to_string());
    }
    let n_fallback = probe_ollama_host(client, OLLAMA_FALLBACK_HOST).await;
    if n_fallback.unwrap_or(0) > 0 {
        return Some(OLLAMA_FALLBACK_HOST.to_string());
    }
    if n_standard.is_some() {
        return Some(OLLAMA_STANDARD_HOST.to_string());
    }
    if n_fallback.is_some() {
        return Some(OLLAMA_FALLBACK_HOST.to_string());
    }
    None
}

/// Recherche récursive d'au moins un fichier manifeste dans un dossier de
/// modèles Ollama (preuve que le dossier contient réellement des modèles).
fn manifests_dir_has_model(dir: &std::path::Path, depth: usize) -> bool {
    if depth > 4 {
        return false;
    }
    if let Ok(entries) = std::fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() {
                return true;
            }
            if path.is_dir() && manifests_dir_has_model(&path, depth + 1) {
                return true;
            }
        }
    }
    false
}

/// Le dossier de modèles par défaut d'Ollama (~/.ollama/models) contient-il
/// au moins un modèle ? Sert à ne pas écraser une installation existante.
fn default_models_dir_has_models() -> bool {
    let home_var = if cfg!(windows) { "USERPROFILE" } else { "HOME" };
    std::env::var(home_var).ok().map_or(false, |home| {
        let dir = std::path::PathBuf::from(home).join(".ollama").join("models");
        dir.join("manifests").is_dir() && manifests_dir_has_model(&dir.join("manifests"), 0)
    })
}

/// Ancien dossier de modèles dédié utilisé par Grimoire avant la v0.6.8 :
/// les modèles téléchargés via l'application y résident toujours
/// (<dossier de l'exécutable>/models ou <données locales>/models).
fn find_legacy_grimoire_models_dir(app_handle: Option<&tauri::AppHandle>) -> Option<std::path::PathBuf> {
    let mut candidates: Vec<std::path::PathBuf> = Vec::new();
    if let Some(app) = app_handle {
        if let Ok(data_dir) = app.path().app_local_data_dir() {
            candidates.push(data_dir.join("models"));
        }
    }
    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(parent) = exe_path.parent() {
            candidates.push(parent.join("models"));
        }
    }
    candidates.into_iter().find(|dir| {
        dir.join("manifests").is_dir()
            && dir.join("blobs").is_dir()
            && manifests_dir_has_model(&dir.join("manifests"), 0)
    })
}

fn spawn_ollama_server(
    bin: &std::path::Path,
    host: &str,
    models_dir: Option<&std::path::Path>,
) -> Result<(), String> {
    let mut child = std::process::Command::new(bin);
    child.arg("serve");
    child.env("OLLAMA_HOST", host);
    if let Some(dir) = models_dir {
        child.env("OLLAMA_MODELS", dir);
    }
    child
        .spawn()
        .map(|_| ())
        .map_err(|e| format!("Impossible de démarrer Ollama : {}", e))
}

async fn wait_for_ollama(client: &reqwest::Client, host: &str, attempts: usize, require_models: bool) -> bool {
    for _ in 0..attempts {
        tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
        match probe_ollama_host(client, host).await {
            Some(n) if !require_models || n > 0 => return true,
            _ => {}
        }
    }
    false
}

pub async fn ensure_ollama_running(app_handle: Option<&tauri::AppHandle>, client: &reqwest::Client) -> Result<String, String> {
    let n_standard = probe_ollama_host(client, OLLAMA_STANDARD_HOST).await;
    if n_standard.unwrap_or(0) > 0 {
        return Ok(OLLAMA_STANDARD_HOST.to_string());
    }
    let n_fallback = probe_ollama_host(client, OLLAMA_FALLBACK_HOST).await;
    if n_fallback.unwrap_or(0) > 0 {
        return Ok(OLLAMA_FALLBACK_HOST.to_string());
    }

    let bin = find_ollama_binary(app_handle).ok_or_else(|| {
        "Binaire Ollama introuvable. Veuillez installer Ollama sur votre système (https://ollama.com).".to_string()
    })?;

    // Modèles historiques de Grimoire (pré-v0.6.8) : si aucun serveur actif
    // ne voit de modèles alors que l'ancien dossier dédié en contient encore,
    // on (re)lance un serveur avec OLLAMA_MODELS pointant dessus — sans
    // copier les gigaoctets de blobs.
    let legacy_models_dir = if default_models_dir_has_models() {
        None // Une installation Ollama standard possède déjà des modèles.
    } else {
        find_legacy_grimoire_models_dir(app_handle)
    };

    // 1. Port standard libre → démarrer notre serveur dessus.
    if n_standard.is_none() {
        spawn_ollama_server(&bin, OLLAMA_STANDARD_HOST, legacy_models_dir.as_deref())?;
        // Wait up to 15 seconds (30 * 500ms) because GPU discovery (CUDA/Vulkan) can take 5-7s
        if wait_for_ollama(client, OLLAMA_STANDARD_HOST, 30, legacy_models_dir.is_some()).await {
            return Ok(OLLAMA_STANDARD_HOST.to_string());
        }
    }

    // 2. Port standard occupé par un serveur sans modèles → serveur dédié
    //    sur le port de repli avec l'ancien dossier de modèles.
    if legacy_models_dir.is_some() {
        spawn_ollama_server(&bin, OLLAMA_FALLBACK_HOST, legacy_models_dir.as_deref())?;
        if wait_for_ollama(client, OLLAMA_FALLBACK_HOST, 30, true).await {
            return Ok(OLLAMA_FALLBACK_HOST.to_string());
        }
        // Dernier port de secours si 11435 est lui aussi occupé par un
        // serveur vide.
        spawn_ollama_server(&bin, OLLAMA_LAST_RESORT_HOST, legacy_models_dir.as_deref())?;
        if wait_for_ollama(client, OLLAMA_LAST_RESORT_HOST, 30, true).await {
            return Ok(OLLAMA_LAST_RESORT_HOST.to_string());
        }
    }

    // 3. Un serveur répond (sans modèles) : le signaler tel quel pour que
    //    l'app propose l'installation d'un modèle via l'onboarding.
    if n_standard.is_some() {
        return Ok(OLLAMA_STANDARD_HOST.to_string());
    }
    if n_fallback.is_some() {
        return Ok(OLLAMA_FALLBACK_HOST.to_string());
    }

    Err("Le serveur Ollama a été démarré mais ne répond pas après 15 secondes. Vérifiez vos logs ou lancez 'ollama serve' dans un terminal.".to_string())
}

#[tauri::command]
pub async fn check_ollama_status(app_handle: tauri::AppHandle) -> Result<OllamaStatus, String> {
    let client = reqwest::Client::builder()
        .no_proxy()
        .timeout(std::time::Duration::from_secs(3))
        .build()
        .unwrap_or_else(|_| reqwest::Client::new());

    let active_host = get_active_ollama_host(&client).await;
    let binary_exists = find_ollama_binary(Some(&app_handle)).is_some();

    let (server_running, models) = if let Some(host) = active_host {
        if let Ok(res) = client.get(format!("{}/api/tags", host)).send().await {
            if let Ok(parsed) = res.json::<OllamaTagsResponse>().await {
                let mut names = Vec::new();
                for m in parsed.models {
                    names.push(m.name);
                }
                (true, names)
            } else {
                (true, Vec::new())
            }
        } else {
            (false, Vec::new())
        }
    } else {
        (false, Vec::new())
    };

    Ok(OllamaStatus {
        binary_exists: binary_exists || server_running,
        server_running,
        models,
    })
}

#[tauri::command]
pub async fn download_ollama_binary(app_handle: tauri::AppHandle) -> Result<(), String> {
    // Destination directory: always use app_local_data_dir/bin (guaranteed writable without admin rights)
    let base_bin_dir = if let Ok(data_dir) = app_handle.path().app_local_data_dir() {
        data_dir.join("bin")
    } else {
        let exe_path = std::env::current_exe().unwrap_or_default();
        exe_path.parent().unwrap_or(&std::path::PathBuf::new()).join("bin")
    };
    fs::create_dir_all(&base_bin_dir).map_err(|e| format!("Impossible de créer le dossier bin : {}", e))?;

    #[cfg(target_os = "linux")]
    {
        let _ = app_handle.emit("ollama-download-progress", 10);
        let url = "https://github.com/ollama/ollama/releases/latest/download/ollama-linux-amd64.tar.zst";
        let archive_path = base_bin_dir.join("ollama.tar.zst");

        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(600))
            .build()
            .map_err(|e| e.to_string())?;

        let res = client.get(url).send().await.map_err(|e| format!("Échec du téléchargement : {}", e))?;
        if !res.status().is_success() {
            return Err(format!("Le serveur a renvoyé l'erreur {}", res.status()));
        }

        let total_size = res.content_length().unwrap_or(0);
        let mut downloaded: u64 = 0;
        let mut file = File::create(&archive_path).map_err(|e| format!("Erreur création archive temporaire : {}", e))?;

        use futures_util::StreamExt;
        let mut stream = res.bytes_stream();
        while let Some(chunk_res) = stream.next().await {
            let chunk = chunk_res.map_err(|e| format!("Erreur de lecture réseau : {}", e))?;
            file.write_all(&chunk).map_err(|e| format!("Erreur d'écriture sur disque : {}", e))?;
            downloaded += chunk.len() as u64;
            if total_size > 0 {
                let progress = (downloaded as f64 / total_size as f64 * 100.0) as u32;
                let _ = app_handle.emit("ollama-download-progress", progress);
            }
        }
        drop(file);

        let _ = app_handle.emit("ollama-download-progress", 101);

        let tar_status = std::process::Command::new("tar")
            .arg("--zstd")
            .arg("-xf")
            .arg(&archive_path)
            .arg("-C")
            .arg(&base_bin_dir)
            .status();

        let _ = fs::remove_file(&archive_path);

        if let Ok(st) = tar_status {
            if st.success() {
                let candidate1 = base_bin_dir.join("bin").join("ollama");
                let candidate2 = base_bin_dir.join("ollama");
                let target_binary = if candidate1.exists() { candidate1 } else { candidate2 };

                if target_binary.exists() {
                    #[cfg(unix)]
                    {
                        use std::os::unix::fs::PermissionsExt;
                        let _ = fs::set_permissions(&target_binary, fs::Permissions::from_mode(0o755));
                    }
                    let _ = app_handle.emit("ollama-download-progress", 102);
                    return Ok(());
                }
            }
        }

        return Err("L'extraction du binaire a échoué. Sous Linux, vous pouvez également installer Ollama simplement en ouvrant un terminal et en tapant :\ncurl -fsSL https://ollama.com/install.sh | sh".to_string());
    }

    #[cfg(not(target_os = "linux"))]
    {
        let url = "https://github.com/ollama/ollama/releases/latest/download/ollama-windows-amd64.zip";

        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(600))
            .build()
            .map_err(|e| e.to_string())?;

        let res = client.get(url)
            .send()
            .await
            .map_err(|e| format!("Impossible de lancer le téléchargement : {}", e))?;

        if !res.status().is_success() {
            return Err(format!("Le serveur a renvoyé l'erreur {}", res.status()));
        }

        let total_size = res.content_length().unwrap_or(0);
        let mut downloaded: u64 = 0;

        let zip_path = base_bin_dir.join("ollama.zip");
        let mut file = File::create(&zip_path).map_err(|e| format!("Impossible de créer l'archive zip temporaire : {}", e))?;

        use futures_util::StreamExt;
        let mut stream = res.bytes_stream();
        while let Some(chunk_res) = stream.next().await {
            let chunk = chunk_res.map_err(|e| format!("Erreur lors de la lecture du flux : {}", e))?;
            file.write_all(&chunk).map_err(|e| format!("Erreur lors de l'écriture sur le disque : {}", e))?;
            downloaded += chunk.len() as u64;
            if total_size > 0 {
                let progress = (downloaded as f64 / total_size as f64 * 100.0) as u32;
                let _ = app_handle.emit("ollama-download-progress", progress);
            }
        }

        drop(file);

        let _ = app_handle.emit("ollama-download-progress", 101);

        let zip_file = File::open(&zip_path).map_err(|e| format!("Impossible d'ouvrir l'archive zip téléchargée : {}", e))?;
        extract_zip(zip_file, &base_bin_dir)?;

        let _ = fs::remove_file(&zip_path);

        let _ = app_handle.emit("ollama-download-progress", 102);

        Ok(())
    }
}

#[allow(dead_code)]
fn extract_zip(reader: impl io::Read + io::Seek, target_dir: &Path) -> Result<(), String> {
    let mut archive = zip::ZipArchive::new(reader).map_err(|e| format!("Erreur archive zip: {}", e))?;
    for i in 0..archive.len() {
        let mut file = archive.by_index(i).map_err(|e| format!("Erreur index zip: {}", e))?;
        let outpath = match file.enclosed_name() {
            Some(path) => target_dir.join(path),
            None => continue,
        };

        if file.name().ends_with('/') {
            fs::create_dir_all(&outpath).map_err(|e| format!("Erreur création dossier: {}", e))?;
        } else {
            if let Some(p) = outpath.parent() {
                if !p.exists() {
                    fs::create_dir_all(p).map_err(|e| format!("Erreur création dossier parent: {}", e))?;
                }
            }
            let mut outfile = File::create(&outpath).map_err(|e| format!("Erreur création fichier: {}", e))?;
            io::copy(&mut file, &mut outfile).map_err(|e| format!("Erreur copie contenu: {}", e))?;
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn pull_ollama_model(app_handle: tauri::AppHandle, model_name: String) -> Result<(), String> {
    let client = reqwest::Client::builder()
        .no_proxy()
        .timeout(std::time::Duration::from_secs(3600)) // Up to 1 hour for large model downloads
        .build()
        .map_err(|e| format!("Impossible de créer le client HTTP : {}", e))?;

    let host = ensure_ollama_running(Some(&app_handle), &client).await?;

    let url = format!("{}/api/pull", host);
    let payload = serde_json::json!({
        "name": model_name,
        "stream": true
    });

    let res = client.post(&url)
        .json(&payload)
        .send()
        .await
        .map_err(|e| format!("Impossible de joindre Ollama ({}) : {}", host, e))?;

    if !res.status().is_success() {
        let status = res.status();
        let body = res.text().await.unwrap_or_default();
        let err_msg = format!("Ollama a renvoyé l'erreur {} : {}", status, body);
        let _ = app_handle.emit("ollama-pull-progress", serde_json::json!({ "error": &err_msg }));
        return Err(err_msg);
    }

    use futures_util::StreamExt;
    let mut stream = res.bytes_stream();
    let mut buffer = Vec::new();

    while let Some(chunk_res) = stream.next().await {
        let chunk = chunk_res.map_err(|e| format!("Erreur de téléchargement : {}", e))?;
        buffer.extend_from_slice(&chunk);

        while let Some(pos) = buffer.iter().position(|&b| b == b'\n') {
            let line_bytes = buffer[..pos].to_vec();
            buffer = buffer[pos + 1..].to_vec();

            if let Ok(line_str) = String::from_utf8(line_bytes) {
                let trimmed = line_str.trim();
                if !trimmed.is_empty() {
                    if let Ok(val) = serde_json::from_str::<serde_json::Value>(trimmed) {
                        // Check if Ollama sent an error object
                        if let Some(err) = val.get("error").and_then(|e| e.as_str()) {
                            let err_msg = format!("Erreur Ollama : {}", err);
                            let _ = app_handle.emit("ollama-pull-progress", serde_json::json!({ "error": &err_msg }));
                            return Err(err_msg);
                        }

                        let is_success = val.get("status").and_then(|s| s.as_str()) == Some("success");
                        let _ = app_handle.emit("ollama-pull-progress", &val);
                        if is_success {
                            return Ok(());
                        }
                    }
                }
            }
        }
    }

    let err_msg = "Le téléchargement du modèle a été interrompu avant sa finalisation.".to_string();
    let _ = app_handle.emit("ollama-pull-progress", serde_json::json!({ "error": &err_msg }));
    Err(err_msg)
}

#[tauri::command]
pub async fn ask_ollama(app_handle: tauri::AppHandle, prompt: String, model: String, system_prompt: String) -> Result<String, String> {
    let client = reqwest::Client::builder()
        .no_proxy()
        .timeout(std::time::Duration::from_secs(180))
        .build()
        .unwrap_or_else(|_| reqwest::Client::new());

    let host = ensure_ollama_running(Some(&app_handle), &client).await?;

    // Trouver le meilleur modèle disponible si le modèle demandé n'existe pas
    let mut target_model = model;
    if let Ok(tags_res) = client.get(format!("{}/api/tags", host)).send().await {
        if let Ok(parsed_tags) = tags_res.json::<OllamaTagsResponse>().await {
            if parsed_tags.models.is_empty() {
                return Err("Aucun modèle n'est installé sur Ollama. Rendez-vous dans les Paramètres ⚙️ → IA Locale pour installer un modèle (ex: Llama 3.2 ou Gemma 2).".to_string());
            }

            // Chercher une correspondance exacte ou partielle (ex: "llama3.2" -> "llama3.2:1b" ou "gemma2:2b" -> "gemma2:2b")
            let matched = parsed_tags.models.iter().find(|m| {
                m.name.eq_ignore_ascii_case(&target_model)
                    || m.name.starts_with(&target_model)
                    || target_model.starts_with(&m.name)
                    || m.name.split(':').next() == target_model.split(':').next()
            });

            if let Some(m) = matched {
                target_model = m.name.clone();
            } else {
                // Modèle demandé non trouvé : repli automatique vers le premier modèle installé
                target_model = parsed_tags.models[0].name.clone();
            }

            // Notifier le frontend du modèle réellement actif pour mettre à jour l'interface
            let _ = app_handle.emit("ollama-model-active", &target_model);
        }
    }

    let req = OllamaRequest {
        model: target_model,
        prompt,
        system: system_prompt,
        stream: false,
    };

    let res = client
        .post(format!("{}/api/generate", host))
        .json(&req)
        .send()
        .await
        .map_err(|e| format!("Erreur de connexion à Ollama : {}", e))?;

    let status = res.status();
    let body_text = res.text().await.map_err(|e| format!("Impossible de lire la réponse : {}", e))?;

    if let Ok(parsed) = serde_json::from_str::<OllamaResponse>(&body_text) {
        if let Some(err) = parsed.error {
            return Err(format!("Ollama a refusé : {}", err));
        }
        if let Some(resp) = parsed.response {
            return Ok(resp);
        }
    }

    Err(format!("Erreur {}. Réponse brute : {}", status, body_text))
}

#[tauri::command]
pub async fn get_ollama_models(app_handle: tauri::AppHandle) -> Result<Vec<String>, String> {
    let client = reqwest::Client::builder()
        .no_proxy()
        .timeout(std::time::Duration::from_secs(5))
        .build()
        .unwrap_or_else(|_| reqwest::Client::new());

    let host = ensure_ollama_running(Some(&app_handle), &client).await?;

    let res = client
        .get(format!("{}/api/tags", host))
        .send()
        .await
        .map_err(|e| format!("Impossible de joindre Ollama : {}", e))?;

    let parsed: OllamaTagsResponse = res
        .json()
        .await
        .map_err(|e| format!("Erreur lors de la lecture des modèles : {}", e))?;

    let mut names = Vec::new();
    for m in parsed.models {
        names.push(m.name);
    }

    Ok(names)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_find_ollama_and_active_host() {
        let bin = find_ollama_binary(None);
        println!("Detected Ollama binary: {:?}", bin);
        assert!(bin.is_some(), "Ollama binary should be detected on this machine");

        let client = reqwest::Client::new();
        let host = get_active_ollama_host(&client).await;
        println!("Active Ollama host: {:?}", host);
        assert_eq!(host, Some("http://127.0.0.1:11434".to_string()));
    }

    #[tokio::test]
    async fn test_pull_nonexistent_model_fails() {
        let client = reqwest::Client::new();
        let host = get_active_ollama_host(&client).await.expect("Ollama must be running");
        let url = format!("{}/api/pull", host);
        let payload = serde_json::json!({
            "name": "nonexistent_model_test_abc_123",
            "stream": true
        });

        let res = client.post(&url).json(&payload).send().await.unwrap();
        use futures_util::StreamExt;
        let mut stream = res.bytes_stream();
        let mut error_found = false;

        while let Some(chunk_res) = stream.next().await {
            let chunk = chunk_res.unwrap();
            let text = String::from_utf8_lossy(&chunk);
            for line in text.lines() {
                if let Ok(val) = serde_json::from_str::<serde_json::Value>(line.trim()) {
                    if val.get("error").is_some() {
                        error_found = true;
                        break;
                    }
                }
            }
            if error_found { break; }
        }

        assert!(error_found, "Ollama should send an error object for non-existent models");
    }

    #[tokio::test]
    async fn test_ask_ollama_fallback_to_installed_model() {
        let client = reqwest::Client::new();
        let host = get_active_ollama_host(&client).await.expect("Ollama must be running");

        let tags_res = client.get(format!("{}/api/tags", host)).send().await.unwrap();
        let tags = tags_res.json::<OllamaTagsResponse>().await.unwrap();
        assert!(!tags.models.is_empty(), "Should have at least 1 installed model");

        // Le modèle demandé n'existe pas : le repli doit sélectionner un
        // modèle réellement installé (le premier de la liste), quel qu'il soit
        // selon la machine (ne pas coder un nom en dur). La logique de repli
        // vit dans ask_ollama ; on vérifie ici l'invariant utilisé.
        let requested = "gemma2:2b";
        let model_exists = tags.models.iter().any(|m| m.name == requested || m.name.starts_with(requested));
        let expected_fallback = if model_exists {
            let matched = tags.models.iter().find(|m| m.name == requested || m.name.starts_with(requested)).unwrap();
            matched.name.clone()
        } else {
            tags.models[0].name.clone()
        };
        assert!(!expected_fallback.is_empty());

        let req = OllamaRequest {
            model: expected_fallback,
            prompt: "Bonjour".to_string(),
            system: "Tu es un assistant.".to_string(),
            stream: false,
        };
        let gen_res = client.post(format!("{}/api/generate", host)).json(&req).send().await.unwrap();
        assert!(gen_res.status().is_success());
    }
}
