# APHEKA 6.10.0 — espacio integrado y reproductor

Se conserva el logo y la identidad de datos `com.owa.studio`. No se instaló la app sobre el perfil personal durante las pruebas.

## Interfaz

- Un único espacio, sin barra superior ni escritorios numerados. Navegación automática o fija/colapsable desde Apariencia.
- Fondos claros y oscuros derivados de la superficie elegida; opacidad coherente y ausencia de desenfoque permanente en el desplazamiento normal.
- IBM Plex Sans local como tipografía predeterminada nueva, conservando la selección existente. Muestras de fuente y paletas compactas.
- Barra inferior con la distribución anterior: portada e identidad a la izquierda, transporte centrado y progreso debajo, volumen a la derecha. Fondo sólido, flecha fina, contornos suaves y volumen con recuperación de su valor al desactivar silencio.
- Ocultar el reproductor conserva la reproducción y su fuente. Abrir la sala oculta temporalmente barra y flecha; al cerrar restaura el estado anterior. Adaptación comprobada con navegación abierta/cerrada entre 800 y 1440 px.
- Panel derecho simplificado: portada, identidad, letra y próximas cinco canciones. Transporte duplicado retirado. La sala usa un solo ambiente, sin recuadro independiente para las letras ni encabezado redundante.
- Fecha y hora de entrega en una fila, con interruptor explícito de hora opcional. Corrección de la regla que escondía «Sin hora» y de la zona de arrastre que tapaba la ficha.

## Comportamiento

- Pomodoro lineal con duración y fin exactos al segundo; la duración no queda atada a un plazo previo por error. Alarma también al navegar fuera de Estudio.
- Búsqueda musical unificada: YouTube Music predominante y Audius acotado por identidad, perfil, duración, portada y tipo de contenido. Coincidencia de título y artista, variantes solo si se solicitan, duplicados retirados. La misma búsqueda se puede reenviar.
- Letras automáticas con caché y seguimiento; solo se usan marcas temporales reales cuando existen. Ningún proveedor garantiza letra sincronizada para cada grabación.
- Canciones de YouTube descargadas priorizan el archivo local al reproducir sin conexión.
- Una sola cola nativa de descarga activa. Conversión con dos hilos, un fragmento concurrente y reintentos acotados. Cancelar termina el proceso propio y sus hijos.
- Corregidas las sustituciones de metadatos incompletas de yt-dlp. Éxito exige código correcto y archivo final real emitido por ese trabajo; archivos ajenos en la carpeta no validan una descarga fallida. Progreso explícito incluso cuando yt-dlp imprime la ruta final.
- Notas conserva sus editores y propiedades, sin la franja redundante de categorías. Cursos cuenta tareas activas reales y usa banners/portadas sin reducir su nitidez.
- IA centralizada en Ajustes; respaldo antes de operaciones destructivas aprobadas. Biblioteca, listas, artistas y descargas conservan sus acciones reales.

## Comprobación

- TypeScript sin errores. Pruebas de edición, persistencia, tareas, biblioteca/listas/artistas, apariencia, alarmas y navegación completadas.
- Reproducción de WAV real aislado: pausa/reanudación, seek, barra, sala, letra sincronizada y anchos de ventana. Sin recargar el audio al ocultar o abrir portada.
- Motor Windows/WebView2: eventos de cursor con composición compatible y audio continuo al alternar pantalla completa. No es una garantía sobre el renderizado físico de cada GPU o controlador.
- Descarga nativa de audio generado para la prueba: conversión MP3, ruta final, fallo auténtico con archivo antiguo presente, cancelación menor de cinco segundos y rechazo de protocolos no HTTP.
- Consulta real «Best Friend de Orange»: «Best Friend», Rex Orange County, con portada.
- Instalador: herramientas válidas con SHA-256 conservadas sin reescritura; archivos ausentes/corruptos reparados en carpetas ficticias. Migración de OWA, instalación inicial/repetida y actualización verificadas con perfiles ficticios, conservando datos y archivos.
- Compilación de producción: reproducción y sala con audio real, letras, cuatro anchos, navegación abierta/cerrada, ficha de tareas y acciones de biblioteca/listas/artistas comprobadas.
- Ejecutable final: protocolo del conector por entrada/salida estándar verificado sin ventanas ni modificaciones de datos.
- Muestreo de scroll en Edge de desarrollo, 120 tareas/180 notas/24 cursos: percentil 95 de intervalos entre fotogramas de 7,2–14,1 ms. Muestra breve de 1,5 s por vista; no mide GPU física ni sustituye una prueba prolongada de producción. Detalle en `performance-6.10-final.json`.

Los proveedores adicionales investigados, sus límites y fuentes están en [APHEKA-6.10-providers.md](APHEKA-6.10-providers.md). Los servicios que exigen credenciales propias no se presentan como conectados. No se promete disponibilidad universal de todo catálogo comercial.

Paquete final verificado: `release/apheka_FINAL.exe`, versión 6.10.0, 79263033 bytes. SHA-256: `F61F1AC26532278169DA661EF2988A3F089F406D6D72041F479AD0A016991865`. Fuentes, nueve vistas actuales y tres herramientas verificados.
