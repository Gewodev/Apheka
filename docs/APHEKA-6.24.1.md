# APHEKA 6.24.1

Esta revisión conserva las mejoras de [6.24.0](APHEKA-6.24.0.md) y corrige la continuidad de proveedores, la composición del reproductor y las búsquedas de artistas.

## Charvis

- Se conservan los metadatos opacos de continuidad de Gemini al reconstruir el stream, ejecutar herramientas y guardar el historial cifrado. Se reenvían solamente al proveedor de origen; no se muestran como pensamiento privado ni conceden permisos.
- Las llamadas paralelas sin índice se asocian por su identificador. Los resultados cancelados conservan el nombre de su herramienta. Un fragmento ambiguo se rechaza antes de ejecutar acciones.
- OpenCode usa `/inference/openai/v1/chat/completions` y `/inference/v1/models`, según su documentación actual. La elección automática deja de priorizar Big Pickle y modelos con sufijo `-free`, cuya disponibilidad en clientes externos depende del proveedor.
- El texto parcial se conserva y se guarda al cortar la conexión o detener la consulta, con una etiqueta explícita y sin reintento automático.
- Una acción aplicada recibe la respuesta posterior del modelo. Si esa consulta falla después de aplicar cambios, se conserva una confirmación factual de las acciones completadas, junto con el error original; no se repiten las escrituras.
- El buscador del chat y los proyectos es un componente compartido con icono alineado, texto editable y botón para limpiar, fondo transparente y una sola línea inferior. Se unificó la separación entre encabezado, compositor, pestañas y búsqueda. Se corrigió el fondo heredado del campo interior. Se conservan márgenes adaptables, compositor de proyecto y transiciones breves con respeto a movimiento reducido.
- La agrupación de turnos se memoriza mientras llega texto en directo, evitando analizar repetidamente la misma actividad.

## Tipografía, entrada y contexto

- Manrope variable, subconjunto latino de 24 532 bytes, incluida localmente con su licencia OFL. Sustituye la respuesta serif; no depende de un servidor de fuentes al abrir la app.
- Compositor horizontal: adjuntar, escribir, dictar y enviar; crecimiento limitado a 176 px, scroll interno, respeto a IME y Shift+Enter. El icono web solo permanece en conversaciones vacías; la búsqueda automática sigue respetando la preferencia de Configuración.
- Recuperación léxica local de fragmentos de adjuntos, archivos guardados, materiales del proyecto y contenido del curso que esté seleccionado para él. Máximo 480 000 caracteres examinados por turno, 120 000 por documento y cuatro fragmentos; la lectura restante sigue disponible por ID. No se añade una base vectorial ni se presupone leer un documento entero. Solo se consideran fuentes del chat/proyecto actual.
- Panel de fuentes con cabecera, tipografía y acciones ajustadas; presentación superpuesta en anchos pequeños para evitar comprimir el chat. Proyectos tiene márgenes laterales mayores y adaptables, alineados en título, compositor, búsqueda y listas.
- Gráficas de tareas con anillos gruesos y leyendas compactas. Cinco cursos visibles al inicio; Ver más / Ver menos solo amplía esa lista. No filtra las tareas.

## Música

- Se corrigieron los espacios acumulados entre encabezado, búsqueda interna y catálogo; el encabezado adapta portada, nombre y acción al ancho real de su columna.
- Los botones de guardar y favorito se muestran en una sola fila a la derecha de la portada, separados del texto y sin fondo.
- Dentro de un artista, el buscador aparece debajo del encabezado y filtra sus canciones; al volver, recupera la consulta de artistas. Esta separación funciona tanto en Descubrir como en artistas guardados.
- El catálogo integra canciones del perfil y de la búsqueda por nombre con créditos completos. Incluye colaboraciones, conserva nombres de grupos y elimina duplicados por identificador; no asigna canciones por coincidencias parciales del nombre.
- Se eliminó el corte silencioso tras dos páginas adicionales. El guardado recorre las continuaciones disponibles, cede el control entre bloques y permite cancelar al salir. Los límites de trabajo son 50 páginas o 2000 canciones por operación; si quedan resultados, lo indica y permite continuar. Esto no demuestra que el proveedor publique la discografía completa.
- Al cargar una página fallida, su continuación sigue disponible para reintentar. Una respuesta tardía de un artista anterior no modifica el perfil actual.
- Se mantienen la cola independiente, las canciones de la biblioteca, el bucle por artista/lista y las portadas personalizadas o en mosaico.

## Comprobación

- TypeScript y compilación de producción registrados en `release/build-6.24.1.log`.
- 37 pruebas nativas correctas, ninguna fallida y una consulta de Internet omitida por defecto.
- Prueba específica de firmas exactas de Gemini, historial cifrado, aislamiento al cambiar de proveedor, confirmación tras escritura, fallo posterior sin duplicar cambios y cancelación sin escritura.
- Contratos de transporte: reintento único ante parámetro rechazado explícitamente, sin reintentar autenticación, audio idéntico byte por byte y cierre de llamadas pendientes.
- Navegador: proyectos, chat libre, títulos, fuentes por consulta, buscador sin fondo y sin doble borde, texto en directo e instrucciones del proyecto.
- Navegador: búsqueda interna de artista y retorno a su listado, colaboraciones, artistas anclados, cola conservada, bucle y listas con mosaico/portada. Controles de tarea revisados a 420, 620 y 1366 px.

Las respuestas de IA, ASR y catálogo de estas comprobaciones utilizan transportes controlados. No se ha verificado una cuenta real de cada proveedor. No se garantiza ausencia universal de HTTP 400, disponibilidad de todas las grabaciones ni rendimiento idéntico en cualquier equipo.

Referencias: [compatibilidad de Gemini](https://aistudio.google.com/docs/openai), [modelos y formatos de OpenCode](https://opencode.ai/v2/docs/console/models/), [interfaz abierta de assistant-ui](https://www.assistant-ui.com/examples/claude), [organización de proyectos de Open WebUI](https://docs.openwebui.com/features/chat-conversations/chat-features/conversation-organization/), [composición de conversación de AI Elements](https://elements.ai-sdk.dev/components/conversation).

## Entrega

El instalador final y su versión, tamaño, integridad y recursos incorporados se registran en `release/apheka_FINAL.json`. El informe de esta revisión está en `docs/APHEKA-release-6.24.1.json` y las capturas en `release/qa-624-gallery.html`.

## Instalador verificado

APHEKA 6.24.1, 80,505,622 bytes. SHA-256: `898B1F9966D1F7E73D8650E87067FE2D91B7D84A1398E7CC54B4676007DA93CB`. Compilación y empaquetado terminados en `2026-11-04T19:28:25.9170074Z`. Identidad, versión, recursos del frontend e integridad comprobados por el empaquetador.
