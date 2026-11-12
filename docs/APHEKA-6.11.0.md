# APHEKA 6.11.0: música y acabado visual

Estado: instalador final 6.11.0 compilado y verificado. Archivo: `release/apheka_FINAL.exe`. Tamaño: 79263829 bytes. SHA-256: `B4452508E60480C7F7CA4C25907481CCEAC326070C163162511F5501993523CA`. Incluye las nueve vistas actuales, el SDK musical corregido y una copia de cada una de las tres herramientas.

## Cambios

- Un solo espacio de Música: Descubrir, Mis canciones, Artistas, Listas y Favoritas. La portada abre la vista ampliada; no existe la pestaña Escuchando ni la ruta a una segunda interfaz de herramientas.
- Importación por enlace integrada en Descargas. Biblioteca, artistas, favoritas y listas excluyen las vistas previas no guardadas.
- Corregida la inicialización del SDK musical en producción: su módulo de exportaciones se evaluaba antes que una clase requerida. Se utiliza la entrada oficial precompilada para navegador del mismo paquete, sin añadir dependencias ni servicios.
- Búsqueda al escribir, resultados de YouTube Music con apoyo conservador de Audius, portada y coincidencia de título/artista. No se promete que un proveedor contenga todas las grabaciones o esté disponible en todas las redes.
- Conexión nativa HTTPS, verificación de certificados, destinos restringidos, límites de respuesta y tiempo. Automática por defecto con la configuración del sistema. Opciones avanzadas únicamente en Ajustes, con comprobación real. No hay proxies públicos integrados, credenciales incrustadas ni desactivación de TLS. Los clientes se renuevan como máximo cada 60 segundos para recoger cambios de configuración del sistema.
- Portada moderada, controles agrupados y letras visibles debajo en el panel derecho; cola al final. En pantallas de poca altura, el encabezado de la canción adopta una composición compacta.
- Vista ampliada en todo el área de la ventana, letra a la derecha y fondo derivado de la portada. La sincronización utiliza marcas temporales disponibles del proveedor; las letras sin marcas no se convierten en una sincronización inventada.
- Reproductor inferior con su composición conservada, mejor alineación, chevron de cierre integrado y zona de apertura que aparece al acercar el cursor. Sin listeners globales de movimiento.
- Aleatorio limitado a canciones guardadas, variedad de artistas y selección sin duplicados; avance automático y manual comparten reglas de cola y repetición.
- Tamaños de canción y portada más legibles, geometría suave y contornos consistentes. Estudio conserva la estructura, unifica el acabado de sus cuatro indicadores y elimina el resplandor de los segmentos del reloj.
- Iconografía vectorial; retirados emojis incorporados a la interfaz. Se conserva el contenido personal de notas y metadatos.
- Sin dependencias ni binarios adicionales.

## Verificación

- `pnpm run build`: TypeScript y Vite.
- `cargo test --manifest-path src-tauri/Cargo.toml music_network::tests -- --nocapture`: destinos permitidos y validación de proxy.
- `scripts/test-music-radio-611.ts`: selección, exclusión de vistas previas, conexión y repetición.
- `scripts/test-music-network-611.cjs`: consultas reales con conexión automática, directa y túnel HTTPS CONNECT local; canción Best Friend de Rex Orange County y portada; rechazo de destinos no permitidos.
- Pruebas de interfaz de música, reproducción real WAV, sala de escucha y regresión de cursos, tareas, notas, ajustes y pomodoro.

Las pruebas usan datos aislados y no instalan sobre la aplicación personal. Las pruebas de DOM y audio no certifican el comportamiento físico del cursor para todas las GPU.
