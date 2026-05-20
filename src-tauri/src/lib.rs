mod commands;
mod websocket;

use std::sync::Arc;
use tauri::{
    image::Image,
    menu::{MenuBuilder, MenuItemBuilder},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Listener, Manager,
};
use url::Url;

use commands::SharedWsState;

const DEFAULT_WS_URL: &str = "ws://localhost:8080/ws";

/// 从 PNG 字节创建托盘图标（32x32 RGBA）
fn tray_icon() -> Image<'static> {
    let bytes = include_bytes!("../icons/32x32.png");
    // 用 image 库解码 PNG → RGBA
    let img = image::load_from_memory(bytes).expect("托盘图标加载失败");
    let img = img.into_rgba8();
    let (w, h) = img.dimensions();
    Image::new_owned(img.into_raw(), w, h)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let ws_state = Arc::new(SharedWsState::new());

    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .manage(ws_state.clone())
        .setup(move |app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // --- 系统托盘菜单 ---
            let float_show = MenuItemBuilder::with_id("float_show", "显示悬浮球").build(app)?;
            let float_hide = MenuItemBuilder::with_id("float_hide", "隐藏悬浮球").build(app)?;
            let chat_show = MenuItemBuilder::with_id("chat_show", "显示聊天").build(app)?;
            let chat_hide = MenuItemBuilder::with_id("chat_hide", "隐藏聊天").build(app)?;
            let quit = MenuItemBuilder::with_id("quit", "退出").build(app)?;

            let menu = MenuBuilder::new(app)
                .item(&float_show)
                .item(&float_hide)
                .separator()
                .item(&chat_show)
                .item(&chat_hide)
                .separator()
                .item(&quit)
                .build()?;

            let _tray = TrayIconBuilder::new()
                .icon(tray_icon())
                .menu(&menu)
                .tooltip("Hermes Desktop")
                .on_menu_event(move |app, event| {
                    let id = event.id().as_ref();
                    match id {
                        "float_show" => {
                            if let Some(w) = app.get_webview_window("float") {
                                let _ = w.show();
                            }
                        }
                        "float_hide" => {
                            if let Some(w) = app.get_webview_window("float") {
                                let _ = w.hide();
                            }
                        }
                        "chat_show" => {
                            if let Some(w) = app.get_webview_window("main") {
                                let _ = w.show();
                                let _ = w.set_focus();
                            }
                        }
                        "chat_hide" => {
                            if let Some(w) = app.get_webview_window("main") {
                                let _ = w.hide();
                            }
                        }
                        "quit" => {
                            app.exit(0);
                        }
                        _ => {}
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(w) = app.get_webview_window("float") {
                            let _ = w.show();
                            let _ = w.set_focus();
                        }
                    }
                })
                .build(app)?;

            // --- 监听前端 open-chat 事件 ---
            let handle = app.handle().clone();
            app.listen("open-chat", move |_| {
                if let Some(w) = handle.get_webview_window("main") {
                    let _ = w.show();
                    let _ = w.set_focus();
                }
            });

            // --- 启动 WebSocket ---
            let url = Url::parse(DEFAULT_WS_URL).expect("无效的 WebSocket URL");
            websocket::spawn_ws(url, app.handle().clone(), ws_state);

            log::info!("Hermes Desktop 启动完成");
            Ok(())
        })
        // 关闭窗口 → 隐藏而非销毁
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_ws_status,
            commands::send_test_message,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
