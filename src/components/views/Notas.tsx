import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Search, Plus, Folder as FolderIcon, Pin, Trash2, FileText, Download, X, Copy, Move,
  AlertTriangle, Check, Bold, Italic, Underline, List, Code, Link, Paperclip, StickyNote,
  Image as ImageIcon, Type,   BookOpen, Library, Star,
  Info, Clock, AlignJustify,
  ChevronDown, ChevronLeft, ChevronRight, MoreHorizontal,
  ListOrdered, Quote, Upload, Lock,
  History, Table, File,
  Layers, Edit3, FileOutput,
  Filter, SortAsc, Tag, Hash, Maximize2, Minimize2, CheckSquare, Palette, ArrowLeft, Unlink, Minus,
  Briefcase, GraduationCap, Compass, Target, Brain, Award, Coffee, Activity, Shield,
  Heart, Lightbulb, Zap, Globe, Feather, Sun, Moon, CloudRain, Mountain, Music,
  Camera, Eye, Flag, Gift, Anchor, Key, Rocket, Scissors, Watch, Wifi, ExternalLink,
  Strikethrough, AlignLeft, AlignCenter, AlignRight, Heading1, Heading2, Heading3,
  Eraser, Sigma,
  Album, Archive, Atom, Backpack, Banknote, Palmtree, Bell, Bike, Bone, Bot, Box, Brush, Bug, Building,
  Cake, Calculator, Calendar, Car, Castle, Cat, Clipboard, Cloud, Crown, Blocks,
  Database, Diamond, Disc,
  Egg, Film, Flower,
  Gamepad, Ghost, Gem, Guitar,
  Hammer, Headphones, Hexagon, Home,
  IceCreamBowl,
  Joystick,
  Keyboard,
  Lamp, Landmark, Laptop, Leaf, Loader,
  Magnet, Mail, Medal, Mic, Monitor,
  Navigation,
  Package, Paintbrush, PawPrint, Pen, Pencil, Phone, Pizza, Plane, Plug, Power, Printer, Puzzle,
  QrCode,
  Radar, Radio, Ribbon, Ruler,
  Salad, Satellite, Save, School, Server, Settings, Share, Shirt, ShoppingBag, Smartphone, Smile, Snowflake, Sofa, Sparkles, Sword,
  Tablet, Tags, Tent, Terminal, TestTube, Thermometer, ThumbsUp, Ticket, Timer, Trophy, Truck, Turtle, Tv,
  Umbrella, Undo, User, Users, Utensils,
  Verified, Video, Volume,
  Wallet, Wand, Waves, Webcam, Weight, Wine,
  ZoomIn, ZoomOut
} from "lucide-react";
import { useApp, Note, NoteFolder, NoteAttachment, fmtClock } from "../../store/AppContext";
import { openFileSmart } from '../../lib/openFileSmart';
import { createDownloadTask, updateDownloadTask, completeDownloadTask } from '../ui/DownloadManager';
import {
  DndContext, closestCenter,
  PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core';
import {
  SortableContext, useSortable, arrayMove,
  rectSortingStrategy, verticalListSortingStrategy
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { restrictToParentElement } from '@dnd-kit/modifiers';
import { format } from "date-fns";
import { es } from "date-fns/locale";
import toast from "react-hot-toast";
import NotificationBell from '../ui/NotificationBell';

type ViewMode = "estante" | "lista";
type SortMode = "updated" | "created" | "title" | "course" | "visits" | "priority" | "manual";

const EASE = "cubic-bezier(0.16, 1, 0.3, 1)";
const SPINE_COLORS = [
  "#E11D48", "#3B82F6", "#10B981", "#F59E0B", "#8B5CF6",
  "#EC4899", "#06B6D4", "#84CC16", "#F97316", "#6366F1",
  "#14B8A6", "#D946EF", "#0EA5E9", "#22C55E", "#EAB308",
];

const VERSION_MAX = 10;

type NoteVersion = { timestamp: string; preview: string; wordCount: number; content?: string };

/**
 * Guarda una versión de una nota en localStorage SIN reventar la cuota.
 * El bug original: `localStorage.setItem("owa_note_versions_" + id, …)` lanzaba
 * QuotaExceededError y rompía el guardado de la nota entera. Ahora, si la cuota
 * se excede, se poda progresivamente (se elimina el HTML de las versiones
 * antiguas y se reduce el número de versiones) hasta que quepa; si ni así, se
 * descarta el historial de esa nota (la nota en sí nunca se pierde).
 */
function saveNoteVersion(noteId: string, content: string): void {
  try {
    const plain = content.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\u00A0/g, " ").trim();
    if (!plain) return;
    const preview = plain.slice(0, 80);

    let versions: NoteVersion[] = [];
    try {
      const parsed = JSON.parse(localStorage.getItem("owa_note_versions_" + noteId) || "[]");
      if (Array.isArray(parsed)) versions = parsed;
    } catch {}

    if (versions.length && versions[0]?.preview === preview) return;

    versions.unshift({
      timestamp: new Date().toISOString(),
      preview,
      wordCount: plain.split(/\s+/).filter(Boolean).length,
      content,
    });
    if (versions.length > VERSION_MAX) versions.length = VERSION_MAX;

    const trySet = (arr: NoteVersion[]): boolean => {
      try {
        localStorage.setItem("owa_note_versions_" + noteId, JSON.stringify(arr));
        return true;
      } catch {
        return false;
      }
    };

    if (trySet(versions)) return;

    // 1) Quitar el HTML de las versiones antiguas (solo se conserva el texto).
    const slim = versions.map((v, i) => (i === 0 ? v : { timestamp: v.timestamp, preview: v.preview, wordCount: v.wordCount }));
    if (trySet(slim)) return;

    // 2) Reducir a las 3 más recientes.
    if (trySet(slim.slice(0, 3))) return;

    // 3) Barrido global: podar el historial de TODAS las notas.
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith("owa_note_versions_")) {
          try {
            const arr = JSON.parse(localStorage.getItem(key) || "[]");
            if (Array.isArray(arr)) {
              const pruned = arr.slice(0, 3).map((v: NoteVersion, idx: number) =>
                idx === 0 ? v : { timestamp: v.timestamp, preview: v.preview, wordCount: v.wordCount }
              );
              localStorage.setItem(key, JSON.stringify(pruned));
            }
          } catch {}
        }
      }
    } catch {}
    trySet(versions);
  } catch {
    // Nunca romper el guardado de la nota por culpa del historial.
  }
}

const AVAILABLE_ICONS: { name: string; icon: React.ComponentType<{ size?: number; color?: string; style?: React.CSSProperties }>; label: string }[] = [
  { name: "FileText", icon: FileText, label: "Documento" },
  { name: "BookOpen", icon: BookOpen, label: "Libro" },
  { name: "Code", icon: Code, label: "Código" },
  { name: "Star", icon: Star, label: "Estrella" },
  { name: "Heart", icon: Heart, label: "Corazón" },
  { name: "Target", icon: Target, label: "Objetivo" },
  { name: "Brain", icon: Brain, label: "Cerebro" },
  { name: "Lightbulb", icon: Lightbulb, label: "Idea" },
  { name: "Zap", icon: Zap, label: "Rayo" },
  { name: "Globe", icon: Globe, label: "Mundo" },
  { name: "Feather", icon: Feather, label: "Pluma" },
  { name: "Sun", icon: Sun, label: "Sol" },
  { name: "Moon", icon: Moon, label: "Luna" },
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
  { name: "Search", icon: Search, label: "Buscar" },
  { name: "Plus", icon: Plus, label: "Añadir" },
  { name: "Trash2", icon: Trash2, label: "Papelera" },
  { name: "Download", icon: Download, label: "Descargar" },
  { name: "Copy", icon: Copy, label: "Copiar" },
  { name: "Move", icon: Move, label: "Mover" },
  { name: "Check", icon: Check, label: "Verificar" },
  { name: "Link", icon: Link, label: "Enlace" },
  { name: "Paperclip", icon: Paperclip, label: "Clip" },
  { name: "Image", icon: ImageIcon, label: "Imagen" },
  { name: "Type", icon: Type, label: "Texto" },
  { name: "Library", icon: Library, label: "Librería" },
  { name: "Info", icon: Info, label: "Info" },
  { name: "Clock", icon: Clock, label: "Reloj" },
  { name: "Tag", icon: Tag, label: "Etiqueta" },
  { name: "Hash", icon: Hash, label: "Hashtag" },
  { name: "Lock", icon: Lock, label: "Candado" },
  { name: "History", icon: History, label: "Historial" },
  { name: "Table", icon: Table, label: "Tabla" },
  { name: "File", icon: File, label: "Archivo" },
  { name: "Layers", icon: Layers, label: "Capas" },
  { name: "Edit3", icon: Edit3, label: "Editar" },
  { name: "Filter", icon: Filter, label: "Filtro" },
  { name: "Palette", icon: Palette, label: "Paleta" },
  { name: "ArrowLeft", icon: ArrowLeft, label: "Flecha" },
  { name: "Minus", icon: Minus, label: "Menos" },
  { name: "Briefcase", icon: Briefcase, label: "Maletín" },
  { name: "GraduationCap", icon: GraduationCap, label: "Graduación" },
  { name: "Compass", icon: Compass, label: "Brújula" },
  { name: "Award", icon: Award, label: "Premio" },
  { name: "Coffee", icon: Coffee, label: "Café" },
  { name: "Activity", icon: Activity, label: "Actividad" },
  { name: "Shield", icon: Shield, label: "Escudo" },
  { name: "Mountain", icon: Mountain, label: "Montaña" },
  { name: "CloudRain", icon: CloudRain, label: "Lluvia" },
  { name: "ExternalLink", icon: ExternalLink, label: "Enlace" },
  { name: "Album", icon: Album, label: "Álbum" },
  { name: "Archive", icon: Archive, label: "Archivar" },
  { name: "Atom", icon: Atom, label: "Átomo" },
  { name: "Backpack", icon: Backpack, label: "Mochila" },
  { name: "Banknote", icon: Banknote, label: "Dinero" },
  { name: "Palmtree", icon: Palmtree, label: "Playa" },
  { name: "Bell", icon: Bell, label: "Campana" },
  { name: "Bike", icon: Bike, label: "Bici" },
  { name: "Bone", icon: Bone, label: "Hueso" },
  { name: "Bot", icon: Bot, label: "Bot" },
  { name: "Box", icon: Box, label: "Caja" },
  { name: "Brush", icon: Brush, label: "Pincel" },
  { name: "Bug", icon: Bug, label: "Bug" },
  { name: "Building", icon: Building, label: "Edificio" },
  { name: "Cake", icon: Cake, label: "Pastel" },
  { name: "Calculator", icon: Calculator, label: "Calculadora" },
  { name: "Calendar", icon: Calendar, label: "Calendario" },
  { name: "Car", icon: Car, label: "Carro" },
  { name: "Castle", icon: Castle, label: "Castillo" },
  { name: "Cat", icon: Cat, label: "Gato" },
  { name: "Clipboard", icon: Clipboard, label: "Portapapeles" },
  { name: "Cloud", icon: Cloud, label: "Nube" },
  { name: "Crown", icon: Crown, label: "Corona" },
  { name: "Blocks", icon: Blocks, label: "Cubo" },
  { name: "Database", icon: Database, label: "Base datos" },
  { name: "Diamond", icon: Diamond, label: "Diamante" },
  { name: "Disc", icon: Disc, label: "Disco" },
  { name: "Egg", icon: Egg, label: "Huevo" },
  { name: "Film", icon: Film, label: "Película" },
  { name: "Flower", icon: Flower, label: "Flor" },
  { name: "Gamepad", icon: Gamepad, label: "Gamepad" },
  { name: "Ghost", icon: Ghost, label: "Fantasma" },
  { name: "Gem", icon: Gem, label: "Gema" },
  { name: "Guitar", icon: Guitar, label: "Guitarra" },
  { name: "Hammer", icon: Hammer, label: "Martillo" },
  { name: "Headphones", icon: Headphones, label: "Audífonos" },
  { name: "Hexagon", icon: Hexagon, label: "Hexágono" },
  { name: "Home", icon: Home, label: "Inicio" },
  { name: "IceCreamBowl", icon: IceCreamBowl, label: "Helado" },
  { name: "Joystick", icon: Joystick, label: "Joystick" },
  { name: "Keyboard", icon: Keyboard, label: "Teclado" },
  { name: "Lamp", icon: Lamp, label: "Lámpara" },
  { name: "Landmark", icon: Landmark, label: "Monumento" },
  { name: "Laptop", icon: Laptop, label: "Portátil" },
  { name: "Leaf", icon: Leaf, label: "Hoja" },
  { name: "Loader", icon: Loader, label: "Cargando" },
  { name: "Magnet", icon: Magnet, label: "Imán" },
  { name: "Mail", icon: Mail, label: "Correo" },
  { name: "Medal", icon: Medal, label: "Medalla" },
  { name: "Mic", icon: Mic, label: "Micrófono" },
  { name: "Monitor", icon: Monitor, label: "Monitor" },
  { name: "Navigation", icon: Navigation, label: "Navegación" },
  { name: "Package", icon: Package, label: "Paquete" },
  { name: "Paintbrush", icon: Paintbrush, label: "Brocha" },
  { name: "PawPrint", icon: PawPrint, label: "Huella" },
  { name: "Pen", icon: Pen, label: "Pluma" },
  { name: "Pencil", icon: Pencil, label: "Lápiz" },
  { name: "Phone", icon: Phone, label: "Teléfono" },
  { name: "Pizza", icon: Pizza, label: "Pizza" },
  { name: "Plane", icon: Plane, label: "Avión" },
  { name: "Plug", icon: Plug, label: "Enchufe" },
  { name: "Power", icon: Power, label: "Encender" },
  { name: "Printer", icon: Printer, label: "Impresora" },
  { name: "Puzzle", icon: Puzzle, label: "Rompecabezas" },
  { name: "QrCode", icon: QrCode, label: "QR" },
  { name: "Radar", icon: Radar, label: "Radar" },
  { name: "Radio", icon: Radio, label: "Radio" },
  { name: "Ribbon", icon: Ribbon, label: "Cinta" },
  { name: "Ruler", icon: Ruler, label: "Regla" },
  { name: "Salad", icon: Salad, label: "Ensalada" },
  { name: "Satellite", icon: Satellite, label: "Satélite" },
  { name: "Save", icon: Save, label: "Guardar" },
  { name: "School", icon: School, label: "Escuela" },
  { name: "Server", icon: Server, label: "Servidor" },
  { name: "Settings", icon: Settings, label: "Ajustes" },
  { name: "Share", icon: Share, label: "Compartir" },
  { name: "Shirt", icon: Shirt, label: "Camiseta" },
  { name: "ShoppingBag", icon: ShoppingBag, label: "Bolsa" },
  { name: "Smartphone", icon: Smartphone, label: "Móvil" },
  { name: "Smile", icon: Smile, label: "Sonrisa" },
  { name: "Snowflake", icon: Snowflake, label: "Copo" },
  { name: "Sofa", icon: Sofa, label: "Sofá" },
  { name: "Sparkles", icon: Sparkles, label: "Brillo" },
  { name: "Sword", icon: Sword, label: "Espada" },
  { name: "Tablet", icon: Tablet, label: "Tableta" },
  { name: "Tags", icon: Tags, label: "Etiquetas" },
  { name: "Tent", icon: Tent, label: "Carpa" },
  { name: "Terminal", icon: Terminal, label: "Terminal" },
  { name: "TestTube", icon: TestTube, label: "Tubo" },
  { name: "Thermometer", icon: Thermometer, label: "Termómetro" },
  { name: "ThumbsUp", icon: ThumbsUp, label: "Me gusta" },
  { name: "Ticket", icon: Ticket, label: "Boleto" },
  { name: "Timer", icon: Timer, label: "Temporizador" },
  { name: "Trophy", icon: Trophy, label: "Trofeo" },
  { name: "Truck", icon: Truck, label: "Camión" },
  { name: "Turtle", icon: Turtle, label: "Tortuga" },
  { name: "Tv", icon: Tv, label: "TV" },
  { name: "Umbrella", icon: Umbrella, label: "Paraguas" },
  { name: "Undo", icon: Undo, label: "Deshacer" },
  { name: "User", icon: User, label: "Usuario" },
  { name: "Users", icon: Users, label: "Usuarios" },
  { name: "Utensils", icon: Utensils, label: "Cubiertos" },
  { name: "Verified", icon: Verified, label: "Verificado" },
  { name: "Video", icon: Video, label: "Video" },
  { name: "Volume", icon: Volume, label: "Volumen" },
  { name: "Wallet", icon: Wallet, label: "Cartera" },
  { name: "Wand", icon: Wand, label: "Varita" },
  { name: "Waves", icon: Waves, label: "Olas" },
  { name: "Webcam", icon: Webcam, label: "Webcam" },
  { name: "Weight", icon: Weight, label: "Peso" },
  { name: "Wine", icon: Wine, label: "Vino" },
  { name: "ZoomIn", icon: ZoomIn, label: "Acercar" },
  { name: "ZoomOut", icon: ZoomOut, label: "Alejar" },
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
  const text = html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\u00A0/g, ' ')
    .trim();
  if (!text) return 0;
  return text.split(/[\s\n\r]+/).filter(w => w.length > 0).length;
}

function getCharCount(html: string): number {
  return html.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, ' ').length;
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
  onContextMenu: (e: React.MouseEvent, btnRect?: DOMRect) => void;
  tagColors: Record<string, string>;
}

function NoteCard({ note, isSelected, onSelect, onOpen, onContextMenu, tagColors }: NoteCardProps) {
  const spineColor = note.coverColor || note.courseColor || getSpineColor(note.id);
  const folderName = note.course;
  const folderColor = note.coverColor || note.courseColor || spineColor;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging, isOver } = useSortable({ id: note.id });
  const preview = useMemo(() => {
    const text = note.content
      .replace(/<[^>]+>/g, "")
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
      .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d)).replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
      .trim();
    return text || "Sin contenido adicional en este cuaderno.";
  }, [note.content]);
  const [hov, setHov] = useState(false);
  const hasTags = note.tags && note.tags.length > 0;

  return (
    <div style={{ position: "relative", height: "100%", minWidth: 0 }}>
      <div
        ref={setNodeRef}
        {...attributes}
        {...listeners}
        onClick={onSelect}
        onDoubleClick={onOpen}
        onContextMenu={onContextMenu}
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}
        className="bento-card"
        style={{
          display: "flex", flexDirection: "column", gap: 0,
          padding: "16px 16px 12px", height: "100%",
          cursor: isDragging ? "grabbing" : "pointer",
          userSelect: "none", WebkitUserSelect: "none",
          background: "var(--bg-elevated)",
          border: isDragging
            ? "1px dashed " + spineColor + "88"
            : isOver
              ? "1px dashed var(--accent)"
              : "1px solid " + (isSelected ? spineColor + "40" : hov ? "var(--border-strong)" : "var(--border-subtle)"),
          borderRadius: "var(--radius-xl)",
          transition: isDragging ? "none" : transition ? transition : "all 250ms " + EASE,
          transform: isDragging ? CSS.Transform.toString(transform) : transform ? CSS.Transform.toString(transform) : hov ? "translateY(-2px)" : "none",
          opacity: isDragging ? 0.72 : 1,
          zIndex: isDragging ? 20 : isOver ? 15 : 'auto',
          boxShadow: isOver && !isDragging
            ? "0 0 0 2px var(--accent), 0 12px 28px rgba(0,0,0,0.12)"
            : hov
              ? "0 12px 28px rgba(0,0,0,0.10), 0 4px 12px rgba(0,0,0,0.06)"
              : "0 1px 3px rgba(0,0,0,0.04)",
          position: "relative", overflow: "hidden",
        }}
      >
        {isSelected && (
          <div style={{
            position: "absolute", bottom: 0, left: 0, right: 0, height: 3,
            background: "linear-gradient(90deg, " + spineColor + " 0%, " + spineColor + "cc 100%)",
            boxShadow: "0 0 16px " + spineColor + "50",
            zIndex: 2,
          }} />
        )}
        <div style={{
          position: "absolute", inset: 0, opacity: isSelected ? 0.04 : 0,
          background: "linear-gradient(180deg, " + spineColor + " 0%, transparent 60%)",
          transition: "opacity 250ms " + EASE,
          pointerEvents: "none",
        }} />
        {/* Top section: bigger icon + bigger title + 3-dot */}
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 8 }}>
          <div style={{
            width: 40, height: 40, borderRadius: "var(--radius-md)", flexShrink: 0,
            background: "linear-gradient(145deg, " + spineColor + "14, " + spineColor + "06)",
            display: "flex", alignItems: "center", justifyContent: "center",
            border: "1px solid " + spineColor + "16",
          }}>
            <NoteIconRenderer iconName={note.coverImage} color={spineColor} size={18} />
          </div>
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 1, justifyContent: "center", paddingTop: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{
                fontSize: 14, fontWeight: 550, color: "var(--text-primary)",
                fontFamily: "'Inter Tight', sans-serif",
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                letterSpacing: "-0.02em",
              }}>{note.title || "Sin título"}</span>
              {note.isPinned && <Star size={10} fill="#F59E0B" style={{ color: "#F59E0B", flexShrink: 0 }} />}
            </div>
            <span style={{ fontSize: 10, color: "var(--text-tertiary)", fontWeight: 450 }}>
              {formatTimeAgo(note.updatedAt)} · {folderName || "Sin carpeta"}
            </span>
          </div>
          <button onClick={(e) => { e.stopPropagation(); const br = e.currentTarget.getBoundingClientRect(); onContextMenu(e, br); }}
            style={{
              background: "transparent", border: "1px solid transparent",
              cursor: "pointer", color: "var(--text-tertiary)",
              padding: 3, display: "flex", borderRadius: 5, flexShrink: 0,
              transition: "all 150ms",
              marginTop: 0,
            }}
            className="hover:bg-[var(--bg-hover)] hover:text-[var(--text-secondary)] hover:border-[var(--border-default)]"
            title="Más opciones">
            <MoreHorizontal size={12} />
          </button>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: "var(--border-subtle)", opacity: 0.2, marginBottom: 6 }} />

        {/* Preview text — fixed 2 lines */}
        <div style={{
          fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.55,
          display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
          overflow: "hidden", opacity: 0.5,
          maxHeight: "3.4em", minHeight: "3.4em", flexShrink: 0,
        }}>{preview}</div>

        {/* Spacer to push footer down */}
        <div style={{ flex: 1, minHeight: 2 }} />

        {/* Footer area: tags row only (folder moved to header) */}
        {hasTags && (
          <div style={{ display: "flex", alignItems: "center", gap: 3, flexWrap: "wrap", minHeight: 18, paddingTop: 8, marginTop: "auto" }}>
            {note.tags!.slice(0, 3).map((t) => {
              const tc = tagColors[t] || DEFAULT_TAG_COLORS[t] || note.courseColor || getSpineColor(note.id);
              return (
                <span key={t} style={{
                  fontSize: 9, fontWeight: 650, color: tc,
                  background: tc + "0d", lineHeight: "18px",
                  padding: "0 7px", borderRadius: 4,
                  letterSpacing: "0.01em",
                }}>{t}</span>
              );
            })}
            {note.tags && note.tags.length > 3 && (
              <span style={{
                fontSize: 8.5, fontWeight: 600, color: "var(--text-tertiary)",
                lineHeight: "18px", padding: "0 6px", borderRadius: 4,
                background: "var(--bg-deep)",
              }}>+{note.tags.length - 3} más</span>
            )}
          </div>
        )}
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
  onContextMenu: (e: React.MouseEvent, btnRect?: DOMRect) => void;
}

function BookshelfBook({ note, isSelected, folders, onSelect, onDoubleClick, onContextMenu }: BookshelfBookProps) {
  const folderData = useMemo(() => folders.find(f => f.id === note.folderId), [folders, note.folderId]);
  const spineColor = note.coverColor || folderData?.color || note.courseColor || getSpineColor(note.id);
  const tagColor = (note.tags && note.tags.length > 0)
    ? (localStorage.getItem("owa_custom_tag_colors")
      ? (JSON.parse(localStorage.getItem("owa_custom_tag_colors") || "{}")[note.tags[0]] || DEFAULT_TAG_COLORS[note.tags[0]] || note.courseColor || getSpineColor(note.id))
      : (DEFAULT_TAG_COLORS[note.tags[0]] || note.courseColor || getSpineColor(note.id)))
    : null;
  const [hov, setHov] = useState(false);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging, isOver } = useSortable({ id: note.id });

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
    <div ref={setNodeRef} {...attributes} {...listeners} style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      position: "relative",
      cursor: isDragging ? "grabbing" : "pointer",
      userSelect: "none", WebkitUserSelect: "none",
      transform: isDragging ? CSS.Transform.toString(transform) : transform ? CSS.Transform.toString(transform) : hov ? "translateY(-5px)" : "translateY(0)",
      opacity: isDragging ? 0.7 : 1,
      transition: isDragging ? "none" : transition ? transition : "transform 250ms " + EASE + ", opacity 180ms " + EASE,
      width: 158,
      marginBottom: 0,
      zIndex: isDragging ? 30 : isOver ? 20 : hov ? 10 : 3,
    }}
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
        boxShadow: isOver && !isDragging
          ? `0 0 0 2px var(--accent), 0 10px 24px rgba(0,0,0,0.4)`
          : isSelected
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
            <button onClick={(e) => { e.stopPropagation(); const br = e.currentTarget.getBoundingClientRect(); onContextMenu(e, br); }}
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
  noteTitle?: string;
  onSelect: (iconName: string, color: string) => void;
  onClose: () => void;
}

function IconPicker({ currentIcon, currentColor, noteTitle, onSelect, onClose }: IconPickerProps) {
  const [selectedIcon, setSelectedIcon] = useState(currentIcon || "FileText");
  const [selectedColor, setSelectedColor] = useState(currentColor || SPINE_COLORS[0]);

  const IconForName = useCallback((name: string) => {
    const found = AVAILABLE_ICONS.find(i => i.name === name);
    return found ? found.icon : FileText;
  }, []);

  const SelIcon = IconForName(selectedIcon);

  return (
    <div className="bento-card" style={{
      width: 480,
      background: "var(--bg-elevated)", border: "1px solid var(--border-default)",
      borderRadius: 16, padding: 0,
      boxShadow: `0 20px 60px rgba(0,0,0,0.5)`,
      display: "flex", flexDirection: "column",
      animation: "fadeInDown 200ms ease-out",
      overflow: "hidden",
    }} onClick={e => e.stopPropagation()}>

      {/* Top: note preview card */}
      <div style={{
        padding: "14px 20px 12px",
        borderBottom: "1px solid var(--border-soft)",
        background: `linear-gradient(180deg, ${selectedColor}06 0%, transparent 100%)`,
      }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "8px 12px",
          borderRadius: 10,
          background: "var(--bg-surface)",
          border: "1px solid var(--border-subtle)",
          transition: "all 200ms ease",
        }}>
          <div style={{
            width: 34, height: 34, borderRadius: 9,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: `${selectedColor}15`,
            transition: "all 200ms ease",
          }}>
            <SelIcon size={17} style={{ color: selectedColor, transition: "all 200ms ease" }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 12, fontWeight: 600, color: "var(--text-primary)",
              letterSpacing: "-0.01em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {noteTitle || "Sin título"}
            </div>
            <div style={{ fontSize: 9, fontWeight: 500, color: "var(--text-tertiary)", marginTop: 1 }}>
              {AVAILABLE_ICONS.find(i => i.name === selectedIcon)?.label || selectedIcon}
            </div>
          </div>
        </div>
      </div>

      {/* Body: icons grid + color variants column on right */}
      <div style={{ display: "flex", height: 244 }}>
        {/* Icons grid — neutral / monochrome */}
        <div style={{
          flex: 1, overflowY: "auto",
          display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4,
          padding: "8px 12px",
        }}>
          {AVAILABLE_ICONS.map(i => {
            const Icon = i.icon;
            const isActive = i.name === selectedIcon;
            return (
              <button key={i.name}
                onClick={() => setSelectedIcon(i.name)}
                title={i.label}
                style={{
                  height: 34, borderRadius: 7,
                  border: isActive ? `1px solid ${selectedColor}50` : "1px solid transparent",
                  background: isActive ? `${selectedColor}12` : "transparent",
                  color: isActive ? selectedColor : "var(--text-tertiary)",
                  cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "all 100ms",
                }}
                onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = "var(--bg-hover)"; e.currentTarget.style.color = "var(--text-secondary)"; }}}
                onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-tertiary)"; }}}>
                <Icon size={14} />
              </button>
            );
          })}
        </div>

        {/* Color variants column — single vertical column on the right, shown when an icon is selected */}
        {selectedIcon && (
          <div style={{
            width: 50,
            borderLeft: "1px solid var(--border-soft)",
            overflowY: "auto", overflowX: "hidden",
            padding: "8px 4px",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 5,
          }}>
            {SPINE_COLORS.map(c => {
              const Icon = IconForName(selectedIcon);
              const isActive = selectedColor === c;
              return (
                <button key={c}
                  onClick={() => setSelectedColor(c)}
                  title={c}
                  style={{
                    width: 30, height: 30, borderRadius: 8,
                    border: isActive ? `2px solid ${c}` : "1px solid transparent",
                    background: isActive ? `${c}18` : "transparent",
                    color: c,
                    cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    outline: "none",
                    flexShrink: 0,
                    transition: "all 120ms ease",
                    transform: isActive ? "scale(1.1)" : "scale(1)",
                  }}
                  onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = `${c}10`; e.currentTarget.style.transform = "scale(1.08)"; }}}
                  onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.transform = "scale(1)"; }}}>
                  <Icon size={15} />
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ padding: "8px 12px", borderTop: "1px solid var(--border-soft)", display: "flex", justifyContent: "flex-end", gap: 6 }}>
        <button onClick={onClose} style={{
          padding: "6px 14px", borderRadius: 8, border: "1px solid var(--border-default)",
          background: "transparent", color: "var(--text-secondary)", fontSize: 12, fontWeight: 500,
          cursor: "pointer", transition: "all 150ms",
        }}
          onMouseEnter={e => { e.currentTarget.style.background = "var(--bg-hover)"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
        >Cancelar</button>
        <button onClick={() => { onSelect(selectedIcon, selectedColor); onClose(); }} style={{
          padding: "6px 18px", borderRadius: 8, border: "none",
          background: `linear-gradient(135deg, ${selectedColor}, ${selectedColor}cc)`,
          color: "#fff", fontSize: 12, fontWeight: 600,
          cursor: "pointer", boxShadow: `0 2px 8px ${selectedColor}30`,
          transition: "all 150ms",
        }}
          onMouseEnter={e => { e.currentTarget.style.filter = "brightness(1.1)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
          onMouseLeave={e => { e.currentTarget.style.filter = "none"; e.currentTarget.style.transform = "none"; }}
        >Seleccionar</button>
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

const TEXT_COLORS = [
  { name: "Por defecto", value: "var(--text-primary)" },
  { name: "Rojo", value: "#EF4444" },
  { name: "Naranja", value: "#F97316" },
  { name: "Amarillo", value: "#F59E0B" },
  { name: "Verde", value: "#10B981" },
  { name: "Azul", value: "#3B82F6" },
  { name: "Morado", value: "#8B5CF6" },
  { name: "Rosa", value: "#EC4899" },
];

const HIGHLIGHT_COLORS = [
  { name: "Transparente", value: "transparent" },
  { name: "Resaltado Rojo", value: "rgba(239, 68, 68, 0.25)" },
  { name: "Resaltado Naranja", value: "rgba(249, 115, 22, 0.25)" },
  { name: "Resaltado Amarillo", value: "rgba(245, 158, 11, 0.25)" },
  { name: "Resaltado Verde", value: "rgba(16, 185, 129, 0.25)" },
  { name: "Resaltado Azul", value: "rgba(59, 130, 246, 0.25)" },
  { name: "Resaltado Morado", value: "rgba(139, 92, 246, 0.25)" },
  { name: "Resaltado Rosa", value: "rgba(236, 72, 153, 0.25)" },
];

function EditorToolbar({ onFormat }: EditorToolbarProps) {
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const linkInputRef = useRef<HTMLInputElement>(null);

  const [showColorMenu, setShowColorMenu] = useState(false);
  const [showTablePicker, setShowTablePicker] = useState(false);
  const [tableRows, setTableRows] = useState(3);
  const [tableCols, setTableCols] = useState(3);
  const colorMenuRef = useRef<HTMLDivElement>(null);
  const tablePickerRef = useRef<HTMLDivElement>(null);

  const trackCmds = ["bold", "italic", "underline", "strikeThrough", "insertUnorderedList", "insertOrderedList"];
  const [activeFormats, setActiveFormats] = useState<Record<string, boolean>>({});
  const [activeHeading, setActiveHeading] = useState("p");
  useEffect(() => {
    const check = () => {
      try {
        const state: Record<string, boolean> = {};
        trackCmds.forEach(cmd => { state[cmd] = document.queryCommandState(cmd); });
        setActiveFormats(state);
        const block = document.queryCommandValue("formatBlock") || "p";
        setActiveHeading(block.replace(/[<>]/g, "").toLowerCase());
      } catch {}
    };
    document.addEventListener("selectionchange", check);
    document.addEventListener("keyup", check);
    document.addEventListener("mouseup", check);
    const id = setInterval(check, 300);
    check();
    return () => {
      document.removeEventListener("selectionchange", check);
      document.removeEventListener("keyup", check);
      document.removeEventListener("mouseup", check);
      clearInterval(id);
    };
  }, []);

  useEffect(() => {
    if (showLinkInput) linkInputRef.current?.focus();
  }, [showLinkInput]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (colorMenuRef.current && !colorMenuRef.current.contains(event.target as Node)) {
        setShowColorMenu(false);
      }
      if (tablePickerRef.current && !tablePickerRef.current.contains(event.target as Node)) {
        setShowTablePicker(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", position: "relative",
    }}>
      {/* 1. HEADINGS — icon cuadritos */}
      <div style={{ display: "flex", gap: 2, alignItems: "stretch" }}>
        {([
          { tag: "p", icon: Type, title: "Texto normal" },
          { tag: "h1", icon: Heading1, title: "Título 1" },
          { tag: "h2", icon: Heading2, title: "Título 2" },
          { tag: "h3", icon: Heading3, title: "Título 3" },
        ] as const).map(({ tag, icon: Icon, title }) => {
          const active = activeHeading === tag;
          return (
            <button key={tag} onClick={() => onFormat("formatBlock", `<${tag}>`)}
              title={title}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                width: 28, height: 26,
                borderRadius: 6, border: `1px solid ${active ? 'var(--accent)' : 'var(--border-default)'}`,
                background: active ? "var(--accent-dim)" : "transparent",
                color: active ? "var(--accent)" : "var(--text-tertiary)",
                cursor: "pointer", transition: "all 120ms",
              }}
              className={active ? "" : "hover:border-[var(--border-strong)] hover:text-[var(--text-secondary)]"}>
              <Icon size={13} />
            </button>
          );
        })}
      </div>

      <div style={{ width: 1, height: 16, background: "var(--border-default)", margin: "0 4px" }} />

      {/* 2. INLINE STYLING — only bold, italic, underline, strikethrough */}
      <button onClick={() => onFormat("bold")} title="Negrita (Ctrl+B)"
        style={{ width: 28, height: 28, borderRadius: 6, border: "none", background: activeFormats.bold ? "var(--accent-dim)" : "transparent", color: activeFormats.bold ? "var(--accent)" : "var(--text-secondary)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 150ms" }}
        className="hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]">
        <Bold size={14} />
      </button>
      <button onClick={() => onFormat("italic")} title="Cursiva (Ctrl+I)"
        style={{ width: 28, height: 28, borderRadius: 6, border: "none", background: activeFormats.italic ? "var(--accent-dim)" : "transparent", color: activeFormats.italic ? "var(--accent)" : "var(--text-secondary)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 150ms" }}
        className="hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]">
        <Italic size={14} />
      </button>
      <button onClick={() => onFormat("underline")} title="Subrayado (Ctrl+U)"
        style={{ width: 28, height: 28, borderRadius: 6, border: "none", background: activeFormats.underline ? "var(--accent-dim)" : "transparent", color: activeFormats.underline ? "var(--accent)" : "var(--text-secondary)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 150ms" }}
        className="hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]">
        <Underline size={14} />
      </button>
      <button onClick={() => onFormat("strikeThrough")} title="Tachado"
        style={{ width: 28, height: 28, borderRadius: 6, border: "none", background: activeFormats.strikeThrough ? "var(--accent-dim)" : "transparent", color: activeFormats.strikeThrough ? "var(--accent)" : "var(--text-secondary)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 150ms" }}
        className="hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]">
        <Strikethrough size={14} />
      </button>
      <button onClick={() => onFormat("hiliteColor")} title="Resaltar"
        style={{ width: 28, height: 28, borderRadius: 6, border: "none", background: "transparent", color: "var(--text-secondary)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 150ms", fontSize: 14, fontWeight: 700, lineHeight: 1 }}
        className="hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]">
        <span style={{ background: "linear-gradient(135deg, #FFF176, #FFD54F)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>A</span>
      </button>

      <div style={{ width: 1, height: 16, background: "var(--border-default)", margin: "0 4px" }} />

      {/* 3. LISTS + BLOCKS */}
      <button onClick={() => onFormat("insertUnorderedList")} title="Lista con viñetas"
        style={{ width: 28, height: 28, borderRadius: 6, border: "none", background: activeFormats.insertUnorderedList ? "var(--accent-dim)" : "transparent", color: activeFormats.insertUnorderedList ? "var(--accent)" : "var(--text-secondary)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 150ms" }}
        className="hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]">
        <List size={14} />
      </button>
      <button onClick={() => onFormat("insertOrderedList")} title="Lista numerada"
        style={{ width: 28, height: 28, borderRadius: 6, border: "none", background: activeFormats.insertOrderedList ? "var(--accent-dim)" : "transparent", color: activeFormats.insertOrderedList ? "var(--accent)" : "var(--text-secondary)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 150ms" }}
        className="hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]">
        <ListOrdered size={14} />
      </button>
      <button onClick={() => onFormat("codeBlock")} title="Bloque de código"
        style={{ width: 28, height: 28, borderRadius: 6, border: "none", background: "transparent", color: "var(--text-secondary)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 150ms" }}
        className="hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]">
        <Code size={14} />
      </button>
      <button onClick={() => onFormat("styledQuote")} title="Cita"
        style={{ width: 28, height: 28, borderRadius: 6, border: "none", background: "transparent", color: "var(--text-secondary)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 150ms" }}
        className="hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]">
        <Quote size={14} />
      </button>
      <button onClick={() => onFormat("insertHR")} title="Separador"
        style={{ width: 28, height: 28, borderRadius: 6, border: "none", background: "transparent", color: "var(--text-secondary)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 150ms" }}
        className="hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]">
        <Minus size={14} />
      </button>

      <div style={{ width: 1, height: 16, background: "var(--border-default)", margin: "0 4px" }} />

      {/* 4. ALIGNMENT */}
      <button onClick={() => onFormat("justifyLeft")} title="Alinear a la izquierda"
        style={{ width: 28, height: 28, borderRadius: 6, border: "none", background: "transparent", color: "var(--text-secondary)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 150ms" }}
        className="hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]">
        <AlignLeft size={14} />
      </button>
      <button onClick={() => onFormat("justifyCenter")} title="Centrar"
        style={{ width: 28, height: 28, borderRadius: 6, border: "none", background: "transparent", color: "var(--text-secondary)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 150ms" }}
        className="hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]">
        <AlignCenter size={14} />
      </button>
      <button onClick={() => onFormat("justifyRight")} title="Alinear a la derecha"
        style={{ width: 28, height: 28, borderRadius: 6, border: "none", background: "transparent", color: "var(--text-secondary)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 150ms" }}
        className="hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]">
        <AlignRight size={14} />
      </button>
      <button onClick={() => onFormat("justifyFull")} title="Justificar"
        style={{ width: 28, height: 28, borderRadius: 6, border: "none", background: "transparent", color: "var(--text-secondary)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 150ms" }}
        className="hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]">
        <AlignJustify size={14} />
      </button>

      {/* 5. LINKS & FILES */}
      <button onClick={() => { setShowLinkInput(true); setLinkUrl(""); }} title="Insertar enlace"
        style={{ width: 28, height: 28, borderRadius: 6, border: "none", background: "transparent", color: "var(--text-secondary)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 150ms" }}
        className="hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]">
        <Link size={14} />
      </button>
      <button onClick={() => onFormat("insertFile")} title="Adjuntar archivo"
        style={{ width: 28, height: 28, borderRadius: 6, border: "none", background: "transparent", color: "var(--text-secondary)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 150ms" }}
        className="hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]">
        <Paperclip size={14} />
      </button>
      <div ref={tablePickerRef} style={{ position: "relative" }}>
        <button onClick={() => setShowTablePicker(!showTablePicker)} title="Insertar tabla"
          style={{ width: 28, height: 28, borderRadius: 6, border: "none", background: "transparent", color: "var(--text-secondary)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 150ms" }}
          className="hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]">
          <Table size={14} />
        </button>
        {showTablePicker && (
          <div style={{
            position: "absolute", top: "100%", left: 0, marginTop: 6, zIndex: 300,
            background: "var(--bg-elevated)", border: "1px solid var(--border-strong)",
            borderRadius: "var(--radius-md)", padding: 14,
            boxShadow: "var(--shadow-elevated)", minWidth: 220,
          }}>
            <div style={{
              display: "grid", gridTemplateColumns: `repeat(${Math.max(tableCols, 1)}, 1fr)`, gap: 3, marginBottom: 10,
              background: "var(--bg-base)", padding: 8, borderRadius: 8,
            }}>
              {Array.from({ length: Math.max(tableCols * tableRows, 1) }).map((_, i) => (
                <div key={i} style={{
                  width: 20, height: 16, borderRadius: 3,
                  background: "var(--accent)", opacity: 0.25, border: "1px solid var(--accent)",
                  transition: "all 100ms",
                }}
                  onMouseEnter={e => { e.currentTarget.style.opacity = '0.6'; e.currentTarget.style.transform = 'scale(1.1)'; }}
                  onMouseLeave={e => { e.currentTarget.style.opacity = '0.25'; e.currentTarget.style.transform = 'scale(1)'; }} />
              ))}
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", minWidth: 50, textAlign: "center" }}>{tableCols} × {tableRows}</span>
              <div style={{ display: "flex", gap: 4 }}>
                <button onClick={() => { setTableCols(Math.max(1, tableCols - 1)); }}
                  style={{ width: 22, height: 22, borderRadius: 4, border: "1px solid var(--border-soft)", background: "var(--bg-hover)", color: "var(--text-secondary)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, lineHeight: 1 }}>−</button>
                <button onClick={() => { setTableRows(Math.max(1, tableRows - 1)); }}
                  style={{ width: 22, height: 22, borderRadius: 4, border: "1px solid var(--border-soft)", background: "var(--bg-hover)", color: "var(--text-secondary)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, lineHeight: 1 }}>−</button>
                <button onClick={() => { setTableCols(Math.min(8, tableCols + 1)); }}
                  style={{ width: 22, height: 22, borderRadius: 4, border: "1px solid var(--border-soft)", background: "var(--bg-hover)", color: "var(--text-secondary)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, lineHeight: 1 }}>+</button>
                <button onClick={() => { setTableRows(Math.min(10, tableRows + 1)); }}
                  style={{ width: 22, height: 22, borderRadius: 4, border: "1px solid var(--border-soft)", background: "var(--bg-hover)", color: "var(--text-secondary)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, lineHeight: 1 }}>+</button>
              </div>
            </div>
            <button onClick={() => { onFormat("insertTable", `${tableCols}x${tableRows}`); setShowTablePicker(false); }}
              style={{
                width: "100%", background: "var(--accent)", color: "#fff", border: "none",
                borderRadius: 8, padding: "7px 12px", fontSize: 11.5, fontWeight: 600, cursor: "pointer",
                transition: "all 120ms",
              }}
              className="active:scale-[0.97]">Insertar tabla {tableCols}×{tableRows}</button>
          </div>
        )}
      </div>

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
  const { notes, noteFolders: folders, addNote, updateNote, updateNoteVisual, deleteNote, restoreNote, permanentlyDeleteNote, addNoteFolder, duplicateNote, reorderNotes, settings } = useApp();

  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(() => {
    try { const s = localStorage.getItem("owa_notes_folder_id"); return s || null; } catch { return null; }
  });
  const [selectedTag, setSelectedTag] = useState<string | null>(() => {
    try { const s = localStorage.getItem("owa_notes_tag"); return s || null; } catch { return null; }
  });
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    try { const s = localStorage.getItem("owa_notes_view_mode"); return (s === "lista" || s === "estante") ? s : "estante"; } catch { return "estante"; }
  });
  const [sortMode, setSortMode] = useState<SortMode>(() => {
    try {
      const s = localStorage.getItem("owa_notes_sortmode_v1");
      if (s === "updated" || s === "created" || s === "title" || s === "course" || s === "visits" || s === "priority" || s === "manual") return s;
    } catch { /* noop */ }
    return "updated";
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; noteId: string; arrowLeft: boolean; arrowY: number; arrowTop?: boolean; arrowBottom?: boolean } | null>(null);
  
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [showNewTagModal, setShowNewTagModal] = useState(false);
  const [deleteConfirmNoteId, setDeleteConfirmNoteId] = useState<string | null>(null);
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [trashSelectedIds, setTrashSelectedIds] = useState<Set<string>>(new Set());
  const [switchTargetId, setSwitchTargetId] = useState<string | null>(null);
  const [drawerTab, setDrawerTab] = useState<"contenido" | "informacion" | "historial">("contenido");
  const [linkPreviewUrl, setLinkPreviewUrl] = useState<string | null>(null);
  const [linkPreviewError, setLinkPreviewError] = useState(false);
  const [previewFile, setPreviewFile] = useState<{ url: string; name: string; type: string } | null>(null);
  const [lightboxImage, setLightboxImage] = useState<{ src: string; el: HTMLElement } | null>(null);
  const [pendingLink, setPendingLink] = useState<string | null>(null);

  // EDIT STATE
  const [isEditing, setIsEditing] = useState(false);
  const [showDetailsPanel, setShowDetailsPanel] = useState(true);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "pending">("saved");

  // Consume focused note from Inicio (click "Ver" on a note card) — opens it in the lateral drawer
  useEffect(() => {
    const focused = localStorage.getItem('owa_focused_note_id');
    if (focused) {
      setSelectedNoteId(focused);
      setShowDetailsPanel(true);
      setDrawerTab('contenido');
      setIsEditing(false);
      localStorage.removeItem('owa_focused_note_id');
    }
  }, []);
  // Persist sortMode (incl. "manual") so the arranged order survives reloads
  useEffect(() => {
    try { localStorage.setItem("owa_notes_sortmode_v1", sortMode); } catch { /* noop */ }
  }, [sortMode]);

  const [slashMenuPos, setSlashMenuPos] = useState<{ x: number; y: number } | null>(null);
  const [slashFilter, setSlashFilter] = useState("");
  const slashMenuRef = useRef<HTMLDivElement>(null);
  const slashRangeRef = useRef<Range | null>(null);
  const slashFilterInputRef = useRef<HTMLInputElement>(null);
  type SlashOpt = { label: string; icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>; cmd: string; value?: string };
  const buildSlashItems = useCallback((): { cat: string; opts: SlashOpt[] }[] => [
    { cat: "Texto", opts: [
      { label: "Texto normal", icon: Type, cmd: "formatBlock", value: "<p>" },
      { label: "Título grande", icon: Heading1, cmd: "formatBlock", value: "<h1>" },
      { label: "Título mediano", icon: Heading2, cmd: "formatBlock", value: "<h2>" },
      { label: "Título pequeño", icon: Heading3, cmd: "formatBlock", value: "<h3>" },
    ]},
    { cat: "Listas", opts: [
      { label: "Lista con viñetas", icon: List, cmd: "insertUnorderedList" },
      { label: "Lista numerada", icon: ListOrdered, cmd: "insertOrderedList" },
      { label: "Lista de tareas", icon: CheckSquare, cmd: "insertCheckbox" },
    ]},
    { cat: "Bloques", opts: [
      { label: "Bloque de código", icon: Code, cmd: "codeBlock" },
      { label: "Cita destacada", icon: Quote, cmd: "styledQuote" },
      { label: "Destacado (Callout)", icon: Lightbulb, cmd: "calloutBlock" },
      { label: "Fórmula matemática", icon: Sigma, cmd: "mathBlock" },
      { label: "Fórmula inline", icon: Sigma, cmd: "mathInline" },
      { label: "Separador", icon: Minus, cmd: "insertHR" },
    ]},
    { cat: "Elementos", opts: [
      { label: "Tabla", icon: Table, cmd: "insertTable" },
      { label: "Adjuntar archivo", icon: Paperclip, cmd: "insertFile" },
    ]}
  ], []);

  const cleanUpSlashText = useCallback(() => {
    const stored = slashRangeRef.current;
    if (!stored) return;
    try {
      const node = stored.startContainer;
      if (node.nodeType === Node.TEXT_NODE && node.textContent) {
        const start = stored.startOffset - 1;
        const end = stored.startOffset + slashFilter.length;
        if (start >= 0 && end <= node.textContent.length) {
          node.textContent = node.textContent.substring(0, start) + node.textContent.substring(end);
          const range = document.createRange();
          range.setStart(node, start);
          range.collapse(true);
          const sel = window.getSelection();
          if (sel) { sel.removeAllRanges(); sel.addRange(range); }
        }
      }
      slashRangeRef.current = null;
    } catch {}
  }, [slashFilter]);

  useEffect(() => {
    const mql = window.matchMedia('(max-width: 800px)');
    const handler = (e: MediaQueryListEvent | MediaQueryList) => {
      if (e.matches) setShowDetailsPanel(false);
    };
    mql.addEventListener('change', handler);
    handler(mql);
    return () => mql.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setLightboxImage(null);
        setLinkPreviewUrl(null);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // Expanded View Drawer state
  const [isMaximized, setIsMaximized] = useState(false);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [iconPickerTarget, setIconPickerTarget] = useState<string | null>(null);

  // Library views navigation
  const [activeSidebarTab, setActiveSidebarTab] = useState("all");

  const [bookshelfPage, setBookshelfPage] = useState(0);
  const [bookshelfDir, setBookshelfDir] = useState<1 | -1>(1);
  const [showShelfArrows, setShowShelfArrows] = useState(false);
  const [editFolderId, setEditFolderId] = useState<string | null>(null);
  const [editFolderName, setEditFolderName] = useState("");
  const [editFolderColor, setEditFolderColor] = useState("");
  const [tagColorEdit, setTagColorEdit] = useState<string | null>(null);
  const [editTagName, setEditTagName] = useState("");
  const [deleteFolderId, setDeleteFolderId] = useState<string | null>(null);
  const [deleteFolderName, setDeleteFolderName] = useState("");
  const [deletedFolderIds, setDeletedFolderIds] = useState<Set<string>>(() => {
    try { const s = localStorage.getItem("owa_deleted_folder_ids"); return s ? new Set(JSON.parse(s)) : new Set(); } catch { return new Set(); }
  });

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

  useEffect(() => {
    localStorage.setItem("owa_deleted_folder_ids", JSON.stringify([...deletedFolderIds]));
  }, [deletedFolderIds]);

  useEffect(() => { localStorage.setItem("owa_notes_folder_id", selectedFolderId || ""); }, [selectedFolderId]);
  useEffect(() => { localStorage.setItem("owa_notes_tag", selectedTag || ""); }, [selectedTag]);
  useEffect(() => { localStorage.setItem("owa_notes_view_mode", viewMode); }, [viewMode]);

  // Clock time state (Compact aligned inside header)
  const [ct, setCt] = useState(new Date());

  const editorRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Real-time clock tick
  useEffect(() => {
    const interval = setInterval(() => setCt(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const timeStr = fmtClock(format(ct, "HH:mm"), settings?.timeFormat);
  const secondsStr = settings?.timeFormat === '12h' ? null : format(ct, 'ss');
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
    // Sidebar view filters
    let result: typeof notes;
    if (activeSidebarTab === "trash") {
      // Trash shows ALL deleted notes, including course-private
      result = notes.filter(n => n.deletedAt);
    } else {
      // All other views exclude course-private and non-deleted notes
      result = notes.filter(n => !n.isCoursePrivate && !n.deletedAt);
    }

    if (activeSidebarTab === "favs") {
      result = result.filter(n => n.isPinned);
    } else if (activeSidebarTab === "recents") {
      const cutoff = Date.now() - 3 * 24 * 60 * 60 * 1000;
      result = result.filter(n => new Date(n.updatedAt).getTime() > cutoff);
    }

    if (selectedFolderId) {
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
      if (activeSidebarTab === 'favs' && a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
      if (sortMode === "manual") {
        const sa = a.sortOrder ?? Number.MAX_SAFE_INTEGER;
        const sb = b.sortOrder ?? Number.MAX_SAFE_INTEGER;
        return sa - sb;
      }
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

  const totalPagesBS = useMemo(() => {
    if (viewMode !== "estante") return 1;
    const PER_PAGE_BS = 10;
    return Math.max(1, Math.ceil(filteredNotes.length / PER_PAGE_BS));
  }, [filteredNotes.length, viewMode]);

  const handleCreateNote = useCallback(() => {
    const id = addNote({
      title: "", content: "", subtitle: "",
      folderId: selectedFolderId || undefined,
      courseColor: currentFolder?.color || "#8B5CF6",
      isPinned: false, course: currentFolder?.name || "Sin curso", tags: [],
    });
    setSelectedNoteId(id);
    setDrawerTab("contenido");
    setIsEditing(true);
    setTimeout(() => titleRef.current?.focus(), 100);
  }, [addNote, selectedFolderId, currentFolder]);

  // contentEditable caret jumping fix: populate DOM only ONCE when note changes
  useEffect(() => {
    if (isEditing && selectedNote && editorRef.current) {
      if (editorRef.current.innerHTML !== selectedNote.content) {
        editorRef.current.innerHTML = selectedNote.content || "";
        editorRef.current.querySelectorAll('a').forEach(a => {
          const href = a.getAttribute('href');
          if (href && href !== a.getAttribute('title')) {
            a.setAttribute('title', href);
          }
        });
      }
    }
  }, [selectedNoteId, isEditing]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (slashMenuRef.current && !slashMenuRef.current.contains(event.target as Node)) {
        setSlashMenuPos(null);
        setSlashFilter("");
        cleanUpSlashText();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [cleanUpSlashText]);

  const lastContentRef = useRef("");
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

    const plain = content.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\u00A0/g, " ").trim();
    if (plain !== lastContentRef.current && plain) {
      lastContentRef.current = plain;
      saveNoteVersion(selectedNote.id, content);
    }

    updateNote(selectedNote.id, { content, title, subtitle: plain.slice(0, 150) });
    setSaveStatus("saved");
  }, [selectedNote, updateNote]);

  const handleSelectNote = useCallback((noteId: string) => {
    setSelectedNoteId(noteId);
  }, []);

  const openFloatingNote = useCallback(async (note: Note) => {
  }, []);

  const handleOpenNote = useCallback(() => {
    if (selectedNote) {
      setIsEditing(true);
    }
  }, [selectedNote]);

  const handleDeleteNote = useCallback(() => {
    const id = deleteConfirmNoteId;
    if (!id) return;
    deleteNote(id);
    if (selectedNoteId === id) {
      setSelectedNoteId(null);
      setIsEditing(false);
    }
    setContextMenu(null);
    setDeleteConfirmNoteId(null);
    toast.success("Movido a la papelera");
  }, [deleteConfirmNoteId, selectedNoteId, deleteNote]);

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

  const toggleTrashSelect = useCallback((id: string) => {
    setTrashSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const handleBatchRestore = useCallback(() => {
    if (trashSelectedIds.size === 0) return;
    trashSelectedIds.forEach(id => restoreNote(id));
    const count = trashSelectedIds.size;
    setTrashSelectedIds(new Set());
    toast.success(`${count} nota${count !== 1 ? "s" : ""} restaurada${count !== 1 ? "s" : ""}`);
  }, [trashSelectedIds, restoreNote]);

  const handleBatchDelete = useCallback(() => {
    if (trashSelectedIds.size === 0) return;
    trashSelectedIds.forEach(id => {
      permanentlyDeleteNote(id);
      if (selectedNoteId === id) {
        setSelectedNoteId(null);
        setIsEditing(false);
      }
    });
    const count = trashSelectedIds.size;
    setTrashSelectedIds(new Set());
    toast.success(`${count} nota${count !== 1 ? "s" : ""} eliminada${count !== 1 ? "s" : ""} permanentemente`);
  }, [trashSelectedIds, permanentlyDeleteNote, selectedNoteId]);

  const handleSelectAllTrash = useCallback((allIds: string[]) => {
    setTrashSelectedIds(prev => {
      if (prev.size === allIds.length) return new Set();
      return new Set(allIds);
    });
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent, noteId: string, btnRect?: DOMRect) => {
    e.preventDefault(); e.stopPropagation();
    const menuW = 180, menuH = 184;
    if (btnRect) {
      const x = Math.max(8, btnRect.right - menuW - 140);
      let y = btnRect.bottom + 4;
      let arrowBottom = false;
      if (y + menuH > window.innerHeight - 4) {
        y = btnRect.top - menuH - 4;
        arrowBottom = true;
        if (y < 4) {
          y = Math.max(4, window.innerHeight - menuH - 4);
        }
      }
      const arrowY = Math.max(6, Math.min(menuW - 6, btnRect.left + btnRect.width / 2 - x));
      setContextMenu({ x, y, noteId, arrowLeft: false, arrowY, arrowTop: !arrowBottom, arrowBottom });
    } else {
      const cx = e.clientX, cy = e.clientY;
      let x: number, arrowLeft: boolean;
      if (cx + menuW <= window.innerWidth - 8) {
        x = cx; arrowLeft = false;
      } else {
        x = Math.max(8, cx - menuW); arrowLeft = true;
      }
      const y = Math.max(4, Math.min(cy - Math.round(menuH / 2), window.innerHeight - menuH - 4));
      const arrowY = Math.max(10, Math.min(menuH - 16, cy - y));
      setContextMenu({ x, y, noteId, arrowLeft, arrowY });
    }
  }, []);

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleEditorInput = useCallback(() => {
    setSaveStatus("pending");
    if (editorRef.current && selectedNote) {
      const html = editorRef.current.innerHTML;
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        updateNote(selectedNote.id, { content: html });
      }, 600);
    }
  }, [selectedNote, updateNote]);

  const handleFormat = useCallback((cmd: string, value?: string) => {
    if (cmd === "codeBlock") {
      const sel = window.getSelection();
      if (!sel || !sel.rangeCount) { editorRef.current?.focus(); return; }
      const range = sel.getRangeAt(0);
      let el: HTMLElement | null = range.startContainer.parentElement;
      let inCodeBlock = false;
      while (el && el !== editorRef.current) {
        if (el.classList.contains("notes-code-block")) { inCodeBlock = true; break; }
        el = el.parentElement;
      }
      if (inCodeBlock) {
        const text = el!.querySelector("code")?.textContent || "";
        const p = document.createElement("p");
        p.textContent = text;
        el!.parentNode?.replaceChild(p, el!);
        const newRange = document.createRange();
        newRange.selectNodeContents(p);
        newRange.collapse(false);
        sel.removeAllRanges();
        sel.addRange(newRange);
      } else {
        const text = sel.toString();
        const html = `<pre class="notes-code-block"><code>${text || "Código"}</code><button class="copy-code-btn" data-code="${encodeURIComponent(text || "")}">Copiar</button></pre>`;
        document.execCommand("insertHTML", false, html);
      }
    } else if (cmd === "insertTable") {
      const dims = value ? value.split("x").map(Number) : [3, 3];
      const cols = dims[0] || 3;
      const rows = dims[1] || 3;
      let thead = "<thead><tr>";
      for (let c = 1; c <= cols; c++) thead += `<th style="border:1px solid var(--border-default);padding:8px;background:var(--bg-hover);font-weight:600;">Columna ${c}</th>`;
      thead += "</tr></thead>";
      let tbody = "<tbody>";
      for (let r = 1; r <= rows; r++) {
        tbody += "<tr>";
        for (let c = 1; c <= cols; c++) tbody += `<td style="border:1px solid var(--border-default);padding:8px;">Dato ${r}-${c}</td>`;
        tbody += "</tr>";
      }
      tbody += "</tbody>";
      const html = `<table class="notes-table" style="width:100%;border-collapse:collapse;margin:8px 0;">${thead}${tbody}</table><br>`;
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
    } else if (cmd === "mathInline") {
      const formula = prompt("Ingresa la fórmula matemática inline (LaTeX):", "E=mc^2");
      if (formula) {
        document.execCommand("insertHTML", false, `$${formula}$`);
      }
    } else if (cmd === "mathBlock") {
      const formula = prompt("Ingresa la fórmula en bloque (LaTeX):", "\\int_{a}^{b} f(x)\\,dx = F(b) - F(a)");
      if (formula) {
        document.execCommand("insertHTML", false, `$$${formula}$$`);
      }
    } else if (cmd === "calloutBlock") {
      const text = prompt("Ingresa el texto para el bloque destacado (Callout):", "Nota importante...");
      if (text) {
        const html = `<div class="notes-callout" style="display:flex;gap:12px;padding:12px 16px;background:var(--bg-elevated);border-left:4px solid var(--accent);border-radius:8px;margin:12px 0;color:var(--text-secondary);align-items:center;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Z"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg><div style="flex:1;font-size:14px;line-height:1.5;">${text}</div></div><br>`;
        document.execCommand("insertHTML", false, html);
      }
    } else if (cmd === "insertHR") {
      document.execCommand("insertHTML", false, "<hr style='border:none;border-top:1px solid var(--border-default);margin:16px 0;' />");
    } else if (cmd === "formatBlock") {
      const sel = window.getSelection();
      if (sel && sel.rangeCount) {
        let el: HTMLElement | null = sel.getRangeAt(0).startContainer.parentElement;
        while (el && el !== editorRef.current && el.tagName !== "P" && el.tagName !== "H1" && el.tagName !== "H2" && el.tagName !== "H3" && el.tagName !== "H4" && el.tagName !== "BLOCKQUOTE" && el.tagName !== "PRE" && el.tagName !== "LI") {
          el = el.parentElement;
        }
        if (el && el !== editorRef.current && el.tagName.toLowerCase() === (value || "").replace(/[<>]/g, "")) {
          document.execCommand("formatBlock", false, "<p>");
        } else {
          document.execCommand("formatBlock", false, value || "<p>");
        }
      } else {
        document.execCommand("formatBlock", false, value || "<p>");
      }
    } else if (cmd === "createLink" && value) {
      document.execCommand("createLink", false, value);
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const a = sel.getRangeAt(0).startContainer.parentElement?.closest('a');
        if (a) a.setAttribute('title', value);
      }
    } else if (cmd === "hiliteColor") {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        const parent = range.startContainer.parentElement;
        const highlightSpan = parent?.closest('span[style*="background"]') || parent?.closest('span[style*="background-color"]');
        if (highlightSpan) {
          const text = highlightSpan.textContent || '';
          const p = highlightSpan.parentNode;
          if (p) {
            const textNode = document.createTextNode(text);
            p.replaceChild(textNode, highlightSpan);
            const newRange = document.createRange();
            newRange.selectNodeContents(textNode);
            newRange.collapse(false);
            sel.removeAllRanges();
            sel.addRange(newRange);
          }
        } else {
          document.execCommand("hiliteColor", false, "#FFF9C4");
          if (sel.rangeCount > 0) {
            const a = (sel.getRangeAt(0).startContainer.parentElement?.closest('span[style*="background"]') || sel.getRangeAt(0).startContainer.parentElement?.closest('span[style*="background-color"]')) as HTMLElement | null;
            if (a && a.style.backgroundColor) {
              a.style.backgroundColor = '#FFF9C4';
              a.style.borderRadius = '3px';
              a.style.padding = '1px 2px';
            }
          }
        }
      }
    } else {
      document.execCommand(cmd, false, value);
    }
    editorRef.current?.focus();
    setSaveStatus("pending");
    if (editorRef.current && selectedNote) {
      updateNote(selectedNote.id, { content: editorRef.current.innerHTML });
    }
  }, [selectedNote, updateNote]);

  const handleEditorKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    // 1. Tab indentation / outdentation
    if (e.key === "Tab") {
      e.preventDefault();
      let insideList = false;
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        let parent = sel.getRangeAt(0).startContainer.parentElement;
        while (parent && parent !== editorRef.current) {
          if (parent.tagName === "LI" || parent.tagName === "UL" || parent.tagName === "OL") {
            insideList = true;
            break;
          }
          parent = parent.parentElement;
        }
      }
      
      if (insideList) {
        if (e.shiftKey) {
          document.execCommand("outdent", false);
        } else {
          document.execCommand("indent", false);
        }
      } else {
        document.execCommand("insertHTML", false, "&nbsp;&nbsp;&nbsp;&nbsp;");
      }
      setSaveStatus("pending");
      return;
    }

    // 1a. Format keys (Ctrl + B, Ctrl + I, Ctrl + U, Ctrl + K, Ctrl + E, Ctrl + D)
    if (e.ctrlKey || e.metaKey) {
      const key = e.key.toLowerCase();
      if (key === 'b') {
        e.preventDefault();
        handleFormat("bold");
        return;
      }
      if (key === 'i') {
        e.preventDefault();
        handleFormat("italic");
        return;
      }
      if (key === 'u') {
        e.preventDefault();
        handleFormat("underline");
        return;
      }
      if (key === 'k') {
        e.preventDefault();
        const sel = window.getSelection();
        if (sel && sel.toString()) {
          const url = prompt("Ingresa la URL del enlace:", "https://");
          if (url) {
            document.execCommand("createLink", false, url);
            const s = window.getSelection();
            if (s && s.rangeCount > 0) {
              const a = s.getRangeAt(0).startContainer.parentElement?.closest('a');
              if (a) a.setAttribute('title', url);
            }
            setSaveStatus("pending");
            if (editorRef.current && selectedNote) {
              updateNote(selectedNote.id, { content: editorRef.current.innerHTML });
            }
          }
        }
        return;
      }
      if (key === 'e') {
        e.preventDefault();
        const sel = window.getSelection();
        if (sel && sel.toString()) {
          document.execCommand("insertHTML", false, `<code style="background:var(--bg-elevated);padding:2px 6px;border-radius:4px;font-family:'JetBrains Mono',monospace;font-size:0.9em;color:var(--accent);">${sel.toString()}</code>`);
          setSaveStatus("pending");
          if (editorRef.current && selectedNote) {
            updateNote(selectedNote.id, { content: editorRef.current.innerHTML });
          }
        } else {
          handleFormat("codeBlock");
        }
        return;
      }
      if (key === 'd' || (e.shiftKey && key === 'x')) {
        e.preventDefault();
        handleFormat("strikeThrough");
        return;
      }
    }

    // 1b. / Slash command trigger — insert "/" and show menu
    if (e.key === "/" && !e.ctrlKey && !e.metaKey && !slashMenuPos) {
      e.preventDefault();
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        document.execCommand("insertHTML", false, "/");
        const newRange = sel.getRangeAt(0);
        slashRangeRef.current = newRange.cloneRange();
        const rect = newRange.getBoundingClientRect();
        setSlashFilter("");
        setSlashMenuPos({
          x: Math.max(0, Math.min(rect.left, window.innerWidth - 280)),
          y: rect.bottom + 4,
        });
        // Auto-focus search input after next render
        requestAnimationFrame(() => slashFilterInputRef.current?.focus());
      }
      return;
    }

    // 1b2. Filter tracking while slash menu is open
    if (slashMenuPos && !e.ctrlKey && !e.metaKey && !e.altKey) {
      if (e.key === "Enter") {
        e.preventDefault();
        const allItems = buildSlashItems();
        const low = slashFilter.toLowerCase();
        let first: { cmd: string; value?: string } | null = null;
        for (const s of allItems) {
          for (const o of s.opts) {
            if (o.label.toLowerCase().includes(low)) { first = o; break; }
          }
          if (first) break;
        }
        if (first) handleSlashSelect(first.cmd, first.value);
        return;
      }
      if (e.key === "Backspace") {
        e.preventDefault();
        document.execCommand("delete", false);
        setSlashFilter(prev => prev.slice(0, -1));
        return;
      }
      if (e.key.length === 1) {
        e.preventDefault();
        document.execCommand("insertHTML", false, e.key);
        setSlashFilter(prev => prev + e.key);
        return;
      }
    }

    // 1c. Escape closes slash menu → remove "/" + filter text
    if (e.key === "Escape" && slashMenuPos) {
      e.preventDefault();
      setSlashMenuPos(null);
      setSlashFilter("");
      cleanUpSlashText();
      slashRangeRef.current = null;
      return;
    }

    // 2. Intercept selection and get node
    let sel: Selection | null;
    let range: Range;
    let node: Node;
    try {
      sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      range = sel.getRangeAt(0);
      node = range.startContainer;
    } catch { return; }

    // Find parent components
    let parent = node.parentElement;
    let isCheckbox = false;
    let checkboxParent: HTMLElement | null = null;
    let isCallout = false;
    let calloutParent: HTMLElement | null = null;

    while (parent && parent !== editorRef.current) {
      if (parent.classList.contains("notes-checkbox")) {
        isCheckbox = true;
        checkboxParent = parent;
      }
      if (parent.classList.contains("notes-callout")) {
        isCallout = true;
        calloutParent = parent;
      }
      parent = parent.parentElement;
    }

    // 3. Checklist Enter & Backspace Handlers
    if (isCheckbox && checkboxParent) {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        const textContent = checkboxParent.textContent?.replace(/\u200B/g, "").trim() || "";
        if (textContent === "") {
          checkboxParent.remove();
          document.execCommand("insertHTML", false, "<p><br></p>");
        } else {
          const html = `<div class="notes-checkbox" style="display:flex;align-items:center;gap:8px;margin:4px 0;"><input type="checkbox" style="width:16px;height:16px;cursor:pointer;accent-color:var(--accent);" /> <span>&nbsp;</span></div>`;
          document.execCommand("insertHTML", false, html);
        }
        setSaveStatus("pending");
        return;
      }

      if (e.key === "Backspace") {
        const offset = range.startOffset;
        const isAtBeginning = offset === 0 || (node.nodeType === Node.ELEMENT_NODE && range.startOffset === 0);
        if (isAtBeginning) {
          e.preventDefault();
          const contentSpan = checkboxParent.querySelector("span");
          const textContent = contentSpan ? contentSpan.innerHTML : "";
          const p = document.createElement("p");
          p.innerHTML = textContent || "<br>";
          checkboxParent.replaceWith(p);

          const newRange = document.createRange();
          newRange.selectNodeContents(p);
          newRange.collapse(true);
          sel.removeAllRanges();
          sel.addRange(newRange);

          handleEditorInput();
          return;
        }
      }
    }

    // 4. Callout Enter Handler
    if (isCallout && calloutParent) {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        const p = document.createElement("p");
        p.innerHTML = "<br>";
        calloutParent.after(p);

        const newRange = document.createRange();
        newRange.selectNodeContents(p);
        newRange.collapse(true);
        sel.removeAllRanges();
        sel.addRange(newRange);

        handleEditorInput();
        return;
      }
    }

    // 4b. Enter on empty list item: exit list
    if (e.key === "Enter" && !e.shiftKey) {
      try {
        let listItem: HTMLElement | null = null;
        let lp = node.parentElement;
        while (lp && lp !== editorRef.current) {
          if (lp.tagName === "LI") {
            listItem = lp;
            break;
          }
          lp = lp.parentElement;
        }
        if (listItem) {
          const text = listItem.textContent?.trim() || "";
          if (text === "") {
            e.preventDefault();
            const list = listItem.closest("ul, ol");
            const p = document.createElement("p");
            p.innerHTML = "<br>";
            const parent = listItem.parentElement;
            listItem.remove();
            if (list && !list.querySelector("li")) {
              list.after(p);
              list.remove();
            } else if (parent) {
              parent.after(p);
            }
            const newRange = document.createRange();
            newRange.selectNodeContents(p);
            newRange.collapse(true);
            sel.removeAllRanges();
            sel.addRange(newRange);
            setSaveStatus("pending");
            return;
          }
        }
      } catch {}
    }

    // 4c. Backspace at start of block: merge with previous
    if (e.key === "Backspace") {
      try {
        const isAtStart = range.startOffset === 0;
        if (isAtStart && node.nodeType === Node.TEXT_NODE) {
          let currentBlock = node.parentElement;
          while (currentBlock && currentBlock !== editorRef.current &&
                 !["P", "H1", "H2", "H3", "LI", "BLOCKQUOTE"].includes(currentBlock.tagName)) {
            currentBlock = currentBlock.parentElement;
          }
          if (currentBlock && currentBlock !== editorRef.current && currentBlock.previousElementSibling) {
            const prev = currentBlock.previousElementSibling as HTMLElement;
            if (!prev.classList.contains("notes-checkbox") &&
                !prev.classList.contains("notes-callout") &&
                !prev.classList.contains("notes-code-block") &&
                !prev.classList.contains("notes-attachment") &&
                prev.tagName !== "TABLE") {
              e.preventDefault();
              const html = currentBlock.innerHTML;
              currentBlock.remove();
              prev.insertAdjacentHTML("beforeend", html);
              const newRange = document.createRange();
              newRange.selectNodeContents(prev);
              newRange.collapse(false);
              sel.removeAllRanges();
              sel.addRange(newRange);
              setSaveStatus("pending");
              return;
            }
          }
        }
      } catch {}
    }

    // 5. Markdown Triggers on Space
    if (e.key === " ") {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent || "";
        const offset = range.startOffset;
        const textBeforeCursor = text.substring(0, offset);

        let cmd = "";
        let htmlToInsert = "";

        if (textBeforeCursor === "#") {
          cmd = "h1";
        } else if (textBeforeCursor === "##") {
          cmd = "h2";
        } else if (textBeforeCursor === "###") {
          cmd = "h3";
        } else if (textBeforeCursor === "[]") {
          cmd = "checklist";
          htmlToInsert = `<div class="notes-checkbox" style="display:flex;align-items:center;gap:8px;margin:4px 0;"><input type="checkbox" style="width:16px;height:16px;cursor:pointer;accent-color:var(--accent);" /> <span>&nbsp;</span></div>`;
        } else if (textBeforeCursor === "-" || textBeforeCursor === "*") {
          cmd = "ul";
        } else if (textBeforeCursor === "1.") {
          cmd = "ol";
        } else if (textBeforeCursor === ">") {
          cmd = "quote";
        } else if (textBeforeCursor === "```") {
          cmd = "codeBlock";
        } else if (textBeforeCursor === "---") {
          cmd = "insertHR";
        } else if (textBeforeCursor === "$$") {
          cmd = "mathBlock";
        }

        if (cmd) {
          e.preventDefault();
          const textNode = node as Text;
          textNode.deleteData(0, offset);

          if (cmd === "h1") {
            document.execCommand("formatBlock", false, "<h1>");
          } else if (cmd === "h2") {
            document.execCommand("formatBlock", false, "<h2>");
          } else if (cmd === "h3") {
            document.execCommand("formatBlock", false, "<h3>");
          } else if (cmd === "quote") {
            document.execCommand("formatBlock", false, "<blockquote>");
          } else if (cmd === "ul") {
            document.execCommand("insertUnorderedList", false);
          } else if (cmd === "ol") {
            document.execCommand("insertOrderedList", false);
          } else if (cmd === "checklist") {
            document.execCommand("insertHTML", false, htmlToInsert);
          } else if (cmd === "codeBlock") {
            handleFormat("codeBlock");
          } else if (cmd === "insertHR") {
            handleFormat("insertHR");
          } else if (cmd === "mathBlock") {
            handleFormat("mathBlock");
          }
          setSaveStatus("pending");
        }
      }
    }
  }, [handleEditorInput, slashMenuPos, selectedNote, updateNote, handleFormat]);

  const handleEditorPaste = useCallback((e: React.ClipboardEvent) => {
    const sel = window.getSelection();
    const range = sel && sel.rangeCount > 0 ? sel.getRangeAt(0) : null;
    let inCodeBlock = false;
    let codeBlockEl: HTMLElement | null = null;
    if (range) {
      let el = range.startContainer.parentElement;
      while (el && el !== editorRef.current) {
        if (el.classList.contains("notes-code-block")) {
          inCodeBlock = true;
          codeBlockEl = el;
          break;
        }
        el = el.parentElement;
      }
    }
    if (inCodeBlock && codeBlockEl) {
      e.preventDefault();
      const text = e.clipboardData.getData("text/plain");
      const wrapper = document.createElement("div");
      wrapper.innerHTML = text
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        .replace(/\n{2,}/g, "</p><p>").replace(/\n/g, "<br>");
      const html = wrapper.innerHTML ? `<p>${wrapper.innerHTML}</p>` : "<p><br></p>";
      codeBlockEl.insertAdjacentHTML("afterend", html);
      const newRange = document.createRange();
      const newP = codeBlockEl.nextElementSibling;
      if (newP) {
        newRange.selectNodeContents(newP);
        newRange.collapse(true);
        sel?.removeAllRanges();
        sel?.addRange(newRange);
      }
      setSaveStatus("pending");
      return;
    }
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      const file = items[i].getAsFile();
      if (file) {
        const isImg = file.type.startsWith("image/");
        const isAudio = file.type.startsWith("audio/");
        const isVideo = file.type.startsWith("video/");
        if (isImg || isAudio || isVideo) {
          e.preventDefault();
          const reader = new FileReader();
          reader.onload = (ev) => {
            const dataUrl = ev.target?.result as string;
            if (!dataUrl || !editorRef.current) return;
            let html = "";
            if (isImg) {
              html = `<img src="${dataUrl}" alt="${file.name}" style="max-width:100%;border-radius:8px;margin:8px 0;" class="editable-image" />`;
            } else if (isAudio) {
              html = `<div class="notes-attachment" style="display:flex;align-items:center;gap:10px;padding:10px 14px;border:1px solid var(--border-default);border-radius:10px;margin:8px 0;background:var(--bg-hover);"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg><div style="flex:1;min-width:0"><div style="font-size:12px;font-weight:600;color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${file.name}</div><audio controls src="${dataUrl}" style="width:100%;height:36px;margin-top:4px;">${file.name}</audio></div><span style="font-size:10px;color:var(--text-tertiary);flex-shrink:0;">${(file.size / 1024).toFixed(0)} KB</span></div>`;
            } else if (isVideo) {
              html = `<div class="notes-attachment" style="display:flex;flex-direction:column;gap:6px;padding:10px 14px;border:1px solid var(--border-default);border-radius:10px;margin:8px 0;background:var(--bg-hover);"><div style="display:flex;align-items:center;gap:8px;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5"/><rect x="2" y="6" width="14" height="12" rx="2"/></svg><span style="font-size:12px;font-weight:600;color:var(--text-primary);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${file.name}</span><span style="font-size:10px;color:var(--text-tertiary);flex-shrink:0;">${(file.size / 1024).toFixed(0)} KB</span></div><video controls src="${dataUrl}" style="width:100%;max-height:400px;border-radius:6px;">${file.name}</video></div>`;
            }
            document.execCommand("insertHTML", false, html);
            setSaveStatus("pending");
            if (selectedNote) updateNote(selectedNote.id, { content: editorRef.current.innerHTML });
          };
          reader.readAsDataURL(file);
          return;
        }
      }
    }
    // Rich text paste: preserve structure, strip ALL external styling
    const htmlData = e.clipboardData.getData("text/html");
    if (htmlData) {
      e.preventDefault();
      const temp = document.createElement("div");
      temp.innerHTML = htmlData;
      const all = temp.querySelectorAll("*");
      for (const el of all) {
        const style = (el as HTMLElement).style;
        style.removeProperty("background-color");
        style.removeProperty("background");
        style.removeProperty("color");
        style.removeProperty("font-family");
        style.removeProperty("font-size");
        style.removeProperty("font-weight");
        style.removeProperty("font-style");
        style.removeProperty("line-height");
        style.removeProperty("letter-spacing");
        style.removeProperty("text-align");
        style.removeProperty("text-decoration");
        style.removeProperty("text-transform");
        style.removeProperty("text-indent");
        style.removeProperty("margin");
        style.removeProperty("padding");
        style.removeProperty("border");
        style.removeProperty("border-color");
        style.removeProperty("border-style");
        style.removeProperty("border-width");
        style.removeProperty("box-shadow");
        style.removeProperty("width");
        style.removeProperty("height");
        style.removeProperty("max-width");
        style.removeProperty("max-height");
        style.removeProperty("min-width");
        style.removeProperty("min-height");
        style.removeProperty("position");
        style.removeProperty("top");
        style.removeProperty("left");
        style.removeProperty("right");
        style.removeProperty("bottom");
        style.removeProperty("float");
        style.removeProperty("clear");
        style.removeProperty("display");
        style.removeProperty("vertical-align");
        style.removeProperty("white-space");
        style.removeProperty("word-spacing");
        style.removeProperty("opacity");
        el.removeAttribute("bgcolor");
        el.removeAttribute("face");
        el.removeAttribute("class");
        el.removeAttribute("style");
      }
      const cleaned = temp.innerHTML
        .replace(/<meta[^>]*>/gi, "")
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
        .replace(/<!--[\s\S]*?-->/g, "")
        .replace(/<o:p[^>]*>[\s\S]*?<\/o:p>/gi, "")
        .replace(/<xml[^>]*>[\s\S]*?<\/xml>/gi, "")
        .replace(/<head[^>]*>[\s\S]*?<\/head>/gi, "")
        .replace(/<title[^>]*>[\s\S]*?<\/title>/gi, "")
        .replace(/<span[^>]*>/gi, "<span>")
        .replace(/<div([^>]*)>/gi, "<p$1>")
        .replace(/<\/div>/gi, "</p>");
      document.execCommand("insertHTML", false, cleaned);
      setSaveStatus("pending");
    } else {
      // Plain text paste: detect URLs
      const text = e.clipboardData.getData("text/plain");
      if (text && (text.startsWith("http://") || text.startsWith("https://"))) {
        e.preventDefault();
        setPendingLink(text);
      }
    }
  }, [selectedNote, updateNote]);

  const handleSlashSelect = useCallback((cmd: string, value?: string) => {
    setSlashMenuPos(null);
    setSlashFilter("");
    cleanUpSlashText();
    handleFormat(cmd, value);
  }, [handleFormat]);

  const handleDuplicate = useCallback(() => {
    const targetId = contextMenu ? contextMenu.noteId : selectedNoteId;
    if (!targetId) return;
    const original = notes.find(n => n.id === targetId);
    const newId = duplicateNote(targetId);
    if (newId) {
      setSelectedNoteId(newId);
      toast.success(original ? `Copia de "${original.title}" creada` : "Nota duplicada");
    }
  }, [selectedNoteId, contextMenu, duplicateNote, notes]);

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
    const taskId = createDownloadTask((target.title || "nota") + ".pdf", 'pdf');
    updateDownloadTask(taskId, { status: 'downloading', progress: 30 });
    const content = `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
  @page { margin: 24mm 20mm; size: A4; }
  * { box-sizing: border-box; }
  body { font-family: 'Inter', 'Segoe UI', system-ui, sans-serif; max-width: 700px; margin: 0 auto; padding: 0; color: #1a1a2e; line-height: 1.6; }
  h1 { font-size: 26px; font-weight: 700; margin: 0 0 6px; letter-spacing: -0.02em; color: #111; }
  .meta { color: #666; font-size: 11px; margin-bottom: 28px; padding-bottom: 16px; border-bottom: 1px solid #e2e8f0; display: flex; gap: 16px; }
  .content { font-size: 13.5px; line-height: 1.75; color: #1a1a2e; }
  .content img { max-width: 100%; border-radius: 6px; margin: 12px 0; }
  .content a { color: #2563eb; text-decoration: underline; }
  .content .notes-attachment { display: flex; align-items: center; gap: 10px; padding: 10px 14px; border: 1px solid #e2e8f0; border-radius: 8px; margin: 8px 0; background: #f8fafc; }
  .content .notes-attachment a { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #2563eb; font-weight: 600; font-size: 12px; text-decoration: none; }
  .content .notes-attachment .att-meta { font-size: 10px; color: #94a3b8; flex-shrink: 0; }
  .content blockquote { margin: 12px 0; padding-left: 16px; border-left: 3px solid #2563eb; color: #475569; }
  .content pre { background: #f1f5f9; padding: 12px 16px; border-radius: 8px; overflow-x: auto; font-size: 12px; }
  .content table { width: 100%; border-collapse: collapse; margin: 12px 0; }
  .content th, .content td { padding: 8px; border: 1px solid #e2e8f0; font-size: 12px; }
  .content th { background: #f8fafc; font-weight: 600; }
  @media print {
    body { margin: 0; padding: 0; }
    .content a { color: #2563eb !important; }
  }
</style></head><body>
  <h1>${target.title}</h1>
  <div class="meta">
    <span>${safeFormat(target.createdAt, "d MMM yyyy")}</span>
    <span>${getWordCount(target.content)} palabras</span>
  </div>
  <div class="content">${target.content}</div>
</body></html>`;
    updateDownloadTask(taskId, { progress: 60 });
    const blob = new Blob([content], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const w = window.open(url, '_blank');
    if (w) {
      updateDownloadTask(taskId, { progress: 80 });
      w.document.title = target.title || "nota";
      setTimeout(() => {
        w.focus();
        w.print();
        completeDownloadTask(taskId);
        setTimeout(() => URL.revokeObjectURL(url), 60000);
      }, 600);
      toast.success("Exportando PDF — usa Guardar como PDF");
    } else {
      const a = document.createElement('a');
      a.href = url;
      a.download = (target.title || "nota") + ".html";
      a.click();
      URL.revokeObjectURL(url);
      completeDownloadTask(taskId);
      toast.success("Exportado como HTML (permite ventanas emergentes para PDF)");
    }
    setContextMenu(null);
  }, [notes, contextMenu, selectedNoteId]);

  // DRAG AND DROP HANDLERS FOR REORDERING (Libros / Bloques) — @dnd-kit
  const noteSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { delay: 300, tolerance: 8 } })
  );

  const handleDragEndNotes = useCallback((event: any) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const ids = filteredNotes.map(n => n.id);
      const oldIndex = ids.indexOf(active.id);
      const newIndex = ids.indexOf(over.id);
      const newIds = arrayMove([...ids], oldIndex, newIndex);
      reorderNotes(newIds);
      setSortMode("manual");
      toast.success("Orden actualizado");
    }
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
    const existing = JSON.parse(localStorage.getItem("owa_created_tags") || "[]");
    if (!existing.includes(name)) {
      existing.push(name);
      localStorage.setItem("owa_created_tags", JSON.stringify(existing));
    }
    setShowNewTagModal(false);
    toast.success("Etiqueta creada");
  }, [customTagColors]);

  // Click outside / scroll to close context menu
  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    window.addEventListener("click", close);
    window.addEventListener("wheel", close, { passive: true });
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("wheel", close);
    };
  }, [contextMenu]);

  // Auto-save logic
  useEffect(() => {
    if (!selectedNote || !isEditing) return;
    const id = setInterval(() => { handleSaveNote(); }, 20000);
    return () => {
      clearInterval(id);
      if (saveTimeoutRef.current) { clearTimeout(saveTimeoutRef.current); saveTimeoutRef.current = null; }
      handleSaveNote();
    };
  }, [selectedNote, isEditing, handleSaveNote]);

  // Save a history entry when opening the editor
  useEffect(() => {
    if (!isEditing || !selectedNote) return;
    if (selectedNote.content) saveNoteVersion(selectedNote.id, selectedNote.content);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing, selectedNote?.id]);

  useEffect(() => {
    if (selectedNote) {
      lastContentRef.current = selectedNote.content.replace(/<[^>]+>/g, "").trim();
    }
  }, [selectedNote]);

  const sortLabels: Record<SortMode, string> = {
    updated: "Recientes", created: "Creados", title: "Título",
    course: "Curso", visits: "Visitas", priority: "Prioridad",
    manual: "Manual",
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
      <style>{`
        .notes-editor-area ul { padding-left: 24px; margin: 8px 0; list-style: disc; }
        .notes-editor-area ol { padding-left: 24px; margin: 8px 0; list-style: decimal; }
        .notes-editor-area li { margin: 2px 0; line-height: 1.7; }
        .notes-editor-area ul ul { list-style: circle; }
        .notes-editor-area ul ul ul { list-style: square; }
        .notes-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
        .notes-table th { padding: 8px; background: var(--bg-hover); font-weight: 600; border: 1px solid var(--border-default); font-size: 13px; }
        .notes-table td { padding: 8px; border: 1px solid var(--border-default); font-size: 12.5px; }
        .notes-editor-area h1 { margin: 28px 0 12px; font-size: 26px; font-weight: 700; line-height: 1.3; }
        .notes-editor-area h2 { margin: 24px 0 10px; font-size: 22px; font-weight: 650; line-height: 1.35; }
        .notes-editor-area h3 { margin: 20px 0 8px; font-size: 18px; font-weight: 600; line-height: 1.4; }
        .notes-editor-area p { margin: 6px 0; }
        .notes-editor-area blockquote { margin: 12px 0; line-height: 1.7; }
        .notes-preview-area ul { padding-left: 20px; margin: 6px 0; list-style: disc; }
        .notes-preview-area ol { padding-left: 20px; margin: 6px 0; list-style: decimal; }
        .notes-preview-area li { margin: 2px 0; line-height: 1.6; }
        .notes-editor-area .notes-attachment,
        .notes-preview-area .notes-attachment {
          display: flex; align-items: center; gap: 10px;
          padding: 10px 14px;
          border: 1px solid var(--border-default);
          border-radius: 10px; margin: 8px 0;
          background: var(--bg-hover);
          transition: border-color 150ms;
        }
        .notes-editor-area .notes-attachment:hover,
        .notes-preview-area .notes-attachment:hover {
          border-color: var(--accent);
        }
        .notes-editor-area .notes-attachment a,
        .notes-preview-area .notes-attachment a {
          color: var(--accent) !important;
          font-weight: 600; font-size: 12px;
          text-decoration: none;
          flex: 1; overflow: hidden;
          text-overflow: ellipsis; white-space: nowrap;
        }
        .notes-editor-area .notes-attachment a:hover,
        .notes-preview-area .notes-attachment a:hover {
          text-decoration: underline;
        }
        .notes-editor-area .notes-attachment .att-meta,
        .notes-preview-area .notes-attachment .att-meta {
          font-size: 10px; color: var(--text-tertiary); flex-shrink: 0;
        }
        .notes-preview-area a:not(.notes-attachment a) {
          color: var(--accent); text-decoration: underline;
          font-weight: 500;
        }
        .notes-preview-area a:not(.notes-attachment a):hover {
          opacity: 0.8;
        }
      `}</style>
      {/* ===== HEADER: Estudio-style as card ===== */}
      <header style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        marginBottom: 22, paddingTop: 8,
      }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <h1 style={{
            fontSize: 42, fontWeight: 200, color: 'var(--text-primary)', lineHeight: 1,
            letterSpacing: '-0.03em', fontFamily: "'Inter Tight', sans-serif", margin: 0,
            textShadow: '0 0 20px var(--accent-glow)',
          }}>
            Notas
          </h1>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <NotificationBell />
          <div style={{ paddingLeft: 16, borderLeft: '1px solid var(--border-subtle)', position: 'relative' }}>
            <div style={{ position: 'absolute', top: '50%', right: 0, width: 150, height: 100, background: `radial-gradient(circle at center, var(--text-muted) 0%, transparent 70%)`, opacity: 0.1, transform: 'translateY(-50%)', pointerEvents: 'none', zIndex: 0 }} />
            <div style={{ textAlign: 'right', position: 'relative', zIndex: 1 }}>
              <div className="flex items-baseline gap-2 justify-end">
                <span style={{ fontFamily: "'Inter Tight', sans-serif", fontSize: 68, fontWeight: 200, lineHeight: 0.9, color: 'var(--text-secondary)', letterSpacing: '0.02em' }}>
                  {timeStr}
                </span>
                {secondsStr !== null && (
                <span style={{ fontFamily: "'Inter Tight', sans-serif", fontSize: 22, fontWeight: 200, color: 'var(--text-tertiary)', opacity: 0.7, letterSpacing: '0.02em' }}>
                  {secondsStr}
                </span>
                )}
              </div>
              <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.12em', marginTop: 6 }}>
                {dateStr}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ===== MAIN GRID LAYOUT (toolbar + content inside one bento card) ===== */}
      {isEditing ? (
            /* ==================== INLINE EDITOR WORKSPACE ==================== */
            <div className="bento-card" style={{
              display: "flex", flex: 1, minHeight: 0, padding: 0, background: "var(--bg-surface)",
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
                    const isAudio = file.type.startsWith("audio/");
                    const isVideo = file.type.startsWith("video/");
                    let html = "";
                    if (isImg) {
                      html = `<img src="${url}" alt="${file.name}" style="max-width:100%;border-radius:8px;margin:8px 0;" class="editable-image" />`;
                    } else if (isAudio) {
                      html = `<div class="notes-attachment" style="display:flex;align-items:center;gap:10px;padding:10px 14px;border:1px solid var(--border-default);border-radius:10px;margin:8px 0;background:var(--bg-hover);"><span style="font-size:22px;">🎵</span><div style="flex:1;min-width:0"><div style="font-size:12;font-weight:600;color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${file.name}</div><audio controls src="${url}" style="width:100%;height:36px;margin-top:4px;">${file.name}</audio></div><span style="font-size:10px;color:var(--text-tertiary);flex-shrink:0;">${(file.size / 1024).toFixed(0)} KB</span></div>`;
                    } else if (isVideo) {
                      html = `<div class="notes-attachment" style="display:flex;flex-direction:column;gap:6px;padding:10px 14px;border:1px solid var(--border-default);border-radius:10px;margin:8px 0;background:var(--bg-hover);"><div style="display:flex;align-items:center;gap:8px;"><span style="font-size:18px;">🎬</span><span style="font-size:12;font-weight:600;color:var(--text-primary);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${file.name}</span><span style="font-size:10px;color:var(--text-tertiary);flex-shrink:0;">${(file.size / 1024).toFixed(0)} KB</span></div><video controls src="${url}" style="width:100%;max-height:400px;border-radius:6px;">${file.name}</video></div>`;
                    } else {
                      const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith('.pdf');
                      if (isPdf) {
                        html = `<div class="notes-attachment"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#EF4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg><a href="${url}" target="_blank">${file.name}</a><span class="att-meta">${(file.size / 1024).toFixed(0)} KB · PDF</span></div>`;
                      } else {
                        html = `<div class="notes-attachment"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg><a href="${url}" target="_blank">${file.name}</a><span class="att-meta">${(file.size / 1024).toFixed(0)} KB</span></div>`;
                      }
                    }
                    document.execCommand("insertHTML", false, html);
                    setSaveStatus("pending");
                    if (selectedNote) updateNote(selectedNote.id, { content: editorRef.current.innerHTML });
                  }
                  e.target.value = "";
                }} />

                {/* Rich formatting Toolbar */}
                <div style={{ padding: "8px 16px", borderBottom: "1px solid var(--border-default)", flexShrink: 0 }}>
                  <EditorToolbar onFormat={handleFormat} />
                </div>

                {/* Write panel — adaptive margins */}
                <div style={{
                  flex: 1, display: "flex", flexDirection: "column", overflow: "auto",
                  padding: showDetailsPanel ? "16px 24px 48px" : "16px 48px 48px",
                  width: "100%", boxSizing: "border-box",
                }}>
                  {/* Clean text input for title */}
                  <input
                    ref={titleRef}
                    type="text"
                    defaultValue={selectedNote?.title || ""}
                    placeholder="Título del cuaderno"
                    style={{
                      fontSize: 32, fontWeight: 200, color: "var(--text-primary)",
                      fontFamily: "'Inter Tight', system-ui, sans-serif",
                      background: "transparent", border: "none", outline: "none",
                      width: "100%", padding: "0 0 14px", marginBottom: 24,
                      borderBottom: "1px solid var(--border-subtle)",
                      caretColor: "var(--accent)", boxSizing: "border-box",
                      letterSpacing: "-0.03em",
                      margin: "0 0 24px",
                    }}
                    onBlur={handleSaveNote}
                  />

                  {/* Content editor — adaptive width, professional reading experience */}
                  <div
                    ref={editorRef}
                    contentEditable
                    suppressContentEditableWarning
                    className="notes-editor-area"
                    style={{
                      flex: 1, outline: "none", minHeight: "100%",
                      fontSize: 15, lineHeight: 1.8,
                      color: "var(--text-primary)",
                      fontFamily: "'Inter', system-ui, sans-serif",
                      caretColor: "var(--accent)",
                      width: "100%", boxSizing: "border-box",
                      margin: "0",
                    }}
                    onDoubleClick={(e) => {
                      const target = e.target as HTMLElement;
                      // Double-click on IMG: show options (border, size, delete)
                      if (target.tagName === "IMG") {
                        e.preventDefault();
                        setLightboxImage({ src: (target as HTMLImageElement).src, el: target });
                        return;
                      }
                      // Double-click on code block: exit cursor below it
                      const codeBlock = target.closest(".notes-code-block");
                      if (codeBlock && codeBlock.parentElement) {
                        const p = document.createElement("p");
                        p.innerHTML = "<br>";
                        codeBlock.parentElement.insertBefore(p, codeBlock.nextSibling);
                        const range = document.createRange();
                        range.selectNodeContents(p);
                        range.collapse(true);
                        const sel = window.getSelection();
                        if (sel) { sel.removeAllRanges(); sel.addRange(range); }
                        editorRef.current?.focus();
                        setSaveStatus("pending");
                      }
                    }}
                    onClick={(e) => {
                      const target = e.target as HTMLElement;
                      if (target.classList.contains("copy-code-btn")) {
                        const code = decodeURIComponent(target.getAttribute("data-code") || "");
                        if (code) {
                          navigator.clipboard.writeText(code).catch(() => {
                            const ta = document.createElement("textarea");
                            ta.value = code; ta.style.position = "fixed"; ta.style.opacity = "0";
                            document.body.appendChild(ta); ta.select();
                            document.execCommand("copy"); ta.remove();
                          });
                          target.textContent = "¡Copiado!";
                          setTimeout(() => { target.textContent = "Copiar"; }, 2000);
                        }
                        return;
                      }
                      if (target.tagName === "A") {
                        const href = (target as HTMLAnchorElement).getAttribute("href");
                        if (href && (href.startsWith("http://") || href.startsWith("https://"))) {
                          e.preventDefault();
                          setLinkPreviewUrl(href);
                          setLinkPreviewError(false);
                          return;
                        }
                      }
                      if (target.tagName === "INPUT" && (target as HTMLInputElement).type === "checkbox") {
                        const cb = target as HTMLInputElement;
                        if (cb.checked) {
                          cb.setAttribute("checked", "true");
                        } else {
                          cb.removeAttribute("checked");
                        }
                        handleEditorInput();
                      }
                    }}
                    onKeyDown={handleEditorKeyDown}
                    onPaste={handleEditorPaste}
                    onInput={handleEditorInput}
                    onBlur={handleSaveNote}
                  />
                </div>
              </div>

              {slashMenuPos && (() => {
                const allItems = buildSlashItems();
                const low = slashFilter.toLowerCase();
                const filtered = allItems
                  .map(s => ({ ...s, opts: s.opts.filter(o => o.label.toLowerCase().includes(low)) }))
                  .filter(s => s.opts.length > 0);
                return (
                  <div ref={slashMenuRef} style={{
                    position: "fixed", left: slashMenuPos.x, top: slashMenuPos.y,
                    zIndex: 10000, minWidth: 220, maxHeight: 320, overflow: "auto",
                    background: "var(--bg-elevated)", border: "1px solid var(--border-strong)",
                    borderRadius: "var(--radius-md)", boxShadow: "var(--shadow-elevated)",
                    padding: 4,
                  }}>
                    <div style={{
                      display: "flex", alignItems: "center", gap: 4, padding: "4px 4px 4px 8px",
                      borderBottom: "1px solid var(--border-subtle)", marginBottom: 2,
                    }}>
                      <input ref={slashFilterInputRef}
                        type="text" placeholder="Filtrar..."
                        value={slashFilter}
                        onChange={e => setSlashFilter(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === "Enter" && filtered.length > 0 && filtered[0].opts.length > 0) {
                            const first = filtered[0].opts[0];
                            handleSlashSelect(first.cmd, first.value);
                          }
                          if (e.key === "Escape") {
                            setSlashMenuPos(null);
                            setSlashFilter("");
                            cleanUpSlashText();
                          }
                          e.stopPropagation();
                        }}
                        style={{
                          flex: 1, border: "none", background: "transparent",
                          color: "var(--text-primary)", fontSize: 12, outline: "none",
                          padding: "4px 0",
                        }} />
                      <button onClick={() => { setSlashMenuPos(null); setSlashFilter(""); cleanUpSlashText(); }}
                        title="Cerrar"
                        style={{
                          width: 22, height: 22, borderRadius: 4, border: "none",
                          background: "transparent", color: "var(--text-tertiary)",
                          cursor: "pointer", display: "flex", alignItems: "center",
                          justifyContent: "center",
                        }}
                        className="hover:bg-[var(--bg-hover)] hover:text-[var(--text-secondary)]">
                        <X size={13} />
                      </button>
                    </div>
                    {filtered.length === 0 ? (
                      <div style={{ padding: "16px 8px", textAlign: "center", color: "var(--text-tertiary)", fontSize: 11.5 }}>
                        Sin resultados para "<span style={{ color: "var(--text-secondary)" }}>{slashFilter}</span>"
                      </div>
                    ) : filtered.map(section => (
                      <div key={section.cat}>
                        <div style={{
                          fontSize: 9.5, fontWeight: 700, color: "var(--text-tertiary)",
                          textTransform: "uppercase", letterSpacing: "0.06em",
                          padding: "6px 8px 2px",
                        }}>{section.cat}</div>
                        {section.opts.map(opt => (
                          <button key={opt.label} onClick={() => handleSlashSelect(opt.cmd, opt.value)}
                            style={{
                              display: "flex", alignItems: "center", gap: 8, padding: "6px 8px",
                              width: "100%", textAlign: "left", border: "none",
                              background: "transparent", color: "var(--text-primary)",
                              fontSize: 12, cursor: "pointer", borderRadius: 4,
                              transition: "background 100ms",
                            }}
                            className="hover:bg-[var(--bg-hover)]">
                            <opt.icon size={14} style={{ color: "var(--text-secondary)", flexShrink: 0 }} />
                            <span>{opt.label}</span>
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                );
              })()}

              {/* Collapsible Details Panel right — redesigned professional */}
              {showDetailsPanel && selectedNote && (() => {
                const detailFolder = folders.find(f => f.id === selectedNote.folderId);
                const pColor = selectedNote.coverColor || detailFolder?.color || selectedNote.courseColor || "var(--accent)";
                const noteTags = selectedNote.tags || [];
                const infoAllTags = (() => {
                  const s = new Set<string>();
                  notes.forEach(n => n.tags?.forEach(t => s.add(t)));
                  try { JSON.parse(localStorage.getItem("owa_created_tags") || "[]").forEach((t: string) => s.add(t)); } catch {}
                  return Array.from(s);
                })();
                const handleTagToggle = (tagName: string) => {
                  const current = selectedNote.tags || [];
                  const next = current.includes(tagName)
                    ? current.filter(t => t !== tagName)
                    : [...current, tagName];
                  updateNote(selectedNote.id, { tags: next });
                };
                return (
                <div style={{
                  width: 280, minWidth: 280, display: "flex", flexDirection: "column",
                  padding: "20px 16px", overflowY: "auto", overflowX: "hidden",
                  gap: 14, borderLeft: "1px solid var(--border-subtle)",
                  background: "var(--bg-surface)",
                }}>
                  {/* Metadatos */}
                  <div style={{
                    background: "var(--bg-elevated)",
                    border: "1px solid var(--border-subtle)", borderRadius: 10, padding: "14px 14px",
                    transition: "border-color 200ms",
                  }}>
                    <h3 style={{
                      fontSize: 9, fontWeight: 500, color: "var(--text-tertiary)",
                      letterSpacing: "0.14em", textTransform: "uppercase",
                      marginBottom: 12, fontFamily: "'Inter', sans-serif",
                      display: "flex", alignItems: "center", gap: 5,
                    }}>
                      <Info size={9} /> Información
                    </h3>
                    <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, alignItems: "center" }}>
                        <span style={{ color: "var(--text-tertiary)" }}>Carpeta</span>
                        <span style={{ fontWeight: 500, color: pColor, fontSize: 10.5 }}>
                          {selectedNote.course || "—"}
                        </span>
                      </div>
                      <div style={{ height: 1, background: "var(--border-subtle)", opacity: 0.5 }} />
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                        <span style={{ color: "var(--text-tertiary)" }}>Creada</span>
                        <span style={{ color: "var(--text-secondary)", fontSize: 10.5 }}>
                          {safeFormat(selectedNote.createdAt, "d MMM, HH:mm")}
                        </span>
                      </div>
                      <div style={{ height: 1, background: "var(--border-subtle)", opacity: 0.5 }} />
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                        <span style={{ color: "var(--text-tertiary)" }}>Modificada</span>
                        <span style={{ color: "var(--text-secondary)", fontSize: 10.5 }}>
                          {safeFormat(selectedNote.updatedAt, "d MMM, HH:mm")}
                        </span>
                      </div>
                      <div style={{ height: 1, background: "var(--border-subtle)", opacity: 0.5 }} />
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                        <span style={{ color: "var(--text-tertiary)" }}>Palabras</span>
                        <span style={{ color: "var(--text-secondary)", fontSize: 10.5 }}>{getWordCount(selectedNote.content)}</span>
                      </div>
                      <div style={{ height: 1, background: "var(--border-subtle)", opacity: 0.5 }} />
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                        <span style={{ color: "var(--text-tertiary)" }}>Caracteres</span>
                        <span style={{ color: "var(--text-secondary)", fontSize: 10.5 }}>{getCharCount(selectedNote.content)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Etiquetas */}
                  <div style={{
                    background: "var(--bg-elevated)",
                    border: "1px solid var(--border-subtle)", borderRadius: 10, padding: "14px 14px",
                  }}>
                    <h3 style={{
                      fontSize: 9, fontWeight: 500, color: "var(--text-tertiary)",
                      letterSpacing: "0.14em", textTransform: "uppercase",
                      marginBottom: 10, fontFamily: "'Inter', sans-serif",
                      display: "flex", alignItems: "center", gap: 5,
                    }}>
                      <Hash size={9} /> Etiquetas
                    </h3>
                    {infoAllTags.length > 0 ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                        {infoAllTags.map(tag => {
                          const tc = mergedTagColors[tag] || "var(--accent)";
                          const active = noteTags.includes(tag);
                          return (
                            <button key={tag} onClick={() => handleTagToggle(tag)}
                              style={{
                                display: "flex", alignItems: "center", gap: 7,
                                padding: "6px 8px", borderRadius: 6, width: "100%",
                                border: "none",
                                background: active ? `${tc}14` : "transparent",
                                color: active ? tc : "var(--text-secondary)",
                                fontSize: 11.5, fontWeight: active ? 550 : 400,
                                cursor: "pointer", textAlign: "left",
                                transition: "all 120ms ease",
                              }}
                              className={active ? "" : "hover:bg-[var(--bg-hover)]"}>
                              <span style={{
                                width: 6, height: 6, borderRadius: "50%",
                                background: tc, flexShrink: 0,
                                opacity: active ? 1 : 0.5,
                                transition: "opacity 150ms",
                              }} />
                              <span style={{
                                flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                                fontFamily: "'Inter', sans-serif",
                              }}>
                                {tag}
                              </span>
                              {active && <span style={{ fontSize: 8, opacity: 0.6 }}>✓</span>}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <span style={{ color: "var(--text-tertiary)", fontSize: 11, fontStyle: "italic" }}>
                        Sin etiquetas
                      </span>
                    )}
                  </div>

                  {/* Acceso Rápido */}
                  <div style={{
                    background: "var(--bg-elevated)",
                    border: "1px solid var(--border-subtle)", borderRadius: 10, padding: "14px 14px",
                  }}>
                    <h3 style={{
                      fontSize: 9, fontWeight: 500, color: "var(--text-tertiary)",
                      letterSpacing: "0.14em", textTransform: "uppercase",
                      marginBottom: 10, fontFamily: "'Inter', sans-serif",
                      display: "flex", alignItems: "center", gap: 5,
                    }}>
                      <Zap size={9} /> Acciones
                    </h3>
                    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                      <button onClick={handleDuplicate}
                        style={{
                          display: "flex", alignItems: "center", gap: 7, padding: "7px 10px",
                          borderRadius: 7, border: "1px solid var(--border-default)",
                          background: "transparent",
                          color: "var(--text-secondary)", fontSize: 11, cursor: "pointer",
                          transition: "all 120ms",
                        }}
                        className="hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]">
                        <Copy size={12} /> Duplicar
                      </button>
                      <button onClick={() => handleExportPDF()}
                        style={{
                          display: "flex", alignItems: "center", gap: 7, padding: "7px 10px",
                          borderRadius: 7, border: "1px solid var(--border-default)",
                          background: "transparent",
                          color: "var(--text-secondary)", fontSize: 11, cursor: "pointer",
                          transition: "all 120ms",
                        }}
                        className="hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]">
                        <Download size={12} /> Exportar PDF
                      </button>
                      <div style={{ height: 1, background: "var(--border-subtle)", margin: "2px 0" }} />
                      <button onClick={() => setDeleteConfirmNoteId(selectedNoteId)}
                        style={{
                          display: "flex", alignItems: "center", gap: 7, padding: "7px 10px",
                          borderRadius: 7, border: "1px solid transparent",
                          background: "transparent",
                          color: "var(--text-tertiary)", fontSize: 11, cursor: "pointer",
                          transition: "all 120ms",
                        }}
                        className="hover:bg-[var(--error-dim)] hover:text-[var(--error)]">
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
            <div className="bento-card" style={{
              display: "flex", flex: 1, minHeight: 0, overflow: "hidden", padding: 0,
              background: "var(--bg-surface)",
              border: "1px solid var(--border-default)",
              borderRadius: "var(--radius-xl)",
              boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
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
                  editFolderId={editFolderId}
                  setEditFolderId={setEditFolderId}
                  editFolderName={editFolderName}
                  setEditFolderName={setEditFolderName}
                  editFolderColor={editFolderColor}
                  setEditFolderColor={setEditFolderColor}
                  tagColorEdit={tagColorEdit}
                  setTagColorEdit={setTagColorEdit}
                  editTagName={editTagName}
                  setEditTagName={setEditTagName}
                  deleteFolderId={deleteFolderId}
                  setDeleteFolderId={setDeleteFolderId}
                  deleteFolderName={deleteFolderName}
                  setDeleteFolderName={setDeleteFolderName}
                  deletedFolderIds={deletedFolderIds}
                  setDeletedFolderIds={setDeletedFolderIds}
                  mergedTagColors={mergedTagColors}
                  onTagColorsChange={(colors) => {
                    setCustomTagColors(colors);
                    localStorage.setItem("owa_custom_tag_colors", JSON.stringify(colors));
                  }}
                  onTagReorder={(tags) => {
                    localStorage.setItem("owa_tag_order", JSON.stringify(tags));
                  }}
                />
              </div>

              {/* CENTER CONTAINER */}
              <div style={{
                flex: 1, minWidth: 0, display: "flex", flexDirection: "column",
                overflow: "hidden", position: "relative",
              }}>
                {/* Top bar: view toggle (left), search + actions (right) */}
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                  flexShrink: 0, padding: "8px 16px 8px",
                  borderBottom: "1px solid var(--border-subtle)",
                  background: "var(--bg-elevated)",
                }}>
                  {/* View toggle — larger text, pill design */}
                  <div style={{
                    display: "flex",
                    background: "var(--bg-deep)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: 10, padding: 3, height: 38,
                    boxSizing: "border-box", gap: 2,
                    boxShadow: "inset 0 1px 2px rgba(0,0,0,0.15)",
                  }}>
                    <button onClick={() => setViewMode("estante")}
                      title="Vista de Estantería"
                      style={{
                        height: 30, borderRadius: 7, border: "none",
                        background: viewMode === "estante" ? "var(--accent)" : "var(--bg-surface)",
                        color: viewMode === "estante" ? "#fff" : "var(--text-tertiary)",
                        cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
                        padding: "0 12px", fontSize: 12, fontWeight: 450,
                        letterSpacing: "0.01em",
                        transition: "all 200ms",
                        boxShadow: viewMode === "estante" ? "0 2px 8px var(--accent-glow)" : "0 1px 2px rgba(0,0,0,0.08)",
                      }}
                      className="hover:brightness-110">
                      <Library size={13} />
                      <span>Estante</span>
                    </button>
                    <button onClick={() => setViewMode("lista")}
                      title="Vista de Bloques"
                      style={{
                        height: 30, borderRadius: 7, border: "none",
                        background: viewMode === "lista" ? "var(--accent)" : "var(--bg-surface)",
                        color: viewMode === "lista" ? "#fff" : "var(--text-tertiary)",
                        cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
                        padding: "0 12px", fontSize: 12, fontWeight: 450,
                        letterSpacing: "0.01em",
                        transition: "all 200ms",
                        boxShadow: viewMode === "lista" ? "0 2px 8px var(--accent-glow)" : "0 1px 2px rgba(0,0,0,0.08)",
                      }}
                      className="hover:brightness-110">
                      <AlignJustify size={13} />
                      <span>Bloques</span>
                    </button>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ position: "relative", width: 220 }}>
                      <Search size={13} style={{
                        position: "absolute", left: 10, top: "50%",
                        transform: "translateY(-50%)", color: "var(--text-tertiary)",
                        pointerEvents: "none", zIndex: 1,
                      }} />
                      <input type="text" placeholder="Buscar cuaderno..."
                        value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                        className="input-base"
                        style={{
                          width: "100%", height: 30, borderRadius: 8, padding: "0 10px 0 30px", fontSize: 12,
                          background: "var(--bg-surface)",
                        }} />
                    </div>
                    <button onClick={() => setActiveSidebarTab(activeSidebarTab === 'favs' ? 'all' : 'favs')}
                      style={{
                        width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center",
                        background: activeSidebarTab === 'favs' ? 'rgba(245, 158, 11, 0.12)' : "var(--bg-surface)",
                        border: "1px solid " + (activeSidebarTab === 'favs' ? '#F59E0B' : 'var(--border-subtle)'),
                        borderRadius: 8, cursor: "pointer",
                        color: activeSidebarTab === 'favs' ? '#F59E0B' : "var(--text-secondary)",
                        transition: "all 150ms " + EASE,
                      }}
                      className="hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
                      title={activeSidebarTab === 'favs' ? "Ver todas" : "Ver destacados"}>
                      <Star size={13} fill={activeSidebarTab === 'favs' ? '#F59E0B' : 'none'} />
                    </button>
                    <button onClick={handleCreateNote}
                      style={{
                        display: "flex", alignItems: "center", gap: 5, height: 30, padding: "0 12px",
                        background: "var(--accent)", color: "#fff", border: "none", borderRadius: 8,
                        fontSize: 11.5, fontWeight: 600, cursor: "pointer",
                        boxShadow: "0 2px 6px var(--accent-glow)", whiteSpace: "nowrap",
                        transition: "transform 150ms, box-shadow 150ms",
                      }}
                      className="active:scale-[0.97]">
                      <Plus size={13} /> Nueva nota
                    </button>
                  </div>
                </div>



                {/* Context header for folder/tag */}
                {(selectedFolderId || selectedTag) && activeSidebarTab !== "trash" && (
                  <div style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "10px 16px 4px", flexShrink: 0,
                    borderBottom: "1px solid var(--border-subtle)",
                    marginBottom: 4,
                  }}>
                    {selectedFolderId && currentFolder && (() => {
                      const fc = currentFolder.color;
                      return (
                        <>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <span style={{ fontSize: 16, fontWeight: 700, color: fc, letterSpacing: "0.02em" }}>
                              {currentFolder.name}
                            </span>
                          </div>
                          <button onClick={() => { setEditFolderId(currentFolder.id); setEditFolderName(currentFolder.name); setEditFolderColor(fc); }}
                            style={{
                              width: 28, height: 28, flexShrink: 0,
                              display: "flex", alignItems: "center", justifyContent: "center",
                              border: "none", background: fc + "14",
                              color: fc, cursor: "pointer", padding: 0, borderRadius: 6,
                              transition: "all 150ms", opacity: 0.8, marginLeft: "auto",
                            }}
                            className="hover:opacity-100"
                            title="Editar carpeta">
                            <Edit3 size={13} />
                          </button>
                        </>
                      );
                    })()}
                    {selectedTag && !selectedFolderId && (() => {
                      const dotColor = mergedTagColors[selectedTag] || "var(--accent)";
                      return (
                        <>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
                            <Hash size={14} style={{ color: dotColor, flexShrink: 0 }} />
                            <span style={{ fontSize: 16, fontWeight: 700, color: dotColor, letterSpacing: "0.02em" }}>
                              {selectedTag}
                            </span>
                          </div>
                          <button onClick={() => { setTagColorEdit(selectedTag); setEditTagName(selectedTag); }}
                            style={{
                              width: 28, height: 28, flexShrink: 0,
                              display: "flex", alignItems: "center", justifyContent: "center",
                              border: "none", background: dotColor + "14",
                              color: dotColor, cursor: "pointer", padding: 0, borderRadius: 6,
                              transition: "all 150ms", opacity: 0.8, marginLeft: "auto",
                            }}
                            className="hover:opacity-100"
                            title="Editar etiqueta">
                            <Edit3 size={13} />
                          </button>
                        </>
                      );
                    })()}
                  </div>
                )}

                <div style={{
                  flex: 1, display: "flex", flexDirection: "column", overflow: "hidden",
                  position: "relative",
                }}>
              {/* Trash view */}
              {activeSidebarTab === "trash" ? (
                <div style={{ flex: 1, overflow: "auto", padding: "12px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
                  {filteredNotes.length === 0 ? (
                    <div style={{
                      display: "flex", flexDirection: "column", alignItems: "center",
                      justifyContent: "center", flex: 1, gap: 8, color: "var(--text-tertiary)",
                    }}>
                      <Trash2 size={24} style={{ opacity: 0.4 }} />
                      <span style={{ fontSize: 13, fontWeight: 600 }}>Papelera vacía</span>
                      <span style={{ fontSize: 11, opacity: 0.6 }}>Las notas eliminadas aparecerán aquí</span>
                    </div>
                  ) : (
                    <>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 14px", background: "var(--bg-surface)", borderRadius: "var(--radius-md)", border: "1px solid var(--border-default)" }}>
                        <button onClick={() => handleSelectAllTrash(filteredNotes.map(n => n.id))}
                          style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", color: "var(--text-tertiary)" }}
                          title="Seleccionar todo">
                          <CheckSquare size={14} style={{ opacity: trashSelectedIds.size === filteredNotes.length ? 1 : 0.4 }} />
                        </button>
                        <span style={{ fontSize: 10.5, color: "var(--text-tertiary)", fontWeight: 500 }}>
                          {trashSelectedIds.size > 0
                            ? `${trashSelectedIds.size} seleccionada${trashSelectedIds.size !== 1 ? "s" : ""}`
                            : `${filteredNotes.length} nota${filteredNotes.length !== 1 ? "s" : ""}`}
                        </span>
                        {trashSelectedIds.size > 0 && (
                          <div style={{ display: "flex", gap: 4, marginLeft: "auto" }}>
                            <button onClick={handleBatchRestore}
                              style={{ background: "none", border: "1px solid var(--border-default)", borderRadius: 6, padding: "3px 8px", cursor: "pointer", color: "var(--success)", fontSize: 9.5, fontWeight: 600 }}
                              className="hover:bg-[var(--bg-hover)]">
                              Restaurar {trashSelectedIds.size > 1 ? `(${trashSelectedIds.size})` : ""}
                            </button>
                            <button onClick={handleBatchDelete}
                              style={{ background: "none", border: "1px solid var(--error)30", borderRadius: 6, padding: "3px 8px", cursor: "pointer", color: "var(--error)", fontSize: 9.5, fontWeight: 600 }}
                              className="hover:bg-[var(--bg-hover)]">
                              Eliminar {trashSelectedIds.size > 1 ? `(${trashSelectedIds.size})` : ""}
                            </button>
                          </div>
                        )}
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {filteredNotes.map(note => {
                          const delTime = note.deletedAt ? formatDeletionTime(note.deletedAt) : "";
                          const isSelected = trashSelectedIds.has(note.id);
                          return (
                            <div key={note.id} style={{
                              display: "flex", alignItems: "center", gap: 8, padding: "8px 12px",
                              background: isSelected ? "var(--accent)08" : "var(--bg-surface)",
                              borderRadius: "var(--radius-md)",
                              border: isSelected ? "1px solid var(--accent)30" : "1px solid var(--border-default)",
                              transition: "all 120ms",
                            }}>
                              <button onClick={() => toggleTrashSelect(note.id)}
                                style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", flexShrink: 0, color: isSelected ? "var(--accent)" : "var(--text-tertiary)" }}>
                                <CheckSquare size={13} />
                              </button>
                              <div style={{
                                width: 28, height: 28, borderRadius: 6, flexShrink: 0,
                                background: note.courseColor
                                  ? `linear-gradient(135deg, ${note.courseColor}18, transparent)`
                                  : "linear-gradient(135deg, var(--accent)10, transparent)",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                border: `1px solid ${note.courseColor ? note.courseColor + '22' : 'var(--border-soft)'}`,
                              }}>
                                <FileText size={12} style={{ color: note.courseColor || "var(--text-secondary)" }} />
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", marginBottom: 1 }}>
                                  {note.course ? `${format(new Date(note.createdAt), 'dd/MM/yy')} — ${note.course}` : (note.title || "Sin título")}
                                </div>
                                <div style={{ fontSize: 9.5, color: "var(--text-tertiary)" }}>
                                  {delTime}{note.tags?.length ? ` · ${note.tags.slice(0, 2).join(", ")}` : ""}
                                </div>
                              </div>
                              <div style={{ display: "flex", gap: 3, flexShrink: 0 }}>
                                <button onClick={() => handleRestoreNote(note.id)}
                                  style={{
                                    background: "none", border: "1px solid var(--border-default)",
                                    borderRadius: 5, padding: "4px 7px", cursor: "pointer",
                                    color: "var(--success)", fontSize: 9, fontWeight: 600,
                                  }}
                                  className="hover:bg-[var(--bg-hover)]"
                                  title="Restaurar">
                                  Restaurar
                                </button>
                                <button onClick={() => handlePermanentDelete(note.id)}
                                  style={{
                                    background: "none", border: "1px solid var(--error)30",
                                    borderRadius: 5, padding: "4px 7px", cursor: "pointer",
                                    color: "var(--error)", fontSize: 9, fontWeight: 600,
                                  }}
                                  className="hover:bg-[var(--bg-hover)]"
                                  title="Eliminar permanentemente">
                                  <Trash2 size={10} />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
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
                  <DndContext sensors={noteSensors} collisionDetection={closestCenter}
                    onDragStart={() => {}} onDragEnd={handleDragEndNotes}>
                    <SortableContext items={filteredNotes.map(n => n.id)} strategy={rectSortingStrategy}>
                    <div style={{
                      flex: 1, overflow: "auto", display: "grid",
                      gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                      gridAutoRows: "max-content",
                      gap: 14, padding: "18px 14px 14px",
                    }}>
                      {filteredNotes.map((note, i) => (
                        <NoteCard key={note.id} note={note}
                          isSelected={selectedNoteId === note.id}
                          onSelect={() => handleSelectNote(note.id)}
                          onOpen={() => { handleSelectNote(note.id); handleOpenNote(); }}
                          onContextMenu={(e, br) => handleContextMenu(e, note.id, br)}
                          tagColors={mergedTagColors} />
                      ))}
                    </div>
                    </SortableContext>
                  </DndContext>
                ) : (
                  /* Bookshelf View: non-scrollable, pagination at top */
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
                          {/* Books — with side arrows on hover */}
                          {/* Books — with side arrows on hover */}
                          <div style={{
                            flex: 1, display: "flex", flexDirection: "column",
                            justifyContent: "center", gap: 8, padding: "0px 12px 0",
                            overflow: "hidden", position: "relative",
                          }}
                            onMouseEnter={() => setShowShelfArrows(true)}
                            onMouseLeave={() => setShowShelfArrows(false)}>
                            {showShelfArrows && safePageBS > 0 && !selectedNote && (
                              <button onClick={() => setBookshelfPage(safePageBS - 1)}
                                style={{
                                  position: "absolute", left: 0, top: 16, bottom: 16,
                                  zIndex: 10, width: 36, borderRadius: "0 10px 10px 0",
                                  border: "1px solid var(--border-subtle)", background: "var(--bg-surface)",
                                  color: "var(--text-secondary)", cursor: "pointer",
                                  display: "flex", alignItems: "center", justifyContent: "center",
                                  boxShadow: "2px 0 16px rgba(0,0,0,0.15)",
                                  transition: "all 200ms",
                                }}
                                className="hover:bg-[var(--bg-hover)] hover:text-[var(--accent)]">
                                <ChevronLeft size={22} />
                              </button>
                            )}
                            {showShelfArrows && safePageBS < totalPagesBS - 1 && !selectedNote && (
                              <button onClick={() => setBookshelfPage(safePageBS + 1)}
                                style={{
                                  position: "absolute", right: 0, top: 16, bottom: 16,
                                  zIndex: 10, width: 36, borderRadius: "10px 0 0 10px",
                                  border: "1px solid var(--border-subtle)", background: "var(--bg-surface)",
                                  color: "var(--text-secondary)", cursor: "pointer",
                                  display: "flex", alignItems: "center", justifyContent: "center",
                                  boxShadow: "-2px 0 16px rgba(0,0,0,0.15)",
                                  transition: "all 200ms",
                                }}
                                className="hover:bg-[var(--bg-hover)] hover:text-[var(--accent)]">
                                <ChevronRight size={22} />
                              </button>
                            )}

                          {/* Books — non-scrollable, fills remaining space */}
                          <DndContext sensors={noteSensors} collisionDetection={closestCenter}
                            onDragStart={() => {}} onDragEnd={handleDragEndNotes}>
                            <SortableContext items={pageNotesBS.map(n => n.id)} strategy={rectSortingStrategy}>
                          <div style={{
                            flex: 1, display: "flex", flexDirection: "column",
                            justifyContent: "center", gap: 8, padding: "0px 12px 0",
                            overflow: "hidden",
                          }}>
                            {bookshelfRows.map((row, ri) => (
                              <div key={ri} style={{ display: "flex", flexDirection: "column", width: "100%" }}>
                                <div style={{
                                  display: "flex", justifyContent: "space-evenly", alignItems: "flex-end",
                                  paddingBottom: 0, width: "100%", height: 218, gap: 4,
                                }}>
                                  {row.map((note) => {
                                    return (
                                      <BookshelfBook key={note.id} note={note}
                                        isSelected={selectedNoteId === note.id}
                                        folders={folders}
                                        onSelect={() => handleSelectNote(note.id)}
                                        onDoubleClick={handleOpenNote}
                                        onContextMenu={(e, br) => handleContextMenu(e, note.id, br)} />
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
                            {/* Pagination — compact numbered with overflow */}
                            {totalPagesBS > 1 && (
                              <div style={{
                                display: "flex", alignItems: "center", justifyContent: "center",
                                padding: "2px 0", gap: 1, flexShrink: 0,
                              }}>
                                {(() => {
                                  const total = totalPagesBS;
                                  const cur = safePageBS;
                                  const pages: (number | string)[] = [];
                                  if (total <= 7) {
                                    for (let i = 0; i < total; i++) pages.push(i);
                                  } else {
                                    pages.push(0);
                                    if (cur > 2) pages.push('...');
                                    const s = Math.max(1, cur - 1);
                                    const e = Math.min(cur + 1, total - 2);
                                    for (let i = s; i <= e; i++) pages.push(i);
                                    if (cur < total - 3) pages.push('...');
                                    pages.push(total - 1);
                                  }
                                  return (
                                    <>
                                      {cur > 0 && (
                                        <button onClick={() => setBookshelfPage(cur - 1)}
                                          style={{
                                            width: 24, height: 24, borderRadius: 5, border: "none",
                                            background: "transparent", color: "var(--text-tertiary)",
                                            cursor: "pointer", display: "flex", alignItems: "center",
                                            justifyContent: "center", fontSize: 12,
                                          }}
                                          className="hover:bg-[var(--bg-hover)]">
                                          <ChevronLeft size={12} />
                                        </button>
                                      )}
                                      {pages.map((p, idx) =>
                                        p === '...' ? (
                                          <span key={'e' + idx} style={{
                                            width: 16, textAlign: "center", fontSize: 10,
                                            color: "var(--text-tertiary)",
                                          }}>...</span>
                                        ) : (
                                          <button key={p} onClick={() => setBookshelfPage(p as number)}
                                            style={{
                                              minWidth: 22, height: 22, borderRadius: 5, border: "none",
                                              background: p === cur ? "var(--accent)" : "transparent",
                                              color: p === cur ? "#fff" : "var(--text-secondary)",
                                              cursor: "pointer", fontSize: 11.5,
                                              fontWeight: p === cur ? 700 : 500, padding: "0 4px",
                                            }}
                                            className={p !== cur ? "hover:bg-[var(--bg-hover)]" : ""}>
                                            {(p as number) + 1}
                                          </button>
                                        )
                                      )}
                                      {cur < total - 1 && (
                                        <button onClick={() => setBookshelfPage(cur + 1)}
                                          style={{
                                            width: 24, height: 24, borderRadius: 5, border: "none",
                                            background: "transparent", color: "var(--text-tertiary)",
                                            cursor: "pointer", display: "flex", alignItems: "center",
                                            justifyContent: "center", fontSize: 12,
                                          }}
                                          className="hover:bg-[var(--bg-hover)]">
                                          <ChevronRight size={12} />
                                        </button>
                                      )}
                                    </>
                                  );
                                })()}
                              </div>
                            )}
                            </div>
                            </SortableContext>
                          </DndContext>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                )}

                {/* ==================== LATERAL OVERLAY DRAWER PANEL ==================== */}
                {/* Slides in from right, uses app theme colors */}
                <div className="bento-card notes-lateral-drawer" style={{
                  position: "absolute", right: 0, top: 0, bottom: 0, padding: 0,
                  width: selectedNote ? (isMaximized ? "85%" : "48%") : 0,
                  opacity: selectedNote ? 1 : 0,
                  pointerEvents: selectedNote ? "all" : "none",
                  transform: selectedNote ? "translateX(0)" : "translateX(30px)",
                  transition: "all 300ms " + EASE,
                  zIndex: 80,
                  background: "var(--bg-elevated)",
                  borderLeft: "1px solid var(--border-strong)",
                  borderRadius: "16px 0 0 16px",
                  boxShadow: "-12px 0 40px rgba(0,0,0,0.25)",
                  display: "flex", flexDirection: "column", overflow: "hidden",
                }}>
                  {selectedNote && (
                    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
                      {/* Drawer Header (toolbar + tabs) — darker bg */}
                      <div className="notes-drawer-header">
                        {/* Drawer Toolbar */}
                        <div style={{
                          display: "flex", alignItems: "center", justifyContent: "space-between",
                          padding: "12px 16px", borderBottom: "1px solid var(--border-default)", gap: 10,
                        }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                            <button onClick={() => setSelectedNoteId(null)}
                              style={{
                                background: "none", border: "none", color: "var(--text-secondary)",
                                padding: 6, display: "flex", borderRadius: 6, cursor: "pointer",
                              }}
                              className="hover:bg-[var(--bg-hover)]">
                              <X size={15} />
                            </button>

                            {/* Note name */}
                            <span style={{
                              fontSize: 13, fontWeight: 600, color: "var(--text-primary)",
                              fontFamily: "'Inter Tight', sans-serif", overflow: "hidden",
                              textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0, maxWidth: 260,
                            }}>
                              {selectedNote.title || (selectedNote.content || '').slice(0, 60) || 'Nota sin título'}
                            </span>

                            {/* Maximize Toggle button */}
                            <button onClick={() => setIsMaximized(!isMaximized)}
                              style={{
                                background: "none", border: "1px solid var(--border-default)",
                                color: "var(--text-secondary)", padding: 6, borderRadius: 6,
                                display: "flex", cursor: "pointer", flexShrink: 0,
                              }}
                              className="hover:bg-[var(--bg-hover)]"
                              title={isMaximized ? "Restaurar vista" : "Ampliar vista"}>
                              {isMaximized ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
                            </button>
                          </div>

                          {/* Folder chip + quick actions */}
                          <div style={{ display: "flex", alignItems: "center", gap: 4, minWidth: 0 }}>
                            {(() => {
                              const fc = folders.find(f => f.id === selectedNote.folderId);
                              return (
                                <span style={{
                                  display: "inline-flex", alignItems: "center", gap: 5,
                                  fontSize: 10, fontWeight: 600, padding: "4px 10px", borderRadius: 7,
                                  background: fc ? fc.color + "12" : "var(--bg-hover)",
                                  color: fc ? fc.color : "var(--text-tertiary)",
                                  border: "1px solid " + (fc ? fc.color + "30" : "var(--border-default)"),
                                  maxWidth: 130, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flexShrink: 0,
                                }}>
                                  <FolderIcon size={11} />
                                  {fc ? fc.name : "Sin carpeta"}
                                </span>
                              );
                            })()}

                            <button onClick={() => updateNote(selectedNote.id, { isPinned: !selectedNote.isPinned })}
                              title={selectedNote.isPinned ? "Desfijar" : "Fijar"}
                              style={{
                                background: selectedNote.isPinned ? "rgba(245, 158, 11, 0.1)" : "none",
                                border: "1px solid " + (selectedNote.isPinned ? "#F59E0B" : "var(--border-default)"),
                                color: selectedNote.isPinned ? "#F59E0B" : "var(--text-secondary)",
                                width: 30, height: 30, borderRadius: 6, display: "flex", cursor: "pointer",
                                alignItems: "center", justifyContent: "center", flexShrink: 0,
                              }}>
                              <Star size={12} fill={selectedNote.isPinned ? "#F59E0B" : "none"} />
                            </button>

                            {(() => {
                              const fc = folders.find(f => f.id === selectedNote.folderId);
                              return (
                                <button onClick={() => setShowMoveModal(true)}
                                  title="Mover"
                                  style={{
                                    background: "none", border: "1px solid " + (fc ? fc.color + "30" : "var(--border-default)"),
                                    color: fc ? fc.color : "var(--text-secondary)",
                                    width: 30, height: 30, borderRadius: 6,
                                    display: "flex", cursor: "pointer", alignItems: "center", justifyContent: "center", flexShrink: 0,
                                  }}>
                                  <FolderIcon size={12} />
                                </button>
                              );
                            })()}

                            <button onClick={() => { handleSelectNote(selectedNote!.id); handleOpenNote(); }}
                              title="Editar"
                              style={{
                                background: "var(--accent)", color: "#fff", border: "none",
                                width: 30, height: 30, borderRadius: 6,
                                display: "flex", cursor: "pointer",
                                alignItems: "center", justifyContent: "center",
                                boxShadow: "0 2px 8px var(--accent-glow)",
                              }}>
                              <Edit3 size={12} />
                            </button>

                            <button onClick={() => setDeleteConfirmNoteId(selectedNote!.id)}
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
                          display: "flex", gap: 2,
                          borderBottom: "1px solid var(--border-default)", padding: "0 12px",
                          background: "var(--bg-elevated)",
                        }}>
                          {["contenido", "informacion", "historial"].map((tab) => (
                            <button key={tab} onClick={() => setDrawerTab(tab as any)}
                              style={{
                                padding: "10px 12px", border: "none", background: drawerTab === tab ? "var(--bg-surface)" : "none",
                                color: drawerTab === tab ? "var(--accent)" : "var(--text-tertiary)",
                                fontSize: 11.5, fontWeight: 600, cursor: "pointer",
                                borderRadius: "8px 8px 0 0",
                                textTransform: "capitalize", transition: "all 150ms",
                                marginBottom: -1, borderBottom: "2px solid " + (drawerTab === tab ? "var(--accent)" : "transparent"),
                              }}
                              className={drawerTab !== tab ? "hover:text-[var(--text-secondary)]" : ""}>
                              {tab === "contenido" ? "Contenido" : tab === "informacion" ? "Metadatos" : "Historial"}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Tab panel content */}
                      <div className="notes-drawer-content" style={{ flex: 1, overflow: "auto", padding: "16px 20px 24px" }}>
                        {drawerTab === "contenido" && (
                          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            <h2 style={{
                              fontFamily: "'Inter Tight', sans-serif", fontSize: 30, fontWeight: 200,
                              color: "var(--text-primary)", margin: 0, letterSpacing: "-0.03em",
                              lineHeight: 1.15,
                            }}>
                              {selectedNote.title}
                            </h2>

                            {/* HTML math formatted preview content */}
                            <div onClick={(e) => {
                              const t = e.target as HTMLElement;
                              if (t.tagName === "A") {
                                const href = (t as HTMLAnchorElement).getAttribute("href");
                                if (href && (href.startsWith("http://") || href.startsWith("https://"))) {
                                  e.preventDefault();
                                  setLinkPreviewUrl(href);
                                  setLinkPreviewError(false);
                                }
                              }
                            }}>
                              <div
                                dangerouslySetInnerHTML={{ __html: formatMathContent(selectedNote.content) }}
                                style={{
                                  fontSize: 14, lineHeight: 1.8, color: "var(--text-primary)",
                                  fontFamily: "'Inter', system-ui, sans-serif",
                                  padding: "4px 0",
                                }}
                                className="notes-preview-area"
                              />
                            </div>

                            {/* Attachments */}
                            {selectedNote.attachments && selectedNote.attachments.length > 0 && (
                              <div style={{ marginTop: 12 }}>
                                <h4 style={{ fontSize: 10, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Adjuntos</h4>
                                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                  {selectedNote.attachments.map(att => {
                                    const isPdf = att.type === 'pdf' || att.name.toLowerCase().endsWith('.pdf');
                                    const isImg = att.type === 'image' || att.name.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i);
                                    const isAudio = att.type === 'audio' || att.name.match(/\.(mp3|wav|ogg|m4a|flac)$/i);
                                    const isVideo = att.type === 'video' || att.name.match(/\.(mp4|webm|mov)$/i);
                                    const isLink = att.dataUrl?.startsWith('http');
                                    const isOffice = att.name.match(/\.(doc|docx|xls|xlsx|ppt|pptx)$/i);
                                    return (
                                      <div key={att.id} style={{
                                        display: "flex", alignItems: "center", gap: 8, padding: "8px 10px",
                                        background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)",
                                        borderRadius: 8, fontSize: 11.5, transition: "border-color 150ms",
                                      }} className="hover:border-[var(--accent)]">
                                        {isPdf ? (
                                          <FileText size={14} style={{ color: "#EF4444", flexShrink: 0 }} />
                                        ) : isImg ? (
                                          <ImageIcon size={14} style={{ color: "#3B82F6", flexShrink: 0 }} />
                                        ) : isAudio ? (
                                          <Music size={14} style={{ color: "#10B981", flexShrink: 0 }} />
                                        ) : isVideo ? (
                                          <Camera size={14} style={{ color: "#8B5CF6", flexShrink: 0 }} />
                                        ) : isLink ? (
                                          <Link size={14} style={{ color: "var(--accent)", flexShrink: 0 }} />
                                        ) : (
                                          <File size={13} style={{ color: "var(--text-tertiary)", flexShrink: 0 }} />
                                        )}
                                        <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--text-primary)", fontSize: 11, fontWeight: 500 }}>{att.name}</span>
                                        <span style={{ fontSize: 9, color: "var(--text-tertiary)", flexShrink: 0 }}>
                                          {isLink ? '' : (att.size / 1024).toFixed(0) + ' KB'}
                                        </span>
                                        <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
                                          {(isImg || isPdf) && (
                                            <button onClick={(e) => { e.stopPropagation(); openFileSmart(att.dataUrl, att.name); }}
                                              style={{ width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center", border: "none", background: "transparent", color: "var(--text-tertiary)", cursor: "pointer", borderRadius: 4 }}
                                              className="hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]" title="Vista previa">
                                              <Eye size={11} />
                                            </button>
                                          )}
                                          {isLink && (
                                            <a href={att.dataUrl} target="_blank" rel="noopener noreferrer"
                                              style={{ width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-tertiary)", borderRadius: 4 }}
                                              className="hover:bg-[var(--bg-hover)] hover:text-[var(--accent)]" title="Abrir enlace">
                                              <ExternalLink size={11} />
                                            </a>
                                          )}
                                          <button onClick={(e) => {
                                            e.stopPropagation();
                                            const a = document.createElement('a');
                                            a.href = att.dataUrl;
                                            a.download = att.name;
                                            a.click();
                                          }}
                                            style={{ width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center", border: "none", background: "transparent", color: "var(--text-tertiary)", cursor: "pointer", borderRadius: 4 }}
                                            className="hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]" title="Descargar">
                                            <Download size={11} />
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {drawerTab === "informacion" && (
                          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                            {/* Folder / Course card */}
                            {selectedNote.course && (() => {
                              const currentFolder = folders.find(f => f.id === selectedNote.folderId);
                              const fc = selectedNote.coverColor || currentFolder?.color || selectedNote.courseColor || "var(--accent)";
                              return (
                                <div style={{
                                  display: "flex", alignItems: "center", gap: 10,
                                  padding: "12px 14px",
                                  background: "var(--bg-elevated)", borderRadius: "var(--radius-md)",
                                  border: "1px solid " + fc + "20",
                                }}>
                                  <div style={{
                                    width: 32, height: 32, borderRadius: 8,
                                    background: fc + "18", display: "flex", alignItems: "center", justifyContent: "center",
                                    border: "1px solid " + fc + "25", flexShrink: 0,
                                  }}>
                                    <BookOpen size={15} style={{ color: fc }} />
                                  </div>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 9, fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                                      Carpeta
                                    </div>
                                    <div style={{ fontSize: 14, fontWeight: 700, color: fc }}>
                                      {selectedNote.course}
                                    </div>
                                  </div>
                                </div>
                              );
                            })()}
                            {/* Stats grid */}
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
                              {selectedNote.tags && selectedNote.tags.length > 0 && (
                                <div style={{
                                  padding: "10px 12px", background: "var(--bg-elevated)",
                                  borderRadius: "var(--radius-md)", border: "1px solid var(--border-soft)",
                                }}>
                                  <div style={{ fontSize: 9, color: "var(--text-tertiary)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4, display: "flex", alignItems: "center", gap: 3 }}>
                                    <Hash size={10} /> Etiquetas
                                  </div>
                                  <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                                    {selectedNote.tags.map(t => {
                                      const tc = mergedTagColors[t] || "var(--accent)";
                                      return (
                                        <span key={t} style={{
                                          fontSize: 10, fontWeight: 600, padding: "1px 5px",
                                          borderRadius: 3, background: tc + "18", color: tc,
                                        }}>{t}</span>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                            {/* Timestamps */}
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

                        {drawerTab === "historial" && (() => {
                          type VersionEntry = { timestamp: string; preview: string; wordCount: number; content?: string };
                          let versions: VersionEntry[] = [];
                          try {
                            const parsed = JSON.parse(localStorage.getItem("owa_note_versions_" + selectedNote.id) || "[]");
                            if (Array.isArray(parsed)) versions = parsed;
                          } catch {}
                          return (
                            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                              <div style={{ position: "relative", paddingLeft: 22 }}>
                                <div style={{
                                  position: "absolute", left: 10, top: 10, bottom: 8,
                                  width: 2, background: "var(--border-subtle)",
                                  opacity: 0.35, borderRadius: 2,
                                }} />
                                {versions.length === 0 ? (
                                  <div style={{ padding: "10px 12px", fontSize: 12, color: "var(--text-tertiary)" }}>
                                    Aún no hay cambios guardados.
                                  </div>
                                ) : (
                                  versions.map((v, i) => (
                                    <div key={v.timestamp} style={{ position: "relative", paddingBottom: i < versions.length - 1 ? 12 : 0 }}>
                                      <div style={{
                                        position: "absolute", left: -16, top: 5, width: 8, height: 8,
                                        borderRadius: "50%",
                                        background: i === 0 ? "var(--accent)" : "var(--border-default)",
                                        border: "2px solid var(--bg-surface)",
                                        boxShadow: i === 0 ? "0 0 0 3px var(--accent-glow)" : "none",
                                        zIndex: 2,
                                      }} />
                                      <div style={{
                                        marginLeft: 2, padding: "10px 12px",
                                        background: i === 0 ? "var(--bg-elevated)" : "transparent",
                                        borderRadius: "var(--radius-md)",
                                        border: i === 0 ? "1px solid var(--border-soft)" : "none",
                                      }}>
                                        <div style={{ fontSize: 10.5, fontWeight: 600, color: "var(--text-primary)", marginBottom: 1 }}>
                                          {safeFormat(v.timestamp, "d MMM HH:mm")}
                                        </div>
                                        <div style={{ fontSize: 10, color: "var(--text-tertiary)", lineHeight: 1.4 }}>
                                          {v.preview}
                                        </div>
                                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                                          <span style={{ fontSize: 9, color: "var(--text-muted)" }}>
                                            {v.wordCount} palabras
                                          </span>
                                          {v.content && (
                                            <button onClick={(e) => {
                                              e.stopPropagation();
                                              const currentHtml = editorRef.current?.innerHTML || selectedNote.content;
                                              if (currentHtml === v.content) {
                                                toast("Ya estás en esta versión", { icon: "ℹ️", duration: 2000 });
                                              } else {
                                                if (editorRef.current) {
                                                  editorRef.current.innerHTML = v.content!;
                                                }
                                                lastContentRef.current = v.content!.replace(/<[^>]+>/g, "").trim();
                                                toast.success("Versión restaurada");
                                              }
                                              setSaveStatus("pending");
                                            }}
                                              style={{
                                                fontSize: 9, fontWeight: 600, padding: "1px 6px",
                                                border: "1px solid var(--border-soft)",
                                                borderRadius: 4, background: "transparent",
                                                color: "var(--accent)", cursor: "pointer",
                                                lineHeight: "18px",
                                              }}>
                                              Restaurar
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  ))
                                )}
                              </div>
                              <div style={{ position: "relative", paddingLeft: 22 }}>
                                <div style={{
                                  position: "absolute", left: -14, top: 5, width: 7, height: 7,
                                  borderRadius: "50%", background: "var(--border-default)",
                                  border: "2px solid var(--bg-surface)", zIndex: 2,
                                }} />
                                <div style={{ marginLeft: 2, padding: "6px 12px" }}>
                                  <div style={{ fontSize: 10.5, fontWeight: 600, color: "var(--text-secondary)" }}>Nota creada</div>
                                  <div style={{ fontSize: 10, color: "var(--text-tertiary)" }}>
                                    {safeFormat(selectedNote.createdAt, "d MMM yyyy, HH:mm")}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })()}
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
          position: "fixed", inset: 0, zIndex: 10001,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "rgba(0,0,0,0.5)",
        }} onClick={() => { setShowIconPicker(false); setIconPickerTarget(null); }}>
          <div onClick={e => e.stopPropagation()}>
            <IconPicker
              currentIcon={notes.find(n => n.id === iconPickerTarget)?.coverImage}
              currentColor={notes.find(n => n.id === iconPickerTarget)?.coverColor}
              noteTitle={notes.find(n => n.id === iconPickerTarget)?.title}
               onSelect={(ico, col) => {
                 if (iconPickerTarget) updateNoteVisual(iconPickerTarget, { coverImage: ico, coverColor: col });
               }}
              onClose={() => { setShowIconPicker(false); setIconPickerTarget(null); }}
            />
          </div>
        </div>
      )}

      {/* ===== CONTEXT MENU ===== */}
      {contextMenu && (
        <div style={{
          position: "fixed", top: contextMenu.y, left: contextMenu.x, zIndex: 10000,
          background: "linear-gradient(135deg, var(--bg-surface) 0%, var(--bg-base) 100%)",
          border: "1px solid var(--border-default)",
          borderRadius: "var(--radius-md)", padding: 4, minWidth: 164,
          boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
        }}>
          <div style={contextMenu.arrowBottom ? {
            position: "absolute", bottom: -5, left: contextMenu.arrowY,
            width: 8, height: 8, borderRadius: 1,
            background: "var(--bg-surface)",
            borderLeft: "1px solid var(--border-default)",
            borderTop: "1px solid var(--border-default)",
            transform: 'rotate(225deg)',
          } : contextMenu.arrowTop ? {
            position: "absolute", top: -5, left: contextMenu.arrowY,
            width: 8, height: 8, borderRadius: 1,
            background: "var(--bg-surface)",
            borderLeft: "1px solid var(--border-default)",
            borderTop: "1px solid var(--border-default)",
            transform: 'rotate(45deg)',
          } : {
            position: "absolute",
            top: contextMenu.arrowY,
            [contextMenu.arrowLeft ? 'right' : 'left']: -5,
            width: 8, height: 8,
            background: "var(--bg-surface)",
            borderLeft: "1px solid var(--border-default)",
            borderTop: "1px solid var(--border-default)",
            transform: contextMenu.arrowLeft ? 'rotate(135deg)' : 'rotate(315deg)',
            borderRadius: 1,
          }} />
          {[
            { label: "Editar", icon: Edit3, action: () => { setSelectedNoteId(contextMenu.noteId); setContextMenu(null); setIsEditing(true); } },
            { type: "divider" as const },
            { label: "Editar icono", icon: ImageIcon, action: () => { const target = notes.find(n => n.id === contextMenu.noteId); if (target) { setIconPickerTarget(contextMenu.noteId); setShowIconPicker(true); } } },
            { label: "Duplicar", icon: Copy, action: handleDuplicate },
            { type: "divider" as const },
            { label: "Exportar PDF", icon: Download, action: handleExportPDF },
            { type: "divider" as const },
            { label: "Eliminar", icon: Trash2, action: () => { if (contextMenu) setDeleteConfirmNoteId(contextMenu.noteId); }, danger: true },
          ].map((item, i) => {
            if ("type" in item) return <div key={i} style={{ height: 1, background: "var(--border-default)", margin: "4px 6px" }} />;
            const Icon = item.icon;
            return (
              <button key={i} onClick={() => { item.action(); setContextMenu(null); }}
                style={{
                  display: "flex", alignItems: "center", gap: 8, width: "100%",
                  padding: "7px 10px", background: "none", border: "none",
                  borderRadius: "var(--radius-sm)",
                  color: (item as any).danger ? "var(--error)" : "var(--text-secondary)",
                  cursor: "pointer", fontSize: 12.5, textAlign: "left", transition: "all 150ms",
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
      {deleteConfirmNoteId && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 10001,
          background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }} onClick={() => setDeleteConfirmNoteId(null)}>
          <div style={{
            background: "linear-gradient(135deg, var(--bg-surface) 0%, var(--bg-base) 100%)",
            border: "1px solid var(--border-default)",
            borderRadius: 14, padding: 24, minWidth: 300, maxWidth: 380,
            boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <AlertTriangle size={18} style={{ color: "#EF4444", flexShrink: 0 }} />
              <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", margin: 0, fontFamily: "'Inter Tight', sans-serif" }}>
                Eliminar nota
              </h3>
            </div>
            <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: 0, lineHeight: 1.5 }}>
              ¿Estás seguro de eliminar esta nota? Se moverá a la papelera.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
              <button onClick={() => setDeleteConfirmNoteId(null)}
                style={{
                  background: "none", border: "1px solid var(--border-default)", borderRadius: 8,
                  padding: "7px 16px", color: "var(--text-secondary)", fontSize: 11, cursor: "pointer",
                  fontFamily: "'Inter', sans-serif", fontWeight: 500,
                }}>Cancelar</button>
              <button onClick={handleDeleteNote}
                style={{
                  background: "#EF4444", color: "#fff", border: "none", borderRadius: 8,
                  padding: "7px 16px", fontSize: 11, fontWeight: 600, cursor: "pointer",
                  fontFamily: "'Inter', sans-serif",
                }}>Eliminar</button>
            </div>
          </div>
        </div>
      )}

      {/* ===== MOVE FOLDER MODAL ===== */}
      {showMoveModal && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 10001,
          background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }} onClick={() => setShowMoveModal(false)}>
          <div onClick={e => e.stopPropagation()} style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border-default)",
            borderRadius: 16, padding: "20px 0 0", minWidth: 320, maxWidth: 380,
            boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
            overflow: "hidden",
          }}>
            <div style={{ padding: "0 20px 16px" }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", margin: 0, fontFamily: "var(--font-heading)", letterSpacing: "-0.01em" }}>
                Mover a carpeta
              </h3>
              <p style={{ fontSize: 12, color: "var(--text-tertiary)", margin: "4px 0 0" }}>
                Selecciona el destino para este cuaderno
              </p>
            </div>
            <div style={{ maxHeight: 260, overflow: "auto", padding: "0 8px" }}>
              <button onClick={() => { handleMoveToFolder(undefined); setShowMoveModal(false); }}
                style={{
                  display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "9px 12px",
                  background: "transparent", border: "none", borderRadius: 8,
                  color: "var(--text-secondary)", cursor: "pointer", fontSize: 12.5, fontWeight: 500, textAlign: "left",
                  transition: "all 150ms",
                }}
                className="hover:bg-[var(--bg-hover)]">
                <div style={{
                  width: 20, height: 20, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center",
                  background: "var(--bg-deep)", border: "1px solid var(--border-subtle)",
                }}>
                  <Layers size={12} style={{ color: "var(--text-tertiary)" }} />
                </div>
                <span>Sin carpeta</span>
              </button>
              <div style={{ height: 1, background: "var(--border-subtle)", margin: "4px 0" }} />
              {folders.map((f) => (
                <button key={f.id} onClick={() => { handleMoveToFolder(f.id); setShowMoveModal(false); }}
                  style={{
                    display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "9px 12px",
                    background: "transparent", border: "none", borderRadius: 8,
                    color: "var(--text-secondary)", cursor: "pointer", fontSize: 12.5, fontWeight: 500, textAlign: "left",
                    transition: "all 150ms",
                  }}
                  className="hover:bg-[var(--bg-hover)]">
                  <div style={{
                    width: 20, height: 20, borderRadius: 6, flexShrink: 0,
                    background: f.color + "18", display: "flex", alignItems: "center", justifyContent: "center",
                    border: "1px solid " + f.color + "25",
                  }}>
                    <FolderIcon size={11} style={{ color: f.color }} />
                  </div>
                  <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
                  <span style={{
                    fontSize: 9.5, color: "var(--text-tertiary)", background: "var(--bg-hover)",
                    padding: "1px 6px", borderRadius: 4, fontWeight: 650,
                  }}>{notes.filter(n => n.folderId === f.id && !n.deletedAt).length}</span>
                </button>
              ))}
            </div>
            <div style={{ padding: "12px 20px", borderTop: "1px solid var(--border-subtle)", display: "flex", justifyContent: "flex-end" }}>
              <button onClick={() => setShowMoveModal(false)}
                style={{
                  background: "var(--accent)", color: "#fff", border: "none", borderRadius: 8,
                  padding: "8px 20px", fontSize: 12.5, fontWeight: 600, cursor: "pointer",
                  transition: "all 150ms",
                }}
                className="hover:opacity-90">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* ===== LINK PASTE CONFIRMATION ===== */}
      {pendingLink && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 10002,
          background: "rgba(0,0,0,0.5)", backdropFilter: "blur(6px)",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: 24,
        }} onClick={() => setPendingLink(null)}>
          <div onClick={e => e.stopPropagation()} style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border-default)",
            borderRadius: 14, padding: "20px 24px",
            maxWidth: 440, width: "100%",
            boxShadow: "0 16px 64px rgba(0,0,0,0.3)",
            display: "flex", flexDirection: "column", gap: 12,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Link size={16} style={{ color: "var(--accent)" }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>Enlace detectado</span>
            </div>
            <div style={{
              padding: "8px 12px", background: "var(--bg-elevated)",
              borderRadius: 8, fontSize: 11.5, color: "var(--accent)",
              wordBreak: "break-all", border: "1px solid var(--border-subtle)",
            }}>{pendingLink}</div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
              <button onClick={() => setPendingLink(null)}
                style={{
                  padding: "6px 14px", borderRadius: 8, border: "1px solid var(--border-default)",
                  background: "transparent", color: "var(--text-secondary)", fontSize: 11.5,
                  cursor: "pointer", fontWeight: 500,
                }}
                className="hover:bg-[var(--bg-hover)]">
                Descartar
              </button>
              <button onClick={() => {
                if (editorRef.current) {
                  document.execCommand("insertHTML", false,
                    `<div class="notes-attachment"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg><a href="${pendingLink}" target="_blank">${pendingLink}</a><span class="att-meta">Enlace</span></div>`);
                  setSaveStatus("pending");
                  if (selectedNote) updateNote(selectedNote.id, { content: editorRef.current.innerHTML });
                }
                setPendingLink(null);
              }}
                style={{
                  padding: "6px 14px", borderRadius: 8, border: "none",
                  background: "var(--accent)", color: "var(--text-on-accent, #fff)", fontSize: 11.5,
                  cursor: "pointer", fontWeight: 600,
                }}>
                Agregar enlace
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== LINK WEB PREVIEW ===== */}
      {linkPreviewUrl && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 10002,
          background: "rgba(0,0,0,0.65)", backdropFilter: "blur(8px)",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: 24,
        }} onClick={() => setLinkPreviewUrl(null)}>
          <div onClick={e => e.stopPropagation()} style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border-default)",
            borderRadius: 16, width: "90%", maxWidth: 900, height: "85%",
            display: "flex", flexDirection: "column", overflow: "hidden",
            boxShadow: "0 24px 80px rgba(0,0,0,0.4)",
          }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "10px 14px", borderBottom: "1px solid var(--border-soft)",
              background: "var(--bg-elevated)", flexShrink: 0,
            }}>
              <Globe size={14} style={{ color: "var(--text-tertiary)", flexShrink: 0 }} />
              <div style={{
                flex: 1, fontSize: 12, color: "var(--text-secondary)",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>{linkPreviewUrl}</div>
              <a href={linkPreviewUrl} target="_blank" rel="noopener noreferrer"
                style={{
                  fontSize: 11, fontWeight: 600, padding: "4px 10px",
                  border: "1px solid var(--border-default)", borderRadius: 6,
                  color: "var(--accent)", textDecoration: "none", flexShrink: 0,
                }}
                className="hover:bg-[var(--bg-hover)]">
                Abrir
              </a>
              <button onClick={() => setLinkPreviewUrl(null)}
                style={{
                  width: 26, height: 26, flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  border: "none", background: "transparent",
                  color: "var(--text-tertiary)", cursor: "pointer", borderRadius: 6,
                }}
                className="hover:bg-[var(--bg-hover)]">
                <X size={14} />
              </button>
            </div>
            <div style={{ flex: 1, position: "relative", background: "#fff" }}>
              {linkPreviewError ? (
                <div style={{
                  display: "flex", flexDirection: "column", alignItems: "center",
                  justifyContent: "center", height: "100%", gap: 8,
                  color: "var(--text-tertiary)", padding: 24,
                }}>
                  <Globe size={32} style={{ opacity: 0.3 }} />
                  <span style={{ fontSize: 13, fontWeight: 600 }}>No se puede previsualizar</span>
                  <span style={{ fontSize: 11, textAlign: "center", maxWidth: 400 }}>
                    Este sitio no permite ser incrustado.
                    <br />
                    <a href={linkPreviewUrl} target="_blank" rel="noopener noreferrer"
                      style={{ color: "var(--accent)", fontWeight: 600 }}>Abrir en nueva pestaña</a>
                  </span>
                </div>
              ) : (
                <iframe
                  src={linkPreviewUrl}
                  style={{ width: "100%", height: "100%", border: "none" }}
                  title="Vista previa de enlace"
                  sandbox="allow-scripts allow-same-origin allow-forms"
                  onError={() => setLinkPreviewError(true)}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===== IMAGE LIGHTBOX ===== */}
      {lightboxImage && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 10003,
          background: "rgba(0,0,0,0.85)", backdropFilter: "blur(12px)",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: 24,
        }} onClick={() => setLightboxImage(null)}>
          <div onClick={e => e.stopPropagation()} style={{
            position: "relative", display: "flex", alignItems: "center", justifyContent: "center",
            maxWidth: "90vw", maxHeight: "90vh",
          }}>
            <img src={lightboxImage.src} alt=""
              style={{
                maxWidth: "100%", maxHeight: "85vh", borderRadius: 8,
                boxShadow: "0 8px 40px rgba(0,0,0,0.5)",
                objectFit: "contain",
              }}
            />
            <button onClick={() => setLightboxImage(null)}
              style={{
                position: "absolute", top: -12, right: -12, width: 32, height: 32,
                borderRadius: "50%", border: "none", background: "var(--bg-elevated)",
                color: "var(--text-secondary)", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "0 2px 12px rgba(0,0,0,0.3)",
              }}>
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ===== FILE PREVIEW (PDF / Image) ===== */}
      {previewFile && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 10003,
          background: "rgba(0,0,0,0.8)", backdropFilter: "blur(10px)",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: 24,
        }} onClick={() => setPreviewFile(null)}>
          <div onClick={e => e.stopPropagation()} style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border-default)",
            borderRadius: 14, width: "90%", maxWidth: 800, height: "85%",
            display: "flex", flexDirection: "column", overflow: "hidden",
            boxShadow: "0 24px 80px rgba(0,0,0,0.4)",
          }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "10px 14px", borderBottom: "1px solid var(--border-soft)",
              background: "var(--bg-elevated)", flexShrink: 0,
            }}>
              {previewFile.type === 'pdf' ? (
                <FileText size={14} style={{ color: "#EF4444", flexShrink: 0 }} />
              ) : (
                <Eye size={14} style={{ color: "var(--accent)", flexShrink: 0 }} />
              )}
              <span style={{ flex: 1, fontSize: 12, color: "var(--text-primary)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {previewFile.name}
              </span>
              <button onClick={() => {
                const a = document.createElement('a');
                a.href = previewFile.url;
                a.download = previewFile.name;
                a.click();
              }} style={{
                fontSize: 11, fontWeight: 600, padding: "4px 10px",
                border: "1px solid var(--border-default)", borderRadius: 6,
                color: "var(--text-primary)", background: "transparent", cursor: "pointer",
              }} className="hover:bg-[var(--bg-hover)]">
                <Download size={12} /> Descargar
              </button>
              <button onClick={() => setPreviewFile(null)}
                style={{
                  width: 26, height: 26, flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  border: "none", background: "transparent",
                  color: "var(--text-tertiary)", cursor: "pointer", borderRadius: 6,
                }}
                className="hover:bg-[var(--bg-hover)]">
                <X size={14} />
              </button>
            </div>
            <div style={{ flex: 1, position: "relative", background: "var(--bg-canvas)" }}>
              {previewFile.type === 'pdf' ? (
                <object data={previewFile.url} type="application/pdf" style={{ width: "100%", height: "100%", border: "none" }} aria-label={previewFile.name}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 12, color: "var(--text-tertiary)" }}>
                    <FileText size={40} style={{ opacity: 0.3 }} />
                    <span>No se puede previsualizar este PDF</span>
                    <a href={previewFile.url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent)", fontWeight: 600, fontSize: 12 }}>Abrir PDF</a>
                  </div>
                </object>
              ) : (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", padding: 16 }}>
                  <img src={previewFile.url} alt={previewFile.name} style={{ maxWidth: "100%", maxHeight: "100%", borderRadius: 6, objectFit: "contain" }} />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ====== SIDEBAR SUB-COMPONENT ====== */
function SortableFolderRow({ f, children }: { f: NoteFolder; children: (props: { attributes: any; listeners: any; setNodeRef: any; style: any; isDragging: boolean }) => React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: f.id });
  const style = { transform: CSS.Translate.toString(transform), transition, zIndex: isDragging ? 10 : 'auto', opacity: isDragging ? 0.4 : 1 };
  return <div ref={setNodeRef} style={style}>{children({ attributes, listeners, setNodeRef, style, isDragging })}</div>;
}

function SortableTagRow({ tag, children }: { tag: string; children: (props: { attributes: any; listeners: any; setNodeRef: any; style: any; isDragging: boolean }) => React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: tag });
  const style = { transform: CSS.Translate.toString(transform), transition, zIndex: isDragging ? 10 : 'auto', opacity: isDragging ? 0.4 : 1 };
  return <div ref={setNodeRef} style={style}>{children({ attributes, listeners, setNodeRef, style, isDragging })}</div>;
}

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
  editFolderId: string | null;
  setEditFolderId: (id: string | null) => void;
  editFolderName: string;
  setEditFolderName: (name: string) => void;
  editFolderColor: string;
  setEditFolderColor: (color: string) => void;
  tagColorEdit: string | null;
  setTagColorEdit: (tag: string | null) => void;
  editTagName: string;
  setEditTagName: (name: string) => void;
  deleteFolderId: string | null;
  setDeleteFolderId: (id: string | null) => void;
  deleteFolderName: string;
  setDeleteFolderName: (name: string) => void;
  deletedFolderIds: Set<string>;
  setDeletedFolderIds: (set: Set<string> | ((prev: Set<string>) => Set<string>)) => void;
  mergedTagColors: Record<string, string>;
  onTagColorsChange: (colors: Record<string, string>) => void;
  onTagReorder: (tags: string[]) => void;
}

function LibrarySidebar({
  folders, notes, selectedFolderId, selectedTag,
  onSelectFolder, onSelectTag, onNewFolder, onNewTag,
  activeSidebarTab, setActiveSidebarTab,
  editFolderId, setEditFolderId, editFolderName, setEditFolderName, editFolderColor, setEditFolderColor,
  tagColorEdit, setTagColorEdit, editTagName, setEditTagName,
  deleteFolderId, setDeleteFolderId, deleteFolderName, setDeleteFolderName,
  deletedFolderIds, setDeletedFolderIds,
  mergedTagColors,
  onTagColorsChange,
  onTagReorder,
}: LibrarySidebarProps) {
  const { reorderFolders, deleteNoteFolder, updateNoteFolder, updateNote, addNotification, courses } = useApp();
  const [showTagSection, setShowTagSection] = useState(true);
  const [activeFolderDragId, setActiveFolderDragId] = useState<string | null>(null);
  const [activeTagDragId, setActiveTagDragId] = useState<string | null>(null);
  const [showTagDeleteConfirm, setShowTagDeleteConfirm] = useState(false);
  const [localTagOrder, setLocalTagOrder] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("owa_tag_order") || "[]"); } catch { return []; }
  });
  const folderSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );
  const tagSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );
  const handleFolderDragEnd = useCallback((event: any) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const ids = folders.map(f => f.id);
      const oldIndex = ids.indexOf(active.id);
      const newIndex = ids.indexOf(over.id);
      const newIds = arrayMove([...ids], oldIndex, newIndex);
      reorderFolders(newIds);
    }
    setActiveFolderDragId(null);
  }, [folders, reorderFolders]);

  const handleTagDragEnd = useCallback((event: any) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = localTagOrder.indexOf(active.id);
      const newIndex = localTagOrder.indexOf(over.id);
      const newOrder = arrayMove([...localTagOrder], oldIndex, newIndex);
      setLocalTagOrder(newOrder);
      localStorage.setItem("owa_tag_order", JSON.stringify(newOrder));
      onTagReorder(newOrder);
    }
    setActiveTagDragId(null);
  }, [localTagOrder, onTagReorder]);

  // Retrieve custom tag colors from LocalStorage (persisted via modal close)
  const tagColors = useMemo(() => {
    try {
      const saved = localStorage.getItem("owa_custom_tag_colors");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  }, [tagColorEdit, mergedTagColors]);

  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    notes.forEach((n) => n.tags?.forEach((t) => tagSet.add(t)));
    try {
      const orphan = JSON.parse(localStorage.getItem("owa_created_tags") || "[]");
      orphan.forEach((t: string) => tagSet.add(t));
    } catch {}
    const tags = Array.from(tagSet);
    if (localTagOrder.length > 0) {
      const orderMap = new Map(localTagOrder.map((t, i) => [t, i]));
      tags.sort((a, b) => {
        const ai = orderMap.get(a);
        const bi = orderMap.get(b);
        if (ai !== undefined && bi !== undefined) return ai - bi;
        if (ai !== undefined) return -1;
        if (bi !== undefined) return 1;
        return a.localeCompare(b);
      });
    }
    return tags;
  }, [notes, localTagOrder]);

const trashCount = notes.filter(n => n.deletedAt).length;

  return (
    <div style={{
      width: 260, minWidth: 260, display: "flex", flexDirection: "column",
      padding: "20px 14px 14px 20px", overflow: "hidden",
      borderRight: "1px solid var(--border-subtle)",
      flex: 1, minHeight: 0,
    }}>
      <style dangerouslySetInnerHTML={{__html: `
        .sidebar-scroll-notas::-webkit-scrollbar { display: none; }
        .sidebar-scroll-notas { scrollbar-width: none; -ms-overflow-style: none; }
      `}} />
      <div className="sidebar-scroll-notas" style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 12 }}>

        {/* CARPETAS */}
        <div>
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            marginBottom: 8, paddingLeft: 4,
          }}>
            <span style={{
              fontSize: 13, fontWeight: 700, color: "var(--text-primary)",
              letterSpacing: "0.06em", textTransform: "uppercase",
            }}>Carpetas</span>
            <button onClick={onNewFolder} title="Nueva carpeta"
              style={{
                width: 26, height: 26,
                display: "flex", alignItems: "center", justifyContent: "center",
                background: "transparent", border: "1px solid var(--border-subtle)",
                borderRadius: 6, color: "var(--accent)", cursor: "pointer", padding: 0,
                transition: "all 150ms",
              }}
              className="hover:border-[var(--accent)] hover:bg-[var(--accent-dim)]">
              <Plus size={14} />
            </button>
          </div>

          <DndContext sensors={folderSensors} collisionDetection={closestCenter} onDragStart={e => setActiveFolderDragId(e.active.id as string)} onDragEnd={handleFolderDragEnd} modifiers={[restrictToParentElement]}>
            <SortableContext items={folders.map(f => f.id)} strategy={verticalListSortingStrategy}>
              <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                {folders.filter(f => !deletedFolderIds.has(f.id)).map((f) => {
                  const count = notes.filter((n) => n.folderId === f.id && !n.deletedAt).length;
                  const isSel = selectedFolderId === f.id;
                  const isDragging = activeFolderDragId === f.id;
                  return (
                    <SortableFolderRow key={f.id} f={f}>
                      {({ attributes, listeners, setNodeRef, style: dndStyle }) => (
                        <div ref={setNodeRef} className="folder-sidebar-item hover:bg-[var(--bg-hover)]" style={{ ...dndStyle, display: "flex", alignItems: "center", gap: 10, width: "100%",
                          padding: "10px 14px 10px 6px",
                          background: isSel ? "var(--bg-hover)" : "transparent",
                          border: isSel ? "1px solid var(--border-soft)" : "1px solid transparent",
                          borderLeft: isSel ? "2px solid " + f.color : "2px solid transparent",
                          borderRadius: "var(--radius-md)",
                          cursor: "pointer", fontSize: 13.5, fontWeight: 500,
                          textAlign: "left", transition: "all 200ms " + EASE,
                          color: isSel ? f.color : "var(--text-secondary)", opacity: isDragging ? 0.4 : 1,
                        }}
                          {...attributes} {...listeners}
                          onClick={() => { setActiveSidebarTab("folder_" + f.id); onSelectFolder(selectedFolderId === f.id ? null : f.id); onSelectTag(null); }}>
                          <div style={{
                            width: 24, height: 24, borderRadius: 6, flexShrink: 0,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            background: isSel
                              ? f.color + "20"
                              : f.color + "0d",
                            border: "1px solid " + f.color + (isSel ? "35" : "15"),
                            boxShadow: isSel ? "0 0 0 1px " + f.color + "30" : "none",
                            transition: "all 200ms " + EASE,
                          }}>
                            <FolderIcon size={12} style={{ color: isSel ? f.color : f.color + "cc" }} />
                          </div>
                          <span style={{
                            flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                            fontWeight: 500, fontSize: 13.5,
                          }}>{f.name}</span>
                          <span style={{
                            flexShrink: 0, fontSize: 10, fontWeight: 480, lineHeight: 1.3,
                            color: "var(--text-tertiary)",
                            background: "var(--bg-hover)",
                            padding: "0px 7px", borderRadius: 5, minWidth: 18, textAlign: "center",
                          }}>{count}</span>
                        </div>
                      )}
                    </SortableFolderRow>
                  );
                })}
              </div>
            </SortableContext>
          </DndContext>
        </div>

        {/* subtle section divider */}
        <div style={{ height: 1, background: "var(--border-subtle)", margin: "0 4px" }} />

        {/* ETIQUETAS */}
        <div>
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            marginBottom: 8, paddingLeft: 4,
          }}>
            <span style={{
              fontSize: 13, fontWeight: 700, color: "var(--text-primary)",
              letterSpacing: "0.06em", textTransform: "uppercase",
            }}>Etiquetas</span>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <button onClick={() => setShowTagSection(!showTagSection)}
                style={{
                  width: 26, height: 26,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: "transparent", border: "1px solid transparent",
                  color: "var(--text-muted)", cursor: "pointer", padding: 0,
                  borderRadius: 6, transition: "all 150ms",
                }}
                className="hover:bg-[var(--bg-hover)] hover:text-[var(--text-secondary)]"
                title={showTagSection ? "Ocultar etiquetas" : "Mostrar etiquetas"}>
                <ChevronDown size={14} style={{
                  transform: showTagSection ? "rotate(0deg)" : "rotate(-90deg)",
                  transition: "transform 250ms " + EASE,
                }} />
              </button>
              <button onClick={onNewTag}
                title="Nueva etiqueta"
                style={{
                  width: 26, height: 26,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: "transparent", border: "1px solid var(--border-subtle)",
                  borderRadius: 6, color: "var(--accent)", cursor: "pointer", padding: 0,
                  transition: "all 150ms",
                }}
                className="hover:border-[var(--accent)] hover:bg-[var(--accent-dim)]">
                <Plus size={14} />
              </button>
            </div>
          </div>
          <div style={{
            overflow: "hidden", maxHeight: showTagSection ? 10000 : 0,
            transition: "max-height 300ms " + EASE,
          }}>
            {allTags.length > 0 ? (
              <DndContext sensors={tagSensors} collisionDetection={closestCenter} onDragStart={e => setActiveTagDragId(e.active.id as string)} onDragEnd={handleTagDragEnd} modifiers={[restrictToParentElement]}>
                <SortableContext items={allTags} strategy={verticalListSortingStrategy}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 1, marginTop: 2 }}>
                    {allTags.map((tag) => {
                      const count = notes.filter((n) => n.tags?.includes(tag)).length;
                      const dotColor = mergedTagColors[tag] || "var(--accent)";
                      const isSel = selectedTag === tag;
                      const isDragging = activeTagDragId === tag;
                      return (
                        <SortableTagRow key={tag} tag={tag}>
                          {({ attributes, listeners, setNodeRef, style: dndStyle }) => (
                            <div ref={setNodeRef}
                              style={{
                                ...dndStyle,
                                display: "flex", alignItems: "center", gap: 8, width: "100%",
                                padding: "9px 14px 9px 4px",
                                background: isSel ? "var(--bg-hover)" : "transparent",
                                border: isSel ? "1px solid var(--border-soft)" : "1px solid transparent",
                                borderLeft: isSel ? "2px solid " + dotColor : "2px solid transparent",
                                borderRadius: "var(--radius-md)",
                                cursor: "pointer", fontSize: 13.5, fontWeight: 500,
                                textAlign: "left", transition: "all 200ms " + EASE,
                                color: isSel ? dotColor : "var(--text-secondary)",
                                opacity: isDragging ? 0.4 : 1,
                              }}
                              {...attributes} {...listeners}
                              className="hover:bg-[var(--bg-hover)]"
                              onClick={() => { setActiveSidebarTab("tag_" + tag); onSelectTag(selectedTag === tag ? null : tag); onSelectFolder(null); }}>
                              <Hash size={14} style={{ color: dotColor, opacity: isSel ? 1 : 0.6, flexShrink: 0 }} />
                              <span style={{
                                flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                                fontWeight: 500, fontSize: 13.5,
                              }}>
                                {tag}
                              </span>
                              <span style={{
                                flexShrink: 0, fontSize: 10, fontWeight: 480, lineHeight: 1.3,
                                color: "var(--text-tertiary)",
                                background: "var(--bg-hover)",
                                padding: "0px 7px", borderRadius: 5, minWidth: 18, textAlign: "center",
                              }}>{count}</span>
                            </div>
                          )}
                        </SortableTagRow>
                      );
                    })}
                  </div>
                </SortableContext>
              </DndContext>
            ) : null}
          </div>
        </div>
      </div>

      {/* Tag edit modal (rename + color + delete) */}
      {tagColorEdit && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 10002,
          background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }} onClick={() => setTagColorEdit(null)}>
          <div style={{
            background: "var(--bg-surface)", border: "1px solid var(--border-default)",
            borderRadius: "var(--radius-lg)", padding: 24, minWidth: 320, maxWidth: 380,
            boxShadow: "var(--shadow-elevated)",
          }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", margin: "0 0 12px", display: "flex", alignItems: "center", gap: 6 }}>
              <Hash size={14} style={{ color: tagColors[tagColorEdit] || DEFAULT_TAG_COLORS[tagColorEdit] || "var(--accent)" }} />
              Editar etiqueta
            </h3>
            {/* Rename */}
            <div style={{ marginBottom: 12 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", display: "block", marginBottom: 4 }}>Nombre</span>
              <input type="text" placeholder="Nombre de la etiqueta"
                value={editTagName} onChange={(e) => setEditTagName(e.target.value)}
                autoFocus
                className="input-base"
                style={{ width: "100%", borderRadius: 6, padding: "8px 12px", boxSizing: "border-box" }} />
            </div>
            {/* Color */}
            <div style={{ marginBottom: 12 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Color</span>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 6 }}>
                {SPINE_COLORS.map(c => (
                  <button key={c} onClick={() => {
                    const colors = { ...tagColors, [tagColorEdit]: c };
                    localStorage.setItem("owa_custom_tag_colors", JSON.stringify(colors));
                    onTagColorsChange(colors);
                  }}
                    style={{
                      width: 28, height: 28, borderRadius: "50%", background: c,
                      border: (tagColors[tagColorEdit] || DEFAULT_TAG_COLORS[tagColorEdit]) === c ? "2px solid #fff" : "none",
                      cursor: "pointer",
                    }} />
                ))}
              </div>
            </div>
            {/* Delete tag option */}
            <button onClick={() => setShowTagDeleteConfirm(true)}
              style={{
                display: "flex", alignItems: "center", gap: 8, width: "100%",
                padding: "8px 12px", background: "none", border: "1px solid var(--border-soft)",
                borderRadius: 8, color: "var(--error)", cursor: "pointer",
                fontSize: 12, transition: "all 150ms",
              }}
              className="hover:bg-[var(--error-dim)]">
              <Trash2 size={13} /> Eliminar etiqueta
            </button>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
              <button onClick={() => setTagColorEdit(null)}
                style={{ background: "none", border: "1px solid var(--border-default)", borderRadius: 6, padding: "6px 14px", color: "var(--text-secondary)", fontSize: 12, cursor: "pointer" }}>Cancelar</button>
              <button onClick={() => {
                const newName = editTagName.trim();
                const oldName = tagColorEdit;
                if (!newName) return;
                if (newName !== oldName) {
                  // Update all notes that have the old tag
                  notes.filter(n => n.tags?.includes(oldName)).forEach(n => {
                    const newTags = (n.tags || []).map(t => t === oldName ? newName : t);
                    updateNote(n.id, { tags: newTags });
                  });
                  // Migrate color to new name
                  const colors = { ...tagColors };
                  if (colors[oldName]) {
                    colors[newName] = colors[oldName];
                    delete colors[oldName];
                  }
                  localStorage.setItem("owa_custom_tag_colors", JSON.stringify(colors));
                  onTagColorsChange(colors);
                  // Migrate created tags list
                  try {
                    const created = JSON.parse(localStorage.getItem("owa_created_tags") || "[]");
                    const newCreated = created.map((t: string) => t === oldName ? newName : t);
                    localStorage.setItem("owa_created_tags", JSON.stringify(newCreated));
                  } catch {}
                  // Migrate tag order
                  try {
                    const order = JSON.parse(localStorage.getItem("owa_tag_order") || "[]");
                    const newOrder = order.map((t: string) => t === oldName ? newName : t);
                    localStorage.setItem("owa_tag_order", JSON.stringify(newOrder));
                  } catch {}
                  // If the renamed tag was selected, update selection
                  if (selectedTag === oldName) {
                    onSelectTag(newName);
                  }
                  addNotification(`Etiqueta renombrada a "${newName}"`, 'success');
                } else {
                  addNotification("Color actualizado", 'success');
                }
                setTagColorEdit(null);
              }}
                style={{
                  background: "var(--accent)", color: "#fff", border: "none", borderRadius: 6,
                  padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer",
                }}>Guardar</button>
            </div>
          </div>
        </div>
      )}

      {/* Tag delete confirmation */}
      {showTagDeleteConfirm && tagColorEdit && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 10003,
          background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }} onClick={() => setShowTagDeleteConfirm(false)}>
          <div style={{
            background: "var(--bg-surface)", border: "1px solid var(--border-default)",
            borderRadius: "var(--radius-lg)", padding: 24, minWidth: 320, maxWidth: 380,
            boxShadow: "var(--shadow-elevated)",
          }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--error)", margin: "0 0 8px" }}>
              Eliminar etiqueta
            </h3>
            <p style={{ fontSize: 12.5, color: "var(--text-secondary)", margin: 0, lineHeight: 1.5 }}>
              ¿Eliminar la etiqueta <strong>{tagColorEdit}</strong> de todas las notas?
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
              <button onClick={() => setShowTagDeleteConfirm(false)}
                style={{ background: "none", border: "1px solid var(--border-default)", borderRadius: 6, padding: "6px 14px", color: "var(--text-secondary)", fontSize: 12, cursor: "pointer" }}>Cancelar</button>
              <button onClick={() => {
                notes.filter(n => n.tags?.includes(tagColorEdit)).forEach(n => {
                  updateNote(n.id, { tags: (n.tags || []).filter(t => t !== tagColorEdit) });
                });
                const created = JSON.parse(localStorage.getItem("owa_created_tags") || "[]");
                localStorage.setItem("owa_created_tags", JSON.stringify(created.filter((t: string) => t !== tagColorEdit)));
                const order = JSON.parse(localStorage.getItem("owa_tag_order") || "[]");
                localStorage.setItem("owa_tag_order", JSON.stringify(order.filter((t: string) => t !== tagColorEdit)));
                const colors = JSON.parse(localStorage.getItem("owa_custom_tag_colors") || "{}");
                delete colors[tagColorEdit];
                localStorage.setItem("owa_custom_tag_colors", JSON.stringify(colors));
                onTagColorsChange(colors);
                if (selectedTag === tagColorEdit) onSelectTag(null);
                setShowTagDeleteConfirm(false);
                setTagColorEdit(null);
                addNotification(`Etiqueta "${tagColorEdit}" eliminada`, 'info');
              }}
                style={{ background: "var(--error)", color: "#fff", border: "none", borderRadius: 6, padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Eliminar</button>
            </div>
          </div>
        </div>
      )}

      {/* Folder edit modal */}
      {editFolderId && (() => {
        const f = folders.find(x => x.id === editFolderId);
        if (!f) return null;
        const isFromCourse = courses.some(c => c.id === f.courseId);
        return (
          <div style={{
            position: "fixed", inset: 0, zIndex: 10002,
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
                Editar carpeta
              </h3>
              <input type="text" placeholder="Nombre de la carpeta"
                value={editFolderName} onChange={(e) => setEditFolderName(e.target.value)}
                autoFocus
                className="input-base"
                style={{ width: "100%", borderRadius: 6, padding: "8px 12px", boxSizing: "border-box" }} />
              <div>
                <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase" }}>Color</span>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 6, marginTop: 8 }}>
                  {SPINE_COLORS.map(c => (
                    <button key={c} onClick={() => setEditFolderColor(c)}
                      style={{
                        width: 22, height: 22, borderRadius: "50%", background: c,
                        border: editFolderColor === c ? "2px solid #fff" : "none",
                        cursor: "pointer", transform: editFolderColor === c ? "scale(1.1)" : "none",
                      }} />
                  ))}
                </div>
              </div>
              {/* Delete button inside edit modal */}
              {f.id !== "default" && (
                <button onClick={() => { setEditFolderId(null); setDeleteFolderId(f.id); setDeleteFolderName(f.name); }}
                  style={{
                    display: "flex", alignItems: "center", gap: 8, width: "100%",
                    padding: "8px 12px", background: "none", border: "1px solid var(--border-soft)",
                    borderRadius: 8, color: "var(--error)", cursor: "pointer",
                    fontSize: 12, fontWeight: 500, textAlign: "left", transition: "all 150ms",
                    marginTop: 4,
                  }}
                  className="hover:bg-[var(--error-dim)]">
                  <Trash2 size={13} /> Eliminar carpeta
                </button>
              )}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
                <button onClick={() => setEditFolderId(null)}
                  style={{ background: "none", border: "1px solid var(--border-default)", borderRadius: 6, padding: "6px 14px", color: "var(--text-secondary)", fontSize: 12, cursor: "pointer" }}>Cancelar</button>
                <button onClick={() => {
                  if (editFolderName.trim()) {
                    updateNoteFolder(editFolderId, { name: editFolderName.trim(), color: editFolderColor });
                    setEditFolderId(null);
                    addNotification("Carpeta actualizada", 'success');
                  }
                }}
                  style={{ background: editFolderColor, color: "#fff", border: "none", borderRadius: 6, padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer", boxShadow: "0 2px 6px " + editFolderColor + "33" }}>Guardar</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Folder delete confirmation */}
      {deleteFolderId && (() => {
        const f = folders.find(x => x.id === deleteFolderId);
        if (!f) return null;
        const isFromCourse = courses.some(c => c.id === f.courseId);
        const noteCount = notes.filter(n => n.folderId === f.id).length;
        return (
          <div style={{
            position: "fixed", inset: 0, zIndex: 10002,
            background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }} onClick={() => setDeleteFolderId(null)}>
            <div style={{
              background: "linear-gradient(135deg, var(--bg-surface) 0%, var(--bg-base) 100%)",
              border: "1px solid var(--border-default)",
              borderRadius: "var(--radius-lg)", padding: 24, minWidth: 340, maxWidth: 420,
              boxShadow: "var(--shadow-elevated)",
            }} onClick={e => e.stopPropagation()}>
              <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--error)", margin: "0 0 8px", fontFamily: "var(--font-heading)" }}>
                Eliminar carpeta
              </h3>
              {isFromCourse && (
                <p style={{ fontSize: 12, color: "var(--warning)", margin: "0 0 8px", lineHeight: 1.5, background: "var(--warning-dim)", padding: "8px 10px", borderRadius: 6 }}>
                  Esta carpeta pertenece al curso <strong>{f.name}</strong>. La carpeta se ocultará y podrás restaurarla desde la papelera.
                </p>
              )}
              <p style={{ fontSize: 12.5, color: "var(--text-secondary)", margin: 0, lineHeight: 1.5 }}>
                {isFromCourse
                  ? <>Se moverán las notas a la papelera y la carpeta quedará oculta. Podrás restaurarla después.</>
                  : <>¿Eliminar la carpeta <strong>{f.name}</strong>? Las notas se moverán a la papelera.</>
                }
              </p>
              {noteCount > 0 && (
                <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "8px 0", lineHeight: 1.5 }}>
                  {noteCount} nota{noteCount !== 1 ? 's' : ''} será{noteCount === 1 ? '' : 'n'} movida{noteCount === 1 ? '' : 's'} a la papelera.
                </p>
              )}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
                <button onClick={() => setDeleteFolderId(null)}
                  style={{ background: "none", border: "1px solid var(--border-default)", borderRadius: 6, padding: "6px 14px", color: "var(--text-secondary)", fontSize: 12, cursor: "pointer" }}>Cancelar</button>
                <button onClick={() => {
                  notes.filter(n => n.folderId === deleteFolderId).forEach(n => {
                    updateNote(n.id, { folderId: undefined, deletedAt: new Date().toISOString() });
                  });
                  if (isFromCourse) {
                    setDeletedFolderIds(prev => new Set([...prev, deleteFolderId!]));
                    addNotification(`Carpeta "${deleteFolderName}" ocultada. Puedes restaurarla desde la papelera.`, 'info');
                  } else {
                    deleteNoteFolder(deleteFolderId!);
                    addNotification(`Carpeta "${deleteFolderName}" eliminada.`, 'info');
                  }
                  setDeleteFolderId(null);
                }}
                  style={{
                    background: "var(--error)", color: "#fff", border: "none", borderRadius: 6,
                    padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer",
                  }}>Eliminar</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Papelera — pinned at bottom */}
      <div style={{ flexShrink: 0 }}>
        <div style={{ height: 1, background: "var(--border-subtle)", marginBottom: 6, marginLeft: 4, marginRight: 4 }} />
        {(() => {
          const isSel = activeSidebarTab === "trash";
          return (
            <button onClick={() => {
              if (isSel) { setActiveSidebarTab("all"); } else { setActiveSidebarTab("trash"); }
              onSelectFolder(null); onSelectTag(null);
            }}
              style={{
                display: "flex", alignItems: "center", gap: 10, width: "100%",
                padding: "7px 10px",
                background: isSel ? "var(--accent-dim)" : "transparent",
                border: "1px solid " + (isSel ? "var(--accent-soft)" : "transparent"),
                borderRadius: "var(--radius-md)",
                color: isSel ? "var(--accent)" : "var(--text-secondary)",
                cursor: "pointer", fontSize: 12, fontWeight: 500,
                textAlign: "left", transition: "all 180ms " + EASE,
              }}
              className="hover:bg-[var(--bg-hover)]">
              <Trash2 size={13} style={{ color: isSel ? "var(--accent)" : "var(--text-tertiary)" }} />
              <span>Papelera</span>
              <span style={{
                marginLeft: "auto", fontSize: 9,
                color: isSel ? "#fff" : "var(--text-tertiary)",
                background: isSel ? "var(--accent)" : "var(--bg-hover)",
                padding: "1px 6px", borderRadius: 4, fontWeight: 650,
              }}>{trashCount}</span>
            </button>
          );
        })()}
        {/* Restore hidden course folders */}
        {deletedFolderIds.size > 0 && (
          <div style={{ marginTop: 6, padding: "4px 4px", background: "var(--warning-dim)", borderRadius: 6, border: "1px solid var(--border-soft)" }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: "var(--warning)", textTransform: "uppercase", display: "block", marginBottom: 4, paddingLeft: 4 }}>
              Carpetas ocultas
            </span>
            {Array.from(deletedFolderIds).map(id => {
              const df = folders.find(x => x.id === id);
              if (!df) return null;
              return (
                <div key={id} style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 4px", borderRadius: 4 }}>
                  <FolderIcon size={10} style={{ color: df.color, flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: 11, color: "var(--text-secondary)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{df.name}</span>
                  <button onClick={() => {
                    setDeletedFolderIds(prev => { const next = new Set(prev); next.delete(id); return next; });
                    addNotification(`Carpeta "${df.name}" restaurada.`, 'success');
                  }}
                    style={{
                      background: "var(--accent)", color: "#fff", border: "none", borderRadius: 4,
                      padding: "2px 8px", fontSize: 10, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap",
                    }}>Restaurar</button>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}