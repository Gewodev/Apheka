# APHEKA 6.27.0

El producto vuelve a llamarse **APHEKA** en la aplicación, el ejecutable y el instalador. Se conservan `com.owa.studio`, las claves internas de actualización, las rutas de datos y las licencias de los recursos: la instalación actual se actualiza en su sitio y no se crea una copia paralela. `POHU` y `POHU` quedan solo como identidades de instalaciones anteriores para reconocerlas, limpiar sus accesos directos exactos y mostrar el aviso de versión.

## Cursor en pantalla completa

- **Causa raíz corregida:** la revisión POUH había cambiado el perfil gráfico por defecto de *Compatibilidad* a *Composición del sistema*. En varios controladores, la ruta de composición directa deja el cursor dibujado congelado en pantalla completa: el puntero se mueve, la imagen del cursor no. El perfil por defecto vuelve a ser **Compatibilidad** (`--disable-direct-composition`), que mantiene la aceleración por GPU. Un perfil guardado explícitamente por el usuario se respeta.
- **Refresco nativo del puntero:** nuevo comando `refresh_workspace_cursor`. Solo pide al control bajo el puntero que vuelva a dibujar su cursor (`WM_SETCURSOR`) y repara el contador de visibilidad cuando el cursor está oculto. No mueve el puntero, no cambia ajustes del sistema ni activa otra aplicación.
- Mientras la ventana está en pantalla completa, en Windows y con el foco en la app, ese refresco se agenda cada 250 ms. Al salir de pantalla completa se detiene. Es el mismo cursor de Windows: **no se dibuja un segundo cursor** ni se interceptan clics.
- El contador emergente (ventana flotante del temporizador) sigue siendo una superficie independiente: el refresco solo actúa cuando el puntero está sobre la ventana principal, así que no interfiere con su arrastre ni con su cierre.

**Límite de validación:** no se realizó una prueba física del cursor en pantalla completa en esta revisión. El cambio de perfil se verifica en el código y en el arranque del proceso; la reparación por refresco se comprobó en compilación y en la ruta nativa. No se sustituyó la instalación personal.

## Reproductor: bucle de una canción

- El modo **Repetir 1** se resuelve de forma explícita y permanente: al terminar una canción el reproductor vuelve a empezar la misma, sin avanzar en la cola ni en el recorrido de visitas. Funciona igual con audio local y con canciones de YouTube.
- Sin la API de YouTube (reproductor de reserva) el bucle se resuelve de forma nativa en el propio vídeo (`loop` + `playlist` del mismo identificador), de modo que la repetición tampoco depende de eventos externos.
- La selección sigue guardada entre reinicios, igual que el resto de preferencias del reproductor. El botón de repetición muestra el «1» activo y su estado real se comprobó en la interfaz.
- Se eliminó un contador interno que ya no se usaba, para que el estado del bucle tenga una sola fuente de verdad.

## Descargas

- El campo para pegar un enlace deja de estar comprimido: campo amplio con icono, botón para limpiar, texto de ayuda y acción principal separada («Analizar enlace» o «Buscar»).
- Al analizar una lista se muestra un **análisis**: número de canciones, artistas distintos, duración total y cuántas son descargables.
- Cada canción analizada tiene su propia acción **Descargar** a la derecha. Antes solo se podía descargar la selección completa.
- El bloque de **Autorización de Spotify** explica con precisión que la consulta normal no necesita clave y que el token propio solo sirve para una lista privada: se usa en esa consulta, no se guarda y no se comparte. Formato y tamaño mejorados.
- El pie con «Crear lista propia», «Guardar en biblioteca» y «Descargar selección» se rehízo con jerarquía clara; guardar usa un distintivo de color y los márgenes del apartado, el filtro y las tarjetas de descarga se ampliaron.

## Artistas

- **Editar artista**: nombre e imagen propios, con vista previa y cambio de archivo. Se conservan el catálogo y las canciones del artista.
- **Quitar canciones**: cada fila tiene su acción para quitar esa canción del artista. Las quitadas se conservan en una lista dentro del propio editor y se pueden **restaurar**; no se borra nada de la biblioteca.
- **Destacadas verificables**: la sección «Destacadas» solo contiene canciones con evidencia: elegidas por ti, presentes en tu biblioteca o verificadas por el catálogo. El resto se muestra aparte, con el motivo («Sin datos verificables»), sin inventar datos ni mezclarlo con las destacadas.

## Apuntes y hábitos

- El mosaico de apuntes del curso ya no incluye el botón «Leer apunte»: la tarjeta se abre al pulsarla y se recuperó ese espacio. El encabezado de la lista conserva el destacado y la fecha.
- El **recordatorio de fin de jornada** de los hábitos es algorítmico y **siempre está activo**: no se muestra ningún interruptor para activarlo. Sigue aprendiendo de la jornada por día de la semana, con la hora de referencia como respaldo.
- Agua y ejercicio se rediseñaron: tarjetas de modo con estado, medidor con el avance real, barra de progreso, meta personal editable y pasos de +1 vaso o +5 minutos. Se conserva el registro por día y las habits archivadas.

## Notificaciones

Un solo planificador de 60 s en `AppContext.tsx` (gate `hydrated`, maestro `notifications` y permiso nativo) cubre los avisos con ventanas explícitas:

| Aviso | Ventana | Función |
| --- | --- | --- |
| Evento, 1 hora antes | 30 min < Δ ≤ 1 h | `notifyEventReminder1h` |
| Evento, 30 minutos antes | 0 < Δ ≤ 30 min | `notifyUpcomingEvent` |
| Sesión de estudio, 10 minutos antes | 0 < Δ ≤ 10 min, solo si no está completada | `notifyStudySessionSoon` |
| Tarea por vencer | 0 < Δ ≤ 24 h | `notifyTaskDueSoon` |
| Tarea vencida | −7 días < Δ < 0 | `notifyTaskOverdue` |
| Sesión completada | al terminar el pomodoro | `notifySessionComplete` |
| Descanso terminado | al agotarse el descanso | `notifyBreakOver` |

Tareas y eventos respetan `event_task`; sesión y descanso respetan `event_pomodoro` y `event_break`, con `breakNotifiedRef` para no repetir el aviso de descanso. El anti-spam tiene dos capas: `canNotifyItem` (clave por elemento y fecha, más caché en memoria) y `claimSharedSlot` sobre `com.owa.studio/notif_slots.json`, de modo que dos ventanas no dupliquen el mismo aviso. `notifyGoalReached`, `notifyStudyReminder` y `notifyAllTasksComplete` existen en el catálogo pero no tienen llamadas: quedan inactivas y documentadas, sin introducir avisos nuevos.

## Controles multimedia de Windows

- Sesión **SMTC** nativa en Rust (`src-tauri/src/media_controls.rs`), creada una sola vez en el hilo de interfaz y conservada durante todo el proceso, para no duplicar manejadores de teclas multimedia.
- Título, artista, álbum (`APHEKA`), estado de reproducción, posición, duración y carátula se envían desde el reproductor general. La carátura viaja solo cuando cambia: `None` = sin cambios, `Some("")` = limpiar, `Some(datos)` = nueva imagen.
- `apply()` escribe solo diferencias; la línea de tiempo se limita a cambios de posición ≥ 0,9 s o de duración ≥ 0,5 s. El primer envío fuerza el refresco completo y `clear()` restablece la sesión.
- Los botones del flyout y las teclas multimedia se reenvían como evento `apheka-media-button` (`play`, `pause`, `stop`, `next`, `previous`) y el reproductor aplica las mismas acciones que sus controles.

## Aviso de actualización

- Cuando hay una versión nueva, el aviso aparece **arriba, en Notificaciones**, con la versión exacta y una acción para aplicarla.
- La comprobación es local y no depende de la red: el instalador deja la marca de la versión que se instaló (`apheka-installed.txt`) y la app la compara con la versión que estí en marcha. Si la instalada es mís nueva, el aviso ofrece **Reiniciar ahora** para usar esa versión.
- También se admite un canal publicado en la carpeta de datos (`update-channel.json` con `version`, `url` y `notes`): si la versión del canal es superior, el aviso ofrece **Descargar**.
- La comprobación se hace al arrancar, cada seis horas y al volver a la ventana, con un lÃ­mite de cinco minutos entre intentos. La misma versión se anuncia **una sola vez**.
- En Ajustes â†’ Sistema â†’ Â«Sobre APHEKAÂ» hay un botón **Buscar actualizaciones** que fuerza la comprobación y deja el resultado en las notificaciones. Si no hay novedades, se responde Â«No hay actualizaciones disponiblesÂ».
- Ninguna comprobación puede romper la app: si falta el archivo, no se puede leer o la versión no se conoce, no se muestra ningún aviso.
## Continuidad de la música

- El flyout native **refleja la canción que está sonando**: se verificó que recibe el título, el artista, el álbum, la carátula, la duración, la posición y si puede avanzar o retroceder, y que cambia al cambiar de canción. La sesión no se limpia mientras haya una canción cargada.
- Al **cerrar y volver a abrir** la aplicación se conservan la canción, su **posición** (no reinicia en 0) y la **cola** completa, con su orden y su lista de reproducción. La cola guardada manda sobre la lista automática del día: el orden manual nunca se reescribe al arrancar.
- **Corrección detectada por la prueba:** la duración conocida de la sesión anterior se perdía al reabrir (el progreso se restauraba, la duración no), de modo que la línea de tiempo y el flyout mostraban 0:00. Ahora la duración restaurada se conserva hasta que el medio real informa la suya, y se descarta en cuanto llega la real para que ninguna canción posterior herede una duración ajena.
- El envío al sistema nativo está serializado: si llega un estado nuevo mientras el anterior está en vuelo, la cola converge en el último y solo se marca como entregado cuando el comando responde, así que un fallo se reintenta en el siguiente ciclo.

**Límite de validación:** no se probó físicamente el flyout de Windows ni las teclas multimedia de hardware en esta revisión. La coherencia del envío y la continuidad tras reiniciar se comprobaron con un puente de escritorio simulado que registra cada llamada nativa.

## Comprobaciones

- TypeScript sin errores; Rust `cargo check` sin avisos; 46 pruebas nativas correctas, 0 fallidas y 2 omitidas (consulta pública real y listas públicas reales).
- Diez flujos de interfaz correctos en el navegador de desarrollo: mosaico de apuntes sin botón redundante y apertura por la tarjeta; hábitos sin interruptor de recordatorio y registro real de agua; campo de descargas legible; bloque de Spotify con el texto nuevo; repetición «1» activa y persistente; perfil de artista con edición, destacado verificable, quitar canción y restaurarla. Sin errores de ejecución.
- Cinco comprobaciones del reproductor con un puente de escritorio simulado que registra cada llamada nativa: el flyout recibe la canción cargada, la cola y la lista sobreviven a un reinicio con su posición, el flyout vuelve a ser coherente tras reabrir (posición ≈ 45 s y sin limpiar la sesión), el cambio de canción actualiza el flyout y la carátula solo viaja cuando cambia. Detectaron y corrigieron la pérdida de la duración restaurada.
- El análisis de una lista real no pudo comprobarse en este entorno: la consulta del catálogo musical no respondió dentro del tiempo previsto. El caso queda registrado como omitido, no como correcto.
- El resto de vistas compiladas sin errores ni desbordamiento horizontal. No se promete latencia cero universal.

## Cinco mejoras futuras propuestas

1. Replanificación semanal con vista previa: repartir el tiempo restante de las tareas en huecos disponibles y descansos, conservando las decisiones manuales.
2. Búsqueda local semántica bajo demanda: ampliar el índice actual con fragmentos y referencias verificables, con límites de memoria y aislamiento entre proyectos.
3. Identidad musical más precisa: contrastar ISRC, créditos y duración, y ofrecer revisión de duplicados antes de cambiar la biblioteca.
4. Diagnóstico de fluidez de 30 segundos: informe local activado por el usuario para identificar una vista lenta sin mantener vigilancia permanente.
5. Historial local de cambios por apartado: recuperar una nota, tarea o planificación concreta sin restaurar toda la aplicación ni duplicar archivos.

## Instalador verificado

`release/apheka_FINAL.exe` · 115485571 bytes · APHEKA 6.27.0.

SHA-256: `EB04CC3890F81FEF1521E5CE6DF5006E12B3B2404B7B724D138623E4A47CB14E`.

Nombre de producto y versión Windows: APHEKA 6.27.0. Fuentes y recursos estables durante la compilación; el ejecutable contiene los recursos actuales del frontend. No se hizo push ni se sustituyó la instalación personal.
