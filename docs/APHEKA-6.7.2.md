# APHEKA 6.7.2 · revisión final de escritorio

Esta revisión conserva la organización de la aplicación, el logotipo y la carpeta de datos existentes. El resultado solicitado se distribuye como `release/apheka_FINAL.exe`.

## Diseño e interacción

- Inicio mantiene sus tres bloques de resumen en la misma fila. Métricas compactas y reloj de 48–52 px, con cifras finas y estables.
- Relojes compartidos en los apartados; Estudio usa 42–44 px. Se mantienen márgenes coherentes con la barra de navegación abierta o cerrada.
- Tareas: vistas con bordes suaves, colores discretos en curso/prioridad, fecha y hora sin columnas vacías y subtareas con controles visibles.
- Música: pestañas de 43 px, textos de 13 px y más espacio útil entre controles. Se conserva la biblioteca y el comportamiento del reproductor.
- Cursos: título de 36–40 px y un campo de banner compartido. La imagen se aplica directamente al formulario; el encuadre es opcional. Se conservan los botones de formato, resaltado y alineación.
- Notificaciones: panel independiente del encabezado, título de 16 px, posición dentro de la ventana y cierre con Escape. Ya no hereda la tipografía grande de Inicio.

## Pomodoro y subtareas

El reloj con agujas aparece únicamente en el emergente del clic derecho del pomodoro. Las agujas grises muestran la hora actual; las de acento muestran el final elegido. Se pueden arrastrar y controlar con las flechas del teclado. Hora, duración y vista previa permanecen sincronizadas, con un máximo de dos horas y soporte para el cambio de día. El botón Fijar conserva la hora exacta de finalización.

El play de una subtarea inicia el pomodoro y guarda su identificador junto al de la tarea. La etiqueta y el registro de estudio usan `Subtarea | Tarea principal`. Al cambiar a otra subtarea, se registra primero el tiempo del estudio anterior. El vínculo se conserva en localStorage e IndexedDB y se restaura al recargar; no se permite iniciar una subtarea completada o de una tarea vencida/eliminada.

## Notas y apuntes

- Tipografía de escritura Inter Tight de 16,5 px y línea de 1,85, con márgenes y lateral de herramientas definidos.
- Guardar conserva párrafos vacíos intencionales, dobles espacios, acentos y documentos con imágenes o diagramas.
- Los apuntes de la vista general y la vista dedicada utilizan el mismo editor. El autoguardado evita reiniciar el DOM durante la escritura y conserva el último cambio al salir.
- Se eliminó una unión de párrafos que accedía a un hermano después de desprender el nodo.
- El historial guarda la posición estructural del cursor, además del desplazamiento de texto. Deshacer/rehacer conserva líneas vacías y límites de párrafos con formato; antes ambos podían compartir el mismo desplazamiento y el cursor saltaba de párrafo.
- El pegado conserva formato útil y SVG estático, eliminando scripts y atributos de ejecución. El resaltado utiliza una superficie suave que conserva la legibilidad en ambos temas.
- Arrastrar fuera de la lista o cancelar no cambia el orden. Hay control con teclado y el orden de las notas ocultas permanece intacto al reordenar un filtro.

## Ventanas y actualización

Se añadió el plugin oficial de instancia única como primer plugin de Tauri. Una nueva apertura solicita mostrar, restaurar y enfocar la ventana principal existente. El flotante conserva su propia ventana y no añade otro botón a la barra de tareas; se reutiliza su etiqueta y se evita crear ventanas por clics simultáneos.

El cierre principal espera el último guardado en las capas disponibles. Antes de escribir, solicita a los editores su contenido pendiente. Al destruirse la ventana principal se cierran las auxiliares, evitando una instancia sin ventana principal. Si ninguna capa puede guardar, el cierre se detiene y se informa del fallo real.

El instalador NSIS identifica la familia conocida de OWA mediante nombre exacto, fabricante, desinstalador esperado y binario; la variante MSI usa sus GUID de actualización conocidos. La retirada NSIS usa `/UPDATE`, que conserva AppData. El identificador continúa siendo `com.owa.studio`, de modo que APHEKA reutiliza la carpeta y los datos actuales. No se eliminan aplicaciones por similitud de nombre.

Una instalación nueva no muestra novedades. Una actualización o reinstalación genera su propio identificador y muestra el resumen una vez, con **Hecho por Gewodev**. La confirmación se guarda en disco. Los parámetros de actualización MSI de APHEKA permanecen estables para próximas versiones.

## Validación realizada

- 138 comprobaciones de lógica TypeScript/JavaScript y seis pruebas Rust para primera instalación, actualización, reinstalación, confirmación y contexto obsoleto.
- TypeScript sin errores y `git diff --check` limpio.
- Ocho vistas a 900, 1024, 1200 y 1440 px, con menú abierto/cerrado: límites reales de los relojes, ausencia de solapamiento, planificador en una fila y evento centrado con campos amplios.
- Regresión de destacados y ausencia de duplicados en próximos eventos; duración y final exacto; ajustes; opacidad; meta diaria; matriz de actividad; reproductor y ocho herramientas de cursos.
- Pruebas de subtarea: iniciar, cambiar conservando el segmento anterior y restaurar el vínculo.
- Pruebas de edición: escritura, espacios, imágenes, pegado, deshacer/rehacer, cursor en párrafos vacíos, unión de párrafos y guardado inmediato en las dos vistas de apuntes.
- Instalador probado con registros y ejecutables ficticios, aislados de los productos y datos personales: instalación nueva/repetida, sustitución OWA, `/UPDATE`, datos intactos y fabricante ajeno ignorado.
- Frontend de producción: fuentes locales, ocho apartados, seis categorías de ajustes y tres bloques de Inicio, sin errores de página ni recursos ausentes.

Las comprobaciones visuales usan Edge con perfiles aislados; Tauri usa WebView2. No se instaló el paquete sobre el perfil personal durante las pruebas. El cambio entre escritorios virtuales y la representación de la barra de tareas requieren comprobación en la aplicación instalada en Windows; se verificaron la implementación y la compilación nativas.

## Paquete y reproducción

La revisión final de Cursos corrige el desbordamiento de fecha y prioridad, adapta las columnas de materiales, sesiones y agrupaciones al espacio disponible y conserva su distribución completa en ventanas amplias. La configuración y los demás emergentes de Cursos se montan sobre la ventana completa, sin quedar desplazados por la animación del apartado. Se comprobaron cuatro anchos con menú abierto/cerrado y una ventana de configuración de 900 × 700 px.

El instalador NSIS está personalizado en español, con imágenes de APHEKA, tipografía Segoe UI y el logo original. Reemplaza únicamente la familia conocida de OWA Studio, reutiliza `com.owa.studio` como carpeta de datos y actualiza APHEKA con su identidad de instalación estable. No permite sustituir una versión más nueva por una antigua. La limpieza del instalador anterior elimina su ejecutable verificado y solamente retira la carpeta de programa si queda vacía; nunca recorre carpetas de datos. Las pruebas aisladas comprobaron notas, JSON y audio intactos, además del historial de APHEKA cuando la página de mantenimiento elimina el registro anterior.

`powershell -NoProfile -ExecutionPolicy Bypass -File scripts/package-final.ps1 -Build`

El script compila, comprueba la versión del instalador, evita entregar un paquete anterior al código fuente y verifica el SHA-256 de la copia final. El manifiesto definitivo está en `release/apheka_FINAL.json`. El EXE recomendado es el NSIS, que incluye el puente desde OWA; el MSI también se genera con el identificador de actualización estable de APHEKA.

Compilación terminada correctamente: frontend en 18,81 s, aplicación Rust en 5 min 13 s y ambos instaladores generados. `release/apheka_FINAL.exe` contiene esta revisión completa, con 78.225.135 bytes. El script verificó la versión, la antigüedad del código fuente, los ocho recursos principales del frontend incrustados y la integridad de la copia final.

SHA-256: `A98F19B169BC51F63B2EF2C721B7112A083A14EF9D54D84C5ABC31F6C1E35B76`. Instalador generado el 13 de octubre de 2026 a las 11:15:19, hora de Lima. La traducción española empaquetada coincide con el archivo personalizado; no contiene marcadores `{{product_name}}`. Las pruebas del frontend de producción también pasaron tras las últimas correcciones de Cursos.

Las advertencias de empaquetado sobre tamaño de Cursos, un `eval` de una dependencia y chunks vacíos son anteriores a esta revisión; no impiden la compilación.

Referencias nativas: [instancia única de Tauri](https://v2.tauri.app/plugin/single-instance/), [instaladores de Windows](https://v2.tauri.app/distribute/windows-installer/) y [configuración de actualización](https://v2.tauri.app/reference/config/).

## Capturas

[Inicio](D:/VIBE/Owa_Studio/docs/apheka-v5-inicio.png), [pomodoro](D:/VIBE/Owa_Studio/docs/apheka-final-pomodoro.png), [notas](D:/VIBE/Owa_Studio/docs/apheka-final-nota.png), [apuntes](D:/VIBE/Owa_Studio/docs/apheka-final-apunte-editor.png), [banner](D:/VIBE/Owa_Studio/docs/apheka-final-banner.png), [actualización](D:/VIBE/Owa_Studio/docs/apheka-final-actualizacion.png), [Cursos a 900 px](D:/VIBE/Owa_Studio/docs/apheka-final-curso-900.png), [configurar curso](D:/VIBE/Owa_Studio/docs/apheka-final-curso-ajustes-900.png), [estudio en Cursos](D:/VIBE/Owa_Studio/docs/apheka-final-curso-estudio-900.png), [editor de Cursos](D:/VIBE/Owa_Studio/docs/apheka-final-curso-editor-900.png).
