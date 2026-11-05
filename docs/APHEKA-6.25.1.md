# APHEKA 6.25.1

Revisión sobre `1bdbc8a`. Mantiene `com.owa.studio`, los archivos y los datos existentes. El instalador final se verifica por versión, tamaño, SHA-256 y recursos incrustados.

## Instalador personalizado

Se renuevan el panel lateral, el encabezado, la bienvenida y el cierre con el logotipo original de APHEKA, tipografía Segoe UI y una presentación más clara. La imagen anterior todavía decía 6.19.0: ahora los recursos gráficos se regeneran desde la versión del producto antes de cada compilación. El título de ventana y los metadatos del instalador también llevan la versión actual. Se conserva el flujo de actualización que protege los datos.

## Artistas y descubrimiento

La causa de los perfiles diminutos era un selector antiguo que aplicaba el estilo del botón de eliminar a toda la tarjeta. Se limita al botón correcto y se incorpora una cuadrícula adaptable de cuatro, tres o dos columnas. Cada perfil conserva su nombre, imagen circular grande y un sustituto uniforme cuando falta la portada o no carga.

La navegación de regreso ocupa su propia fila sobre el encabezado del artista. El buscador permanece debajo del encabezado. Las canciones siempre reservan el mismo espacio para la portada; una duración desconocida se representa con un guion. Biblioteca, cola e inspector mantienen desplazamiento propio y una composición adaptada a pantallas estrechas.

La búsqueda utiliza las entidades reales de artista del catálogo. Se corrige la lectura de miniaturas y se elimina la condición incorrecta que descartaba artistas sin dos canciones ya coincidentes. La pantalla sin consulta combina un número acotado de preferencias y tendencias disponibles; no inventa popularidad ni mezcla identificadores de homónimos. La validación de pertenencia de canciones se mantiene al abrir y guardar los catálogos.

## Charvis y voz

La barra lateral recuerda su estado comprimido de escritorio sin que una visita a una pantalla pequeña lo sobrescriba. La apertura y el cierre tienen una transición breve y respetan movimiento reducido. El desplazamiento utiliza un estilo fino propio; se mantienen rueda, teclado y modos de accesibilidad. Los proyectos nuevos piden nombre y color y comparten el icono de carpeta.

La grabación, el medidor de sonido, el tiempo, la pausa y el reintento aparecen en la misma horizontal del compositor. El medidor solo actualiza durante la grabación; se conservan el borrador y el audio para reintentar. Los errores nativos de texto ya no se descartan detrás de un mensaje genérico.

Se reprodujo la causa real del fallo de dictado: Windows entregaba una ruta extendida `\\?\`, admitida por Rust, pero incompatible con la apertura del tokenizador en Moonshine. La ruta del modelo se normaliza antes de entrar al motor. El proceso auxiliar informa errores estructurados y acotados. Se mantienen la transcripción local, un hilo de ejecución, los límites, la cancelación y la liberación del motor al terminar.

## Comprobaciones y límites

TypeScript, producción y 37 pruebas nativas correctas, cero fallidas y una consulta externa omitida. Se probaron tarjetas, imágenes ausentes, navegación, desplazamiento, perfil a 900 px, persistencia de la barra, proyecto simple, captura horizontal, conservación del error y reintento con audio real. La prueba nativa completa atravesó WebView2, IPC de Tauri, FFmpeg y Moonshine con una muestra pública española; devolvió texto legible. La ruta extendida se comprobó por separado.

También pasaron las comprobaciones existentes de recuperación de chat, HTTP 429, renombrado, fuentes, proyectos, continuidad y compositor. Se consultó el catálogo público real para Morat, Sous Sol y recomendaciones sin búsqueda. La galería es `release/qa-6251-gallery.html`.

Las consultas externas siguen dependiendo de cobertura, disponibilidad, créditos y límites del servicio; no se promete un catálogo exhaustivo ni ausencia universal de errores. No se utilizaron claves privadas para verificar cuentas reales de todos los proveedores. Las pruebas de voz demuestran funcionamiento con la muestra usada, no precisión perfecta en cualquier entorno. Las capturas usan datos aislados. Los cambios ajenos de extensión y `scripts/test-latex.ts` se preservan; no se hace push.
