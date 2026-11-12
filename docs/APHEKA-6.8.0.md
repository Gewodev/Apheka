# APHEKA 6.8.0

Versión del 24 de octubre de 2026. Instalador final: `release/apheka_FINAL.exe`.

## Fluidez y composición

Las vistas principales y los paneles se suscriben solo a los campos que utilizan. Las acciones conservan su identidad y ejecutan siempre la implementación actual. En una prueba real de React con StrictMode, 120 cambios del progreso produjeron 240 renderizados en la suscripción completa de control y **cero renderizados adicionales en el panel de notas**; un cambio real de nota sí actualizó ese panel. Evidencia: `selection-performance-6.8.json`.

El fondo usa una sola capa estática suavizada. Los paneles mantienen la transparencia elegida, sin acumular desenfoques de fondo por tarjeta. El escenario de 180 notas pasó de 183 elementos con backdrop-filter a cero. La medición automatizada de desplazamiento es sintética y no mide el porcentaje de GPU ni garantiza una tasa de fotogramas en todos los equipos.

Se conserva el perfil gráfico compatible y el cursor nativo de 6.7.6. El cambio no introduce un visualizador continuo ni un motor adicional de audio. La barra de progreso musical y la sincronización de letras actualizan sus propios componentes.

## Espacio de trabajo

Marcos discretos, superficies planas y bordes suaves en los apartados, con organización existente y logo conservados. El fondo queda recortado al marco para impedir que el foco del editor desplace horizontalmente toda la aplicación. Se mantienen las preferencias de color y opacidad.

Notas tiene navegación de carpetas ajustable y vista previa ampliable; Música tiene un inspector ajustable con letra y herramientas desplegables; Tareas permite ampliar su inspector. Los anchos se guardan y se pueden cambiar con teclado, restablecer con doble clic y adaptar al espacio disponible. La galería añade cuatro paisajes vectoriales locales sin descargar imágenes.

Notas y Apuntes permiten insertar esquemas vectoriales a partir de relaciones `A -> B`, reorganizar nodos y editar el esquema. Hay límites de tamaño y contenido saneado. El esquema se inserta como bloque protegido: el navegador no extrae su primera etiqueta ni mezcla sus rótulos con el párrafo anterior. Se conservan deshacer/rehacer, guardado y sincronización con el editor abierto.

## Música

Descubrir consulta el catálogo público de Audius, con búsqueda, géneros, páginas de 24 resultados, reproducción de colección y favoritos. Guarda referencias y metadatos; no descarga ni convierte audio. Se verificó un GET parcial del servicio real: 206 audio/mpeg. Los resultados excluyen grabaciones no reproducibles o de acceso restringido sin autorización.

Las letras se consultan automáticamente por título, artista y duración en LRCLIB. Admite LRC sincronizado, buscar una línea, seguimiento opcional, letra plana e instrumentales; la caché está limitada a 50 consultas. El botón de reintentar fuerza una nueva consulta. Se muestra el proveedor y se puede desactivar la consulta automática.

Sin conexión se utilizan archivos locales y letras/colecciones previamente guardadas; una colección almacenada no contiene sus audios. El catálogo no equivale a toda la biblioteca comercial de otros servicios, y la disponibilidad de canciones/letras depende de cada proveedor. No se eluden cuentas ni restricciones. Las rutas antiguas de biblioteca, importación y descarga permanecen disponibles.

La reproducción omite pistas online en las colas sin conexión. Los errores de red tienen dos reintentos acotados; los archivos inválidos no entran en una cola que se rellena indefinidamente. Tres pistas fallidas consecutivas detienen la reproducción y muestran un aviso.

## IA

El botón Preparar con IA copia las instrucciones del cliente configurado y del apartado actual. Requiere una conexión MCP real; copiar texto no autoriza ni conecta automáticamente un cliente externo. El conector mantiene sus controles de acceso y añade búsqueda musical, reproducción de IDs verificados y esquemas anexados a notas sin sustituir el contenido previo. Hay 22 herramientas y se conservan los contratos de estudio, materiales, fuentes, agrupaciones y flashcards.

## Instalación y datos

La plantilla de NSIS está fijada a Tauri CLI 2.11.2. En una actualización se propone conservar la instalación y se verifica cada herramienta existente mediante SHA-256. Si coincide con la versión empaquetada, se omite su extracción y escritura, incluso si su fecha difiere. Solo se instala/reemplaza una herramienta ausente o diferente. La comprobación usa una utilidad de Windows y no descarga otro programa.

La prueba con instaladores temporales confirmó que las tres copias válidas mantuvieron sus fechas; al dañar una y retirar otra, se repararon solo esas dos. Se conservan una copia empaquetada por herramienta y el identificador `com.owa.studio`. No se ejecutó el instalador sobre la instalación personal del usuario. La migración de la línea OWA y la conservación de AppData siguen vigentes.

La publicación compara fuentes y binarios antes/después de compilar para impedir un paquete mezclado con ediciones simultáneas.

## Validación

TypeScript, contratos puros, edición/arrastre/persistencia de notas, editor con diagramas, catálogo/letras/búsqueda temporal, 120 actualizaciones aisladas, 8 vistas con menú abierto/cerrado, rejilla de cursos durante 24 transiciones, espacios internos de cursos, reproducción real y tres ciclos de pantalla completa, cola offline, recuperación acotada de audios dañados, CRUD MCP y técnicas de estudio, conexión IA y reutilización de herramientas. Los servicios externos se comprueban con fixtures controlados y una consulta real acotada; no se imprimen letras de terceros.

## Fuentes

- Sonora, proveedores: https://sonorahq.org/docs/providers
- Audius, documentación oficial: https://docs.audius.co/
- LRCLIB, implementación y API: https://github.com/tranxuanthang/lrclib
- Tauri, instaladores Windows: https://v2.tauri.app/distribute/windows-installer/
- NSIS, SetOverwrite: https://nsis.sourceforge.io/Reference/SetOverwrite
Consulta real adicional: Edge cargó 24 resultados de Audius sin caché y reprodujo audio mediante su elemento nativo (posición > 0,1 s, sin error). Se detuvo de inmediato; no se guardaron archivos de audio ni se ejecutaron herramientas de conversión.

Verificación final: paquete NSIS y fuentes coherentes, nueve vistas y cuatro fondos actuales incrustados; tres herramientas con hash correcto.

SHA-256: `0031C385C6956CE8CA18D9F9497BE33EFC7D340DA99B30D12B4272D564089023`. Tamaño: 78865941 bytes.
