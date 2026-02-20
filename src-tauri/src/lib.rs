use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    Manager,
    WindowEvent,
};

#[tauri::command]
async fn toggle_dashboard(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(dashboard) = app.get_webview_window("dashboard") {
        let visible = dashboard.is_visible().map_err(|e| e.to_string())?;
        if visible {
            // Hide dashboard → show widget again
            dashboard.hide().map_err(|e| e.to_string())?;
            if let Some(widget) = app.get_webview_window("widget") {
                let _ = widget.show();
            }
        } else {
            // Show dashboard → hide widget
            if let Some(widget) = app.get_webview_window("widget") {
                let _ = widget.hide();
            }
            dashboard.show().map_err(|e| e.to_string())?;
            dashboard.set_focus().map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_sql::Builder::new().build())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            // Build tray menu
            let show_i = MenuItem::with_id(app, "show", "Anzeigen", true, None::<&str>)?;
            let dashboard_i =
                MenuItem::with_id(app, "dashboard", "Dashboard", true, None::<&str>)?;
            let quit_i = MenuItem::with_id(app, "quit", "Beenden", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_i, &dashboard_i, &quit_i])?;

            let _tray = TrayIconBuilder::new()
                .menu(&menu)
                .tooltip("M2 Lernbegleiter")
                .on_menu_event(|app_handle: &tauri::AppHandle, event| {
                    match event.id.as_ref() {
                        "show" => {
                            // Show widget → hide dashboard
                            if let Some(dashboard) = app_handle.get_webview_window("dashboard") {
                                let _ = dashboard.hide();
                            }
                            if let Some(widget) = app_handle.get_webview_window("widget") {
                                let _ = widget.show();
                                let _ = widget.set_focus();
                            }
                        }
                        "dashboard" => {
                            // Show dashboard → hide widget
                            if let Some(widget) = app_handle.get_webview_window("widget") {
                                let _ = widget.hide();
                            }
                            if let Some(dashboard) = app_handle.get_webview_window("dashboard") {
                                let _ = dashboard.show();
                                let _ = dashboard.set_focus();
                            }
                        }
                        "quit" => {
                            app_handle.exit(0);
                        }
                        _ => {}
                    }
                })
                .build(app)?;

            // Force widget webview background to transparent (fixes white corners on macOS)
            #[cfg(target_os = "macos")]
            {
                use tauri::webview::Color;
                if let Some(widget) = app.get_webview_window("widget") {
                    let _ = widget.set_background_color(Some(Color(0, 0, 0, 0)));
                }
            }

            // Intercept dashboard close → hide instead + show widget
            if let Some(dashboard) = app.get_webview_window("dashboard") {
                let app_handle = app.handle().clone();
                dashboard.on_window_event(move |event| {
                    if let WindowEvent::CloseRequested { api, .. } = event {
                        // Prevent actual close, just hide
                        api.prevent_close();
                        if let Some(d) = app_handle.get_webview_window("dashboard") {
                            let _ = d.hide();
                        }
                        // Show widget again
                        if let Some(w) = app_handle.get_webview_window("widget") {
                            let _ = w.show();
                        }
                    }
                });
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![toggle_dashboard])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
