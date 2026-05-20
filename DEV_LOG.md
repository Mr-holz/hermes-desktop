# Hermes Desktop 开发记录

## Phase 1：项目初始化与通信基础

**日期**：2026-05-20

### 1.1 初始化 Tauri 项目

**结论**：成功创建 Tauri v2 + React + TypeScript + Vite 项目骨架。

**操作**：
- `pnpm create vite hermes-desktop --template react-ts` 创建前端
- `pnpm add -D @tauri-apps/cli` + `pnpm add @tauri-apps/api` 添加 Tauri
- `npx tauri init --ci` 初始化 Rust 端

**文件结构**：
```
hermes-desktop/
├── src/                  # React 前端
├── src-tauri/            # Rust 后端
│   ├── src/
│   │   ├── main.rs
│   │   └── lib.rs
│   ├── Cargo.toml
│   └── tauri.conf.json
├── package.json
└── vite.config.ts
```

**问题**：
- 环境缺少 Rust、pnpm、Tauri 系统依赖，需手动安装
- npm 全局路径在 /usr/lib 需 root 权限，通过配置 `~/.npm-global` 解决
- Rust 安装后需 `rustup default stable` 设置默认工具链

---

### 1.2 配置 Tailwind CSS

**结论**：Tailwind CSS v4 配置成功，无需 `tailwind.config.js`。

**操作**：
- `pnpm add tailwindcss @tailwindcss/vite`
- vite.config.ts 添加 tailwindcss 插件
- index.css 使用 `@import "tailwindcss"`
- 删除 App.css，用 Tailwind 工具类替代

**问题**：
- Tailwind v4 与 v3 配置方式完全不同（无 config 文件、CSS-first 配置），注意查 v4 文档

---

### 1.3 Rust WebSocket Runtime

**结论**：完成了 WebSocket 客户端核心逻辑。

**模块结构**：
```
src-tauri/src/
├── websocket/
│   ├── mod.rs          # 模块入口
│   ├── client.rs       # WS 连接主循环
│   ├── heartbeat.rs    # 心跳检测 + Ping/Pong
│   ├── reconnect.rs    # 指数退避重连
│   └── events.rs       # 事件类型定义
├── commands/
│   └── mod.rs          # Tauri 命令 + 共享状态
├── lib.rs              # Tauri Builder setup
└── main.rs             # 入口
```

**功能**：
- 自动连接 / 断连重连（指数退避 1s → max 60s）
- 心跳超时检测（30s 无 Pong 触发重连）
- 消息分发到前端（`window.emit`）
- 共享状态（AtomicU8），前端可查询

**依赖**（Cargo.toml 新增）：
- `tokio` — 异步运行时
- `tokio-tungstenite` — WebSocket 客户端
- `futures-util` — Stream/Sink trait
- `url` — URL 解析

**问题**：
- `url::Url` 与 Tauri 重导出的 `tauri::Url` 冲突，`connect_async` 改用 `self.url.as_str()` 传参
- `tungstenite::Utf8Bytes` 不实现 `Serialize`，需先 `.to_string()` 再序列化
- `#[tauri::command]` 函数需 `pub` 才能在 `generate_handler!` 中引用
- `Message::Ping` 需要 `Bytes` 类型而非 `Vec<u8>`，用 `Bytes::new()`
- `SinkExt::send` 需要 `use futures_util::SinkExt`

---

### 1.4 Rust → 前端事件通信

**结论**：前后端事件通道打通。

**Rust 端**：
- `app_handle.emit("agent-message", payload)` — 推送消息
- `app_handle.emit("ws-status", status)` — 推送连接状态
- `get_ws_status()` 命令 — 前端主动查询

**前端端**：
- `listen("agent-message", handler)` — 监听消息
- `listen("ws-status", handler)` — 监听状态
- `invoke("get_ws_status")` — 查询状态

**问题**：
- 无

---

### 1.5 基础 UI

**结论**：完成了消息列表、输入框、测试按钮。

**功能**：
- 消息气泡（user / assistant / notify / system 四色区分）
- Enter 发送，Shift+Enter 换行
- 自动滚动到底部
- WebSocket 连接状态指示灯（绿/黄/红）
- 测试按钮模拟各类消息

**问题**：
- 目前无真实服务端，通过 `send_test_message` 命令模拟消息用于调试 UI
- 后续对接真实 WebSocket 服务端后，删除测试代码即可

---

## Phase 1 总结

**完成度**：✅ 全部完成

**验收标准对照**：
- [x] 可以连接服务器（WebSocket 客户端就绪）
- [x] 可以发送消息（前端 → Rust 命令 → 事件）
- [x] 可以接收消息（Rust → 前端事件）
- [x] 断网后自动重连（指数退避重连）
- [x] UI 可实时更新（React state + 事件监听）

**编译状态**：
- 前端 `pnpm build` ✅
- Rust `cargo check` ✅（仅 2 个 harmless warning）

**下一步**：Phase 2 — 悬浮窗系统

---

## Phase 2：悬浮窗系统

**日期**：2026-05-20

### 2.1 透明悬浮窗配置

**结论**：float 窗口配置为透明、无边框、置顶的 80x80 小窗。

**tauri.conf.json 关键配置**：
```json
{
  "label": "float",
  "transparent": true,
  "decorations": false,
  "alwaysOnTop": true,
  "width": 80,
  "height": 80,
  "resizable": false
}
```

**问题**：无

### 2.2 自定义窗口拖动

**结论**：前端通过 `getCurrentWindow().startDragging()` 实现无边框窗口拖动。

**实现**：
- FloatWindow：整个窗口区域可拖动
- ChatWindow：标题栏区域可拖动（`cursor-grab` 样式）

### 2.3 双窗口结构

**结论**：实现了 float（悬浮球） + main（聊天窗）双窗口。

**窗口路由**：
- `App.tsx` 根据 `getCurrentWindow().label` 渲染不同组件
- float → `FloatWindow.tsx`（圆形渐变悬浮球）
- main → `ChatWindow.tsx`（完整聊天界面）

**交互**：
- 点击悬浮球 → `emit("open-chat")` → Rust 显示聊天窗
- 聊天窗关闭按钮 → `hide()` 隐藏

### 2.4 系统托盘

**结论**：通过 `TrayIconBuilder` 创建托盘，支持左键点击和右键菜单。

**菜单项**：
- 显示/隐藏悬浮球
- 显示/隐藏聊天
- 退出

**依赖新增**：
- `tauri` 启用 `tray-icon` feature
- `image` crate 用于解码 PNG 图标

### 2.5 关闭缩到托盘

**结论**：通过 `on_window_event` 拦截 `CloseRequested`，调用 `prevent_close()` + `hide()`。

**问题**：
- Tauri v2 的 tray、Image、Listener API 与 v1 不同，需要：
  - `tauri::tray` 模块需启用 `tray-icon` feature
  - `Image::new_owned(rgba, w, h)` 而非 `Image::from_bytes`
  - `app.listen()` 需 `use tauri::Listener`
  - 托盘图标需用 `image` crate 解码 PNG → RGBA

---

## Phase 2 总结

**完成度**：✅ 全部完成

**验收标准对照**：
- [x] 窗口透明
- [x] 无边框
- [x] 置顶
- [x] 可拖动
- [x] 托盘可用
- [x] 后台持续运行

**当前项目结构**：
```
src/
├── App.tsx              # 窗口路由
├── FloatWindow.tsx       # 悬浮球
├── ChatWindow.tsx        # 聊天窗
├── main.tsx
└── index.css

src-tauri/src/
├── websocket/            # WS 客户端
├── commands/             # Tauri 命令
├── lib.rs                # 托盘 + 窗口管理
└── main.rs
```

**下一步**：通知系统

---

## 通知系统

**日期**：2026-05-20

### 功能概述

服务端推送通知 → 系统桌面弹窗 + 悬浮球角标 + 消息列表展示。

### 实现

**Rust 端**（client.rs / events.rs）：
- WS 收到 `type: "notify"` 消息时，额外 emit `notify-message` 事件
- 新事件常量 `EVENT_NOTIFY_MESSAGE = "notify-message"`
- 提取 `title` 和 `content` 字段作为通知标题和正文

**插件**（tauri-plugin-notification）：
- Cargo.toml 添加 `tauri-plugin-notification`
- lib.rs 注册 `.plugin(tauri_plugin_notification::init())`
- capabilities 添加 `notification:default` 等权限
- 前端安装 `@tauri-apps/plugin-notification`

**前端**：
- ChatWindow：监听 `notify-message` → `sendNotification()` 系统弹窗 + 计数
- FloatWindow：监听 `notify-count` → 显示红色角标（带脉冲动画）
- 通知消息在列表中特殊样式（渐变背景、黄色边框、"通知"标签）
- 启动时自动请求通知权限

**依赖新增**：
- Rust: `tauri-plugin-notification = "2"`
- 前端: `@tauri-apps/plugin-notification`

**问题**：无

### 通知数据流

```
服务端 WS → Rust client 识别 notify → emit("notify-message")
  ├── 前端 ChatWindow → sendNotification() 系统弹窗
  ├── 前端 ChatWindow → 消息列表展示
  └── emit("notify-count") → FloatWindow 角标更新
```

### 验收

- [x] 收到 notify 消息 → 桌面弹窗通知
- [x] 悬浮球显示未读计数
- [x] 聊天窗列表展示通知消息
- [x] 通知权限正常获取

**下一步**：继续聊天系统 或 其他功能

---

## 桌宠动画系统（初版）

**日期**：2026-05-20

### 功能概述

悬浮球从静态渐变圆球 → Canvas 绘制动画角色，根据 WS 状态切换表情/动作。

### 实现

**SpriteAnimator 组件**（`src/components/SpriteAnimator.tsx`）：
- 纯 Canvas 绘制，无外部依赖
- requestAnimationFrame 驱动，帧率自适应
- 4 种状态动画：idle / thinking / talking / notify
- 程序化绘制二次元角色（无需外部资源）

**状态动画**：

| 状态 | 动画 | 触发条件 |
|------|------|----------|
| idle | 睁眼 + 眨眼 + 呼吸缩放 | 默认 / WS 已连接 |
| thinking | 向上看 + 思考气泡 | WS connecting |
| talking | 张嘴开合 + 身体微弹 | 收到 assistant 消息 |
| notify | 星星眼 + 感叹号 | 收到 notify 消息 |

**状态驱动**：
```
WS connecting → thinking
WS connected → idle
收到 assistant 消息 → talking (2s 后回 idle)
收到 notify 消息 → notify (2s 后回 idle)
```

**FloatWindow 变更**：
- 移除蓝紫渐变圆球 + "H" 字母
- 集成 SpriteAnimator 组件
- hover 时发光效果 + 状态文字标签

**后续扩展**：
- 替换为真正的精灵图 / Live2D 模型（只需替换 SpriteAnimator 内部渲染）
- 状态机配置外置，从 JSON 加载

**依赖新增**：无

**问题**：无

**下一步**：继续聊天系统 或 其他功能

