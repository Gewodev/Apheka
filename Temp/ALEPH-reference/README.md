# MAVERICK

Plataforma de chat IA profesional con **razonamiento visible**, **sandbox de previsualización en vivo** y **ejecución real de código**. Un solo motor: **X0**.

## Arquitectura

```
├── client/            React 19 + TypeScript + Vite + Tailwind + shadcn/ui
│   └── src/pages      Landing · Auth (Google + email) · Chat · Pricing · Terms · Asistente
├── server/            Node + Express (ESM)
│   ├── src/routes-auth.js      Registro, login, Google OAuth, JWT
│   ├── src/routes-chat.js      Conversaciones + streaming SSE con razonamiento
│   ├── src/routes-billing.js   Stripe: checkout, portal, webhook firmado
│   └── src/routes-sandbox.js   Ejecución de JS/Python/bash con timeout
├── desktop/           MAVERICK Desktop (Tauri 2, Rust + TS): Mav vive en la
│                      parte superior de la pantalla (Windows/Linux), chat con
│                      la cuenta MAVERICK (sin claves de terceros) y sync con
│                      las conversaciones de la web. Fork bajo licencia MIT.
└── package.json       `npm run dev` levanta server (:8787) + client (:3000)
```

Base de datos: **Neon Postgres**. Esquema: `users`, `conversations`, `messages`, `subscriptions`, `usage_daily`.

## Modelo

| Público | Rol |
|---|---|
| **X0** | Único motor: razonamiento visible, búsqueda web, ejecución de código y generación de documentos. Disponible en todos los planes. |

El nombre del modelo upstream vive solo en `server/src/models.js` y nunca se expone al cliente.

## Puesta en marcha

```bash
npm run setup   # instala client + server
npm run dev     # http://localhost:3000  (API en :8787, proxied)
```

## Conectar pagos (Stripe)

1. Crea los productos/precios en Stripe y copia sus **price IDs**.
2. Rellena en `server/.env`: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_*` (month/year por plan).
3. Webhook: `https://tu-dominio/api/billing/webhook` con eventos de suscripción.

Sin estas claves, el checkout responde `billing_not_configured` y el resto de la app funciona igual.

## Conectar login con Google

1. En https://console.cloud.google.com/apis/credentials crea un **OAuth Client ID** (Web).
2. Orígenes autorizados: `http://localhost:3000` (y tu dominio en producción).
3. Pon el Client ID en `GOOGLE_CLIENT_ID` de `server/.env`. El botón oficial de Google aparece solo en login/registro.

## Seguridad y límites

- JWT de 30 días, contraseñas con bcrypt, planes verificados en cada stream (gratis: 50 msg/día).
- Sandbox: directorio temporal por usuario, timeout 15 s, salida acotada a 64 KB. **Para producción**, ejecútalo en un contenedor aislado (gVisor/Firecracker).
- La API key del proveedor de inferencia vive solo en `server/.env` (nunca llega al navegador). Rota la key si se expone.

## MAVERICK Desktop (asistente para PC)

Vive en la parte superior de la pantalla (Windows), sin notch. Descarga pública
desde la web (`/asistente`): `client/public/descargas/MAVERICK-Desktop-Setup.exe`.

```powershell
cd desktop
npm install
npm run icons    # genera los iconos de marca en src-tauri/icons
npm run pack     # instalador NSIS/MSI en desktop/release/ → copia a client/public/descargas/
```

- Chat con la cuenta MAVERICK (`Ajustes → MAVERICK → Iniciar sesión`): usa la misma API del servidor (`/api/chat/stream`), así las conversaciones se sincronizan automáticamente con la web. **Sin claves de terceros** (nada de Anthropic/OpenAI).
- Sin telemetría; el token de sesión vive en el Credential Manager (Windows) o Secret Service (Linux).
- La URL base de la API se ajusta en `desktop/src-tauri/src/settings.rs` (`default_api_url`).
