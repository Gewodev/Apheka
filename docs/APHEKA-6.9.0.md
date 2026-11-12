# APHEKA 6.9.0 — espacio de trabajo integrado

Esta revisión continúa la aplicación de escritorio y conserva su logo, identificador `com.owa.studio`, carpeta de datos y mecanismos de actualización. No instala ni modifica componentes de Linux.

## Interfaz y navegación

- Dock izquierdo oculto por defecto, con apertura desde el borde o el botón de navegación. Se superpone sin desplazar las tarjetas ni reducir la zona de trabajo.
- Hasta cinco escritorios internos, numerados, renombrables y persistentes. Conservan el apartado, curso y nota/tarea abiertos. Cambiar de escritorio guarda el editor y mantiene una sola sesión y un solo reproductor.
- Un panel acompañante ajustable para sesión, tareas, notas o letra. Se monta una vista principal y un acompañante, evitando duplicar editores completos y temporizadores.
- Barra superior con Now Playing, volumen y transporte. Puede ocultarse desde Apariencia y reaparecer desde el borde superior o con F10.
- Ctrl+Espacio abre búsqueda y captura. Ctrl+Alt+1…5 cambia de escritorio.
- Contornos suaves más visibles, superficies planas, tipografía estable y movimiento transitorio que respeta la preferencia de movimiento reducido.

## Apariencia

Dos modos principales: **Colores** y **Fondo de imagen**. Al elegir una imagen se obtiene una paleta limitada a 64×64 muestras y se guarda una clave de imagen/tema; no se vuelve a analizar por cada desplazamiento o avance de canción. Incluye variantes clara/oscura, tema del sistema, cuatro paletas, galería local, opacidad, ajuste, brillo y suavizado.

El vídeo local es opcional y está desactivado por defecto. Se pausa al perder foco, ocultarse la ventana, entrar en pantalla completa o solicitar movimiento reducido. Al desactivarlo se libera su fuente. El protocolo interno de archivos de Tauri ahora está habilitado; los documentos abiertos en navegadores externos siguen recibiendo rutas reales.

## Música

- Navegación principal: **Descubrir**, **Mis canciones** y **Listas**. Descargas y sala de escucha son herramientas diferenciadas.
- Descubrir utiliza el catálogo público de Audius mediante reproducción directa. No lanza convertidores ni descarga audio para escuchar. La disponibilidad depende del catálogo del proveedor; no representa todo el catálogo comercial de otros servicios.
- Mis canciones incluye búsqueda, filtros por artista/favoritas/disponibilidad local, vistas de lista/portadas, importación local y opciones de canción. Sus filtros y la vista musical se conservan por escritorio.
- Listas con portadas compuestas, creación vacía o desde la biblioteca, selección de canciones, renombrado, reordenación por arrastre o teclado, eliminación individual y confirmación al borrar la lista. Eliminar una lista conserva las canciones.
- Sala de escucha con portada, letra lateral opcional, búsqueda automática de letra en LRCLIB, salto desde un verso, tamaño, desfase y pantalla completa. Utiliza el mismo audio global.
- Descargas directas únicamente para grabaciones que el artista habilita públicamente. El permiso se verifica otra vez en Rust. Una descarga simultánea, progreso moderado, cancelación, reintento explícito, historial acotado y límite de espacio de catálogo. Un cierre interrumpido requiere reintentar; no provoca descargas automáticas al arrancar.
- La descarga identifica MP3, FLAC, Ogg, WAV, M4A y AAC por sus bytes. Se detectó un caso real donde el proveedor enviaba FLAC con nombre MP3; ahora se conserva el formato real sin conversión.
- Las copias existentes se reutilizan sin reescribirlas. La reproducción sin conexión utiliza su ruta local. Eliminar una canción limpia también sus referencias en listas y cola.
- Las herramientas anteriores permanecen bajo Herramientas de biblioteca y se cargan solo cuando se abren. El instalador conserva tres recursos canónicos y reutiliza cada herramienta cuyo hash coincide; no se añadieron nuevos binarios multimedia.

## Notas y conector

Tipos de nota, idea, referencia y diario; filtros, propiedades y estructuras opcionales para documentos vacíos. El diario es idempotente por fecha. Capturas con `/nota`, `/idea`, `/referencia`, `/diario` y `/tarea`, con curso, fecha y prioridad. El editor ofrece un menú de bloques en una línea vacía con `/`, conserva espacios y texto, y mantiene el guardado al cambiar de escritorio.

Corregidos: reloj sin uso que actualizaba toda la vista de Notas cada segundo; prioridad alta interpretada como valor ausente; encabezados vacíos convertidos inmediatamente en párrafos; menú de bloques que podía interceptar el buscador; restauración de la sala musical desde el escritorio anterior.

MCP incorpora organización de escritorios y control de las descargas de catálogo dentro de las operaciones musicales existentes. Conserva autenticación local, validación de campos, permisos y confirmaciones destructivas. Las estructuras y contenido de las notas no autorizan comandos del sistema.

## Verificación

Comprobaciones realizadas con datos sintéticos y una carpeta de aplicación QA separada:

- TypeScript y compilación nativa; pruebas de permisos, rutas, formatos y contratos.
- Ocho apartados a 900/1366 px, escritorios, captura, persistencia y paneles.
- Apariencia clara/oscura, paleta automática, barra superior ocultable y vídeo con pausa inteligente.
- Listas completas, cola, reproducción continua, letras y modo sin conexión.
- Escritura con tildes y espacios, pegado, historial, bloques y recuperación tras navegación/reinicio.
- Operaciones MCP, herramientas de estudio y rutas PDF en Chrome, Edge, Firefox, Brave y Opera.
- Windows/WebView2 real: audio local y cambios de pantalla completa con entrada de puntero; descarga autorizada de 22.015.667 bytes, reutilización sin reescritura, reproducción desde disco y fondo local.

Las mediciones de desplazamiento de `performance-6.9-final.json` pertenecen a Edge sin interfaz con datos sintéticos; no son mediciones del consumo físico de GPU ni una garantía para todo hardware.

El estado y hash del instalador final se registran después de compilar en `APHEKA-release-6.9.0.json` y `release/apheka_FINAL.json`.

## Referencias oficiales consultadas

- [Vasta](https://github.com/ariedotme/vasta): objetos tipados, captura y vistas. Inspiración de interacción, sin copiar código AGPL.
- [Morrow](https://github.com/Aarav2709/Morrow): escritura, lectura y organización editorial.
- [Zuno](https://github.com/noFAYZ/zuno), [Sonora](https://sonorahq.org/) y [Limusic](https://github.com/SimoHypers/limusic): distribución musical, letra y modos de escucha.
- [Aura](https://github.com/antwny/aura): paleta y pausa inteligente adaptadas al interior de APHEKA.
- [Spotify: listas](https://developer.spotify.com/documentation/web-api/concepts/playlists): orden, edición y separación entre canciones y listas; no implica conexión con una cuenta Spotify.
- [Audius](https://docs.audius.co/api/), [LRCLIB](https://github.com/tranxuanthang/lrclib) y [Tauri](https://v2.tauri.app/reference/javascript/api/namespacecore/): contratos y servicios utilizados.

Verificación final: paquete NSIS y fuentes coherentes, nueve vistas y cuatro fondos actuales incrustados; tres herramientas con hash correcto.

SHA-256: `7DF6B55A6A9384FE6EA37E3E0F1477EE73C98E814825A6F3CCFB7F39DDD181BB`. Tamaño: 78898656 bytes.
