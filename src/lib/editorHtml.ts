// ── Utilidades de editor nativo (Notas + Apuntes de Cursos) ─────────────────

// Preserve intentional paragraphs, blank lines and spacing. Only a completely
// empty document becomes an empty string; media and structured blocks survive.
export function normalizeEditorHtml(raw: string): string {
  try {
    if (!raw || !raw.trim()) return "";
    const doc = new DOMParser().parseFromString(`<body>${raw}</body>`, "text/html");
    const body = doc.body;
    if (!(body.textContent || '').replace(/\u00A0/g,' ').trim() && !body.querySelector('img,video,audio,iframe,table,hr,svg,canvas,input')) return '';
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
  "IMG", "A", "HR", "SUP", "SUB",
  "SVG","G","PATH","RECT","CIRCLE","ELLIPSE","LINE","POLYLINE","POLYGON","TEXT","TSPAN","DEFS","CLIPPATH","MARKER","LINEARGRADIENT","RADIALGRADIENT","STOP","TITLE","DESC","USE",
]);
const SVG_ATTRS=["viewBox","xmlns","x","y","x1","y1","x2","y2","cx","cy","r","rx","ry","width","height","d","points","fill","stroke","stroke-width","stroke-linecap","stroke-linejoin","opacity","transform","text-anchor","font-size","offset","stop-color","stop-opacity","id","clip-path","marker-end","marker-start","marker-mid","refX","refY","markerWidth","markerHeight","orient","gradientUnits","gradientTransform","spreadMethod","preserveAspectRatio","dx","dy","textLength","lengthAdjust","dominant-baseline","font-family","font-weight","href"];
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
    const kill = Array.from(doc.querySelectorAll("script, style, link, meta, iframe, object, embed, noscript, foreignObject"));
    kill.forEach(el => el.remove());
    const walk = (el: Element) => {
      Array.from(el.children).forEach(walk);
      if (el.tagName.toUpperCase() === "BODY") return;
      const tag=el.tagName.toUpperCase();
      if (!ALLOWED_TAGS.has(tag)) {
        // desenvuelve: reemplaza el nodo por sus hijos (conserva el texto)
        const frag = doc.createDocumentFragment();
        while (el.firstChild) frag.appendChild(el.firstChild);
        el.replaceWith(frag);
        return;
      }
      const keep = el.namespaceURI === "http://www.w3.org/2000/svg" ? SVG_ATTRS : KEEP_ATTRS[tag] || [];
      Array.from(el.getAttributeNames()).forEach(a => {
        if (!keep.includes(a) || /url\((?!#[^)]*\))/i.test(el.getAttribute(a) || "")) el.removeAttribute(a);
      });
      if (tag === "USE" && !/^#[A-Za-z0-9_-]+$/.test(el.getAttribute("href") || "")) el.removeAttribute("href");
      if (tag === "A") {
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
  const esc = text.replace(/\r\n?/g,"\n").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return esc.split(/\n{2,}/).map(par =>
    "<p>" + par.split("\n").map(l => l || "<br>").join("<br>") + "</p>"
  ).join("");
}
