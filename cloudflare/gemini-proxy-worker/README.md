# Proxy Worker: Claude Code ↔ Gemini (Google AI Studio)

Worker de Cloudflare que convierte la API Anthropic Messages (que usa Claude Code)
en la API de Google Gemini. Permite usar Claude Code con los modelos Gemini de tu cuenta
de Google AI Studio sin cambiar el cliente.

## Contrato

| Endpoint            | Uso                                              |
|---------------------|--------------------------------------------------|
| `GET /v1/models`    | Lista modelos Gemini (y OpenRouter si se configura) |
| `POST /v1/messages` | Chat (streaming o no)                            |
| `POST /v1/messages/count_tokens` | Conteo aproximado de tokens     |
| `POST /v1/chat/completions` | Alias OpenAI-compatible                  |

## Ruta de modelos

- `gemini-*`  → Google Gemini (`GEMINI_API_KEY`)
- cualquier otro → OpenRouter (token del cliente)

## Despliegue

```bash
cd cloudflare/gemini-proxy-worker
npx wrangler deploy
npx wrangler secret put GEMINI_API_KEY   # clave de Google AI Studio
npx wrangler secret put PROXY_TOKEN      # token que enviará Claude Code
```

## Configuración de Claude Code

Edita `~/.claude/settings.json`:

```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "https://<tu-worker>.workers.dev",
    "ANTHROPIC_AUTH_TOKEN": "<PROXY_TOKEN>",
    "ANTHROPIC_API_KEY": "",
    "ANTHROPIC_DEFAULT_OPUS_MODEL": "gemini-4-carbon",
    "ANTHROPIC_DEFAULT_SONNET_MODEL": "gemini-4-argon",
    "ANTHROPIC_DEFAULT_HAIKU_MODEL": "gemini-4-hydrogen",
    "CLAUDE_CODE_SUBAGENT_MODEL": "gemini-4-hydrogen"
  }
}
```

## Modelos recomendados (Google AI Studio)

| Rol     | Modelo              | Uso                                      |
|---------|---------------------|------------------------------------------|
| Opus    | `gemini-4-carbon`   | Razonamiento complejo, código, planes    |
| Sonnet  | `gemini-4-argon`    | Tareas de media complejidad, eficiencia  |
| Haiku   | `gemini-4-hydrogen` | Consultas rápidas, subagentes             |