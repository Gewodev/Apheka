// Protocolo para "anclar" elementos de la app dentro del chat de Charvis:
// arrastrar un curso/material/apunte/tarea/grupo y soltarlo sobre el panel.

export type BrainAnchorKind = 'course' | 'material' | 'note' | 'task' | 'group';

export interface BrainAnchor {
  kind: BrainAnchorKind;
  id: string;
}

export const BRAIN_DROP_MIME = 'application/x-owa-brain-anchor';

// Franja derecha (donde vive el panel de Charvis y su trigger).
export const BRAIN_ZONE_WIDTH = 470;

export function isOverBrainZone(clientX: number): boolean {
  return clientX > window.innerWidth - BRAIN_ZONE_WIDTH;
}

/** Dispara la apertura de Charvis con un elemento anclado (lo escucha App.tsx). */
export function openBrainWithAnchor(anchor: BrainAnchor): void {
  window.dispatchEvent(new CustomEvent<BrainAnchor>('owa-open-brain', { detail: anchor }));
}

/** Lee un anclaje desde dataTransfer (drags nativos HTML5: tareas, apuntes). */
export function readBrainAnchor(e: DragEvent): BrainAnchor | null {
  const raw = e.dataTransfer?.getData(BRAIN_DROP_MIME);
  if (!raw) return null;
  const sep = raw.indexOf(':');
  if (sep <= 0) return null;
  const kind = raw.slice(0, sep) as BrainAnchorKind;
  const id = raw.slice(sep + 1);
  if ((kind !== 'course' && kind !== 'material' && kind !== 'note' && kind !== 'task' && kind !== 'group') || !id) return null;
  return { kind, id };
}

/** Serializa un anclaje para meterlo en el dataTransfer de un drag nativo. */
export function writeBrainAnchor(kind: BrainAnchorKind, id: string): string {
  return `${kind}:${id}`;
}

// Tracker global de la última posición del puntero: los drags de @dnd-kit
// no exponen coordenadas del puntero en onDragEnd, así que las guardamos aquí.
let lastPointerX = -1;
let lastPointerY = -1;
if (typeof window !== 'undefined') {
  window.addEventListener('pointermove', (e) => {
    lastPointerX = e.clientX;
    lastPointerY = e.clientY;
  }, { passive: true });
}

export function getLastPointer(): { x: number; y: number } {
  return { x: lastPointerX, y: lastPointerY };
}

// ─── Estado global de "arrastrando sobre Charvis" ───
// Los drags de @dnd-kit y los long-press de CursosHub no disparan eventos
// nativos de drag&drop sobre el panel de Charvis (no hay dataTransfer), así que
// avisamos al panel por suscripción: cuando cualquier arrastre entra en la
// franja derecha, el chat muestra el overlay "Suelta aquí".
type BrainDragListener = (over: boolean, hint: string | null) => void;
const brainDragListeners = new Set<BrainDragListener>();

export function subscribeBrainDrag(listener: BrainDragListener): () => void {
  brainDragListeners.add(listener);
  return () => {
    brainDragListeners.delete(listener);
  };
}

export function setBrainDragState(over: boolean, hint: string | null = null): void {
  for (const l of brainDragListeners) l(over, hint);
}
