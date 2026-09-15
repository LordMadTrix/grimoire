use std::collections::VecDeque;
use std::sync::{Arc, Mutex};
use serde::{Deserialize, Serialize};
use crate::sync::SyncEvent;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueuedEvent {
    pub event: SyncEvent,
    pub retry_count: u32,
    pub max_retries: u32,
    pub status: QueueStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum QueueStatus {
    Pending,
    Processing,
    Success,
    Failed,
    Retry,
}

pub struct SyncQueue {
    queue: Arc<Mutex<VecDeque<QueuedEvent>>>,
    max_queue_size: usize,
}

impl SyncQueue {
    pub fn new(max_size: usize) -> Self {
        Self {
            queue: Arc::new(Mutex::new(VecDeque::new())),
            max_queue_size: max_size,
        }
    }

    /// Add event to queue
    pub fn push(&self, event: SyncEvent, max_retries: u32) -> Result<(), String> {
        let mut queue = self.queue.lock().unwrap();

        if queue.len() >= self.max_queue_size {
            return Err("Queue is full".to_string());
        }

        let queued = QueuedEvent {
            event,
            retry_count: 0,
            max_retries,
            status: QueueStatus::Pending,
        };

        queue.push_back(queued);
        Ok(())
    }

    /// Get next event to process
    pub fn pop(&self) -> Option<QueuedEvent> {
        let mut queue = self.queue.lock().unwrap();
        queue.pop_front()
    }

    /// Get queue size
    pub fn len(&self) -> usize {
        self.queue.lock().unwrap().len()
    }

    /// Check if queue is empty
    pub fn is_empty(&self) -> bool {
        self.queue.lock().unwrap().is_empty()
    }

    /// Clear queue
    pub fn clear(&self) {
        self.queue.lock().unwrap().clear();
    }

    /// Mark event as processed successfully
    pub fn mark_success(&self, event_id: &str) -> Result<(), String> {
        let mut queue = self.queue.lock().unwrap();
        if let Some(idx) = queue.iter().position(|e| e.event.id == event_id) {
            if let Some(queued) = queue.get_mut(idx) {
                queued.status = QueueStatus::Success;
            }
            if idx < queue.len() {
                queue.remove(idx);
            }
            Ok(())
        } else {
            Err(format!("Event {} not found", event_id))
        }
    }

    /// Mark event as failed and retry if possible
    pub fn mark_failed(&self, event_id: &str) -> Result<bool, String> {
        let mut queue = self.queue.lock().unwrap();
        if let Some(idx) = queue.iter().position(|e| e.event.id == event_id) {
            if let Some(queued) = queue.get_mut(idx) {
                queued.retry_count += 1;
                if queued.retry_count < queued.max_retries {
                    queued.status = QueueStatus::Retry;
                    return Ok(true);
                } else {
                    queued.status = QueueStatus::Failed;
                    return Ok(false);
                }
            }
        }
        Err(format!("Event {} not found", event_id))
    }
}