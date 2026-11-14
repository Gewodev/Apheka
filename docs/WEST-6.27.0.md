# West 6.27.0 — Renombramiento de producto y documentación

Fecha: 2026-11-14  
Versión: 6.27.0  
Identificador de la app: `com.owa.studio` (conservado)  
Ejecutable: `West.exe`  
Instalador: `release/west_FINAL.exe` (53,460,257 bytes)  
SHA-256: `B07093B398DA6A3C7F239A60EFE9068815EAFCCC312A2410685EE9F6A15296B0`

## Resumen

West es la nueva identidad de producto. La aplicación, el ejecutable y el instalador pasan a llamarse **West** en todas partes visibles. Los datos, rutas, claves internas, eventos y licencias se conservan sin cambios.

## Cambios clave

### Identidad visible → West
- `productName`, `title`, `mainBinaryName` y `package.json` pasan a `West` en `src-tauri/tauri.conf.json`, `tauri.prod.conf.json` y `package.json`.
- Wordmark `West` (Inter Tight, peso 300, tracking `.012em`) unificado en app, ejecutable e instalador.
- Logotipo original azul/rojo preservado (512×512) como icono del ejecutable y de los toasts.
- `README.md`, `PRODUCT.md`, `design.md`, `.github/workflows/release.yml` y `public/office-icons/NOTICE.md` actualizados.

### Identidad de Windows (nativa)
- `SetCurrentProcessExplicitAppUserModelID("com.owa.studio")` antes de crear cualquier ventana o toast (`src-tauri/src/windows_identity.rs`).
- Registro `HKCU\Software\Classes\AppUserModelId\com.owa.studio` con `DisplayName: West` e `IconUri` al logo original (escrito una vez en `%LOCALAPPDATA%\com.owa.studio\west-logo.png`, cacheado).
- Cada toast nativo usa `appLogoOverride` con el logo original: nunca el icono genérico de WebView2.
- Nuevos features de `windows-sys 0.61`: `Win32_UI_Shell`, `Win32_System_Registry`, `Win32_Security`.

### Instalador (único instalable `West`)
- Una sola identidad en `Software\Microsoft\Windows\CurrentVersion\Uninstall\West`.
- Retirada verificada de instalaciones heredadas: `APHEKA`, `POHU`, `POUH`, `OWA Studio`, `OwA Project` y `OwA Project_Beta` (NSIS, MSI y carpetas de menú de inicio).
- Ruta y modo de instalación (per-user / per-machine) se preservan al actualizar; los datos en `com.owa.studio` nunca se borran (`/UPDATE` en el desinstalador legacy).
- Captura West primero, luego APHEKA; el aviso de versión reconoce a APHEKA como instalación heredada (`West continúa con todos tus datos.`).
- Herramientas NSIS conservan nombres `APHEKA_*` por compatibilidad interna.
- Instalador NSIS en español (`West ${VERSION} · Instalar y actualizar`); obras de instalación regeneradas con el wordmark West y el logo original.
- GUID de actualización MSI `2c58d5ce-7ade-517b-ae4c-6a57e15f39fd` conservado.

### Compatibilidad (NO cambiadas)
- `com.owa.studio` (identificador, carpetas de datos, scopes fs, claves locales).
- Marcadores `apheka-*`, eventos `apheka:*`, `APHEKA_FILE:`, `APHEKA Music`, claves `APHEKA/Charvis/*` y `APHEKA/TypeSafe/Jev` (Credential Manager).
- Prefijo MCP `mcpServers.apheka` y nombres de herramientas `apheka_*`; el servidor se presenta ahora como `West` en el handshake.
- `apheka-installed.txt`, `apheka-install.json`, claves de almacenamiento `owa_*` y eventos `apheka:*`.
- ffmpeg y yt-dlp conservados; ffprobe y modelos ASR siguen retirados.

### Pruebas de identidad
- 51 pruebas nativas Rust OK (incluidas `windows_identity`).
- `pnpm exec tsc --noEmit`: 0 errores.
- `pnpm run build`: OK (43.44s).
- `pnpm tauri build`: OK (8m 43s).
- Pruebas aisladas del instalador NSIS (primera instalación, reinstalación, sustitución de OWA Studio y APHEKA, `/UPDATE`, datos intactos, herramientas canónicas conservadas, claves/herramientas ignoradas si son ajenas): OK.

## Artefacto

Solo se versiona `release/west_FINAL.exe` (53,460,257 bytes < 100 MB, límite de GitHub) junto a `release/west_FINAL.json`.

No se ejecutó el instalador sobre la instalación personal; la sustitución se validó con fixtures y registros aislados.

## Próximo paso (usuario)

- Relanzar la app con `pnpm tauri dev` y verificar que el título de ventana, los toasts y "Agregar o quitar programas" muestren **West**.
- Verificar la sustitución sobre una instalación APHEKA 6.27.0 existente en un entorno aislado (fixture), no en la instalación personal.
