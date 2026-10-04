// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
  #[cfg(target_os = "linux")]
  {
    // Force l'accélération PRIME NVIDIA uniquement en session X11 native.
    // Sous Wayland (XWayland inclus), ce forcage impose une copie inter-GPU à
    // chaque frame « sale » et fait tomber le rAF de la page à ~7 Hz
    // (mesuré : vue joueur à 6–9 FPS, contre 56–71 FPS sans).
    if std::env::var_os("WAYLAND_DISPLAY").is_some() {
      // Un lancement via launch.sh peut avoir exporté ces variables : on les retire.
      std::env::remove_var("__NV_PRIME_RENDER_OFFLOAD");
      std::env::remove_var("__GLX_VENDOR_LIBRARY_NAME");
      std::env::remove_var("__VK_LAYER_NV_optimus");
    } else if std::path::Path::new("/proc/driver/nvidia/version").exists() {
      if std::env::var("__NV_PRIME_RENDER_OFFLOAD").is_err() {
        std::env::set_var("__NV_PRIME_RENDER_OFFLOAD", "1");
      }
      if std::env::var("__GLX_VENDOR_LIBRARY_NAME").is_err() {
        std::env::set_var("__GLX_VENDOR_LIBRARY_NAME", "nvidia");
      }
      if std::env::var("__VK_LAYER_NV_optimus").is_err() {
        std::env::set_var("__VK_LAYER_NV_optimus", "NVIDIA_only");
      }
    }

    // WebKitGTK : le renderer DMABUF est le chemin d'accélération rapide.
    // Certains environnements l'exportent désactivé (workaround écran noir / NVIDIA),
    // ce qui coûte cher : contrôle plein écran mesuré à 20 FPS avec le flag contre
    // 47 FPS sans lui, et la vue Joueurs passe de 13 à 17 FPS sur la même machine.
    // On le réactive pour Grimoire ; exporter GRIMOIRE_WEBKIT_NO_DMABUF=1 conserve
    // l'ancien comportement si le rendu accéléré pose problème sur une machine.
    if std::env::var("GRIMOIRE_WEBKIT_NO_DMABUF").is_err() {
      std::env::remove_var("WEBKIT_DISABLE_DMABUF_RENDERER");
    }
  }

  grimoire_lib::run();
}
