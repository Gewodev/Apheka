# APHEKA 6.25.2

Revisión del 5 de noviembre de 2026, sobre `1bdbc8a`, que incorpora también los cambios locales de 6.25.1. Conserva el identificador `com.owa.studio` y los datos existentes. No se utilizan claves privadas ni se modifica la aplicación instalada durante la comprobación.

## Proveedores y claves API

La conexión se divide en dos pasos explícitos. **Conectar** guarda la clave únicamente para el proveedor elegido y consulta sus modelos; **Aplicar** persiste el proveedor y el modelo seleccionados y confirma cuál se utilizará en las próximas conversaciones. El modelo en edición permanece como borrador hasta aplicar. La configuración protegida termina de cargarse antes de activar una selección y su guardado se espera explícitamente. La cabecera de Ajustes identifica la conexión en uso.

Se retira la consulta generativa de prueba que antes condicionaba la activación. Un límite 429 en esa prueba podía dejar activo el proveedor anterior. Aplicar ya no consume una consulta ni ejecuta herramientas. Una clave rechazada con 401/403 bloquea la activación de esa conexión hasta corregirla; se conserva el error real y no se cambia silenciosamente a OpenCode. Las rutas permanecen fijas, HTTPS, sin redirecciones, y las claves se guardan en entradas independientes del Administrador de credenciales de Windows.

Se incorpora **OpenRouter · Gratis**, con clave API propia. Su catálogo público no demuestra que una clave esté autorizada: la conexión nativa verifica primero `/api/v1/key` y después consulta los modelos. Solo se ofrecen modelos con sufijo `:free`, precio de entrada/salida cero y soporte de herramientas, además del router `openrouter/free`. La interfaz y la frontera nativa rechazan modelos de pago en esta conexión. Los modelos se actualizan al consultar el catálogo; no se fija un listado que pueda quedar obsoleto. La consulta pública realizada devolvió once modelos gratuitos con herramientas. No se usó una cuenta real para una generación autenticada.

Los diez proveedores disponibles son OpenCode, OpenRouter, OpenAI, Gemini, Anthropic, DeepSeek, Kimi, Mistral, Groq y xAI. Cada uno conserva su propia clave, catálogo y modelo. Guardar una clave o consultar modelos no equivale a comprobar todas las funciones o la disponibilidad de una cuenta.

## HTTP 429

Se conserva la pausa por proveedor y el reintento dentro del mismo chat. Se amplía la interpretación de `Retry-After` para segundos y fechas HTTP, y se respeta también `retryDelay` de Gemini, tomando la espera mayor cuando hay varias indicaciones. Se reconocen los errores de cuota en cuerpos JSON y eventos SSE aunque la respuesta HTTP inicial sea 200. Los errores conservan el código y la espera, sin revelar claves; no se repiten automáticamente consultas generativas ni escrituras confirmadas.

Las cuotas del servicio externo no desaparecen. Una cuenta sin cuota, saldo o disponibilidad puede seguir devolviendo errores reales; la aplicación informa y espera en lugar de encadenar solicitudes. La opción gratuita también tiene límites.

## Artistas y colaboraciones

Se reprodujo el caso de Grupo Frontera: la vista pequeña y la primera página de búsqueda solo aportaban ocho canciones al perfil. El catálogo sí devolvía «La Del Proceso» con los identificadores de Grupo Frontera y Manuel Turizo cuando se buscaba directamente.

El perfil ahora lee la lista completa de canciones enlazada por el propio artista, combina sus resultados con la búsqueda y mantiene la continuación de páginas. Se conservan los créditos completos, la comprobación de pertenencia y el rechazo de versiones ajenas. Las continuaciones reutilizadas son idempotentes y tienen caché acotada. La comprobación real devolvió **98 canciones**, incluida la colaboración indicada.

Al abrir un artista guardado se recupera su catálogo y se incorporan las canciones que faltan, por bloques de veinte y con cesión del hilo. Se actualizan los identificadores de créditos de grabaciones ya presentes, se conservan archivos y vínculos manuales y no se crean perfiles de colaboradores automáticamente. Si faltan páginas queda «Cargar más canciones»; las cancelaciones y errores mantienen el contenido ya guardado. El catálogo del artista se reutiliza durante cinco minutos. No se promete una discografía exhaustiva: la cobertura depende de las fuentes disponibles.

Las imágenes de perfil tienen contenedor cuadrado y recorte circular. La imagen remota se posiciona dentro de ese contenedor para que sus dimensiones intrínsecas no lo conviertan en un óvalo. Se comprobaron imágenes panorámicas y perfiles sin portada.

## Desplazamiento, transparencia y acabado

Se ocultan las barras visuales de desplazamiento en todas las superficies de la app, incluidos paneles y desplegables. Se conserva el desplazamiento nativo con rueda, panel táctil y teclado, sin introducir motores JavaScript de desplazamiento. El modo de alto contraste del sistema mantiene sus controles de accesibilidad.

Charvis usa la opacidad configurada cuando hay fondo de la app. El chat, el historial, el compositor, los proyectos y el panel de documentos/fuentes comparten esa transparencia; se difumina una capa del espacio de trabajo, evitando aplicar filtros a cada mensaje. Los diálogos mantienen sus superficies legibles. Las transiciones breves de selección y paneles respetan movimiento reducido. Ajustes organiza los proveedores en cinco columnas en ventanas amplias y adapta la cuadrícula al ancho disponible.

Se conservan el dictado local corregido, la barra de voz horizontal, la persistencia del historial comprimido y el nuevo diseño del instalador de 6.25.1. Los recursos gráficos del instalador se regeneran desde la versión actual antes de compilar.

## Comprobaciones

- TypeScript correcto y 41 pruebas nativas aprobadas, cero fallidas, una consulta externa omitida. El ejecutable optimizado 6.25.2 volvió a transcribir la muestra pública española usando una ruta extendida de Windows. El guion generado del instalador contiene todos los recursos de voz y las tres herramientas multimedia.
- Conectar y Aplicar probados para los diez proveedores con credenciales ficticias: sin consulta de prueba, persistencia al recargar, envío del chat al proveedor aplicado, aplicación de una conexión guardada ante cuota y bloqueo de claves rechazadas/modelos de pago.
- Recuperación del chat, renombrado, fuentes bloqueadas y pausa 429 sin duplicar consultas comprobados con los módulos reales y respuestas controladas.
- Catálogo público real de Grupo Frontera y actualización desde la interfaz de artista guardado comprobados; 98 canciones y colaboración con Manuel Turizo, sin crear el perfil del colaborador.
- Círculos cuadrados incluso con imágenes panorámicas, barras ocultas y opacidad 0,55 con difuminado de 10 px comprobados en navegador.
- Diez vistas compiladas capturadas sin errores de ejecución, desbordamientos horizontales ni barras de desplazamiento visibles en sus paneles. La muestra breve de inactividad no registró tareas largas; no constituye una garantía de consumo para cualquier biblioteca o equipo.

Las capturas usan datos aislados y algunas imágenes de prueba para forzar proporciones difíciles. Los catálogos públicos se consultaron sin cuentas. No se comprobó una generación real con claves privadas de cada proveedor. La revisión visual nativa de la bienvenida del instalador se detuvo por Esc en la sesión anterior y no se repitió sin solicitud específica. Los metadatos finales de esta versión se registran en `docs/APHEKA-release-6.25.2.json` y la galería en `release/qa-6252-gallery.html`.

Se preservan los cambios ajenos de `extension/*` y `scripts/test-latex.ts`. No se hace push.

## Fuentes de integración

- [Router gratuito oficial de OpenRouter](https://openrouter.ai/docs/guides/routing/routers/free-router).
- [Claves, cuotas y límites de OpenRouter](https://openrouter.ai/docs/api_reference/limits).
- [Endpoint de chat de OpenRouter](https://openrouter.ai/docs/api/api-reference/chat/send-chat-completion-request).
- [Límites de Gemini](https://ai.google.dev/gemini-api/docs/rate-limits).
- [Créditos de La Del Proceso en Apple Music](https://music.apple.com/us/song/1840991983).
- [Logotipo publicado por OpenRouterTeam](https://github.com/OpenRouterTeam/sign-in-with-openrouter/blob/main/public/openrouter-logo.svg).

Instalador final verificado: **6.25.2**, **115436154 bytes**. Archivo de entrega: `release/APHEKA_6.25.2_Instalador_x64.exe`. SHA-256: `D6E5B48905FB3996E1E39179D294DF75C7374649DA45BDBF7927E07B934EEFFB`. La compilación comprobó la integridad de fuentes, herramientas y recursos incrustados.
