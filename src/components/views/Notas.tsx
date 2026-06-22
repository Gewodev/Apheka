import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Search, Plus, Folder as FolderIcon, Pin, Trash2, FileText, Download, X, Copy, Move,
  AlertTriangle, Check, Bold, Italic, Underline, List, Code, Link, Paperclip,
  Image as ImageIcon, Type,   BookOpen, Library, Star, PenTool,
  Info, Clock, AlignJustify,
  ChevronDown, ChevronRight, MoreHorizontal,
  ListOrdered, Quote, Upload, Lock,
  History, Table, File,
  Layers, Edit3, FileOutput,
  Filter, SortAsc, Tag, Hash, Maximize2, Minimize2, CheckSquare, Palette, ArrowLeft, Unlink,
  Briefcase, GraduationCap, Compass, Target, Brain, Award, Coffee, Activity, Shield,
  Heart, Lightbulb, Zap, Globe, Feather, Sun, Moon, CloudRain, Mountain, Music,
  Camera, Eye, Flag, Gift, Anchor, Key, Rocket, Scissors, Watch, Wifi, StickyNote
} from "lucide-react";
import { useApp, Note, NoteFolder, NoteAttachment } from "../../store/AppContext";
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { format } from "date-fns";
import { es } from "date-fns/locale";
import toast from "react-hot-toast";
import NotificationBell from '../ui/NotificationBell';

type ViewMode = "estante" | "lista";
type SortMode = "updated" | "created" | "title" | "course" | "visits" | "priority";

const EASE = "cubic-bezier(0.16, 1, 0.3, 1)";
const SPINE_COLORS = [
  "#E11D48", "#3B82F6", "#10B981", "#F59E0B", "#8B5CF6",
  "#EC4899", "#06B6D4", "#84CC16", "#F97316", "#6366F1",
  "#14B8A6", "#D946EF", "#0EA5E9", "#22C55E", "#EAB308",
];

const AVAILABLE_ICONS = [
  { name: "FileText", icon: FileText, label: "Nota" },
  { name: "BookOpen", icon: BookOpen, label: "Libro" },
  { name: "Code", icon: Code, label: "Código" },
  { name: "Folder", icon: FolderIcon, label: "Carpeta" },
  { name: "Brain", icon: Brain, label: "Idea" },
  { name: "Target", icon: Target, label: "Objetivo" },
  { name: "Coffee", icon: Coffee, label: "Estudio" },
  { name: "Compass", icon: Compass, label: "Explorar" },
  { name: "Award", icon: Award, label: "Logro" },
  { name: "Briefcase", icon: Briefcase, label: "Proyecto" },
  { name: "GraduationCap", icon: GraduationCap, label: "Clase" },
  { name: "Shield", icon: Shield, label: "Importante" },
  { name: "Heart", icon: Heart, label: "Corazón" },
  { name: "Lightbulb", icon: Lightbulb, label: "Idea" },
  { name: "Zap", icon: Zap, label: "Energía" },
  { name: "Globe", icon: Globe, label: "Mundo" },
  { name: "Feather", icon: Feather, label: "Pluma" },
  { name: "Sun", icon: Sun, label: "Sol" },
  { name: "Moon", icon: Moon, label: "Luna" },
  { name: "CloudRain", icon: CloudRain, label: "Lluvia" },
  { name: "Mountain", icon: Mountain, label: "Montaña" },
  { name: "Music", icon: Music, label: "Música" },
  { name: "Camera", icon: Camera, label: "Cámara" },
  { name: "Eye", icon: Eye, label: "Ojo" },
  { name: "Flag", icon: Flag, label: "Bandera" },
  { name: "Gift", icon: Gift, label: "Regalo" },
  { name: "Anchor", icon: Anchor, label: "Ancla" },
  { name: "Key", icon: Key, label: "Llave" },
  { name: "Rocket", icon: Rocket, label: "Cohete" },
  { name: "Scissors", icon: Scissors, label: "Tijeras" },
  { name: "Watch", icon: Watch, label: "Reloj" },
  { name: "Wifi", icon: Wifi, label: "Wifi" },
  { name: "Activity", icon: Activity, label: "Actividad" },
  { name: "Lock", icon: Lock, label: "Candado" },
  { name: "Star", icon: Star, label: "Estrella" },
  { name: "Hash", icon: Hash, label: "Hashtag" },
  { name: "CheckSquare", icon: CheckSquare, label: "Check" },
  { name: "Clock", icon: Clock, label: "Reloj" },
  { name: "File", icon: File, label: "Archivo" },
  { name: "Layers", icon: Layers, label: "Capas" },
  { name: "Pin", icon: Pin, label: "Pin" },
];

const DEFAULT_TAG_COLORS: Record<string, string> = {
  Importante: "#E11D48", Examen: "#F59E0B", Resumen: "#10B981",
  Investigación: "#8B5CF6", Tareas: "#3B82F6", Proyecto: "#EC4899",
  Personal: "#06B6D4"
};

function getSpineColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = ((hash << 5) - hash) + id.charCodeAt(i);
  return SPINE_COLORS[Math.abs(hash) % SPINE_COLORS.length];
}

function safeFormat(date: string | undefined | null, fmt: string): string {
  if (!date) return '—';
  try { return format(new Date(date), fmt, { locale: es }); } catch { return '—'; }
}

function formatTimeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Ahora";
  if (mins < 60) return "Hace " + mins + " min";
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return "Hace " + hrs + "h";
  const days = Math.floor(hrs / 24);
  if (days < 7) return "Hace " + days + " días";
  return safeFormat(date, "d MMM");
}

function formatDeletionTime(date: string): string {
  const deletedAt = new Date(date).getTime();
  const diff = deletedAt + 7 * 24 * 60 * 60 * 1000 - Date.now();
  if (diff <= 0) return "Se eliminará hoy";
  const days = Math.ceil(diff / (24 * 60 * 60 * 1000));
  if (days === 1) return "Se eliminará mañana";
  if (days < 7) return "Se eliminará en " + days + " días";
  return "Se eliminará en 1 semana";
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

function formatMathContent(html: string): string {
  if (!html) return "";
  let formatted = html;
  // Format math formulas enclosed in $$
  formatted = formatted.replace(/\$\$(.*?)\$\$/g, (_, formula) => {
    return `<div class="math-formula-box" style="background: var(--bg-deep); border: 1px solid var(--border-default); padding: 12px 14px; border-radius: 8px; text-align: center; font-family: monospace; font-size: 15px; margin: 12px 0; color: var(--accent); box-shadow: inset 0 1px 3px rgba(0,0,0,0.3);"><span style="font-weight: 600; letter-spacing: 0.02em;">${formula}</span></div>`;
  });
  // Format math formulas enclosed in $
  formatted = formatted.replace(/\$(.*?)\$/g, (_, formula) => {
    return `<span style="font-family: monospace; color: var(--accent); background: var(--bg-hover); padding: 1px 4px; border-radius: 4px; font-size: 13px;">${formula}</span>`;
  });
  return formatted;
}

/* Helper to render custom note icons dynamically */
function NoteIconRenderer({ iconName, color, size = 16 }: { iconName?: string; color: string; size?: number }) {
  const IconComponent = useMemo(() => {
    const item = AVAILABLE_ICONS.find(i => i.name === iconName);
    return item ? item.icon : FileText;
  }, [iconName]);

  return <IconComponent size={size} style={{ color }} />;
}

/* ====== COMPACT BLOCK NOTE CARD (lista view - 2 Columns) ====== */
interface NoteCardProps {
  note: Note;
  isSelected: boolean;
  onSelect: () => void;
  onOpen: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  tagColors: Record<string, string>;
}

function NoteCard({ note, isSelected, onSelect, onOpen, onContextMenu, onDragStart, onDragOver, onDrop, tagColors }: NoteCardProps) {
  const spineColor = note.coverColor || note.courseColor || getSpineColor(note.id);
  const preview = useMemo(() => {
    const text = note.content.replace(/<[^>]+>/g, "").trim();
    return text || "Sin contenido adicional en este cuaderno.";
  }, [note.content]);
  const [hov, setHov] = useState(false);

  return (
    <div style={{ position: "relative", height: "100%" }}>
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
          display: "flex", flexDirection: "column", gap: 4,
          padding: "12px", cursor: "pointer", height: "100%",
          background: isSelected
            ? "linear-gradient(135deg, " + spineColor + "06, " + spineColor + "01)"
            : "linear-gradient(135deg, rgba(255,255,255,0.02) 0%, rgba(0,0,0,0.03) 100%)",
          border: "1px solid " + (isSelected ? spineColor + "55" : "var(--border-subtle)"),
          borderRadius: "var(--radius-xl)",
          transition: "all 250ms " + EASE,
          transform: hov && !isSelected ? "translateY(-2px)" : "none",
          boxShadow: isSelected
            ? "0 4px 16px " + spineColor + "22"
            : hov ? "0 6px 18px rgba(0,0,0,0.18)" : "var(--shadow-sm)",
          position: "relative", overflow: "hidden",
        }}
      >
        {/* Top row: icon + title + date + menu */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
          <div style={{
            width: 36, height: 36, borderRadius: "var(--radius-md)", flexShrink: 0,
            background: "linear-gradient(135deg, " + spineColor + "15, " + spineColor + "05)",
            display: "flex", alignItems: "center", justifyContent: "center",
            border: "1px solid " + spineColor + "20",
            boxShadow: "0 2px 8px " + spineColor + "15",
          }}>
            <NoteIconRenderer iconName={note.coverImage} color={spineColor} size={16} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{
                fontSize: 13, fontWeight: 600, color: "var(--text-primary)",
                fontFamily: "var(--font-heading)",
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              }}>{note.title || "Sin título"}</span>
              {note.isPinned && <Star size={10} fill="#F59E0B" style={{ color: "#F59E0B", flexShrink: 0 }} />}
            </div>
            <div style={{ fontSize: 9.5, color: "var(--text-tertiary)", marginTop: 1 }}>
              {formatTimeAgo(note.updatedAt)}
            </div>
          </div>
          <button onClick={(e) => { e.stopPropagation(); onContextMenu(e); }}
            style={{
              background: "var(--bg-surface)", border: "1px solid var(--border-default)",
              cursor: "pointer", color: "var(--text-tertiary)",
              padding: 2, display: "flex", borderRadius: 6, flexShrink: 0, alignSelf: "flex-start",
            }}
            className="hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
            title="Más opciones">
            <MoreHorizontal size={11} />
          </button>
        </div>

        {/* Preview text — fixed height, never expands card */}
        <div style={{
          fontSize: 11, color: "var(--text-secondary)", lineHeight: 1.4,
          display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
          overflow: "hidden", opacity: 0.8,
          maxHeight: "3em", minHeight: "3em", flexShrink: 0,
        }}>{preview}</div>
        
        {/* Tags row */}
        <div style={{ display: "flex", alignItems: "center", gap: 3, flexWrap: "wrap", marginTop: "auto" }}>
          {note.tags && note.tags.slice(0, 3).map((t) => {
            const tc = tagColors[t] || DEFAULT_TAG_COLORS[t] || spineColor;
            return (
              <span key={t} style={{
                fontSize: 8, fontWeight: 600, color: tc,
                border: "1px solid " + tc + "30", background: tc + "0a",
                padding: "0px 5px", borderRadius: 3, lineHeight: "16px",
              }}>{t}</span>
            );
          })}
          {note.tags && note.tags.length > 3 && (
            <span style={{
              fontSize: 8, fontWeight: 600, color: "var(--text-tertiary)",
              padding: "0px 4px",
            }}>+{note.tags.length - 3}</span>
          )}
        </div>
      </div>
    </div>
  );
}

/* ====== BOOKSHELF BOOK (estante view) ====== */
interface BookshelfBookProps {
  note: Note;
  isSelected: boolean;
  folders: NoteFolder[];
  onSelect: () => void;
  onDoubleClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
}

function BookshelfBook({ note, isSelected, folders, onSelect, onDoubleClick, onContextMenu, onDragStart, onDragOver, onDrop }: BookshelfBookProps) {
  const folderData = useMemo(() => folders.find(f => f.id === note.folderId), [folders, note.folderId]);
  const spineColor = note.coverColor || folderData?.color || note.courseColor || getSpineColor(note.id);
  const tagColor = (note.tags && note.tags.length > 0)
    ? (localStorage.getItem("owa_custom_tag_colors")
      ? (JSON.parse(localStorage.getItem("owa_custom_tag_colors") || "{}")[note.tags[0]] || DEFAULT_TAG_COLORS[note.tags[0]] || spineColor)
      : (DEFAULT_TAG_COLORS[note.tags[0]] || spineColor))
    : null;
  const [hov, setHov] = useState(false);
  
  const previewText = useMemo(() => {
    const text = note.content.replace(/<[^>]+>/g, "").trim();
    return text.slice(0, 60) || "Sin contenido adicional.";
  }, [note.content]);

  const darkerSpine = useMemo(() => {
    let r = parseInt(spineColor.slice(1,3), 16);
    let g = parseInt(spineColor.slice(3,5), 16);
    let b = parseInt(spineColor.slice(5,7), 16);
    r = Math.max(0, r - 30); g = Math.max(0, g - 30); b = Math.max(0, b - 30);
    return "#" + [r,g,b].map(c => c.toString(16).padStart(2,"0")).join("");
  }, [spineColor]);

  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      position: "relative", cursor: "pointer",
      transform: hov ? "translateY(-5px)" : "translateY(0)",
      transition: "transform 250ms " + EASE,
      width: 158,
      marginBottom: 0,
      zIndex: hov ? 10 : 3,
    }}
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onClick={onSelect}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
    >
        {/* 3D Book Cover Container — plain rectangle, no V-notch */}
      <div style={{
        width: 150, height: 218,
        position: "relative", zIndex: 5,
        borderRadius: "2px 8px 8px 2px",
        background: `linear-gradient(145deg, ${spineColor}08 0%, rgba(255,255,255,0.02) 100%)`,
        boxShadow: isSelected
          ? `0 8px 20px rgba(0,0,0,0.35), 0 0 0 1.5px var(--accent)`
          : hov
            ? `0 10px 24px rgba(0,0,0,0.4)`
            : `0 4px 10px rgba(0,0,0,0.20)`,
        border: "1px solid rgba(255,255,255,0.04)",
        transition: "box-shadow 250ms " + EASE,
        overflow: "hidden",
        display: "flex", flexDirection: "column",
        justifyContent: "space-between",
      }}>
        {/* Spine (left colored vertical highlight) = folder color */}
        <div style={{
          position: "absolute", left: 0, top: 0, bottom: 0, width: 14,
          background: `linear-gradient(90deg, ${spineColor} 0%, ${darkerSpine} 80%, rgba(0,0,0,0.3) 100%)`,
          borderRadius: "2px 0 0 2px",
        }} />
        <div style={{
          position: "absolute", left: 14, top: 0, bottom: 0, width: 1,
          background: "rgba(255,255,255,0.05)",
        }} />

        {/* Pin marker top-right */}
        {note.isPinned && (
          <div style={{ position: "absolute", right: 6, top: 6, zIndex: 8 }}>
            <Star size={10} fill="#F59E0B" style={{ color: "#F59E0B" }} />
          </div>
        )}

        {/* Large diffused icon in bottom-right — tilted, faded, blurred */}
        <div style={{
          position: "absolute", right: -8, bottom: -6, zIndex: 1,
          opacity: 0.12, pointerEvents: "none",
          transform: "rotate(-8deg) scale(1.15)",
          filter: "blur(0.8px)",
        }}>
          <NoteIconRenderer iconName={note.coverImage} color={spineColor} size={100} />
        </div>
        <div style={{
          position: "absolute", right: -6, bottom: -2, zIndex: 2,
          width: 130, height: 130,
          background: `radial-gradient(circle at 75% 75%, ${spineColor}14 0%, transparent 70%)`,
          pointerEvents: "none",
        }} />

        {/* Main Cover content */}
        <div style={{
          padding: "20px 14px 16px 26px",
          display: "flex", flexDirection: "column",
          flex: 1, justifyContent: "space-between",
          position: "relative", zIndex: 5,
        }}>
          {/* Title — NO icon, just 3-dot menu top-right */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div style={{
              fontSize: 12.5,
              fontWeight: 700, color: "var(--text-primary)",
              fontFamily: "var(--font-heading)", lineHeight: 1.3,
              display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
              overflow: "hidden", flex: 1, marginRight: 4,
            }}>{note.title || "Sin título"}</div>
            <button onClick={(e) => { e.stopPropagation(); onContextMenu(e); }}
              style={{
                background: "none", border: "none", cursor: "pointer",
                color: "var(--text-tertiary)", padding: 2, display: "flex",
                borderRadius: 4, opacity: hov ? 1 : 0.4, flexShrink: 0,
                transition: "opacity 150ms " + EASE,
              }}
              className="hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
              title="Más opciones">
              <MoreHorizontal size={12} />
            </button>
          </div>
            
            {/* Brief cover text preview */}
            <div style={{
              fontSize: 9, color: "var(--text-secondary)", lineHeight: 1.35,
              opacity: 0.6, display: "-webkit-box", WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical", overflow: "hidden", marginTop: 1,
            }}>
              {previewText}
            </div>

          {/* Footer — folder name + time (compact) */}
          <div style={{ display: "flex", flexDirection: "column", gap: 1, marginTop: "auto", paddingTop: 6 }}>
            {folderData && (
              <span style={{
                fontSize: 10, fontWeight: 700, color: folderData.color || spineColor,
                letterSpacing: "0.02em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              }}>{folderData.name}</span>
            )}
            <span style={{
              fontSize: 8, color: "var(--text-tertiary)",
              fontWeight: 500,
            }}>{formatTimeAgo(note.updatedAt)}</span>
          </div>
          {/* (no bottom tag bar — tags shown as ribbons at top) */}
        </div>
      </div>

      {/* No cast shadow — shelf plank handles it */}
    </div>
  );
}

/* ====== FLOATING ICON & COLOR SELECTOR PICKER ====== */
interface IconPickerProps {
  currentIcon?: string;
  currentColor?: string;
  onSelect: (iconName: string, colorHex: string) => void;
  onClose: () => void;
}

function IconPicker({ currentIcon, currentColor, onSelect, onClose }: IconPickerProps) {
  const [selectedIcon, setSelectedIcon] = useState(currentIcon || "FileText");
  const [selectedColor, setSelectedColor] = useState(currentColor || "#E11D48");
  const [showColors, setShowColors] = useState(!!currentIcon);

  const IconForName = useCallback((name: string) => {
    const found = AVAILABLE_ICONS.find(i => i.name === name);
    return found ? found.icon : FileText;
  }, []);

  const handleIconClick = useCallback((iconName: string) => {
    setSelectedIcon(iconName);
    setShowColors(true);
    onSelect(iconName, selectedColor);
  }, [selectedColor, onSelect]);

  const handleColorClick = useCallback((color: string) => {
    setSelectedColor(color);
    onSelect(selectedIcon, color);
  }, [selectedIcon, onSelect]);

  return (
    <div style={{
      width: 340,
      background: "var(--bg-elevated)", border: "1px solid var(--border-strong)",
      borderRadius: "var(--radius-lg)", padding: 12,
      boxShadow: "var(--shadow-elevated), 0 10px 30px rgba(0,0,0,0.5)",
      display: "flex", flexDirection: "column", gap: 8,
      animation: "fadeInDown 200ms ease-out",
    }} onClick={e => e.stopPropagation()}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 9.5, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase" }}>Personalizar Icono</span>
        <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-tertiary)", cursor: "pointer", padding: 2 }}><X size={12} /></button>
      </div>

      {/* Selected preview */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10, padding: "6px 8px",
        borderRadius: 8, border: "1px solid var(--border-default)", background: "var(--bg-base)",
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: 8,
          background: selectedColor + "18", display: "flex", alignItems: "center", justifyContent: "center",
          border: "1px solid " + selectedColor + "30",
        }}>
          {(() => {
            const I = IconForName(selectedIcon);
            return <I size={18} style={{ color: selectedColor }} />;
          })()}
        </div>
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", flex: 1 }}>
          {AVAILABLE_ICONS.find(i => i.name === selectedIcon)?.label || selectedIcon}
        </span>
        <div style={{ width: 16, height: 16, borderRadius: "50%", background: selectedColor, flexShrink: 0 }} />
      </div>

      {/* Icons + Colors side by side */}
      <div style={{ display: "flex", gap: 6, minHeight: 0 }}>
        {/* Icons Grid — left side */}
        <div style={{
          overflowY: "auto", flex: showColors ? 1 : 1,
          display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 4,
          borderTop: "1px solid var(--border-default)", paddingTop: 6,
          maxHeight: 164,
        }}>
          {AVAILABLE_ICONS.map(i => {
            const Icon = i.icon;
            const isSel = selectedIcon === i.name;
            return (
              <button key={i.name} onClick={() => { handleIconClick(i.name); }}
                title={i.label}
                style={{
                  height: 30, borderRadius: 6, border: "1px solid " + (isSel ? selectedColor : "var(--border-default)"),
                  background: isSel ? selectedColor + "16" : "transparent",
                  color: isSel ? selectedColor : "var(--text-secondary)", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "all 120ms",
                  width: "100%",
                }}
                className="hover:bg-[var(--bg-hover)]">
                <Icon size={14} />
              </button>
            );
          })}
        </div>
        {/* Colors — right side, appears when icon is selected */}
        {showColors && (
          <div style={{
            width: 120, flexShrink: 0, overflowY: "auto",
            display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 4,
            borderTop: "1px solid var(--border-default)", paddingTop: 6,
            maxHeight: 164, alignContent: "start",
          }}>
            {SPINE_COLORS.map(c => (
              <button key={c} onClick={() => { handleColorClick(c); }}
                title={c}
                style={{
                  height: 30, borderRadius: 6,
                  background: selectedColor === c ? c : c + "20",
                  border: selectedColor === c ? "2px solid " + c : "1px solid " + c + "30",
                  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "all 120ms",
                  transform: selectedColor === c ? "scale(1.1)" : "none",
                }}>
                {(() => {
                  const CI = IconForName(selectedIcon);
                  return <CI size={13} style={{ color: selectedColor === c ? "#fff" : c }} />;
                })()}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ====== NEW FOLDER CREATION MODAL ====== */
interface NewFolderModalProps {
  onClose: () => void;
  onCreate: (name: string, color: string) => void;
}

function NewFolderModal({ onClose, onCreate }: NewFolderModalProps) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(SPINE_COLORS[0]);

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 10001,
      background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div style={{
        background: "linear-gradient(135deg, var(--bg-surface) 0%, var(--bg-base) 100%)",
        border: "1px solid var(--border-default)",
        borderRadius: "var(--radius-lg)", padding: 24, minWidth: 320, maxWidth: 400,
        boxShadow: "var(--shadow-elevated)", display: "flex", flexDirection: "column", gap: 14,
      }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", margin: 0, fontFamily: "var(--font-heading)" }}>
          Nueva carpeta
        </h3>
        
        <input type="text" placeholder="Nombre de la carpeta"
          value={name} onChange={(e) => setName(e.target.value)}
          autoFocus
          className="input-base"
          style={{ width: "100%", borderRadius: 6, padding: "8px 12px", boxSizing: "border-box" }} />
        
        <div>
          <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase" }}>Color de Carpeta</span>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 6, marginTop: 8 }}>
            {SPINE_COLORS.map(c => (
              <button key={c} onClick={() => setColor(c)}
                style={{
                  width: 22, height: 22, borderRadius: "50%", background: c, border: color === c ? "2px solid #fff" : "none",
                  cursor: "pointer", transform: color === c ? "scale(1.1)" : "none",
                }} />
            ))}
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
          <button onClick={onClose}
            className="btn-secondary"
            style={{
              background: "none", border: "1px solid var(--border-default)", borderRadius: 6,
              padding: "6px 14px", color: "var(--text-secondary)", fontSize: 12, cursor: "pointer",
            }}>Cancelar</button>
          <button onClick={() => { if (name.trim()) onCreate(name.trim(), color); }}
            className="btn-primary"
            style={{
              background: color, color: "#fff", border: "none", borderRadius: 6,
              padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer",
              boxShadow: "0 2px 6px " + color + "33",
            }}>Crear</button>
        </div>
      </div>
    </div>
  );
}

/* ====== NEW TAG CREATION MODAL ====== */
interface NewTagModalProps {
  onClose: () => void;
  onCreate: (name: string, color: string) => void;
}

function NewTagModal({ onClose, onCreate }: NewTagModalProps) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(SPINE_COLORS[0]);

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 10001,
      background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div style={{
        background: "linear-gradient(135deg, var(--bg-surface) 0%, var(--bg-base) 100%)",
        border: "1px solid var(--border-default)",
        borderRadius: "var(--radius-lg)", padding: 24, minWidth: 320, maxWidth: 400,
        boxShadow: "var(--shadow-elevated)", display: "flex", flexDirection: "column", gap: 14,
      }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", margin: 0, fontFamily: "var(--font-heading)" }}>
          Nueva etiqueta (Hashtag)
        </h3>
        
        <input type="text" placeholder="Nombre de la etiqueta"
          value={name} onChange={(e) => setName(e.target.value)}
          autoFocus
          className="input-base"
          style={{ width: "100%", borderRadius: 6, padding: "8px 12px", boxSizing: "border-box" }} />
        
        <div>
          <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase" }}>Color del hashtag</span>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 6, marginTop: 8 }}>
            {SPINE_COLORS.map(c => (
              <button key={c} onClick={() => setColor(c)}
                style={{
                  width: 22, height: 22, borderRadius: "50%", background: c, border: color === c ? "2px solid #fff" : "none",
                  cursor: "pointer", transform: color === c ? "scale(1.1)" : "none",
                }} />
            ))}
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
          <button onClick={onClose}
            className="btn-secondary"
            style={{
              background: "none", border: "1px solid var(--border-default)", borderRadius: 6,
              padding: "6px 14px", color: "var(--text-secondary)", fontSize: 12, cursor: "pointer",
            }}>Cancelar</button>
          <button onClick={() => { if (name.trim()) onCreate(name.trim(), color); }}
            className="btn-primary"
            style={{
              background: color, color: "#fff", border: "none", borderRadius: 6,
              padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer",
              boxShadow: "0 2px 6px " + color + "33",
            }}>Crear</button>
        </div>
      </div>
    </div>
  );
}

/* ====== EDITOR FORMATTING TOOLBAR ====== */
interface EditorToolbarProps {
  onFormat: (cmd: string, value?: string) => void;
}

function EditorToolbar({ onFormat }: EditorToolbarProps) {
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const linkInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showLinkInput) linkInputRef.current?.focus();
  }, [showLinkInput]);

  const items = [
    { cmd: "bold", icon: Bold, label: "Negrita" },
    { cmd: "italic", icon: Italic, label: "Cursiva" },
    { cmd: "underline", icon: Underline, label: "Subrayado" },
    { type: "divider" as const },
    { cmd: "insertUnorderedList", icon: List, label: "Lista viñetas" },
    { cmd: "insertOrderedList", icon: ListOrdered, label: "Lista numerada" },
    { cmd: "insertCheckbox", icon: CheckSquare, label: "Checklist" },
    { type: "divider" as const },
    { cmd: "codeBlock", icon: Code, label: "Bloque código" },
    { cmd: "styledQuote", icon: Quote, label: "Cita elaborada" },
    { cmd: "insertTable", icon: Table, label: "Insertar tabla" },
    { type: "divider" as const },
    { cmd: "link", icon: Link, label: "Enlace" },
    { cmd: "insertFile", icon: Paperclip, label: "Adjuntar archivo" },
    { cmd: "removeLink", icon: Unlink, label: "Quitar enlace" },
  ];

  const handleCheckbox = useCallback(() => {
    const html = `<div class="notes-checkbox" style="display:flex;align-items:center;gap:8px;margin:4px 0;"><input type="checkbox" style="width:16px;height:16px;cursor:pointer;accent-color:var(--accent);" /> <span>Lista de tareas</span></div>`;
    onFormat("insertHTML", html);
  }, [onFormat]);

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap", position: "relative",
    }}>
      {items.map((item, i) => {
        if ("type" in item) return <div key={i} style={{ width: 1, height: 16, background: "var(--border-default)", margin: "0 4px" }} />;
        const Icon = item.icon;
        return (
          <button key={i} onClick={() => {
            if (item.cmd === "link") { setShowLinkInput(true); setLinkUrl(""); return; }
            if (item.cmd === "insertCheckbox") { handleCheckbox(); return; }
            if (item.cmd === "insertFile") { onFormat("insertFile"); return; }
            onFormat(item.cmd, (item as any).value);
          }}
            title={item.label}
            style={{
              width: 28, height: 28, borderRadius: 6, border: "none",
              background: "transparent", color: "var(--text-secondary)",
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              transition: "all 150ms",
            }}
            className="hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]">
            <Icon size={14} />
          </button>
        );
      })}

      {showLinkInput && (
        <div style={{
          position: "absolute", top: "100%", left: 0, marginTop: 6, zIndex: 300,
          display: "flex", gap: 6, alignItems: "center",
          background: "var(--bg-elevated)", border: "1px solid var(--border-strong)",
          borderRadius: "var(--radius-md)", padding: "8px 10px",
          boxShadow: "var(--shadow-elevated)", animation: "fadeIn 150ms ease-out",
        }}>
          <input ref={linkInputRef}
            type="url" placeholder="https://..."
            value={linkUrl} onChange={e => setLinkUrl(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && linkUrl) { onFormat("createLink", linkUrl); setShowLinkInput(false); } }}
            style={{
              width: 200, padding: "6px 10px", fontSize: 12, borderRadius: 6,
              border: "1px solid var(--border-default)", background: "var(--bg-base)",
              color: "var(--text-primary)", outline: "none",
            }} />
          <button onClick={() => { if (linkUrl) { onFormat("createLink", linkUrl); setShowLinkInput(false); } }}
            style={{
              background: "var(--accent)", color: "#fff", border: "none",
              borderRadius: 6, padding: "6px 12px", fontSize: 11, fontWeight: 600, cursor: "pointer",
            }}>Insertar</button>
          <button onClick={() => setShowLinkInput(false)}
            style={{ background: "none", border: "none", color: "var(--text-tertiary)", cursor: "pointer", padding: 4 }}>
            <X size={12} />
          </button>
        </div>
      )}
    </div>
  );
}

/* ====== SHELF PLANK DECORATIVE ELEMENT ====== */
function ShelfPlank() {
  return (
    <div style={{
      width: "100%", height: 16, position: "relative",
      display: "flex", alignItems: "center",
    }}>
      <div style={{
        flex: 1, height: 10,
        background: "linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(0,0,0,0.25) 40%, rgba(0,0,0,0.35) 100%)",
        borderRadius: 3,
        borderBottom: "1px solid rgba(255,255,255,0.03)",
        borderTop: "1px solid rgba(255,255,255,0.04)",
        boxShadow: "0 6px 12px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.04)",
      }} />
      <div style={{
        position: "absolute", bottom: -6, left: "5%", right: "5%",
        height: 8, background: "radial-gradient(ellipse at center, rgba(0,0,0,0.25) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />
    </div>
  );
}

export default function Notas() {
  const { notes, noteFolders: folders, addNote, updateNote, deleteNote, restoreNote, permanentlyDeleteNote, addNoteFolder, duplicateNote, reorderNotes, floatingNoteId, setFloatingNoteId } = useApp();

  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("estante");
  const [sortMode, setSortMode] = useState<SortMode>("updated");
  const [searchQuery, setSearchQuery] = useState("");
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; noteId: string } | null>(null);
  
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [showNewTagModal, setShowNewTagModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [switchTargetId, setSwitchTargetId] = useState<string | null>(null);
  const [drawerTab, setDrawerTab] = useState<"contenido" | "informacion" | "historial">("contenido");

  // EDIT STATE
  const [isEditing, setIsEditing] = useState(false);
  const [showDetailsPanel, setShowDetailsPanel] = useState(true);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "pending">("saved");

  useEffect(() => {
    const mql = window.matchMedia('(max-width: 800px)');
    const handler = (e: MediaQueryListEvent | MediaQueryList) => {
      if (e.matches) setShowDetailsPanel(false);
    };
    mql.addEventListener('change', handler);
    handler(mql);
    return () => mql.removeEventListener('change', handler);
  }, []);

  // Expanded View Drawer state
  const [isMaximized, setIsMaximized] = useState(false);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [iconPickerTarget, setIconPickerTarget] = useState<string | null>(null);

  // Library views navigation
  const [activeSidebarTab, setActiveSidebarTab] = useState("all");

  const [bookshelfPage, setBookshelfPage] = useState(0);
  const [bookshelfDir, setBookshelfDir] = useState<1 | -1>(1);

  // Custom Tag colors map (persisted)
  const [customTagColors, setCustomTagColors] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem("owa_custom_tag_colors");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const mergedTagColors = useMemo(() => {
    return { ...DEFAULT_TAG_COLORS, ...customTagColors };
  }, [customTagColors]);

  // Clock time state (Compact aligned inside header)
  const [ct, setCt] = useState(new Date());

  const editorRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragIndexRef = useRef<number | null>(null);

  // Real-time clock tick
  useEffect(() => {
    const interval = setInterval(() => setCt(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const timeStr = format(ct, "HH:mm");
  const secondsStr = format(ct, 'ss');
  const dateStr = useMemo(() => {
    try {
      const d = format(ct, "EEEE, d 'de' MMMM", { locale: es });
      return d.charAt(0).toUpperCase() + d.slice(1);
    } catch { return ""; }
  }, [ct]);

  const selectedNote = useMemo(
    () => notes.find((n) => n.id === selectedNoteId) || null,
    [notes, selectedNoteId],
  );

  const currentFolder = useMemo(
    () => folders.find((f) => f.id === selectedFolderId),
    [folders, selectedFolderId],
  );

  // Filter notes by query, folder, tags, views
  const filteredNotes = useMemo(() => {
    let result = [...notes];
    
    // Sidebar view filters
    if (activeSidebarTab === "favs") {
      result = result.filter(n => !n.deletedAt && n.isPinned);
    } else if (activeSidebarTab === "recents") {
      const cutoff = Date.now() - 3 * 24 * 60 * 60 * 1000;
      result = result.filter(n => !n.deletedAt && new Date(n.updatedAt).getTime() > cutoff);
    } else if (activeSidebarTab === "trash") {
      result = result.filter(n => n.deletedAt);
    } else {
      result = result.filter(n => !n.deletedAt);
    }

    if (selectedFolderId && !activeSidebarTab.startsWith("tag_")) {
      result = result.filter((n) => n.folderId === selectedFolderId);
    }
    if (selectedTag) {
      result = result.filter((n) => n.tags?.includes(selectedTag));
    }

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
        return ((order[a.priority || "none"] || 3) - (order[b.priority || "none"] || 3));
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
  }, [notes, selectedFolderId, selectedTag, searchQuery, sortMode, activeSidebarTab]);

  const handleCreateNote = useCallback(() => {
    const id = addNote({
      title: "Nuevo cuaderno", content: "Comienza a escribir tus notas aquí...", subtitle: "",
      folderId: selectedFolderId || undefined,
      courseColor: currentFolder?.color || "#8B5CF6",
      isPinned: false, course: currentFolder?.name || "Sin curso", tags: [],
    });
    setSelectedNoteId(id);
    setDrawerTab("contenido");
    setIsEditing(true);
  }, [addNote, selectedFolderId, currentFolder]);

  // contentEditable caret jumping fix: populate DOM only ONCE when note changes
  useEffect(() => {
    if (isEditing && selectedNote && editorRef.current) {
      if (editorRef.current.innerHTML !== selectedNote.content) {
        editorRef.current.innerHTML = selectedNote.content || "";
      }
    }
  }, [selectedNoteId, isEditing]);

  const handleSaveNote = useCallback(() => {
    if (!selectedNote) return;
    let content = selectedNote.content;
    let title = selectedNote.title;
    
    if (editorRef.current) {
      content = editorRef.current.innerHTML;
    }
    if (titleRef.current) {
      title = titleRef.current.value || "Sin título";
    }

    updateNote(selectedNote.id, { content, title, subtitle: content.replace(/<[^>]+>/g, "").slice(0, 150) });
    setSaveStatus("saved");
  }, [selectedNote, updateNote]);

  const handleSelectNote = useCallback((noteId: string) => {
    setSelectedNoteId(noteId);
  }, []);

  const openFloatingNote = useCallback(async (note: Note) => {
    const ch = new BroadcastChannel('owa_notes_sync');
    ch.postMessage({
      type: 'OPEN_NOTE',
      noteId: note.id,
      note: { id: note.id, title: note.title || '', content: note.content || '', coverColor: note.coverColor, coverImage: note.coverImage },
    });
    ch.close();
    try {
      const existing = await WebviewWindow.getByLabel('floating-note-window');
      if (existing) { await existing.show(); await existing.setFocus(); return; }
      new WebviewWindow('floating-note-window', {
        url: '/',
        title: note.title || 'Nota flotante',
        width: 440, height: 520,
        resizable: true,
        decorations: true,
        alwaysOnTop: true,
        skipTaskbar: true,
      });
    } catch {
      // Fallback for web mode: use in-app floating note
      setFloatingNoteId(note.id);
    }
  }, [setFloatingNoteId]);

  const handleOpenNote = useCallback(() => {
    if (selectedNote) {
      setIsEditing(true);
    }
  }, [selectedNote]);

  const handleDeleteNote = useCallback(() => {
    if (!selectedNoteId && !contextMenu) return;
    const id = contextMenu ? contextMenu.noteId : selectedNoteId!;
    deleteNote(id);
    if (selectedNoteId === id) {
      setSelectedNoteId(null);
      setIsEditing(false);
    }
    setContextMenu(null);
    setShowDeleteConfirm(false);
    toast.success("Movido a la papelera");
  }, [contextMenu, selectedNoteId, deleteNote]);

  const handleRestoreNote = useCallback((id: string) => {
    restoreNote(id);
    setContextMenu(null);
    toast.success("Nota restaurada");
  }, [restoreNote]);

  const handlePermanentDelete = useCallback((id: string) => {
    permanentlyDeleteNote(id);
    if (selectedNoteId === id) {
      setSelectedNoteId(null);
      setIsEditing(false);
    }
    setContextMenu(null);
    toast.success("Eliminada permanentemente");
  }, [permanentlyDeleteNote, selectedNoteId]);

  const handleContextMenu = useCallback((e: React.MouseEvent, noteId: string) => {
    e.preventDefault(); e.stopPropagation();
    const menuW = 172, menuH = 180;
    let x = e.clientX, y = e.clientY;
    if (x + menuW > window.innerWidth - 8) x = window.innerWidth - menuW - 8;
    if (y + menuH > window.innerHeight - 8) y = window.innerHeight - menuH - 8;
    setContextMenu({ x: Math.max(4, x), y: Math.max(4, y), noteId });
  }, []);

  const handleEditorInput = useCallback(() => {
    setSaveStatus("pending");
    if (editorRef.current && selectedNote) {
      updateNote(selectedNote.id, { content: editorRef.current.innerHTML });
    }
  }, [selectedNote, updateNote]);

  const handleEditorPaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith("image/")) {
        e.preventDefault();
        const file = items[i].getAsFile();
        if (!file) continue;
        const reader = new FileReader();
        reader.onload = (ev) => {
          const dataUrl = ev.target?.result as string;
          if (!dataUrl || !editorRef.current) return;
          const img = `<img src="${dataUrl}" alt="Imagen pegada" style="max-width:100%;border-radius:8px;margin:8px 0;" class="editable-image" />`;
          document.execCommand("insertHTML", false, img);
          setSaveStatus("pending");
          if (selectedNote) updateNote(selectedNote.id, { content: editorRef.current.innerHTML });
        };
        reader.readAsDataURL(file);
        return;
      }
    }
  }, [selectedNote, updateNote]);

  const handleFormat = useCallback((cmd: string, value?: string) => {
    if (cmd === "codeBlock") {
      const sel = window.getSelection();
      const text = sel ? sel.toString() : "";
      const html = `<pre class="notes-code-block"><code>${text || "Código"}</code><button class="copy-code-btn" onclick="(function(btn){var code=btn.parentElement.querySelector('code').textContent;navigator.clipboard.writeText(code);btn.textContent='Copiado';setTimeout(function(){btn.textContent='Copiar'},2000);})(this)">Copiar</button></pre>`;
      document.execCommand("insertHTML", false, html);
    } else if (cmd === "insertTable") {
      const html = `<table class="notes-table" style="width:100%;border-collapse:collapse;margin:8px 0;"><thead><tr><th style="border:1px solid var(--border-default);padding:8px;background:var(--bg-hover);font-weight:600;">Columna 1</th><th style="border:1px solid var(--border-default);padding:8px;background:var(--bg-hover);font-weight:600;">Columna 2</th></tr></thead><tbody><tr><td style="border:1px solid var(--border-default);padding:8px;">Dato</td><td style="border:1px solid var(--border-default);padding:8px;">Dato</td></tr></tbody></table><br>`;
      document.execCommand("insertHTML", false, html);
    } else if (cmd === "insertFile") {
      fileInputRef.current?.click();
      return;
    } else if (cmd === "styledQuote") {
      const sel = window.getSelection();
      const text = sel ? sel.toString() : "";
      if (text) {
        document.execCommand("insertHTML", false, `<blockquote class="notes-styled-quote" style="border-left:3px solid var(--accent);margin:12px 0;padding:12px 16px;background:var(--bg-hover);border-radius:0 8px 8px 0;font-style:italic;color:var(--text-secondary);">${text}</blockquote>`);
      } else {
        document.execCommand("insertHTML", false, `<blockquote class="notes-styled-quote" style="border-left:3px solid var(--accent);margin:12px 0;padding:12px 16px;background:var(--bg-hover);border-radius:0 8px 8px 0;font-style:italic;color:var(--text-secondary);"><br></blockquote>`);
      }
    } else if (cmd === "removeLink") {
      document.execCommand("unlink", false);
    } else {
      document.execCommand(cmd, false, value);
    }
    editorRef.current?.focus();
    setSaveStatus("pending");
  }, []);

  const handleDuplicate = useCallback(() => {
    const targetId = contextMenu ? contextMenu.noteId : selectedNoteId;
    if (!targetId) return;
    const newId = duplicateNote(targetId);
    if (newId) {
      setSelectedNoteId(newId);
      toast.success("Cuaderno duplicado");
    }
  }, [selectedNoteId, contextMenu, duplicateNote]);

  const handleMoveToFolder = useCallback((folderId: string | undefined) => {
    const targetId = contextMenu ? contextMenu.noteId : selectedNoteId;
    if (!targetId) return;
    const dest = folders.find(f => f.id === folderId);
    updateNote(targetId, {
      folderId,
      course: dest ? dest.name : "",
      courseColor: dest ? dest.color : "#8B5CF6"
    });
    setShowMoveModal(false);
    toast.success("Nota movida");
  }, [selectedNoteId, contextMenu, folders, updateNote]);

  const handleExportPDF = useCallback((noteId?: string) => {
    const target = notes.find(n => n.id === (noteId || (contextMenu ? contextMenu.noteId : selectedNoteId)));
    if (!target) return;
    const content = `
      <html><head><meta charset="utf-8"><style>
        body { font-family: system-ui; max-width: 800px; margin: 40px auto; padding: 20px; color: #222; }
        h1 { font-size: 24px; margin-bottom: 8px; }
        .meta { color: #888; font-size: 12px; margin-bottom: 24px; }
        .content { font-size: 14px; line-height: 1.7; }
      </style></head><body>
        <h1>${target.title}</h1>
        <div class="meta">${safeFormat(target.createdAt, "d MMM yyyy, HH:mm")} · ${getWordCount(target.content)} palabras</div>
        <div class="content">${target.content}</div>
      </body></html>
    `;
    const blob = new Blob([content], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = (target.title || "nota") + ".html";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Exportado como HTML");
    setContextMenu(null);
  }, [notes, contextMenu, selectedNoteId]);

  // DRAG AND DROP HANDLERS FOR REORDERING (Libros / Bloques)
  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    dragIndexRef.current = index;
    e.dataTransfer.effectAllowed = "move";
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    const dragIndex = dragIndexRef.current;
    if (dragIndex === null || dragIndex === dropIndex) return;
    const ids = [...filteredNotes.map((n) => n.id)];
    const [moved] = ids.splice(dragIndex, 1);
    ids.splice(dropIndex, 0, moved);
    reorderNotes(ids);
    dragIndexRef.current = null;
    toast.success("Orden actualizado");
  }, [filteredNotes, reorderNotes]);

  // Creator advanced actions
  const handleCreateFolder = useCallback((name: string, color: string) => {
    addNoteFolder({ name, color, isManual: true });
    setShowNewFolderModal(false);
    toast.success("Carpeta creada");
  }, [addNoteFolder]);

  const handleCreateTag = useCallback((name: string, color: string) => {
    const updatedColors = { ...customTagColors, [name]: color };
    setCustomTagColors(updatedColors);
    localStorage.setItem("owa_custom_tag_colors", JSON.stringify(updatedColors));
    setShowNewTagModal(false);
    toast.success("Etiqueta creada");
  }, [customTagColors]);

  // Click outside to close context menu
  useEffect(() => {
    if (!contextMenu) return;
    const handler = () => setContextMenu(null);
    window.addEventListener("click", handler);
    return () => window.removeEventListener("click", handler);
  }, [contextMenu]);

  // Auto-save logic
  useEffect(() => {
    if (!selectedNote || !isEditing) return;
    const id = setInterval(() => { handleSaveNote(); }, 20000);
    return () => clearInterval(id);
  }, [selectedNote, isEditing, handleSaveNote]);

  const sortLabels: Record<SortMode, string> = {
    updated: "Recientes", created: "Creados", title: "Título",
    course: "Curso", visits: "Visitas", priority: "Prioridad",
  };

  const relatedNotes = useMemo(() => {
    if (!selectedNote) return [];
    return notes.filter(n => n.id !== selectedNote.id && (n.folderId === selectedNote.folderId || n.course === selectedNote.course || (n.tags && selectedNote.tags && n.tags.some(t => selectedNote.tags!.includes(t))))).slice(0, 4);
  }, [notes, selectedNote]);

  return (
    <div className="page-container" style={{
      display: "flex", flexDirection: "column", height: "100%",
      overflow: "hidden", gap: 0, padding: "26px 28px 16px",
      position: "relative",
    }}>
      {/* ===== HEADER: Estudio-style as card ===== */}
      <header style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        marginBottom: 24, paddingTop: 8,
      }}>
        <div>
          <h1 style={{
            fontSize: 40, fontWeight: 200, color: 'var(--text-primary)', lineHeight: 1,
            letterSpacing: '-0.03em', fontFamily: "'Inter Tight', sans-serif",
            textShadow: '0 0 20px var(--accent-glow)', margin: 0,
          }}>
            Notas
          </h1>
          <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4,
              fontWeight: 400, letterSpacing: '0.02em' }}>
            Tu conocimiento, organizado.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={() => {
            if (floatingNoteId) { setFloatingNoteId(null); } else {
              const id = addNote({ title: "Nota rápida", content: "", subtitle: "", course: "", courseColor: "", tags: [], isPinned: false });
              setFloatingNoteId(id);
            }
          }}
            style={{
              display: "flex", alignItems: "center", gap: 5, height: 30,
              padding: "0 10px", borderRadius: 8,
              background: "var(--bg-surface)", border: "1px solid var(--border-subtle)",
              color: "var(--text-secondary)", fontSize: 11, fontWeight: 550,
              cursor: "pointer", transition: "all 150ms " + EASE,
            }}
            className="hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
            title={floatingNoteId ? "Cerrar nota flotante" : "Nueva nota flotante (Ctrl+Shift+N)"}>
            <StickyNote size={13} /> {floatingNoteId ? "Cerrar flotante" : "Nota rápida"}
          </button>
          <NotificationBell />
          <div className="flex items-center gap-4 flex-shrink-0" style={{
              paddingLeft: 16, borderLeft: '1px solid var(--border-subtle)', position: 'relative' }}>
            <div style={{ position: 'absolute', top: '50%', right: 0, width: 150, height: 100,
                background: 'radial-gradient(circle at center, var(--accent-dim) 0%, transparent 70%)',
                opacity: 0.25, transform: 'translateY(-50%)', pointerEvents: 'none', zIndex: 0 }} />
            <div style={{ width: 8, height: 8, borderRadius: '50%',
                background: 'var(--text-tertiary)', position: 'relative', zIndex: 1 }} />
            <div style={{ textAlign: 'right', position: 'relative', zIndex: 1 }}>
              <div className="flex items-baseline gap-2 justify-end">
                <span style={{ fontFamily: "'Inter Tight', sans-serif", fontSize: 68, fontWeight: 200,
                    lineHeight: 0.9, color: 'var(--accent)', letterSpacing: '0.02em',
                    textShadow: '0 0 20px var(--accent-glow)' }}>
                  {timeStr}
                </span>
                <span style={{ fontFamily: "'Inter Tight', sans-serif", fontSize: 22, fontWeight: 200,
                    color: 'var(--accent)', opacity: 0.7, letterSpacing: '0.02em' }}>
                  {secondsStr}
                </span>
              </div>
              <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-tertiary)',
                  textTransform: 'uppercase', letterSpacing: '0.12em', marginTop: 6 }}>
                {dateStr}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ===== MAIN GRID LAYOUT (toolbar + content inside one bento card) ===== */}
      {isEditing ? (
            /* ==================== INLINE EDITOR WORKSPACE ==================== */
            <div style={{
              display: "flex", flex: 1, minHeight: 0, background: "var(--bg-surface)",
              border: "1px solid var(--border-default)", borderRadius: "var(--radius-lg)",
              overflow: "hidden",
            }}>
              {/* Editor content */}
              <div style={{
                flex: 1, display: "flex", flexDirection: "column", overflow: "hidden",
                borderRight: showDetailsPanel ? "1px solid var(--border-default)" : "none",
              }}>
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "10px 16px", borderBottom: "1px solid var(--border-default)",
                  background: "var(--bg-elevated)",
                }}>
                  <button onClick={() => { handleSaveNote(); setIsEditing(false); }}
                    style={{
                      background: "none", border: "1px solid var(--border-default)", color: "var(--text-primary)",
                      padding: "6px 12px", borderRadius: 8, display: "flex", alignItems: "center", gap: 6,
                      fontSize: 12, fontWeight: 600, cursor: "pointer",
                    }}
                    className="hover:bg-[var(--bg-hover)]">
                    <ArrowLeft size={14} /> Volver
                  </button>

                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{
                      display: "flex", alignItems: "center", gap: 4, fontSize: 11,
                      color: saveStatus === "saved" ? "var(--success)" : "var(--warning)",
                    }}>
                      <Check size={12} />
                    </span>
                    
                    {/* Note Icon custom picker toggle */}
                    <div style={{ position: "relative" }}>
                      <button onClick={() => setShowIconPicker(!showIconPicker)}
                        style={{
                          background: "none", border: "1px solid var(--border-default)",
                          color: "var(--text-primary)", padding: 6, borderRadius: 8, display: "flex", cursor: "pointer",
                        }}>
                        <Palette size={14} />
                      </button>
                      {showIconPicker && (
                        <IconPicker
                          currentIcon={selectedNote?.coverImage}
                          currentColor={selectedNote?.coverColor}
                          onSelect={(ico, col) => {
                            updateNote(selectedNote!.id, { coverImage: ico, coverColor: col });
                            toast.success("Icono de nota actualizado");
                          }}
                          onClose={() => setShowIconPicker(false)}
                        />
                      )}
                    </div>

                    <button onClick={() => setShowDetailsPanel(!showDetailsPanel)}
                      style={{
                        background: showDetailsPanel ? "var(--accent-dim)" : "none",
                        border: "1px solid " + (showDetailsPanel ? "var(--accent)" : "var(--border-default)"),
                        color: showDetailsPanel ? "var(--accent)" : "var(--text-secondary)",
                        padding: 6, borderRadius: 8, display: "flex", cursor: "pointer",
                      }}>
                      <Info size={15} />
                    </button>
                  </div>
                </div>

                {/* Hidden file input for attachments */}
                <input ref={fileInputRef} type="file" style={{ display: "none" }} onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file && editorRef.current) {
                    const url = URL.createObjectURL(file);
                    const isImg = file.type.startsWith("image/");
                    if (isImg) {
                      document.execCommand("insertHTML", false, `<img src="${url}" alt="${file.name}" style="max-width:100%;border-radius:8px;margin:8px 0;" class="editable-image" />`);
                    } else {
                      document.execCommand("insertHTML", false, `<div class="notes-attachment" style="display:flex;align-items:center;gap:8px;padding:8px 12px;border:1px solid var(--border-default);border-radius:8px;margin:8px 0;background:var(--bg-hover);"><span style="font-size:20px;">📎</span><a href="${url}" target="_blank" style="color:var(--accent);font-weight:600;">${file.name}</a><span style="font-size:10px;color:var(--text-tertiary);margin-left:auto;">${(file.size / 1024).toFixed(0)} KB</span></div>`);
                    }
                    setSaveStatus("pending");
                    if (selectedNote) updateNote(selectedNote.id, { content: editorRef.current.innerHTML });
                  }
                  e.target.value = "";
                }} />

                {/* Rich formatting Toolbar */}
                <div style={{ padding: "8px 16px", borderBottom: "1px solid var(--border-default)", flexShrink: 0 }}>
                  <EditorToolbar onFormat={handleFormat} />
                </div>

                {/* Write panel — full width with professional margins */}
                <div style={{
                  flex: 1, display: "flex", flexDirection: "column", overflow: "auto",
                  padding: "24px 40px 40px", width: "100%", boxSizing: "border-box",
                }}>
                  {/* Clean text input for title */}
                  <input
                    ref={titleRef}
                    type="text"
                    defaultValue={selectedNote?.title || ""}
                    placeholder="Título del cuaderno"
                    style={{
                      fontSize: 26, fontWeight: 700, color: "var(--text-primary)",
                      fontFamily: "'Outfit', sans-serif",
                      background: "transparent", border: "none", outline: "none",
                      width: "100%", padding: "0 0 10px", marginBottom: 16,
                      borderBottom: "1px solid var(--border-default)",
                      caretColor: "var(--accent)", boxSizing: "border-box",
                    }}
                    onBlur={handleSaveNote}
                  />

                  {/* Content editor — fills full width, academic-ready */}
                  <div
                    ref={editorRef}
                    contentEditable
                    suppressContentEditableWarning
                    className="notes-editor-area"
                    style={{
                      flex: 1, outline: "none", minHeight: "100%",
                      fontSize: 15.5, lineHeight: 1.85,
                      color: "var(--text-primary)",
                      fontFamily: "'Atkinson Hyperlegible', 'Source Serif 4', system-ui, serif",
                      caretColor: "var(--accent)",
                      width: "100%", boxSizing: "border-box",
                    }}
                    onClick={(e) => {
                      const target = e.target as HTMLElement;
                      if (target.tagName === "IMG" && target.classList.contains("editable-image")) {
                        const existing = editorRef.current?.querySelector(".image-editor-overlay");
                        if (existing) existing.remove();
                        const overlay = document.createElement("div");
                        overlay.className = "image-editor-overlay";
                        overlay.contentEditable = "false";
                        overlay.style.cssText = "display:flex;align-items:center;gap:6px;padding:6px 10px;background:var(--bg-elevated);border:1px solid var(--border-default);border-radius:8px;box-shadow:var(--shadow-elevated);position:absolute;z-index:50;margin-top:4px;";
                        const resizeInp = document.createElement("input");
                        resizeInp.type = "range";
                        resizeInp.min = "20"; resizeInp.max = "100"; resizeInp.value = "100";
                        resizeInp.style.cssText = "width:80px;height:4px;accent-color:var(--accent);cursor:pointer;";
                        resizeInp.oninput = () => { target.style.width = resizeInp.value + "%"; };
                        const delBtn = document.createElement("button");
                        delBtn.innerHTML = "✕";
                        delBtn.style.cssText = "background:none;border:none;color:var(--error);cursor:pointer;font-size:14px;padding:2px 4px;";
                        delBtn.onclick = () => { target.remove(); overlay.remove(); };
                        const colorInp = document.createElement("input");
                        colorInp.type = "color";
                        colorInp.value = "#000000";
                        colorInp.style.cssText = "width:24px;height:24px;border:none;border-radius:4px;cursor:pointer;padding:0;background:none;";
                        colorInp.oninput = () => { target.style.border = "2px solid " + colorInp.value; };
                        overlay.append(resizeInp, colorInp, delBtn);
                        target.parentElement?.style.position === "relative" ? null : target.parentElement ? target.parentElement.style.position = "relative" : null;
                        target.parentElement?.appendChild(overlay);
                      }
                    }}
                    onPaste={handleEditorPaste}
                    onInput={handleEditorInput}
                    onBlur={handleSaveNote}
                  />
                </div>
              </div>

              {/* Collapsible Details Panel right — using app theme colors */}
              {showDetailsPanel && selectedNote && (() => {
                const pColor = selectedNote.coverColor || selectedNote.courseColor || "var(--accent)";
                return (
                <div style={{
                  width: 280, minWidth: 280, display: "flex", flexDirection: "column",
                  background: "var(--bg-surface)",
                  padding: 16, overflow: "auto",
                  gap: 16, borderLeft: "1px solid var(--border-subtle)",
                }}>
                  <div>
                    <h3 style={{ fontSize: 9.5, fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
                      <Info size={10} style={{ marginRight: 4 }} /> Metadatos
                    </h3>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, alignItems: "center" }}>
                        <span style={{ color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 4 }}><FolderIcon size={10} /> Carpeta</span>
                        <span style={{ fontWeight: 600, color: pColor, fontSize: 11.5 }}>
                          ● {selectedNote.course || "Sin carpeta"}
                        </span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                        <span style={{ color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 4 }}><Clock size={10} /> Creada</span>
                        <span style={{ color: "var(--text-primary)", fontSize: 11.5 }}>
                          {safeFormat(selectedNote.createdAt, "d MMM, HH:mm")}
                        </span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                        <span style={{ color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 4 }}><Edit3 size={10} /> Modificada</span>
                        <span style={{ color: "var(--text-primary)", fontSize: 11.5 }}>
                          {safeFormat(selectedNote.updatedAt, "d MMM, HH:mm")}
                        </span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                        <span style={{ color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 4 }}><FileText size={10} /> Palabras</span>
                        <span style={{ color: "var(--text-primary)", fontSize: 11.5 }}>{getWordCount(selectedNote.content)}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                        <span style={{ color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 4 }}><Type size={10} /> Caracteres</span>
                        <span style={{ color: "var(--text-primary)", fontSize: 11.5 }}>{getCharCount(selectedNote.content)}</span>
                      </div>
                    </div>
                  </div>

                  <div style={{ height: 1, background: "var(--border-subtle)" }} />

                  {/* Related notes links */}
                  <div>
                    <h3 style={{ fontSize: 9.5, fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
                      <Link size={10} style={{ marginRight: 4 }} /> Relacionados
                    </h3>
                    {relatedNotes.length > 0 ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                        {relatedNotes.map(rn => (
                          <div key={rn.id} onClick={() => setSwitchTargetId(rn.id)}
                            style={{
                              display: "flex", alignItems: "center", gap: 8, padding: "6px 8px",
                              borderRadius: 6, background: "var(--bg-elevated)",
                              border: "1px solid var(--border-default)", cursor: "pointer",
                            }}
                            className="hover:brightness-110">
                            <NoteIconRenderer iconName={rn.coverImage} color={rn.coverColor || rn.courseColor || "var(--accent)"} size={12} />
                            <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{rn.title}</span>
                            <ChevronRight size={10} style={{ color: "var(--text-tertiary)", marginLeft: "auto", flexShrink: 0 }} />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span style={{ color: "var(--text-tertiary)", fontSize: 11 }}>Sin relaciones</span>
                    )}
                  </div>

                  <div style={{ height: 1, background: "var(--border-subtle)" }} />

                  {/* Acceso Rápido */}
                  <div>
                    <h3 style={{ fontSize: 9.5, fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
                      <Zap size={10} style={{ marginRight: 4 }} /> Acceso Rápido
                    </h3>
                    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                      <button onClick={() => { openFloatingNote(selectedNote!); }}
                        title="Abrir en ventana flotante nativa"
                        style={{
                          display: "flex", alignItems: "center", gap: 6, padding: "7px 10px",
                          borderRadius: 6, border: "1px solid var(--accent)", background: "var(--accent-dim)",
                          color: "var(--accent)", fontSize: 11.5, fontWeight: 600, cursor: "pointer",
                          transition: "all 150ms",
                        }}
                        className="hover:brightness-110">
                        <StickyNote size={13} /> Abrir en flotante
                      </button>
                      <button onClick={handleDuplicate}
                        style={{
                          display: "flex", alignItems: "center", gap: 6, padding: "6px 10px",
                          borderRadius: 6, border: "1px solid var(--border-default)", background: "var(--bg-elevated)",
                          color: "var(--text-primary)", fontSize: 11.5, cursor: "pointer",
                        }}
                        className="hover:bg-[var(--bg-hover)]">
                        <Copy size={12} /> Duplicar
                      </button>
                      <button onClick={() => handleExportPDF()}
                        style={{
                          display: "flex", alignItems: "center", gap: 6, padding: "6px 10px",
                          borderRadius: 6, border: "1px solid var(--border-default)", background: "var(--bg-elevated)",
                          color: "var(--text-primary)", fontSize: 11.5, cursor: "pointer",
                        }}
                        className="hover:bg-[var(--bg-hover)]">
                        <Download size={12} /> Exportar PDF
                      </button>
                      <button onClick={() => setShowDeleteConfirm(true)}
                        style={{
                          display: "flex", alignItems: "center", gap: 6, padding: "6px 10px",
                          borderRadius: 6, border: "1px solid var(--border-default)", background: "var(--bg-elevated)",
                          color: "var(--error)", fontSize: 11.5, cursor: "pointer",
                        }}
                        className="hover:bg-[var(--bg-hover)]">
                        <Trash2 size={12} /> Eliminar
                      </button>
                    </div>
                  </div>
                </div>
                );
              })()}
            </div>
          ) : (
            /* ==================== MAIN CONTENT CARD ==================== */
            <div style={{
              display: "flex", flex: 1, minHeight: 0, overflow: "hidden",
              background: "var(--bg-surface)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-lg)",
              boxShadow: "var(--shadow-sm)",
            }}>
              {/* LEFT SIDEBAR (Library views & custom folder list) */}
              <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
                <LibrarySidebar
                  folders={folders}
                  notes={notes}
                  selectedFolderId={selectedFolderId}
                  selectedTag={selectedTag}
                  onSelectFolder={setSelectedFolderId}
                  onSelectTag={setSelectedTag}
                  onNewFolder={() => setShowNewFolderModal(true)}
                  onNewTag={() => setShowNewTagModal(true)}
                  activeSidebarTab={activeSidebarTab}
                  setActiveSidebarTab={setActiveSidebarTab}
                />
              </div>

              {/* CENTER CONTAINER */}
              <div style={{
                flex: 1, minWidth: 0, display: "flex", flexDirection: "column",
                overflow: "hidden", position: "relative",
              }}>
                {/* Top bar: view toggle (left), search + actions (right) */}
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                  flexShrink: 0, padding: "10px 14px 0",
                  borderBottom: "1px solid var(--border-subtle)",
                  background: "var(--bg-elevated)",
                }}>
                  {/* View toggle — left side, improved aesthetics */}
                  <div style={{
                    display: "flex", background: "var(--bg-surface)",
                    border: "1px solid var(--border-subtle)", borderRadius: 12, padding: 4, height: 44,
                    boxSizing: "border-box", gap: 3,
                    boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
                  }}>
                    <button onClick={() => setViewMode("estante")}
                      title="Vista de Estantería"
                      style={{
                        width: 36, height: 36, borderRadius: 8, border: "none",
                        background: viewMode === "estante" ? "linear-gradient(135deg, var(--accent) 0%, color-mix(in srgb, var(--accent) 80%, #000) 100%)" : "transparent",
                        color: viewMode === "estante" ? "#fff" : "var(--text-tertiary)",
                        cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                        transition: "all 200ms",
                        boxShadow: viewMode === "estante" ? "0 2px 8px var(--accent-glow)" : "none",
                      }}
                      className="hover:brightness-110">
                      <Library size={16} />
                    </button>
                    <button onClick={() => setViewMode("lista")}
                      title="Vista de Bloques"
                      style={{
                        width: 36, height: 36, borderRadius: 8, border: "none",
                        background: viewMode === "lista" ? "linear-gradient(135deg, var(--accent) 0%, color-mix(in srgb, var(--accent) 80%, #000) 100%)" : "transparent",
                        color: viewMode === "lista" ? "#fff" : "var(--text-tertiary)",
                        cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                        transition: "all 200ms",
                        boxShadow: viewMode === "lista" ? "0 2px 8px var(--accent-glow)" : "none",
                      }}
                      className="hover:brightness-110">
                      <AlignJustify size={16} />
                    </button>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ position: "relative", width: 200 }}>
                      <Search size={14} style={{
                        position: "absolute", left: 10, top: "50%",
                        transform: "translateY(-50%)", color: "var(--text-tertiary)",
                        pointerEvents: "none", zIndex: 1,
                      }} />
                      <input type="text" placeholder="Buscar cuaderno..."
                        value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                        className="input-base"
                        style={{
                          width: "100%", height: 32, borderRadius: 8, padding: "0 12px 0 30px", fontSize: 12,
                        }} />
                    </div>
                    <button onClick={handleCreateNote}
                      style={{
                        display: "flex", alignItems: "center", gap: 5, height: 32, padding: "0 14px",
                        background: "var(--accent)", color: "#fff", border: "none", borderRadius: 8,
                        fontSize: 12, fontWeight: 600, cursor: "pointer",
                        boxShadow: "0 2px 8px var(--accent-glow)", whiteSpace: "nowrap",
                        transition: "transform 150ms, box-shadow 150ms",
                      }}
                      className="active:scale-[0.97]">
                      <Plus size={14} /> Nueva nota
                    </button>
                  </div>
                </div>



                <div style={{
                  flex: 1, display: "flex", flexDirection: "column", overflow: "hidden",
                  position: "relative",
                }}>
              {/* Trash view */}
              {activeSidebarTab === "trash" ? (
                <div style={{ flex: 1, overflow: "auto", padding: "12px 16px" }}>
                  {filteredNotes.length === 0 ? (
                    <div style={{
                      display: "flex", flexDirection: "column", alignItems: "center",
                      justifyContent: "center", height: "100%", gap: 8, color: "var(--text-tertiary)",
                    }}>
                      <Trash2 size={24} style={{ opacity: 0.4 }} />
                      <span style={{ fontSize: 13, fontWeight: 600 }}>Papelera vacía</span>
                      <span style={{ fontSize: 11, opacity: 0.6 }}>Las notas eliminadas aparecerán aquí</span>
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {filteredNotes.map(note => {
                        const delTime = note.deletedAt ? formatDeletionTime(note.deletedAt) : "";
                        return (
                          <div key={note.id} style={{
                            display: "flex", alignItems: "center", gap: 12, padding: "10px 14px",
                            background: "var(--bg-surface)", borderRadius: "var(--radius-md)",
                            border: "1px solid var(--border-default)",
                          }}>
                            <div style={{
                              width: 32, height: 32, borderRadius: 6, flexShrink: 0,
                              background: "linear-gradient(135deg, var(--accent)10, transparent)",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              border: "1px solid var(--border-soft)",
                            }}>
                              <FileText size={14} style={{ color: "var(--text-secondary)" }} />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-primary)", marginBottom: 2 }}>{note.title || "Sin título"}</div>
                              <div style={{ fontSize: 10, color: "var(--text-tertiary)" }}>
                                {delTime} · {note.tags?.slice(0, 2).join(", ") || "sin etiquetas"}
                              </div>
                            </div>
                            <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                              <button onClick={() => handleRestoreNote(note.id)}
                                style={{
                                  background: "none", border: "1px solid var(--border-default)",
                                  borderRadius: 6, padding: "5px 8px", cursor: "pointer",
                                  color: "var(--success)", fontSize: 10, fontWeight: 600,
                                  display: "flex", alignItems: "center", gap: 4,
                                }}
                                className="hover:bg-[var(--bg-hover)]"
                                title="Restaurar">
                                Restaurar
                              </button>
                              <button onClick={() => handleExportPDF(note.id)}
                                style={{
                                  background: "none", border: "1px solid var(--border-default)",
                                  borderRadius: 6, padding: "5px 8px", cursor: "pointer",
                                  color: "var(--text-secondary)", fontSize: 10, fontWeight: 600,
                                  display: "flex", alignItems: "center", gap: 4,
                                }}
                                className="hover:bg-[var(--bg-hover)]"
                                title="Exportar PDF">
                                <Download size={11} />
                              </button>
                              <button onClick={() => handlePermanentDelete(note.id)}
                                style={{
                                  background: "none", border: "1px solid var(--error)30",
                                  borderRadius: 6, padding: "5px 8px", cursor: "pointer",
                                  color: "var(--error)", fontSize: 10, fontWeight: 600,
                                }}
                                className="hover:bg-[var(--bg-hover)]"
                                title="Eliminar permanentemente">
                                <Trash2 size={11} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : filteredNotes.length === 0 ? (
                  <div style={{
                    display: "flex", flexDirection: "column", alignItems: "center",
                    justifyContent: "center", flex: 1, gap: 10, color: "var(--text-tertiary)",
                    userSelect: "none", background: "var(--bg-surface)",
                    border: "1px dashed var(--border-default)", borderRadius: "var(--radius-lg)",
                  }}>
                    <FileText size={28} style={{ color: "var(--accent)", opacity: 0.5 }} />
                    <span style={{ fontSize: 13, fontWeight: 600 }}>Colección vacía</span>
                  </div>
                ) : viewMode === "lista" ? (
                  /* Upgraded Blocks View: Grid of 2 columns */
                  <div style={{
                    flex: 1, overflow: "auto", display: "grid",
                    gridTemplateColumns: "repeat(2, 1fr)",
                    gridAutoRows: "max-content",
                    gap: 10, padding: "6px 4px",
                  }}>
                    {filteredNotes.map((note, i) => (
                      <NoteCard key={note.id} note={note}
                        isSelected={selectedNoteId === note.id}
                        onSelect={() => handleSelectNote(note.id)}
                        onOpen={() => { handleSelectNote(note.id); handleOpenNote(); }}
                        onContextMenu={(e) => handleContextMenu(e, note.id)}
                        onDragStart={(e) => handleDragStart(e, i)}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, i)}
                        tagColors={mergedTagColors} />
                    ))}
                  </div>
                ) : (
                  /* Bookshelf View: non-scrollable, pagination at top center */
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
                    {(() => {
                      const PER_PAGE_BS = 10; // 2 shelves of 5
                      const totalPagesBS = Math.max(1, Math.ceil(filteredNotes.length / PER_PAGE_BS));
                      const safePageBS = Math.min(bookshelfPage, totalPagesBS - 1);
                      const pageNotesBS = filteredNotes.slice(safePageBS * PER_PAGE_BS, (safePageBS + 1) * PER_PAGE_BS);
                      
                      const bookshelfRows: Note[][] = [];
                      for (let i = 0; i < pageNotesBS.length; i += 5) {
                        bookshelfRows.push(pageNotesBS.slice(i, i + 5));
                      }

                      return (
                        <>
                          {/* Pagination at top, centered */}
                          <div style={{
                            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                            padding: "4px 14px 2px", flexShrink: 0,
                          }}>
                            <button onClick={() => safePageBS > 0 && setBookshelfPage(safePageBS - 1)}
                              disabled={safePageBS === 0}
                              style={{
                                background: safePageBS === 0 ? "var(--bg-surface)" : "var(--bg-elevated)",
                                border: "1px solid var(--border-default)", borderRadius: 8,
                                padding: "6px 12px", fontSize: 11, cursor: safePageBS === 0 ? "default" : "pointer",
                                color: safePageBS === 0 ? "var(--text-muted)" : "var(--text-secondary)",
                                opacity: safePageBS === 0 ? 0.4 : 1,
                                display: "flex", alignItems: "center", gap: 4, fontWeight: 550,
                                transition: "all 150ms",
                              }}
                              className={safePageBS > 0 ? "hover:bg-[var(--bg-hover)]" : ""}>
                              <ChevronRight size={13} style={{ transform: "rotate(180deg)" }} />
                              Anterior
                            </button>
                            <div style={{
                              display: "flex", alignItems: "center", gap: 4,
                              background: "var(--bg-surface)", borderRadius: 8,
                              padding: "4px 8px", border: "1px solid var(--border-subtle)",
                            }}>
                              {Array.from({ length: totalPagesBS }, (_, i) => (
                                <button key={i} onClick={() => setBookshelfPage(i)}
                                  style={{
                                    width: i === safePageBS ? 20 : 7, height: 7, borderRadius: "55%",
                                    border: "none", cursor: "pointer",
                                    background: i === safePageBS ? "var(--accent)" : "var(--border-default)",
                                    padding: 0, transition: "all 200ms " + EASE,
                                  }} />
                              ))}
                              <span style={{
                                fontSize: 9.5, color: "var(--text-tertiary)", fontWeight: 600,
                                marginLeft: 4, paddingLeft: 6, borderLeft: "1px solid var(--border-soft)",
                              }}>
                                {safePageBS + 1}/{totalPagesBS}
                              </span>
                            </div>
                            <button onClick={() => safePageBS < totalPagesBS - 1 && setBookshelfPage(safePageBS + 1)}
                              disabled={safePageBS >= totalPagesBS - 1}
                              style={{
                                background: safePageBS >= totalPagesBS - 1 ? "var(--bg-surface)" : "var(--bg-elevated)",
                                border: "1px solid var(--border-default)", borderRadius: 8,
                                padding: "6px 12px", fontSize: 11, cursor: safePageBS >= totalPagesBS - 1 ? "default" : "pointer",
                                color: safePageBS >= totalPagesBS - 1 ? "var(--text-muted)" : "var(--text-secondary)",
                                opacity: safePageBS >= totalPagesBS - 1 ? 0.4 : 1,
                                display: "flex", alignItems: "center", gap: 4, fontWeight: 550,
                                transition: "all 150ms",
                              }}
                              className={safePageBS < totalPagesBS - 1 ? "hover:bg-[var(--bg-hover)]" : ""}>
                              Siguiente
                              <ChevronRight size={13} />
                            </button>
                          </div>

                          {/* Books — non-scrollable, fills remaining space */}
                          <div style={{
                            flex: 1, display: "flex", flexDirection: "column",
                            justifyContent: "center", gap: 8, padding: "0px 12px 0",
                            overflow: "hidden",
                          }}>
                            {bookshelfRows.map((row, ri) => (
                              <div key={ri} style={{ display: "flex", flexDirection: "column", width: "100%" }}>
                                <div style={{
                                  display: "flex", justifyContent: "space-evenly", alignItems: "flex-end",
                                  paddingBottom: 0, width: "100%", height: 218, gap: 8,
                                }}>
                                  {row.map((note, ci) => {
                                    const noteIdx = safePageBS * PER_PAGE_BS + ri * 5 + ci;
                                    return (
                                      <BookshelfBook key={note.id} note={note}
                                        isSelected={selectedNoteId === note.id}
                                        folders={folders}
                                        onSelect={() => handleSelectNote(note.id)}
                                        onDoubleClick={handleOpenNote}
                                        onContextMenu={(e) => handleContextMenu(e, note.id)}
                                        onDragStart={(e) => handleDragStart(e, noteIdx)}
                                        onDragOver={handleDragOver}
                                        onDrop={(e) => handleDrop(e, noteIdx)} />
                                    );
                                  })}
                                  {row.length < 5 && Array(5 - row.length).fill(null).map((_, i) => (
                                    <div key={"empty-" + i} style={{
                                      width: 150, height: 218, opacity: 0.08,
                                      background: "linear-gradient(180deg, rgba(255,255,255,0.02) 0%, rgba(0,0,0,0.08) 100%)",
                                      borderRadius: "2px 8px 8px 2px",
                                      border: "1px dashed var(--border-default)",
                                      display: "flex", alignItems: "center", justifyContent: "center",
                                      marginBottom: 8,
                                    }}>
                                      <Plus size={18} style={{ color: "var(--text-tertiary)" }} />
                                    </div>
                                  ))}
                                </div>
                                <ShelfPlank />
                              </div>
                            ))}
                          </div>
                        </>
                      );
                    })()}
                  </div>
                )}

                {/* ==================== LATERAL OVERLAY DRAWER PANEL ==================== */}
                {/* Slides in from right, uses app theme colors */}
                <div style={{
                  position: "absolute", right: 0, top: 0, bottom: 0,
                  width: selectedNote ? (isMaximized ? "85%" : "48%") : 0,
                  opacity: selectedNote ? 1 : 0,
                  pointerEvents: selectedNote ? "all" : "none",
                  transform: selectedNote ? "translateX(0)" : "translateX(30px)",
                  transition: "all 300ms " + EASE,
                  zIndex: 80,
                  background: "var(--bg-surface)",
                  backdropFilter: "blur(24px)",
                  borderLeft: "1px solid var(--border-strong)",
                  borderRadius: "16px 0 0 16px",
                  boxShadow: "-12px 0 40px rgba(0,0,0,0.25)",
                  display: "flex", flexDirection: "column", overflow: "hidden",
                }}>
                  {selectedNote && (
                    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
                      {/* Drawer Toolbar */}
                      <div style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        padding: "12px 16px", borderBottom: "1px solid var(--border-default)",
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <button onClick={() => setSelectedNoteId(null)}
                            style={{
                              background: "none", border: "none", color: "var(--text-secondary)",
                              padding: 6, display: "flex", borderRadius: 6, cursor: "pointer",
                            }}
                            className="hover:bg-[var(--bg-hover)]">
                            <X size={15} />
                          </button>

                          {/* Maximize Toggle button */}
                          <button onClick={() => setIsMaximized(!isMaximized)}
                            style={{
                              background: "none", border: "1px solid var(--border-default)",
                              color: "var(--text-secondary)", padding: 6, borderRadius: 6,
                              display: "flex", cursor: "pointer",
                            }}
                            className="hover:bg-[var(--bg-hover)]"
                            title={isMaximized ? "Restaurar vista" : "Ampliar vista"}>
                            {isMaximized ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
                          </button>
                        </div>

                        {/* Top quick actions — icon only */}
                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <button onClick={() => updateNote(selectedNote.id, { isPinned: !selectedNote.isPinned })}
                            title={selectedNote.isPinned ? "Desfijar" : "Fijar"}
                            style={{
                              background: selectedNote.isPinned ? "rgba(245, 158, 11, 0.1)" : "none",
                              border: "1px solid " + (selectedNote.isPinned ? "#F59E0B" : "var(--border-default)"),
                              color: selectedNote.isPinned ? "#F59E0B" : "var(--text-secondary)",
                              width: 30, height: 30, borderRadius: 6, display: "flex", cursor: "pointer",
                              alignItems: "center", justifyContent: "center",
                            }}>
                            <Star size={12} fill={selectedNote.isPinned ? "#F59E0B" : "none"} />
                          </button>

                          <button onClick={() => setShowMoveModal(true)}
                            title="Mover"
                            style={{
                              background: "none", border: "1px solid var(--border-default)",
                              color: "var(--text-secondary)", width: 30, height: 30, borderRadius: 6,
                              display: "flex", cursor: "pointer", alignItems: "center", justifyContent: "center",
                            }}>
                            <FolderIcon size={12} />
                          </button>

                          <button onClick={() => { handleSelectNote(selectedNote!.id); handleOpenNote(); }}
                            title="Editar"
                            style={{
                              background: "var(--accent)", color: "#fff", border: "none",
                              width: 30, height: 30, borderRadius: 6,
                              display: "flex", cursor: "pointer",
                              alignItems: "center", justifyContent: "center",
                              boxShadow: "0 2px 8px var(--accent-glow)",
                            }}>
                            <PenTool size={12} />
                          </button>
                          <button onClick={() => { openFloatingNote(selectedNote!); }}
                            title="Abrir en flotante"
                            style={{
                              background: "none", border: "1px solid var(--border-default)",
                              color: "var(--text-secondary)", width: 30, height: 30, borderRadius: 6,
                              display: "flex", cursor: "pointer", alignItems: "center", justifyContent: "center",
                            }}
                            className="hover:bg-[var(--bg-hover)]">
                            <StickyNote size={12} />
                          </button>

                          <button onClick={() => setShowDeleteConfirm(true)}
                            title="Eliminar"
                            style={{
                              background: "none", border: "1px solid var(--border-default)",
                              color: "var(--error)", width: 30, height: 30, borderRadius: 6,
                              display: "flex", cursor: "pointer", alignItems: "center", justifyContent: "center",
                            }}>
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>

                      {/* Tabs */}
                      <div style={{
                        display: "flex", background: "rgba(255,255,255,0.01)",
                        borderBottom: "1px solid var(--border-default)", padding: "0 16px",
                      }}>
                        {["contenido", "informacion", "historial"].map((tab) => (
                          <button key={tab} onClick={() => setDrawerTab(tab as any)}
                            style={{
                              padding: "12px 14px", border: "none", background: "none",
                              color: drawerTab === tab ? "var(--accent)" : "var(--text-secondary)",
                              fontSize: 12, fontWeight: 600, cursor: "pointer",
                              borderBottom: "2px solid " + (drawerTab === tab ? "var(--accent)" : "transparent"),
                              textTransform: "capitalize", transition: "all 150ms",
                            }}>
                            {tab === "contenido" ? "Contenido" : tab === "informacion" ? "Metadatos" : "Historial"}
                          </button>
                        ))}
                      </div>

                      {/* Tab panel content */}
                      <div style={{ flex: 1, overflow: "auto", padding: 20 }}>
                        {drawerTab === "contenido" && (
                          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                            <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                              {selectedNote.course && (
                                <span style={{
                                  fontSize: 9.5, fontWeight: 700, color: selectedNote.coverColor || selectedNote.courseColor || "var(--accent)",
                                  background: (selectedNote.coverColor || selectedNote.courseColor || "var(--accent)") + "14",
                                  padding: "1px 6px", borderRadius: 4,
                                }}>
                                  ● {selectedNote.course}
                                </span>
                              )}
                            </div>

                            <h2 style={{
                              fontFamily: "'Outfit', sans-serif", fontSize: 24, fontWeight: 600,
                              color: "var(--text-primary)", margin: "4px 0 0", letterSpacing: "-0.01em",
                            }}>
                              {selectedNote.title}
                            </h2>

                            {/* HTML math formatted preview content */}
                            <div
                              dangerouslySetInnerHTML={{ __html: formatMathContent(selectedNote.content) }}
                              style={{
                                fontSize: 13.5, lineHeight: 1.75, color: "var(--text-primary)",
                                fontFamily: "var(--font-primary)",
                              }}
                              className="notes-preview-area"
                            />

                            {/* Attachments */}
                            {selectedNote.attachments && selectedNote.attachments.length > 0 && (
                              <div style={{ marginTop: 12 }}>
                                <h4 style={{ fontSize: 10, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Adjuntos</h4>
                                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                                  {selectedNote.attachments.map(att => (
                                    <div key={att.id} style={{
                                      display: "flex", alignItems: "center", gap: 8, padding: 8,
                  background: "rgba(255,255,255,0.03)", border: "1px solid var(--border-subtle)",
                                      borderRadius: 6, fontSize: 11.5,
                                    }}>
                                      <File size={13} style={{ color: "var(--accent)", flexShrink: 0 }} />
                                      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{att.name}</span>
                                      <span style={{ fontSize: 9.5, color: "var(--text-tertiary)" }}>{(att.size / (1024 * 1024)).toFixed(1)} MB</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {drawerTab === "informacion" && (
                          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                            <div style={{
                              display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8,
                            }}>
                              <div style={{
                                padding: "10px 12px", background: "var(--bg-elevated)",
                                borderRadius: "var(--radius-md)", border: "1px solid var(--border-soft)",
                              }}>
                                <div style={{ fontSize: 9, color: "var(--text-tertiary)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4, display: "flex", alignItems: "center", gap: 3 }}>
                                  <FileText size={10} /> Palabras
                                </div>
                                <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>
                                  {getWordCount(selectedNote.content).toLocaleString()}
                                </div>
                              </div>
                              <div style={{
                                padding: "10px 12px", background: "var(--bg-elevated)",
                                borderRadius: "var(--radius-md)", border: "1px solid var(--border-soft)",
                              }}>
                                <div style={{ fontSize: 9, color: "var(--text-tertiary)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4, display: "flex", alignItems: "center", gap: 3 }}>
                                  <Type size={10} /> Caracteres
                                </div>
                                <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>
                                  {getCharCount(selectedNote.content).toLocaleString()}
                                </div>
                              </div>
                              <div style={{
                                padding: "10px 12px", background: "var(--bg-elevated)",
                                borderRadius: "var(--radius-md)", border: "1px solid var(--border-soft)",
                              }}>
                                <div style={{ fontSize: 9, color: "var(--text-tertiary)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4, display: "flex", alignItems: "center", gap: 3 }}>
                                  <File size={10} /> Tamaño
                                </div>
                                <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>
                                  {((selectedNote.content.length) / 1024).toFixed(1)} <span style={{ fontSize: 10, color: "var(--text-tertiary)" }}>KB</span>
                                </div>
                              </div>
                              <div style={{
                                padding: "10px 12px", background: "var(--bg-elevated)",
                                borderRadius: "var(--radius-md)", border: "1px solid var(--border-soft)",
                              }}>
                                <div style={{ fontSize: 9, color: "var(--text-tertiary)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4, display: "flex", alignItems: "center", gap: 3 }}>
                                  <BookOpen size={10} /> Asignatura
                                </div>
                                <div style={{ fontSize: 14, fontWeight: 700, color: selectedNote.coverColor || selectedNote.courseColor || "var(--text-primary)" }}>
                                  {selectedNote.course || "—"}
                                </div>
                              </div>
                            </div>
                            <div style={{
                              display: "flex", flexDirection: "column", gap: 6,
                              background: "var(--bg-elevated)", borderRadius: "var(--radius-md)",
                              border: "1px solid var(--border-soft)", padding: "10px 12px",
                            }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10.5 }}>
                                <Clock size={11} style={{ color: "var(--text-tertiary)", flexShrink: 0 }} />
                                <span style={{ color: "var(--text-tertiary)", minWidth: 60 }}>Creado</span>
                                <span style={{ color: "var(--text-primary)", fontWeight: 550 }}>
                                  {safeFormat(selectedNote.createdAt, "d MMM yyyy, HH:mm")}
                                </span>
                              </div>
                              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10.5 }}>
                                <Edit3 size={11} style={{ color: "var(--text-tertiary)", flexShrink: 0 }} />
                                <span style={{ color: "var(--text-tertiary)", minWidth: 60 }}>Editado</span>
                                <span style={{ color: "var(--text-primary)", fontWeight: 550 }}>
                                  {safeFormat(selectedNote.updatedAt, "d MMM yyyy, HH:mm")}
                                </span>
                              </div>
                            </div>
                          </div>
                        )}

                        {drawerTab === "historial" && (
                          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            <div style={{ position: "relative", paddingLeft: 22 }}>
                              {/* Timeline connecting path */}
                              <div style={{
                                position: "absolute", left: 10, top: 10, bottom: 8,
                                width: 2,
                                background: "linear-gradient(180deg, var(--accent) 0%, var(--accent) 40%, var(--border-default) 100%)",
                                opacity: 0.35, borderRadius: 2,
                              }} />
                              {/* Recent edit */}
                              <div style={{ position: "relative", paddingBottom: 16 }}>
                                <div style={{
                                  position: "absolute", left: -16, top: 5, width: 10, height: 10,
                                  borderRadius: "50%", background: "var(--accent)",
                                  border: "2px solid var(--bg-surface)",
                                  boxShadow: "0 0 0 3px var(--accent-glow), 0 2px 6px rgba(0,0,0,0.15)",
                                  zIndex: 2,
                                }} />
                                <div style={{
                                  marginLeft: 2, padding: "10px 12px",
                                  background: "var(--bg-elevated)", borderRadius: "var(--radius-md)",
                                  border: "1px solid var(--border-soft)",
                                }}>
                                  <div style={{
                                    fontSize: 12, fontWeight: 600, color: "var(--text-primary)",
                                    fontFamily: "var(--font-heading)", marginBottom: 2,
                                  }}>
                                    Edición reciente
                                  </div>
                                  <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10.5, color: "var(--text-tertiary)" }}>
                                    <Clock size={9} /> {safeFormat(selectedNote.updatedAt, "d MMM yyyy, HH:mm")}
                                    <span style={{ marginLeft: "auto", fontSize: 9, background: "var(--bg-hover)", padding: "0px 5px", borderRadius: 3 }}>{getWordCount(selectedNote.content)} palabras</span>
                                  </div>
                                </div>
                              </div>
                              {/* Created */}
                              <div style={{ position: "relative" }}>
                                <div style={{
                                  position: "absolute", left: -14, top: 5, width: 7, height: 7,
                                  borderRadius: "50%", background: "var(--border-default)",
                                  border: "2px solid var(--bg-surface)",
                                  zIndex: 2,
                                }} />
                                <div style={{
                                  marginLeft: 2, padding: "10px 12px",
                                  background: "var(--bg-elevated)", borderRadius: "var(--radius-md)",
                                  border: "1px solid var(--border-soft)",
                                }}>
                                  <div style={{
                                    fontSize: 12, fontWeight: 600, color: "var(--text-secondary)",
                                    marginBottom: 2,
                                  }}>
                                    Nota creada
                                  </div>
                                  <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10.5, color: "var(--text-tertiary)" }}>
                                    <Clock size={9} /> {safeFormat(selectedNote.createdAt, "d MMM yyyy, HH:mm")}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Footer statistics */}
                      <div style={{
                        padding: "10px 16px", borderTop: "1px solid var(--border-default)",
                        fontSize: 10.5, color: "var(--text-secondary)", display: "flex",
                        justifyContent: "space-between", alignItems: "center", flexShrink: 0,
                      }}>
                        <span style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--text-tertiary)", fontSize: 10 }}>
                          <Check size={10} /> {getWordCount(selectedNote.content)} palabras
                        </span>
                      </div>
                    </div>
                  )}
                </div>
                </div>
              </div>
            </div>
          )}

      {/* ===== ICON PICKER OVERLAY (from context menu) ===== */}
      {showIconPicker && iconPickerTarget && (
        <div style={{
          position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
          zIndex: 10001,
        }}>
          <div style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: -1,
          }} onClick={() => { setShowIconPicker(false); setIconPickerTarget(null); }} />
          <IconPicker
            currentIcon={notes.find(n => n.id === iconPickerTarget)?.coverImage}
            currentColor={notes.find(n => n.id === iconPickerTarget)?.coverColor}
            onSelect={(ico, col) => {
              if (iconPickerTarget) updateNote(iconPickerTarget, { coverImage: ico, coverColor: col });
            }}
            onClose={() => { setShowIconPicker(false); setIconPickerTarget(null); }}
          />
        </div>
      )}

      {/* ===== CONTEXT MENU ===== */}
      {contextMenu && (
        <div style={{
          position: "fixed", top: contextMenu.y, left: contextMenu.x, zIndex: 10000,
          background: "linear-gradient(135deg, var(--bg-surface) 0%, var(--bg-base) 100%)",
          border: "1px solid var(--border-default)",
          borderRadius: "var(--radius-md)", padding: 4, minWidth: 160,
          boxShadow: "var(--shadow-elevated)",
        }}>
          {[
            { label: "Editar", icon: PenTool, action: () => { setSelectedNoteId(contextMenu.noteId); setContextMenu(null); setIsEditing(true); } },
            { label: "Abrir en flotante", icon: StickyNote, action: () => { const t = notes.find(n => n.id === contextMenu.noteId); if (t) openFloatingNote(t); } },
            { type: "divider" as const },
            { label: "Editar icono", icon: ImageIcon, action: () => { const target = notes.find(n => n.id === contextMenu.noteId); if (target) { setIconPickerTarget(contextMenu.noteId); setShowIconPicker(true); } } },
            { label: "Duplicar", icon: Copy, action: handleDuplicate },
            { type: "divider" as const },
            { label: "Exportar HTML", icon: Download, action: handleExportPDF },
            { type: "divider" as const },
            { label: "Eliminar", icon: Trash2, action: () => { setShowDeleteConfirm(true); }, danger: true },
          ].map((item, i) => {
            if ("type" in item) return <div key={i} style={{ height: 1, background: "var(--border-default)", margin: "4px 6px" }} />;
            const Icon = item.icon;
            return (
              <button key={i} onClick={() => { item.action(); setContextMenu(null); }}
                style={{
                  display: "flex", alignItems: "center", gap: 8, width: "100%",
                  padding: "6px 10px", background: "none", border: "none",
                  borderRadius: "var(--radius-sm)",
                  color: (item as any).danger ? "var(--error)" : "var(--text-secondary)",
                  cursor: "pointer", fontSize: 12, textAlign: "left", transition: "all 150ms",
                }}
                className="hover:bg-[var(--bg-hover)]">
                <Icon size={13} /> {item.label}
              </button>
            );
          })}
        </div>
      )}

      {/* ===== ADVANCED CREATOR MODALS ===== */}
      {showNewFolderModal && (
        <NewFolderModal
          onClose={() => setShowNewFolderModal(false)}
          onCreate={handleCreateFolder}
        />
      )}

      {showNewTagModal && (
        <NewTagModal
          onClose={() => setShowNewTagModal(false)}
          onCreate={handleCreateTag}
        />
      )}

      {/* ===== SWITCH NOTE CONFIRMATION ===== */}
      {switchTargetId && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 10001,
          background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <div style={{
            background: "linear-gradient(135deg, var(--bg-surface) 0%, var(--bg-base) 100%)",
            border: "1px solid var(--border-default)",
            borderRadius: "var(--radius-lg)", padding: 24, minWidth: 320, maxWidth: 400,
            boxShadow: "var(--shadow-elevated)",
          }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", margin: "0 0 8px", fontFamily: "var(--font-heading)" }}>
              ¿Cambiar de cuaderno?
            </h3>
            <p style={{ fontSize: 12.5, color: "var(--text-secondary)", margin: 0, lineHeight: 1.5 }}>
              ¿Quieres moverte a editar este cuaderno? Se guardarán los cambios actuales.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
              <button onClick={() => setSwitchTargetId(null)}
                className="btn-secondary"
                style={{
                  background: "none", border: "1px solid var(--border-default)", borderRadius: 6,
                  padding: "6px 14px", color: "var(--text-secondary)", fontSize: 12, cursor: "pointer",
                }}>Cancelar</button>
              <button onClick={() => { handleSaveNote(); handleSelectNote(switchTargetId); setSwitchTargetId(null); }}
                style={{
                  background: "var(--accent)", color: "#fff", border: "none", borderRadius: 6,
                  padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer",
                }}>Sí, cambiar</button>
            </div>
          </div>
        </div>
      )}

      {/* ===== DELETE CONFIRM MODAL ===== */}
      {showDeleteConfirm && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 10001,
          background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <div style={{
            background: "linear-gradient(135deg, var(--bg-surface) 0%, var(--bg-base) 100%)",
            border: "1px solid var(--border-default)",
            borderRadius: "var(--radius-lg)", padding: 24, minWidth: 320, maxWidth: 400,
            boxShadow: "var(--shadow-elevated)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <AlertTriangle size={18} style={{ color: "var(--error)", flexShrink: 0 }} />
              <h3 style={{ fontSize: 14.5, fontWeight: 600, color: "var(--text-primary)", margin: 0, fontFamily: "var(--font-heading)" }}>
                Eliminar cuaderno
              </h3>
            </div>
            <p style={{ fontSize: 12.5, color: "var(--text-secondary)", margin: 0, lineHeight: 1.5 }}>
              ¿Estás seguro de eliminar este cuaderno? Se eliminará permanentemente en 1 semana.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
              <button onClick={() => setShowDeleteConfirm(false)}
                className="btn-secondary"
                style={{
                  background: "none", border: "1px solid var(--border-default)", borderRadius: 6,
                  padding: "6px 14px", color: "var(--text-secondary)", fontSize: 12, cursor: "pointer",
                }}>Cancelar</button>
              <button onClick={handleDeleteNote}
                style={{
                  background: "var(--error)", color: "#fff", border: "none", borderRadius: 6,
                  padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer",
                }}>Eliminar</button>
            </div>
          </div>
        </div>
      )}

      {/* ===== MOVE FOLDER MODAL ===== */}
      {showMoveModal && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 10001,
          background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <div style={{
            background: "linear-gradient(135deg, var(--bg-surface) 0%, var(--bg-base) 100%)",
            border: "1px solid var(--border-default)",
            borderRadius: "var(--radius-lg)", padding: 24, minWidth: 320, maxWidth: 400,
            boxShadow: "var(--shadow-elevated)",
          }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", margin: "0 0 12px", fontFamily: "var(--font-heading)" }}>
              Mover a carpeta
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 240, overflow: "auto" }}>
              <button onClick={() => { handleMoveToFolder(undefined); }}
                style={{
                  display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "7px 10px",
                  background: "transparent", border: "none", borderRadius: 6,
                  color: "var(--text-secondary)", cursor: "pointer", fontSize: 12, textAlign: "left",
                }}
                className="hover:bg-[var(--bg-hover)]">
                <Layers size={14} /> Sin carpeta
              </button>
              {folders.map((f) => (
                <button key={f.id} onClick={() => { handleMoveToFolder(f.id); }}
                  style={{
                    display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "7px 10px",
                    background: "transparent", border: "none", borderRadius: 6,
                    color: "var(--text-secondary)", cursor: "pointer", fontSize: 12, textAlign: "left",
                  }}
                  className="hover:bg-[var(--bg-hover)]">
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: f.color }} /> {f.name}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
              <button onClick={() => setShowMoveModal(false)}
                className="btn-secondary"
                style={{
                  background: "none", border: "1px solid var(--border-default)", borderRadius: 6,
                  padding: "6px 14px", color: "var(--text-secondary)", fontSize: 12, cursor: "pointer",
                }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ====== SIDEBAR SUB-COMPONENT ====== */
interface LibrarySidebarProps {
  folders: NoteFolder[];
  notes: Note[];
  selectedFolderId: string | null;
  selectedTag: string | null;
  onSelectFolder: (id: string | null) => void;
  onSelectTag: (tag: string | null) => void;
  onNewFolder: () => void;
  onNewTag: () => void;
  activeSidebarTab: string;
  setActiveSidebarTab: (tab: string) => void;
}

function LibrarySidebar({
  folders, notes, selectedFolderId, selectedTag,
  onSelectFolder, onSelectTag, onNewFolder, onNewTag,
  activeSidebarTab, setActiveSidebarTab
}: LibrarySidebarProps) {
  const [showTagSection, setShowTagSection] = useState(true);

  // Retrieve custom tag colors from LocalStorage (persisted)
  const tagColors = useMemo(() => {
    try {
      const saved = localStorage.getItem("owa_custom_tag_colors");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  }, [selectedTag]);

  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    notes.forEach((n) => n.tags?.forEach((t) => tagSet.add(t)));
    return Array.from(tagSet);
  }, [notes]);

  const favoritesCount = useMemo(() => notes.filter(n => n.isPinned).length, [notes]);
  const recentCount = useMemo(() => {
    const cutoff = Date.now() - 3 * 24 * 60 * 60 * 1000;
    return notes.filter(n => new Date(n.updatedAt).getTime() > cutoff).length;
  }, [notes]);

const trashCount = notes.filter(n => n.deletedAt).length;

const listItems = [
    { id: "favs", label: "Favoritas", count: favoritesCount, icon: Star },
    { id: "trash", label: "Papelera", count: trashCount, icon: Trash2 },
];

  return (
    <div style={{
      width: 220, minWidth: 220, display: "flex", flexDirection: "column",
      padding: "20px 14px 14px 20px", overflow: "hidden",
      borderRight: "1px solid var(--border-subtle)",
      flex: 1, minHeight: 0,
    }}>
      <style dangerouslySetInnerHTML={{__html: `
        .sidebar-scroll-notas::-webkit-scrollbar { width: 4px; }
        .sidebar-scroll-notas::-webkit-scrollbar-thumb { background: var(--border-default); border-radius: 4px; }
        .sidebar-scroll-notas { scrollbar-width: thin; }
      `}} />
      <div className="sidebar-scroll-notas" style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {listItems.map((item) => {
            const isSel = activeSidebarTab === item.id;
            const Icon = item.icon;
            return (
              <button key={item.id}
                onClick={() => {
                  setActiveSidebarTab(item.id);
                  if (item.id === "favs") { onSelectFolder(null); onSelectTag(null); }
                }}
                style={{
                  display: "flex", alignItems: "center", gap: 10, width: "100%",
                  padding: "10px 12px",
                  background: isSel ? "linear-gradient(135deg, var(--accent-dim) 0%, transparent 100%)" : "transparent",
                  border: "none", borderRadius: "var(--radius-sm)",
                  color: isSel ? "var(--accent)" : "var(--text-secondary)",
                  cursor: "pointer", fontSize: 14, fontWeight: isSel ? 650 : 500,
                  textAlign: "left", transition: "all 150ms " + EASE,
                }}
                className="hover:bg-[var(--bg-hover)]">
                <Icon size={16} style={{ color: isSel ? "var(--accent)" : "var(--text-tertiary)" }} />
                {item.label}
                <span style={{
                  marginLeft: "auto", fontSize: 10, color: isSel ? "var(--accent)" : "var(--text-tertiary)",
                  background: isSel ? "var(--accent-soft)" : "var(--bg-hover)",
                  padding: "2px 7px", borderRadius: 6, fontWeight: 600,
                }}>{item.count}</span>
              </button>
            );
          })}
        </div>

        {/* CARPETAS */}
        <div>
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            marginBottom: 4, paddingLeft: 6,
          }}>
            <span style={{
              fontSize: 9, fontWeight: 750, color: "var(--text-muted)",
              textTransform: "uppercase", letterSpacing: "0.08em",
            }}>Carpetas</span>
            <button onClick={onNewFolder} title="Nueva carpeta"
              style={{
                width: 16, height: 16,
                display: "flex", alignItems: "center", justifyContent: "center",
                background: "none", border: "1px dashed var(--border-subtle)",
                borderRadius: 4, color: "var(--accent)", cursor: "pointer", padding: 0,
              }}
              className="hover:border-[var(--accent)] hover:bg-[var(--accent-dim)]">
              <Plus size={9} />
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
            {folders.map((f) => {
              const count = notes.filter((n) => n.folderId === f.id).length;
              const isSel = selectedFolderId === f.id;
              return (
                <button key={f.id} onClick={() => { setActiveSidebarTab("folder_" + f.id); onSelectFolder(selectedFolderId === f.id ? null : f.id); }}
                  style={{
                    display: "flex", alignItems: "center", gap: 8, width: "100%",
                    padding: "6px 10px",
                    background: isSel ? "linear-gradient(135deg, var(--accent-dim) 0%, transparent 100%)" : "transparent",
                    border: "none", borderRadius: "var(--radius-sm)",
                    color: isSel ? "var(--accent)" : "var(--text-secondary)",
                    cursor: "pointer", fontSize: 12.5, fontWeight: isSel ? 600 : 500,
                    textAlign: "left", transition: "all 150ms " + EASE,
                  }}
                  className="hover:bg-[var(--bg-hover)]">
                  <FolderIcon size={13} style={{ color: f.color, flexShrink: 0 }} />
                  <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
                  <span style={{
                    flexShrink: 0, fontSize: 9.5, color: isSel ? "var(--accent)" : "var(--text-tertiary)",
                    background: isSel ? "var(--accent-soft)" : "var(--bg-hover)",
                    padding: "0.5px 5px", borderRadius: 6, fontWeight: 600,
                  }}>{count}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ETIQUETAS */}
        <div>
          <div style={{
            display: "flex", alignItems: "center", gap: 6, marginBottom: 4, paddingLeft: 6,
          }}>
            <span style={{
              fontSize: 9, fontWeight: 750, color: "var(--text-muted)",
              textTransform: "uppercase", letterSpacing: "0.08em",
            }}>Etiquetas</span>
            <button onClick={onNewTag}
              title="Nueva etiqueta"
              style={{
                width: 16, height: 16,
                display: "flex", alignItems: "center", justifyContent: "center",
                background: "none", border: "1px dashed var(--border-subtle)",
                borderRadius: 4, color: "var(--accent)", cursor: "pointer", padding: 0,
              }}
              className="hover:border-[var(--accent)] hover:bg-[var(--accent-dim)]">
              <Plus size={9} />
            </button>
            <button onClick={() => setShowTagSection(!showTagSection)}
              style={{
                background: "none", border: "none", color: "var(--text-muted)",
                cursor: "pointer", padding: 0, display: "flex", marginLeft: "auto",
              }}>
              <ChevronDown size={12} style={{
                transform: showTagSection ? "rotate(0deg)" : "rotate(-90deg)",
                transition: "transform 250ms " + EASE,
              }} />
            </button>
          </div>
          {allTags.length > 0 && (
            <div style={{
              overflow: "hidden", maxHeight: showTagSection ? 10000 : 0,
              transition: "max-height 300ms " + EASE,
            }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 4 }}>
                {allTags.map((tag) => {
                  const count = notes.filter((n) => n.tags?.includes(tag)).length;
                  const dotColor = tagColors[tag] || DEFAULT_TAG_COLORS[tag] || "var(--accent)";
                  const isSel = selectedTag === tag;
                  return (
                    <button key={tag} onClick={() => { setActiveSidebarTab("tag_" + tag); onSelectTag(selectedTag === tag ? null : tag); }}
                      style={{
                        display: "flex", alignItems: "center", gap: 8, width: "100%",
                        padding: "6px 10px",
                        background: isSel ? "linear-gradient(135deg, var(--accent-dim) 0%, transparent 100%)" : "transparent",
                        border: "none", borderRadius: "var(--radius-sm)",
                        color: isSel ? "var(--accent)" : "var(--text-secondary)",
                        cursor: "pointer", fontSize: 12,
                        textAlign: "left", transition: "all 150ms " + EASE,
                      }}
                      className="hover:bg-[var(--bg-hover)]">
                      <Hash size={13} style={{ color: isSel ? dotColor : dotColor + "aa" }} />
                      <span style={{
                        flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        color: isSel ? dotColor : "var(--text-secondary)",
                        fontWeight: isSel ? 600 : 500,
                      }}>
                        {tag}
                      </span>
                      <span style={{
                        fontSize: 9.5, color: isSel ? "#fff" : "var(--text-tertiary)",
                        background: isSel ? dotColor : "var(--bg-hover)",
                        padding: "0.5px 5px", borderRadius: 6, fontWeight: 600,
                      }}>{count}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}