# West 6.27.1 — Fluidez, auto-actualización y pulido de música

## Qué cambia

### 1. Rendimiento: la app ya no se bloquea con muchas canciones

**Causa raíz encontrada.** `App.tsx` (la raíz de la aplicación) estaba
suscrito a `tracks`, `musicQueue`, `queueSource`, `trackHistory` y
`playCounts`. Con miles de canciones, **cualquier** cambio (un favorito, un
import, una reproducción) re-creaba esos objetos y repintaba **toda** la
aplicación: barra lateral, vista activa, reproductor, planificador.

- La raíz ya no se suscribe a la biblioteca. Lee el estado vivo con
  `useAppSnapshot()` solo en el momento exacto en que el motor musical lo
  necesita (`src/App.tsx`, `src/hooks/useYouTubeRecovery.ts`).
- Las filas de la biblioteca son un componente memoizado
  (`LibraryRow` en `src/components/music/MusicLibrary.tsx`): al marcar una
  canción como favorita solo se repinta esa fila.
- La lista visible se calcula una sola vez por página (`visible` memoizado) en
  lugar de recalcular el corte en cada render.

Resultado esperado: importar o modificar canciones ya no arrastra a toda la
app; la navegación entre apartados se mantiene fluida.

### 2. La portada de las canciones vuelve a verse

**Causa raíz encontrada.** La regla CSS de la miniatura aplicaba
`opacity:0` a **todos** los `<span>` hijos del botón de portada, incluida la
imagen. La portada solo aparecía al pasar el ratón por encima.

- La imagen tiene ahora su propia clase y siempre es visible; el velo oscuro
  con el icono de reproducción es lo único que aparece al pasar el ratón
  (`src/components/music/music-studio.css`, `src/components/music/MusicLibrary.tsx`).

### 3. Auto-actualización con GitHub Releases

Explicación completa en [`docs/WEST-updater.md`](./WEST-updater.md).

- Plugin oficial `tauri-plugin-updater` + manifiesto `latest.json` de GitHub.
- Aviso **dentro de la app** con botón «Actualizar» y barra de progreso
  (`src/components/ui/UpdateNotice.tsx`).
- «Buscar actualizaciones» en Ajustes → Sobre West.
- Clave pública embebida; la privada nunca sale del equipo de publicación.
- Workflow `.github/workflows/release.yml`: compila, firma y publica.

### 4. Descargas: álbumes, artistas y canciones que sí se descargan

- El importador acepta **lista, álbum o artista** de Deezer y Spotify
  (`src-tauri/src/playlist_import.rs`): el álbum lee su pista completa y el
  artista sus primeros álbumes públicos.
- Las canciones que vienen de otro servicio **se resuelven contra una
  grabación pública** antes de descargar o guardar: antes salían como «no
  descargables».
- Botón «Descargar todo» además de la descarga por canción.
- Portada del álbum más grande (104 px), tipo de colección visible y títulos
  de dos líneas en vez de cortarse.

### 5. Ajustes y Planificador

- Nueva categoría **Planificador** en Ajustes: ahí se activan y desactivan los
  hábitos de **agua** y **ejercicio**. El apartado Hábitos conserva solo el
  medidor diario.
- Hover de las tareas del Planificador: el borde discontinuo se sustituye por
  un realce interior suave y el filo izquierdo pasa a sólido.
- Tema del espacio en Ajustes:_OScuro / Claro / Del sistema / Vibrante_ se
  eligen con tarjetas con vista previa en vez de un desplegable.

### 6. Artistas

- La etiqueta «Elegida por ti» / «En tu biblioteca» ya no ocupa sitio: queda
  como icono con la explicación en el tooltip.
- La **X** de quitar canción queda centrada con exactitud.
- «Añadir canciones» admite ahora **tu biblioteca**, **búsqueda en línea** con
  selección múltiple y un atajo a **Descubrir**.

## Validación

- `pnpm exec tsc --noEmit`: 0 errores.
- `pnpm run build`: correcto.
- `cargo check`: correcto; `cargo test`: 2 pruebas del importador correctas
  (1 ignorada, requiere servicios públicos).
- Instalador NSIS: ver `release/west_FINAL.json`.

## Límites declarados

- La actualización automática solo existe en la app de escritorio (Tauri); en
  el navegador la app lo indica sin fallar.
- Spotify no publica la discografía de un artista en su vista pública: para
  artistas de Spotify hay que pegar el álbum o la lista.
- Las descargas resuelven canciones **públicas**; no se evita ninguna
  restricción del propietario del vídeo.
