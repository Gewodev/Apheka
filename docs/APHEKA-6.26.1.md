# APHEKA 6.26.1

Revisión del 6 de noviembre de 2026 sobre `19820e3`. Conserva el identificador `com.owa.studio`, las conversaciones, las claves y los datos de la instalación anterior.

## Charvis: desactivar y volver a habilitar

El clic derecho en IA desactiva Charvis y retira su icono de la barra lateral. La señal de suspensión cancela las operaciones activas antes de desmontar el asistente. La preferencia anterior `apheka_ai_suspended` se conserva; también se respeta después de reiniciar. Una ruta antigua que apuntaba a IA se devuelve a Inicio mientras permanece desactivada.

En Ajustes → Sistema aparece el interruptor **Charvis**. Permite volver a habilitarlo, sin borrar conversaciones ni modificar el proveedor elegido. Su estado se comparte entre el icono y Ajustes mediante una suscripción a cambios, sin intervalos de consulta. Los conectores externos de Sistema conservan sus controles independientes.

## Escritura, desplegables y apuntes

- Los campos de texto y editores no añaden el contorno de foco ni la sombra interior de la captura. El borde estructural del campo se conserva. Los controles de teclado mantienen indicaciones de foco; en alto contraste se mantiene el indicador del sistema.
- Los dos formularios rápidos de tareas del curso utilizan el selector de prioridad propio de APHEKA, con colores y navegación por teclado, conservando las mismas prioridades y el guardado. Se corrige una regla heredada que ocultaba cualquier contenedor en esa fila.
- Mis apuntes muestra un título legible, icono discreto y extracto en tarjetas de borde uniforme. La edición, formato, guardado automático, destacar, eliminar y reordenar mantienen sus funciones; los apuntes de conocimiento conservan las restricciones de edición anteriores.

## Nuevo evento

Se reforma el diálogo que ya abre **Nuevo Evento** en el planificador. Fecha y finalización comparten fila; inicio y duración utilizan dos controles compactos, con duraciones habituales junto al ajuste de minutos. Se conserva todo el día, repetición, fecha final, materia, tarea vinculada, color, materiales y edición de series. No se añade otro botón para eventos.

El formulario se revisa a 420, 768 y 1440 px. El ancho se adapta y el cuerpo conserva desplazamiento, con pie de acciones accesible.

## Comprobaciones

`scripts/test-ui-6261.cjs` comprueba la creación de una tarea con prioridad, la edición y guardado del apunte, desactivación por clic derecho, persistencia tras recarga, habilitación/deshabilitación desde Sistema y creación de evento. Las tres anchuras no presentan desbordamiento del diálogo ni errores de ejecución.

Los informes adicionales y las capturas se entregan en `release/qa-6261-*.json` y `release/qa-6261-gallery.html`. Las pruebas usan datos aislados y no sustituyen la aplicación instalada ni usan claves privadas. Esta revisión de interfaz conserva las optimizaciones de fluidez de 6.26.0; las muestras acotadas de navegador no garantizan ausencia absoluta de pausas en cualquier equipo o sesión prolongada.

`scripts/test-fields-6261.cjs` verifica el curso a 900 px sin recorte del bloque, selección de prioridad con flechas/Enter/Escape, foco del editor sin marco, guardado del apunte y un evento semanal con fecha final y duración de 90 minutos. La captura de diez apartados utiliza el frontend compilado de producción: sin errores de ejecución, sin desbordamiento horizontal del documento y sin barras nativas de desplazamiento visibles en los paneles revisados. La revisión a 420 px corresponde al diálogo de evento; la estructura general de escritorio conserva su ancho base de 900 px.

`scripts/test-scroll-6261.cjs` recorre 11 476 px de una lista de 200 tareas, el detalle de tarea, 40 notas y el nuevo evento, con temporizador activo. No hubo errores de ejecución ni tareas largas JS en los intervalos medidos. Se registró un fotograma aislado de 131 ms en el desplazamiento del evento; la compilación nativa estaba ejecutándose durante la muestra. Esto no permite atribuir la demora a una única causa ni afirmar cero latencia en todo momento.

El instalador se entrega únicamente después de compilar y comprobar versión, integridad y recursos incrustados. Sus datos definitivos figuran en `docs/APHEKA-release-6.26.1.json`.

Compilación completa terminada correctamente en 9 min 32 s, incluido el frontend en 31,31 s. Fuentes, recursos y herramientas estables durante el empaquetado. Archivo final: `release/APHEKA_6.26.1_Instalador_x64.exe`, **115 434 985 bytes**, SHA-256 **321818674D59FBD10B43F114FCF433F7AAFA444ED936C3EEE0AF0CEDD8884696**. La copia coincide con `release/apheka_FINAL.exe` y contiene la versión 6.26.1. No se hace push ni se modifica la aplicación instalada.
