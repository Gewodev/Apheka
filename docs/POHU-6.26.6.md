# POHU 6.26.6

Se conserva la aplicación y los datos de APHEKA; POHU es el nuevo nombre del producto y del instalador. La actualización mantiene `com.owa.studio`, la identidad anterior de actualización y las rutas existentes para evitar una instalación paralela y repetir recursos válidos.

## Contador y cursor

- Contador flotante independiente de la ventana principal, sin propietario y sin activación/foco de teclado. Se elimina el foco explícito al crearlo. La capa nativa sigue visible encima y admite arrastre y cierre; la X conserva la destrucción serializada real, con protección al recrearlo y limpieza al cerrar la app.
- Radio de 16 px, recorte nativo y márgenes interiores equilibrados. El cierre tiene su propio espacio. Hover mediante CSS; dígitos y separador memorizados. El reloj pausado no mantiene un intervalo. El reloj activo agenda solo su siguiente segundo y suspende la actualización visual al ocultarse, conservando el temporizador principal.
- Cursor de Windows por defecto. El cursor alternativo solo se crea al activarlo manualmente en pantalla completa; sin elemento DOM, escuchas de movimiento ni dibujo de cursor en el modo normal. No se recupera el cursor al escribir cada letra.
- Composición compatible por defecto cuando no existe una preferencia gráfica guardada: `--disable-direct-composition`, manteniendo renderizado por GPU. Las preferencias explícitas se respetan. El perfil de diagnóstico sin GPU continúa siendo opcional. Cambio local al proceso, sin modificar el registro gráfico de Windows.

La pérdida del cursor descrita es compatible con fallos del compositor en transiciones de pantalla completa. No se da por demostrada una causa específica del controlador del equipo. Referencias primarias: [incidencia Chromium](https://issues.chromium.org/issues/554057759) y [definición del parámetro en Chromium](https://chromium.googlesource.com/chromium/src/+/main/ui/gl/gl_switches.cc). El código de Tauri/Tao instalado traduce `focusable(false)` a `WS_EX_NOACTIVATE` en Windows.

**Límite de validación:** la prueba física de Windows se interrumpió con Escape. No se continuó controlando el ratón o teclado. Esta revisión no certifica físicamente el dibujo del cursor ni el foco en todos los controladores GPU. No se reemplazó la instalación personal. El modo gráfico se aplica al iniciar la versión nueva.

## Música y listas

Anterior/Siguiente utiliza un recorrido propio de visitas, separado del historial de recomendaciones y de la cola. Retroceder conserva las canciones posteriores y permite volver a ellas antes de continuar la cola original. Incluye canciones de artistas fuera de Mis canciones; recorrido limitado a 100 entradas por sentido. La selección explícita de otra canción inicia un nuevo recorrido hacia delante.

Listas de Deezer por API pública y Spotify por [oEmbed público](https://developer.spotify.com/documentation/embeds/reference/oembed) y datos publicados en su vista incrustada. Sin claves privadas, intermediarios de pago, extracción de tokens ni elusión de acceso. Se respeta la configuración de proxy musical del usuario. Spotify puede publicar solo parte del listado: se informa y no se inventa un total. El token propio opcional permanece solo para consultas autorizadas, sin guardarlo. Los enlaces de metadatos de Spotify/Deezer no se envían como descargas de audio. YouTube Music conserva su lector nativo.

La consulta limita concurrencia, páginas, tamaño y tiempo. Diagnóstico visible con fuente, transporte y duración; errores externos no se ocultan. Prueba real: Deezer 50 canciones; Spotify público 50 filas, total desconocido explícito.

## Interfaz e instalación

Ajustes con siete categorías superiores y controles previos conservados; índice lateral solo cuando hay contenido. Once comandos con icono, descripción y atajos propios sin duplicados. Crear/buscar usa diálogos independientes; el horario queda ajustado a su imagen en una ventana compacta interna. Eventos y sesiones mensuales se abren directamente. Nuevo Evento conserva sus controles con el estilo de Nueva sesión y límites comprobados a 420/768/1440 px.

Instalador POHU con palabra dibujada tipográficamente, cabecera/bienvenida/cierre actualizados y versión generada desde la configuración. Las claves internas de actualización siguen siendo las anteriores. Solo se retiran accesos directos antiguos cuando apuntan al ejecutable exacto. Reutilización por SHA-256 de herramientas y recursos ASR, incluidas licencias: no se reinstala un recurso válido por tener otra fecha.

## Comprobaciones

- TypeScript y frontend de producción.
- 46 pruebas nativas correctas; prueba adicional real de servicios públicos correcta. Otra consulta externa permanece omitida.
- Once flujos de UI, incluidos atajo personalizado, alineación de comandos, evento adaptable y clic mensual; diez apartados compilados sin errores de ejecución ni desbordamiento horizontal, barras nativas ocultas.
- Recorrido real de AppProvider/controles: A → B → C → B → A → B → C → D, con ámbito original conservado. Prueba separada de límites y selección nueva.
- Contador real con IPC controlado: pausa sin commits periódicos, hover sin commits, segundos activos, cierre/reintento y aislamiento del arrastre.
- Cursor alternativo manual con fallo de foco inyectado y limpieza; controlador de pantalla completa y recuperación acotada.
- Desplazamiento real con temporizador activo, 200 tareas y 40 notas: rango de tareas 11 476 px; sin tareas largas JS en las muestras. Se observó un fotograma aislado de 140 ms durante la compilación. No se promete latencia cero universal.
- NSIS aislado: actualización APHEKA/POHU, historial de versión, datos intactos y componentes reutilizados/reparados. No se ejecutó el instalador real contra la instalación personal.

Informes y capturas: `release/qa-6266-gallery.html`. Integridad final: `docs/POHU-release-6.26.6.json`.

## Cinco mejoras futuras propuestas

1. Replanificación semanal con vista previa: repartir tiempo restante de tareas en huecos disponibles y descansos, conservando las decisiones manuales.
2. Búsqueda local semántica bajo demanda: ampliar el índice actual con fragmentos y referencias verificables, con límites de memoria y aislamiento entre proyectos.
3. Identidad musical más precisa: contrastar ISRC, créditos y duración; ofrecer revisión de duplicados antes de cambiar la biblioteca.
4. Diagnóstico de fluidez de 30 segundos: informe local activado por el usuario para identificar una vista lenta sin mantener vigilancia permanente.
5. Historial local de cambios por apartado: recuperar una nota, tarea o planificación concreta sin restaurar toda la aplicación ni duplicar sus archivos.


## Instalador verificado

`release/POHU_6.26.6_Instalador_x64.exe` · 115483263 bytes.

SHA-256: `105626E62A3B59AA470C0280FDE07FFB7A211B72D85162471AA10EE21DDFE389`. Nombre de producto y versión Windows: POHU 6.26.6. Fuentes y recursos estables durante la compilación; el ejecutable contiene los recursos actuales del frontend. No se hizo push ni se sustituyó la instalación personal.
