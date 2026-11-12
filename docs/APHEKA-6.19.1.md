# APHEKA 6.19.1

Estado: instalador 6.19.1 compilado y verificado. Archivo: `release/apheka_FINAL.exe`. Tamaño: 80231354 bytes. SHA-256: `32B047E46BE0C55DFF608DDA39ECDBBFBAA8CDB07D778978A16136CC47C2982F`.

Apuntes de Cursos utiliza una barra de cuatro acciones de formato: negrita, cursiva, lista con viñetas y lista numerada, en la misma fila que destacar, borrar y cerrar. Deshacer y rehacer funcionan con Ctrl+Z y Ctrl+Y (también Ctrl+Mayús+Z), mediante el historial interno. Se retiran de esa barra el selector de títulos, los menús de inserción y formatos avanzados y los botones matemáticos. El contenido existente, las fórmulas automáticas, el pegado, las listas, el historial de deshacer y el guardado se conservan. El editor completo de Notas mantiene sus herramientas.

Inicio selecciona únicamente los datos que necesita. El avance del audio deja de renderizar toda la vista. Reloj y cuenta atrás se actualizan en componentes pequeños; saludo, fechas y calendario se actualizan por minuto. Los relojes visuales se detienen al ocultar la aplicación y recuperan la hora real al volver.

La gráfica de Cursos utiliza ResizeObserver sobre el elemento montado. Se elimina la lectura de geometría cada 400 ms. El tamaño se ajusta al cambiar realmente el contenedor, incluso al cambiar de vista o ampliar la navegación; las notificaciones se agrupan por frame y se descartan dimensiones iguales.

## Verificación

- Compilación TypeScript y Vite completada.
- Apuntes: cuatro botones de formato, una única fila junto a borrar/cerrar, Ctrl+Z y Ctrl+Y, selección y formato, listas, deshacer/rehacer, títulos existentes, Unicode y espacios, persistencia tras recargar y una fila de herramientas a 900 y 1440 px.
- Editor completo de Notas: controles compuestos, selección, enlaces, resaltado, tablas, recursos, márgenes y guardado, sin regresiones en la prueba vigente.
- ResizeObserver: montaje bajo StrictMode, cambio real de ancho y alto y dimensiones correctas.
- Relojes: sin actualizaciones con la aplicación oculta y hora actual al volver.
- Prueba de rendimiento con perfil temporal de Edge y datos sintéticos: veinte actualizaciones del progreso musical generaban veinte commits de Inicio (225,9 ms de React); después generan cero commits de esa vista. En 2,3 segundos de reposo, el trabajo del árbol medido baja de 46,4 ms a 0,8 ms, con los segundos visibles actualizándose en su componente. Son mediciones de esta prueba, no porcentajes de CPU de todo el equipo ni una garantía para todos los conjuntos de datos.

No se añadieron dependencias ni servicios. Los datos y la instalación personal no se modificaron durante las pruebas.

Evidencias: `release/performance-before.json`, `release/performance-after.json`, `release/qa-course-essentials-1440.png`, `release/qa-course-essentials-900.png`.

La verificación de producción incluye ambas vistas de apuntes, con controles de formato y acciones de nota en una sola fila. Los atajos se comprobaron después del autoguardado. Las pruebas musicales vigentes de recuperación de reproducción, contexto de listas y seguimiento de letras en ambas vistas también pasaron con respuestas controladas.
