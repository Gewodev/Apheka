// ── Utilidades de editor nativo (Notas + Apuntes de Cursos) ─────────────────

// Normaliza el HTML de un editor contentEditable al guardarlo, como haría un
// editor nativo: 1) los encabezados/citas/code/listas vacíos SE ELIMINAN (ruido
// y herencia de estilo), 2) los bloques vacíos consecutivos se colapsan a UNA
// línea en blanco, 3) no quedan bloques vacíos al inicio ni al final, 4) los
// &nbsp; sueltos en bloques sin texto se vuelven un <br> limpio. Los adjuntos
// (img/video/audio) nunca cuentan como "vacío".
export function normalizeEditorHtml(raw: string): string {
  try {
    if (!raw || !raw.trim()) return "";
    const doc = new DOMParser().parseFromString(`<body>${raw}</body>`, "text/html");
    const body = doc.body;
    const isBlockish = (el: Element) => /^(P|DIV|H[1-4]|BLOCKQUOTE|PRE|UL|OL)$/.test(el.tagName);
    const isEmptyBlock = (el: Element) =>
      isBlockish(el) &&
      !(el.textContent || "").replace(/\u00A0/g, " ").trim() &&
      !el.querySelector("img, video, audio, iframe");
    const isRichEmpty = (el: Element) =>
      /^(H[1-4]|BLOCKQUOTE|PRE|UL|OL)$/.test(el.tagName) && isEmptyBlock(el);
    Array.from(body.children).forEach(el => {
      if (isRichEmpty(el)) { el.remove(); return; }
      if (isEmptyBlock(el) && el.tagName !== "UL" && el.tagName !== "OL") el.innerHTML = "<br>";
    });
    let prevEmpty = false;
    const drop: Element[] = [];
    Array.from(body.children).forEach(el => {
      const empty = isEmptyBlock(el);
      if (empty && prevEmpty) drop.push(el);
      prevEmpty = empty;
    });
    drop.forEach(el => el.remove());
    while (body.firstElementChild && isEmptyBlock(body.firstElementChild)) body.firstElementChild.remove();
    while (body.lastElementChild && isEmptyBlock(body.lastElementChild)) body.lastElementChild.remove();
    return body.innerHTML;
  } catch {
    return raw;
  }
}

// Etiquetas que se conservan al pegar desde la web; todo lo demás se "desenvuelve"
// dejando su texto. Los atributos se reducen a lo inocuo (sin estilos, clases,
// ids, handlers ni recursos externos raros).
const ALLOWED_TAGS = new Set([
  "P", "DIV", "BR", "H1", "H2", "H3", "H4",
  "UL", "OL", "LI", "B", "STRONG", "I", "EM", "U", "S", "STRIKE", "DEL",
  "BLOCKQUOTE", "PRE", "CODE", "SPAN",
  "TABLE", "THEAD", "TBODY", "TR", "TD", "TH",
  "IMG", "A", "HR",
]);
const KEEP_ATTRS: Record<string, string[]> = {
  A: ["href", "title"],
  IMG: ["src", "alt"],
  TD: ["colspan", "rowspan"],
  TH: ["colspan", "rowspan"],
};

// Sanitiza HTML pegado (clic derecho → pegar / Ctrl+V) para que el documento
// herede el estilo de la app y no traiga scripts, estilos inline ni basura.
export function sanitizePastedHtml(html: string): string {
  try {
    if (!html || !html.trim()) return "";
    const doc = new DOMParser().parseFromString(html, "text/html");
    const kill = Array.from(doc.querySelectorAll("script, style, link, meta, iframe, object, embed, noscript"));
    kill.forEach(el => el.remove());
    const walk = (el: Element) => {
      Array.from(el.children).forEach(walk);
      if (!(el instanceof HTMLElement && el.tagName !== "BODY")) return;
      if (!ALLOWED_TAGS.has(el.tagName)) {
        // desenvuelve: reemplaza el nodo por sus hijos (conserva el texto)
        const frag = doc.createDocumentFragment();
        while (el.firstChild) frag.appendChild(el.firstChild);
        el.replaceWith(frag);
        return;
      }
      const keep = KEEP_ATTRS[el.tagName] || [];
      Array.from(el.getAttributeNames()).forEach(a => {
        if (!keep.includes(a)) el.removeAttribute(a);
      });
      if (el.tagName === "A") {
        const href = el.getAttribute("href") || "";
        if (!/^https?:/i.test(href)) el.removeAttribute("href");
      }
      if (el.tagName === "IMG") {
        const src = el.getAttribute("src") || "";
        if (!/^(https?:|data:image\/)/i.test(src)) el.remove();
      }
    };
    walk(doc.body);
    // normaliza ya con las mismas reglas del guardado
    return normalizeEditorHtml(doc.body.innerHTML);
  } catch {
    return "";
  }
}

// Escape mínimo para pegar texto plano conservando saltos como párrafos
export function plainTextToHtml(text: string): string {
  const esc = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return esc.split(/\n{2,}/).map(par =>
    "<p>" + par.split("\n").map(l => l || "<br>").join("<br>") + "</p>"
  ).join("");
}
