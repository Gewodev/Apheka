# APHEKA 6.18.0

Estado: instalador final 6.18.0 compilado y verificado. Archivo: `release/apheka_FINAL.exe`. Tamaño: 80238272 bytes. SHA-256: `BAD60F8DEAE7DFBD31C12975CB8DF6873797E1FFFE421BC2FFA28F33DF17AC45`. Incluye las nueve vistas actuales, el SDK musical corregido y una copia de cada una de las tres herramientas.

Notas tiene una vista de lectura renovada con fondo sólido, independiente de la opacidad general de los bloques. El título usa todo el ancho y Editar queda en la fila superior de controles. Abrir lectura flotante, ampliar, fijar, mover y eliminar se agrupan en un menú. Se conservan las vistas de contenido, materiales, metadatos e historial.

El lector flotante utiliza la misma cabecera y superficie sólida. Minimizar, restaurar y abrir la nota correcta en el editor están comprobados.

El editor alinea el texto con el título, reduce su margen interior a 20 px y reserva 272 px para los recursos. La barra muestra deshacer/rehacer, estilo de párrafo, negrita, cursiva, listas e inserción/opciones agrupadas. Enlaces, imágenes, tablas, código, citas y formatos complementarios permanecen accesibles. El lateral conserva archivos, enlaces, carpeta, etiquetas e información, con menos separación entre secciones. Las etiquetas no seleccionadas se ofrecen como sugerencias al escribir.

El seguimiento de la selección usa un único listener con actualización por frame y evita recalcular estados iguales. Se mantiene la selección al usar formatos o insertar un enlace. Los enlaces se validan antes de insertarse.

Validación: tipos; lectura sólida en temas claro/oscuro y opacidad baja; edición, archivos, enlaces, etiquetas, carpetas y guardado; formato con selección; tabla y deshacer/rehacer; tamaños 1440, 1100 y 900; navegación fija abierta y contraída; lector flotante y edición de la nota correcta. También se comprobaron las operaciones MCP y la sincronización con un editor abierto, listas musicales y ajustes de salida de descargas. Se conserva el mínimo de ancho de escritorio existente.

No se modificaron la instalación ni los datos personales. Las pruebas usaron notas y archivos de prueba en contextos aislados del navegador.

También se corrigió la caché de colores opacos al cambiar de tema. La revisión visual descubrió fondos oscuros retenidos bajo texto de tema claro; ahora se resuelven las superficies del tema actual antes de conservar su color sólido. Se comprobaron cambios repetidos oscuro/claro/vibrante con contraste de título de al menos 4,5:1.
