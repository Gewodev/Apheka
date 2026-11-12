# APHEKA 6.16.0

Estado: instalador final 6.16.0 compilado y verificado. Archivo: `release/apheka_FINAL.exe`. Tamaño: 80231718 bytes. SHA-256: `82A11E2E6321C8488BEF6B6DC6CEB64FCD30DCDD786F1392C11ACB07363F74A9`. Incluye las nueve vistas actuales, el SDK musical corregido y una copia de cada una de las tres herramientas.

- Retirados VideoPiP y la ventana independiente de YouTube. Ya no se montan, solicitan vídeos ni se restauran desde una sesión antigua. Se elimina también la vista musical antigua sin uso.
- Se borra automáticamente el estado obsoleto `owa_pip_v1` y `owa_yt_pending` de localStorage y sessionStorage en cada arranque, incluso si está dañado. Se atienden nuevas escrituras desde pestañas antiguas. La limpieza no borra música, listas, letras ni datos personales.
- Si existe una ventana heredada `youtube-player`, la nueva aplicación la destruye. Una ventana restaurada con esa identidad se cierra por sí misma y no carga un reproductor. El cierre es repetible y no afecta a la ventana principal, PDF ni temporizador.
- Eliminada la cola del reproductor emergente. El fin de una canción local o de YouTube continúa por la cola musical actual.
- Los vídeos de notas, cursos, tareas y planificador conservan su apertura mediante el navegador o la aplicación del sistema, sin superposición persistente.
- Un reloj de letras compartido por implementación sigue tanto el audio local como YouTube. Atiende eventos de pausa, reproducción, búsqueda y metadatos, y conserva el seguimiento al saltar con la canción pausada. Solo mantiene su intervalo de 250 ms con reproducción y ventana visible.
- Se evita leer el tiempo de la grabación anterior mientras YouTube cambia de canción. El centrado considera líneas largas, primera/última línea, cambios de ancho/alto y carga de fuentes. Tras desplazar la letra manualmente, vuelve al verso activo.
- El espacio antes y después de las líneas forma parte del contenido desplazable, sin imponer un tamaño mínimo al visor. En pantallas estrechas, el panel respeta el límite de la ventana y la barra inferior.
- Descubrir presenta diez canciones por página. Las recomendaciones combinan favoritas, tiempo escuchado, reproducciones, artistas y búsquedas exitosas guardadas localmente. Se conservan hasta cuarenta consultas entre reinicios, se compactan prefijos escritos recientemente y se limitan las consultas primarias a tres, reutilizando la caché del catálogo.
- La clasificación de recomendaciones alterna artistas y reduce la repetición de grabaciones recientes. No elimina candidatos válidos; la búsqueda explícita conserva sus reglas de relevancia por título y artista, y el filtrado existente de versiones no solicitadas.
- Se conserva la caché de letras compartida y limitada, el diseño de listas, las descargas y la barra inferior.

Validación: 26 pruebas nativas, pruebas reales de ventanas en com.apheka.qa, arranque con estado antiguo/dañado, reinicio, nuevas escrituras desde otra pestaña, conservación de biblioteca/listas, seguimiento en ambos visores con pausas/saltos/cambio de canción, redimensionado, audio local sin conexión, caché persistente y cancelación independiente. Regresión de notas, listas, búsqueda, cola, biblioteca y pantalla completa.

Límite: el seguimiento exacto requiere que la fuente ofrezca marcas de tiempo para esa grabación. Las letras sin tiempos se muestran como texto y no reciben una sincronización inventada. Una ventana de una versión antigua que siga ejecutándose en otro proceso necesita cerrarse durante la actualización normal; la nueva versión elimina su estado y su restauración.
