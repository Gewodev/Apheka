# APHEKA 6.22.0

## Tareas y notas

- Tiempo total compacto junto a la hora de entrega. Cada subtarea admite de 1 a 120 minutos, incluso en tareas breves; sus botones inician el temporizador con ese tiempo y su ID real.
- Creación opcional de subtareas desde el formulario, edición de sus minutos y actualización del total. Añadir otra subtarea conserva los tiempos existentes. Más de 120 minutos se reparte en bloques revisables.
- Lista con separación discreta; leyendas de curso/progreso como guiones de color; tablero sin indicador de agarre; detalles del selector de estudio alineados a la izquierda.
- Notas seleccionadas sin franja inferior gruesa y etiquetas del editor con colores consistentes.

## Música y rendimiento

Las consultas de letras tienen dos cupos propios y el catálogo tres. La espera total se limita a 10 y 24 segundos respectivamente, incluida la espera de un cupo. Las conexiones HTTPS se reutilizan durante actividad y se mantiene la cancelación por petición; el proxy sigue respetando la configuración elegida, sin proxies públicos intermedios.

La cola mantiene cinco canciones visibles, con arrastre desde la portada y alternativas de teclado. No se muestra el antiguo icono de agarre. Se verificó el seguimiento suave de versos, búsquedas temporales, primera/última línea y regreso desde la portada ampliada.

La entrada del curso usa opacidad/desplazamiento en lugar de desenfoque de toda la página. El fondo animado se pausa mientras se lee una sesión o Charvis. En un perfil aislado con 150 tareas, abrir la sesión tardó 86 ms y el navegador dedicó aproximadamente 100 ms de trabajo durante 4,5 segundos, sin tareas largas ni animaciones infinitas. Es una medición controlada, no una garantía de temperatura o consumo en cualquier equipo.

## Charvis

Se contrastó el historial local con [el commit de proveedores en GitHub](https://github.com/Gewodev/Apheka/commit/909406f9fe25edc50aec39b771b78755758b0d63). La recuperación usa los contratos actuales de APHEKA en lugar del ejecutor antiguo, conservando IDs, paginación, validación y lectura previa a la edición.

- Panel derecho, chat con Markdown saneado, copia, historial en IndexedDB, atajo configurable (Alt+Q inicial), arrastre de tareas/notas/cursos y adjuntos del elemento seleccionado.
- Texto, imágenes y PDF con texto extraíble (hasta 30 páginas); archivos escaneados no se presentan como leídos. Micrófono o audio compartido seleccionables, grabación limitada a tres minutos y transcripción a un borrador antes de enviar. Archivos de audio hasta 20 MB.
- Proveedores recuperados: OpenCode Zen, OpenAI, Gemini, Anthropic, DeepSeek, Kimi, Mistral, Groq y xAI. Los modelos se consultan al proveedor; se permite un ID manual y una prueba real de chat. No se incorporan modelos o créditos ficticios.
- Rutas nativas fijas HTTPS, claves en Windows Credential Manager, dos consultas simultáneas como máximo, cancelación, límites de tamaño/tiempo y de rondas del agente. Las claves antiguas de proveedores se migran al almacén nativo solo tras guardarse correctamente. Los respaldos nuevos excluyen esas claves.
- Cambios revisables con destino y argumentos visibles, respaldo previo y guardado explícito. Las acciones muestran estados consultada/aplicada/cancelada/error. Detener un turno no deja llamadas incompletas al continuar la conversación.
- Herramientas actuales para cursos, agrupaciones, temas, materiales, técnicas de estudio, notas, tareas/subtareas, hábitos, eventos, sesiones, música y preferencias. Se recuperan consulta/restauración de papelera y eliminación confirmada. La búsqueda de recursos usa el conector Google ya existente y distingue enlaces/extractos de páginas leídas.

Los formatos se contrastaron con la documentación oficial de [OpenAI Chat Completions](https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create), [transcripción OpenAI](https://developers.openai.com/api/reference/resources/audio/subresources/transcriptions/methods/create), [Gemini](https://ai.google.dev/gemini-api/docs/openai), [Anthropic](https://platform.claude.com/docs/en/cli-sdks-libraries/libraries/openai-sdk), [Groq](https://console.groq.com/docs/speech-to-text), [OpenCode](https://opencode.ai/v2/docs/console/models/), [DeepSeek](https://api-docs.deepseek.com/quick_start/agent_integrations/), [Mistral](https://docs.mistral.ai/api) y [xAI](https://docs.x.ai/developers/rest-api-reference/inference). No se promete acceso gratuito: las cuentas, permisos, capacidades del modelo y cuotas dependen del proveedor.

## Validación y límites

TypeScript y compilación de producción, 28 pruebas nativas, pruebas de tareas largas/breves con tiempos individuales, tablero/urgencia, cola con arrastre, seguimiento de letras, vista de sesión y CRUD/seguridad/persistencia MCP. Charvis se probó con respuestas controladas y operaciones reales sobre un espacio aislado: cancelación sin cambios, aprobación, respaldo, edición guardada, historial, transporte de audio y tamaños de 1366/420 px.

No se modificaron bibliotecas ni datos personales de la app instalada. No se dispone de una clave de proveedor para comprobar una conversación o transcripción contra una cuenta real. La verificación de esa cuenta queda en Ajustes → Sistema → Charvis mediante **Probar conexión**; esta entrega no declara conectado un cliente MCP externo por el solo hecho de instalar la app.
