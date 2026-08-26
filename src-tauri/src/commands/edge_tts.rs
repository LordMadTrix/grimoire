use std::time::{SystemTime, UNIX_EPOCH};
use tauri::command;
use tokio_tungstenite::{connect_async, tungstenite::protocol::Message};
use tokio_tungstenite::tungstenite::http::Request;
use futures_util::{SinkExt, StreamExt};
use chrono::Utc;
use sha2::{Sha256, Digest};
use uuid::Uuid;

const TRUSTED_CLIENT_TOKEN: &str = "6A5AA1D4EAFF4E9FB37E23D68491D6F4";
const SEC_MS_GEC_VERSION: &str = "1-143.0.3650.75";
const WIN_EPOCH: u64 = 11644473600;

fn generate_sec_ms_gec() -> String {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    let ticks = now + WIN_EPOCH;
    let rounded = ticks - (ticks % 300);
    let str_to_hash = format!("{}{TRUSTED_CLIENT_TOKEN}", rounded * 10_000_000);
    
    let mut hasher = Sha256::new();
    hasher.update(str_to_hash.as_bytes());
    hex::encode(hasher.finalize()).to_uppercase()
}

fn escape_xml(unsafe_str: &str) -> String {
    unsafe_str
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&apos;")
}

/// Synthétise un texte en voix neuronale IA haute définition Edge Neural TTS
#[command]
pub async fn tts_synthesize_neural(
    text: String,
    voice: String,
    rate: Option<f32>,
    pitch: Option<f32>,
) -> Result<Vec<u8>, String> {
    let _ = rustls::crypto::ring::default_provider().install_default();

    let clean_text = text.trim();
    if clean_text.is_empty() {
        return Err("Texte vide".into());
    }

    let voice_id = if voice.is_empty() {
        "fr-FR-HenriNeural".to_string()
    } else {
        voice
    };

    let rate_val = rate.unwrap_or(1.0);
    let pitch_val = pitch.unwrap_or(1.0);

    let rate_pct = ((rate_val - 1.0) * 100.0).round() as i32;
    let rate_str = if rate_pct >= 0 {
        format!("+{rate_pct}%")
    } else {
        format!("{rate_pct}%")
    };

    let pitch_hz = ((pitch_val - 1.0) * 100.0).round() as i32;
    let pitch_str = if pitch_hz >= 0 {
        format!("+{pitch_hz}Hz")
    } else {
        format!("{pitch_hz}Hz")
    };

    let connection_id = Uuid::new_v4().simple().to_string();
    let sec_ms_gec = generate_sec_ms_gec();

    let uri = format!(
        "wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken={TRUSTED_CLIENT_TOKEN}&ConnectionId={connection_id}&Sec-MS-GEC={sec_ms_gec}&Sec-MS-GEC-Version={SEC_MS_GEC_VERSION}"
    );

    let muid = Uuid::new_v4().simple().to_string().to_uppercase();

    let request = Request::builder()
        .uri(&uri)
        .header("Pragma", "no-cache")
        .header("Cache-Control", "no-cache")
        .header("Origin", "chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold")
        .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0")
        .header("Accept-Encoding", "gzip, deflate, br, zstd")
        .header("Accept-Language", "fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7")
        .header("Cookie", format!("muid={muid};"))
        .header("Host", "speech.platform.bing.com")
        .header("Sec-WebSocket-Key", tokio_tungstenite::tungstenite::handshake::client::generate_key())
        .header("Sec-WebSocket-Version", "13")
        .header("Connection", "Upgrade")
        .header("Upgrade", "websocket")
        .body(())
        .map_err(|e| format!("Erreur construction requête WebSocket : {e}"))?;

    let (mut ws_stream, _) = connect_async(request)
        .await
        .map_err(|e| format!("Impossible de se connecter au serveur Edge-TTS : {e}"))?;

    let now_iso = Utc::now().to_rfc3339();

    // 1. Envoyer la configuration audio MP3
    let config_payload = serde_json::json!({
        "context": {
            "synthesis": {
                "audio": {
                    "metadataoptions": {
                        "sentenceBoundaryEnabled": "false",
                        "wordBoundaryEnabled": "false"
                    },
                    "outputFormat": "audio-24khz-48kbitrate-mono-mp3"
                }
            }
        }
    });

    let config_msg = format!(
        "X-Timestamp:{now_iso}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n{config_payload}"
    );

    ws_stream
        .send(Message::Text(config_msg))
        .await
        .map_err(|e| format!("Erreur envoi config : {e}"))?;

    // 2. Envoyer le texte SSML
    let escaped_text = escape_xml(clean_text);
    let req_id = Uuid::new_v4().simple().to_string();
    let ssml = format!(
        "<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='fr-FR'><voice name='{voice_id}'><prosody pitch='{pitch_str}' rate='{rate_str}'>{escaped_text}</prosody></voice></speak>"
    );

    let ssml_msg = format!(
        "X-RequestId:{req_id}\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:{now_iso}\r\nPath:ssml\r\n\r\n{ssml}"
    );

    ws_stream
        .send(Message::Text(ssml_msg))
        .await
        .map_err(|e| format!("Erreur envoi SSML : {e}"))?;

    // 3. Réception des flux MP3 binaires
    let mut audio_bytes = Vec::new();

    while let Some(msg_res) = ws_stream.next().await {
        match msg_res {
            Ok(Message::Text(txt)) => {
                if txt.contains("Path:turn.end") {
                    break;
                }
            }
            Ok(Message::Binary(bin)) => {
                if bin.len() > 2 {
                    let header_len = u16::from_be_bytes([bin[0], bin[1]]) as usize;
                    if bin.len() > 2 + header_len {
                        let header_part = String::from_utf8_lossy(&bin[2..2 + header_len]);
                        if header_part.contains("Path:audio") {
                            audio_bytes.extend_from_slice(&bin[2 + header_len..]);
                        }
                    }
                }
            }
            Ok(Message::Close(_)) => break,
            Err(e) => return Err(format!("Erreur flux audio : {e}")),
            _ => {}
        }
    }

    if audio_bytes.is_empty() {
        return Err("Aucun octet audio reçu du serveur de synthèse vocale.".into());
    }

    Ok(audio_bytes)
}
