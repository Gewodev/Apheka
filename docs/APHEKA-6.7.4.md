# APHEKA 6.7.4

Hecho por Gewodev. Aplicación de escritorio; conserva la identidad y la carpeta de datos de las versiones anteriores.

## Correcciones

- **PDF:** Chrome, Edge, Firefox, Brave, Opera y los visores elegidos reciben la ruta real del archivo en un único argumento. Se recuperan las rutas heredadas `asset.localhost` antes de la apertura externa; nunca se envían al navegador. Se comprueban los archivos existentes y se mantiene la recuperación por nombre de archivos movidos. Los recursos incrustados se preparan como archivos antes de abrirlos. Corregida también la lectura de Blob con FileReader.
- **Cursor y reproducción:** el cambio de pantalla completa recupera el foco y el puntero nativo. La recuperación adicional responde a movimiento real del ratón, reproducción y cambios de tamaño, agrupa solicitudes y tiene límite de espera. En Windows solo actúa sobre la ventana principal enfocada y sobre el cursor oculto dentro de ella, respetando la supresión por uso táctil. No cambia preferencias del sistema, ni mueve el ratón, ni reinicia la canción. El motor de YouTube oculto no toma el foco de teclado ni solicita su propia pantalla completa.
- **Cursos con menú abierto:** distribución por ancho disponible, columnas con mínimos adaptables y herramientas del tema debajo del contenido cuando falta espacio. Las tarjetas no imponen un ancho superior al del contenedor. Se conserva la posición lateral de herramientas en ventanas amplias.
- **Empaquetado:** verificación por contenido de las fuentes antes/después de compilar; un cambio de fecha de Cargo sin cambio de contenido ya no invalida un paquete correcto. La entrega final es el instalador NSIS `release/apheka_FINAL.exe`.

## Complemento MCP

En **Ajustes → Sistema → Conexión MCP** puedes activar acceso local, elegir solo lectura o permitir cambios, personalizar el nombre y las instrucciones, copiar un prompt y exportar la configuración del cliente.

21 herramientas y 19 colecciones de datos. Además de tareas, subtareas, notas, carpetas, cursos, hábitos, eventos, sesiones, música y preferencias, incluye:

- Agrupaciones, temas, materiales y fuentes. Las fuentes web conservan su URL verificable; los archivos locales se consultan por su ID guardado.
- Flashcards y ocho mazos: Flashcards, Prueba, Emparejar, Completar, Feynman, Verdadero/Falso, Secuencias y Categorizar.
- Las 25 técnicas restantes de Cursos, con sus campos reales: Cornell, Blurting, Mnemotecnia, Leitner, repaso espaciado y las demás técnicas existentes.
- Carpetas anidadas de herramientas, renombrado de rutas y descendientes, etiquetas, orden y movimientos entre temas del mismo curso.
- Lectura completa de texto por partes y extracción de PDF por páginas. Hasta 20 MB y cinco páginas por llamada; el texto de cada página también admite paginación.

### Conexión real

1. Abre APHEKA y activa MCP. Empieza con solo lectura.
2. En un cliente local compatible con MCP por stdio, utiliza **Copiar conexión local** o **Exportar configuración**. El ejecutable instalado se inicia con `--mcp`; no abre otra interfaz ni requiere Node.js.
3. Para ChatGPT usa un Secure MCP Tunnel de OpenAI configurado con ese transporte stdio y añade el MCP personalizado en tu cuenta. Esto requiere permisos y configuración del servicio en esa cuenta; no queda conectado automáticamente al instalar APHEKA.
4. Copia el prompt personalizado al asistente y comprueba que puede llamar a `apheka_describe` y `apheka_overview`. El panel de actividad confirma las solicitudes recibidas.
5. Habilita cambios cuando los necesites. Las eliminaciones se confirman dentro de APHEKA. Puedes desactivar el servidor o renovar la clave HTTP.

Guías oficiales: [Secure MCP Tunnel](https://developers.openai.com/api/docs/guides/secure-mcp-tunnels) y [MCP personalizado en ChatGPT](https://developers.openai.com/api/docs/guides/custom-mcp-server).

### Límites explícitos

Un prompt no instala ni conecta un servidor. El asistente investiga con sus propias herramientas; APHEKA no afirma haber leído una URL por haberla guardado. Los PDF escaneados necesitan OCR; no se extrae texto inexistente. Adjuntar archivos arbitrarios, grabar audio, descargar música, administrar cuentas o ejecutar comandos del sistema no se habilita mediante estas herramientas. El historial de estudio real sigue siendo de consulta. Los IDs de carpetas de herramientas son sus rutas y cambian al renombrarlas; la respuesta devuelve el nuevo ID.

## Validación

- TypeScript sin errores; 16 pruebas nativas Rust aprobadas, incluidos transporte/permisos MCP y rutas reales con espacios y Unicode.
- Pruebas existentes de CRUD, StrictMode, contadores, persistencia, notas abiertas y solicitudes paralelas aprobadas.
- Los ocho mazos, las 25 técnicas, carpetas anidadas, fuentes, PDF/texto, etiquetas, movimientos y orden se probaron a través del puente MCP real del frontend, con persistencia al recargar.
- Audio WAV real en IndexedDB: clic en el reproductor, tres ciclos de pantalla completa, tiempo continuo y pausa/reanudación. Comprobación adicional de recuperación nativa simulada, Escape, F11 y liberación de captura del reproductor emergente.
- Menú de PDF comprobado para los cinco navegadores con rutas directas y heredadas. Se verifican los argumentos nativos sin abrir documentos personales en esos navegadores.
- Cursos comprobado a 800, 900, 1000, 1200 y 1440 px, con navegación abierta/cerrada, sin cruce de paneles ni desbordamiento horizontal.
- La desaparición visual intermitente del puntero de Windows no se reprodujo de forma concluyente en la instancia nativa aislada. La corrección está implementada; las pruebas de navegador no equivalen a confirmar el renderizado del cursor físico en cada controlador gráfico.
