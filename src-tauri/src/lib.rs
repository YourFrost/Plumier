use std::process::Command;

/// Lance Pandoc avec les arguments donnés (conversion Markdown → DOCX/EPUB/…).
/// Retourne un message d'erreur lisible si Pandoc est absent ou échoue.
#[tauri::command]
fn run_pandoc(args: Vec<String>) -> Result<String, String> {
    let mut cmd = Command::new("pandoc");
    cmd.args(&args);

    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        cmd.creation_flags(CREATE_NO_WINDOW); // pas de fenêtre console qui clignote
    }

    let out = cmd.output().map_err(|e| {
        format!("Pandoc est introuvable ({e}). Installe-le depuis https://pandoc.org/installing.html puis relance Plumier.")
    })?;

    if out.status.success() {
        Ok(String::from_utf8_lossy(&out.stdout).into_owned())
    } else {
        Err(String::from_utf8_lossy(&out.stderr).into_owned())
    }
}

/// Redémarre l'application (après l'installation d'une mise à jour).
#[tauri::command]
fn restart_app(app: tauri::AppHandle) {
    app.restart();
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            // Mises à jour automatiques : le module n'est actif que si la configuration contient une
            // clé publique (builds de release signés, voir docs/RELEASING.md). Sans clé, l'initialisation
            // échoue proprement et l'application fonctionne normalement, sans mise à jour.
            let _ = app
                .handle()
                .plugin(tauri_plugin_updater::Builder::new().build());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![run_pandoc, restart_app])
        .run(tauri::generate_context!())
        .expect("erreur au lancement de Plumier");
}
