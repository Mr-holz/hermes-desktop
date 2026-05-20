use std::time::Duration;
use futures_util::SinkExt;
use tokio::sync::mpsc;
use tokio_tungstenite::tungstenite::{Bytes, Message};

/// 心跳控制信号
#[derive(Debug, Clone)]
pub enum HeartbeatCmd {
    Pong,
    Stop,
}

/// 心跳超时监控：30 秒内未收到 Pong 则通知重连
pub struct Heartbeat {
    pub cmd_tx: mpsc::UnboundedSender<HeartbeatCmd>,
    pub timeout_rx: mpsc::UnboundedReceiver<()>,
}

impl Heartbeat {
    pub fn new() -> Self {
        let (cmd_tx, mut cmd_rx) = mpsc::unbounded_channel();
        let (timeout_tx, timeout_rx) = mpsc::unbounded_channel();

        tauri::async_runtime::spawn(async move {
            let mut last_pong = tokio::time::Instant::now();
            let mut check_interval = tokio::time::interval(Duration::from_secs(10));

            loop {
                tokio::select! {
                    cmd = cmd_rx.recv() => match cmd {
                        Some(HeartbeatCmd::Pong) => {
                            last_pong = tokio::time::Instant::now();
                        }
                        Some(HeartbeatCmd::Stop) | None => break,
                    },
                    _ = check_interval.tick() => {
                        if last_pong.elapsed() > Duration::from_secs(30) {
                            let _ = timeout_tx.send(());
                            last_pong = tokio::time::Instant::now();
                        }
                    }
                }
            }
        });

        Heartbeat { cmd_tx, timeout_rx }
    }
}

/// 每 15 秒发送 Ping，失败则退出
pub async fn ping_loop(
    ws_write: &mut (impl SinkExt<Message> + Unpin),
) {
    let mut interval = tokio::time::interval(Duration::from_secs(15));
    interval.tick().await; // 跳过首次立即触发
    loop {
        interval.tick().await;
        if ws_write.send(Message::Ping(Bytes::new())).await.is_err() {
            break;
        }
    }
}
