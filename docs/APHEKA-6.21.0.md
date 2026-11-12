# APHEKA 6.21.0

## Reproducción y cola

Elegir una canción de Descubrir conserva la cola que estaba en uso: su orden, canciones, filtro y edición manual. Al terminar esa canción, se reproduce la siguiente de la cola conservada. No se crea una lista predeterminada ni se sustituye por resultados de Descubrir. Los resultados escuchados siguen siendo vistas previas hasta guardarlos explícitamente.

Mis canciones incorpora En línea además de Sin conexión. El contexto de reproducción respeta disponibilidad, artista y favoritas; la búsqueda textual permite localizar una canción sin reconstruir la cola al borrar el texto. Cambiar un filtro explícitamente ajusta su contexto; abrir una vista o pausar la canción actual conserva la cola. La cola agotada termina con bucle desactivado y recorre toda su colección al activar el bucle.

La cola muestra hasta cinco canciones. Permite arrastrar con ratón o tacto, usar teclado y mover la quinta canción por debajo del tramo visible cuando quedan más canciones. Alt+flechas mueve una posición; también se admite el manejo por teclado del arrastre. Se conserva la edición al cerrar y reabrir. Se mantiene el comportamiento de biblioteca por día, última canción y progreso de 6.20.

## Tareas y notas

- Lista compacta, sin borde de urgencia alrededor de cada fila. Se conserva la etiqueta de urgencia y un único control cuadrado de 32 px para recorrer los estados.
- Tablero con arrastre de la tarjeta completa, umbral de movimiento, respuesta de color y clic para abrir. Se retiran los tres botones de estado y el desplegable de explicaciones de cada tarjeta. Alt+flechas izquierda/derecha permite cambiar de estado con teclado.
- Matriz con cuatro superficies de color semántico y alturas iguales entre cuadrantes de la misma fila. Se eliminan Cómo se calcula y Por qué. Cada tarea tiene un solo control de estado.
- Resumen lateral con gráficas circulares SVG por cursos y estados, con sus leyendas. No requieren una biblioteca adicional de gráficas ni animación continua.
- Selector ponderado con tarjeta coloreada y centrada. La propia tarjeta abre la tarea; se elimina la flecha adicional y el icono de Ir al curso. Se mantienen las acciones de otra opción y empezar sesión.
- Al crear una tarea, la sugerencia de dividir en subtareas aparece solo por encima de 120 minutos. La zona inferior del detalle contiene únicamente Pomodoro y Cronómetro; utiliza la duración guardada.
- Notas conserva la geometría de altura natural y sus vínculos, con borde de un píxel más discreto.

## Sesiones de Cursos

Se recupera la estructura de la referencia del usuario: encabezado compacto con fecha y curso, título, hora con incrementos y duración en una misma fila, valores rápidos de minutos, intensidad mediante diez bloques de color, repetición y vínculo con agrupación/tema. Se conservan los valores y el guardado de edición. La vista previa mantiene sus bloques, ajustando espaciado, superficies y distribución en ventanas pequeñas.

## Vista previa ampliada

La ficha de sesión tiene mayor altura, tres métricas claras (intensidad, horario y duración), estado, avance real, contenido vinculado y materiales del tema. El tiempo suma los bloques productivos de la sesión y, cuando corresponde, el temporizador vinculado. Los descansos y distracciones no cuentan. Las sesiones repetidas muestran tiempo acumulado sin comparar varias ocurrencias con una sola meta.

La ficha explica por qué una sesión pasada no permite iniciar y ofrece Reprogramar. Una sesión ya vinculada permite continuar. Se preservan edición, finalización, confirmación de eliminación, vínculos a agrupación/tema y temas recientes. Encabezado y acciones permanecen accesibles cuando el contenido necesita desplazarse. La entrada dura 180 ms mediante opacidad y desplazamiento; no hay animaciones infinitas ni desenfoque del fondo y se respeta movimiento reducido.

Se corrigió además el reconocimiento de duplicados de estudio: un descanso que se solape con un bloque productivo no puede sustituirlo ni impedir su registro.

## Rendimiento musical

La letra lateral deja de actualizar su reloj mientras está abierta la vista ampliada. El reloj comunica únicamente los cambios de verso. La geometría del primer verso ya no dispara reajustes por cambios de peso tipográfico; el desplazamiento entre versos conserva su suavidad y respeta movimiento reducido. La vista ampliada usa márgenes desvanecidos mediante máscara, sin imagen grande desenfocada, inclinación por cursor ni animación ambiental permanente.

La consulta principal puede mostrar resultados antes de esperar el complemento secundario. Una página principal completa evita la petición secundaria. Se mantienen cancelación, caché, validación de identidad y restricciones concretas de grabación. Inicio muestra `coverUrl` además de portadas locales, con carga diferida de las imágenes.

La medición controlada de cinco segundos con 24 canciones y la misma portada pasó de 45 a 25 lecturas del reloj de YouTube. En esa vista se pasó de una imagen con desenfoque y una animación activa a cero de cada una. Esto describe el trabajo observado en esa prueba; no equivale a un porcentaje global de CPU/GPU ni garantiza igual latencia en cada equipo o proveedor.

## Verificación

Pruebas con perfiles temporales y respuestas de proveedores controladas: arrastre y teclado, quinta canción y límite de cinco, filtros, cola exacta antes/después de Descubrir, siguiente automática, portada en Inicio, bucle, recuperación de reproducción, sincronización y desplazamiento de letras en ambas vistas, reinicio completo conservando canción/progreso/cola manual, tablero, matriz, controles de estudio, umbral de 120 minutos, notas y sesiones de Cursos a 1366/900/420 px.

El manifiesto final se guarda en `release/apheka_FINAL.json`; el informe, en `docs/APHEKA-release-6.21.0.json`. La verificación del instalador comprueba versión, hash, nueve vistas incorporadas y una única copia de yt-dlp, ffmpeg y ffprobe. Los datos personales de la aplicación instalada no se usaron ni modificaron en estas pruebas.
