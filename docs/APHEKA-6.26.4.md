# APHEKA 6.26.4

Corrección puntual del 9 de noviembre de 2026 sobre 6.26.3: cursor invisible después de cerrar el contador emergente con la X.

La recuperación anterior dependía de la notificación inicial de foco y del modo de pantalla completa. Ahora también se recupera la entrada en ventanas maximizadas o restauradas. La destrucción real de la ventana `floating-timer` solicita dos recuperaciones diferidas, a los 80 y 320 ms, para cubrir el final del cierre de WebView2. Solo se actúa si la ventana principal sigue visible y tiene el foco; no se trae la app al frente de otras aplicaciones.

Windows recibe una solicitud de actualización del cursor dirigida al control que está bajo el puntero. Esto permite conservar el cursor de texto o de enlace. Si el cursor nativo está oculto, se conserva la recuperación acotada de visibilidad. Se respeta la supresión de cursor por entrada táctil o lápiz. No se mueve el puntero ni se cambian ajustes del sistema.

El comportamiento de `WM_SETCURSOR` y del contador de visibilidad se contrasta con la [documentación de Microsoft sobre cursores](https://learn.microsoft.com/windows/win32/menurc/about-cursors). No se presupone que todos los fallos de dibujo de cada controlador gráfico tengan la misma causa.

La recuperación no usa sondeo periódico ni se ejecuta por cada movimiento del ratón. Las solicitudes simultáneas del cierre se agrupan. No se cambia el funcionamiento del temporizador ni el diseño de la app.

Los informes de comprobación y los metadatos del instalador se guardan junto a la entrega de esta revisión. Las pruebas se realizan con el identificador aislado `com.apheka.qa`, sin sustituir la instalación personal.

## Verificación

- TypeScript correcto. Ocho comprobaciones del flujo React/IPC controlado, incluyendo recuperación en ventana maximizada y normal, agrupación de avisos, ausencia de sondeo, aislamiento de otras ventanas y Escape/F11.
- Nueve cierres reales con la X del componente FloatingTimer en Windows/Tauri/WebView2: tres con la app maximizada, tres en pantalla completa y tres en ventana normal. Los botones siguen respondiendo, sin errores de ejecución. En los seis casos en primer plano también se verifica el foco del contenido; las tres muestras restantes conservan el primer plano de la otra aplicación.
- En los seis casos de ventana maximizada y pantalla completa, la instancia de prueba tenía el primer plano y el puntero estaba sobre ella: `GetCursorInfo` devolvió cursor visible y un identificador de cursor válido. En las tres muestras de ventana normal, la posición o el primer plano no permitían atribuir esa comprobación a la app y se omite explícitamente. Esto verifica el estado nativo informado por Windows, no la representación física de todos los controladores gráficos.
- Informes: `release/qa-6264-pointer-resume.json` y `release/qa-6264-native-timer-close.json`. La consulta de Win32 es de solo lectura. La instancia de prueba se cierra al terminar; se conserva la instalación personal 6.26.3.

## Instalador

Compilación completa correcta en 11 min 43 s: frontend 37,74 s, Rust optimizado 6 min 39 s y empaquetado. Se verifican versión, recursos del frontend incrustados, integridad del paquete y estabilidad de fuentes, herramientas y recursos durante la compilación.

Archivo `release/APHEKA_6.26.4_Instalador_x64.exe`, **115 447 147 bytes**, SHA-256 **D1BAF1A3C698A8584A44AE8C371E70CFD57B0E9753C9E1C670AD9C3E0F30E6CA**. Coincide con el paquete final y declara 6.26.4. Metadatos en `APHEKA-release-6.26.4.json`. Se conserva la reutilización de dependencias de la versión anterior y el identificador de datos existente.
