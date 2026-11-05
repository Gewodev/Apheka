# APHEKA 6.25.0

Esta revisión parte de `6b4aa7b` (6.24.1). Conserva el identificador `com.owa.studio` y los datos existentes. El instalador final y su SHA-256 se registran en `release/apheka_FINAL.json` al terminar el empaquetado.

## Charvis

- Las páginas que no se pueden leer se devuelven como `unavailable`, sin atribuirles texto ni convertir el extracto de búsqueda en una lectura completa. Ese resultado se conserva durante dos minutos para evitar repeticiones inmediatas.
- La búsqueda prioriza pertinencia, fuentes institucionales y diversidad de dominios. Wikipedia continúa excluida. Cada turno tiene un presupuesto de tres búsquedas y seis lecturas, con reutilización de resultados idénticos y un límite global de tres minutos.
- HTTP 429 conserva el error real del proveedor y respeta `Retry-After` en segundos; si falta, aplica una pausa de 30 segundos. La interfaz permite reintentar la consulta en el mismo chat. El historial conserva mensajes y resultados; las escrituras confirmadas con los mismos argumentos se reutilizan al continuar, sin ejecutarlas de nuevo.
- Se elimina la consulta adicional al modelo para generar un título. Se usa el tema local o un encabezado de la respuesta, respetando los títulos manuales. Un chat vacío con un nombre manual ya puede guardarse y recuperarse.
- Los materiales de proyectos que no se han abierto permanecen como referencias. Se recupera su contenido al seleccionar el proyecto o al consultar desde él. El índice puede volver a guardarse sin sobrescribir el contenido de esas referencias.
- «Ver texto» abre el contenido ya leído; no vuelve a solicitar la página. Los estados de actividad distinguen una lectura no disponible de una lectura completada. Los estados de espera cambian con una transición breve y respetan movimiento reducido.
- Los proyectos incorporan más iconos y nombres mayores. El menú de conversaciones es más compacto. Las leyendas de tareas conservan la capitalización escrita por el usuario y los cinco cursos iniciales con Ver más/Ver menos.
- Configuración distingue una clave API guardada de una conexión verificada. Al verificar, cierra la entrada de la clave y muestra proveedor y modelo. La prueba de conexión no ejecuta herramientas y limita su respuesta a 64 tokens.

## Dictado local en español

Se integra **Moonshine Tiny Streaming Spanish**, versión cuantizada `26_08_24`, mediante Moonshine Voice 0.1.5 y su ABI C 30000. No se usa Groq ni OpenAI para transcribir y no hay selector de proveedor de voz. Los recursos se incluyen en el instalador; la grabación no sale del equipo.

El modelo se carga en un proceso auxiliar exclusivamente al transcribir. Se fuerza ejecución ONNX de un hilo y se libera al terminar. Hay una sola transcripción activa, cancelación, límite de tres minutos/18 MB de audio y tiempo máximo de trabajo. La conversión de audio usa el FFmpeg gestionado de la aplicación. Los temporales pertenecen a una carpeta UUID creada para cada operación y se retiran al finalizar.

El código verifica SHA-256 de DLL, modelos y licencias antes de cargar el motor. `scripts/prepare-local-asr.py` permite reconstruir los recursos desde sus fuentes oficiales, con comprobación de integridad. Las DLL y pesos generados están excluidos de Git; el manifiesto sí forma parte del código.

La prueba real con una muestra pública en español de **PolyAI/minds14, es-ES** produjo una transcripción en español. Una muestra de silencio devolvió texto vacío. Son comprobaciones de funcionamiento, no una medición representativa de precisión ni una garantía de reconocimiento perfecto para cualquier micrófono, ruido o acento.

Fuentes: [modelos oficiales de Moonshine](https://github.com/moonshine-ai/moonshine/blob/main/docs/models/available-models.md), [Moonshine Voice 0.1.5](https://pypi.org/project/moonshine-voice/0.1.5/), [ABI oficial](https://github.com/moonshine-ai/moonshine/blob/main/core/moonshine-c-api.h), [licencia ONNX Runtime](https://github.com/microsoft/onnxruntime/blob/main/LICENSE), [muestra pública MINDS-14](https://huggingface.co/datasets/PolyAI/minds14).

## Música

- Se conservan los identificadores de todos los artistas acreditados, incluidas colaboraciones. Se usan antes que la coincidencia de nombres.
- La normalización distingue nombres como **Sous-Sol** y **Sous Sol**. Los artistas homónimos con distintos identificadores de catálogo no se fusionan automáticamente.
- Una consulta acotada de metadatos del catálogo de Apple permite corroborar títulos cuando hay al menos dos coincidencias con el perfil elegido y una identidad sin empate. No se utiliza audio, portadas ni vistas previas de Apple. La caché evita volver a consultar el catálogo en cada página.
- Se descartan coincidencias sin evidencia de pertenencia, versiones ajenas explícitas y resultados con menos de mil reproducciones conocidas que no tienen corroboración adicional. Un recuento ausente sigue siendo desconocido; no se inventa un cero ni se confunde con reproducciones locales del usuario. La popularidad no sustituye la identidad.
- Descubrir artistas dispone de un respaldo acotado con tendencias cuando las preferencias no producen perfiles verificados. Los perfiles tienen portadas circulares grandes y una cuadrícula adaptable de cuatro, tres o dos columnas.
- El regreso al listado se integra en el encabezado del artista; su búsqueda de canciones queda debajo. Los controles evitan ofrecer guardar de nuevo una canción de biblioteca. Las canciones locales no muestran acciones redundantes de descarga.
- El guardado conserva la continuación del catálogo y permite seguir actualizando después de un lote grande. No se eliminan canciones existentes para corregir identidades dudosas.

Referencia: [API oficial de búsqueda y consulta por identificadores de Apple](https://performance-partners.apple.com/search-api).

## Validación y límites

Se completaron TypeScript y la compilación de producción. Las comprobaciones locales de módulos reales verifican identidad y colaboraciones, corroboración de títulos, popularidad conocida/desconocida, caché de páginas bloqueadas, pertinencia, exclusión de Wikipedia, pausa 429, enrutamiento del dictado local, presupuesto de investigación, reutilización de escrituras confirmadas y recuperación diferida de materiales. No son pruebas de rendimiento sintéticas.

Las pruebas de navegador finales pasaron: renombrado de chat vacío tras recargar, reintento sin duplicación, transporte y límites 429, lectura bloqueada en caché, fuentes, instrucciones y aislamiento de proyectos, continuidad Gemini y acciones, dictado, compositor, música y controles de tareas. Se verificaron tamaños de 420, 620, 900, 1366 y 1440 px según el flujo correspondiente. Las diez vistas de producción se capturaron sin errores de ejecución ni desbordamiento horizontal del documento con datos aislados. La galería actual es `release/qa-625-gallery.html`.

Las pruebas nativas finalizaron con **37 correctas, 0 fallidas y 1 omitida**. El ejecutable optimizado transcribió la muestra española real. Se comprobó que todos los archivos del manifiesto de voz, además de FFmpeg, FFprobe y yt-dlp, aparecen en el guion del instalador. El empaquetado recuperó la herramienta NSIS de la caché existente; la copia final pasó la comprobación de versión, SHA-256 y recursos del frontend incrustado.

No se utilizaron claves privadas del usuario para comprobar cuentas reales de todos los proveedores. Los límites, saldo, disponibilidad y errores del servicio externo pueden seguir existiendo; se gestionan y se conservan de forma explícita. Tampoco se promete un catálogo exhaustivo: su cobertura depende de las fuentes disponibles, de los créditos y de la corroboración obtenida. Las canciones ambiguas pueden requerir la asignación manual existente.

Los cambios ajenos en `extension/*`, `scripts/test-latex.ts` y otros archivos previos se mantienen. No se hace push. Los registros de compilación, empaquetado y pruebas se conservan en `release/`. Los metadatos definitivos están en `docs/APHEKA-release-6.25.0.json`.


Instalador final: **6.25.0**, 115408209 bytes. SHA-256: `C8531D90D43DC1A1417A98317188DEEF2C4D4C1643D1CB29CE8727AE9B12A1DD`.
