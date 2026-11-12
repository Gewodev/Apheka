# APHEKA 6.7.6

Correcciones del 24 de octubre de 2026 (America/Lima). Instalador: `release/apheka_FINAL.exe`.

## Música y recursos

La portada ampliada tenía un lienzo de 1000 × 1000 a 30 fotogramas por segundo, polígonos, desenfoques y capas de transición, incluso sin reproducción. Se eliminó ese renderizado continuo. La portada conserva imagen, color, edición y controles, con un fondo estático de desenfoque menor. La barra inferior ya no aplica un desenfoque de fondo grande y las carátulas de la biblioteca utilizan carga diferida y decodificación asíncrona.

La reproducción local utiliza el elemento de audio normal. No crea un AudioContext ni un analizador de frecuencias. La portada recibe los eventos de progreso del audio sin un intervalo propio; el estado compartido publica el reloj una vez por segundo para evitar que toda la biblioteca y el resto del espacio se redibujen en cada timeupdate. Pausar y buscar una posición conservan actualización inmediata. La consulta del progreso de YouTube pasa de 200 a 1000 ms.

Los binarios no eran ocho procesos activos: eran ocho entradas de archivo empaquetadas. La configuración anterior incluía 652.206.622 bytes de herramientas sin comprimir, con varias copias de ffmpeg y ffprobe. La nueva configuración incluye una copia de cada herramienta: ffmpeg, ffprobe y yt-dlp, 223.349.007 bytes en total. Se evitan 428.857.615 bytes de duplicados (aproximadamente 409 MiB); esto reduce escritura y almacenamiento de la instalación, no equivale a un porcentaje medido de mejora de CPU/GPU.

El arranque ya no copia alias de herramientas, ejecuta comprobaciones de versión ni descarga yt-dlp. La comprobación/reparación solo se inicia mediante el botón de Ajustes → Música, reutiliza una herramienta funcional y serializa las peticiones. Una descarga de reparación usa archivo temporal, límites, verificación y publicación final. La reproducción de música local no necesita ejecutar estos programas. El instalador limpia únicamente las rutas conocidas de duplicados antiguos cuando existe la copia canónica; no elimina música ni recorre la carpeta de datos.

## Cursor y pantalla completa

El cursor de Windows vuelve a ser la opción predeterminada. La preferencia anterior de cursor dibujado no activa automáticamente el nuevo cursor alternativo; se conserva como opción manual en Ajustes → Sistema → Rendimiento y pantalla completa. Desactivado, el movimiento no hace lecturas de estilo ni escrituras en el documento. Activado, agrupa el dibujo por fotograma, evita invalidar todos los estilos al cambiar de control y no intercepta clics.

Se elimina la recuperación nativa por cada movimiento del ratón. La restauración de foco/captura se conserva en las transiciones pertinentes, al reproducir y al cambiar de tamaño. Se mantienen las salidas por Esc/F11, prioridad de diálogos y limpieza de arrastres.

El perfil predeterminado **Compatible con Windows** añade `--disable-direct-composition` solo al proceso de APHEKA, conservando el cursor nativo. No modifica el registro ni las preferencias gráficas del sistema. **Aceleración del sistema** restaura el comportamiento normal de WebView2; **Diagnóstico sin aceleración gráfica** añade `--disable-gpu`, puede aumentar CPU y queda como opción explícita. El cambio de perfil requiere cerrar y abrir la app.

Esta es una mitigación del compositor, no una demostración de que un controlador concreto sea la causa del congelamiento visual. Microsoft considera los argumentos de WebView2 herramientas de diagnóstico que pueden cambiar entre versiones: el perfil es reversible. Se verificó la existencia actual del argumento en Chromium. Referencias: [opciones de WebView2](https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/webview-features-flags), [argumentos gráficos de Chromium](https://chromium.googlesource.com/chromium/src/+/main/ui/gl/gl_switches.cc).

## Complementos de estudio con IA

La entrada principal de Ajustes se centra en la conexión MCP, manteniendo sus funciones:

1. Elegir asistente o IDE, y si se le permite crear/editar.
2. Pulsar **Preparar conexión y copiar prompt**. Activa el servidor y obtiene la ruta real del puente, sin instalar programas ni copiar claves al chat.
3. Pegar las instrucciones en el cliente elegido, completar sus autorizaciones y verificar el acceso. La interfaz muestra **Conexión verificada** solo después de llamadas correctas a describe y overview; activar el servidor no equivale a conectar un cliente.

Hay ocho perfiles de cliente y hasta doce complementos personalizados guardados sin credenciales. Nombre, formato, transporte y preferencias se mantienen entre aperturas. Los detalles técnicos, vista del prompt y exportación quedan plegados. La consulta del estado se limita a una cada cinco segundos mientras el panel está visible. La verificación no se pierde cuando la lista visual de las últimas doce operaciones se renueva.

El prompt de conexión incluye destino y formato documentados, una ruta validada y exclusivamente el argumento --mcp. Rechaza rutas/argumentos ajenos; no acepta configuraciones HTTP completas como entrada. Indica al agente que conserve los ajustes y conexiones existentes y compruebe el acceso antes de confirmarlo. Las claves HTTP solo se copian/exportan expresamente hacia los ajustes privados del cliente.

MCP conserva su catálogo de 21 herramientas y sus operaciones sobre cursos, agrupaciones, temas, materiales, fuentes, etiquetas, carpetas, flashcards, las ocho modalidades de mazos y las técnicas de estudio. También gestiona notas, tareas/subtareas, hábitos, eventos, sesiones planificadas, temporizador y navegación. Se amplían los controles de música con siguiente/anterior/detener y las preferencias de apariencia, fuentes, flotante y audio. Se corrige la pausa MCP: antes solo cambiaba el estado visual; ahora usa el motor de reproducción real, con pausa/reanudación idempotentes. Se conservan solo lectura, aprobaciones de eliminación y persistencia comprobada.

ChatGPT remoto requiere un conector personalizado y un túnel autorizado; el prompt no crea esa autorización. Se volvió a verificar la [guía oficial de Secure MCP Tunnel](https://developers.openai.com/api/docs/guides/secure-mcp-tunnels). Los agentes locales pueden ayudar a combinar la configuración si tienen acceso autorizado a ella. No se reescriben automáticamente archivos de otro cliente.

Como alternativa opcional queda **Traer una respuesta de IA sin conexión**, con apuntes, tareas y tarjetas reales en formato `apheka.study.v1`: revisión antes de guardar, límites, escape de HTML, validación del curso y deduplicación. Este intercambio no se presenta como una conexión MCP. Las acciones que requieren seleccionar archivos, autorizar cuentas externas o manipular archivos fuera de los recursos guardados continúan en la app; no se afirma un control absoluto de todas las operaciones del sistema.

## Tiempo de estudio

Cursos muestra el tiempo reconciliado entre sesiones productivas guardadas y contadores de tareas, sin sumar dos veces el mismo estudio. Se excluyen descansos, distracciones, fechas/duraciones inválidas y valores no finitos. Las sesiones con varios cursos reparten su duración entre identificadores únicos. Los contadores históricos del curso se conservan como respaldo cuando no hay actividad fiable. No se reescriben los registros históricos.

## Validación de esta revisión

- TypeScript y análisis de los formatos de respuesta, límites, escape, deduplicación y reconciliación de tiempo.
- Conexión: activación y copia conjunta, ocho clientes, ruta real, prompt sin claves incluso con transporte HTTP, perfiles guardados, exportación privada, verificación por llamadas reales y cuatro anchos sin desbordamiento. Alternativa opcional: revisión sin escrituras, creación/persistencia de apuntes/tareas/tarjetas, deduplicación y respuestas inválidas.
- Reproducción de WAV local desde IndexedDB durante tres ciclos de pantalla completa, fuente y tiempo continuos, pausa/reanudación. Portada sin canvas y sin creación de AudioContext. Mediante MCP: cola, siguiente, búsqueda, pausa real/repetida, reanudación, anterior y detener; posición exacta al pausar.
- Pantalla completa, salida, foco, prioridad de diálogos, errores de API, limpieza del cursor opcional y de la ventana de vídeo.
- Windows WebView2 real: binario aislado APHEKA QA 6.7.6 con composición compatible, cursor nativo sin capa dibujada, entrada del ratón y clics en pantalla completa con y sin audio local. No se utilizó la instalación personal. Las comprobaciones verifican entrada y configuración de representación; no reproducen ni miden el defecto físico de la capa del cursor del equipo del usuario.
- Diecisiete pruebas Rust de mecanismos nativos/MCP, modos de representación y apertura externa.
- MCP: ocho perfiles en cuatro anchos, copia y preferencias; lectura/creación/edición de herramientas de estudio, fuentes PDF/texto, carpetas, aprobaciones, movimiento, reordenación y persistencia.
- Instalador probado contra archivos y registros desechables: primera instalación, actualización, mantenimiento, eliminación exacta del producto antiguo con /UPDATE, datos y música conservados, herramientas canónicas conservadas, duplicados conocidos eliminados y archivos/productos ajenos intactos.

No se ejecutaron pruebas de carga ni se midió una reducción porcentual de GPU/CPU en la instalación personal. El nuevo instalador no se ejecuta automáticamente sobre esa instalación. Se conserva `com.owa.studio` para mantener sus datos.

La verificación final del instalador se registra en `release/apheka_FINAL.json` y `docs/APHEKA-release-6.7.6.json`.

Verificación final: compilación de producción y paquete NSIS correctos; fuentes comprobadas antes/después, nueve vistas actuales incrustadas, tres entradas de herramientas confirmadas y puente stdio probado.

SHA-256: `2A1C55149EB813B7B3AAF8F020B4949FC6DFD3838A73581F70726B618D8449ED`. Tamaño: 78829939 bytes.

Limpieza adicional: eliminadas seis copias idénticas de herramientas en src-tauri/target/release, comprobando SHA-256 antes de borrar. Se liberaron 446.698.014 bytes y se conservaron las tres copias canónicas; fuentes de compilación, instalador final y datos personales intactos. Registro: release/tool-duplicate-cleanup-6.7.6.json.
