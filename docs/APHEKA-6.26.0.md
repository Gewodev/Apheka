# APHEKA 6.26.0

Revisión del 6 de noviembre de 2026 sobre `1dd7a9e`. Conserva el identificador `com.owa.studio`, los datos y las conexiones de la instalación anterior. No se han usado claves privadas ni se ha reemplazado la aplicación instalada durante estas comprobaciones.

## Fluidez: causas encontradas y correcciones

El reloj de cabecera ya estaba separado de las páginas. La revisión encontró costes relacionados con el temporizador que sí se propagaban a otros apartados:

- El contador actualiza correctamente los segundos estudiados de una tarea, pero esos objetos nuevos hacían recalcular calendario, cursos, portada de Inicio y el contexto visual de Charvis. Las vistas que no muestran segundos ahora comparan los campos que realmente necesitan; el detalle de tareas conserva la precisión visible en minutos. Los datos originales siguen contando cada segundo.
- Estudio permanecía montado al cambiar de apartado y seguía actualizando su interfaz completa. Su suscripción visual y sus relojes se suspenden mientras está oculto; el temporizador global, la finalización y el guardado continúan.
- El guardado trataba cada segundo de una tarea como un cambio estructural y volvía a serializar notas, cursos y otras colecciones grandes. Se reutiliza su representación estable y se conserva inmediatamente una instantánea diferida del estado más reciente. Se materializa para escribir o cerrar, sin recorrer colecciones grandes en cada actualización de audio. El guardado periódico no se cancela indefinidamente cuando llegan actualizaciones frecuentes.
- El programador de avisos se reinstalaba y revisaba todas las tareas cada segundo porque dependía de esos contadores. Ahora reacciona a cambios relevantes y mantiene su cadencia de un minuto. Respeta fechas locales y excluye sesiones completadas.
- El temporizador emitía sincronización nativa duplicada. Permanece una sola emisión por actualización; los relojes visibles comparten un reloj alineado y se detienen cuando la ventana está oculta.
- El perfil gráfico predeterminado desactivaba la composición directa de Windows sin que el usuario lo eligiera. Se recupera el modo estándar de WebView2; se conservan los perfiles Compatible/Software elegidos explícitamente. No se altera la configuración global del sistema.
- Charvis repintaba y procesaba la respuesta completa en cada fragmento recibido y también al cambiar otros estados visuales. Se agrupan sus actualizaciones a intervalos de 80 ms, se memoriza el bloque en curso y se reutilizan fórmulas en una caché limitada. El texto recibido se conserva inmediatamente para recuperación, aunque el repintado se agrupe.

No se añaden bucles de movimiento al desplazar la página, al mover el cursor ni a la portada ambiental. Se mantiene el desplazamiento por rueda, teclado y paneles, con sus barras ocultas y la excepción de accesibilidad de alto contraste.

### Mediciones y persistencia

En el navegador local, con 200 tareas y 200 sesiones, la versión intermedia anterior a la corrección registraba pausas de 50–55 ms cada segundo en el calendario. Después, en el mismo flujo, el contador avanzó, Inicio mantuvo sus nodos e imágenes y Estudio oculto no registró mutaciones; no hubo tareas largas en los intervalos medidos.

Otra comprobación utilizó 200 tareas, una nota de 1 470 000 caracteres, temporizador y progreso de audio actualizado cada 250 ms. Al cabo de ocho segundos: contador 8 s, tarea 8 s, instantánea de cierre 8 s; IndexedDB ya conservaba el guardado periódico de 4 s. La nota permaneció íntegra. No se observaron tareas largas en ese intervalo. Son muestras acotadas de ejecución, no una garantía de cero pausas en cualquier equipo, archivo o sesión prolongada. No se añadieron pruebas unitarias que simulen rendimiento.

## Planificador y estudio

Se reforma el interior del **Nuevo Evento existente**, sin añadir otro botón. Comparte el selector directo de hora de Nueva sesión, dispone fecha, inicio y duración con una jerarquía compacta y conserva todo el día, repetición, materia, tarea vinculada, colores, materiales y guardado. Se comprueba a 420, 768 y 1366 px sin desbordamiento del diálogo.

Nueva sesión del planificador y la del curso utilizan los mismos controles de hora, duración e intensidad. Las ocho herramientas de estudio tienen un marco más limpio, sin la marca de agua gigante. El resultado muestra aciertos, cuestiones a reforzar y acciones legibles; Terminar vuelve al apartado correspondiente. Los cuestionarios, sus datos y el repaso adaptativo se conservan.

La analítica de Estudio sustituye las cintas superpuestas de Flujo por distribución por curso con cantidades y barras de estado. Corrige la etiqueta de duración por hora y usa las metas configuradas para cada día. Las gráficas de Tareas respetan la opacidad del fondo.

La leyenda circular de cursos incluye **todos los cursos registrados**, también los que tienen cero tareas o solo tareas completadas, además de los cursos presentes en tareas antiguas. Cuenta pendientes, en curso y completadas, conserva sus colores y su capitalización. Muestra cinco filas y permite Ver más/Ver menos debajo. Ni pulsar una fila ni el anillo filtra las tareas; la búsqueda de la lista no altera este resumen global.

## Música

Se corrige la regla heredada que fijaba la imagen de Descubrir a 130 px dentro de un contenedor mayor: tanto el contenedor como la imagen quedan cuadrados, con recorte circular. Se comprueban imágenes panorámicas y perfiles sin portada. El encabezado del artista reserva espacio para imagen, nombre y acciones; el regreso está arriba y el buscador interno debajo.

La pertenencia se basa en los identificadores completos de créditos y conserva las colaboraciones. Las asociaciones antiguas basadas solo en texto se contrastan con metadatos externos. La normalización evita duplicados de la misma grabación por nombre promocional y duración; excluye fragmentos «parte 1/2», versiones ajenas y recuentos bajos cuando la fuente los proporciona. No inventa popularidad cuando falta. Versiones realmente distintas, como una grabación en vivo, no se confunden automáticamente con la de estudio.

Guardar un artista abre una ventana para elegir todas las canciones verificadas o una selección concreta. La selección queda guardada y abrir ese artista no importa después el resto automáticamente. No se crean perfiles de colaboradores al añadir canciones y no se borran archivos de la biblioteca para corregir su asociación a un artista.

Se consultaron correctamente 200 metadatos públicos de Apple para Grupo Frontera y 200 para Morat. El catálogo de Grupo Frontera capturado en la revisión anterior se contrastó con los metadatos actuales: se conservan 97 registros e incluye La Del Proceso con Manuel Turizo. Los nuevos intentos de consulta directa a YouTube tuvieron tiempos agotados/503; se registran como límites de la comprobación y no se presentan como una consulta actual completa exitosa. Las pruebas de reglas incluyen homónimos, colaboradores, duplicados y recuentos bajos con datos controlados.

**Favoritas** establece su propio conjunto de canciones y su cola ponderada, sin seguir el orden de la lista visible. Elegir otra canción del mismo conjunto conserva el orden pendiente, descontando la que se acaba de elegir. Al terminar renueva el ciclo dentro del mismo conjunto. Añadir o quitar una favorita actualiza sus miembros sin reconstruir gratuitamente la cola restante. Se comprobaron doce transiciones y la interacción en la vista real.

Las restricciones de reproducción confirmadas por el proveedor se excluyen de futuras colas; un error de red no marca una grabación como inexistente. Una copia local válida sigue disponible. La disponibilidad externa puede cambiar y no puede garantizarse sin que el proveedor permita reproducirla.

El botón de guardar del reproductor abre una ventana independiente, no una extensión dentro de su tarjeta. El fondo de la portada grande cubre toda la ventana, también con letras; se reutilizan la paleta y la imagen difuminada preparadas en tamaño pequeño, sin desenfoque recalculado en cada fotograma.

**La presentación de las letras se mantiene.** Se reparan secuencias de codificación y, cuando existe texto limpio coincidente de la misma grabación, se corrigen palabras dañadas conservando sus tiempos. Si no hay correspondencia suficiente no se inventa una letra ni una sincronización.

## Charvis

El clic derecho en el icono de IA suspende o reactiva Charvis. Al suspender se cancelan consulta, audio y aprobaciones pendientes y se desmontan sus componentes. El icono queda atenuado para poder reactivarlo. Los chats y proyectos no se borran. Cambiar normalmente de apartado sigue permitiendo que una consulta en curso termine en segundo plano.

**Editar un mensaje permanece en el mismo chat y conserva el identificador del mensaje.** Entrar en edición no modifica el historial. Cancelar restaura el borrador anterior. Al enviar la corrección se sustituyen las respuestas posteriores y se regenera desde ese punto; no se crea un chat con «Edición». Se comprueba la persistencia tras recargar. Las acciones ya realizadas deben comprobarse antes de repetir escrituras.

La recuperación local utiliza BM25, cobertura de términos, proximidad de frases, límites por documento y diversidad de fuentes. Indexa solo los materiales que el chat/proyecto actual proporciona; la caché no amplía ese alcance. Límite de 480 000 caracteres por consulta, 120 000 por documento, cuatro fragmentos y 5 600 caracteres de contexto, con cancelación y cesión del hilo. No se presenta como una búsqueda semántica por embeddings.

Se conservan las conexiones explícitas Conectar/Aplicar, las claves separadas y la recuperación por 429/Retry-After de 6.25.2. Las cuotas y errores reales de cada cuenta siguen existiendo; no se ocultan ni se sustituye el proveedor sin aviso. No se utilizaron cuentas privadas para generación autenticada.

## Fórmulas y DOCX

El chat admite delimitadores LaTeX en línea/bloque, matrices, sistemas, integrales, sumatorios y bloques etiquetados math/latex/tex. Las expresiones se protegen antes de interpretar Markdown y el código literal permanece literal. KaTeX trabaja sin HTML de confianza, con límites de expansión/tamaño; las expresiones no admitidas conservan su texto. Se comprobaron seis familias de fórmulas y entradas inseguras sin ejecutar contenido externo.

Los DOCX son paquetes Office reales con tamaño A4, fuente Calibri, jerarquía de títulos, negrita, código, saltos de línea, viñetas y listas numeradas. Las tablas conservan cuadrícula y anchuras coherentes, completan filas cortas, repiten su cabecera y añaden numeración de página en pie. La vista previa refleja estas capacidades. Las fórmulas Unicode se conservan como texto; no se promete que sean objetos nativos de ecuación de Word. Se validaron todas las partes XML y relaciones de los documentos de prueba.

## Avisos de Windows

La versión instalada incorpora un transporte nativo con botón contextual Ver tarea/Ver evento/Ver sesión/Ir a Estudio según corresponda. La activación restaura la ventana y envía un destino limitado al apartado concreto. Una tarea o sesión abre su detalle y fecha. Cerrar el aviso mediante la X de Windows solo descarta la notificación: no borra la tarea ni el evento.

Se reutiliza la biblioteca WinRT ya presente en dependencias y se ejecuta su envío fuera del hilo de interfaz. La validación nativa rechaza destinos arbitrarios. Se verificaron compilación y validación; no se ha simulado una interacción real con el Centro de notificaciones de la aplicación instalada. La activación corresponde a la aplicación en ejecución; no se incorpora un activador COM para arrancarla desde un aviso antiguo después de cerrar el proceso. Referencia de la biblioteca: [Toast y activación](https://docs.rs/tauri-winrt-notification/0.7.3/tauri_winrt_notification/struct.Toast.html).

## Validación y entrega

- TypeScript sin errores y producción compilada.
- 43 pruebas nativas correctas, 0 fallidas y 1 prueba web omitida.
- Chat: recuperación, renombrado, edición, continuidad de respuesta y guardado.
- Música: geometría real de imágenes, selección de artista, Favoritas, restricciones y portada completa.
- Interacciones de calendario, cierre de prácticas, suspensión de IA, fórmulas y persistencia de datos grandes.
- Diez vistas de producción capturadas sin errores de ejecución ni desbordamiento horizontal. Galería: `release/qa-626-gallery.html`.
- Desplazamiento real con 200 tareas y temporizador: recorrido de 11 476 px de lista, detalle, notas y formulario de evento. No hubo tareas largas de JavaScript; un fotograma aislado de 114 ms en el formulario queda registrado en `release/qa-626-scroll.json`. Estas muestras se tomaron mientras compilaba el ejecutable, no son una prueba exhaustiva de GPU ni de sesiones prolongadas.

Se conservan los cambios ajenos de `extension/*` y `scripts/test-latex.ts`; no se incluyen en el commit de esta revisión. No se hace push.

## Instalador final verificado

`release/APHEKA_6.26.0_Instalador_x64.exe` · 115457350 bytes.

SHA-256: `81227846C74192EE1285C30E2518F834C92C1A6B6A088B89BFE2890888608E72`.

Compilación de producción: 26,29 s. El empaquetado definitivo terminó el 2026-11-06T14:10:11.6775011Z. La versión del ejecutable/instalador, los recursos incrustados y las fuentes estables durante la compilación fueron comprobados por el empaquetador. El alias `release/apheka_FINAL.exe` contiene los mismos bytes. Metadatos: `docs/APHEKA-release-6.26.0.json`.
