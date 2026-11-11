# APHEKA 6.26.5

Revisión preparada el 11 de noviembre de 2026. Conserva el identificador y los datos de APHEKA. La instalación personal no se sustituye durante estas comprobaciones.

## Contador y cursor

El botón de Estudio y la X comparten un coordinador nativo serializado. Cerrar destruye la ventana y espera a que desaparezca del registro nativo antes de permitir otra creación. Se elimina el flujo que ocultaba una ventana transparente y la falsa confirmación de creación por tiempo agotado. La ventana pequeña usa una superficie opaca y relación de propietario con la principal. La recuperación de foco existente, limitada a 80/320 ms, omite ventanas de contador que se acaban de volver a crear. No hay sondeo por movimiento ni desplazamiento programado del cursor.

Se comprobaron doce ciclos en maximizado/pantalla completa/restaurado y otros doce exclusivamente en pantalla completa; se confirmó ausencia de la ventana anterior, cierre del WebView, recreación con identidad nueva, avance del contador, movimiento de puntero recibido y seis cierres simultáneos idempotentes. Un veto de closeRequested tampoco conserva la ventana. La última serie de pantalla completa registró 62–99 ms (media 75,2 ms), incluyendo automatización e IPC. En la serie general hubo tres comprobaciones positivas de visibilidad nativa; en la última serie el puntero/primer plano estaba fuera de QA y se omitieron las doce comprobaciones físicas. Esto no garantiza el dibujo del cursor de todos los controladores GPU.

## Apuntes, ajustes y comandos

- Los apuntes propios del resumen de curso se presentan como mosaico adaptable, sin título mostrado. El texto, tablas e imágenes ocupan la tarjeta; la vista ampliada abarca la fila completa. El documento guardado se conserva; la vista previa limpia su marcado con el saneador existente y se memoriza por contenido. Se conservan edición, formato, imagen ampliada, permisos, destacados y eliminación.
- Ajustes conserva sus opciones anteriores: siete categorías con descripción, jerarquía de sección e índice local; el índice se oculta al reducir el ancho. La categoría Comandos reúne once acciones reales.
- Ctrl+Mayús+P abre un panel independiente para crear tareas, crear/abrir notas por curso y navegar. El horario se consulta en un panel interno con Ctrl+Mayús+H configurable; el mismo atajo lo oculta. No interfiere con campos de escritura ni otros diálogos. Las imágenes se cargan bajo demanda desde el mismo almacén del horario.
- Nuevo Evento conserva todo el día, duración, fecha, repetición, vínculos y materiales; se reforman superficies, encabezado y controles, sin otro botón duplicado. El detalle lateral ahora atrapa el foco y responde a Escape.

## Sesiones, estadísticas y selección de tareas

El planificador del curso permite asociar una tarea del mismo curso. La vista previa muestra la tarea, entrega o vencimiento y abre su detalle cerrando el panel anterior. La asociación es una referencia de la sesión: no cambia la exclusividad existente de vínculos activos del temporizador ni duplica tiempos entre tarea y sesión. El calendario mensual incluye sesiones con bloques propios y un recuento de elementos ocultos que incluye tareas, eventos y sesiones.

Las estadísticas separan minutos y porcentaje en ejes distintos, evitando recortar duraciones superiores a 100 minutos. Se mejora el resumen de estados, distribución por curso y posición del tirador lateral. Las ocho herramientas comparten un resultado con anillo, distribución real, recuentos y próximos repasos; el panel de herramientas tiene filas más claras y márgenes uniformes. No se inventan métricas ni tendencias.

La elección de tarea mantiene primero urgencia e importancia; usa duración total, avance, subtareas, trabajo restante, metas diarias, plazos y sesiones reservadas. Amplía el conjunto de prioridades cercanas y evita repetir hasta agotar alternativas. La animación termina sin esperar indefinidamente al proveedor; una sugerencia tardía no sustituye un resultado ya mostrado.

## Hábitos y notificaciones

Agua y ejercicio son modos opcionales con metas personales y registro incremental. Deshabilitar archiva sin borrar sus datos. Se conservan el seguimiento semanal y los hábitos anteriores. Los registros de cantidades se acotan a noventa fechas.

El recordatorio es opcional y estima fin de jornada mediante la mediana de actividad local en APHEKA por día de semana, con historial acotado a cuarenta días y escritura como máximo cada cinco minutos. Antes de tener muestra suficiente usa una hora de referencia editable. Trata la actividad antes de las 04:00 como parte de la jornada anterior. Se comprueba una vez por minuto, solo mientras APHEKA está abierta; no observa otras aplicaciones ni predice con certeza el fin del día. Solo avisa si quedan hábitos pendientes y respeta la configuración general de notificaciones.

Los avisos de sesión y descanso incluyen una acción contextual. El cuerpo abre Estudio; solo el botón explícito puede iniciar descanso/sesión, con comprobación de fase y un identificador de un solo uso. Guardar el bloque pendiente reutiliza el flujo existente y no inventa valoraciones. Se elimina el aviso duplicado al terminar un pomodoro. El aviso de hábitos abre el día correspondiente. Cerrar una notificación no elimina tareas o eventos. La activación nativa y sus destinos se verificaron en Rust; la ejecución de las acciones se verificó con el componente real. No se hizo una prueba manual del botón de un aviso de Windows ni se garantiza activación COM después de terminar el proceso.

## Música e importación verificable

Las portadas usan sus metadatos y, si procede, la miniatura del identificador exacto del vídeo, sin sustituir por otra canción. Las recomendaciones parten de canciones guardadas y favoritas; no anclan artistas automáticamente. Se conserva la separación anterior entre artistas, listas y Mis canciones.

Las listas importadas muestran nombre, portada, selección y el número recibido frente al total anunciado. YouTube/YouTube Music reutiliza el extractor existente. Deezer usa su catálogo público; Spotify requiere un token propio con permisos de lectura, usado solo en memoria durante la consulta. No se descargan audios de Spotify/Deezer ni se eluden listas privadas. No se han comprobado credenciales privadas de Spotify.

Los metadatos externos se contrastan con título, todos los créditos y duración antes de asociar una fuente reproducible. Sin coincidencia suficiente se informa y no se agrega una canción distinta. La lectura nativa admite un servicio fijo, no sigue redirecciones, limita tamaño/páginas/tiempo y tiene una sola consulta concurrente. Si faltan elementos, se muestra expresamente. La resolución tiene un presupuesto de consulta y creación explícita. Los registros exclusivos de lista quedan fuera de Mis canciones. Vista previa paginada a 60 filas y lista a 80 reducen nodos; reordenar arrastrando la fila se guarda, con alternativa de teclado y sin icono de agarre.

Contrastes públicos reales de esta revisión:

- Deezer: https://api.deezer.com/playlist/908622995 entregó 50/50 elementos, con título, artista, duración y portada; lectura nativa en 2,608 s. Spotify sin autorización devuelve un estado explícito y los destinos ajenos se rechazan.
- Apple Search API: Grupo Frontera HTTP 200, 198 registros; Morat HTTP 200, 197 registros. Son metadatos de corroboración, no garantía de toda la discografía ni de tendencias en tiempo real. Se conserva la comprobación previa de créditos completos y colaboraciones.
- Documentación de autorización Spotify: https://developer.spotify.com/documentation/web-api/concepts/api-calls y https://developer.spotify.com/documentation/web-api/reference/get-playlists-items.

## Validación y límites

- TypeScript y frontend de producción correctos (37,85 s).
- Rust: 45 pruebas correctas, ninguna fallida, una consulta externa omitida. Controlador de pantalla completa y rutas/recuperación acotada correctos.
- Once flujos de interfaz reales, ocho editores que guardan bloques y ocho prácticas montadas sin errores. Evento revisado a 420/768/1440 px; curso/apuntes con imágenes y tablas, comando de tarea por curso/prioridad, horario, sesión vinculada, mes, hábitos, estadísticas y orden de lista.
- Importación controlada de 70 canciones: paginación, nombre, creación, separación de biblioteca y restauración tras recarga correctas. Acciones de avisos con guardado único y rechazo de identificadores obsoletos correctas. Selección local de tareas, inferencia nocturna y cotejo de créditos comprobados.
- Diez apartados de la versión compilada sin errores de ejecución, desbordamiento horizontal ni barras nativas visibles, con datos ficticios aislados. Muestreo en reposo de 10–15 MiB de heap JS por vista; no es RAM total de WebView2 ni un benchmark del equipo.
- Desplazamiento con 200 tareas, 40 notas y temporizador: 11 476 px recorridos y ningún bloqueo largo JS. Se observó un fotograma aislado de 163 ms en el entorno de compilación concurrente; no se promete latencia nula universal.
- Se preservan los recursos locales y las reglas de reutilización por hash del instalador; no se agregaron paquetes ni se reinstalaron herramientas para probarlos. No se modificaron archivos ni canciones personales.

Informes y capturas locales: `release/qa-6265-ui.json`, `qa-6265-notification-actions.json`, `qa-6265-import-ui.json`, `qa-6265-tools-wallpaper.json`, `qa-6265-scroll.json`, `qa-6265-sections.json`, `qa-6265-native-lifecycle.json`, `qa-6265-fullscreen.json`, `qa-6265-close-retry.json`, `qa-6265-playlist-public.json`, `qa-6265-public-status.json`; galería `release/qa-6265-gallery.html`.

Instalador final `release/APHEKA_6.26.5_Instalador_x64.exe`: 115 462 578 bytes; SHA-256 `00BF642C72D6B139BA18EB6BEF5A7B87044A9155797F2A31EBFD816B47B34148`. Compilación completa: 11 min 21 s; frontend 37,85 s, Rust optimizado 6 min 46 s. Fuentes y recursos estables durante el empaquetado, con versión y copia final verificadas. Metadatos en `docs/APHEKA-release-6.26.5.json`. Cambios ajenos de extension/* y scripts/test-latex.ts conservados; sin push.
