# APHEKA 6.20.0

El instalador final se verifica con `scripts/verify-apheka-620.cjs`. Su versión, tamaño, hash y activos incorporados se registran en `release/apheka_FINAL.json`.

## Tareas y estudio

- Lista con borde completo según urgencia calculada. El cálculo considera plazo local, trabajo pendiente, duración prevista, progreso, subtareas, señales del título y notas, cantidad de archivos, otras tareas activas, meta diaria y sesiones ya reservadas. Los archivos no se abren ni se afirma comprender su contenido.
- Tablero por estados con arrastre y botones para avanzar o retroceder. La vista anterior de calendario migra a Urgencia, con cuatro cuadrantes: importante/urgente, importante/no urgente, no importante/urgente y no importante/no urgente.
- Prioridad alta conserva importancia; baja conserva no importancia; media se evalúa con el plazo y alcance. Las fechas inválidas no producen plazos inventados. Las tareas completadas no generan presión de trabajo.
- Selector animado junto a añadir tarea. La elección ponderada se limita a candidatos cercanos a las primeras prioridades, con razones visibles. Permite abrir tarea, curso o estudio. Respeta movimiento reducido y descarta respuestas que llegan después de cerrar el diálogo.
- Inspector de al menos 500 px cuando hay espacio disponible, duración editable y botones separados para Pomodoro y cronómetro. Un inicio nuevo sincroniza la duración con el temporizador real; una sesión ya iniciada se reanuda sin reemplazar silenciosamente otra sesión.

## Notas

Las tarjetas usan altura natural, borde visible y geometría que evita superposiciones con textos y etiquetas de longitud variable. La vista previa permite crear una tarea vinculada al ID real de la nota. El editor guarda primero los cambios pendientes; repetir la acción reutiliza la tarea activa. La sesión de estudio permite volver al apunte de origen.

## Música

- Mis canciones conserva un orden estable durante cada día local y rota al cambiar de día. Buscar, filtrar o reproducir no modifica ese orden dentro del día.
- La última canción seleccionada y su progreso se recuperan al reabrir. El progreso de YouTube se aplica cuando la misma grabación está lista, sin utilizar el tiempo de otra canción ni exigir reproducción automática.
- La cola automática renueva lo que viene después al reiniciar. La cola reordenada o recortada por el usuario y el contexto de una lista conservan su intención y secuencia guardada. Cambiar la cola no sustituye la canción actual. Se eliminan referencias inexistentes y duplicadas.
- Se muestran hasta cinco canciones siguientes, con portada y controles de orden. En aleatorio se muestra su estado y se oculta la secuencia. Bucle de canción y de colección mantienen su comportamiento independiente.
- Descubrir admite fragmentos de letra: `letra: caminar junto al mar`, texto entre comillas o búsquedas largas sin coincidencia normal. Se verifican coincidencias en letras realmente devueltas por el proveedor. La consulta tiene límites, cancelación y caché; no se promete identificar letras que el proveedor no ofrece ni corregir cualquier fragmento recordado incorrectamente.
- Los rechazos confirmados de YouTube 100, 101 y 150 se registran por ID exacto y caducan. No se bloquea todo el título o artista por una grabación restringida, ni se confunden errores de red o identificación del reproductor con prohibiciones del propietario. Se mantienen alternativas de la misma canción cuando están disponibles.
- Seguimiento de letras probado al avanzar, retroceder, pausar, cambiar canción, redimensionar y regresar de portada ampliada. El primer verso empieza arriba; los posteriores se desplazan suavemente dentro del área visible. Las fuentes sin tiempos no se presentan como sincronizadas.

## Jev y MCP

Jev queda preparado para sugerir duración y elegir entre las tareas candidatas; no modifica contenido ni inicia acciones de estudio por sí solo. Usa la API oficial TypeSafe por HTTPS y una clave guardada en el Administrador de credenciales de Windows. La conexión solo se marca como comprobada después de una respuesta válida. Hay límite de diez peticiones diarias, una petición simultánea, caché y retorno al cálculo local ante indisponibilidad. Solo se envían metadatos acotados, nunca cuerpos de apuntes, adjuntos o claves en registros.

El usuario todavía no tiene clave. Por tanto, la conexión real con su cuenta de Jev y sus recomendaciones remotas quedan pendientes; no se anuncian como operativas las notificaciones ni análisis remotos de hábitos, música o estadísticas. Jev no es una API ilimitada gratuita. Referencias: [TypeSafe](https://docs.typesafe.ai/introduction), [System One](https://docs.typesafe.ai/api/system-one), [modelos](https://docs.typesafe.ai/models).

MCP incorpora `apheka_task_advice`, de solo lectura, con IDs reales, razones, unidades y paginación. Las operaciones existentes se probaron en un puente aislado, con creación, lectura, edición, aprobaciones de eliminación y persistencia. Esta prueba no sustituye la recarga y comprobación de herramientas de cada cliente externo.

## Validación y límites

Las pruebas utilizan datos sintéticos y perfiles temporales de Edge, sin modificar la biblioteca ni los datos personales instalados. Se comprueban TypeScript, compilación de producción, la decisión nativa de Jev, la matriz y estados de tareas, su relación con notas y temporizadores, ausencia de superposiciones a 900/1440 px, rotación diaria, continuidad musical al cerrar y reabrir el proceso, cola editable, recuperación de reproducción, búsqueda por letra y seguimiento suave. Las respuestas de audio y letras se controlan para reproducir los casos, por lo que no garantizan disponibilidad de todas las grabaciones en Internet.

El instalador conserva `com.owa.studio` y comprueba las nueve vistas incorporadas, sus activos y una sola copia de cada herramienta: yt-dlp, ffmpeg y ffprobe. No instala ni abre la aplicación personal durante la verificación. Un apagado normal se diferencia de una pérdida repentina de energía; no se promete conservar una escritura que el sistema operativo no haya llegado a guardar.
