// Empêche l'ouverture d'une console en plus de la fenêtre sous Windows (build release)
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    plumier_lib::run()
}
