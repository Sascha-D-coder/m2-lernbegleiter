use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    Manager,
};

mod db;

#[tauri::command]
fn get_today_summary() -> String {
    // Placeholder - will be replaced with real DB query
    serde_json::json!({
        "day_number": 1,
        "total_days": 88,
        "subject": "Pharmakologie",
        "sub_topic": "Grundlagen",
        "progress_percent": 0,
        "anki_due": 0,
        "streak": 0,
        "reading_done": false,
        "kreuzen_done": false,
        "kreuzen_target": 80
    })
    .to_string()
}

#[tauri::command]
async fn toggle_dashboard(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("dashboard") {
        let visible = window.is_visible().map_err(|e| e.to_string())?;
        if visible {
            window.hide().map_err(|e| e.to_string())?;
        } else {
            window.show().map_err(|e| e.to_string())?;
            window.set_focus().map_err(|e| e.to_string())?;
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
                            if let Some(window) = app_handle.get_webview_window("widget") {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                        "dashboard" => {
                            if let Some(window) = app_handle.get_webview_window("dashboard") {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                        "quit" => {
                            app_handle.exit(0);
                        }
                        _ => {}
                    }
                })
                .build(app)?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![get_today_summary, toggle_dashboard])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
