use std::sync::Arc;
use tauri::Emitter;
use tokio::sync::Mutex;
use tokio_tungstenite::tungstenite::Message;
use futures_util::StreamExt;
use url::Url;

use super::events::{EVENT_AGENT_MESSAGE, EVENT_NOTIFY_MESSAGE, EVENT_WS_STATUS};
use super::heartbeat::{Heartbeat, HeartbeatCmd};
use super::reconnect::ReconnectPolicy;
use crate::commands::{SharedWsState, WsStatus};

/// WebSocket 客户端
struct Client {
    url: Url,
    app_handle: tauri::AppHandle,
    ws_state: Arc<SharedWsState>,
    reconnect_policy: Arc<Mutex<ReconnectPolicy>>,
}

impl Client {
    pub fn new(url: Url, app_handle: tauri::AppHandle, ws_state: Arc<SharedWsState>) -> Self {
        Client {
            url,
            app_handle,
            ws_state,
            reconnect_policy: Arc::new(Mutex::new(ReconnectPolicy::new())),
        }
    }

    fn set_status(&self, s: WsStatus) {
        self.ws_state.set(s);
        let _ = self.app_handle.emit(EVENT_WS_STATUS, s.as_str());
    }

    /// 主循环：连接 → 读消息 → 断连 → 重连
    pub async fn run(&self) {
        loop {
            self.set_status(WsStatus::Connecting);
            log::info!("WebSocket 连接中: {}", self.url);

            match tokio_tungstenite::connect_async(self.url.as_str()).await {
                Ok((ws_stream, _)) => {
                    log::info!("WebSocket 已连接");
                    self.set_status(WsStatus::Connected);
                    self.reconnect_policy.lock().await.reset();

                    let (mut _write, mut read) = ws_stream.split();
                    let heartbeat = Heartbeat::new();

                    let app_handle = self.app_handle.clone();
                    let cmd_tx = heartbeat.cmd_tx.clone();

                    // 读消息 → 前端事件
                    let read_done = tauri::async_runtime::spawn(async move {
                        while let Some(msg_result) = read.next().await {
                            match msg_result {
                                Ok(Message::Text(text)) => {
                                    let _ = cmd_tx.send(HeartbeatCmd::Pong);
                                    let text_str = text.to_string();
                                    let payload: serde_json::Value =
                                        serde_json::from_str(&text_str).unwrap_or_else(|_| {
                                            serde_json::json!({ "raw": text_str })
                                        });
                                    // notify 类型单独发事件，用于桌面通知
                                    if payload.get("type").and_then(|v| v.as_str()) == Some("notify") {
                                        let title = payload
                                            .get("title")
                                            .and_then(|v| v.as_str())
                                            .unwrap_or("Hermes");
                                        let body = payload
                                            .get("content")
                                            .and_then(|v| v.as_str())
                                            .unwrap_or("");
                                        let notify_payload = serde_json::json!({
                                            "title": title,
                                            "body": body,
                                        });
                                        let _ = app_handle.emit(EVENT_NOTIFY_MESSAGE, notify_payload);
                                    }
                                    let _ = app_handle.emit(EVENT_AGENT_MESSAGE, payload);
                                }
                                Ok(Message::Pong(_)) => {
                                    let _ = cmd_tx.send(HeartbeatCmd::Pong);
                                }
                                Ok(Message::Close(_)) => {
                                    log::info!("WebSocket 服务端关闭");
                                    break;
                                }
                                Ok(Message::Ping(_)) => {} // tungstenite 自动回复
                                Ok(_) => {} // Binary / Frame 忽略
                                Err(e) => {
                                    log::error!("WebSocket 读取错误: {}", e);
                                    break;
                                }
                            }
                        }
                    });

                    // 心跳超时检测
                    let mut timeout_rx = heartbeat.timeout_rx;
                    let timeout_done = tauri::async_runtime::spawn(async move {
                        timeout_rx.recv().await;
                    });

                    // 任一条件触发 → 断连重来
                    tokio::select! {
                        _ = read_done => {}
                        _ = timeout_done => {
                            log::warn!("WebSocket 心跳超时");
                        }
                    }

                    let _ = heartbeat.cmd_tx.send(HeartbeatCmd::Stop);
                }
                Err(e) => {
                    log::error!("WebSocket 连接失败: {}", e);
                }
            }

            self.set_status(WsStatus::Disconnected);
            super::reconnect::wait(&mut *self.reconnect_policy.lock().await).await;
        }
    }
}

/// 后台启动 WebSocket 客户端
pub fn spawn(url: Url, app_handle: tauri::AppHandle, ws_state: Arc<SharedWsState>) {
    let client = Client::new(url, app_handle, ws_state);
    tauri::async_runtime::spawn(async move {
        client.run().await;
    });
}
