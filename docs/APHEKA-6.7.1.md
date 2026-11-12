# APHEKA 6.7.1 — correcciones de escritorio

Esta revisión corrige las observaciones posteriores al paquete 6.7.0. Conserva el logo, los datos, el identificador `com.owa.studio` y el orden de los bloques de Inicio.

## Interfaz

- Métricas de Inicio compactas: número y título juntos, estado en una segunda línea, altura cercana a 96 px. Tareas, Notas y Próximos eventos conservan su fila.
- Reloj compartido en ocho vistas: Inter Tight local de peso 300, 42–46 px en escritorio, segundos discretos y formato 12/24 horas. Títulos de 34–36 px y separación inferior reducida.
- Se corrige el ancho mínimo intrínseco que hacía que Inicio excediera la ventana aunque el desbordamiento de la página estuviera oculto. Las comprobaciones ahora miden también los límites reales de los componentes.
- Planificador en una fila: fecha compacta en dos líneas, acciones de 42 px con padding de 16 px. En contenedores estrechos se conservan iconos, etiquetas accesibles y tooltips. Horario y Hábitos son modos exclusivos.
- Evento: ventana de 780 px, columnas de fecha/inicio/duración de al menos 200 px a 1200×800, separación de 20 px, tipografía legible y pie visible. Repetición utiliza el desplegable compartido. El modal se centra en la ventana mediante portal y cierra con Escape.
- Nueva sesión: ventana de 640 px, fecha editable, hora con ajustes de 15 minutos y presets, duración editable y hora de finalización visible. Intensidad plana, sin relieves. Los vínculos opcionales solo aparecen cuando hay opciones disponibles. Se rechazan horarios que cruzan medianoche, fechas inválidas, finales de repetición anteriores e identificadores de curso/agrupación/tema inexistentes. Editar conserva el estado de completada.
- Lateral de Tareas: fecha y hora en campos completos. Hora legible, botones de ajuste, horarios sugeridos y eliminación explícita de hora.

## Causas corregidas

El desplegable tenía z-index 20.000 y el lateral 99.990. Ahora calcula su capa a partir de sus ancestros. El foco usa `preventScroll`, la selección se desplaza dentro de su propia lista y el menú sigue a su campo durante el desplazamiento del formulario; se cierra cuando el campo deja de ser visible. Escape cierra el menú sin cerrar su diálogo. Las pruebas comprueban con `elementFromPoint` que las opciones están delante y permiten clics reales.

El ancho mínimo automático del contenedor principal hacía crecer Inicio más allá del área disponible. Se establece `min-width:0` en el área principal y su contenedor de vista. También se eliminó una regla antigua que anulaba el tamaño nuevo de los encabezados.

## Validación

- 120 comprobaciones unitarias; TypeScript sin errores.
- `test-apheka-followup.cjs`: métricas, reloj en ocho vistas, menús del lateral, selección y persistencia de curso/prioridad/hora, modos exclusivos, creación de sesión y rechazo de sesión fuera del día.
- `test-apheka-layout.cjs`: ocho vistas a 900, 1024, 1200 y 1440 px con menú abierto/cerrado. Límites reales del reloj y contenedor, ausencia de solapamiento, una fila del planificador, ventana de evento centrada y selector de repetición.
- Regresión adicional de eventos destacados, notas, tareas, ajustes, biblioteca musical, herramientas de cursos y hora exacta del pomodoro.
- Capturas: `apheka-v5-inicio.png`, `apheka-v5-planificador.png`, `apheka-v5-tarea.png`, `apheka-v5-sesion.png`, `apheka-v5-evento.png`.

Las pruebas de interfaz usan un perfil aislado de Edge. La revisión de producción y los casos nativos se amplían en el informe 6.7.2. Los diálogos nativos, los servicios externos y la biblioteca personal requieren comprobación en la aplicación instalada. No se ejecuta el instalador sobre los datos personales como parte de estas pruebas.

## Paquete

La compilación terminó correctamente el 12/10/2026 a las 22:22 (America/Lima). Se verificaron EXE y MSI de APHEKA 6.7.1; sus tamaños y SHA-256 constan en `APHEKA-release-6.7.1.json`. Esta revisión queda sucedida por APHEKA 6.7.2.
