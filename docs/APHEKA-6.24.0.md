# APHEKA 6.24.0

Fecha: 4 de noviembre de 2026. Base: `971a5d6` (6.23.0). Esta revisión conserva los datos de cursos, tareas, notas y biblioteca.

## Charvis

- Chat y compositor amplios, márgenes pequeños y adaptación a paneles estrechos. Mensajes breves se ajustan al texto. Encabezados sin punto rojo ni icono de proyecto dentro del proyecto. Se elimina el robot/chat flotante; el controlador sigue trabajando al cambiar de apartado.
- Proyectos con compositor completo en la misma vista, selección de materiales, instrucciones propias en Markdown, edición de nombre/icono/color y orden por arrastre. La eliminación exige escribir el nombre y elimina sus chats; conserva los cursos y sus materiales.
- Nuevo chat libre limpia el contexto del proyecto. La creación espera el guardado del chat anterior. Renombrado directo en la cabecera y título sugerido por el modelo al terminar el primer turno, con título local breve como respaldo. Un nombre manual prevalece sobre el guardado automático.
- Búsqueda de chats, archivos y fuentes en una ventana propia. Menú de adjuntos simplificado; recientes desplegables. Enlaces pegados detectados como adjuntos. Se retiran las acciones de citar y el selector pequeño junto al micrófono.
- Actividad agrupada por turno: búsquedas, lecturas, acciones y fuentes reales. Cronómetro y apertura suave, con movimiento reducido. No se generan cadenas de pensamiento privadas ni pasos ficticios. Texto de respuesta recibido progresivamente mediante SSE y canal nativo, con actualizaciones acotadas.
- Panel derecho ampliable por arrastre o teclado. Pestañas de archivos más legibles, fuentes agrupadas por consulta con la más reciente por defecto y separación del contexto de cada conversación. PDF/Markdown/Office mantienen sus lectores y documentos nativos.
- Abrir la carpeta de un archivo crea o reutiliza su copia de trabajo; Descargar abre el guardado independiente. Las copias de trabajo y exportaciones son archivos legibles; el historial y originales de Charvis siguen protegidos en su almacén.
- Nueve proveedores existentes presentados con logotipos SVG locales de Lobe Icons y licencia. Conectar guarda la clave en Windows, consulta los modelos reales de la cuenta, selecciona un candidato y prueba una respuesta antes de activarlo. Las opciones manuales se conservan.
- HTTP 400/422: se conserva el detalle acotado del proveedor con la clave retirada. Se adapta una vez el límite de salida o el modo de streaming únicamente si el proveedor rechaza expresamente ese parámetro. No se reintentan fallos de autenticación, permisos, cobro o una petición con tiempo agotado. Los turnos conservan los resultados de herramientas y los campos de continuidad requeridos por los proveedores compatibles.
- Audio enviado por IPC como base64, evitando una matriz JSON con millones de números. Codificación por fragmentos con cesiones al navegador, límite de tamaño y cancelación. La captura y el medidor siguen activos solo durante la grabación.

## Música

- Mis canciones conserva la cola al elegir otra canción dentro del mismo contexto; el orden diario de la biblioteca no determina la cola. Desactivar aleatorio conserva el orden que estaba trabajando. Al cambiar un filtro se conservan los elementos válidos y los nuevos se incorporan con variedad.
- Artistas muestra perfiles anclados desde el catálogo, no todos los nombres de las canciones locales. Se unifican acentos, mayúsculas y créditos completos de colaboraciones. No se cambia el nombre ni la portada del perfil al asignarle una canción.
- Buscar artistas combina perfiles reales del proveedor con evidencia de varias canciones y semillas de biblioteca/historial. No inventa perfiles usando una portada de canción. El catálogo de un artista combina su página, búsqueda por nombre y hasta dos páginas adicionales, filtrando los créditos completos. No promete discografías exhaustivas ni verificación universal de identidad del proveedor.
- Guardar un artista incorpora sus canciones consultadas a Mis canciones. Guardar una canción no ancla al artista. Canciones omitidas pueden vincularse manualmente a un perfil guardado sin alterar sus metadatos.
- Reproducir un artista mantiene su ámbito y activa bucle; un nuevo ciclo usa las mismas canciones con orden renovado. Se prepara otro ciclo al agotarse el anterior. Las listas conservan el comportamiento de bucle de 6.23.
- Buscador/filtros compactos y acciones del reproductor alineadas junto a la portada. Fondo ampliado de portada con paleta, posición y desenfoque calculados una vez y almacenados en caché; sin un filtro de pantalla completa trabajando durante la reproducción.

## Tareas, notas y guardado

- Controles del panel de tarea dentro de sus bloques en anchos de 420, 620 y 1366 px. Hora editable directamente, manteniendo su ubicación junto a fecha y tiempo. Tiempos personalizados de subtareas se conservan.
- Gráficas de cursos con sus colores actuales, leyenda compacta y acción para mostrar/ocultar la lista; no filtra los cursos al pulsarla.
- Notas sin lectura flotante ni restauración de ese estado antiguo. Volver, formato y estado de guardado comparten la cabecera adaptable. Etiquetas creadas disponibles como fichas con color, junto a las seleccionadas. Se conservan tablas, imágenes y formatos del editor.
- El guardado serializa las colecciones grandes cuando cambian, reutiliza esa representación durante los ticks del temporizador y agrupa escrituras de contadores (5 s en IndexedDB, espejo local hasta cada 10 s). La instantánea en memoria permanece actualizada y el cierre sigue guardando el último estado. Cambios de contenido conservan su guardado con espera de 300 ms.

## Comprobación

- TypeScript sin errores. Compilación frontend y empaquetado registrados en `release/build-6.24.0.log`.
- Pruebas nativas generales: 35 correctas, 0 fallidas y una lectura de Internet omitida por defecto. Revisión final del transporte/artefactos/cifrado: 8 correctas y una omitida.
- Navegador aislado: compositor de proyecto y chat libre, títulos, búsqueda, fuentes por turno, texto en directo, instrucciones de proyecto, conservación de cola, artistas anclados/colaboraciones, bucle, límites del panel, hora y leyenda de cursos.
- Contratos de transporte con simulación local: recuperación de parámetros incompatibles, sin reintento de clave inválida, audio byte por byte, campo de continuidad y cierre de herramientas canceladas.
- Pruebas previas ejecutadas sobre esta revisión: tiempos individuales, notas, búsqueda/guardado de artistas, mosaico/portada de listas y documentos/PDF.

## Límites comprobables

Las respuestas del proveedor, catálogo y ASR de las pruebas usan transportes controlados. No se ha comprobado una cuenta real de IA/ASR ni se ha aportado una clave de Jev. No se garantiza que toda grabación o proveedor esté disponible ni que cualquier laptop esté libre de pausas. Las páginas externas conservan sus restricciones y no se oculta el origen de las consultas para eludir controles. El visor web usa contenido realmente leído y el enlace original; no se incluye un navegador de terceros sin restricciones. Los dibujos se generan en SVG estático seguro; esta revisión no añade ejecución arbitraria de widgets HTML del modelo.

La conexión MCP externa de Codex continúa pendiente de comprobar con `apheka_describe` y `apheka_overview` tras abrir APHEKA con MCP activo y recargar herramientas. Las pruebas del servidor interno no demuestran esa conexión externa.

Referencias contrastadas: [assistant-ui y grupos de herramientas](https://www.assistant-ui.com/docs/tools), [Open Artifacts](https://github.com/13point5/open-artifacts), [continuidad de herramientas DeepSeek](https://api-docs.deepseek.com/guides/thinking_mode/), [compatibilidad OpenAI de Anthropic](https://platform.claude.com/docs/en/cli-sdks-libraries/libraries/openai-sdk), [logotipos Lobe Icons](https://github.com/lobehub/lobe-icons). Se consultó la arquitectura; no se copió el frontend privado de Claude.

## Instalador final

`release/apheka_FINAL.exe`, APHEKA 6.24.0, 80,474,956 bytes. SHA-256: `253DEFC353224098F5B4109E9E947F06827A0784D01A96B126A878A072A3EDF9`. Compilación nativa optimizada de 6 min 03 s y empaquetado NSIS completo. El empaquetador verificó la identidad, versión, recursos del frontend e integridad, sin cambios de fuentes ni herramientas durante la compilación.
