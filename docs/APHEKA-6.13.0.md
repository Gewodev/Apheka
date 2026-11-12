# APHEKA 6.13.0

Estado: instalador final 6.13.0 compilado y verificado. Archivo: `release/apheka_FINAL.exe`. Tamaño: 79269373 bytes. SHA-256: `392CA634C52FFBAAFEAEC2B6D794BD134689B2EFDFA95820899D14971E5C86C0`. Incluye las nueve vistas actuales, el SDK musical corregido y una copia de cada una de las tres herramientas.

- Panel musical con portada compacta y letra activa centrada en el espacio visible, incluso al desplegar la barra inferior. Márgenes uniformes y variaciones suaves de color derivadas de cada canción.
- Ocultar y recuperar letras por canción cuando no están disponibles. La cola ocupa su lugar sin duplicar paneles.
- Descargas con una lista unificada, filtros de actividad e historial, limpieza que conserva trabajos activos, cancelación y reintentos. Carpeta, formato, calidad y portada agrupados en Guardar audio.
- Listas con portadas y búsqueda. Menú de canciones compartido entre Biblioteca y Listas, edición sin renombrar el archivo de audio, controles con márgenes verificados en vista de portadas.
- Navegación fija plana, apuntes con herramientas que conservan la selección y tipografía de escritura más cómoda.
- Inicio muestra un destacado y un próximo evento; cinco sin destacado. Avisos unificados arriba, con color según su tipo.

Verificación: tipos de frontend; reproducción local, centrado de primera/intermedia/última línea, cambio de tamaño, ocultación persistente de letras; flujo de descargas y cola con un trabajador; edición local/YouTube/Audius desde listas; reordenación y búsqueda; apuntes y navegación inmediata; revisión visual clara y oscura. No se incorpora transcripción de voz, por indicación del usuario. No se instalará sobre los datos personales durante la revisión.

Optimización adicional: tarjetas de notas fuera de pantalla sin trabajo de pintado, conservando el arrastre; selección de canciones con conjuntos en un recorrido en vez de búsquedas repetidas; consultas HTTPS limitadas a cuatro activas y ocho pendientes, con cancelación nativa. El proxy elegido se aplica también a los enlaces y descargas. No se envían cookies ni cabeceras de autorización por el puente de catálogo público. Se retiraron los conversores públicos antiguos y la clave de API incrustada en el frontend. Los metadatos de enlaces se reutilizan diez minutos y las consultas simultáneas idénticas se agrupan. Las búsquedas se limpian automáticamente al modificarlas o guardar su selección.

Binarios: eliminadas dos copias idénticas de FFmpeg y FFprobe del proyecto (205.508.608 bytes); conservadas las tres herramientas canónicas. El instalador verifica SHA-256 y no reemplaza herramientas válidas por diferencias de fecha. Una herramienta reparada de AppData se conserva como alternativa de ejecución. No se tocaron canciones ni archivos personales.

Rendimiento medido en producción con 120 tareas, 180 notas y 24 cursos: percentil 95 de tiempo entre fotogramas en Notas de 48,5 ms a 14 ms. Muestra aislada de navegador, con compresión del instalador activa durante la medición final; no es una medición de GPU física ni una garantía universal. Ver `performance-6.13-before.json` y `performance-6.13-final.json`.
