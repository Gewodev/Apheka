# APHEKA 6.7.3

22 de octubre de 2026 · Aplicación de escritorio · Hecho por Gewodev.

## Resultado

Esta versión incorpora una conexión MCP local en **Ajustes → Sistema → Conexión MCP** y corrige la gestión de pantalla completa, captura del puntero y sincronización de editores. Conserva el logo, la composición de los apartados y la carpeta de datos existente.

El instalador final está en `release/apheka_FINAL.exe`. Su versión, tamaño, SHA-256 y archivos de interfaz incrustados se verifican en `release/apheka_FINAL.json` al terminar el empaquetado. Los registros están en `release/build-6.7.3.log` y `release/build-6.7.3-error.log`; este último también recoge el progreso y los avisos normales del compilador.

Entrega comprobada: **78.369.794 bytes**, versión **6.7.3**, SHA-256 `D0090C60873E363E9A8EAEA4EC73C490985CB49F97E23073DFCD7C1C71BBF93D`. Se verificaron los ocho archivos principales de la interfaz dentro del ejecutable. El informe reproducible está en `docs/APHEKA-release-6.7.3.json`.

## Conexión MCP

El servidor se activa expresamente desde Ajustes y se apaga al cerrar la aplicación. Escucha únicamente en `127.0.0.1:38476/mcp`, con clave de acceso y validación de Host y Origin. Empieza en modo de solo lectura en cada apertura de APHEKA. «Permitir cambios» habilita las acciones de escritura; las eliminaciones y el reinicio del temporizador requieren confirmación dentro de APHEKA.

La clave HTTP se guarda en el perfil local de APHEKA, fuera de localStorage y de los respaldos de contenido. «Renovar clave» revoca la configuración HTTP anterior. El panel muestra actividad de la apertura actual, sin guardar argumentos, contenido de documentos ni claves en ese historial.

Hay 16 funciones:

| Función | Uso |
| --- | --- |
| `apheka_describe` | Consultar campos, unidades y operaciones admitidas. |
| `apheka_overview` | Resumen, temporizador, música y evento destacado. |
| `apheka_list` | Buscar por nombre o título y consultar elementos paginados. |
| `apheka_get` | Leer un elemento mediante su ID. |
| `apheka_create` | Crear un elemento con campos validados. |
| `apheka_update` | Modificar únicamente los campos indicados. |
| `apheka_delete` | Eliminar con confirmación local; las notas pasan a papelera. |
| `apheka_subtask` | Crear subtareas y marcar su estado. |
| `apheka_habit_day` | Registrar o retirar una fecha de cumplimiento. |
| `apheka_feature_event` | Destacar un evento vigente o retirar el destacado. |
| `apheka_timer` | Iniciar, pausar, vincular, desvincular y elegir modo. |
| `apheka_timer_reset` | Reiniciar con confirmación local. |
| `apheka_music` | Reproducir la biblioteca existente, volumen, búsqueda, cola y modos. |
| `apheka_navigate` | Abrir apartados y detalles existentes en la misma ventana. |
| `apheka_settings_get` | Consultar las preferencias admitidas. |
| `apheka_settings_update` | Cambiar preferencias dentro de los límites de la interfaz. |

Los apartados consultables son tareas, notas, carpetas, cursos, hábitos, eventos del planificador, sesiones planificadas, historial de estudio, canciones, listas, artistas, agrupaciones, temas, materiales y flashcards. El historial de estudio es de consulta. Las canciones permiten cambiar favoritos y controlar la reproducción; su importación, renombrado y eliminación de audio permanecen en la interfaz.

Los banners, archivos, descargas, credenciales, cuentas externas y comandos del sistema se gestionan desde la aplicación. Los materiales creados con herramientas especializadas conservan su editor específico. No se expone una operación para ejecutar código o modificar almacenes arbitrarios.

### Cómo conectarlo

1. Abre APHEKA y activa la conexión en Ajustes → Sistema.
2. Empieza con solo lectura. El panel distingue un servidor activo de solicitudes realmente recibidas.
3. Para un cliente local compatible con stdio, utiliza «Copiar conexión local». El cliente ejecuta el mismo programa instalado con `--mcp`; no abre otra ventana ni requiere Node.js.
4. Para un cliente HTTP que permita una cabecera Authorization, utiliza «Copiar conexión HTTP». Esa configuración contiene una clave privada.
5. Para ChatGPT, configura un **Secure MCP Tunnel** de tu organización con el transporte **stdio**, el ejecutable que copia el panel y el argumento `--mcp`. Después añade el túnel como MCP personalizado en ChatGPT. La configuración del túnel requiere los permisos y la clave de ejecución de tu cuenta; esta versión no crea ni vincula automáticamente esas credenciales.
6. Prueba primero «Consulta mi resumen de APHEKA». Después, si habilitas cambios, solicita una acción concreta y comprueba su resultado en la app.

La dirección localhost por sí sola no conecta ChatGPT. La vía documentada para mantener el servidor privado es el [túnel MCP de OpenAI](https://developers.openai.com/api/docs/guides/secure-mcp-tunnels). El [onboarding oficial de tunnel-client](https://github.com/openai/tunnel-client/blob/master/docs/onboarding.md) explica el perfil stdio, la comprobación de salud y la asociación con ChatGPT. La vinculación de una cuenta real no se ha probado en esta entrega.

### Guardado y solicitudes

Las operaciones usan las acciones existentes de AppContext y el almacén real del planificador. Las escrituras se ejecutan en serie. Antes de operar se guardan los borradores abiertos; después de modificar una nota, se sincroniza su editor antes del siguiente guardado. El guardado desde MCP conserva el estado del temporizador y espera las capas de persistencia disponibles. Las escrituras del espejo nativo se ordenan para evitar que una anterior sobrescriba una más reciente.

Las solicitudes tienen caducidad, límite de cola y comprobación previa a la ejecución. Desactivar cambios, apagar la conexión o renovar la clave cancela solicitudes que todavía no se han aplicado. Una acción ya aplicada no se deshace al desconectar. Si se pierde una respuesta, se debe consultar el elemento antes de repetir una creación.

Las consultas omiten los campos de credenciales, rutas de archivos, portadas y datos binarios de adjuntos. El contenido de una nota se devuelve como texto HTML y puede conservar referencias a recursos incrustados. El texto tiene un límite de 30.000 caracteres con una marca de truncamiento; las colecciones anidadas se consultan por separado. Las listas están paginadas y las respuestas excesivas se rechazan de forma explícita.

## Correcciones incluidas

- Pantalla completa usa una sola transición de ventana nativa. Comprueba el estado real, impide operaciones simultáneas, recupera el foco del contenido y libera los controles si una llamada no responde.
- Esc cierra primero un diálogo abierto. Después permite salir de pantalla completa incluso al cambiar de apartado; F11 también controla la pantalla completa.
- El reproductor emergente libera la captura y restaura el cursor al terminar un arrastre, cancelar, perder el foco, cambiar el tamaño de ventana u ocultarse.
- La búsqueda de posición musical se cancela correctamente al perder el foco o cambiar de canción. Se limpia el estado de arrastre cancelado de tareas.
- Cambiar el estado o curso de una tarea actualiza los contadores correspondientes y su fecha de finalización. Eliminar o alternar una tarea no aplica dos veces el ajuste de contadores durante la comprobación doble de React.
- Cambiar el nombre o color de un curso actualiza sus tareas, notas y carpeta asociadas.
- Notas, carpetas, cursos y subtareas nuevos usan IDs resistentes a altas rápidas. La creación de un curso genera una sola carpeta incluso bajo la comprobación doble de React.
- Eliminar un curso retira también sus sesiones planificadas asociadas. Las sesiones inexistentes, completadas o vencidas no se aceptan para nuevos vínculos MCP.
- Se sanea también el enlace de elementos SVG pegados en los editores.
- La lógica de acciones MCP se carga cuando se necesita, para reducir el trabajo inicial de la interfaz.

## Validación

- Compilación TypeScript e interfaz de producción sin errores.
- 14 pruebas Rust aprobadas: protocolo HTTP MCP, autenticación, Origin/Host, modo de solo lectura, clave y aviso de actualización.
- Ejecutable stdio de producción: JSON por líneas, ausencia de otra ventana o mensajes de inicio, rechazo con la conexión apagada, notificaciones sin respuesta y errores de sintaxis.
- 105 aserciones lógicas de reloj, rachas, elegibilidad de vínculos, analíticas, instantáneas, planificación, horarios y datos de herramientas.
- Pruebas de interfaz MCP: CRUD, entidades anidadas, preferencias, temporizador, guardado activo, caducidad, confirmación/cancelación, edición simultánea, solicitudes paralelas y recarga.
- Ocho apartados a 900, 1024, 1200 y 1440 píxeles, con menú abierto y cerrado; sin desbordamiento horizontal en esos escenarios.
- Notas y apuntes: espacios, tildes, historial/cursor, pegado, guardado inmediato y sincronización con MCP.
- Revisión de subtareas, cambio de vínculo, aviso de notificaciones, reloj del pomodoro y banner de curso.
- Prueba del puente de pantalla completa con respuestas nativas simuladas: foco, F11, prioridad de Esc y rechazo sin recurrir a otro modo de pantalla. Prueba real de eventos del puntero en navegador.

El bloqueo intermitente del cursor en la ventana de escritorio no llegó a reproducirse en la revisión anterior. La revisión de la nueva ventana nativa aislada se interrumpió durante la sesión de herramientas; no se cuenta como una prueba completada. Tampoco se ha ejecutado este instalador sobre la instalación personal para probar la migración con datos reales. Los avisos de tamaño del módulo Cursos y de una dependencia de metadatos de audio siguen presentes en la compilación; no se han convertido en errores ni se han ocultado.

## Datos e instalación

Se conserva `com.owa.studio` como identidad y carpeta de datos para actualizar la instalación existente. El producto visible es APHEKA 6.7.3. El instalador mantiene la detección de versiones anteriores de APHEKA y de las identidades conocidas de OWA, con preservación de AppData. La ventana de novedades aparece para una actualización detectada, no en una primera instalación, y conserva el crédito Gewodev.

## Integraciones siguientes propuestas

Estas son recomendaciones de producto, no funciones añadidas en esta versión. La prioridad y el esfuerzo son estimaciones basadas en la estructura actual.

| Prioridad | Integración | Impacto esperado | Esfuerzo estimado | Primer alcance |
| --- | --- | --- | --- | --- |
| 1 | Exportación de flashcards a Anki | Alto para repaso; evita copiar tarjetas una por una | Bajo a medio | Exportación de texto/CSV con campos y etiquetas; comprobar duplicados antes de automatizar sincronización. |
| 2 | Zotero local | Alto para estudiar con fuentes y bibliografía | Medio | Consulta autorizada de colecciones y referencias, vinculadas a cursos y notas; empezar sin escritura. |
| 3 | iCalendar/ICS | Alto para reutilizar horarios sin cuentas adicionales | Medio | Exportación e importación de eventos con ID estable, zona horaria y recurrencias; vista previa antes de importar. |

Anki admite [importación de archivos de texto](https://docs.ankiweb.net/importing/text-files.html). Zotero ofrece una [API local](https://www.zotero.org/support/dev/web_api/v3/local_api) que requiere habilitación en su propia configuración. El formato de intercambio de calendarios se define en [iCalendar, RFC 5545](https://www.rfc-editor.org/rfc/rfc5545.html).
