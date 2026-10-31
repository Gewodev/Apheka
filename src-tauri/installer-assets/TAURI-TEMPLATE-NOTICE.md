# Tauri NSIS template

`../installer-template.nsi` derives from the official Tauri CLI 2.11.2 template:
https://github.com/tauri-apps/tauri/blob/tauri-cli-v2.11.2/crates/tauri-bundler/src/bundle/windows/nsis/installer.nsi

Upstream license: MIT or Apache-2.0. The accompanying `TAURI-LICENSE-MIT.txt` retains the upstream MIT notice.

APHEKA changes: declare the maintenance selection before hooks; load hooks after version constants; dispatch resource files through the verified-tool reuse macro. The rest of the maintained upstream installation/uninstallation flow is retained.
