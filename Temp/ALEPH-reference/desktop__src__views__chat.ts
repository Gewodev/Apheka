// Chat view — DOM port of PromptView / ChatBubble / TypingDotsView from
// IslandViewContent.swift.

import { h, svg, clear } from "./dom";
import { ICONS } from "./icons";
import { Bridge, type ChatContext } from "../core/bridge";
import { Sound } from "../core/sound";
import { State, type ChatMessage, type ComputerAction } from "../core/state";
import type { ViewHost } from "./views";

let nextId = 1;
let nextActionId = 1;

function bubble(message: ChatMessage): HTMLElement {
  if (message.role === "user") {
    return h(
      "div",
      { class: "chat-row user" },
      h("div", { class: "bubble", text: message.content }),
    );
  }
  const row = h("div", { class: "chat-row" }, h("div", { class: "reply", text: message.content }));
  for (const a of message.computerActions ?? []) row.append(actionCard(a));
  return row;
}

function actionCard(a: ComputerAction): HTMLElement {
  let spec: Record<string, unknown>;
  try {
    spec = JSON.parse(a.spec) as Record<string, unknown>;
  } catch {
    spec = { type: "unknown" };
  }
  const summary = summarize(spec);
  const row = h("div", { class: "action-card" });
  const head = h("div", { class: "action-head" },
    h("span", { class: "action-title", text: spec.type === "run_shell" ? `Ejecutar: ${summary}` : summary }),
  );
  row.append(head);

  const buttons = h("div", { class: "action-btns" });
  const allowBtn = h("button", { class: "action-allow", text: "Permitir" });
  const denyBtn = h("button", { class: "action-deny", text: "Negar" });
  buttons.append(allowBtn, denyBtn);

  const resultBox = h("div", { class: "action-result", style: "display:none" });

  function syncState() {
    row.classList.toggle("pending", a.status === "pending");
    buttons.style.display = a.status === "pending" ? "" : "none";
    resultBox.style.display = a.status === "done" || a.status === "denied" ? "" : "none";
    if (a.status === "done" && a.result) resultBox.textContent = a.result;
    if (a.status === "denied") resultBox.textContent = "Denegada.";
  }
  syncState();

  allowBtn.addEventListener("click", async () => {
    if (a.status !== "pending") return;
    a.status = "allowed";
    syncState();
    try {
      const result = await Bridge.runComputerAction(spec);
      a.result = JSON.stringify(result).slice(0, 4000);
      a.status = "done";
      // Devuelve el resultado a la conversación: la IA resume lo ocurrido.
      State.chatHistory.push({
        id: nextId++, role: "user",
        content: `[acción ejecutada: ${spec.type}] resultado: ${a.result}`,
      });
      State.notify();
      try {
        const reply = await Bridge.chatSend(`Resultado de la acción del usuario: ${a.result}`, null);
        pushAssistant(reply.text);
      } catch {
        State.chatHistory.push({ id: nextId++, role: "assistant", content: `Acción ejecutada: ${a.result}` });
        State.notify();
      }
      Sound.play("approve");
    } catch (err) {
      a.result = String(err);
      a.status = "done";
    }
    syncState();
    State.notify();
  });
  denyBtn.addEventListener("click", () => {
    if (a.status !== "pending") return;
    a.status = "denied";
    a.result = "El usuario denegó la acción.";
    syncState();
    State.notify();
  });
  return row;
}

function summarize(spec: Record<string, unknown>): string {
  switch (spec.type) {
    case "run_shell": return String(spec.command ?? "").slice(0, 90);
    case "open_app": return `Abrir ${String(spec.name ?? "")}`;
    case "open_path": return `Abrir ${String(spec.path ?? "")}`;
    case "open_url": return `Abrir ${String(spec.url ?? "")}`.slice(0, 90);
    case "read_file": return `Leer ${String(spec.path ?? "")}`;
    case "write_file": return `Escribir ${String(spec.path ?? "")}`;
    case "list_files": return `Explorar ${String(spec.path ?? "")}` + (spec.recursive ? " (recursivo)" : "");
    default: return String(spec.type ?? "acción");
  }
}

/** Extrae líneas `ACTION: {...}` de una respuesta. Devuelve texto limpio + acciones. */
async function parseActionsFrom(text: string): Promise<{ clean: string; actions: ComputerAction[] }> {
  const actions: ComputerAction[] = [];
  const clean = text
    .split("\n")
    .filter((line) => {
      const t = line.trim();
      if (!t.startsWith("ACTION:")) return true;
      const rest = t.slice(7).trim();
      try {
        const spec = JSON.parse(rest);
        if (spec && typeof spec === "object" && typeof spec.type === "string") {
          actions.push({ id: String(nextActionId++), spec: rest, status: "pending" });
          Sound.play("question");
        }
      } catch { /* línea rota: se descarta */ }
      return false;
    })
    .join("\n")
    .trim();
  const final = clean || "(acciones pendientes arriba)";
  return { clean: final, actions };
}

function pushAssistant(text: string) {
  State.chatHistory.push({ id: nextId++, role: "assistant", content: text });
  State.stateOverride = null;
  Sound.play("finish");
}

function typingDots(): HTMLElement {
  return h(
    "div",
    { class: "chat-row" },
    h("div", { class: "typing" }, h("i"), h("i"), h("i")),
  );
}

/** The coloured chip showing what the question is about (a dropped file). */
function contextChip(label: string): HTMLElement {
  const chip = h("div", { class: "chip" }, h("i", { class: "chip-dot" }), h("span", { text: label }));
  requestAnimationFrame(() => chip.classList.add("settled"));
  return chip;
}

export function buildPrompt(onHeightChange: () => void): ViewHost {
  const chipRow = h("div", { class: "chip-row" });
  const log = h("div", { class: "chat-log" });
  const input = h("input", {
    type: "text",
    class: "chat-input",
    placeholder: "Pregúntame lo que sea…",
    spellcheck: "false",
  }) as HTMLInputElement;
  const send = h("button", { class: "send-btn", title: "Enviar" }, svg(ICONS.arrowUp, 11));
  const bar = h("div", { class: "chat-bar" }, input, send);

  // Tarjeta de login: se muestra cuando no hay sesión MAVERICK.
  const loginEmail = h("input", { type: "email", class: "chat-input", placeholder: "tu@correo.com", autocomplete: "off", spellcheck: "false" }) as HTMLInputElement;
  const loginPass = h("input", { type: "password", class: "chat-input", placeholder: "Contraseña", autocomplete: "off" }) as HTMLInputElement;
  const loginBtn = h("button", { class: "send-btn", title: "Iniciar sesión" }, svg(ICONS.arrowUp, 11));
  const loginBar = h("div", { class: "chat-bar", style: "display:none" }, loginEmail, loginPass, loginBtn);
  const loginNote = h("div", { class: "reply", text: "Inicia sesión con tu cuenta MAVERICK. Las conversaciones se sincronizan con la web." });

  const el = h(
    "div",
    { class: "view" },
    h("div", { class: "card wash chat-card" }, h("div", { class: "chat-body" }, chipRow, log, bar, loginBar)),
  );
  (el.querySelector(".card") as HTMLElement).style.setProperty("--wash", "rgba(79,126,240,0.5)");

  let sending = false;
  let renderedCount = -1;
  let loggedIn = true;

  async function submit() {
    const query = input.value.trim();
    if (!query || sending) return;
    input.value = "";
    sending = true;
    Sound.play("send");

    State.chatHistory.push({ id: nextId++, role: "user", content: query });
    State.stateOverride = "thinking";
    State.notify();
    onHeightChange();

    const file = State.droppedFile;
    const context: ChatContext | null =
      State.chatHistory.length === 1 && file ? { kind: "file", name: file.name, path: file.path } : null;

    try {
      const reply = await Bridge.chatSend(query, context);
      const { clean, actions } = await parseActionsFrom(reply.text);
      pushAssistant(clean);
      if (actions.length) {
        State.chatHistory[State.chatHistory.length - 1].computerActions = actions;
      }
    } catch (err) {
      State.stateOverride = null;
      State.noteMessage = String(err).replace(/^Error:\s*/, "");
      State.view = "note";
      Sound.play("error");
    } finally {
      sending = false;
      State.notify();
      onHeightChange();
      input.focus();
    }
  }

  async function login() {
    const email = loginEmail.value.trim();
    const pass = loginPass.value;
    if (!email || !pass || sending) return;
    sending = true;
    Sound.play("send");
    // sync() detecta el cambio de sesión vía maverickStatus() y cambia de vista.
    try {
      await Bridge.maverickLogin(email, pass);
      loginPass.value = "";
    } catch (err) {
      State.noteMessage = String(err).replace(/^Error:\s*/, "");
      State.view = "note";
    } finally {
      sending = false;
      State.notify();
      onHeightChange();
    }
  }

  loginBtn.addEventListener("click", () => void login());
  loginPass.addEventListener("keydown", (e) => {
    if ((e as KeyboardEvent).key === "Enter") { e.preventDefault(); void login(); }
    e.stopPropagation();
  });

  send.addEventListener("click", () => void submit());
  input.addEventListener("keydown", (e) => {
    if ((e as KeyboardEvent).key === "Enter") {
      e.preventDefault();
      void submit();
    }
    e.stopPropagation(); // Escape cierra la isla, no el chat
  });

  return {
    el,
    sync() {
      const file = State.droppedFile;
      const wantChip = file?.name ?? "";
      if (chipRow.dataset.label !== wantChip) {
        chipRow.dataset.label = wantChip;
        clear(chipRow);
        if (wantChip) chipRow.append(contextChip(wantChip));
      }

      const thinking = State.stateOverride === "thinking";
      const count = State.chatHistory.length + (thinking ? 0.5 : 0);
      if (count !== renderedCount) {
        renderedCount = count;
        clear(log);
        for (const m of State.chatHistory) log.append(bubble(m));
        if (thinking) log.append(typingDots());
        log.scrollTop = log.scrollHeight;
      }

      // Gate de sesión: barra de chat o tarjeta de login.
      void Bridge.maverickStatus().then((ok) => {
        const next = ok ?? false;
        if (next !== loggedIn) {
          loggedIn = next;
          bar.style.display = loggedIn ? "" : "none";
          loginBar.style.display = loggedIn ? "none" : "";
          if (!loggedIn) {
            clear(log);
            log.append(loginNote);
          }
          onHeightChange();
        }
      });

      input.placeholder = State.chatHistory.length === 0 ? "Pregúntame lo que sea…" : "Continuar…";
      input.disabled = sending;
    },
    focus() {
      input.focus();
      input.select();
    },
  };
}
