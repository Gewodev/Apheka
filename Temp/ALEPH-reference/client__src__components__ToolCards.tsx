import { useState } from 'react';
import { Clapperboard, ChevronDown, Download, Maximize2, Eye, ExternalLink, Check } from 'lucide-react';
import type { TerminalRun } from './SandboxPanel';
import { MdImage } from './Markdown';

export interface SearchResult { title: string; url: string; snippet: string; domain: string }
export interface SearchTool { type: 'search'; query: string; results: SearchResult[]; failed?: boolean }
export interface MediaItem { title: string; url: string; thumb: string; mime: string; width?: number; height?: number; pageUrl?: string }
export interface MediaTool { type: 'media'; query: string; images: MediaItem[]; videos: MediaItem[]; failed?: boolean }
export interface CodeTool { type: 'code'; language: string; code: string; stdout: string; stderr: string; exitCode: number; durationMs: number }
export interface DocumentEditTool { type: 'document_edit'; operations: Array<{ type: 'replace' | 'insert' | 'delete'; start: number; end: number; text?: string }> }
export interface WriteFileTool { type: 'write_file'; path: string; status: string; content?: string }
export interface ReadFileTool { type: 'read_file'; path: string; content: string; status: string }
export interface ListFilesTool { type: 'list_files'; path: string; listing: string; status: string }
export interface GenerateImageTool { type: 'generate_image'; prompt: string; imageUrl: string }
export interface YoutubeTool { type: 'youtube'; query: string; title?: string; lang?: string; preview?: string; failed?: boolean }
export type ToolEvent =
  | SearchTool
  | MediaTool
  | CodeTool
  | DocumentEditTool
  | WriteFileTool
  | ReadFileTool
  | ListFilesTool
  | GenerateImageTool
  | YoutubeTool
  | { type: 'file_generated'; fileType: 'pptx' | 'docx' | 'xlsx'; url: string; filename: string; title?: string; preview?: any }
  | { type: 'website_generated'; url: string; sharecode: string; title: string; html?: string; failed?: boolean }
  | { type: 'skill_installed'; skillId: string; name: string; version?: string; category?: string; command?: string; description?: string; filesCreated?: string[] }
  | { type: 'task_plan'; title: string; steps: Array<{ label: string; status: 'completed' | 'in_progress' | 'pending' }> };

const favicon = (domain: string) => `https://icons.duckduckgo.com/ip3/${domain}.ico`;

// Descarga un archivo remoto como blob (para imágenes y videos).
async function downloadFile(fileUrl: string, filename: string) {
  try {
    const res = await fetch(fileUrl);
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

const openInNewTab = (url: string) => window.open(url, '_blank', 'noopener,noreferrer');

// Contenedor colapsable simple similar al "pensamiento" para las herramientas.
// Muestra solo el nombre y el detalles, sin el borde ni el icono circular.
function ToolShell({ title, subtitle, badge, open, onToggle, children }: {
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-1 border-b border-line-dark/50 pb-1 msg-enter">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 py-1.5 text-left group"
        aria-expanded={open}
      >
        <span className="flex flex-col min-w-0">
          <span className="font-mono text-[10px] tracking-[0.15em] uppercase text-paper-dim group-hover:text-paper transition-colors">
            {title}
          </span>
          {subtitle && (
            <span className="text-[11px] text-paper-dim/60 truncate max-w-[380px]" title={subtitle}>{subtitle}</span>
          )}
        </span>
        {badge && (
          <span className="ml-auto font-mono text-[9px] text-paper-dim/50 shrink-0">{badge}</span>
        )}
        <ChevronDown size={11} strokeWidth={2} className={`ml-auto shrink-0 text-paper-dim/50 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && children}
    </div>
  );
}

// Tarjeta de búsqueda web: resultados ocultos hasta que el usuario los abra.
export function SearchCard({ tool, defaultOpen = false }: { tool: SearchTool; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const count = tool.results?.length || 0;
  return (
    <ToolShell
      title="Búsqueda web"
      subtitle={`«${tool.query}»`}
      badge={tool.failed ? 'sin conexión' : `${count} resultado${count === 1 ? '' : 's'}`}
      open={open}
      onToggle={() => setOpen(!open)}
    >
      {count > 0 && (
        <div className="mt-1 pl-4 border-l border-line-dark space-y-1.5 msg-enter">
          {tool.results.map((r, i) => (
            <a
              key={i}
              href={r.url}
              target="_blank"
              rel="noreferrer"
              className="flex gap-2.5 px-3 py-1.5 hover:bg-white/5 rounded transition-colors"
            >
              <img src={favicon(r.domain)} alt="" className="w-3.5 h-3.5 rounded shrink-0 opacity-80 mt-0.5" loading="lazy" />
              <span className="min-w-0 text-[12px] leading-snug truncate" style={{ color: 'var(--accent-bright)' }}>{r.title}</span>
            </a>
          ))}
        </div>
      )}
    </ToolShell>
  );
}

// Tarjeta de ejecución de código estilo archivo: cabecera colapsable con
// estado y código con números de línea, salida real debajo.
export function CodeRunCard({ run, defaultOpen = false }: { run: TerminalRun; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const ok = !run.running && run.exitCode === 0;
  const lines = run.code ? run.code.split('\n') : [];
  return (
    <div className="mb-1 rounded-xl border border-line-dark overflow-hidden msg-enter">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/5 transition-colors text-left"
        aria-expanded={open}
      >
        <ChevronDown size={12} strokeWidth={2} className={`shrink-0 text-paper-dim/60 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
        <span className="text-[12.5px] text-paper truncate">Código {run.language}</span>
        <span className="ml-auto font-mono text-[10px] text-paper-dim/60 shrink-0">
          {run.running ? 'ejecutando…' : ok ? `exit 0 · ${run.durationMs} ms` : `exit ${run.exitCode} · ${run.durationMs} ms`}
        </span>
      </button>
      {open && (
        <>
          {lines.length > 0 && (
            <div className="max-h-72 overflow-y-auto dark-scroll border-t border-line-dark font-mono text-[11px] leading-[1.6]">
              {lines.map((text, i) => (
                <div key={i} className="flex">
                  <span className="w-9 shrink-0 pr-2 text-right text-paper-dim/40 select-none border-r border-line-dark/40">{i + 1}</span>
                  <span className="flex-1 pl-2.5 pr-3 text-[#c8c8c8] whitespace-pre-wrap break-all">{text || ' '}</span>
                </div>
              ))}
            </div>
          )}
          {(run.stdout || run.stderr) && (
            <div className="border-t border-line-dark px-3 py-2 font-mono text-[11px] space-y-1">
              {run.stdout && <pre className="text-paper whitespace-pre-wrap max-h-40 overflow-y-auto">{run.stdout}</pre>}
              {run.stderr && <pre className="text-red-400 whitespace-pre-wrap max-h-40 overflow-y-auto">{run.stderr}</pre>}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// Tarjeta de obtención de medios: galería colapsada hasta que el usuario la abra.
export function MediaCard({ tool, defaultOpen = false }: { tool: MediaTool; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const nImg = tool.images?.length || 0;
  const nVid = tool.videos?.length || 0;

  return (
    <ToolShell
      title="Imágenes y video"
      subtitle={`«${tool.query}»`}
      badge={tool.failed ? 'sin conexión' : `${nImg} img${nVid ? ` · ${nVid} vid` : ''}`}
      open={open}
      onToggle={() => setOpen(!open)}
    >
      {(nImg > 0 || nVid > 0) ? (
        <div className="mt-1 pl-4 border-l border-line-dark msg-enter">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1.5">
            {tool.images.map((im, i) => (
              <div key={`i${i}`} className="group/img relative overflow-hidden rounded-lg bg-ink border border-line-dark/50 msg-enter" style={{ animationDelay: `${i * 40}ms` }}>
                <img
                  src={im.thumb}
                  alt={im.title}
                  loading="lazy"
                  className="w-full aspect-square object-cover transition-transform duration-300 group-hover/img:scale-105 cursor-zoom-in"
                  onClick={() => openInNewTab(im.url)}
                />
              </div>
            ))}
            {tool.videos.map((v, i) => (
              <div key={`v${i}`} className="group/vid relative overflow-hidden rounded-lg bg-ink border border-line-dark/50 msg-enter aspect-[16/9]" >
                <div className="absolute inset-0 flex items-center justify-center">
                  <Clapperboard size={18} strokeWidth={1.5} className="text-paper-dim/50" />
                </div>
                <span className="absolute bottom-1.5 left-1.5 right-1.5 font-mono text-[9px] text-white/70 truncate">{v.title}</span>
              </div>
            ))}
          </div>
          <p className="mt-2 font-mono text-[9px] text-paper-dim/50">
            {nImg} imagen{nImg !== 1 ? 'es' : ''}{nVid ? ` · ${nVid} video${nVid !== 1 ? 's' : ''}` : ''}
          </p>
        </div>
      ) : null}
    </ToolShell>
  );
}

// Archivo nativo generado (PPTX/DOCX/XLSX): fila con enlace de vista previa y descarga.
function FileGeneratedCard({
  tool,
  onOpenCanvas,
}: {
  tool: Extract<ToolEvent, { type: 'file_generated' }>;
  onOpenCanvas?: (payload: any) => void;
}) {
  const label = tool.fileType === 'pptx' ? 'Presentación' : tool.fileType === 'docx' ? 'Documento' : 'Hoja de cálculo';
  const openAction = () => {
    if (onOpenCanvas) {
      onOpenCanvas({
        type: tool.fileType === 'pptx' ? 'slides' : tool.fileType === 'docx' ? 'document' : 'sheet',
        title: tool.title || tool.filename,
        url: tool.url,
        filename: tool.filename,
        markdown: tool.preview?.markdown,
        headers: tool.preview?.headers,
        rows: tool.preview?.rows,
      });
    } else if (tool.url) {
      window.open(tool.url, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className="mb-1 rounded-xl border border-line-dark flex items-center justify-between gap-2.5 px-3 py-2 bg-ink-2/60 hover:bg-white/[0.03] transition-colors msg-enter">
      <div className="min-w-0 flex-1 flex items-center gap-2 cursor-pointer" onClick={openAction}>
        <span className="font-mono text-[10px] uppercase px-1.5 py-0.5 rounded bg-white/5 text-paper-dim border border-white/5 shrink-0 font-medium">
          {tool.fileType}
        </span>
        <span className="text-[12.5px] text-paper truncate font-medium hover:text-white transition-colors">
          {label}{tool.title ? `: ${tool.title}` : ''}
        </span>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <button
          type="button"
          onClick={openAction}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-paper hover:text-white font-mono text-[11px] border border-line-dark transition-colors"
        >
          <Eye size={12} />
          <span>Vista previa</span>
        </button>
        {tool.url && (
          <a
            href={tool.url}
            download={tool.filename}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-paper-dim hover:text-paper hover:bg-white/5 font-mono text-[11px] transition-colors"
            title="Descargar archivo (abre en pestaña nueva)"
          >
            <Download size={12} />
          </a>
        )}
      </div>
    </div>
  );
}

// Sitio web generado: fila con link compartible y vista previa.
function WebsiteGeneratedCard({
  tool,
  onOpenCanvas,
}: {
  tool: Extract<ToolEvent, { type: 'website_generated' }>;
  onOpenCanvas?: (payload: any) => void;
}) {
  const openAction = () => {
    if (onOpenCanvas) {
      onOpenCanvas({
        type: 'website',
        title: tool.title,
        url: tool.url,
        html: tool.html,
      });
    } else if (tool.url) {
      window.open(tool.url, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className="mb-1 rounded-xl border border-line-dark flex items-center justify-between gap-2.5 px-3 py-2 bg-ink-2/60 hover:bg-white/[0.03] transition-colors msg-enter">
      <div className="min-w-0 flex-1 flex items-center gap-2 cursor-pointer" onClick={openAction}>
        <span className="inline-flex items-center gap-1.5 font-mono text-[10.5px] uppercase px-2.5 py-0.5 rounded-full bg-[#7ee2a8]/15 text-[#7ee2a8] border border-[#7ee2a8]/30 shrink-0 font-medium tracking-wider">
          <Check size={10} strokeWidth={2.5} />
          <span>Completado</span>
        </span>
        <span className="text-[12.5px] text-paper truncate font-medium hover:text-white transition-colors">
          Sitio web{tool.title ? `: ${tool.title}` : ''}
        </span>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <button
          type="button"
          onClick={openAction}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-paper hover:text-white font-mono text-[11px] border border-line-dark transition-colors"
        >
          <Eye size={12} />
          <span>Vista previa</span>
        </button>
        {tool.url && (
          <a
            href={tool.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-paper-dim hover:text-paper hover:bg-white/5 font-mono text-[11px] transition-colors"
            title="Abrir en pestaña nueva"
          >
            <ExternalLink size={12} />
          </a>
        )}
      </div>
    </div>
  );
}

// Tarjeta de transcripción de YouTube: muestra el video analizado.
export function YoutubeCard({ tool, defaultOpen = false }: { tool: YoutubeTool; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <ToolShell
      title={tool.failed ? 'YouTube — sin subtítulos' : 'Video de YouTube'}
      subtitle={tool.title ? `${tool.title} · ${tool.query}` : tool.query}
      badge={tool.failed ? 'no disponible' : `transcripción${tool.lang ? ` (${tool.lang})` : ''}`}
      open={open}
      onToggle={() => setOpen(!open)}
    >
      {tool.preview && (
        <div className="mt-1 pl-4 border-l border-line-dark msg-enter font-mono text-[10.5px] leading-relaxed text-paper-dim/80">
          <p className="whitespace-pre-wrap">{tool.preview}{tool.preview.length >= 400 ? '…' : ''}</p>
        </div>
      )}
    </ToolShell>
  );
}

export function ToolList({ tools, defaultOpen = false, onOpenCanvas }: { tools?: ToolEvent[] | null; defaultOpen?: boolean; onOpenCanvas?: (payload: any) => void }) {
  if (!tools?.length) return null;
  // Agrupa llamadas consecutivas de write_file en una sola tarjeta estilo Kimi.
  const nodes: React.ReactNode[] = [];
  let wfGroup: WriteFileTool[] = [];
  const flushWf = (key: number) => {
    if (wfGroup.length) {
      nodes.push(<FileEditsCard key={`wf${key}`} files={wfGroup} defaultOpen={defaultOpen} />);
      wfGroup = [];
    }
  };
  tools.forEach((t, i) => {
    if (t.type === 'write_file') {
      wfGroup.push(t);
      return;
    }
    flushWf(i);
    nodes.push(
      t.type === 'search' ? <SearchCard key={i} tool={t} defaultOpen={defaultOpen} />
      : t.type === 'media' ? <MediaCard key={i} tool={t} defaultOpen={defaultOpen} />
      : t.type === 'code' ? (
        <CodeRunCard
          key={i}
          run={{ id: -(i + 1), language: t.language, code: t.code, stdout: t.stdout, stderr: t.stderr, exitCode: t.exitCode, durationMs: t.durationMs }}
        />
      )
      : t.type === 'document_edit' ? <DocumentEditCard key={i} tool={t} defaultOpen={defaultOpen} />
      : t.type === 'read_file' ? <ReadFileCard key={i} tool={t} defaultOpen={defaultOpen} />
      : t.type === 'list_files' ? <ListFilesCard key={i} tool={t} defaultOpen={defaultOpen} />
      : t.type === 'generate_image' ? <GenerateImageCard key={i} tool={t} defaultOpen={defaultOpen} />
      : t.type === 'youtube' ? <YoutubeCard key={i} tool={t} defaultOpen={defaultOpen} />
      : t.type === 'file_generated' ? <FileGeneratedCard key={i} tool={t} onOpenCanvas={onOpenCanvas} />
      : t.type === 'website_generated' ? <WebsiteGeneratedCard key={i} tool={t} onOpenCanvas={onOpenCanvas} />
      : t.type === 'skill_installed' ? <SkillInstalledCard key={i} tool={t} defaultOpen={defaultOpen} />
      : t.type === 'task_plan' ? <TaskPlanCard key={i} tool={t} />
      : null
    );
  });
  flushWf(tools.length);
  return <>{nodes}</>;
}

// Tarjeta para edición de documento
function DocumentEditCard({ tool, defaultOpen = false }: { tool: DocumentEditTool; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const opCount = tool.operations?.length || 0;
  return (
    <ToolShell
      title="Editar documento"
      subtitle={`${opCount} operación${opCount === 1 ? '' : 'es'} aplicada${opCount === 1 ? '' : 's'}`}
      badge={`${opCount}`}
      open={open}
      onToggle={() => setOpen(!open)}
    >
      {opCount > 0 && (
        <div className="mt-1 pl-4 border-l border-line-dark px-4 py-2 font-mono text-[10px] text-paper-dim msg-enter">
          {tool.operations.map((op, idx) => (
            <div key={idx} className="mb-1">
              <span className="text-[9px] text-paper-dim/50 shrink-0">{idx + 1}.</span>
              <span className="px-1.5 py-0.5 bg-white/5 rounded text-[9px] uppercase">{op.type}</span>
              <span>pos {op.start}–{op.end}</span>
              {op.text && <span className="truncate max-w-[200px] text-paper-dim/70">«{op.text.slice(0, 40)}{op.text.length > 40 ? '…' : ''}»</span>}
            </div>
          ))}
        </div>
      )}
    </ToolShell>
  );
}

// Línea de diff: adición, eliminación o contexto, con números de línea.
export interface DiffLine { type: 'add' | 'del' | 'ctx'; oldNum?: number; newNum?: number; text: string }

// Vista de diff estilo tabla: rojo para eliminaciones, verde para adiciones,
// neutro para contexto, con columnas de números de línea viejo/nuevo.
export function DiffView({ lines, maxHeight = '18rem' }: { lines: DiffLine[]; maxHeight?: string }) {
  return (
    <div className="overflow-y-auto dark-scroll border-t border-line-dark font-mono text-[11px] leading-[1.6]" style={{ maxHeight }}>
      {lines.map((l, i) => (
        <div key={i} className={`flex ${l.type === 'add' ? 'bg-[#122918]' : l.type === 'del' ? 'bg-[#2b1314]' : ''}`}>
          <span className="w-9 shrink-0 pr-2 text-right text-paper-dim/40 select-none border-r border-line-dark/40">{l.oldNum ?? ''}</span>
          <span className="w-9 shrink-0 pr-2 text-right text-paper-dim/40 select-none border-r border-line-dark/40">{l.newNum ?? ''}</span>
          <span className={`flex-1 pl-2.5 pr-3 whitespace-pre-wrap break-all ${l.type === 'add' ? 'text-[#7ee2a8]' : l.type === 'del' ? 'text-[#f19a9e]' : 'text-paper-dim'}`}>
            {l.text || ' '}
          </span>
        </div>
      ))}
    </div>
  );
}

// Grupo de archivos escritos estilo Kimi: cabecera con total y stats +N −N,
// una fila colapsable por archivo que abre el diff completo al expandir.
export function FileEditsCard({ files, defaultOpen = false }: { files: WriteFileTool[]; defaultOpen?: boolean }) {
  const [openFiles, setOpenFiles] = useState<Record<number, boolean>>({});
  const fileLines = (f: WriteFileTool): string[] => (f.content ? f.content.split('\n') : []);
  const totalAdd = files.reduce((n, f) => n + fileLines(f).length, 0);
  return (
    <div className="mb-1 rounded-xl border border-line-dark overflow-hidden msg-enter">
      <div className="flex items-center gap-2 px-3 py-2">
        <span className="text-[12px] text-paper-dim">edit_file</span>
        <span className="text-[12.5px] text-paper font-medium truncate">
          {files.length === 1 ? 'Archivo escrito' : `Aplicadas ${files.length} ediciones de archivo`}
        </span>
        <span className="ml-auto font-mono text-[10px] shrink-0">
          <span className="text-[#7ee2a8]">+{totalAdd}</span> <span className="text-[#f19a9e]">−0</span>
        </span>
      </div>
      <div className="px-2 pb-2 space-y-1">
        {files.map((f, i) => {
          const lines = fileLines(f);
          const open = Boolean(openFiles[i] ?? defaultOpen);
          return (
            <div key={i} className="rounded-lg border border-line-dark overflow-hidden">
              <button
                onClick={() => setOpenFiles((s) => ({ ...s, [i]: !s[i] }))}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-white/5 transition-colors text-left"
                aria-expanded={open}
              >
                <ChevronDown size={11} strokeWidth={2} className={`shrink-0 text-paper-dim/60 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
                <span className="text-[12px] text-paper truncate" title={f.path}>{f.path}</span>
                <span className="ml-auto font-mono text-[10px] shrink-0">
                  <span className="text-[#7ee2a8]">+{lines.length}</span> <span className="text-[#f19a9e]">−0</span>
                </span>
              </button>
              {open && <DiffView lines={lines.map((text: string, li: number) => ({ type: 'add' as const, newNum: li + 1, text }))} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ReadFileCard({ tool, defaultOpen = false }: { tool: ReadFileTool; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const preview = tool.content.slice(0, 200);
  return (
    <ToolShell
      title="Leer archivo"
      subtitle={tool.path}
      badge={tool.status}
      open={open}
      onToggle={() => setOpen(!open)}
    >
      <div className="mt-1 pl-4 border-l border-line-dark msg-enter p-3 font-mono text-[10px] text-paper-dim max-h-48 overflow-auto">
        <pre className="whitespace-pre-wrap">{preview}{tool.content.length > 200 ? '…' : ''}</pre>
      </div>
    </ToolShell>
  );
}

function ListFilesCard({ tool, defaultOpen = false }: { tool: ListFilesTool; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const lines = tool.listing.split('\n').slice(0, 20);
  return (
    <ToolShell
      title="Listar archivos"
      subtitle={tool.path}
      badge={tool.status}
      open={open}
      onToggle={() => setOpen(!open)}
    >
      <div className="mt-1 pl-4 border-l border-line-dark msg-enter p-3 font-mono text-[10px] text-paper-dim max-h-48 overflow-auto">
        <pre className="whitespace-pre-wrap">{lines.join('\n')}{tool.listing.split('\n').length > 20 ? '\n…' : ''}</pre>
      </div>
    </ToolShell>
  );
}

// Imagen generada por la IA: cerrada por defecto, con acciones al abrirla.
function GenerateImageCard({ tool, defaultOpen = false }: { tool: GenerateImageTool; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <ToolShell
      title="Imagen generada"
      subtitle={tool.prompt}
      badge="lista"
      open={open}
      onToggle={() => setOpen(!open)}
    >
      {tool.imageUrl && (
        <div className="mt-1 pl-4 border-l border-line-dark p-4 msg-enter">
          <MdImage src={tool.imageUrl} alt={tool.prompt} title={tool.prompt} />
          <div className="mt-2.5 flex items-center justify-between gap-3">
            <p className="font-mono text-[11px] text-paper-dim/70 truncate min-w-0">{tool.prompt}</p>
            <div className="flex gap-1.5 shrink-0">
              <button
                onClick={() => openInNewTab(tool.imageUrl)}
                className="flex items-center gap-1.5 font-mono text-[10px] tracking-[0.12em] uppercase px-2.5 py-1.5 rounded-lg border border-line-dark hover:border-paper-dim transition-colors"
                style={{ color: 'var(--accent-bright)' }}
                title="Ver en tamaño completo"
              >
                <Maximize2 size={11} strokeWidth={2} /> Ver
              </button>
              <button
                onClick={() => downloadFile(tool.imageUrl, `${(tool.prompt || 'imagen').replace(/[^\w.\-]+/g, '_').slice(0, 48)}.png`)}
                className="flex items-center gap-1.5 font-mono text-[10px] tracking-[0.12em] uppercase px-2.5 py-1.5 rounded-lg border border-line-dark hover:border-paper-dim transition-colors"
                style={{ color: 'var(--accent-bright)' }}
                title="Descargar imagen"
              >
                <Download size={11} strokeWidth={2} /> Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </ToolShell>
  );
}


// Tarjeta de Skill instalada / activada mediante CLI o agente
function SkillInstalledCard({
  tool,
  defaultOpen = false,
}: {
  tool: Extract<ToolEvent, { type: 'skill_installed' }>;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mb-2 rounded-xl border border-line-dark bg-[#0e0e0e] overflow-hidden msg-enter">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full px-3.5 py-2.5 flex items-center justify-between gap-2.5 hover:bg-white/[0.02] transition-colors text-left"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-2 h-2 rounded-full bg-[#7ee2a8] shrink-0" />
          <span className="font-mono text-[10px] uppercase px-1.5 py-0.5 rounded bg-white/[0.06] text-paper border border-white/10 shrink-0">
            SKILL
          </span>
          <span className="text-[12.5px] font-medium text-paper truncate">
            {tool.name} {tool.version ? `(v${tool.version})` : ''}
          </span>
          {tool.command && (
            <code className="hidden sm:inline font-mono text-[11px] text-paper-dim/70 truncate">
              $ {tool.command}
            </code>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="font-mono text-[10px] text-[#7ee2a8] bg-[#7ee2a8]/10 px-2 py-0.5 rounded border border-[#7ee2a8]/20">
            Activa
          </span>
          <ChevronDown
            size={13}
            className={`text-paper-dim transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </div>
      </button>
      {open && (
        <div className="px-3.5 py-2.5 border-t border-line-dark bg-[#080808] font-mono text-[11px] text-paper-dim space-y-1.5">
          {tool.description && <p className="font-sans text-xs text-paper-dim">{tool.description}</p>}
          {tool.command && (
            <div className="text-[#7ee2a8]">$ {tool.command}</div>
          )}
          {tool.filesCreated && tool.filesCreated.length > 0 && (
            <div className="space-y-0.5 pt-1">
              {tool.filesCreated.map((f, idx) => (
                <div key={idx} className="text-paper-dim/80">
                  ✔ Escrito: <span className="text-paper">{f}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Tarjeta de Plan de Orquestación paso a paso
function TaskPlanCard({
  tool,
}: {
  tool: Extract<ToolEvent, { type: 'task_plan' }>;
}) {
  const steps = tool.steps || [];
  const completed = steps.filter((s) => s.status === 'completed').length;
  const pct = steps.length > 0 ? Math.round((completed / steps.length) * 100) : 0;

  return (
    <div className="mb-2.5 rounded-xl border border-line-dark bg-[#0e0e0e] p-3.5 msg-enter">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-mono text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-white/[0.06] text-paper border border-white/10">
            ORQUESTACIÓN
          </span>
          <span className="text-xs font-medium text-paper truncate">{tool.title}</span>
        </div>
        <span className="font-mono text-[10.5px] text-paper-dim shrink-0">
          {completed}/{steps.length} pasos ({pct}%)
        </span>
      </div>

      <div className="w-full h-1 bg-white/[0.06] rounded-full overflow-hidden mb-2.5">
        <div
          className="h-full bg-paper transition-all duration-300"
          style={{ width: `${Math.max(pct, 8)}%` }}
        />
      </div>

      <div className="space-y-1.5">
        {steps.map((s, idx) => (
          <div key={idx} className="flex items-center gap-2 text-xs">
            <span
              className={`w-4 h-4 rounded-full flex items-center justify-center font-mono text-[10px] shrink-0 border ${
                s.status === 'completed'
                  ? 'bg-[#7ee2a8]/15 border-[#7ee2a8]/40 text-[#7ee2a8]'
                  : s.status === 'in_progress'
                  ? 'bg-white/10 border-white/30 text-paper animate-pulse'
                  : 'bg-transparent border-white/10 text-paper-dim/50'
              }`}
            >
              {s.status === 'completed' ? '✓' : idx + 1}
            </span>
            <span
              className={
                s.status === 'completed'
                  ? 'text-paper-dim line-through decoration-white/20'
                  : s.status === 'in_progress'
                  ? 'text-paper font-medium'
                  : 'text-paper-dim/70'
              }
            >
              {s.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
