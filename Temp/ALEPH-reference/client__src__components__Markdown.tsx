import { useState, useEffect, useMemo, createContext, useContext } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { Copy, Check, Eye, Play, Download, Maximize2, X } from 'lucide-react';

export interface Artifact {
  language: string;
  code: string;
}

const PREVIEWABLE = new Set(['html', 'svg', 'markdown', 'md', 'csv']);

// -- Image Modal: shared state via context --------------------------
interface ImageModalState {
  src: string;
  alt: string;
  title: string;
  visible: boolean;
}

interface ImageModalContextValue {
  state: ImageModalState;
  show: (src: string, alt?: string, title?: string) => void;
  hide: () => void;
}

const ImageModalContext = createContext<ImageModalContextValue | null>(null);

function ImageModalRoot({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ImageModalState>({ src: '', alt: '', title: '', visible: false });
  const show = (src: string, alt?: string, title?: string) =>
    setState({ src, alt: alt || '', title: title || '', visible: true });
  const hide = () => setState({ src: '', alt: '', title: '', visible: false });
  return (
    <ImageModalContext.Provider value={{ state, show, hide }}>
      {children}
      <ImageOverlay />
    </ImageModalContext.Provider>
  );
}

function useImageModalCtx() {
  const ctx = useContext(ImageModalContext);
  if (!ctx) throw new Error('useImageModalCtx must be used within ImageModalRoot');
  return ctx;
}

async function downloadImage(url: string, filename: string) {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(objectUrl);
  } catch (e) {
    console.error('Download failed:', e);
  }
}

export function MdImage({ src, alt, title }: { src?: string; alt?: string; title?: string }) {
  // Fallback autónomo: fuera de ImageModalRoot (p. ej. tarjetas de herramientas)
  // se abre un overlay propio en vez de lanzar excepción.
  const [fallbackOpen, setFallbackOpen] = useState(false);
  const ctx = useContext(ImageModalContext);
  useEffect(() => {
    if (!fallbackOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setFallbackOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fallbackOpen]);
  if (!src) return null;
  const open = () => (ctx ? ctx.show(src, alt, title) : setFallbackOpen(true));
  return (
    <div className="relative group inline-block max-w-full">
      <img
        src={src}
        alt={alt || ''}
        title={title || alt || ''}
        loading="lazy"
        onClick={open}
        className="max-w-full h-auto rounded-lg border border-line-dark cursor-zoom-in transition-transform duration-300 group-hover:scale-[1.02]"
      />
      <div className="absolute bottom-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        <button
          type="button"
          title="Ampliar imagen"
          aria-label="Ampliar imagen"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); open(); }}
          className="p-1.5 rounded bg-black/60 hover:bg-black/80 text-white transition-colors"
        >
          <Maximize2 size={12} strokeWidth={2} />
        </button>
        <button
          type="button"
          title="Descargar imagen"
          aria-label="Descargar imagen"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); downloadImage(src, (alt || 'imagen').replace(/[^\w.\-]+/g, '_') + '.png'); }}
          className="p-1.5 rounded bg-black/60 hover:bg-black/80 text-white transition-colors"
        >
          <Download size={12} strokeWidth={2} />
        </button>
      </div>
      {!ctx && fallbackOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm p-6"
          onClick={() => setFallbackOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label={title || alt || 'Imagen'}
        >
          <img
            src={src}
            alt={alt || ''}
            className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl shadow-black"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            type="button"
            className="absolute top-4 right-4 p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
            aria-label="Cerrar"
            onClick={() => setFallbackOpen(false)}
          >
            <X size={20} strokeWidth={2} />
          </button>
        </div>
      )}
    </div>
  );
}

function ImageOverlay() {
  const { state, hide } = useImageModalCtx();
  if (!state.visible) return null;
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm p-6"
      onClick={hide}
      role="dialog"
      aria-modal="true"
      aria-label="Imagen ampliada"
    >
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); hide(); }}
        aria-label="Cerrar"
        className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/25 text-white transition-colors z-10"
      >
        <X size={22} strokeWidth={2} />
      </button>
      <figure
        className="max-w-[92vw] max-h-[88vh] flex flex-col items-center gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={state.src}
          alt={state.alt || ''}
          className="max-w-[92vw] max-h-[82vh] object-contain rounded-lg shadow-2xl select-none"
          draggable={false}
        />
        {(state.title || state.alt) && (
          <figcaption className="font-mono text-[11px] text-white/70 max-w-full truncate">
            {state.title || state.alt}
          </figcaption>
        )}
      </figure>
    </div>
  );
}

// -- Sanitización de fences sin cerrar y normalización de delimitadores LaTeX --
function sanitizeFences(content: string): string {
  let normalized = content
    .replace(/\\\[([\s\S]*?)\\\]/g, (_m, expr) => `\n$$${expr.trim()}$$\n`)
    .replace(/\\\(([\s\S]*?)\\\)/g, (_m, expr) => `$${expr.trim()}$`);

  const fenceRegex = /^```(\w*)\n/gm;
  const matches = [...normalized.matchAll(fenceRegex)];
  if (matches.length === 0) return normalized;
  if (matches.length % 2 === 1) {
    const lastFence = matches[matches.length - 1];
    const afterLast = normalized.slice(lastFence.index! + lastFence[0].length);
    if (!/^```/m.test(afterLast)) return normalized + '\n```';
  }
  return normalized;
}

export function isExecLang(lang: string) {
  return lang.startsWith('exec:');
}

function CopyBtn({ text }: { text: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      type="button"
      className="maverick-codeblock-btn inline-flex items-center gap-1.5"
      onClick={() => {
        navigator.clipboard.writeText(text);
        setOk(true);
        setTimeout(() => setOk(false), 1600);
      }}
      aria-label="Copiar código"
    >
      {ok ? <Check size={11} strokeWidth={2.2} /> : <Copy size={11} strokeWidth={2.2} />}
      {ok ? 'Copiado' : 'Copiar'}
    </button>
  );
}

interface MarkdownProps {
  content: string;
  dark?: boolean;
  onPreview?: (a: Artifact) => void;
  onExec?: (a: Artifact) => void;
}

export default function Markdown({ content, dark, onPreview, onExec }: MarkdownProps) {
  const safeContent = useMemo(() => sanitizeFences(content), [content]);

  return (
    <ImageModalRoot>
      <div className={`maverick-md ${dark ? 'maverick-md-dark' : ''}`}>
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkMath]}
          rehypePlugins={[rehypeKatex]}
          components={{
            a: ({ href, children, ...props }) => (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--accent-bright,#4f7ef0)] underline underline-offset-2 hover:opacity-80 transition-opacity font-medium"
                {...props}
              >
                {children}
              </a>
            ),
            img: ({ src, alt, title }) => <MdImage src={typeof src === 'string' ? src : undefined} alt={alt} title={title} />,
            code({ className, children, ...props }) {
              const match = /language-([\w:+.-]+)/.exec(className || '');
              const lang = match?.[1] || '';
              const code = String(children).replace(/\n$/, '');
              const isBlock = Boolean(match) || code.includes('\n');
              if (!isBlock) {
                return <code className="maverick-inline-code" {...props}>{code}</code>;
              }
              const exec = isExecLang(lang);
              const realLang = exec ? lang.slice(5) : lang;
              const previewable = PREVIEWABLE.has(realLang);
              return (
                <div className="maverick-codeblock">
                  <div className="maverick-codeblock-bar">
                    <span className="maverick-codeblock-lang inline-flex items-center gap-1.5">
                      {exec && <Play size={10} strokeWidth={2.2} />}
                      {realLang || 'texto'}
                    </span>
                    <span className="flex gap-2">
                      {previewable && onPreview && (
                        <button
                          type="button"
                          className="maverick-codeblock-btn inline-flex items-center gap-1.5"
                          onClick={() => onPreview({ language: realLang, code })}
                        >
                          <Eye size={11} strokeWidth={2.2} /> Vista previa
                        </button>
                      )}
                      {exec && onExec && (
                        <button
                          type="button"
                          className="maverick-codeblock-btn maverick-codeblock-btn-accent inline-flex items-center gap-1.5"
                          onClick={() => onExec({ language: realLang, code })}
                        >
                          <Play size={11} strokeWidth={2.2} /> Ejecutar
                        </button>
                      )}
                      <CopyBtn text={code} />
                    </span>
                  </div>
                  <pre><code>{code}</code></pre>
                </div>
              );
            },
          }}
        >
          {safeContent}
        </ReactMarkdown>
      </div>
    </ImageModalRoot>
  );
}