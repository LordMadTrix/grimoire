// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
  #[cfg(target_os = "linux")]
  {
    // Si un GPU dédié NVIDIA est présent sur le système Linux, forcer l'accélération
    // matérielle via PRIME offload et désactiver le renderer DMABUF buggé de WebKitGTK.
    if std::path::Path::new("/proc/driver/nvidia/version").exists() {
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
  }

  grimoire_lib::run();
}
