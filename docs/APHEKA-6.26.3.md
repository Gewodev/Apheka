# APHEKA 6.26.3

Corrección puntual del 8 de noviembre de 2026 sobre 6.26.2. Se conserva el diseño y el resto de las funciones.

Al regresar del contador emergente a la ventana principal que ya está en pantalla completa, se recuperan el foco del contenido y el cursor nativo. Antes, el retorno solo consultaba si había cambiado el modo de pantalla; al seguir en pantalla completa, no ejecutaba la recuperación de entrada.

La recuperación se activa al regresar el foco o la visibilidad. Al ocultar el contador con su botón, también se devuelve expresamente el foco a la ventana principal. El contador se conserva abierto y el temporizador sigue funcionando. Las llamadas simultáneas se agrupan, con espera acotada y sin sondeo continuo; una ventana que no tiene el foco no intenta recuperarlo.

## Comprobaciones

- TypeScript sin errores.
- Controlador de pantalla completa: operaciones serializadas, Escape durante una transición, errores y tiempos agotados, y descarte de consultas antiguas.
- Recuperación de cursor: agrupación, límite de frecuencia y aislamiento de errores.
- Flujo React ejecutado en Edge con las comunicaciones de Tauri simuladas: retorno de foco sin cambiar de pantalla completa ni destruir la ventana auxiliar; recuperación al volver a ser visible; ausencia de interferencia con otras ventanas; treinta avisos simultáneos agrupados en una recuperación; sin llamadas periódicas ni bucle de foco; Escape en diálogos, F11 y rechazo de una operación nativa.

Informe del flujo: `release/qa-6263-pointer-resume.json`. Estas comprobaciones no reproducen físicamente el cursor de Windows ni todos los controladores gráficos. No se modifica la instalación personal durante la preparación.

El instalador conserva la reutilización por contenido de los recursos de dictado y música, y las correcciones previas de artistas y biblioteca. Los datos definitivos de versión, tamaño e integridad de esta compilación se registran en `APHEKA-release-6.26.3.json`.

Compilación completa correcta en 12 min 31 s: frontend 47,40 s y Rust optimizado 7 min 17 s, más empaquetado y comprobaciones. Fuentes, recursos y herramientas estables durante el proceso. Instalador: `release/APHEKA_6.26.3_Instalador_x64.exe`, 115 470 567 bytes, SHA-256 **BED2CA9C83166E88E7760820F3D7EDC939A04B752A9D7290C3AE5C7866FD06C4**. La copia coincide con el paquete final y declara la versión 6.26.3.
