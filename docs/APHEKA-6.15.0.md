# APHEKA 6.15.0

Estado: instalador final 6.15.0 compilado y verificado. Archivo: `release/apheka_FINAL.exe`. Tamaño: 80242357 bytes. SHA-256: `E33E8BA793DE34DA34CF29FEE67828A270736D79946C9C691FD1F1D1426EF037`. Incluye las nueve vistas actuales, el SDK musical corregido y una copia de cada una de las tres herramientas.

- Notas utiliza una columna de escritura con el mismo ancho útil para título, herramientas y contenido. La lateral se dedica a archivos, enlaces, carpeta y etiquetas. Se elimina “Tipo de documento” del editor. Los botones deshacer/rehacer guardan el estado restaurado y conservan la navegación inmediata.
- La galería de listas usa fichas horizontales compactas: portada de 84 px, título, número de canciones y duración agrupados. Flecha de acceso coherente con la navegación de vuelta. Se conservan edición, búsqueda, reordenación, selección de canciones y sus menús. Las búsquedas de canciones por ID utilizan un mapa compartido.
- Descubrir presenta cinco canciones por página, con búsqueda unificada, sin pestañas de tipo ni bloques separados de artistas/álbumes. Guardar en biblioteca o en una lista conserva su funcionamiento.
- El panel de letras calcula su tamaño con el área real de la página y la barra inferior. Se elimina una altura fija antigua que recortaba el borde y desplazaba el centro visible. Altura máxima de letra lateral: 520 px. Color sólido estable por canción y alto contraste de texto; no hay animación permanente en esta superficie.
- La portada ampliada mantiene el apartado, la búsqueda y sus resultados al abrirse/cerrarse. Su letra usa un tamaño más contenido y sigue el reloj de reproducción al cambiar canciones.
- La selección de letras busca una versión sincronizada incluso si la respuesta exacta inicial tiene únicamente texto. Una caché antigua sin tiempos se revisa de nuevo. Las consultas simultáneas se comparten con cancelación independiente y la caché se limita a cien entradas. Las letras sincronizadas se conservan treinta días y funcionan sin conexión.
- Descargas admite enlaces HTTPS públicos de sitios compatibles con yt-dlp y salida MP3, M4A o vídeo MP4. Calidad de vídeo hasta 720p, 1080p o 4K según la fuente. Las preferencias se reflejan también en Ajustes y se capturan por trabajo. Un vídeo no se incorpora a la biblioteca musical.
- Cada descarga y conversión trabaja en una carpeta temporal aislada. Se comprueba y publica el archivo final sin sobrescribir archivos diferentes; una copia idéntica se reutiliza. Extraer audio no elimina un vídeo existente. Los temporales propios se limpian automáticamente.
- Instalador con imágenes, colores, tipografía y versión coherentes. Mantiene la actualización de APHEKA y la migración de OWA, con conservación de datos y reutilización de las tres herramientas canónicas.

Validación: 26 pruebas nativas; metadatos y descarga real de vídeo MP4 y audio MP3 desde un sitio externo, conservación del vídeo y reutilización de copia idéntica; inspección de códecs H.264/AAC/MP3; actualización y caché persistente de letras; seguimiento, centrado y tamaño en ambos visores con varias canciones; biblioteca, cola y guardado; cinco resultados y paginado de Descubrir; edición de notas, archivos, enlaces, carpeta y etiquetas; deshacer/rehacer; galería y detalle de listas; regresión LaTeX; pruebas aisladas del instalador y de reutilización de herramientas.

Límites: los sitios deben ofrecer un enlace compatible y accesible; no se garantiza soporte universal ni se evitan restricciones del proveedor. La sincronización utiliza marcas reales del proveedor. Si solo existe texto, se presenta como letra sin tiempos, sin inventar sincronización.

Referencias: [LRCLIB](https://lrclib.net/docs), [sitios compatibles con yt-dlp](https://github.com/yt-dlp/yt-dlp/blob/master/supportedsites.md), [vídeo público usado en la prueba](https://www.w3schools.com/html/html5_video.asp). Pruebas con datos aislados, sin instalar sobre datos personales.

