use std::time::Duration;
use tokio::time::sleep;

/// 重连策略：指数退避，最大 60 秒
pub struct ReconnectPolicy {
    attempt: u32,
    base: Duration,
    max: Duration,
}

impl ReconnectPolicy {
    pub fn new() -> Self {
        ReconnectPolicy {
            attempt: 0,
            base: Duration::from_secs(1),
            max: Duration::from_secs(60),
        }
    }

    /// 返回下次重连前需等待的时间
    pub fn next_delay(&mut self) -> Duration {
        let delay = self.base * 2u32.pow(self.attempt.min(10));
        self.attempt += 1;
        delay.min(self.max)
    }

    /// 重置重连计数
    pub fn reset(&mut self) {
        self.attempt = 0;
    }
}

/// 等待重连间隔，完成后返回
pub async fn wait(policy: &mut ReconnectPolicy) {
    let delay = policy.next_delay();
    log::info!("WebSocket 重连等待 {:?}", delay);
    sleep(delay).await;
}
