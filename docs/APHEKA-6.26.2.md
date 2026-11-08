# APHEKA 6.26.2

Revisión del 8 de noviembre de 2026 sobre `2c25622`. Conserva el identificador `com.owa.studio`, las conexiones y los archivos personales.

## Artistas y Mis canciones

Guardar o actualizar un artista añade su colección al apartado Artistas. Las canciones nuevas de esa colección no se marcan como guardadas en Mis canciones. Los metadatos de reproducción se comparten para evitar duplicados, pero la pertenencia a la biblioteca es independiente. Guardar una canción individualmente o marcarla como favorita sigue siendo una acción explícita que la incorpora a la biblioteca.

Las canciones que ya estaban guardadas se conservan al actualizar un artista. Una selección manual del catálogo se recuerda por sus identificadores y no se amplía automáticamente. Guardar un artista tampoco ancla sus colaboradores como artistas independientes.

El perfil muestra hasta 24 canciones destacadas verificadas. Se utilizan los recuentos reales disponibles; las canciones con recuento conocido inferior a 10 000 no entran en esa selección inicial. Cuando no hay recuento, se conserva el orden del proveedor, sin inventar popularidad. No se deducen fechas de publicación ni se afirma que todas sean tendencias en tiempo real. El buscador interno consulta otros títulos del artista, incluidas canciones que no aparecen inicialmente.

Se conserva la comprobación de créditos y colaboraciones, la corroboración secundaria de títulos y el rechazo de canciones ajenas, fragmentos y versiones de poca calidad identificables por sus metadatos. La normalización también elimina etiquetas de colaboración entre paréntesis para no duplicar una misma grabación con títulos distintos. Las versiones de duración significativamente diferente pueden seguir siendo grabaciones legítimas diferentes.

La cola del artista admite su colección independiente y conserva su ámbito al reiniciar. Guardar un artista no descarga ni recorre automáticamente decenas de páginas de canciones.

## Corrección de Bruno Mars autorizada por el usuario

La primera apertura de esta actualización retira de Mis canciones los registros antiguos vinculados a Bruno Mars por créditos, identificador de artista o vínculos guardados. Se conservan todas las favoritas, los archivos locales y las canciones descargadas, conforme a la elección explícita del usuario. No se borran audios ni registros de reproducción.

Las canciones con créditos de Bruno Mars conservan su asociación al artista. Una vinculación antigua incorrecta de otro artista no se convierte en una nueva asociación. También se retiran los registros afectados de la cola de Mis canciones, conservando las colas de artistas y las listas independientes.

La corrección se ejecuta una vez por almacén de datos, después de cargar correctamente los metadatos. Guarda en lotes, cede el hilo y registra su finalización después de las escrituras. Si una escritura falla, no da la operación por terminada. Una canción guardada expresamente después de la corrección permanece guardada al reiniciar. No se eliminan de forma indiscriminada canciones de otros artistas cuyo origen antiguo no puede reconstruirse.

## Dependencias y licencias del instalador

Los archivos `asr/LICENSE.txt`, `asr/ONNX-LICENSE.txt` y `asr/NOTICE.txt` son textos de licencia y atribución del dictado local, no programas adicionales. Permanecen en la distribución.

El instalador compara SHA-256 antes de extraer cada uno de los 13 recursos del dictado y los tres componentes de música. Si coinciden con lo que ya está instalado, los reutiliza sin volver a escribirlos, aunque sus fechas sean diferentes. Si falta un archivo o su contenido cambió, lo repone desde el paquete. La generación rechaza recursos ASR inesperados en la carpeta de empaquetado.

La detección existente de WebView2 se conserva: el instalador no lo vuelve a instalar cuando encuentra el entorno requerido. Las pruebas se ejecutan en carpetas aisladas y no modifican la instalación personal.

## Charvis y herramientas

La vista de IA y su contenedor dejan visible la imagen de fondo de la aplicación. En modo imagen, la barra lateral y los paneles principales no añaden una capa opaca ni otro filtro de desenfoque. Los controles de escritura conservan su superficie para seguir siendo legibles.

Los editores de las ocho herramientas de los temas comparten tipografía, márgenes, acciones y ayuda de formato persistente. El nombre conserva sus mayúsculas y minúsculas. La ayuda de Emparejar coincide con el mínimo de dos parejas que acepta el editor. Se conserva el formato de datos y el funcionamiento de la práctica; el diálogo se verifica también a 420 px.

## Verificación

- Pruebas NSIS reales: instalación inicial, reutilización con fechas distintas, reparación de una licencia alterada y recuperación de un recurso ausente. Otra licencia válida permanece intacta; sin tocar la instalación personal.
- La plantilla NSIS generada para el instalador final contiene 16 recursos y los 16 coinciden con una ruta de reutilización verificada: 13 de dictado y tres de música. No quedan archivos de recursos en la ruta de copia incondicional.
- Flujo de artistas con datos controlados: 24 destacadas, colaboraciones válidas, rechazo de duplicados/canciones ajenas/recuentos bajos, guardado y actualización sin incorporar canciones a Mis canciones, guardado individual explícito y persistencia tras recarga.
- Corrección de Bruno Mars con datos aislados: se retiran cuatro registros vinculados, se conservan favorita/local/descargada/otro artista, no se borran metadatos, se limpia la cola de biblioteca y una reincorporación manual posterior persiste.
- Los ocho editores guardan contenido válido y las ocho herramientas se abren sin errores de ejecución. Charvis se revisa con una imagen de fondo y controles de apariencia reales.
- La cola del artista completa 60 transiciones con sus canciones propias; al restaurarla conserva los 24 registros de su ámbito, aunque solo dos estén guardados en Mis canciones.
- Los diez apartados de la compilación de producción se capturan sin errores de ejecución, desbordamiento horizontal del documento ni barras nativas de desplazamiento visibles. Las muestras breves de ejecución no presentan tareas largas de JavaScript; son datos acotados de prueba.

Los catálogos controlados son casos de prueba, no una afirmación sobre las cifras actuales de un artista real. No se utilizan claves privadas. Estas comprobaciones no garantizan disponibilidad de cada proveedor externo ni ausencia universal de latencia. No se añaden pruebas unitarias de rendimiento.

Capturas e informes: `release/qa-6262-gallery.html` y `release/qa-6262-*.json`. Los datos definitivos del instalador verificado se registran en `docs/APHEKA-release-6.26.2.json`.

Compilación completa finalizada correctamente en 12 minutos: frontend 30,38 s y Rust optimizado 7 min 15 s, más empaquetado y verificaciones. Fuentes, recursos y herramientas estables durante el proceso. Archivo: `release/APHEKA_6.26.2_Instalador_x64.exe`, **115 433 509 bytes**, SHA-256 **C030B13AF1F028B963FB7F67A8F28B473DC7014B5C8054D353C2D6420856A201**. La copia coincide con `release/apheka_FINAL.exe` y sus recursos indican 6.26.2.

Las muestras de navegador se tomaron mientras se compilaba; no hubo tareas largas JS en los intervalos revisados, pero el desplazamiento de Ajustes registró un p95 de fotogramas de 123,7 ms. No debe interpretarse como una medición de latencia de la aplicación sin esa carga adicional. No se sustituye la instalación personal ni se hace push durante esta preparación.
