# Proveedores musicales — revisión 6.10

Se prioriza la identidad de la grabación sobre la cantidad de resultados. No se anuncia una integración como activa cuando necesita credenciales que este proyecto no tiene.

| Fuente | Uso en APHEKA 6.10 | Condición y motivo |
|---|---|---|
| YouTube Music / YouTube.js | Activa: búsqueda musical, artistas, álbumes y portadas; reproducción con el reproductor de YouTube existente | Consulta estructurada de canciones, no resultados genéricos de vídeos. API no oficial: su disponibilidad puede cambiar. Búsqueda sin ejecutar yt-dlp ni FFmpeg. |
| Audius | Activa como complemento acotado de la búsqueda unificada | Perfil verificado, portada, duración musical, sin remezclas ni categorías de voz; coincidencia de todos los términos. Un perfil verificado no certifica derechos sobre cada grabación. Descarga directa solo cuando el proveedor la permite. |
| LRCLIB | Activa: letra y marcas temporales | Consulta automática y caché. Solo se sincroniza cuando la fuente aporta marcas reales para esa grabación; no se inventan tiempos. |
| Spotify | Investigada; sin conexión de cuenta en esta versión | Registro de aplicación, autorización y condiciones del servicio. No es un catálogo de audio completo anónimo. |
| Apple Music | Investigada; sin conexión de cuenta en esta versión | Requiere la integración y autorización propias del servicio para reproducir su catálogo. No se presenta una vista previa como canción completa. |
| SoundCloud | Investigada; sin conexión de cuenta en esta versión | La API exige aplicación registrada y autorización, también para consultas públicas mediante credenciales de cliente. No se reutilizan secretos de otras apps. |
| Jamendo | Investigada; pendiente de client_id propio | API documentada y permiso individual de descarga. No se coloca una clave ficticia ni se ignora audiodownload_allowed. |
| MusicBrainz | Investigada como fuente de identidad, no de audio | Base de metadatos; User-Agent significativo y límite de una petición por segundo. Deben revisarse las condiciones comerciales antes de activarla en un producto comercial. |
| Cover Art Archive | Investigada como complemento de MusicBrainz | Portadas catalogadas por la comunidad; no se etiqueta toda imagen como subida oficial del artista. No aporta audio. |
| Deezer | Endpoint público de metadatos evaluado; no conectado como fuente de reproducción | Una vista previa no equivale a reproducción completa. No se usa como audio sustituto de una canción ni se promete todo su catálogo. |

La búsqueda «Best Friend de Orange» se comprobó contra la consulta real unificada: devolvió «Best Friend» de Rex Orange County con portada. Las pruebas separadas descartan canciones homónimas de otros artistas, variantes no pedidas y duplicados. Esta comprobación no garantiza disponibilidad perpetua ni derechos de todas las entradas de un proveedor.

Fuentes primarias consultadas:

- [YouTube.js: inicio y configuración](https://ytjs.dev/guide/getting-started)
- [Zuno: arquitectura y funciones actuales](https://github.com/noFAYZ/zuno)
- [Limusic: implementación y dependencias](https://github.com/SimoHypers/limusic)
- [Audius API](https://docs.audius.co/api/)
- [Audius: búsqueda avanzada](https://help.audius.co/product/advanced-search)
- [Spotify Web API](https://developer.spotify.com/documentation/web-api)
- [Spotify: modos y cuotas](https://developer.spotify.com/documentation/web-api/concepts/quota-modes)
- [Apple Music API](https://developer.apple.com/documentation/applemusicapi)
- [SoundCloud: autenticación y reproducción](https://developers.soundcloud.com/docs/api/guide)
- [Jamendo: descarga y permiso del artista](https://developer.jamendo.com/v3.0/tracks/file)
- [MusicBrainz API](https://musicbrainz.org/doc/MusicBrainz_API)
- [MusicBrainz: límites](https://musicbrainz.org/doc/Rate_Limiting)
- [Cover Art Archive API](https://musicbrainz.org/doc/Cover_Art_Archive/API)

No se mezclan grabaciones de archivos generales, efectos de sonido ni lecturas con un catálogo comercial fingido. Se mantiene la biblioteca local y el uso de herramientas de descarga ya instaladas, únicamente al solicitar una descarga.
