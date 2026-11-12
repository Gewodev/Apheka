# APHEKA 6.12.0

Estado: instalador final 6.12.0 compilado y verificado. Archivo: `release/apheka_FINAL.exe`. Tamaño: 79244665 bytes. SHA-256: `FA269A39F19F35F18F05E8F1A5D253F6898DF6692F5246C39D4E215FE3DD8E4A`. Incluye las nueve vistas actuales, el SDK musical corregido y una copia de cada una de las tres herramientas.

## Interfaz y uso

- Encabezados más compactos, tipografía compartida y márgenes reducidos. Tareas, Notas, Planificador y Ajustes no repiten subtítulos genéricos.
- Botones y selectores de vista con contornos y geometría coherentes. Planificador mantiene sus bloques y muestra el periodo sin partirlo en tres líneas.
- Notas y apuntes conservan sus editores; retiradas las opciones para insertar esquemas y diagramas, incluido el menú de bloques. No se borra contenido personal existente.
- Perfil más compacto. Apariencia con muestras de fuentes, opciones del equipo y un único formato de hora.
- Navegación automática al borde o fija, con opción de solo iconos y ampliación desde el logo. Retirado el pequeño logo de apertura de la esquina.
- Sin línea de separación resaltada bajo el banner de cursos.

## Música

- Guardar en Mis canciones es reversible, con Deshacer y opción de quitar el guardado sin borrar el archivo.
- La radio aleatoria se actualiza al cambiar las canciones guardadas y continúa excluyendo las vistas previas de Descubrir.
- Selector de listas compartido: selección múltiple, búsqueda, creación de una lista y Aplicar/Cancelar. Cancelar no modifica las listas.
- Canciones de listas con portada. Descargas con preferencias más claras, historial legible y cancelación existente conservada.
- Reproductor de la columna sin fondo teñido ni marco exterior pesado; portada moderada, título, progreso y controles alineados. Barra inferior neutra, compacta y ocultable. Flecha de apertura formada por líneas, sin pastilla de fondo.
- Letras mediante HTTPS nativo con dos fuentes, búsquedas normalizadas por canción y artista, caché sin conexión y recuperación manual. No se inventan marcas temporales para letras sin sincronización.

Fuentes: [LRCLIB](https://lrclib.net/docs) y [Lyrics.ovh](https://github.com/NTag/lyrics.ovh). Se comprobó la segunda ruta con una consulta real de escritorio. Su disponibilidad y la existencia de letras dependen de los proveedores.

## Verificación

TypeScript, pruebas nativas del transporte, búsqueda, guardado reversible, listas, radio, editor de notas, encabezados, ajustes y reproducción con WAV. Comprobación de las fuentes de letras ante fallo de conexión, artista incorrecto, caché y cancelación. Los datos de prueba están aislados de la instalación personal.

La captura/transcripción de voz queda aplazada a petición del usuario. No se añadieron grabación, cuenta de pago, clave API ni modelos de voz.
