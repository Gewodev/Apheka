# APHEKA 6.14.0

Estado: instalador final 6.14.0 compilado y verificado. Archivo: `release/apheka_FINAL.exe`. Tamaño: 80240307 bytes. SHA-256: `5055522ECE5E5820F3A59C469C19D8608B928B9506F75FBC2FDAA77EE968438A`. Incluye las nueve vistas actuales, el SDK musical corregido y una copia de cada una de las tres herramientas.

- Descubrir reproduce la canción recién añadida desde el primer clic. La selección usa el estado actual de la biblioteca y los cambios de canción reutilizan un único reproductor de YouTube.
- El WebView identifica los documentos del reproductor con la identidad de APHEKA. Se respetan volumen, pausa, cambio de canción y errores del proveedor.
- Letras sincronizadas con el reloj real de reproducción. El centrado se recalcula cuando la letra termina de cargar, también al recuperar una canción de caché. El panel deja más altura a la letra bajo una portada compacta; la sala de escucha utiliza un fondo continuo.
- Mis canciones muestra nueve filas o diez portadas por página. La cola conserva toda la biblioteca, incluye nuevas canciones guardadas y permite retirar canciones de la cola actual. El aleatorio utiliza únicamente canciones guardadas.
- El botón de añadir en Descubrir permite guardar en Mis canciones o elegir una lista.
- Las descargas usan la ruta exacta de FFmpeg, incluida su variante canónica con sufijo. La confirmación verifica el archivo final, admite rutas con espacios y tildes y evita notificar dos veces el mismo archivo. El resultado no depende de interpretar el código de salida como si fuera un nombre de archivo.
- Apuntes y Notas comparten KaTeX, ya incluido en las dependencias. Reconocimiento de $…$, $$…$$, \(…\), \[…\] y comandos independientes; fracciones, raíces, matrices, alineaciones, integrales y símbolos matemáticos Unicode. Conversión al cerrar la expresión, al pegar o al salir del apunte. Doble clic permite editar el código conservado. Se mantienen deshacer/rehacer y guardado.
- El texto normal, sus espacios y acentos, los importes y los bloques de código se conservan. Una fórmula incompleta o no admitida permanece como texto. KaTeX cubre notación matemática; no ejecuta documentos TeX completos ni comandos HTML, enlaces o recursos externos.

Pruebas: reproducción de YouTube en WebView2 real con datos QA aislados; descarga nativa real y confirmación de un único archivo; conversión WAV→MP3 con herramientas reales y carpeta Unicode; primer clic en Descubrir; cambios sucesivos y caché de letras; lista y portadas; guardado en biblioteca/lista; reproducción local sin conexión, sala completa, centrado y tamaños de ventana; escritura, pegado, edición y persistencia matemática; regresión de edición normal en Notas y Apuntes; tipos de TypeScript y pruebas de red de Rust.

Se conservan las optimizaciones y ajustes de la versión anterior: avisos superiores, evento destacado más un próximo evento, herramientas reutilizadas mediante sus hashes, tres copias canónicas y consultas cancelables. No se añaden botones de limpieza o recompilación. No se modifica la instalación ni los datos personales durante las pruebas. Transcripción de voz aplazada por indicación del usuario.

Límites comprobables: una grabación puede estar retirada o impedir reproducción incrustada; una letra puede no estar disponible o contener tiempos incorrectos del proveedor. La app informa el fallo y permite reintentar, sin prometer disponibilidad universal ni eludir TLS. El antiguo vídeo público de prueba de yt-dlp ya no estaba disponible; la descarga real pasó con otro vídeo público breve.

Fuentes técnicas: [identidad del reproductor de YouTube](https://developers.google.com/youtube/terms/required-minimum-functionality#embedded-player-api-client-identity), [API de YouTube](https://developers.google.com/youtube/iframe_api_reference), [KaTeX](https://katex.org/docs/supported.html), [ejecución JavaScript de yt-dlp](https://github.com/yt-dlp/yt-dlp/wiki/EJS).

