//! Relais des médias Google Drive pour la production Tauri.
//!
//! Google Drive sert TOUS les fichiers en `application/octet-stream` avec
//! `Content-Disposition: attachment`. Les éléments `<audio>` / `<video>` du
//! webview refusent alors de les lire (« MEDIA_ELEMENT_ERROR: Format error »).
//!
//! Le webview demande `grimoiremedia://localhost/drive-media/<id>.<ext>`
//! (ou `http://grimoiremedia.localhost/...` sur Windows) ; ce module récupère
//! le fichier via reqwest et le renvoie avec le bon Content-Type.
//!
//! En développement, c'est le proxy Vite `/drive-media` qui joue le même rôle
//! (voir `vite.config.ts`).

use tauri::http::{Response, StatusCode};

/// Type MIME déduit de l'extension du fichier.
fn mime_for_ext(ext: &str) -> &'static str {
    match ext {
        "mp3" => "audio/mpeg",
        "ogg" | "oga" | "opus" => "audio/ogg",
        "wav" => "audio/wav",
        "flac" => "audio/flac",
        "m4a" => "audio/mp4",
        "aac" => "audio/aac",
        "weba" | "webm" => "video/webm",
        "mp4" | "m4v" => "video/mp4",
        "mov" => "video/quicktime",
        "ogv" => "video/ogg",
        "pdf" => "application/pdf",
        _ => "application/octet-stream",
    }
}

fn error_response(status: StatusCode, message: &str) -> Response<Vec<u8>> {
    Response::builder()
        .status(status)
        .header("Content-Type", "text/plain; charset=utf-8")
        .header("Access-Control-Allow-Origin", "*")
        .body(message.as_bytes().to_vec())
        .unwrap_or_else(|_| Response::new(Vec::new()))
}

/// Récupère `<id>.<ext>` depuis `/drive-media/<id>.<ext>` (dernier segment).
fn parse_target(path: &str) -> Option<(String, String)> {
    let last = path.rsplit('/').next()?.trim();
    if last.is_empty() {
        return None;
    }
    let cleaned = last
        .chars()
        .filter(|c| c.is_ascii_alphanumeric() || *c == '_' || *c == '-' || *c == '.')
        .collect::<String>();
    match cleaned.rsplit_once('.') {
        Some((id, ext)) if !id.is_empty() => Some((id.to_string(), ext.to_ascii_lowercase())),
        _ if !cleaned.is_empty() => Some((cleaned, String::new())),
        _ => None,
    }
}

/// Relaie le fichier Drive en rétablissant le bon Content-Type.
pub async fn handle(path: &str, range: Option<String>) -> Response<Vec<u8>> {
    let (id, ext) = match parse_target(path) {
        Some(v) => v,
        None => return error_response(StatusCode::BAD_REQUEST, "Identifiant Drive manquant"),
    };

    let url = format!(
        "https://drive.usercontent.google.com/download?id={}&export=download",
        id
    );

    let client = match reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (compatible; Grimoire/1.0)")
        .build()
    {
        Ok(c) => c,
        Err(e) => return error_response(StatusCode::INTERNAL_SERVER_ERROR, &e.to_string()),
    };

    let mut request = client.get(&url);
    if let Some(r) = range {
        request = request.header("Range", r);
    }

    let upstream = match request.send().await {
        Ok(r) => r,
        Err(e) => return error_response(StatusCode::BAD_GATEWAY, &e.to_string()),
    };

    let status = StatusCode::from_u16(upstream.status().as_u16()).unwrap_or(StatusCode::OK);
    let content_range = upstream
        .headers()
        .get("content-range")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string());

    let bytes = match upstream.bytes().await {
        Ok(b) => b,
        Err(e) => return error_response(StatusCode::BAD_GATEWAY, &e.to_string()),
    };

    let mut builder = Response::builder()
        .status(status)
        .header("Content-Type", mime_for_ext(&ext))
        .header("Accept-Ranges", "bytes")
        .header("Cache-Control", "public, max-age=86400")
        .header("Access-Control-Allow-Origin", "*");
    if let Some(cr) = content_range {
        builder = builder.header("Content-Range", cr);
    }

    builder
        .body(bytes.to_vec())
        .unwrap_or_else(|_| error_response(StatusCode::INTERNAL_SERVER_ERROR, "Réponse invalide"))
}
