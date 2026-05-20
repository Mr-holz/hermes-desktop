use serde::{Deserialize, Serialize};

/// 服务端下发的消息类型
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "data")]
pub enum WsEvent {
    /// AI 对话消息
    #[serde(rename = "chat")]
    Chat {
        role: String,
        content: String,
    },
    /// 系统通知
    #[serde(rename = "notify")]
    Notify {
        title: String,
        body: String,
    },
    /// 原始 JSON，用于未识别类型的前端直出
    #[serde(untagged)]
    Raw(serde_json::Value),
}

/// 前端监听的事件名
pub const EVENT_AGENT_MESSAGE: &str = "agent-message";
pub const EVENT_NOTIFY_MESSAGE: &str = "notify-message";
pub const EVENT_WS_STATUS: &str = "ws-status";
