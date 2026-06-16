import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Search, Plus, Folder as FolderIcon, Pin, Trash2, FileText, Download, X, Copy, Move,
  AlertTriangle, Check, Bold, Italic, Underline, List, Code, Link, Paperclip,
  Image as ImageIcon, Type, BookOpen, Star, PenTool,
  ArrowLeft, Info, Clock, AlignJustify,
  ChevronDown, ChevronRight, MoreHorizontal, Share2,
  ListOrdered, Quote, Upload, Lock,
  History, Table, File,
  Layers, Edit3, FileOutput,
  Filter, SortAsc, Tag, RefreshCw,
} from "lucide-react";
import { useApp, Note, NoteFolder } from "../../store/AppContext";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import toast from "react-hot-toast";

const EASE = "cubic-bezier(0.16, 1, 0.3, 1)";
type ViewMode = "lista" | "estante";
type SortMode = "updated" | "created" | "title" | "course" | "visits" | "priority";
type ActiveView = "explorer" | "editor";

const SPINE_COLORS = [
  "#E11D48", "#3B82F6", "#10B981", "#F59E0B", "#8B5CF6",
  "#EC4899", "#06B6D4", "#84CC16", "#F97316", "#6366F1",
  "#14B8A6", "#D946EF", "#0EA5E9", "#22C55E", "#EAB308",
];

function getSpineColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = ((hash << 5) - hash) + id.charCodeAt(i);
  return SPINE_COLORS[Math.abs(hash) % SPINE_COLORS.length];
}

function formatTimeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Ahora";
  if (mins < 60) return "Hace " + mins + " min";
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return "Hace " + hrs + "h";
  const days = Math.floor(hrs / 24);
  if (days < 7) return "Hace " + days + " d\u00edas";
  try { return format(new Date(date), "d MMM", { locale: es }); } catch { return ""; }
}

function getWordCount(html: string): number {
  return html.replace(/<[^>]+>/g, "").split(/\s+/).filter(Boolean).length;
}

function getCharCount(html: string): number {
  return html.replace(/<[^>]+>/g, "").length;
}

function getPageCount(html: string): number {
  const wc = getWordCount(html);
  return Math.max(1, Math.ceil(wc / 250));
}

function getReadTime(html: string): number {
  return Math.max(1, Math.ceil(getWordCount(html) / 200));
}

/* ====== BLOCK STRIP CARD (lista view) ====== */
interface NoteCardProps {
  note: Note;
  isSelected: boolean;
  onSelect: () => void;
  onOpen: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  index: number;
}

const cardHov: React.CSSProperties = {
  borderColor: "var(--border-strong)",
  boxShadow: "var(--shadow-card), 0 0 0 1px var(--accent-glow)",
  transform: "translateY(-2px)",
};

function NoteCard({ note, isSelected, onSelect, onOpen, onContextMenu, onDragStart, onDragOver, onDrop, index }: NoteCardProps) {
  const spineColor = note.courseColor || getSpineColor(note.id);
  const preview = useMemo(() => {
    const text = note.content.replace(/<[^>]+>/g, "").trim();
    return text.slice(0, 80) || "Sin contenido";
  }, [note.content]);
  const [hov, setHov] = useState(false);

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onClick={onSelect}
      onDoubleClick={onOpen}
      onContextMenu={onContextMenu}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      className="bento-card"
      style={{
        display: "flex", gap: 14,
        padding: "14px 16px", cursor: "pointer",
        background: isSelected
          ? "linear-gradient(135deg, var(--bg-elevated) 0%, var(--bg-base) 100%)"
          : "linear-gradient(135deg, var(--bg-elevated) 0%, var(--bg-base) 100%)",
        border: "1px solid " + (isSelected ? "var(--accent)" : "var(--border-subtle)"),
        borderRadius: "var(--radius-lg)",
        transition: "all 400ms " + EASE,
        transform: hov && !isSelected ? "translateY(-2px)" : "none",
        boxShadow: isSelected
          ? "var(--shadow-card), 0 0 0 1px var(--accent-glow)"
          : hov ? "var(--shadow-card)" : "none",
        position: "relative",
      }}
    >
      {/* Left accent indicator */}
      <div style={{
        position: "absolute", left: 0, top: 10, bottom: 10, width: 4,
        background: "linear-gradient(180deg, " + spineColor + ", " + spineColor + "88)",
        borderRadius: "0 4px 4px 0",
        opacity: isSelected || hov ? 1 : 0,
        transition: "opacity 300ms " + EASE,
      }} />

      {/* Icon — only colored element */}
      <div style={{
        width: 42, height: 42, borderRadius: "var(--radius-sm)", flexShrink: 0,
        background: "linear-gradient(135deg, " + spineColor + "18, " + spineColor + "06)",
        display: "flex", alignItems: "center", justifyContent: "center",
        border: "1px solid " + spineColor + "12",
      }}>
        <FileText size={19} style={{ color: spineColor }} />
      </div>

      {/* Main content */}
      <div style={{
        flex: 1, minWidth: 0, display: "flex", flexDirection: "column",
        gap: 5, justifyContent: "center",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{
            fontSize: 14, fontWeight: 600, color: "var(--text-primary)",
            fontFamily: "var(--font-heading)",
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }}>{note.title || "Sin t\u00edtulo"}</span>
          {note.isPinned && <Star size={10} fill="#F59E0B" style={{ color: "#F59E0B", flexShrink: 0 }} />}
        </div>
        <div style={{
          fontSize: 12, color: "var(--text-tertiary)", lineHeight: 1.45,
          display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}>{preview}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          {note.course && (
            <span style={{
              fontSize: 10, fontWeight: 600, color: spineColor,
              background: spineColor + "14", padding: "2px 10px", borderRadius: "var(--radius-sm)",
              letterSpacing: "0.01em",
            }}>{note.course}</span>
          )}
          {note.tags && note.tags.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              {note.tags.slice(0, 2).map((t) => (
                <span key={t} style={{
                  fontSize: 9, color: "var(--text-muted)",
                  background: "var(--bg-hover)", padding: "1px 7px", borderRadius: 4,
                }}>{t}</span>
              ))}
              {note.tags.length > 2 && (
                <span style={{ fontSize: 9, color: "var(--text-muted)" }}>+{note.tags.length - 2}</span>
              )}
            </div>
          )}
          {note.attachments && note.attachments.length > 0 && (
            <Paperclip size={10} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
          )}
        </div>
      </div>

      {/* Right: time above menu */}
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "flex-end",
        justifyContent: "space-between", flexShrink: 0, padding: "2px 0",
      }}>
        <span style={{
          fontSize: 10, color: "var(--text-muted)",
          fontFamily: "var(--font-mono)", whiteSpace: "nowrap",
          background: "var(--bg-hover)", padding: "1px 7px", borderRadius: 6,
        }}>
          {formatTimeAgo(note.updatedAt)}
        </span>
        <button onClick={(e) => { e.stopPropagation(); onContextMenu(e); }}
          style={{
            background: "none", border: "none", cursor: "pointer",
            color: "var(--text-muted)", padding: 6, display: "flex",
            borderRadius: 6,
            opacity: hov ? 1 : 0, transition: "opacity 200ms " + EASE,
          }}
          className="hover:bg-[var(--bg-hover)]">
          <MoreHorizontal size={16} />
        </button>
      </div>
    </div>
  );
}

/* ====== BOOKSHELF BOOK (estante view) ====== */
interface BookshelfBookProps {
  note: Note;
  isSelected: boolean;
  onSelect: () => void;
  onDoubleClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  maxHeight: number;
  minHeight: number;
}

function BookshelfBook({ note, isSelected, onSelect, onDoubleClick, onContextMenu, maxHeight, minHeight }: BookshelfBookProps) {
  const spineColor = note.courseColor || getSpineColor(note.id);
  const [hov, setHov] = useState(false);
  const wordCount = useMemo(() => getWordCount(note.content || ""), [note.content]);
  const pageCount = useMemo(() => getPageCount(note.content || ""), [note.content]);
  const bookHeight = useMemo(() => {
    const raw = minHeight + (wordCount / 500) * (maxHeight - minHeight);
    return Math.min(maxHeight, Math.max(minHeight, raw));
  }, [wordCount, maxHeight, minHeight]);
  const bookWidth = 64 + (pageCount > 5 ? Math.min(pageCount * 2, 20) : 0);

  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", gap: 0,
      position: "relative", cursor: "pointer",
      transform: hov ? "translateY(-6px)" : "translateY(0)",
      transition: "transform 500ms " + EASE,
    }}
      onClick={onSelect}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
    >
      <div style={{
        width: bookWidth, height: bookHeight,
        position: "relative",
        borderRadius: "3px 6px 6px 3px",
        background: "linear-gradient(160deg, #faf8f4 0%, #f0ece4 100%)",
        boxShadow: isSelected
          ? "0 6px 20px rgba(0,0,0,0.3), 0 0 0 2px var(--accent)"
          : hov
            ? "0 10px 30px rgba(0,0,0,0.25), 0 2px 6px rgba(0,0,0,0.1)"
            : "0 3px 8px rgba(0,0,0,0.12)",
        transition: "box-shadow 400ms " + EASE,
        overflow: "hidden",
        display: "flex", flexDirection: "column", justifyContent: "flex-end",
      }}>
        {/* Colored spine strip */}
        <div style={{
          position: "absolute", left: 0, top: 0, bottom: 0, width: 10,
          background: "linear-gradient(180deg, " + spineColor + ", " + spineColor + "cc)",
          borderRadius: "3px 0 0 3px",
        }} />
        <div style={{
          position: "absolute", left: 10, top: 0, bottom: 0, width: 1,
          background: "linear-gradient(180deg, " + spineColor + "88, " + spineColor + "33)",
        }} />
        <div style={{
          position: "absolute", right: 0, top: 2, bottom: 2, width: 3,
          background: "linear-gradient(90deg, #e8e4dc, #ddd8d0)",
          borderRadius: "0 4px 4px 0",
        }} />
        <div style={{
          padding: "12px 8px 8px 16px",
          display: "flex", flexDirection: "column",
          justifyContent: "flex-end", flex: 1,
        }}>
          {note.isPinned && (
            <div style={{ marginBottom: 4 }}>
              <Star size={7} fill="#F59E0B" style={{ color: "#F59E0B" }} />
            </div>
          )}
          <div style={{
            fontSize: 7 + (bookHeight > 180 ? 1 : 0),
            fontWeight: 700, color: "var(--text-primary)",
            fontFamily: "var(--font-heading)", lineHeight: 1.2,
            display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical",
            overflow: "hidden", letterSpacing: "-0.01em",
          }}>{note.title || "Nota"}</div>
          {note.course && (
            <div style={{
              fontSize: 5, fontWeight: 600, color: "var(--text-tertiary)",
              marginTop: 3, textTransform: "uppercase",
              letterSpacing: "0.06em", whiteSpace: "nowrap",
              overflow: "hidden", textOverflow: "ellipsis",
            }}>{note.course}</div>
          )}
        </div>
        {bookHeight > 160 && (
          <div style={{
            padding: "2px 6px 5px 16px", display: "flex", alignItems: "center", gap: 3,
          }}>
            <div style={{
              flex: 1, height: 2, borderRadius: 1,
              background: "rgba(0,0,0,0.06)",
              overflow: "hidden",
            }}>
              <div style={{
                width: Math.min(100, Math.round(pageCount * 6)) + "%",
                height: "100%",
                background: spineColor + "66",
                borderRadius: 1,
              }} />
            </div>
            <span style={{
              fontSize: 5, fontWeight: 600, color: "var(--text-tertiary)",
              whiteSpace: "nowrap",
            }}>{pageCount}p</span>
          </div>
        )}
      </div>
      <div style={{
        width: bookWidth + 24, height: 5,
        background: "radial-gradient(ellipse at center, rgba(0,0,0,0.12) 0%, transparent 70%)",
        marginTop: -1, opacity: hov ? 0.7 : 0.3,
        transition: "opacity 400ms " + EASE,
      }} />
    </div>
  );
}

/* ====== FILTER BAR ====== */
interface FilterBarProps {
  folders: NoteFolder[];
  notes: Note[];
  selectedFolderId: string | null;
  selectedTag: string | null;
  onSelectFolder: (id: string | null) => void;
  onSelectTag: (tag: string | null) => void;
}

function FilterBar({ folders, notes, selectedFolderId, selectedTag, onSelectFolder, onSelectTag }: FilterBarProps) {
  const allTags = useMemo(() => {
    const set = new Set<string>();
    notes.forEach((n) => n.tags?.forEach((t) => set.add(t)));
    return Array.from(set);
  }, [notes]);

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap",
    }}>
      {folders.slice(0, 5).map((f) => {
        const count = notes.filter((n) => n.folderId === f.id).length;
        if (count === 0) return null;
        const sel = selectedFolderId === f.id;
        return (
          <button key={f.id} onClick={() => onSelectFolder(sel ? null : f.id)}
            style={{
              display: "flex", alignItems: "center", gap: 5,
              padding: "4px 10px", borderRadius: "var(--radius-full)",
              border: "1px solid " + (sel ? "var(--accent)" : "var(--border-subtle)"),
              background: sel ? "var(--accent-soft)" : "linear-gradient(135deg, var(--bg-elevated) 0%, var(--bg-base) 100%)",
              color: sel ? "var(--accent)" : "var(--text-secondary)",
              cursor: "pointer", fontSize: 11, fontWeight: 500,
              fontFamily: "var(--font-primary)",
              transition: "all 200ms " + EASE,
            }}>
            <FolderIcon size={12} style={{ color: f.color || "var(--text-tertiary)" }} />
            {f.name}
            <span style={{ fontSize: 9, opacity: 0.7 }}>{count}</span>
          </button>
        );
      })}
      {allTags.slice(0, 3).map((tag) => {
        const count = notes.filter((n) => n.tags?.includes(tag)).length;
        const sel = selectedTag === tag;
        return (
          <button key={tag} onClick={() => onSelectTag(sel ? null : tag)}
            style={{
              display: "flex", alignItems: "center", gap: 5,
              padding: "4px 10px", borderRadius: "var(--radius-full)",
              border: "1px solid " + (sel ? "var(--accent)" : "var(--border-subtle)"),
              background: sel ? "var(--accent-soft)" : "linear-gradient(135deg, var(--bg-elevated) 0%, var(--bg-base) 100%)",
              color: sel ? "var(--accent)" : "var(--text-secondary)",
              cursor: "pointer", fontSize: 11, fontWeight: 500,
              fontFamily: "var(--font-primary)",
              transition: "all 200ms " + EASE,
            }}>
            <Tag size={12} />
            {tag}
            <span style={{ fontSize: 9, opacity: 0.7 }}>{count}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ====== LIBRARY SIDEBAR ====== */
interface LibrarySidebarProps {
  folders: NoteFolder[];
  notes: Note[];
  selectedFolderId: string | null;
  selectedTag: string | null;
  onSelectFolder: (id: string | null) => void;
  onSelectTag: (tag: string | null) => void;
  onNewFolder: () => void;
}

const TAG_COLORS: Record<string, string> = {
  Importante: "#E11D48", Examen: "#F59E0B", Proyecto: "#8B5CF6",
  Pendiente: "#3B82F6", Leer: "#10B981", Revisar: "#EC4899", Finalizado: "#6B7280",
};

function LibrarySidebar({ folders, notes, selectedFolderId, selectedTag,
  onSelectFolder, onSelectTag, onNewFolder }: LibrarySidebarProps) {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [showTagSection, setShowTagSection] = useState(true);

  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    notes.forEach((n) => n.tags?.forEach((t) => tagSet.add(t)));
    return Array.from(tagSet);
  }, [notes]);

  const toggleFolder = (id: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const subfolders: Record<string, string[]> = {
    "Apuntes": ["Res\u00famenes", "Ejercicios", "Laboratorio"],
    "Proyectos": ["Investigaci\u00f3n", "Documentaci\u00f3n", "Recursos"],
    "Evaluaciones": ["Ex\u00e1menes", "Formularios", "Trabajos"],
  };

  return (
    <div style={{
      width: 260, minWidth: 260, flexShrink: 0, display: "flex", flexDirection: "column",
      paddingRight: 20, overflow: "hidden",
      borderRight: "1px solid var(--border-subtle)",
    }}>
      <div style={{ flex: 1, overflow: "auto" }}>
        {/* Carpetas header */}
        <div style={{
          display: "flex", alignItems: "center", gap: 6, marginBottom: 8, paddingLeft: 4,
        }}>
          <span style={{
            fontSize: 9, fontWeight: 700, color: "var(--text-tertiary)",
            textTransform: "uppercase", letterSpacing: "0.08em",
          }}>Carpetas</span>
          <button onClick={onNewFolder} title="Nueva carpeta"
            style={{
              width: 18, height: 18,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: "none", border: "1px dashed var(--border-default)",
              borderRadius: 5, color: "var(--accent)", cursor: "pointer",
              padding: 0, marginLeft: 2, transition: "all 200ms " + EASE,
            }}
            className="hover:border-[var(--accent)] hover:bg-[var(--accent-dim)]">
            <Plus size={10} />
          </button>
        </div>

        <button onClick={() => onSelectFolder(null)}
          style={{
            display: "flex", alignItems: "center", gap: 8, width: "100%",
            padding: "7px 8px",
            background: !selectedFolderId ? "linear-gradient(135deg, var(--accent-dim) 0%, transparent 100%)" : "transparent",
            border: "none", borderRadius: "var(--radius-sm)",
            color: !selectedFolderId ? "var(--accent)" : "var(--text-secondary)",
            cursor: "pointer", fontSize: 12, fontFamily: "var(--font-primary)",
            textAlign: "left", transition: "all 200ms " + EASE,
          }}
          className="hover:bg-[var(--bg-hover)]">
          <Layers size={14} />
          Todos los cuadernos
          <span style={{
            marginLeft: "auto", fontSize: 9, color: !selectedFolderId ? "var(--accent)" : "var(--text-muted)",
            background: !selectedFolderId ? "var(--accent-soft)" : "var(--bg-hover)",
            padding: "1px 7px", borderRadius: 8, fontWeight: 600,
          }}>{notes.length}</span>
        </button>

        {folders.map((f) => {
          const isExpanded = expandedFolders.has(f.id);
          const count = notes.filter((n) => n.folderId === f.id).length;
          const subs = subfolders[f.name] || [];
          return (
            <div key={f.id}>
              <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
                {subs.length > 0 && (
                  <button onClick={() => toggleFolder(f.id)}
                    style={{
                      background: "none", border: "none", color: "var(--text-muted)",
                      cursor: "pointer", padding: 4, display: "flex",
                      transition: "transform 300ms " + EASE,
                      transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
                    }}>
                    <ChevronRight size={12} />
                  </button>
                )}
                {subs.length === 0 && <div style={{ width: 20 }} />}
                <button onClick={() => onSelectFolder(f.id)}
                  style={{
                    display: "flex", alignItems: "center", gap: 8, flex: 1,
                    padding: "7px 8px",
                    background: selectedFolderId === f.id ? "linear-gradient(135deg, var(--accent-dim) 0%, transparent 100%)" : "transparent",
                    border: "none", borderRadius: "var(--radius-sm)",
                    color: selectedFolderId === f.id ? "var(--accent)" : "var(--text-secondary)",
                    cursor: "pointer", fontSize: 12, fontFamily: "var(--font-primary)",
                    textAlign: "left", transition: "all 200ms " + EASE,
                  }}
                  className="hover:bg-[var(--bg-hover)]">
                  <FolderIcon size={14} style={{ color: f.color || "var(--text-tertiary)" }} />
                  {f.name}
                  <span style={{
                    marginLeft: "auto", fontSize: 9, color: selectedFolderId === f.id ? "var(--accent)" : "var(--text-muted)",
                    background: selectedFolderId === f.id ? "var(--accent-soft)" : "var(--bg-hover)",
                    padding: "1px 7px", borderRadius: 8, fontWeight: 600,
                  }}>{count}</span>
                </button>
              </div>
              {subs.length > 0 && (
                <div style={{
                  overflow: "hidden",
                  maxHeight: isExpanded ? subs.length * 36 : 0,
                  transition: "max-height 300ms " + EASE,
                }}>
                  {subs.map((sub) => (
                    <button key={sub} onClick={() => onSelectFolder(f.id)}
                      style={{
                        display: "flex", alignItems: "center", gap: 8,
                        width: "100%", padding: "5px 8px 5px 48px",
                        background: "none", border: "none", borderRadius: "var(--radius-sm)",
                        color: "var(--text-tertiary)", cursor: "pointer",
                        fontSize: 11, fontFamily: "var(--font-primary)", textAlign: "left",
                        transition: "all 200ms " + EASE,
                      }}
                      className="hover:bg-[var(--bg-hover)] hover:text-[var(--text-secondary)]">
                      <FileText size={12} style={{ color: "var(--text-muted)" }} />
                      {sub}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {allTags.length > 0 && (
          <div style={{ marginTop: 24 }}>
            <button onClick={() => setShowTagSection(!showTagSection)}
              style={{
                display: "flex", alignItems: "center", gap: 6, width: "100%",
                background: "none", border: "none", color: "var(--text-tertiary)",
                cursor: "pointer", padding: "4px", fontSize: 9, fontWeight: 700,
                textTransform: "uppercase", letterSpacing: "0.08em",
                fontFamily: "var(--font-primary)", textAlign: "left",
                transition: "all 200ms " + EASE,
              }}
              className="hover:text-[var(--text-secondary)]">
              <Tag size={13} style={{ color: "var(--accent)" }} />
              Etiquetas
              <span style={{
                fontSize: 9, color: "var(--text-muted)",
                background: "var(--bg-hover)", padding: "0 6px", borderRadius: 8,
                marginLeft: 4, fontWeight: 600,
              }}>{allTags.length}</span>
              <ChevronDown size={11} style={{
                marginLeft: "auto",
                transform: showTagSection ? "rotate(0deg)" : "rotate(-90deg)",
                transition: "transform 300ms " + EASE,
              }} />
            </button>
            <div style={{
              overflow: "hidden", maxHeight: showTagSection ? 400 : 0,
              transition: "max-height 300ms " + EASE,
            }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 6 }}>
                {allTags.map((tag) => {
                  const count = notes.filter((n) => n.tags?.includes(tag)).length;
                  const dotColor = TAG_COLORS[tag] || "var(--accent)";
                  return (
                    <button key={tag} onClick={() => onSelectTag(selectedTag === tag ? null : tag)}
                      style={{
                        display: "flex", alignItems: "center", gap: 8, width: "100%",
                        padding: "6px 8px",
                        background: selectedTag === tag ? "linear-gradient(135deg, var(--accent-dim) 0%, transparent 100%)" : "transparent",
                        border: "none", borderRadius: "var(--radius-sm)",
                        color: selectedTag === tag ? "var(--accent)" : "var(--text-secondary)",
                        cursor: "pointer", fontSize: 11, fontFamily: "var(--font-primary)",
                        textAlign: "left", transition: "all 200ms " + EASE,
                        borderLeft: "3px solid " + (selectedTag === tag ? dotColor : "transparent"),
                      }}
                      className="hover:bg-[var(--bg-hover)]">
                      <div style={{
                        width: 8, height: 8, borderRadius: "50%",
                        background: dotColor, flexShrink: 0,
                        boxShadow: selectedTag === tag ? "0 0 10px " + dotColor + "99" : "none",
                        transition: "box-shadow 200ms " + EASE,
                      }} />
                      <span style={{
                        textTransform: "capitalize", flex: 1, minWidth: 0,
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        fontWeight: selectedTag === tag ? 600 : 400,
                      }}>{tag}</span>
                      <span style={{
                        fontSize: 9, color: selectedTag === tag ? "var(--accent)" : "var(--text-muted)",
                        background: selectedTag === tag ? "var(--accent-soft)" : "var(--bg-hover)",
                        padding: "0 7px", borderRadius: 8,
                        fontWeight: 600, minWidth: 20, textAlign: "center",
                      }}>{count}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ====== EDITOR TOOLBAR ====== */
interface EditorToolbarProps {
  onFormat: (cmd: string, value?: string) => void;
}

const toolBtn: React.CSSProperties = {
  background: "none", border: "none", color: "var(--text-secondary)",
  cursor: "pointer", width: 30, height: 30, borderRadius: "var(--radius-sm)",
  display: "flex", alignItems: "center", justifyContent: "center",
  transition: "all 150ms " + EASE, fontSize: 11,
  fontFamily: "var(--font-primary)", flexShrink: 0,
};

const toolDiv: React.CSSProperties = {
  width: 1, height: 20, background: "var(--border-subtle)", margin: "0 4px", flexShrink: 0,
};

function EditorToolbar({ onFormat }: EditorToolbarProps) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap",
      padding: "6px 12px",
      background: "linear-gradient(135deg, var(--bg-surface) 0%, var(--bg-base) 100%)",
      border: "1px solid var(--border-default)", borderRadius: "var(--radius-lg)",
      boxShadow: "var(--shadow-card)",
    }}>
      {[
        { cmd: "formatBlock", value: "<h1>", label: "H1", w: 700, s: 13 },
        { cmd: "formatBlock", value: "<h2>", label: "H2", w: 600, s: 12 },
        { cmd: "formatBlock", value: "<h3>", label: "H3", w: 600, s: 11 },
      ].map((b) => (
        <button key={b.label} onClick={() => onFormat(b.cmd, b.value)}
          style={{ ...toolBtn, fontWeight: b.w, fontSize: b.s, width: 34 }}>
          {b.label}
        </button>
      ))}
      <div style={toolDiv} />
      <button onClick={() => onFormat("bold")} style={toolBtn} title="Negrita"><Bold size={15} /></button>
      <button onClick={() => onFormat("italic")} style={toolBtn} title="Cursiva"><Italic size={15} /></button>
      <button onClick={() => onFormat("underline")} style={toolBtn} title="Subrayado"><Underline size={15} /></button>
      <div style={toolDiv} />
      <button onClick={() => onFormat("insertUnorderedList")} style={toolBtn} title="Lista"><List size={15} /></button>
      <button onClick={() => onFormat("insertOrderedList")} style={toolBtn} title="Lista ordenada"><ListOrdered size={15} /></button>
      <button onClick={() => onFormat("insertHTML")} value='<input type="checkbox" />' style={toolBtn} title="Checklist"><Check size={15} /></button>
      <div style={toolDiv} />
      <button onClick={() => onFormat("formatBlock", "<pre>")} style={toolBtn} title="C\u00f3digo"><Code size={15} /></button>
      <button onClick={() => onFormat("createLink")} style={toolBtn} title="Enlace"><Link size={15} /></button>
      <button onClick={() => onFormat("formatBlock", "<blockquote>")} style={toolBtn} title="Cita"><Quote size={15} /></button>
      <div style={toolDiv} />
      <button onClick={() => onFormat("insertImage")} style={toolBtn} title="Imagen"><ImageIcon size={15} /></button>
      <button onClick={() => onFormat("insertHTML", "<table><tr><td></td></tr></table>")} style={toolBtn} title="Tabla"><Table size={15} /></button>
      <div style={toolDiv} />
      <button style={toolBtn} title="Historial"><History size={15} /></button>
      <button style={toolBtn} title="Compartir"><Share2 size={15} /></button>
      <button style={toolBtn} title="Exportar"><Download size={15} /></button>
    </div>
  );
}

/* ====== MAIN COMPONENT ====== */
export default function Notas() {
  const { notes, noteFolders: folders, addNote, updateNote, deleteNote, addNoteFolder, deleteNoteFolder, duplicateNote, reorderNotes } = useApp();

  const [activeView, setActiveView] = useState<ActiveView>("explorer");
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("lista");
  const [sortMode, setSortMode] = useState<SortMode>("updated");
  const [searchQuery, setSearchQuery] = useState("");
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; noteId: string } | null>(null);
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [showPopupEditor, setShowPopupEditor] = useState(false);
  const [editorContent, setEditorContent] = useState("");
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "pending">("saved");
  const [timeStr, setTimeStr] = useState(() => format(new Date(), "HH:mm"));
  const [secStr, setSecStr] = useState(() => format(new Date(), "ss"));

  const editorRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setTimeStr(format(now, "HH:mm"));
      setSecStr(format(now, "ss"));
    };
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const dateStr = useMemo(() => {
    try {
      const d = format(new Date(), "EEEE, d 'de' MMMM 'de' yyyy", { locale: es });
      return d.charAt(0).toUpperCase() + d.slice(1);
    } catch { return ""; }
  }, []);

  const selectedNote = useMemo(
    () => notes.find((n) => n.id === selectedNoteId) || null,
    [notes, selectedNoteId],
  );

  const currentFolder = useMemo(
    () => folders.find((f) => f.id === selectedFolderId),
    [folders, selectedFolderId],
  );

  const filteredNotes = useMemo(() => {
    let result = [...notes];
    if (selectedFolderId) result = result.filter((n) => n.folderId === selectedFolderId);
    if (selectedTag) result = result.filter((n) => n.tags?.includes(selectedTag));
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((n) =>
        n.title.toLowerCase().includes(q) ||
        (n.subtitle && n.subtitle.toLowerCase().includes(q)) ||
        (n.content && n.content.toLowerCase().includes(q)) ||
        (n.tags && n.tags.some((t) => t.toLowerCase().includes(q))),
      );
    }
    result.sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
      if (sortMode === "priority") {
        const order = { high: 0, medium: 1, low: 2, none: 3 };
        return (order[a.priority || "none"] - order[b.priority || "none"]);
      }
      if (sortMode === "course") {
        if (a.course !== b.course) return a.course.localeCompare(b.course);
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      }
      if (sortMode === "visits") {
        return (b.sortOrder || 0) - (a.sortOrder || 0);
      }
      switch (sortMode) {
        case "updated": return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        case "created": return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case "title": return a.title.localeCompare(b.title);
        default: return 0;
      }
    });
    return result;
  }, [notes, selectedFolderId, selectedTag, searchQuery, sortMode]);

  const handleCreateNote = useCallback(() => {
    const id = addNote({
      title: "Nuevo cuaderno", content: "", subtitle: "",
      folderId: selectedFolderId || undefined,
      courseColor: currentFolder?.color || "#8B5CF6",
      isPinned: false, course: currentFolder?.name || "", tags: [],
    });
    setSelectedNoteId(id);
    setEditorContent("");
    setActiveView("editor");
  }, [addNote, selectedFolderId, currentFolder]);

  const handleSaveNote = useCallback(() => {
    if (!selectedNote || !editorRef.current) return;
    const content = editorRef.current.innerHTML;
    const text = editorRef.current.innerText || "";
    const title = text.split("\n")[0].slice(0, 100) || "Sin t\u00edtulo";
    updateNote(selectedNote.id, { content, title, subtitle: text.slice(0, 200) });
    setSaveStatus("saved");
  }, [selectedNote, updateNote]);

  const handleSelectNote = useCallback((noteId: string) => {
    setSelectedNoteId(noteId);
    const note = notes.find((n) => n.id === noteId);
    if (note) setEditorContent(note.content || "");
  }, [notes]);

  const handleOpenNote = useCallback(() => {
    if (selectedNote) setActiveView("editor");
  }, [selectedNote]);

  const handleDeleteNote = useCallback(() => {
    if (!selectedNoteId && !contextMenu) return;
    const id = contextMenu ? contextMenu.noteId : selectedNoteId!;
    deleteNote(id);
    if (selectedNoteId === id) { setSelectedNoteId(null); setActiveView("explorer"); }
    setContextMenu(null); setShowDeleteConfirm(false);
    toast.success("Cuaderno eliminado");
  }, [contextMenu, selectedNoteId, deleteNote]);

  const handleContextMenu = useCallback((e: React.MouseEvent, noteId: string) => {
    e.preventDefault(); e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, noteId });
  }, []);

  const handleEditorInput = useCallback(() => {
    setSaveStatus("pending");
    if (editorRef.current && selectedNote) {
      updateNote(selectedNote.id, { content: editorRef.current.innerHTML });
    }
  }, [selectedNote, updateNote]);

  const handleFormat = useCallback((cmd: string, value?: string) => {
    document.execCommand(cmd, false, value);
    editorRef.current?.focus();
    setSaveStatus("pending");
  }, []);

  const handleDuplicate = useCallback(() => {
    if (!selectedNoteId) return;
    const newId = duplicateNote(selectedNoteId);
    if (newId) { setSelectedNoteId(newId); toast.success("Duplicado"); }
  }, [selectedNoteId, duplicateNote]);

  const handleMoveToFolder = useCallback((folderId: string | undefined) => {
    if (!selectedNoteId) return;
    updateNote(selectedNoteId, { folderId });
    setShowMoveModal(false);
    toast.success("Movido");
  }, [selectedNoteId, updateNote]);

  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    setDragIndex(index);
    e.dataTransfer.effectAllowed = "move";
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === dropIndex) return;
    const ids = [...filteredNotes.map((n) => n.id)];
    const [moved] = ids.splice(dragIndex, 1);
    ids.splice(dropIndex, 0, moved);
    reorderNotes(ids);
    setDragIndex(null);
  }, [dragIndex, filteredNotes, reorderNotes]);

  useEffect(() => {
    if (!contextMenu) return;
    const handler = () => setContextMenu(null);
    window.addEventListener("click", handler);
    return () => window.removeEventListener("click", handler);
  }, [contextMenu]);

  useEffect(() => {
    if (activeView !== "editor" || !selectedNote) return;
    const id = setInterval(() => { handleSaveNote(); }, 30000);
    return () => clearInterval(id);
  }, [activeView, selectedNote, handleSaveNote]);

  useEffect(() => {
    if (activeView !== "editor") return;
    const timer = setTimeout(() => { setSaveStatus("saved"); }, 2000);
    return () => clearTimeout(timer);
  }, [editorContent, activeView]);

  const sortLabels: Record<SortMode, string> = {
    updated: "Recientes", created: "Creados", title: "T\u00edtulo",
    course: "Curso", visits: "Visitas", priority: "Prioridad",
  };

  return (
    <div className="page-container" style={{
      display: "flex", flexDirection: "column", height: "100%",
      overflow: "hidden", gap: 20, padding: "20px 28px",
    }}>
      {/* ===== HEADER ===== */}
      <header style={{
        display: "flex", justifyContent: "space-between", alignItems: "flex-end",
        flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: "var(--radius-sm)",
            background: "linear-gradient(135deg, var(--accent-dim), var(--accent)22)",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0, marginBottom: 4,
          }}>
            <BookOpen size={21} style={{ color: "var(--accent)" }} />
          </div>
          <h1 style={{
            fontFamily: "'Inter Tight', sans-serif", fontWeight: 700,
            fontSize: 32, lineHeight: 1.15, letterSpacing: "-0.02em",
            color: "var(--accent)", margin: 0,
            textShadow: "0 0 20px var(--accent-glow)",
          }}>Notas</h1>
          {currentFolder && (
            <span style={{ fontSize: 13, color: "var(--text-tertiary)", fontWeight: 500, paddingBottom: 6 }}>
              / {currentFolder.name}
            </span>
          )}
        </div>
        <div style={{
          display: "flex", alignItems: "center", gap: 12,
          paddingLeft: 16, borderLeft: "1px solid var(--border-subtle)",
          position: "relative",
        }}>
          <div style={{
            position: "absolute", top: "50%", right: 0,
            width: 150, height: 100,
            background: "radial-gradient(circle at center, var(--accent-dim) 0%, transparent 70%)",
            opacity: 0.4, transform: "translateY(-50%)",
            pointerEvents: "none", zIndex: 0,
          }} />
          <div style={{ textAlign: "right", position: "relative", zIndex: 1 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 2, justifyContent: "flex-end" }}>
              <span style={{
                fontFamily: "'Inter Tight', sans-serif", fontSize: 68,
                fontWeight: 200, lineHeight: 0.9, color: "var(--accent)",
                letterSpacing: "0.02em",
                textShadow: "0 0 20px var(--accent-glow)",
              }}>{timeStr}</span>
              <span style={{
                fontFamily: "'Inter Tight', sans-serif", fontSize: 22,
                fontWeight: 200, color: "var(--accent)", opacity: 0.7,
                letterSpacing: "0.02em",
              }}>{secStr}</span>
            </div>
            <span style={{
              fontSize: 9, fontWeight: 700, color: "var(--text-tertiary)",
              textTransform: "uppercase", letterSpacing: "0.08em", marginTop: 4, display: "block",
            }}>{dateStr}</span>
          </div>
        </div>
      </header>

      {/* ===== SEARCH + TOOLS ===== */}
      <div style={{
        display: "flex", flexDirection: "column", gap: 12, flexShrink: 0,
        maxWidth: 600, margin: "0 auto", width: "100%",
      }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          justifyContent: "center",
        }}>
          <div style={{ position: "relative", flex: 1 }}>
            <Search size={16} style={{
              position: "absolute", left: 14, top: "50%",
              transform: "translateY(-50%)", color: "var(--text-muted)",
              pointerEvents: "none", zIndex: 1,
            }} />
            <input type="text" placeholder="Buscar en todas las notas..."
              value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              className="input-base"
              style={{
                width: "100%", height: 44,
                borderRadius: "var(--radius-lg)",
                padding: "0 14px 0 42px",
              }} />
          </div>
          <button onClick={handleCreateNote} title="Nueva nota"
            className="btn-primary hover:shadow-[0_0_14px_var(--accent-glow)]"
            style={{
              width: 44, height: 44,
              display: "flex", alignItems: "center", justifyContent: "center",
              border: "none", borderRadius: "var(--radius-md)",
              cursor: "pointer", flexShrink: 0,
              background: "var(--accent)", color: "#fff",
              transition: "all 200ms " + EASE,
            }}>
            <Plus size={20} />
          </button>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center" }}>
          {(["lista", "estante"] as const).map((v) => {
            const Icon = v === "lista" ? AlignJustify : BookOpen;
            const sel = viewMode === v;
            return (
              <button key={v} onClick={() => setViewMode(v)}
                className={sel ? "btn-primary" : "btn-secondary"}
                style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "8px 22px", borderRadius: "var(--radius-full)",
                  border: "1px solid " + (sel ? "var(--accent)" : "var(--border-default)"),
                  background: sel ? "var(--accent)" : "linear-gradient(135deg, var(--bg-surface) 0%, var(--bg-base) 100%)",
                  color: sel ? "#fff" : "var(--text-secondary)",
                  cursor: "pointer", fontSize: 12, fontWeight: 600,
                  fontFamily: "var(--font-primary)",
                  transition: "all 250ms " + EASE,
                  boxShadow: sel ? "0 2px 12px var(--accent-glow)" : "none",
                }}>
                <Icon size={16} />
                {v === "lista" ? "Bloques" : "Estante"}
              </button>
            );
          })}
        </div>
      </div>

      {/* ===== MAIN CONTENT ===== */}
      <div style={{
        display: "flex", flex: 1, minHeight: 0, gap: 0, overflow: "hidden",
      }}>
        {/* LEFT: LibrarySidebar */}
        <LibrarySidebar folders={folders} notes={notes}
          selectedFolderId={selectedFolderId} selectedTag={selectedTag}
          onSelectFolder={setSelectedFolderId} onSelectTag={setSelectedTag}
          onNewFolder={() => setShowNewFolderModal(true)} />

        {/* CENTER */}
        <div style={{
          flex: 1, minWidth: 0, display: "flex", flexDirection: "column",
          overflow: "hidden", paddingLeft: 20,
        }}>
          {activeView === "explorer" ? (
            <>
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                marginBottom: 12, flexShrink: 0,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{
                    fontSize: 14, fontWeight: 600, color: "var(--text-primary)",
                    fontFamily: "var(--font-heading)",
                  }}>Todas las notas</span>
                  <span style={{
                    fontSize: 9, color: "var(--text-muted)",
                    background: "var(--bg-hover)", padding: "1px 8px", borderRadius: 8,
                    fontFamily: "var(--font-mono)", fontWeight: 600,
                  }}>{filteredNotes.length}</span>
                </div>
                <select value={sortMode} onChange={(e) => setSortMode(e.target.value as SortMode)}
                  style={{
                    background: "linear-gradient(135deg, var(--bg-elevated) 0%, var(--bg-base) 100%)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "var(--radius-sm)", padding: "4px 10px",
                    color: "var(--text-secondary)", fontSize: 11, fontWeight: 500,
                    fontFamily: "var(--font-primary)", cursor: "pointer",
                    outline: "none",
                  }}>
                  {Object.entries(sortLabels).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>

              {/* Filter chips */}
              <div style={{ marginBottom: 12, flexShrink: 0 }}>
                <FilterBar folders={folders} notes={notes}
                  selectedFolderId={selectedFolderId} selectedTag={selectedTag}
                  onSelectFolder={setSelectedFolderId} onSelectTag={setSelectedTag} />
              </div>

              {viewMode === "lista" ? (
                <div style={{
                  flex: 1, overflow: "auto", display: "flex", flexDirection: "column", gap: 4,
                  paddingRight: 4,
                }}>
                  {filteredNotes.length === 0 ? (
                    <div style={{
                      display: "flex", flexDirection: "column", alignItems: "center",
                      justifyContent: "center", height: 200, gap: 8, color: "var(--text-muted)",
                    }}>
                      <FileText size={32} style={{ opacity: 0.3 }} />
                      <span style={{ fontSize: 12 }}>
                        {searchQuery ? "Sin resultados" : "No hay notas"}
                      </span>
                    </div>
                  ) : (
                    filteredNotes.map((note, i) => (
                      <NoteCard key={note.id} note={note}
                        isSelected={selectedNoteId === note.id}
                        onSelect={() => handleSelectNote(note.id)}
                        onOpen={() => { handleSelectNote(note.id); handleOpenNote(); }}
                        onContextMenu={(e) => handleContextMenu(e, note.id)}
                        onDragStart={(e) => handleDragStart(e, i)}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, i)}
                        index={i} />
                    ))
                  )}
                </div>
              ) : (
                <div style={{
                  flex: 1, overflow: "auto", paddingRight: 4,
                  position: "relative",
                }}>
                  {filteredNotes.length === 0 ? (
                    <div style={{
                      display: "flex", flexDirection: "column", alignItems: "center",
                      justifyContent: "center", height: 200, gap: 8, color: "var(--text-muted)",
                    }}>
                      <FileText size={32} style={{ opacity: 0.3 }} />
                      <span style={{ fontSize: 12 }}>
                        {searchQuery ? "Sin resultados" : "No hay notas"}
                      </span>
                    </div>
                  ) : (
                    <>
                      <div style={{
                        display: "flex", flexWrap: "wrap", gap: 16, justifyContent: "flex-start",
                        alignItems: "flex-end", paddingBottom: 8, minHeight: 260,
                      }}>
                        {filteredNotes.slice(0, 25).map((note) => (
                          <BookshelfBook key={note.id} note={note}
                            isSelected={selectedNoteId === note.id}
                            onSelect={() => handleSelectNote(note.id)}
                            onDoubleClick={() => { handleSelectNote(note.id); handleOpenNote(); }}
                            onContextMenu={(e) => handleContextMenu(e, note.id)}
                            maxHeight={220}
                            minHeight={110} />
                        ))}
                        {filteredNotes.length > 25 && (
                          <div style={{
                            width: "100%", textAlign: "center", padding: 12,
                            fontSize: 11, color: "var(--text-muted)",
                          }}>+{filteredNotes.length - 25} m\u00e1s</div>
                        )}
                      </div>
                      <div style={{
                        position: "sticky", bottom: 0, left: 0, right: 0,
                        height: 14,
                        background: "linear-gradient(180deg, #3a2a1a 0%, #2a1a0a 50%, #1a0a00 100%)",
                        borderRadius: "4px 4px 0 0",
                        boxShadow: "0 -2px 10px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.08)",
                        marginTop: -6,
                        display: "flex", alignItems: "center",
                      }}>
                        <div style={{
                          width: "100%", height: 2,
                          background: "linear-gradient(90deg, transparent 2%, rgba(255,255,255,0.06) 50%, transparent 98%)",
                        }} />
                      </div>
                    </>
                  )}
                </div>
              )}
            </>
          ) : selectedNote ? (
            /* ===== EDITOR ===== */
            <div style={{ display: "flex", flexDirection: "column", height: "100%", gap: 0 }}>
              {/* Back button */}
              <div style={{ marginBottom: 12, flexShrink: 0 }}>
                <button onClick={() => setActiveView("explorer")}
                  style={{
                    display: "flex", alignItems: "center", gap: 6,
                    background: "none", border: "none", color: "var(--text-secondary)",
                    cursor: "pointer", fontSize: 12, fontFamily: "var(--font-primary)",
                    padding: "4px 0", transition: "all 200ms " + EASE,
                  }}
                  className="hover:text-[var(--text-primary)]">
                  <ArrowLeft size={16} />
                  Volver
                </button>
              </div>

              <EditorToolbar onFormat={handleFormat} />

              <div style={{ flex: 1, display: "flex", gap: 20, overflow: "hidden", marginTop: 12 }}>
                {/* Editor area */}
                <div style={{
                  flex: 1, minWidth: 0, display: "flex", flexDirection: "column",
                  overflow: "hidden", paddingRight: 4,
                }}>
                  <div
                    ref={titleRef}
                    contentEditable
                    suppressContentEditableWarning
                    style={{
                      fontSize: 28, fontWeight: 700, color: "var(--text-primary)",
                      fontFamily: "'Outfit', sans-serif",
                      letterSpacing: "-0.02em", lineHeight: 1.2,
                      padding: "0 0 4px", outline: "none", marginBottom: 4,
                      caretColor: "var(--accent)",
                    }}
                    dangerouslySetInnerHTML={{ __html: selectedNote.title }}
                  />
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 6, flexShrink: 0 }}>
                    {selectedNote.tags?.map((tag) => (
                      <span key={tag} style={{
                        display: "flex", alignItems: "center", gap: 4, fontSize: 10,
                        color: "var(--text-secondary)", background: "var(--bg-hover)",
                        padding: "2px 8px", borderRadius: 8,
                      }}>
                        {tag}
                        <button onClick={() => updateNote(selectedNote.id, { tags: (selectedNote.tags || []).filter((t) => t !== tag) })}
                          style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: 0, display: "flex" }}>
                          <X size={9} />
                        </button>
                      </span>
                    ))}
                    <button onClick={() => {
                      const t = prompt("Nueva etiqueta:");
                      if (t && t.trim()) updateNote(selectedNote.id, { tags: [...(selectedNote.tags || []), t.trim()] });
                    }}
                      style={{
                        display: "flex", alignItems: "center", gap: 2,
                        background: "none", border: "1px dashed var(--border-default)",
                        borderRadius: 8, padding: "2px 8px", color: "var(--text-muted)",
                        cursor: "pointer", fontSize: 10, fontFamily: "var(--font-primary)",
                      }}>
                      <Plus size={10} /> A\u00f1adir
                    </button>
                  </div>
                  <div style={{
                    display: "flex", alignItems: "center", gap: 12,
                    fontSize: 10, color: "var(--text-muted)", marginBottom: 8, flexShrink: 0,
                  }}>
                    <span>Creado {format(new Date(selectedNote.createdAt), "d MMM yy", { locale: es })}</span>
                    <span>Modificado {formatTimeAgo(selectedNote.updatedAt)}</span>
                    <div style={{ flex: 1 }} />
                    <span style={{
                      display: "flex", alignItems: "center", gap: 4,
                      color: saveStatus === "saved" ? "var(--success)" :
                             saveStatus === "saving" ? "var(--warning)" : "var(--text-muted)",
                      transition: "color 300ms " + EASE,
                    }}>
                      {saveStatus === "saved" ? <Check size={11} /> : <RefreshCw size={11} />}
                      {saveStatus === "saved" ? "Guardado" : saveStatus === "saving" ? "Guardando..." : "Pendiente"}
                    </span>
                  </div>
                  <div
                    ref={editorRef}
                    contentEditable
                    suppressContentEditableWarning
                    dangerouslySetInnerHTML={{ __html: editorContent }}
                    className="notes-editor-area"
                    style={{
                      flex: 1, overflow: "auto", outline: "none",
                      maxWidth: 920, width: "100%",
                      padding: "0 20px 40px",
                      fontSize: 16, lineHeight: 1.8,
                      color: "var(--text-primary)",
                      fontFamily: "var(--font-primary)",
                      caretColor: "var(--accent)",
                    }}
                    onKeyDown={(e) => {
                      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
                        e.preventDefault(); handleSaveNote();
                      }
                    }}
                    onInput={handleEditorInput}
                  />
                  <div style={{
                    flexShrink: 0, display: "flex", alignItems: "center", gap: 16,
                    padding: "6px 0", borderTop: "1px solid var(--border-subtle)",
                    fontSize: 10, color: "var(--text-muted)",
                  }}>
                    <span>{getWordCount(selectedNote.content)} palabras</span>
                    <span>{getCharCount(selectedNote.content)} caracteres</span>
                    <span>{getReadTime(selectedNote.content)} min lectura</span>
                  </div>
                </div>

                {/* RIGHT: Editor info panel */}
                {selectedNote && (
                  <div style={{
                    width: 340, minWidth: 340, flexShrink: 0, display: "flex", flexDirection: "column",
                    overflow: "auto",
                    borderLeft: "1px solid var(--border-subtle)", paddingLeft: 20, marginLeft: 0,
                  }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                      <div>
                        <div style={{
                          fontSize: 9, fontWeight: 700, color: "var(--text-tertiary)",
                          textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10,
                        }}>Informaci\u00f3n</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          {[
                            { label: "Carpeta", value: folders.find((f) => f.id === selectedNote.folderId)?.name || "\u2014" },
                            { label: "Curso", value: selectedNote.course || "\u2014" },
                            { label: "Creado", value: format(new Date(selectedNote.createdAt), "d MMM yy", { locale: es }) },
                            { label: "Modificado", value: formatTimeAgo(selectedNote.updatedAt) },
                            { label: "Palabras", value: getWordCount(selectedNote.content) },
                          ].map((s) => (
                            <div key={s.label} style={{
                              display: "flex", justifyContent: "space-between",
                              fontSize: 11, color: "var(--text-secondary)",
                              padding: "4px 0", borderBottom: "1px solid var(--border-soft)",
                            }}>
                              <span style={{ color: "var(--text-tertiary)" }}>{s.label}</span>
                              <span>{s.value}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <div style={{
                          fontSize: 9, fontWeight: 700, color: "var(--text-tertiary)",
                          textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8,
                        }}>Etiquetas</div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                          {selectedNote.tags && selectedNote.tags.length > 0 ? selectedNote.tags.map((tag) => (
                            <span key={tag} style={{
                              display: "flex", alignItems: "center", gap: 4, fontSize: 10,
                              color: "var(--text-secondary)", background: "var(--bg-hover)",
                              padding: "3px 8px", borderRadius: 8,
                            }}>
                              <div style={{ width: 5, height: 5, borderRadius: "50%", background: TAG_COLORS[tag] || "var(--accent)" }} />
                              {tag}
                            </span>
                          )) : (
                            <span style={{ fontSize: 10, color: "var(--text-muted)" }}>Sin etiquetas</span>
                          )}
                        </div>
                      </div>

                      <div>
                        <div style={{
                          fontSize: 9, fontWeight: 700, color: "var(--text-tertiary)",
                          textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8,
                        }}>Relacionados</div>
                        {(() => {
                          const related = notes.filter((n) =>
                            n.id !== selectedNote.id &&
                            (n.folderId === selectedNote.folderId ||
                             n.tags?.some((t) => selectedNote.tags?.includes(t)))
                          ).slice(0, 4);
                          if (related.length === 0) return (
                            <span style={{ fontSize: 10, color: "var(--text-muted)" }}>Sin notas relacionadas</span>
                          );
                          return (
                            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                              {related.map((r) => (
                                <button key={r.id}
                                  onClick={() => { handleSelectNote(r.id); setActiveView("editor"); }}
                                  style={{
                                    display: "flex", alignItems: "center", gap: 8, width: "100%",
                                    padding: "7px 10px",
                                    background: "linear-gradient(135deg, var(--bg-elevated) 0%, var(--bg-base) 100%)",
                                    border: "1px solid var(--border-subtle)",
                                    borderRadius: "var(--radius-sm)", cursor: "pointer",
                                    textAlign: "left", fontSize: 11, color: "var(--text-secondary)",
                                    fontFamily: "var(--font-primary)",
                                    transition: "all 200ms " + EASE,
                                  }}
                                  className="hover:border-[var(--border-default)]">
                                  <FileText size={12} style={{ color: getSpineColor(r.id), flexShrink: 0 }} />
                                  <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.title}</span>
                                  <span style={{ fontSize: 9, color: "var(--text-muted)", flexShrink: 0 }}>
                                    {(r.course || "").slice(0, 8)}
                                  </span>
                                </button>
                              ))}
                            </div>
                          );
                        })()}
                      </div>

                      <div style={{ marginTop: "auto", paddingTop: 12, borderTop: "1px solid var(--border-subtle)" }}>
                        <div style={{
                          fontSize: 9, fontWeight: 700, color: "var(--text-tertiary)",
                          textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8,
                        }}>Acceso r\u00e1pido</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                          {[
                            { label: "Exportar PDF", icon: FileOutput, action: () => toast.success("Exportado") },
                            { label: "Duplicar", icon: Copy, action: handleDuplicate },
                            { label: "Editor emergente", icon: Edit3, action: () => setShowPopupEditor(true) },
                          ].map((a) => {
                            const Icon = a.icon;
                            return (
                              <button key={a.label} onClick={a.action}
                                style={{
                                  display: "flex", alignItems: "center", gap: 8, width: "100%",
                                  padding: "6px 8px", background: "none", border: "none",
                                  borderRadius: "var(--radius-sm)", color: "var(--text-secondary)",
                                  cursor: "pointer", fontSize: 11, fontFamily: "var(--font-primary)",
                                  textAlign: "left", transition: "all 150ms " + EASE,
                                }}
                                className="hover:bg-[var(--bg-hover)]">
                                <Icon size={13} style={{ color: "var(--text-muted)" }} />
                                {a.label}
                              </button>
                            );
                          })}
                          <div style={{ height: 1, background: "var(--border-subtle)", margin: "4px 0" }} />
                          <button onClick={() => setShowDeleteConfirm(true)}
                            style={{
                              display: "flex", alignItems: "center", gap: 8, width: "100%",
                              padding: "6px 8px", background: "none", border: "none",
                              borderRadius: "var(--radius-sm)", color: "var(--error)",
                              cursor: "pointer", fontSize: 11, fontFamily: "var(--font-primary)",
                              textAlign: "left", transition: "all 150ms " + EASE,
                            }}
                            className="hover:bg-[var(--error-dim)]">
                            <Trash2 size={13} />
                            Eliminar
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* ===== PREVIEW OVERLAY ===== */}
      {selectedNote && activeView === "explorer" && (
        <div style={{
          position: "fixed", right: 28, top: "50%", zIndex: 100,
          transform: "translateY(-50%)",
          width: 400, maxHeight: "70vh",
          background: "linear-gradient(135deg, var(--bg-elevated) 0%, var(--bg-base) 100%)",
          border: "1px solid var(--border-default)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow-elevated), 0 0 0 1px rgba(0,0,0,0.03)",
          display: "flex", flexDirection: "column",
          overflow: "hidden",
        }}>
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "14px 16px 10px", borderBottom: "1px solid var(--border-subtle)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <FileText size={15} style={{ color: getSpineColor(selectedNote.id) }} />
              <span style={{
                fontSize: 14, fontWeight: 700, color: "var(--text-primary)",
                fontFamily: "var(--font-heading)",
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 200,
              }}>{selectedNote.title || "Sin t\u00edtulo"}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <button onClick={(e) => { e.stopPropagation(); handleSelectNote(selectedNote.id); handleOpenNote(); }}
                className="btn-primary"
                style={{
                  background: "var(--accent)", color: "#fff", border: "none",
                  borderRadius: "var(--radius-sm)", padding: "5px 12px",
                  fontSize: 10, fontWeight: 600, cursor: "pointer",
                  fontFamily: "var(--font-primary)",
                }}>Editar</button>
              <button onClick={() => setSelectedNoteId(null)}
                style={{
                  background: "none", border: "none", color: "var(--text-muted)",
                  cursor: "pointer", padding: 4, display: "flex",
                }}>
                <X size={14} />
              </button>
            </div>
          </div>
          <div style={{
            flex: 1, overflow: "auto", padding: "14px 16px",
            fontSize: 12, lineHeight: 1.7, color: "var(--text-secondary)",
            fontFamily: "var(--font-primary)",
          }}>
            <div
              dangerouslySetInnerHTML={{
                __html: (selectedNote.content || "").slice(0, 800) + ((selectedNote.content || "").length > 800 ? "..." : "")
              }}
            />
          </div>
          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "8px 16px", borderTop: "1px solid var(--border-subtle)",
            fontSize: 10, color: "var(--text-muted)",
          }}>
            <span>{getWordCount(selectedNote.content)} palabras</span>
            <span>{getPageCount(selectedNote.content)} p\u00e1ginas</span>
            {selectedNote.tags && selectedNote.tags.length > 0 && (
              <div style={{ display: "flex", gap: 3, marginLeft: "auto" }}>
                {selectedNote.tags.slice(0, 2).map((t) => (
                  <span key={t} style={{
                    background: "var(--bg-hover)", padding: "1px 6px", borderRadius: 4,
                  }}>{t}</span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== CONTEXT MENU ===== */}
      {contextMenu && (
        <div style={{
          position: "fixed", top: contextMenu.y, left: contextMenu.x, zIndex: 10000,
          background: "linear-gradient(135deg, var(--bg-elevated) 0%, var(--bg-base) 100%)",
          border: "1px solid var(--border-default)",
          borderRadius: "var(--radius-md)", padding: 4, minWidth: 170,
          boxShadow: "var(--shadow-elevated)",
        }}>
          {[
            { label: "Abrir", icon: BookOpen, action: () => { handleSelectNote(contextMenu.noteId); handleOpenNote(); } },
            { label: "Duplicar", icon: Copy, action: handleDuplicate },
            { label: "Fijar", icon: Star, action: () => { const n = notes.find(x => x.id === contextMenu.noteId); if (n) updateNote(n.id, { isPinned: !n.isPinned }); } },
            { type: "divider" as const },
            { label: "Mover a carpeta", icon: Move, action: () => { setShowMoveModal(true); } },
            { type: "divider" as const },
            { label: "Eliminar", icon: Trash2, action: () => { setShowDeleteConfirm(true); }, danger: true },
          ].map((item, i) => {
            if ("type" in item) return <div key={i} style={{ height: 1, background: "var(--border-subtle)", margin: "4px 6px" }} />;
            const Icon = item.icon;
            return (
              <button key={i} onClick={() => { item.action(); setContextMenu(null); }}
                style={{
                  display: "flex", alignItems: "center", gap: 8, width: "100%",
                  padding: "6px 10px", background: "none", border: "none",
                  borderRadius: "var(--radius-sm)",
                  color: (item as any).danger ? "var(--error)" : "var(--text-secondary)",
                  cursor: "pointer", fontSize: 12, fontFamily: "var(--font-primary)",
                  textAlign: "left", transition: "all 150ms " + EASE,
                }}
                className="hover:bg-[var(--bg-hover)]">
                <Icon size={14} /> {item.label}
              </button>
            );
          })}
        </div>
      )}

      {/* ===== MODALS ===== */}
      {showNewFolderModal && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 10001,
          background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <div style={{
            background: "linear-gradient(135deg, var(--bg-elevated) 0%, var(--bg-base) 100%)",
            border: "1px solid var(--border-default)",
            borderRadius: "var(--radius-lg)", padding: 24, minWidth: 320, maxWidth: 420,
            boxShadow: "var(--shadow-elevated)",
          }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", margin: "0 0 12px", fontFamily: "var(--font-heading)" }}>
              Nueva carpeta
            </h3>
            <input type="text" placeholder="Nombre de la carpeta"
              value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newFolderName.trim()) {
                  addNoteFolder({ name: newFolderName.trim(), color: SPINE_COLORS[Math.floor(Math.random() * SPINE_COLORS.length)], isManual: true });
                  setNewFolderName(""); setShowNewFolderModal(false);
                }
              }}
              autoFocus
              className="input-base"
              style={{
                width: "100%", borderRadius: "var(--radius-sm)",
                padding: "8px 12px", boxSizing: "border-box",
              }} />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
              <button onClick={() => { setShowNewFolderModal(false); setNewFolderName(""); }}
                className="btn-secondary"
                style={{
                  background: "none", border: "1px solid var(--border-default)", borderRadius: "var(--radius-sm)",
                  padding: "6px 14px", color: "var(--text-secondary)", fontSize: 12, cursor: "pointer",
                  fontFamily: "var(--font-primary)",
                }}>Cancelar</button>
              <button onClick={() => {
                if (newFolderName.trim()) {
                  addNoteFolder({ name: newFolderName.trim(), color: SPINE_COLORS[Math.floor(Math.random() * SPINE_COLORS.length)], isManual: true });
                  setNewFolderName(""); setShowNewFolderModal(false);
                }
              }}
                className="btn-primary"
                style={{
                  background: "var(--accent)", color: "#fff", border: "none", borderRadius: "var(--radius-sm)",
                  padding: "6px 14px", fontSize: 12, fontWeight: 500, cursor: "pointer",
                  fontFamily: "var(--font-primary)",
                }}>Crear</button>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 10001,
          background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <div style={{
            background: "linear-gradient(135deg, var(--bg-elevated) 0%, var(--bg-base) 100%)",
            border: "1px solid var(--border-default)",
            borderRadius: "var(--radius-lg)", padding: 24, minWidth: 320, maxWidth: 420,
            boxShadow: "var(--shadow-elevated)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <AlertTriangle size={20} style={{ color: "var(--error)", flexShrink: 0 }} />
              <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", margin: 0, fontFamily: "var(--font-heading)" }}>
                Eliminar cuaderno
              </h3>
            </div>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0, lineHeight: 1.5 }}>
              {"\u00bfEst\u00e1s seguro? Esta acci\u00f3n no se puede deshacer."}
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
              <button onClick={() => setShowDeleteConfirm(false)}
                className="btn-secondary"
                style={{
                  background: "none", border: "1px solid var(--border-default)", borderRadius: "var(--radius-sm)",
                  padding: "6px 14px", color: "var(--text-secondary)", fontSize: 12, cursor: "pointer",
                  fontFamily: "var(--font-primary)",
                }}>Cancelar</button>
              <button onClick={handleDeleteNote}
                style={{
                  background: "var(--error)", color: "#fff", border: "none", borderRadius: "var(--radius-sm)",
                  padding: "6px 14px", fontSize: 12, fontWeight: 500, cursor: "pointer",
                  fontFamily: "var(--font-primary)",
                }}>Eliminar</button>
            </div>
          </div>
        </div>
      )}

      {showMoveModal && selectedNote && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 10001,
          background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <div style={{
            background: "linear-gradient(135deg, var(--bg-elevated) 0%, var(--bg-base) 100%)",
            border: "1px solid var(--border-default)",
            borderRadius: "var(--radius-lg)", padding: 24, minWidth: 320, maxWidth: 420,
            boxShadow: "var(--shadow-elevated)",
          }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", margin: "0 0 12px", fontFamily: "var(--font-heading)" }}>
              Mover a carpeta
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 2, maxHeight: 200, overflow: "auto" }}>
              <button onClick={() => { handleMoveToFolder(undefined); }}
                style={{
                  display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "7px 10px",
                  background: !selectedNote.folderId ? "var(--accent-dim)" : "transparent",
                  border: "none", borderRadius: "var(--radius-sm)",
                  color: !selectedNote.folderId ? "var(--accent)" : "var(--text-secondary)",
                  cursor: "pointer", fontSize: 12, fontFamily: "var(--font-primary)", textAlign: "left",
                  transition: "all 150ms " + EASE,
                }}
                className="hover:bg-[var(--bg-hover)]">
                <Layers size={14} /> Sin carpeta
              </button>
              {folders.map((f) => (
                <button key={f.id} onClick={() => { handleMoveToFolder(f.id); }}
                  style={{
                    display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "7px 10px",
                    background: selectedNote.folderId === f.id ? "var(--accent-dim)" : "transparent",
                    border: "none", borderRadius: "var(--radius-sm)",
                    color: selectedNote.folderId === f.id ? "var(--accent)" : "var(--text-secondary)",
                    cursor: "pointer", fontSize: 12, fontFamily: "var(--font-primary)", textAlign: "left",
                    transition: "all 150ms " + EASE,
                  }}
                  className="hover:bg-[var(--bg-hover)]">
                  <FolderIcon size={14} style={{ color: f.color || "var(--text-tertiary)" }} /> {f.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ===== POPUP EDITOR ===== */}
      {showPopupEditor && selectedNote && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 10001,
          background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }} onClick={() => setShowPopupEditor(false)}>
          <div onClick={(e) => e.stopPropagation()}
            style={{
              background: "linear-gradient(135deg, var(--bg-elevated) 0%, var(--bg-base) 100%)",
              border: "1px solid var(--border-default)",
              borderRadius: "var(--radius-lg)", width: "90%", maxWidth: 800,
              maxHeight: "85vh", overflow: "hidden",
              display: "flex", flexDirection: "column",
              boxShadow: "var(--shadow-elevated)",
            }}>
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "10px 16px", borderBottom: "1px solid var(--border-subtle)",
              flexShrink: 0,
            }}>
              <span style={{
                fontSize: 12, fontWeight: 600, color: "var(--text-primary)",
                fontFamily: "var(--font-heading)",
              }}>{selectedNote.title}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <button onClick={() => { handleSaveNote(); toast.success("Guardado"); }}
                  className="btn-primary"
                  style={{
                    background: "var(--accent)", color: "#fff", border: "none",
                    borderRadius: "var(--radius-sm)", padding: "5px 14px",
                    fontSize: 11, fontWeight: 600, cursor: "pointer",
                    fontFamily: "var(--font-primary)",
                  }}>Guardar</button>
                <button onClick={() => setShowPopupEditor(false)}
                  style={{
                    background: "none", border: "none", color: "var(--text-muted)",
                    cursor: "pointer", padding: 4, display: "flex",
                  }}>
                  <X size={16} />
                </button>
              </div>
            </div>
            <div style={{
              flex: 1, overflow: "auto", padding: "16px 20px",
            }}>
              <div
                contentEditable
                suppressContentEditableWarning
                ref={editorRef}
                dangerouslySetInnerHTML={{ __html: editorContent }}
                style={{
                  outline: "none", minHeight: 200,
                  fontSize: 16, lineHeight: 1.8,
                  color: "var(--text-primary)", fontFamily: "var(--font-primary)",
                  caretColor: "var(--accent)",
                  maxWidth: 720, margin: "0 auto",
                }}
                onKeyDown={(e) => {
                  if ((e.ctrlKey || e.metaKey) && e.key === "s") {
                    e.preventDefault(); handleSaveNote();
                  }
                }}
                onInput={handleEditorInput}
              />
            </div>
            <div style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "6px 16px", borderTop: "1px solid var(--border-subtle)",
              fontSize: 10, color: "var(--text-muted)", flexShrink: 0,
            }}>
              <span>{getWordCount(selectedNote.content)} palabras</span>
              <span>{getCharCount(selectedNote.content)} caracteres</span>
              <span>{getReadTime(selectedNote.content)} min lectura</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}