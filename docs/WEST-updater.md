# West: auto-actualización con GitHub Releases

Este documento explica, en palabras simples, qué es la "clave pública" que
pides en la configuración y cómo queda el ciclo completo de publicación.

## 1. Qué es la clave pública

West se actualiza descargando un instalador desde internet. Para que nadie
puedea inyectar un instalador falso (por ejemplo, alguien que se haga pasar
por nosotros), el paquete se **firman digitalmente** antes de publicarlo.

Hay dos claves que trabajan juntas:

| Clave | Dónde vive | Para qué sirve |
|---|---|---|
| **Clave privada** (`west.key`) | **Solo en tu equipo y en los secretos de GitHub.** Nunca dentro de la app, nunca en un commit. | Firma el instalador. Es como la firma de un documento: demuestra que el paquete salió de tu taller. |
| **Clave pública** (`west.key.pub`) | Dentro del instalador (`src-tauri/tauri.conf.json` → `plugins.updater.pubkey`). | Verifica la firma de lo que llega. Es pública a propósito: cualquiera puede comprobarla, y solo sirve para *verificar*, no para firmar. |

Flujo resumido:

```
Tu clave privada  ──firma──▶  West_6.28.0_x64-setup.exe + latest.json
                                          │
                                          ▼  (subido a GitHub Releases)
La app descarga  ──verifica con la clave pública──▶  "¿es auténtico?" → instalar
```

Si alguien cambiase un byte del instalador, la firma dejaría de coincidir y
West rechazaría la actualización. La clave pública **no es un secreto**: puede
viajar dentro del programa. Lo que nunca debe salir de tu equipo es la
**privada**.

## 2. Lo que ya está implementado en el código

- `src-tauri/tauri.conf.json` → `plugins.updater`:
  - `active: true`
  - `endpoints`: `https://github.com/Gewodev/Apheka/releases/latest/download/latest.json`
  - `pubkey`: la clave pública de West
  - `windows.installMode: "passive"` (el instalador se aplica sin interrumpir)
- Plugin Rust `tauri-plugin-updater` registrado en `src-tauri/src/main.rs`.
- Permiso `updater:default` en `src-tauri/capabilities/default.json`.
- `src/lib/appUpdater.ts`: consulta el manifiesto y aplica la instalación.
- `src/lib/updaterStore.ts`: estado compartido (banda de aviso + Ajustes).
- `src/components/ui/UpdateNotice.tsx`: banda dentro de la app con el botón
  **Actualizar** y barra de progreso.
- `src/components/views/Ajustes.tsx` → «Sobre West» → **Buscar actualizaciones**.

La app comprueba sola, unos segundos después de abrir, y si hay versión nueva
aparece la banda. Si la descartas, no vuelve a molestarte hasta que salga otra
versión.

## 3. Cómo publicar una versión (paso a paso)

1. Fija la versión en los manifiestos:

   ```powershell
   ./scripts/set-release-version.ps1 -Version 6.28.0
   ```

   Actualiza `src-tauri/tauri.conf.json`, `src-tauri/tauri.prod.conf.json` y
   `package.json`.

2. Sube el código:

   ```powershell
   git add -A; git commit -m "West 6.28.0"; git push origin codex/apheka-6265-final
   ```

3. Crea la etiqueta y publícala (o usa **Actions → West Release → Run** y
   escribe la versión):

   ```powershell
   git tag v6.28.0; git push origin v6.28.0
   ```

4. El workflow `.github/workflows/release.yml` compila, **firma** el instalador
   con tu clave privada, publica el release en GitHub y sube `latest.json`.

5. La app abierta detectará la versión nueva y mostrará el botón
   **Actualizar**. Al pulsarlo se descarga, se verifica la firma, se instala
   conservando tus datos y la app se reabre.

## 4. Secretos que debes crear en GitHub

En **Settings → Secrets and variables → Actions → New repository secret**:

| Secret | Valor |
|---|---|
| `TAURI_SIGNING_PRIVATE_KEY` | El contenido **completo** del archivo `.west-signing/west.key` (es una sola línea en base64 de 348 caracteres). |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | La contraseña con la que se generó el par de claves. En esta entrega: `West-Update-2026!` |

`GITHUB_TOKEN` lo aporta el propio workflow; no hay que crearlo.

> Si prefieres publicarlo desde tu equipo (sin GitHub Actions), el script
> `scripts/publish-release.ps1` hace todo: compila firmado, crea la etiqueta,
> sube el instalador + `latest.json` y actualiza el manifiesto local.
>
> ```powershell
> ./scripts/publish-release.ps1 -Version 6.28.0
> ```

> La clave privada de esta entrega está en `.west-signing/west.key` y está
> ignorada por git (`.gitignore` incluye `.west-signing/`). Si la pierdes,
> las actualizaciones firmadas dejan de poder publicarse: habría que generar
> un par nuevo con `pnpm tauri signer generate` y actualizar el `pubkey`.

## 5. Comprobaciones

- La app **nunca** falla si GitHub no responde: el error se muestra como
  aviso y la app sigue funcionando.
- Si no hay clave privada en el entorno, la compilación local **no** intenta
  firmar nada (`createUpdaterArtifacts: false` en `tauri.conf.json` y
  `tauri.prod.conf.json`); solo el workflow de CI lo activa mediante
  `src-tauri/tauri.ci.conf.json`.
- La instalación en caliente usa `/UPDATE`: los datos de
  `%APPDATA%\com.owa.studio` y `%LOCALAPPDATA%\com.owa.studio` no se tocan.
