import Markdown, { type Artifact } from './Markdown';
import Proof from './Proof';
import { ToolList, type ToolEvent } from './ToolCards';

export type Step =
  | { kind: 'reasoning' | 'text'; text: string }
  | { kind: 'tool'; tool: ToolEvent };

// Renderiza los pasos del agente en orden cronológico.
export default function StepsView({ steps, streaming, onPreview, onExec, onOpenCanvas, showThinking = true, defaultOpen = false, }: {
  steps: Step[];
  streaming?: boolean;
  onPreview?: (a: Artifact) => void;
  onExec?: (a: Artifact) => void;
  onOpenCanvas?: (payload: any) => void;
  showThinking?: boolean;
  defaultOpen?: boolean;
  model?: string;
}) {
  return (
    <div className="space-y-1">
      {(() => {
        // Agrupa pasos consecutivos de write_file en una sola tarjeta (estilo Kimi).
        const nodes: React.ReactNode[] = [];
        let wfGroup: ToolEvent[] = [];
        let wfKey = -1;
        const flushWf = () => {
          if (wfGroup.length) {
            nodes.push(
              <div key={`wf${wfKey}`} className="relative pl-1">
                <ToolList tools={wfGroup} defaultOpen={defaultOpen} onOpenCanvas={onOpenCanvas} />
              </div>
            );
            wfGroup = [];
          }
        };
        steps.forEach((s, i) => {
          const isLast = i === steps.length - 1;
          const isStreaming = Boolean(streaming && isLast);

          if (s.kind === 'tool' && s.tool.type === 'write_file') {
            if (!wfGroup.length) wfKey = i;
            wfGroup.push(s.tool);
            return;
          }
          flushWf();

          if (s.kind === 'reasoning') {
            if (!showThinking) return;
            nodes.push(
              <div key={i} className="relative pl-1">
                <Proof reasoning={s.text} streaming={isStreaming} />
              </div>
            );
            return;
          }

          if (s.kind === 'text') {
            nodes.push(
              <div key={i} className="relative">
                <div className="pl-5">
                  <Markdown content={s.text} dark onPreview={onPreview} onExec={onExec} />
                </div>
              </div>
            );
            return;
          }

          if (s.kind === 'tool') {
            nodes.push(
              <div key={i} className="relative pl-1">
                <ToolList tools={[s.tool]} defaultOpen={defaultOpen} onOpenCanvas={onOpenCanvas} />
              </div>
            );
          }
        });
        flushWf();
        return nodes;
      })()}
      {streaming && (
        <div className="flex items-center gap-2 py-2 text-paper-dim/60">
          <span className="font-mono text-[9.5px] tracking-[0.15em] uppercase flex items-center gap-1.5">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--accent-bright)] animate-pulse" />
            Razonando…
          </span>
        </div>
      )}
    </div>
  );
}