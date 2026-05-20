use std::sync::atomic::{AtomicU8, Ordering};
use std::sync::Arc;
use tauri::{Emitter, State};

/// WebSocket 连接状态
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[repr(u8)]
pub enum WsStatus {
    Disconnected = 0,
    Connecting = 1,
    Connected = 2,
}

impl WsStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            WsStatus::Disconnected => "disconnected",
            WsStatus::Connecting => "connecting",
            WsStatus::Connected => "connected",
        }
    }
}

/// 共享的 WebSocket 状态
pub struct SharedWsState {
    status: AtomicU8,
}

impl SharedWsState {
    pub fn new() -> Self {
        SharedWsState {
            status: AtomicU8::new(WsStatus::Disconnected as u8),
        }
    }

    pub fn set(&self, s: WsStatus) {
        self.status.store(s as u8, Ordering::SeqCst);
    }

    #[allow(dead_code)]
    pub fn get(&self) -> WsStatus {
        match self.status.load(Ordering::SeqCst) {
            1 => WsStatus::Connecting,
            2 => WsStatus::Connected,
            _ => WsStatus::Disconnected,
        }
    }
}

/// 前端查询当前 WebSocket 状态
#[tauri::command]
pub fn get_ws_status(state: State<'_, Arc<SharedWsState>>) -> String {
    state.get().as_str().to_string()
}

/// 测试：发送模拟消息到前端（无服务端时用于调试 UI）
#[tauri::command]
pub fn send_test_message(app: tauri::AppHandle, role: String, content: String) {
    let payload = serde_json::json!({
        "role": role,
        "content": content,
    });
    let _ = app.emit("agent-message", payload);
}
