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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![run_pandoc])
        .run(tauri::generate_context!())
        .expect("erreur au lancement de Plumier");
}
