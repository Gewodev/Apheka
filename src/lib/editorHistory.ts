/*
 * Historial Undo/Redo para editores contentEditable.
 *
 * Los navegadores destruyen su pila nativa de undo cuando el DOM se toca por
 * fuera del usuario (merges de bloques, checkboxes, triggers de markdown,
 * innerHTML programático). Este módulo mantiene una pila PROPIA de snapshots
 * {html, caret} con coalescing temporal para agrupar ráfagas de tecleo y
 * restauración exacta del cursor vía offset absoluto de texto.
 */

interface EditorSnapshot {
  html: string;
  caret: number;
  anchor?: {path:number[];offset:number};
  focus?: {path:number[];offset:number};
}

export interface EditorHistory {
  reset(): void;
  /** Captura el estado actual. typing=true permite coalescer ráfagas (<250ms). */
  capture(typing?: boolean): void;
  undo(): boolean;
  redo(): boolean;
  canUndo(): boolean;
  canRedo(): boolean;
}

function getCaretOffset(editor: HTMLElement): number {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return 0;
  const range = sel.getRangeAt(0);
  if (!editor.contains(range.startContainer)) return 0;
  try {
    const pre = document.createRange();
    pre.selectNodeContents(editor);
    pre.setEnd(range.startContainer, range.startOffset);
    return pre.toString().length;
  } catch {
    return 0;
  }
}

function setCaretOffset(editor: HTMLElement, target: number): void {
  try {
    const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
    let remaining = Math.max(0, target);
    let node: Node | null = null;
    let lastText: Text | null = null;
    while ((node = walker.nextNode())) {
      const t = node as Text;
      const len = t.data.length;
      lastText = t;
      if (remaining <= len) {
        const r = document.createRange();
        r.setStart(t, Math.min(remaining, len));
        r.collapse(true);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(r);
        return;
      }
      remaining -= len;
    }
    const r = document.createRange();
    if (lastText) r.setStart(lastText, lastText.data.length);
    else r.selectNodeContents(editor);
    r.collapse(true);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(r);
  } catch {
    /* noop */
  }
}

const COALESCE_MS = 250;
const MAX_ENTRIES = 400;

function selectionPoint(editor:HTMLElement,node:Node|null,offset:number):EditorSnapshot['anchor'] {
  if(!node || !editor.contains(node))return undefined;
  const path:number[]=[];
  let current:Node=node;
  while(current!==editor){
    const parent:ParentNode|null=current.parentNode;
    if(!parent)return undefined;
    path.unshift(Array.prototype.indexOf.call(parent.childNodes,current));
    current=parent;
  }
  return {path,offset};
}

function restoreSelection(editor:HTMLElement,snapshot:EditorSnapshot):boolean {
  if(!snapshot.anchor || !snapshot.focus)return false;
  const resolve=(point:NonNullable<EditorSnapshot['anchor']>)=>{
    let node:Node=editor;
    for(const index of point.path){if(!node.childNodes[index])return null;node=node.childNodes[index];}
    const length=node.nodeType===Node.TEXT_NODE?(node.textContent?.length || 0):node.childNodes.length;
    return {node,offset:Math.max(0,Math.min(length,point.offset))};
  };
  const anchor=resolve(snapshot.anchor),focus=resolve(snapshot.focus);
  if(!anchor || !focus)return false;
  try {window.getSelection()?.setBaseAndExtent(anchor.node,anchor.offset,focus.node,focus.offset);return true;}catch{return false;}
}

export function createEditorHistory(getEditor: () => HTMLElement | null): EditorHistory {
  let entries: EditorSnapshot[] = [];
  let redoEntries: EditorSnapshot[] = [];
  let lastCaptureTs = 0;

  const snapNow = (): EditorSnapshot | null => {
    const ed = getEditor();
    if (!ed) return null;
    const selection=window.getSelection();
    return { html: ed.innerHTML, caret: getCaretOffset(ed),anchor:selectionPoint(ed,selection?.anchorNode || null,selection?.anchorOffset || 0),focus:selectionPoint(ed,selection?.focusNode || null,selection?.focusOffset || 0) };
  };

  const apply = (s: EditorSnapshot): void => {
    const ed = getEditor();
    if (!ed) return;
    ed.innerHTML = s.html;
    ed.focus({preventScroll:true});
    if(!restoreSelection(ed,s))setCaretOffset(ed, s.caret);
  };

  const reset = (): void => {
    entries = [];
    redoEntries = [];
    const s = snapNow();
    if (s) entries.push(s);
    lastCaptureTs = Date.now();
  };

  const capture = (typing = false): void => {
    const s = snapNow();
    if (!s) return;
    const top = entries[entries.length - 1];
    if (top && top.html === s.html) {
      // beforeinput checkpoints the actual selection. Empty paragraphs and
      // formatted boundaries can share a text offset but have different paths.
      if(JSON.stringify(top.anchor)!==JSON.stringify(s.anchor) || JSON.stringify(top.focus)!==JSON.stringify(s.focus))lastCaptureTs=0;
      entries[entries.length-1]=s;
      if (!typing) redoEntries = [];
      return;
    }
    const now = Date.now();
    if (
      typing &&
      redoEntries.length === 0 &&
      entries.length > 1 &&
      now - lastCaptureTs < COALESCE_MS
    ) {
      // Ráfaga de tecleo: la entrada anterior se funde en un solo paso
      entries[entries.length - 1] = s;
      lastCaptureTs = now;
      return;
    }
    entries.push(s);
    if (entries.length > MAX_ENTRIES) entries.shift();
    redoEntries = [];
    lastCaptureTs = typing ? now : 0;
  };

  const undo = (): boolean => {
    if (entries.length === 0) return false;
    const cur = snapNow();
    const top = entries[entries.length - 1];
    if (cur && top && top.html !== cur.html) entries.push(cur);
    if (entries.length <= 1) return false;
    const popped = entries.pop()!;
    redoEntries.push(popped);
    if (redoEntries.length > MAX_ENTRIES) redoEntries.shift();
    const target = entries[entries.length - 1];
    apply(target);
    return true;
  };

  const redo = (): boolean => {
    if (redoEntries.length === 0) return false;
    const next = redoEntries.pop()!;
    const cur = snapNow();
    const top = entries[entries.length - 1];
    if (cur && (!top || top.html !== cur.html)) entries.push(cur);
    entries.push(next);
    apply(next);
    return true;
  };

  return {
    reset,
    capture,
    undo,
    redo,
    canUndo: () => entries.length > 1,
    canRedo: () => redoEntries.length > 0,
  };
}
