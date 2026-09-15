use crate::sync::SyncEvent;
use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use tokio::sync::broadcast;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WebSocketMessage {
    pub message_type: MessageType,
    pub payload: serde_json::Value,
    pub timestamp: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum MessageType {
    SyncEvent,
    SyncRequest,
    SyncResponse,
    Heartbeat,
    Error,
    Acknowledgment,
}

pub struct WebSocketBridge {
    tx: broadcast::Sender<WebSocketMessage>,
    rx: Arc<Mutex<broadcast::Receiver<WebSocketMessage>>>,
}

impl WebSocketBridge {
    pub fn new() -> (Self, broadcast::Receiver<WebSocketMessage>) {
        let (tx, rx) = broadcast::channel(100);
        (
            Self {
                tx: tx.clone(),
                rx: Arc::new(Mutex::new(rx)),
            },
            tx.subscribe(),
        )
    }

    /// Send sync event to mobile
    pub fn send_event(&self, event: &SyncEvent) -> Result<(), String> {
        let message = WebSocketMessage {
            message_type: MessageType::SyncEvent,
            payload: serde_json::to_value(event).map_err(|e| e.to_string())?,
            timestamp: chrono::Utc::now(),
        };

        self.tx.send(message).map_err(|_| "Send failed".to_string())?;
        Ok(())
    }

    /// Send sync request
    pub fn send_request(&self, request: SyncRequest) -> Result<(), String> {
        let message = WebSocketMessage {
            message_type: MessageType::SyncRequest,
            payload: serde_json::to_value(request).map_err(|e| e.to_string())?,
            timestamp: chrono::Utc::now(),
        };

        self.tx.send(message).map_err(|_| "Send failed".to_string())?;
        Ok(())
    }

    /// Send acknowledgment
    pub fn send_ack(&self, event_id: &str, success: bool) -> Result<(), String> {
        let ack = SyncAckowledgment {
            event_id: event_id.to_string(),
            success,
            timestamp: chrono::Utc::now(),
        };

        let message = WebSocketMessage {
            message_type: MessageType::Acknowledgment,
            payload: serde_json::to_value(ack).map_err(|e| e.to_string())?,
            timestamp: chrono::Utc::now(),
        };

        self.tx.send(message).map_err(|_| "Send failed".to_string())?;
        Ok(())
    }

    /// Send heartbeat
    pub fn send_heartbeat(&self) -> Result<(), String> {
        let heartbeat = Heartbeat {
            timestamp: chrono::Utc::now(),
            connection_status: "connected".to_string(),
        };

        let message = WebSocketMessage {
            message_type: MessageType::Heartbeat,
            payload: serde_json::to_value(heartbeat).map_err(|e| e.to_string())?,
            timestamp: chrono::Utc::now(),
        };

        self.tx.send(message).map_err(|_| "Send failed".to_string())?;
        Ok(())
    }

    /// Subscribe to messages
    pub fn subscribe(&self) -> broadcast::Receiver<WebSocketMessage> {
        self.tx.subscribe()
    }

    /// Get current subscriber count
    pub fn subscriber_count(&self) -> usize {
        self.tx.receiver_count()
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncRequest {
    pub request_id: String,
    pub request_type: RequestType,
    pub data: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum RequestType {
    FullSync,
    DeltaSync,
    GetStatus,
    ClearCache,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncAckowledgment {
    pub event_id: String,
    pub success: bool,
    pub timestamp: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Heartbeat {
    pub timestamp: chrono::DateTime<chrono::Utc>,
    pub connection_status: String,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_websocket_bridge_creation() {
        let (bridge, _rx) = WebSocketBridge::new();
        assert_eq!(bridge.subscriber_count(), 1);
    }

    #[tokio::test]
    async fn test_send_heartbeat() {
        let (bridge, mut rx) = WebSocketBridge::new();
        bridge.send_heartbeat().unwrap();

        if let Ok(msg) = rx.recv().await {
            assert_eq!(msg.message_type, MessageType::Heartbeat);
        }
    }

    #[tokio::test]
    async fn test_send_ack() {
        let (bridge, mut rx) = WebSocketBridge::new();
        bridge.send_ack("test-123", true).unwrap();

        if let Ok(msg) = rx.recv().await {
            assert_eq!(msg.message_type, MessageType::Acknowledgment);
        }
    }
}
