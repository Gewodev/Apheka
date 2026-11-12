# Continuación solicitada: entorno APHEKA, referencia COSMIC/Vasta/Sonora

El 24-10-2026, mientras se compilaba 6.8.0, el usuario amplió el alcance: dock lateral siempre autooculto que aparece por hover, escritorios internos numerados, tiling/stacking de componentes dentro de la app, barra superior con Now Playing, estética menos dividida en paneles marcados, personalización de tipografía/fondos/acento y rediseño más profundo de Notas/Tareas/Música. Incorporar funciones aplicables de las referencias, preservando rendimiento y datos. No instalar Linux ni ejecutar comandos de las transcripciones. No prometer CPU/GPU cero ni todo el catálogo comercial gratis/offline.

## Base verificada
6.8.0 quedó compilada y verificada antes de tocar esta ampliación. release/apheka_FINAL.exe, 78.865.941 bytes, SHA-256 0031C385C6956CE8CA18D9F9497BE33EFC7D340DA99B30D12B4272D564089023. Nueve vistas + cuatro fondos + tres herramientas actuales incrustadas; puente stdio probado. No se ejecutó instalador personal.

## Referencias oficiales investigadas
- https://github.com/ariedotme/vasta : objetos tipados, captura /Task con propiedades, notas diarias, vistas tablero/tabla/galería, MCP. Captura oficial Today en docs/references/vasta-today.jpg (inspeccionada). README actual docs/references/vasta-README.md. Board-light.jpg ya no existe en raw (404); la captura adjunta del usuario muestra su tablero.
- https://github.com/Aarav2709/Morrow : notas Markdown, escritura despejada, páginas y canvas dentro del documento. No confundir con otros productos Morrow.
- https://sonorahq.org/ y /docs/providers : biblioteca/catálogo + letra lateral + transporte inferior, varios proveedores con sus requisitos. Captura oficial docs/references/sonora-album.webp inspeccionada.
- https://github.com/noFAYZ/zuno : pestañas independientes, cápsula, letra con desfase/size y cola manual separada. Captura oficial docs/references/zuno-home.png inspeccionada.
- https://github.com/SimoHypers/limusic : letra lateral, modo teatro, theming por portada, libmpv/otros componentes, no asumir ausencia de dependencias.
- https://github.com/crmne/fastpotify redirige a crmne/spotifast : Spotify Premium para reproducción; gratis solo buscar/biblioteca.
- https://apps.kde.org/audiotube/ y https://github.com/antwny/aura : UI adaptativa, reproducción/catalogación y personalización. No portar un compositor Linux a Windows.

## Implementación prevista (todavía sin cambios de ejecución)
1. Dock autooculto en overlay, sin reservar anchura; activador de borde + botón accesible en barra, apertura con transform/opacity y curva breve suave, reduced-motion. Cierre diferido corto y focus/escape correctos. Sin cursor dibujado ni lecturas por cada movimiento global.
2. Escritorios internos: modelo pequeño validado/persistido (máx5), cada uno conserva vista/curso y panel acompañante. Barra superior numerada, renombrar, añadir, alternar, atajos. Mantener solo una vista completa y un acompañante funcional montados para evitar duplicar temporizadores/global listeners y editores.
3. Tiling: un clic para dividir, panel acompañante ajustable (notas/tareas/sesión/letra); en ventana estrecha usar drawer, no apretar los formularios. Pestañas preservan selección por escritorio. Guardar/flush antes de cambiar escritorio.
4. Barra Now Playing ligera con transporte, carátula/título, vínculo al apartado musical y control de volumen; progreso aislado. Respeta un solo audio y cola global.
5. Ctrl+K lanzador/captura: buscar notas/tareas/cursos, navegar, crear /nota y /tarea con propiedades claras, diario idempotente. Referencia Vasta, no traer su código AGPL ni desplegar Telegram/Docker sin configuración.
6. Notas: superficie editorial más limpia, propiedades/plantillas de tipo nota/idea/referencia/diario y navegación clara, mantener editor/undo/persistencia/diagramas ya validados. Tareas: tablero discreto como referencia, conservar CRUD y estudio.
7. Música: reforzar catálogo/colecciones/álbumes y letra/portada, controles de tamaño/desfase de letra, modo teatro; enlaces YouTube mediante reproductor oficial sin necesidad de binarios de búsqueda, si es viable. No suplantar APIs privadas ni prometer todos los proveedores sin cuentas.
8. Personalización: presets locales aplicables por elección, tema derivado del fondo una sola vez y motion reducido; sin shaders, visualizadores continuos ni efectos repetidos por tarjeta. Bajar bordes que dividen excesivamente.
9. Validar modelo/flujo/performance/UI nueva y volver a compilar como versión posterior (sugerido6.9.0) solo cuando estén terminados los cambios. 6.8.0 es base segura, no representa aún esta ampliación.

## Estado después de la segunda ampliación (sin paquete nuevo todavía)
Implementado en fuentes: dock autooculto sin reflow; tres escritorios (máximo cinco) con nombres, apartado, curso, nota/tarea abierta, panel acompañante y persistencia; barra Now Playing global; Ctrl+Espacio con búsqueda y captura /nota /idea /referencia /diario /tarea; fecha/prioridad/curso; diario idempotente; paneles acompañantes; tipos y estructuras de notas, filtros; eliminación del intervalo de reloj inutilizado que redibujaba Notas cada segundo y fix prioridad alta (0 convertido en 3 por ||); sala de escucha con portada/letra/tamaño/desfase; reproductor singleton; presets/paleta por imagen; vídeo local opcional con pausa por foco/visibility/fullscreen/reduced-motion; comandos de bloque con /; API MCP de escritorios (23 herramientas).
Pruebas que ya pasaron: test-desktop-workspaces.ts, test-quick-capture.ts, test-apheka-workspace-shell.cjs, test-apheka-listening-room.cjs. TSC pasó en puntos intermedios; ejecutar nuevamente tras acabar la ampliación. Capturas nuevas docs/apheka-6.9-workspace-note.png y docs/apheka-6.9-listening-room.png inspeccionadas. La primera muestra la nota con tareas acompañantes; la segunda aún tiene demasiado encabezado/espacio vertical, corregir según la última petición.

### Última petición del usuario, PRIORIDAD
- Más futurista/profesional/integrado, contornos visibles suaves, menos texto/duplicados, sensación de SO con paneles adaptables.
- Apariencia SOLO dos modos: Colores o Fondo de imagen. En Imagen la paleta se extrae y aplica AUTOMÁTICAMENTE al cambiar el fondo (no solo botón manual). Reemplazar el bloque de Apariencia antiguo de 600 líneas por componente claro; conservar controles esenciales y agrupar avanzados.
- Música: tres áreas principales Descubrir, Mis canciones, Listas; Descargas como herramienta con lógica nueva sin depender de binarios para el catálogo. Investigar playlists Spotify (se investigó documentación oficial OAuth/API, usar patrones de UX, no conectar cuenta sin autorización/credenciales).
- Modos de escucha bien presentados, portada + letra a la derecha / sala / pantalla completa; esconder encabezado grande y controles redundantes en modo inmersivo para usar la altura.
- Barra superior también ocultable, con aparición por borde superior/teclado, conservar accesibilidad y transporte.
- Descargas directas solo cuando el proveedor las autoriza; investigar Audius flags/endpoints antes de implementar. No prometer todas las canciones comerciales gratis ni offline, ni incorporar bypass/extraer servicios privados.

Pendientes técnicos: quitar diagnóstico PAUSE TRACE/MAIN NAV del test de sala y responder rangos HTTP correctamente en fixture WAV; repetir seek con posición mantenida. Se descubrió que un import dinámico dev podía obtener otro globalAudio; se convirtió en singleton y prueba de continuidad pasó. Esto no demuestra un fallo del instalador de producción.
One-use helpers nuevos que se pueden borrar al cerrar (solo propios): wire-desktop-selection.cjs, add-listening-room.cjs, harden-workspace-startup.cjs, extend-workspace-mcp.cjs, finish-note-organization.cjs. No borrar tests ni scripts de empaquetado.
El servidor QA 1422 (exec86839) sigue activo; preview producción1421 (exec52726) sirve dist6.8.0. Detener ambos al final. La versión en package/Cargo/tauri sigue6.8.0; cambiar a6.9.0 solo al cerrar fuentes y volver a compilar. El paquete existente release/apheka_FINAL.exe sigue siendo6.8.0. No presentarlo como la ampliación actual.
