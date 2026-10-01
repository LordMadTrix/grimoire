// ── Transcription locale (whisper.cpp) ──────────────────────────────────────
// Même philosophie qu'Ollama : binaire auto-géré dans app_local_data_dir/bin,
// modèle whisper téléchargé une fois, tout tourne en local (aucun cloud).
//
// Binaire attendu : bin/whisper-cli(.exe) — https://github.com/ggml-org/whisper.cpp
// Modèle par défaut : models/ggml-base.bin (≈142 Mo, multilingue, rapide sur CPU)

use std::fs;
use std::path::PathBuf;
use std::process::Command;
use tauri::{AppHandle, Emitter, Manager};

#[derive(serde::Serialize)]
pub struct TranscribeStatus {
    pub binary_exists: bool,
    pub model_exists: bool,
    pub model_size_bytes: Option<u64>,
    pub binary_path: String,
    pub model_path: String,
}

const MODEL_URL: &str = "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin";

fn bin_dir(app: &AppHandle) -> PathBuf {
    app.path()
        .app_local_data_dir()
        .unwrap_or_else(|_| std::env::current_exe().unwrap_or_default().parent().map(|p| p.to_path_buf()).unwrap_or_default())
        .join("bin")
}

fn models_dir(app: &AppHandle) -> PathBuf {
    app.path()
        .app_local_data_dir()
        .unwrap_or_else(|_| std::env::current_exe().unwrap_or_default().parent().map(|p| p.to_path_buf()).unwrap_or_default())
        .join("models")
}

fn binary_path(app: &AppHandle) -> PathBuf {
    let name = if cfg!(windows) { "whisper-cli.exe" } else { "whisper-cli" };
    bin_dir(app).join(name)
}

fn model_path(app: &AppHandle) -> PathBuf {
    models_dir(app).join("ggml-base.bin")
}

/// État de l'installation whisper (binaire + modèle)
#[tauri::command]
pub fn transcribe_status(app: AppHandle) -> Result<TranscribeStatus, String> {
    let bp = binary_path(&app);
    let mp = model_path(&app);
    Ok(TranscribeStatus {
        binary_exists: bp.is_file(),
        model_exists: mp.is_file(),
        model_size_bytes: fs::metadata(&mp).ok().map(|m| m.len()),
        binary_path: bp.to_string_lossy().to_string(),
        model_path: mp.to_string_lossy().to_string(),
    })
}

/// Ouvre le dossier bin/ pour y déposer whisper-cli manuellement (Linux/macOS)
#[tauri::command]
pub fn transcribe_open_bin_folder(app: AppHandle) -> Result<String, String> {
    let dir = bin_dir(&app);
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let _ = opener::open(&dir);
    Ok(dir.to_string_lossy().to_string())
}

/// Télécharge le modèle whisper (≈142 Mo) avec émission de progression
#[tauri::command]
pub async fn transcribe_download_model(app: AppHandle) -> Result<(), String> {
    let dir = models_dir(&app);
    fs::create_dir_all(&dir).map_err(|e| format!("Création du dossier models : {e}"))?;
    let dest = model_path(&app);
    if dest.is_file() {
        return Ok(());
    }

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(900))
        .build()
        .map_err(|e| e.to_string())?;

    let res = client
        .get(MODEL_URL)
        .send()
        .await
        .map_err(|e| format!("Téléchargement : {e}"))?;
    if !res.status().is_success() {
        return Err(format!("Le serveur a renvoyé HTTP {}", res.status()));
    }
    let total = res.content_length().unwrap_or(0);
    let mut file = fs::File::create(&dest).map_err(|e| format!("Création fichier : {e}"))?;
    use futures_util::StreamExt;
    use std::io::Write;
    let mut stream = res.bytes_stream();
    let mut downloaded: u64 = 0;
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| format!("Lecture : {e}"))?;
        file.write_all(&chunk).map_err(|e| format!("Écriture : {e}"))?;
        downloaded += chunk.len() as u64;
        if total > 0 {
            let _ = app.emit("transcribe-download-progress", (downloaded * 100 / total) as u32);
        }
    }
    drop(file);
    let _ = app.emit("transcribe-download-progress", 100);
    Ok(())
}

/// Transcrit un fichier audio local (wav 16 kHz mono recommandé ; le MP3/OGG est
/// décodé par ffmpeg si disponible). Retourne le texte transcrit.
#[tauri::command]
pub async fn transcribe_audio(app: AppHandle, audio_path: String, language: Option<String>) -> Result<String, String> {
    let bp = binary_path(&app);
    if !bp.is_file() {
        return Err(
            "whisper-cli introuvable. Installez-le dans le dossier indiqué par transcribe_open_bin_folder \
             (build de https://github.com/ggml-org/whisper.cpp) — la transcription est 100% locale."
                .to_string(),
        );
    }
    let mp = model_path(&app);
    if !mp.is_file() {
        return Err("Modèle whisper manquant : lancez d'abord le téléchargement du modèle.".to_string());
    }
    if !std::path::Path::new(&audio_path).is_file() {
        return Err(format!("Fichier audio introuvable : {audio_path}"));
    }

    let lang = language.unwrap_or_else(|| "auto".to_string());
    let output_base = std::env::temp_dir().join(format!("grimoire-whisper-{}", std::process::id()));

    let bp_for_task = bp.clone();
    let mp_for_task = mp.clone();
    let output_base_for_task = output_base.clone();
    let result = tauri::async_runtime::spawn_blocking(move || {
        Command::new(&bp_for_task)
            .arg("-m").arg(&mp_for_task)
            .arg("-f").arg(&audio_path)
            .arg("-l").arg(&lang)
            .arg("-otxt")
            .arg("-of").arg(&output_base_for_task)
            .output()
    })
    .await
    .map_err(|e| format!("Exécution whisper : {e}"))?;

    match result {
        Ok(out) if out.status.success() => {
            let txt_path = output_base.with_extension("txt");
            let text = fs::read_to_string(&txt_path)
                .map_err(|e| format!("Lecture de la transcription : {e}"))?;
            let _ = fs::remove_file(&txt_path);
            let trimmed = text.trim().to_string();
            if trimmed.is_empty() {
                Err("Aucune parole détectée dans l'enregistrement.".to_string())
            } else {
                Ok(trimmed)
            }
        }
        Ok(out) => {
            let stderr = String::from_utf8_lossy(&out.stderr);
            Err(format!("whisper-cli a échoué : {}", stderr.chars().take(400).collect::<String>()))
        }
        Err(e) => Err(format!("Lancement de whisper-cli : {e}")),
    }
}
