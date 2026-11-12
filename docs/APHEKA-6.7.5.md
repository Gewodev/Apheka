# APHEKA 6.7.5

Correcciones del 23 de octubre de 2026. Instalador final: `release/apheka_FINAL.exe`.

## Cursor y pantalla completa

Windows dispone de **Usar cursor compatible**, activado por defecto, en Ajustes → Sistema. Durante la pantalla completa dibuja el cursor en la propia interfaz y oculta el cursor de hardware mientras recibe movimiento del ratón. Funciona con o sin reproducción. Fuera de pantalla completa, al perder foco, al abandonar la ventana o al desactivarlo, se restaura el cursor normal.

El dibujo no captura eventos, no cambia la posición del ratón, no interfiere con selección de texto y no modifica preferencias de Windows. Las actualizaciones se agrupan con requestAnimationFrame; no hay un bucle continuo ni una actualización de React por movimiento. Mantiene una flecha, indicador de texto, mano y señales de movimiento o acción no permitida. La opción puede desactivarse para conservar el cursor personalizado del sistema.

El síntoma descrito, movimiento detectado por los controles pero cursor visual fijo, es compatible con un problema de representación. No se ha demostrado una causa única en el controlador gráfico del equipo. La solución evita depender de esa representación. No desactiva globalmente la aceleración gráfica: Microsoft recomienda conservarla salvo durante diagnóstico. [Rendimiento de WebView2](https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/performance).

## Cursos

La proporción 16:10 y la altura mínima de 220 px imponían un ancho mínimo de 352 px a tarjetas cuyos carriles podían medir menos. Ahora cada tarjeta respeta el ancho real de su columna con min-width:0, width:100% y border-box. La cuadrícula también permite un único carril menor de 280 px.

Se eliminan las escrituras de transform al pasar el ratón y las transiciones de todas las propiedades. El arrastre conserva su transform independiente, el desplazamiento de vecinos y la persistencia del orden.

## Complementos e IA

**Conectores IA**, en la cabecera de Ajustes, abre directamente el apartado. Hay ocho perfiles, un botón visible para copiar el prompt y una vista editable de preferencias con el prompt completo siempre expuesto. Configuración y prompt cumplen funciones distintas: primero se registra el servidor en el cliente, después se usa el prompt para orientar el trabajo.

| Perfil | Configuración y referencia oficial |
| --- | --- |
| Otro asistente o IDE | JSON mcpServers, JSON servers o TOML mcp_servers; stdio o HTTP local con Authorization. [Clientes locales MCP](https://modelcontextprotocol.io/docs/develop/connect-local-servers). |
| Claude Desktop | JSON en `%APPDATA%\Claude\claude_desktop_config.json`. [Guía local](https://modelcontextprotocol.io/docs/develop/connect-local-servers). |
| Claude Code | `.mcp.json` del proyecto, con sus autorizaciones. [MCP en Claude Code](https://code.claude.com/docs/en/mcp). |
| Codex | TOML en `~/.codex/config.toml`. [MCP en Codex](https://developers.openai.com/codex/mcp/). |
| Cursor | JSON en `~/.cursor/mcp.json` o `.cursor/mcp.json`. [MCP en Cursor](https://cursor.com/docs/mcp). |
| VS Code | Formato servers y type:stdio en `.vscode/mcp.json`; otros agentes pueden usar mcpServers. [Referencia de formatos](https://code.visualstudio.com/docs/agents/reference/mcp-configuration). |
| Gemini CLI | mcpServers en `~/.gemini/settings.json`. [MCP en Gemini CLI](https://geminicli.com/docs/tools/mcp-server/). |
| ChatGPT | Backend stdio para un Secure MCP Tunnel, con configuración externa y acceso de la cuenta u organización. El JSON generado describe el backend y no configura el túnel por sí solo. [Guía de túneles](https://developers.openai.com/api/docs/guides/secure-mcp-tunnels). |

Las configuraciones utilizan la ruta real del ejecutable que entrega el backend. No se adivina una ruta instalada. No se sobrescriben archivos de otros clientes. Copiar/exportar recupera la configuración vigente. Las claves HTTP quedan ocultas en la vista previa y no entran en el prompt ni en localStorage. Los permisos, confianza del proyecto, capacidades y políticas de la cuenta continúan bajo control de cada cliente y de APHEKA. El modo de solo lectura y las confirmaciones locales de eliminación se conservan.

## Enlaces y lectores

Abrir está disponible junto a Abrir con. Un navegador elegido para PDF se guarda como lector de PDF, separado del navegador de enlaces. La apertura respeta esa preferencia, con prioridad del curso sobre la global, y utiliza la ruta real del archivo. Los destinos asset.localhost heredados se convierten antes de llamar a aplicaciones externas.

## Validación

- TypeScript sin errores y compilación frontend de producción correcta.
- Doce tarjetas en seis anchos (800–1440), veinticuatro cambios de menú medidos durante la transición, sin intersecciones; arrastre, recarga y entrada al curso.
- Detalle de Cursos: resumen, estudio y temas, con ambas posiciones del menú y cinco anchos.
- Ocho perfiles MCP; JSON y TOML realmente analizado con tomllib, rutas Windows con tildes y comillas, configuración inválida y nombres personalizados.
- Panel nativo simulado: copiar los ocho formatos, exportar, activar/desactivar, preservar permiso antes de activar, ocultar claves y excluirlas del prompt y preferencias.
- Interfaz MCP en cuatro anchos, copia de prompt, persistencia y catálogo de 21 herramientas.
- CRUD MCP y todas las herramientas de estudio, lectura paginada de PDF/texto, aprobación, movimiento, reordenación y persistencia.
- Pantalla completa: foco, Esc, F11, cambios de apartado, cancelación de arrastres y limpieza del cursor compatible. Reproducción WAV real durante tres ciclos, sin reiniciar la fuente.
- Comprobación adicional en Windows WebView2 real: pantalla completa nativa sin música y con audio local, cursor dibujado siguiendo el movimiento, salida por clic y audio continuo. Se utilizó el frontend actual sobre el binario aislado APHEKA QA existente (metadatos 6.7.3); los datos de la aplicación personal no se utilizaron. Capturas `apheka-6.7.5-native-silent.png` y `apheka-6.7.5-native-audio.png`.
- Menú de PDF: Chrome, Edge, Firefox, Brave y Opera reciben la ruta real; selección, persistencia y apertura con Chrome como lector predeterminado, sin alterar el navegador de enlaces.

El paquete definitivo se valida con versión, SHA-256, firma del contenido de las fuentes antes/después y presencia de los assets actuales dentro del ejecutable. El manifiesto se publica junto al instalador. Queda una advertencia no bloqueante de tamaño del módulo Cursos. El instalador no se ejecuta automáticamente sobre la instalación personal.

La primera comprobación de inmutabilidad detectó la reescritura automática de Cargo.toml por Tauri a las 04:01:18 UTC, antes de compilar. La auditoría no encontró otros cambios de fuentes durante el build. Se verificó después el paquete generado contra la fecha de todas las fuentes, versión, assets principales y de vistas, y SHA-256. Verificación final completada.

SHA-256: `BF375E953DDD2B526E2C65638FFB2949253C0A8AD7C91959B5F533F71D46A2B7`. Tamaño: 78818313 bytes.
