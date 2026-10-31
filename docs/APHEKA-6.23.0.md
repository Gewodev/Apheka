# APHEKA 6.23.0 — Charvis, música y continuidad del espacio de trabajo

Esta revisión amplía el punto de control `c0967ae` (6.22.0). Conserva las vistas y los datos existentes; las comprobaciones de interfaz utilizan perfiles y materiales de prueba aislados.

## Charvis

- Apartado IA debajo de Cursos, historial renombrable, búsqueda de chats, proyectos con color/icono y materiales de cursos seleccionables. El título del chat se edita desde su encabezado.
- La consulta continúa al cambiar de apartado. El chat también se puede abrir como panel flotante desde el robot y con el atajo configurado. No se crea una ventana nativa de vídeo o picture-in-picture.
- Compositor compacto que crece hasta un límite, adjuntos fuera de la burbuja del mensaje, archivos y fuentes recientes, comandos `/`, búsqueda web y controles de audio.
- Copiar y editar los mensajes del usuario. La edición crea una conversación derivada y conserva el historial original. Las citas de una respuesta o de texto seleccionado se presentan en una tarjeta propia.
- Inspector con pestañas de documentos, archivos y fuentes. Markdown se representa como documento, las fórmulas usan KaTeX y las imágenes tienen una vista amplia. Los iconos de archivo son recursos locales originales de Microsoft Fluent.
- DOCX, XLSX y PPTX se leen mediante extracción real de sus partes XML. PDF se extrae por páginas y se representa con un documento/worker reutilizado. Un PDF escaneado no se presenta como leído ni se inventa OCR.
- Generación nativa de DOCX, XLSX, PPTX y figuras SVG con formas/etiquetas. Las tarjetas muestran los archivos reales; permiten exportar y, en escritorio, abrir la ubicación de una copia exportada en Windows.
- Las fuentes guardadas con texto leído se pueden consultar como archivo fechado, sin depender de una nueva descarga. Los materiales permanecen hasta una acción explícita. Al retirar un recurso vinculado se elige entre quitarlo del proyecto o también del curso, con copia de seguridad antes de modificar el curso. Escape actúa sobre el diálogo situado delante.
- Dictado de micrófono o audio compartido: indicador de nivel, pausa/reanudación, cancelación y una solicitud de transcripción al finalizar. La captura se limita en tiempo/tamaño y libera pistas y medidor al detenerse. Un fallo conserva el audio para reintentar.

## Fuentes, permisos y protección

La arquitectura de investigación se estudió a partir de [ALEPH](https://github.com/Mutans1/ALEPH); no se copiaron sus proveedores, claves ni APIs. El flujo local separa búsqueda, lectura efectiva, índice de fuentes y operaciones de APHEKA. Wikipedia y sus subdominios se excluyen de la búsqueda y de la lectura.

Las fuentes conservan URL, dominio, estado de lectura, extracto y límites. El asistente distingue resultados de búsqueda de páginas leídas; las citas enlazan las fuentes devueltas por herramientas. Los documentos se tratan como datos, sin conceder permisos por su contenido.

El nivel de acceso permite consultar, revisar cambios o aplicar las acciones no destructivas disponibles. Las eliminaciones mantienen confirmación. Se leen los elementos y sus IDs antes de modificarlos. No se habilita ejecución arbitraria de comandos, acceso a cuentas externas ni rutas elegidas por el modelo.

Historial, preferencias, caché de investigación, adjuntos, respaldo del asistente y copias privadas de documentos se protegen con DPAPI de la cuenta de Windows. Las credenciales de proveedores utilizan el almacén del sistema. En las pruebas web se usa AES-GCM con una clave no exportable de ese perfil. Los archivos que el usuario exporta son documentos normales y legibles; esta revisión no afirma cifrar toda la base de datos de APHEKA ni todos sus archivos.

## Música

- La cola de trabajo y la última canción/posición se conservan al recargar y al reiniciar. La rotación de Mis canciones es independiente de la cola guardada.
- Una canción de Descubrir interrumpe la reproducción sin sustituir la cola existente. Anterior puede volver a esa grabación aunque no pertenezca a la lista que continúa después.
- Al iniciar una lista se activa su bucle. Cada nuevo ciclo incluye todas sus canciones disponibles, mantiene el ámbito de la lista y evita repetir inmediatamente la última. La reproducción sin conexión conserva su filtro. Las canciones que siguen perteneciendo a una lista pueden reproducirse aunque se hayan retirado de Mis canciones.
- Listas con nombre, cantidad de canciones, portada propia o mosaico de cuatro portadas cuando están disponibles. La portada se recorta y reduce antes de guardarse.
- Descubrir separa Canciones y Artistas. El perfil de artista utiliza su ID de catálogo, muestra sus canciones y permite guardar el artista y las canciones consultadas. Los rangos indican la cantidad efectivamente visible: 9 en lista y 10 en portadas.
- La sala de escucha usa la portada como fondo, combinada con su paleta y una capa estable de contraste. Se mantienen el seguimiento suave de las letras y la cola de cinco elementos.

Los catálogos y sus metadatos no garantizan que todas las grabaciones estén autorizadas para reproducción integrada. YouTube documenta las restricciones de inserción y sus errores en su [referencia oficial del reproductor](https://developers.google.com/youtube/iframe_api_reference). La aplicación conserva las comprobaciones y alternativas existentes; no se promete eliminar restricciones del propietario o de la red.

## Tareas, notas, cursos e Inicio

Se conservan los cambios de 6.22: tablero con arrastre, matriz de urgencia, selector de tarea, tiempos personalizados por subtarea, acceso real a pomodoro/cronómetro, editor de notas compacto y etiquetas con color. La edición del tiempo evita un total menor que el número de subtareas. Las gráficas circulares usan los colores actuales de los cursos y leyendas compactas con guiones.

Inicio abre la sesión de estudio seleccionada, también cuando no existen eventos ordinarios. El planificador reutiliza los índices de fechas y los datos de recurrencia. El panel deja de aplicar desenfoque a toda la pantalla y pausa el movimiento ambiental mientras está abierto.

## Rendimiento

- Carga del chat separada del módulo inicial: aproximadamente 683 KB → 504 KB antes de compresión en esta revisión (la cifra depende del resto del árbol).
- Adjuntos cifrados separados de los índices: guardar otro mensaje reutiliza sus referencias en lugar de volver a serializar y cifrar el mismo PDF o archivo Office. Las escrituras del índice se publican en memoria después de guardarse correctamente; añadir archivos al proyecto se serializa sin sustituir los anteriores.
- Peticiones idénticas compartidas, cachés acotadas, clientes HTTPS reutilizados y límites de concurrencia. La consulta de letras tiene su propio cupo para no esperar a las búsquedas del catálogo. No se inventa ni configura un proxy público externo.
- Las listas largas de tareas omiten el dibujo de las filas fuera de pantalla y las revelan para medir el arrastre; se comprobó reordenar y abrir la última de 150 tareas. En tres muestras posteriores, el percentil 95 de los intervalos entre cuadros fue 44,9 / 9,4 / 9,9 ms; la variación del entorno impide prometer ausencia absoluta de pausas.
- Las vistas previas PDF reutilizan su worker. El medidor de audio solo trabaja durante la grabación y no actualiza el árbol completo de React. Los gráficos de tareas son SVG estático.
- Con 150 tareas y 250 sesiones, la prueba del planificador registró apertura del día en 139 ms y ninguna tarea larga en una muestra de reposo de 2,2 s. Estos resultados corresponden al entorno de prueba, no garantizan temperatura, FPS o latencia idénticos en cualquier equipo o red.

## Validación y límites

- `pnpm run build`: TypeScript y Vite. Permanecen advertencias anteriores sobre agrupación de módulos y `eval` de una dependencia de metadatos de audio; no equivalen a errores de compilación.
- Pruebas nativas: 33 correctas, 0 fallidas y 1 prueba de Internet omitida por defecto. La lectura HTTPS pública se comprobó por separado durante esta sesión.
- Pruebas aisladas de permisos, cancelación de eliminaciones, cifrado, proyectos/materiales, citas, edición sin perder historial, Office/PDF, micrófono simulado, 100 ciclos de listas, artistas, tiempos de subtareas y restauración de la última canción/cola.
- Capturas y comprobaciones de 10 apartados, sin errores de ejecución ni desbordamiento horizontal en los escenarios probados. Los catálogos, las respuestas del modelo y la transcripción de las pruebas usan transportes controlados cuando así se indica.
- No se ha verificado una cuenta real de modelo/transcripción ni se ha suministrado una clave de Jev. La interfaz y el enrutamiento no sustituyen la configuración y autorización del proveedor. No se afirma disponer gratis de un modelo frontier.
- Las vistas de Office muestran el contenido extraído; no reproducen exactamente la paginación de Word, diseños complejos, imágenes incrustadas ni todos los objetos de Office. El generador XLSX no calcula fórmulas ni incluye macros. Los formatos binarios antiguos `.doc`, `.xls` y `.ppt` requieren conversión previa.
- El perfil externo `apheka` ya existe en `~/.codex/config.toml`, con el ejecutable instalado y `--mcp`. No se duplicó. En este cliente no aparecieron herramientas `apheka_describe`/`apheka_overview`: abrir APHEKA con MCP activo y recargar Codex sigue pendiente para comprobar ambas llamadas. Las pruebas internas del servidor no se presentan como prueba de esa conexión externa.
- **Instalador 6.23.0 verificado:** `release/apheka_FINAL.exe`, 80.460.775 bytes. Versión, integridad SHA-256 y recursos del frontend incrustados comprobados por el empaquetado.

Referencias de implementación: [iconos de archivo Microsoft Fluent](https://github.com/microsoft/fluentui/blob/master/packages/react-file-type-icons/README.md), [seguridad de KaTeX](https://github.com/KaTeX/katex/security), [MCP de Codex](https://developers.openai.com/codex/mcp/). Las rutas y las pruebas concretas se registran junto al código de esta revisión.
