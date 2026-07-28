import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  GraduationCap, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Pencil, PlusCircle, Layers, Trash2,
  Book, Upload, X, Search, Edit3, Plus, File, Sigma, Lightbulb, Key, Type, HelpCircle, ListChecks, ExternalLink,
  Check, GripVertical, StickyNote, BookOpen, ArrowUpRight,
  NotebookPen, ListTodo, Bold, Italic, Underline, Heading1, Heading2, Heading3,
  List, ListOrdered, Highlighter, Paperclip, MoreHorizontal, Eye, FolderOpen,
  ArrowLeftRight, BarChart3, Calendar, Flag, ArrowUpDown, Star, EyeOff, Strikethrough, AlignLeft, AlignCenter, AlertTriangle,
  Users, MoreVertical, FileText, CheckCircle, FileSpreadsheet, Image as ImageIcon, Music, Link2, Lock,
  Download, ArrowDownToLine, ArrowUpFromLine, Package, PackageOpen, FileDown, FileUp,
} from 'lucide-react';
import { FormatToolbar } from '../ui/FormatToolbar';
import {
  DndContext, closestCorners, useSensor, useSensors, PointerSensor, useDroppable, DragEndEvent
} from '@dnd-kit/core';
import {
  SortableContext, rectSortingStrategy, useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useApp, Course, SubjectGroup, SubjectTopic, SubjectMaterial } from '../../store/AppContext';
import { save } from '@tauri-apps/plugin-dialog';
import { writeTextFile } from '@tauri-apps/plugin-fs';
import { format, subDays, addDays, startOfWeek, endOfWeek } from "date-fns";
import { es } from "date-fns/locale";
import toast from 'react-hot-toast';

export const MATERIAL_META = {
  resource: { label: 'Recurso', icon: File },
  formula: { label: 'Fórmula', icon: Sigma },
  concept: { label: 'Concepto', icon: Lightbulb },
  'key-data': { label: 'Dato Clave', icon: Key },
  meaning: { label: 'Significado', icon: Type },
  quiz: { label: 'Cuestionario', icon: HelpCircle },
  procedure: { label: 'Procedimiento', icon: ListChecks },
};
type MaterialType = keyof typeof MATERIAL_META;

const EASE = "cubic-bezier(0.16, 1, 0.3, 1)";
const SPINE_COLORS = [
  "#E11D48", "#3B82F6", "#10B981", "#F59E0B", "#8B5CF6",
  "#EC4899", "#06B6D4", "#84CC16", "#F97316", "#6366F1",
  "#14B8A6", "#D946EF", "#0EA5E9", "#22C55E", "#EAB308",
];

function formatTime(s: number) { if (!s || !isFinite(s)) return '0:00'; const m = Math.floor(s / 60); const sec = Math.floor(s % 60); return `${m}:${sec.toString().padStart(2, '0')}`; }

// Reuse SPINE_COLORS token in case the user wants the same selection.
// ─── Icon Picker Stuff ───
import * as LI from 'lucide-react';
const AVAILABLE_ICONS: { name: string; icon: React.ComponentType<{ size?: number; color?: string; style?: React.CSSProperties }>; label: string }[] = (() => {
  const NAMES = [
    "FileText","BookOpen","Code","Folder","Brain","Target","Coffee","Compass","Award",
    "Briefcase","GraduationCap","Shield","Heart","Lightbulb","Zap","Globe","Feather",
    "Sun","Moon","CloudRain","Mountain","Music","Camera","Eye","Flag","Gift","Anchor",
    "Key","Rocket","Scissors","Watch","Wifi","Activity","Lock","Star","Hash","CheckSquare","Clock","File","Layers","Pin",
    "Search","Plus","Trash2","Download","X","Copy","Move","AlertTriangle","Check","Bold","Italic","Underline","List","Link","Paperclip",
    "Image","Type","Library","Info","AlignJustify","ChevronDown","ChevronLeft","ChevronRight","MoreHorizontal",
    "ListOrdered","Quote","Upload","History","Table","Edit3","FileOutput","Filter","SortAsc","Tag",
    "Maximize2","Minimize2","Palette","ArrowLeft","Unlink","Minus","Strikethrough",
    "AlignLeft","AlignCenter","AlignRight","Eraser","Sigma",
    "Bell","BellRing","Bookmark","BookmarkCheck","Box","BoxSelect","Brush","Bug",
    "Building","Calculator","Calendar","Car","Cast","ChartBar","ChartLine","CheckCircle",
    "ChevronUp","Circle","Clipboard","Clock4","Cloud","CloudSun","Clover","Columns",
    "Command","Construction","Contact","Container","Cookie","CopyCheck","CopyX","CornerDownRight",
    "Cpu","CreditCard","Crop","Cross","Crosshair","Crown","Cube","Database","Delete",
    "Dices","Disc","DiscAlbum","Dock","DollarSign","DoorOpen","Dot","DownloadCloud",
    "Droplet","Drumstick","Earth","Egg","Equal","EqualNot","Euro","Expand","ExternalLink",
    "EyeOff","FaceSmile","Fingerprint","Fish","FishSymbol","Flame","Flashlight","FlaskConical",
    "FlaskRound","Flower","FolderOpen","FolderPlus","FolderTree","Footprints","ForkKnife",
    "FormInput","Forward","Frame","Frown","Fuel","Funnel","GalleryHorizontal","GalleryVertical",
    "Gamepad","GanttChart","Gauge","Gem","Ghost","GiftCard","Glasses","GlobeLock","Grab",
    "Grip","GripHorizontal","GripVertical",
    "Hammer","Hand","HandCoins","HardDrive","HardHat","Headphones","HeartCrack",
    "HeartHandshake","HeartPulse","HelpCircle","Hexagon","Highlighter","Home","Hospital",
    "IceCream","ImageDown","ImageUp","Inbox","Indent","IndianRupee","Infinity","Inspect",
    "Instagram","Ironing","IterationCcw","IterationCw","JapaneseYen","Joystick","Kanban",
    "KeyRound","KeySquare","Keyboard","Landmark","Languages","Laptop","Lasso","LassoSelect",
    "Layers3","LayoutDashboard","LayoutGrid","LayoutList","LayoutPanelLeft","LayoutPanelTop",
    "LayoutTemplate","Leaf","Lectern","LetterText","LifeBuoy","LightbulbOff",
    "LineChart","Link2","Linkedin","ListChecks","ListEnd","ListMinus","ListPlus","ListRestart",
    "ListStart","ListTodo","ListTree","Loader","LoaderCircle","Locate","LocateFixed",
    "LocateOff","LockKeyhole","LogIn","LogOut","Lollipop","Luggage","Magnet","Mail",
    "MailCheck","MailOpen","Map","MapPin","MapPinOff","Martini","Maximize","Medal",
    "Megaphone","Meh","MemoryStick","Menu","MessageCircle","MessageCircleMore",
    "MessageSquare","MessageSquareMore","MessagesSquare","Mic","MicOff","Microscope",
    "Microwave","Milestone","Milk","Minimize","MinusCircle","Monitor","MonitorDot",
    "MonitorDotCog","MonitorDown","MonitorOff","MonitorSmartphone","MonitorUp","MoonStar",
    "MoreVertical","Mouse","MousePointer2","MousePointerClick","Move3d",
    "MoveDiagonal","MoveDown","MoveHorizontal","MoveLeft","MoveRight","MoveUp",
    "MoveVertical","Movie","Music2","Music3","Music4","Navigation","Navigation2","Network",
    "Newspaper","Nfc","Notebook","NotebookPen","NotebookTabs","NotebookText","NotepadText",
    "Nut","NutOff","Octagon","Option","Orbit","Origami","Package","PackageCheck",
    "PackageMinus","PackageOpen","PackagePlus","PackageSearch","PackageX","PaintBucket",
    "PaintRoller","PanelBottom","PanelBottomClose","PanelBottomOpen","PanelLeft",
    "PanelLeftClose","PanelLeftOpen","PanelRight","PanelRightClose","PanelRightOpen",
    "PanelTop","PanelTopClose","PanelTopOpen","PanelsLeftBottom","PanelsRightBottom",
    "PanelsTopLeft","PanelsTopRight","Parentheses","ParkingMeter","PartyPopper",
    "Pause","PcCase","Pen","PenLine","PenOff","PenTool","Pencil","PencilLine","PencilOff",
    "PencilRuler","Percent","PersonStanding","Phone","PhoneCall","PhoneForwarded",
    "PhoneIncoming","PhoneMissed","PhoneOff","PhoneOutgoing","Pi","Piano","Pickaxe",
    "PictureInPicture","PieChart","PiggyBank","Pilcrow","Pill","PillBottle","PinOff",
    "Pipette","Pizza","Plane","Plant","Play","Plug","Plug2","PlugZap","PlusCircle",
    "PlusSquare","Pocket","PocketKnife","Podcast","Pointer","Popcorn","Popsicle",
    "Power","PowerOff","Presentation","Printer","Projector","Puzzle","QrCode",
    "Radar","Radiation","Radio","RadioReceiver","Rainbow","Rat","Receipt","ReceiptCent",
    "ReceiptEuro","ReceiptIndian","ReceiptJapaneseYen","ReceiptPound","ReceiptRussianRuble",
    "ReceiptSterling","ReceiptSwissFranc","ReceiptText","RectangleEllipsis",
    "RectangleHorizontal","RectangleVertical","Recycle","Redo","RefreshCcw","RefreshCw",
    "Refrigerator","Regex","Repeat","Repeat1","Repeat2","Replace","ReplaceAll","Reply",
    "ReplyAll","Rewind","Ribbon","RockingChair","RollerCoaster","Rotate3d",
    "RotateCcw","RotateCw","Route","Router","Rows","Rows2","Rows4","Rss","Ruler",
    "RussianRuble","Sailboat","Salad","Sandwich","Satellite","SatelliteDish","Save",
    "SaveAll","Scale","Scale3d","Scaling","Scan","ScanFace","ScanLine","ScanSearch",
    "ScanText","School","School2","Scroll","ScrollText",
    "SearchCheck","SearchCode","SearchSlash","SearchX","Section",
    "Send","SendHorizonal","SendToBack","SeparatorHorizontal","SeparatorVertical",
    "Server","ServerCog","ServerCrash","ServerOff","Settings","Settings2","Share",
    "Share2","Sheet","Shell","ShieldAlert","ShieldBan","ShieldCheck","ShieldClose",
    "ShieldEllipsis","ShieldHalf","ShieldMinus","ShieldOff","ShieldPlus","ShieldQuestion",
    "ShieldX","Ship","Shirt","ShoppingBag","ShoppingBasket","ShoppingCart","Shovel",
    "ShowerHead","Shrink","Shrub","Shuffle","Sidebar","SidebarClose","SidebarOpen",
    "Signal","SignalHigh","SignalLow","SignalMedium","SignalZero","Signpost",
    "SignpostBig","Siren","SkipBack","SkipForward","Skull","Slash","Slice","SlidersHorizontal",
    "SlidersVertical","Smartphone","SmartphoneCharging","Smile","SmilePlus","Snail",
    "Snowflake","Sofa","SortAsc","SortDesc","Sparkle","Sparkles","Speaker","Speech",
    "SpellCheck","Spider","Split","SplitSquareHorizontal","SplitSquareVertical","SprayCan",
    "Sprout","Square","SquareActivity","SquareArrowOutUpRight","SquareCheckBig",
    "SquareCode","SquareDashed","SquareDashedKanban","SquareDashedMousePointer",
    "SquareFunction","SquareGanttChart","SquareLibrary","SquareM","SquareMenu",
    "SquareMinus","SquareMousePointer","SquareParking","SquareParkingOff","SquarePen",
    "SquarePercent","SquarePi","SquarePilcrow","SquarePlay","SquarePlus","SquarePower",
    "SquareRadical","SquareScissors","SquareSigma","SquareSlash","SquareSplitHorizontal",
    "SquareSplitVertical","SquareSquare","SquareStack","SquareTerminal","SquareUser",
    "SquareUserRound","SquareX","Squircle","Squirrel","Stamp","StarHalf","StarOff",
    "Stars","StepBack","StepForward","Stethoscope","Sticker","StickyNote","StopCircle",
    "Store","StretchHorizontal","StretchVertical","Subscript","Subtitles",
    "SunDim","SunMedium","SunMoon","SunSnow","Sunrise","Sunset","Superscript","SwatchBook",
    "SwissFranc","SwitchCamera","Sword","Swords","Syringe","Table","Table2","Tablets",
    "TableOfContents","Tally1","Tally2","Tally3","Tally4","Tally5","Tangent",
    "Tent","Terminal","TestTube","TestTubeDiagonal","TestTubes","Text","TextCursor",
    "TextCursorInput","TextQuote","TextSearch","TextSelect","TextSelection","Theater",
    "Thermometer","ThermometerSnowflake","ThermometerSun","ThumbsDown","ThumbsUp",
    "Ticket","TicketCheck","TicketMinus","TicketPercent","TicketPlus","TicketSlash","Timer",
    "TimerOff","TimerReset","ToggleLeft","ToggleRight","Tornado","Torus","Touchpad",
    "TouchpadOff","TowerControl","ToyBrick","Train","TrainTrack","TramFront",
    "TreeDeciduous","TreePalm","TreePine","Trees","Trello","TrendingDown",
    "TrendingUp","Triangle","TriangleAlert","TriangleRight","Trophy","Truck","Turtle",
    "Tv","TvMinimal","TvMinimalPlay","Twitch","Twitter","Umbrella","UnfoldHorizontal",
    "UnfoldVertical","Ungroup","University","Unlink","Unplug","Upload","Usb",
    "UserCheck","UserCog","UserMinus","UserPlus","UserRound","UserRoundCheck","UserRoundCog",
    "UserRoundMinus","UserRoundPlus","UserRoundSearch","UserRoundX","UserSearch",
    "Users","UsersRound","Utensils","UtensilsCrossed","UtilityPole","Variable","Vault",
    "Vegan","VenetianMask","Verified","Vibrate","VibrateOff","Video","VideoOff",
    "Videotape","View","Voicemail","Volleyball","Volume","Volume1","Volume2","VolumeOff",
    "VolumeX","Vote","Wallet","WalletCards","WalletMinimal","Wallpaper","Wand","WandSparkles",
    "Warehouse","WashingMachine","Waves","Waypoints","Webcam","Webhook","Weight",
    "Wheat","WheatOff","WholeWord","WifiHigh","WifiLow","WifiOff","WifiZero",
    "Wind","Wine","WineOff","Workflow","Worm","WrapText","Wrench","X","XClose","XOctagon",
    "Youtube","ZapOff","ZoomIn","ZoomOut",
  ];
  const seen = new Set<string>();
  const result: { name: string; icon: any; label: string }[] = [];
  for (const name of NAMES) {
    if (seen.has(name)) continue;
    seen.add(name);
    const icon = (LI as any)[name];
    if (typeof icon === 'function') {
      result.push({
        name,
        icon,
        label: name.replace(/([A-Z])/g, ' $1').replace(/\d/g, '').trim().slice(0, 14) || name,
      });
    }
  }
  return result;
})();

function NoteIconRenderer({ iconName, color, size = 16 }: { iconName?: string; color: string; size?: number }) {
  const IconComponent = (() => {
    const item = AVAILABLE_ICONS.find(i => i.name === iconName);
    return item ? item.icon : null;
  })();
  if (!IconComponent) return null;
  return <IconComponent size={size} style={{ color }} />;
}

function IconPicker({ currentIcon, currentColor, noteTitle, onSelect, onClose }:
  { currentIcon?: string; currentColor?: string; noteTitle?: string; onSelect: (iconName: string, colorHex: string) => void; onClose: () => void }) {
  const [selectedIcon, setSelectedIcon] = useState(currentIcon || "FileText");
  const [selectedColor, setSelectedColor] = useState(currentColor || "#E11D48");
  const [view, setView] = useState<'grid' | 'preview'>('grid');

  const IconForName = useCallback((name: string) => {
    const found = AVAILABLE_ICONS.find(i => i.name === name);
    return found ? found.icon : LI.FileText;
  }, []);

  const SelIcon = IconForName(selectedIcon);

  return (
    <div style={{
      width: 420, background: "var(--bg-elevated)", border: "1px solid var(--border-strong)",
      borderRadius: 14, padding: 16, boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
    }} onClick={e => e.stopPropagation()}>
      {view === 'grid' ? (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Seleccionar Icono</span>
            <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-tertiary)", cursor: "pointer", padding: 2 }}><LI.X size={13} /></button>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 10, flexWrap: "wrap" }}>
            {SPINE_COLORS.slice(0, 10).map(c => (
              <button key={c} onClick={() => setSelectedColor(c)}
                style={{ width: 20, height: 20, borderRadius: "50%", border: selectedColor === c ? `2px solid ${c}` : "1px solid " + c + "40", background: selectedColor === c ? c : c + "20", cursor: "pointer", transition: "all 120ms", transform: selectedColor === c ? "scale(1.2)" : "none" }} />
            ))}
            <div style={{ flex: 1 }} />
            <input type="color" value={selectedColor} onChange={e => setSelectedColor(e.target.value)}
              style={{ width: 24, height: 24, borderRadius: 4, border: "1px solid var(--border-subtle)", padding: 0, cursor: "pointer", background: "none" }} />
          </div>
          <div style={{ maxHeight: 320, overflowY: "auto", display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: 4, borderTop: "1px solid var(--border-default)", paddingTop: 10 }}>
            {AVAILABLE_ICONS.map(i => {
              const Icon = i.icon;
              const isSel = selectedIcon === i.name;
              return (
                <button key={i.name} onClick={() => { setSelectedIcon(i.name); setView('preview'); }} title={i.label}
                  style={{ height: 36, borderRadius: 6, border: `1px solid ${isSel ? selectedColor : "var(--border-default)"}`, background: isSel ? selectedColor + "16" : "transparent", color: isSel ? selectedColor : "var(--text-secondary)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 120ms" }}>
                  <Icon size={16} />
                </button>
              );
            })}
          </div>
        </>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <button onClick={() => setView('grid')} style={{ width: 28, height: 28, borderRadius: 6, border: "1px solid var(--border-subtle)", background: "transparent", cursor: "pointer", color: "var(--text-secondary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <LI.ChevronLeft size={13} />
            </button>
            <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Vista Previa</span>
            <div style={{ flex: 1 }} />
            <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-tertiary)", cursor: "pointer", padding: 2 }}><LI.X size={13} /></button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, padding: "24px 0" }}>
            <div style={{ width: 80, height: 80, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", border: `2px solid ${selectedColor}25`, transition: "all 200ms" }}>
              <SelIcon size={42} style={{ color: selectedColor }} />
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{noteTitle || "Sin título"}</div>
            <div style={{ fontSize: 9, color: "var(--text-tertiary)" }}>{AVAILABLE_ICONS.find(i => i.name === selectedIcon)?.label || selectedIcon}</div>
          </div>
          <div style={{ display: "flex", gap: 4, justifyContent: "center", flexWrap: "wrap", marginBottom: 14 }}>
            {SPINE_COLORS.map(c => (
              <button key={c} onClick={() => setSelectedColor(c)}
                style={{ width: 22, height: 22, borderRadius: "50%", border: selectedColor === c ? `2px solid ${c}` : "1px solid " + c + "30", background: c, cursor: "pointer", transition: "all 120ms", transform: selectedColor === c ? "scale(1.15)" : "none", boxShadow: selectedColor === c ? `0 0 8px ${c}60` : "none" }} />
            ))}
            <input type="color" value={selectedColor} onChange={e => setSelectedColor(e.target.value)}
              style={{ width: 22, height: 22, borderRadius: "50%", border: "1px solid var(--border-subtle)", padding: 0, cursor: "pointer", background: "none" }} />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setView('grid')} style={{ flex: 1, height: 34, borderRadius: 8, border: "1px solid var(--border-subtle)", background: "transparent", color: "var(--text-secondary)", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>Atrás</button>
            <button onClick={() => { onSelect(selectedIcon, selectedColor); onClose(); }} style={{ flex: 1, height: 34, borderRadius: 8, border: "none", background: selectedColor, color: "#fff", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>Seleccionar</button>
          </div>
        </>
      )}
    </div>
  );
}

// --- Subcomponents ---
function DroppableColumn({ id, items, children }: { id: string; items: SubjectMaterial[]; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <SortableContext id={id} items={items.map(m => m.id)} strategy={rectSortingStrategy}>
      <div ref={setNodeRef} style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 200, padding: 8, borderRadius: 8, border: `1px dashed ${isOver ? 'var(--accent)' : 'transparent'}`, background: isOver ? 'var(--accent)06' : 'transparent', transition: 'all 200ms ' + EASE }}>{children}</div>
    </SortableContext>
  );
}

function SortableWrapper({ id, children }: { id: string; children: (p: { attributes: any; listeners: any; isDragging: boolean }) => React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return <div ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform), transition, zIndex: isDragging ? 100 : 1, opacity: isDragging ? 0.5 : 1, position: 'relative' as const }}>{children({ attributes, listeners, isDragging })}</div>;
}

function MaterialCard({ mat, dragAttributes, dragListeners, onEdit, onDelete, onOpenResource }:
  { mat: SubjectMaterial; dragAttributes?: any; dragListeners?: any; onEdit: (m: SubjectMaterial) => void; onDelete: (m: SubjectMaterial) => void; onOpenResource: (m: SubjectMaterial) => void }) {
  const [expanded, setExpanded] = useState(false);
  const meta = MATERIAL_META[mat.type];
  const Icon = meta.icon;
  const isExpandable = ['concept', 'key-data', 'meaning', 'quiz', 'procedure'].includes(mat.type);
  const title = mat.name || mat.title || mat.word || mat.question || 'Sin título';
  const body = mat.content || mat.meaning || mat.answer || '';
  const typeColors: Record<string, string> = { formula: '#8B5CF6', concept: '#3B82F6', 'key-data': '#F59E0B', meaning: '#10B981', quiz: '#EF4444', procedure: '#EC4899', resource: '#6366F1' };
  const accent = typeColors[mat.type] || 'var(--accent)';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', borderRadius: 8, border: `1px solid ${accent}18`, background: 'linear-gradient(135deg, var(--bg-elevated) 0%, var(--bg-surface) 100%)', overflow: 'hidden', transition: 'all 200ms ' + EASE }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 6px', borderBottom: '1px solid var(--border-subtle)', background: `${accent}08` }}>
        <div {...dragAttributes} {...dragListeners} style={{ cursor: 'grab', display: 'flex', padding: 2, color: 'var(--text-muted)' }}><GripVertical size={9} /></div>
        <Icon size={10} style={{ color: accent }} />
        <span style={{ flex: 1, fontSize: 7.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: accent }}>{meta.label}</span>
        <button onClick={() => onEdit(mat)} style={{ width: 18, height: 18, borderRadius: 3, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Edit3 size={8} /></button>
        <button onClick={() => onDelete(mat)} style={{ width: 18, height: 18, borderRadius: 3, border: 'none', background: 'transparent', cursor: 'pointer', color: 'rgba(239,68,68,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Trash2 size={8} /></button>
      </div>
      <div style={{ padding: '8px 10px', cursor: isExpandable ? 'pointer' : 'default' }} onClick={() => isExpandable && setExpanded(!expanded)}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 3, lineHeight: 1.3 }}>{title.length > 50 ? title.slice(0, 50) + '…' : title}</div>
        {mat.type === 'formula' && mat.clarification && <div style={{ fontSize: 9, color: 'var(--text-tertiary)', fontStyle: 'italic', lineHeight: 1.4 }}>{mat.clarification}</div>}
        {mat.type === 'procedure' && mat.description && <div style={{ fontSize: 9, color: accent, fontStyle: 'italic', marginBottom: 3 }}>{mat.description}</div>}
        {isExpandable && body && <div style={{ fontSize: 10, color: 'var(--text-secondary)', lineHeight: 1.5, whiteSpace: 'pre-wrap', display: expanded ? 'block' : '-webkit-box', WebkitLineClamp: expanded ? undefined : 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{body}</div>}
        {mat.image && expanded && <div style={{ marginTop: 6, borderRadius: 6, overflow: 'hidden', border: '1px solid var(--border-subtle)' }}><img src={mat.image} alt="" style={{ width: '100%', height: 'auto', display: 'block' }} /></div>}
        {mat.type === 'resource' && <button onClick={(e) => { e.stopPropagation(); onOpenResource(mat); }} style={{ marginTop: 4, padding: 0, height: 'auto', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 8.5, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3, color: accent }}><ExternalLink size={8} /> Ver archivo</button>}
      </div>
    </div>
  );
}

// ─── Note Card ───
function NoteCard({ note, courseColor, onSelect }: { note: any; courseColor: string; onSelect: (id: string) => void }) {
  const preview = useMemo(() => note.content?.replace(/<[^>]+>/g, '').trim().slice(0, 120) || 'Sin contenido', [note.content]);
  return (
    <div onClick={() => onSelect(note.id)} style={{
      padding: '12px 14px', borderRadius: 10, cursor: 'pointer',
      border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)',
      transition: 'all 200ms ' + EASE,
    }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = `${courseColor}40`; e.currentTarget.style.background = 'var(--bg-surface)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.background = 'var(--bg-elevated)'; }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.3 }}>
          {note.title || 'Sin título'}
        </span>
        <MoreHorizontal size={12} style={{ color: 'var(--text-muted)', flexShrink: 0, marginTop: 2 }} />
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
        {preview}
      </div>
      <div style={{ marginTop: 6, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {(note.tags || []).slice(0, 2).map((t: string) => (
          <span key={t} style={{ fontSize: 8, fontWeight: 600, padding: '1px 6px', borderRadius: 3, background: `${courseColor}12`, color: courseColor }}>{t}</span>
        ))}
      </div>
    </div>
  );
}

// ─── Task Card ───
function TaskRow({ task, onToggle, onDelete, courseColor }: { task: any; onToggle: () => void; onDelete: () => void; courseColor: string }) {
  const priorityColors: Record<string, string> = { high: '#EF4444', medium: '#F59E0B', low: '#10B981' };
  const isDone = task.status === 'completado';
  const isProg = task.status === 'progreso';
  const statusColor = isDone ? '#10B981' : isProg ? '#3B82F6' : courseColor;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', transition: 'all 150ms' }}>
      <div onClick={onToggle} style={{
        width: 20, height: 20, borderRadius: 6, flexShrink: 0, cursor: 'pointer',
        border: `1.5px solid ${statusColor}${isDone ? '' : '40'}`,
        background: isDone ? '#10B981' : isProg ? '#3B82F6' : `${courseColor}10`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all 180ms cubic-bezier(0.16,1,0.3,1)',
      }}>
        {isDone && <Check size={11} strokeWidth={2.5} color="#fff" />}
        {isProg && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff' }} />}
        {!isDone && !isProg && <div style={{ width: 6, height: 6, borderRadius: '50%', background: courseColor, opacity: 0.45 }} />}
      </div>
      <span style={{ flex: 1, fontSize: 12, fontWeight: 500, color: task.status === 'completado' ? 'var(--text-muted)' : 'var(--text-primary)', textDecoration: task.status === 'completado' ? 'line-through' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.title}</span>
      {task.priority !== 'none' && (
        <span style={{ fontSize: 8, fontWeight: 600, padding: '1px 6px', borderRadius: 3, background: `${priorityColors[task.priority]}18`, color: priorityColors[task.priority], textTransform: 'uppercase' }}>{task.priority}</span>
      )}
      {task.dueDate && <span style={{ fontSize: 9, color: 'var(--text-muted)', flexShrink: 0 }}>{task.dueDate}</span>}
      <button onClick={onDelete} style={{ width: 20, height: 20, borderRadius: 4, border: 'none', background: 'transparent', cursor: 'pointer', color: 'rgba(239,68,68,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Trash2 size={10} /></button>
    </div>
  );
}

// ─── Note Full Editor ───
function NoteEditor({ note, courseColor, onSave, editable, toolbarEnd, hideToolbar, onImageClick }: {
  note: any; courseColor: string; onSave: (id: string, data: any) => void; editable?: boolean; toolbarEnd?: React.ReactNode; hideToolbar?: boolean; onImageClick?: (src: string) => void;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const dirtyRef = useRef(false);
  const [activeFormats, setActiveFormats] = useState<Record<string, boolean>>({});
  const lastEnterEmpty = useRef(false);
  const trackTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== note?.content) {
      editorRef.current.innerHTML = note?.content || '';
    }
    dirtyRef.current = false;
  }, [note?.id, note?.content]);

  useEffect(() => {
    return () => {
      if (dirtyRef.current) {
        const content = editorRef.current?.innerHTML || '';
        onSave(note.id, { content });
      }
      if (trackTimeout.current) clearTimeout(trackTimeout.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const markDirty = () => { dirtyRef.current = true; };

  const autoSave = () => {
    if (!dirtyRef.current) return;
    const content = editorRef.current?.innerHTML || '';
    onSave(note.id, { content });
    dirtyRef.current = false;
  };

  const trackFormats = () => {
    setActiveFormats({
      bold: document.queryCommandState('bold'),
      italic: document.queryCommandState('italic'),
      underline: document.queryCommandState('underline'),
      strikeThrough: document.queryCommandState('strikeThrough'),
      insertUnorderedList: document.queryCommandState('insertUnorderedList'),
      insertOrderedList: document.queryCommandState('insertOrderedList'),
    });
  };

  const scheduleTrack = () => {
    if (trackTimeout.current) clearTimeout(trackTimeout.current);
    trackTimeout.current = setTimeout(trackFormats, 10);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    for (const item of e.clipboardData.items) {
      const file = item.getAsFile();
      if (file && file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const dataUrl = ev.target?.result as string;
          if (dataUrl && editorRef.current) {
            document.execCommand('insertHTML', false, `<img src="${dataUrl}" alt="" style="max-width:100%;max-height:360px;border-radius:6px;margin:6px 0;cursor:pointer;object-fit:contain;" />`);
            markDirty();
          }
        };
        reader.readAsDataURL(file);
        return;
      }
    }
    document.execCommand('insertHTML', false, e.clipboardData.getData('text/plain'));
    markDirty();
  };

  const handleEditorKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!editable) { e.preventDefault(); return; }
    if (e.key === "Tab") { e.preventDefault(); document.execCommand("insertHTML", false, "&#09;"); return; }

    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    const node = range.startContainer;

    if (e.key === "Enter" && !e.shiftKey) {
      try {
        let listItem: HTMLElement | null = null;
        let lp = node.parentElement;
        while (lp && lp !== editorRef.current) {
          if (lp.tagName === "LI") { listItem = lp; break; }
          lp = lp.parentElement;
        }
        if (listItem) {
          const text = listItem.textContent?.trim() || "";
          if (text === "") {
            e.preventDefault();
            if (lastEnterEmpty.current) {
              const list = listItem.closest("ul, ol");
              const p = document.createElement("p");
              p.innerHTML = "<br>";
              if (list && !list.querySelector("li")) { list.after(p); list.remove(); }
              else { listItem.remove(); if (list && !list.querySelector("li")) { list.after(p); list.remove(); } }
              const newRange = document.createRange();
              newRange.selectNodeContents(p); newRange.collapse(true);
              sel.removeAllRanges(); sel.addRange(newRange);
              lastEnterEmpty.current = false;
              markDirty(); return;
            }
            lastEnterEmpty.current = true;
            setTimeout(() => { lastEnterEmpty.current = false; }, 400);
            const list = listItem.closest("ul, ol");
            const p = document.createElement("p");
            p.innerHTML = "<br>";
            const parent = listItem.parentElement;
            listItem.remove();
            if (list && !list.querySelector("li")) { list.after(p); list.remove(); }
            else if (parent) { parent.after(p); }
            const newRange = document.createRange();
            newRange.selectNodeContents(p); newRange.collapse(true);
            sel.removeAllRanges(); sel.addRange(newRange);
            markDirty(); return;
          }
        }
      } catch {}
      lastEnterEmpty.current = false;
    }

    if (e.key === "Backspace") {
      try {
        if (range.startOffset === 0 && node.nodeType === Node.TEXT_NODE) {
          let cb: HTMLElement | null = node.parentElement;
          while (cb && cb !== editorRef.current && !["P","H1","H2","H3","LI","BLOCKQUOTE"].includes(cb.tagName)) cb = cb.parentElement;
          if (cb && cb !== editorRef.current && cb.previousElementSibling) {
            e.preventDefault();
            const html = cb.innerHTML; cb.remove();
            (cb.previousElementSibling as HTMLElement).insertAdjacentHTML("beforeend", html);
            const nr = document.createRange();
            nr.selectNodeContents(cb.previousElementSibling); nr.collapse(false);
            sel.removeAllRanges(); sel.addRange(nr);
            markDirty(); return;
          }
        }
      } catch {}
    }

    if (e.key === " ") {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent || "";
        const before = text.substring(0, range.startOffset);
        let cmd = "";
        if (before === "#") cmd = "h1";
        else if (before === "##") cmd = "h2";
        else if (before === "###") cmd = "h3";
        else if (before === "-" || before === "*") cmd = "ul";
        else if (before === "1.") cmd = "ol";
        if (cmd) {
          e.preventDefault();
          (node as Text).deleteData(0, range.startOffset);
          if (cmd === "h1") document.execCommand("formatBlock", false, "<h1>");
          else if (cmd === "h2") document.execCommand("formatBlock", false, "<h2>");
          else if (cmd === "h3") document.execCommand("formatBlock", false, "<h3>");
          else if (cmd === "ul") document.execCommand("insertUnorderedList", false);
          else if (cmd === "ol") document.execCommand("insertOrderedList", false);
          markDirty(); return;
        }
      }
    }
  };

  const applyFormat = (cmd: string, value?: string) => {
    document.execCommand(cmd, false, value);
    editorRef.current?.focus();
    markDirty();
    trackFormats();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', background: 'transparent' }}>
      {editable && !hideToolbar && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '0 10px' }}>
          <FormatToolbar onFormat={applyFormat} color={courseColor}
            toolbarItems={['bold','italic','underline','strikethrough','list','orderedList']}
            activeFormats={activeFormats} />
          <div style={{ flex: 1 }} />
          {toolbarEnd}
        </div>
      )}
      <div ref={editorRef} contentEditable={editable} suppressContentEditableWarning
        onPaste={handlePaste} onInput={() => { markDirty(); scheduleTrack(); }}
        onBlur={autoSave} onKeyDown={handleEditorKeyDown}
        onMouseUp={scheduleTrack} onKeyUp={scheduleTrack}
        onClick={(e) => { const t = e.target as HTMLElement; if (t.tagName === 'IMG' && onImageClick) { e.stopPropagation(); onImageClick((t as HTMLImageElement).src); } }}
        className="notes-editor-area"
        style={{ padding: '12px 16px', minHeight: 80, fontSize: 14, lineHeight: 1.8, color: 'var(--text-primary)',
          background: 'transparent', outline: 'none',
          fontFamily: "'Atkinson Hyperlegible', system-ui, serif",
          caretColor: editable ? courseColor : 'transparent',
          userSelect: 'text', cursor: editable ? 'text' : 'default' }} />
    </div>
  );
}

// ─── Main Component ───
export default function Cursos({ initialCourseId, initialTab = 'overview', onNavigate }: { initialCourseId?: string; initialTab?: 'overview' | 'tareas' | 'notas' | 'archivos'; onNavigate?: (view: string) => void }) {
  const { courses = [], tasks = [], notes = [], noteFolders = [], updateCourse, deleteCourse, setNavigateTo, setFocusedTaskId, addTask, updateTask, deleteTask, addNote, updateNote, deleteNote, reorderNotes, weeklyStudyTime, plannedSessions, addPlannedSession, deletePlannedSession, setPipUrl } = useApp();
  const th = document.documentElement.getAttribute('data-theme');
  const isDarkSelect = !th || th === 'oscuro' || th === 'vibrante';
  const selectBorder = isDarkSelect ? '1px solid rgba(255,255,255,0.12)' : '1px solid rgba(0,0,0,0.12)';

  const [selectedCourseId, setSelectedCourseId] = useState<string>(initialCourseId || courses[0]?.id || '');
  const [activeTab, setActiveTab] = useState<'overview' | 'tareas' | 'notas' | 'archivos'>(initialTab);

  useEffect(() => {
    if (initialCourseId && initialCourseId !== selectedCourseId) {
      setSelectedCourseId(initialCourseId);
      setActiveTab(initialTab || 'overview');
      setSelectedOverviewNoteId(null);
      setOverviewNoteEditMode(false);
      setCurrentView('overview');
      setSelectedGroupId(null);
      setStudyToolMode('none');
      setShowMaterialsDropdown(false);
    }
  }, [initialCourseId]);

  // Topic view state
  const [currentView, setCurrentView] = useState<'overview' | 'topic' | 'group'>('overview');
  const [activeTopicId, setActiveTopicId] = useState<string | null>(null);
  const [filterMaterialType, setFilterMaterialType] = useState<MaterialType | 'all'>('all');

  // Course edit
  const [showEditCourse, setShowEditCourse] = useState(false);
  const [editCourseName, setEditCourseName] = useState('');
  const [editCourseCover, setEditCourseCover] = useState<string | undefined>(undefined);
  const [editCourseTeacher, setEditCourseTeacher] = useState('');
  const [editCourseColor, setEditCourseColor] = useState('#6366f1');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState('');

  // Group modals
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [groupName, setGroupName] = useState('');
  const [groupCover, setGroupCover] = useState<string | undefined>(undefined);
  const [inlineEditGroupId, setInlineEditGroupId] = useState<string | null>(null);
  const [inlineGroupName, setInlineGroupName] = useState('');
  const [inlineGroupCover, setInlineGroupCover] = useState<string | undefined>(undefined);
  const [showAgrupacionImportExport, setShowAgrupacionImportExport] = useState(false);
  const [importExportMode, setImportExportMode] = useState<'export' | 'import' | 'choose'>('choose');
  const [importTargetGroupId, setImportTargetGroupId] = useState<string | null>(null);
  const [hoverEdgePanel, setHoverEdgePanel] = useState(false);
  const [confirmDeleteGroupId, setConfirmDeleteGroupId] = useState<string | null>(null);
  const [confirmDeleteMatId, setConfirmDeleteMatId] = useState<string | null>(null);
  const [importPreviewData, setImportPreviewData] = useState<{ group: { name: string; image?: string }; topics: any[] }[] | null>(null);
  const [importSelected, setImportSelected] = useState<boolean[][]>([]);
  const [exportSelectedIds, setExportSelectedIds] = useState<Set<string>>(new Set());
  const groupCoverInputInlineRef = useRef<HTMLInputElement>(null);

  // Topic modals
  const [showTopicModal, setShowTopicModal] = useState(false);
  const [topicName, setTopicName] = useState('');
  const [editingTopicId, setEditingTopicId] = useState<string | null>(null);
  const [topicSearch, setTopicSearch] = useState('');

  // Material modals
  const [showMaterialModal, setShowMaterialModal] = useState(false);
  const [materialType, setMaterialType] = useState<MaterialType | null>(null);
  const [editingMaterial, setEditingMaterial] = useState<SubjectMaterial | null>(null);
  const [materialColIndex, setMaterialColIndex] = useState(0);
  const [materialForm, setMaterialForm] = useState({ name: '', clarification: '', title: '', content: '', word: '', meaning: '', question: '', answer: '', description: '', image: undefined as string | undefined });
  const setForm = (p: Partial<typeof materialForm>) => setMaterialForm(prev => ({ ...prev, ...p }));
  const resetForm = () => setMaterialForm({ name: '', clarification: '', title: '', content: '', word: '', meaning: '', question: '', answer: '', description: '', image: undefined });
  const resourceInputRef = useRef<HTMLInputElement>(null);
  const materialImageInputRef = useRef<HTMLInputElement>(null);

  // Add link modal
  const [showAddLinkModal, setShowAddLinkModal] = useState(false);
  const [addLinkUrl, setAddLinkUrl] = useState('');
  const [addLinkName, setAddLinkName] = useState('');

  // Edit link modal
  const [editLinkId, setEditLinkId] = useState<string | null>(null);
  const [editLinkUrl, setEditLinkUrl] = useState('');
  const [editLinkName, setEditLinkName] = useState('');

  // Plan session modal
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [planDate, setPlanDate] = useState('');
  const [planTitle, setPlanTitle] = useState('');
  const [planGroupId, setPlanGroupId] = useState('');
  const [planTopicId, setPlanTopicId] = useState('');
  const [planType, setPlanType] = useState<'estudio' | 'repaso' | 'ejercicio' | 'lectura' | 'otro'>('estudio');
  const [planDuration, setPlanDuration] = useState(30);

  // Week navigation
  const [weekOffset, setWeekOffset] = useState(0);

  // Day detail modal
  const [showDayDetail, setShowDayDetail] = useState(false);
  const [dayDetailDate, setDayDetailDate] = useState('');

  // Radar chart filter
  const [radarFilter, setRadarFilter] = useState<'agrupaciones' | 'dias' | 'tipos'>('agrupaciones');

  // Task state
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDescription, setNewTaskDescription] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<'high' | 'medium' | 'low' | 'none'>('none');
  const [newTaskDueDate, setNewTaskDueDate] = useState('');
  const [newTaskDueTime, setNewTaskDueTime] = useState('');
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editTaskTitle, setEditTaskTitle] = useState('');

  // Note state
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const editContentRef = useRef<HTMLDivElement>(null);
  const [notesSearch, setNotesSearch] = useState('');
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Note context menu
  const [noteMenuTarget, setNoteMenuTarget] = useState<string | null>(null);
  const noteMenuRef = useRef<HTMLDivElement>(null);
  // Notas tab context menu
  const [notasTabMenuTarget, setNotasTabMenuTarget] = useState<string | null>(null);
  const notasTabMenuRef = useRef<HTMLDivElement>(null);

  // Auto-focus contentEditable when entering editing mode
  useEffect(() => {
    if (editingNoteId) setTimeout(() => editContentRef.current?.focus(), 60);
  }, [editingNoteId]);
  // Study mode state
  const [showMaterialsDropdown, setShowMaterialsDropdown] = useState(false);
  const [studyToolMode, setStudyToolMode] = useState<'none' | 'flashcards' | 'quizzes' | 'notes' | 'mindmap' | 'review' | 'blurting' | 'feynman'>('none');

  const [overviewMode, setOverviewMode] = useState<'tareas_notas' | 'temas_archivos'>(() => {
    try { return (localStorage.getItem('owa_course_overview_mode') as 'tareas_notas' | 'temas_archivos') || 'tareas_notas'; } catch { return 'tareas_notas'; }
  });
  useEffect(() => { localStorage.setItem('owa_course_overview_mode', overviewMode); }, [overviewMode]);

  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(() => {
    if (overviewMode === 'temas_archivos' && selectedCourseId) {
      return localStorage.getItem(`owa_estudio_last_group_${selectedCourseId}`) || null;
    }
    return null;
  });

  useEffect(() => {
    if (overviewMode === 'temas_archivos' && selectedCourseId) {
      if (selectedGroupId) {
        localStorage.setItem(`owa_estudio_last_group_${selectedCourseId}`, selectedGroupId);
      } else {
        localStorage.removeItem(`owa_estudio_last_group_${selectedCourseId}`);
      }
    }
  }, [selectedGroupId, overviewMode, selectedCourseId]);

  // Persist study view state per course
  useEffect(() => {
    if (selectedCourseId && overviewMode === 'temas_archivos') {
      localStorage.setItem(`owa_study_view_${selectedCourseId}`, currentView);
    }
  }, [currentView, selectedCourseId, overviewMode]);
  useEffect(() => {
    if (selectedCourseId && activeTopicId && overviewMode === 'temas_archivos') {
      localStorage.setItem(`owa_study_topic_${selectedCourseId}`, activeTopicId);
    }
  }, [activeTopicId, selectedCourseId, overviewMode]);

  // Restore study state when course changes
  const prevCourseRef = useRef(selectedCourseId);
  useEffect(() => {
    if (selectedCourseId !== prevCourseRef.current && overviewMode === 'temas_archivos') {
      prevCourseRef.current = selectedCourseId;
      const savedView = localStorage.getItem(`owa_study_view_${selectedCourseId}`);
      if (savedView === 'topic' || savedView === 'group' || savedView === 'overview') {
        setCurrentView(savedView);
        if (savedView === 'topic') {
          const savedTopic = localStorage.getItem(`owa_study_topic_${selectedCourseId}`);
          if (savedTopic) setActiveTopicId(savedTopic);
        }
        if (savedView === 'group') {
          const savedGroup = localStorage.getItem(`owa_estudio_last_group_${selectedCourseId}`);
          if (savedGroup && groups.some(g => g.id === savedGroup)) {
            setSelectedGroupId(savedGroup);
          }
        }
      } else {
        setCurrentView('overview');
        setSelectedGroupId(null);
      }
    }
  }, [selectedCourseId, overviewMode]);

  const [modeAnimating, setModeAnimating] = useState(false);
  const [modePhase, setModePhase] = useState<'idle' | 'out' | 'in'>('idle');
  const prevMode = useRef(overviewMode);

  const handleToggleMode = () => {
    if (modeAnimating) return;
    setModeAnimating(true);
    setModePhase('out');
    setTimeout(() => {
      prevMode.current = overviewMode;
      const nextMode = overviewMode === 'tareas_notas' ? 'temas_archivos' : 'tareas_notas';
      setOverviewMode(nextMode);
      setCurrentView('overview');
      if (nextMode === 'temas_archivos' && selectedCourseId) {
        const savedGroup = localStorage.getItem(`owa_estudio_last_group_${selectedCourseId}`);
        if (savedGroup && groups.some(g => g.id === savedGroup)) {
          setSelectedGroupId(savedGroup);
          setCurrentView('group');
        } else {
          setSelectedGroupId(null);
          setCurrentView('overview');
        }
      } else {
        setSelectedGroupId(null);
        setCurrentView('overview');
      }
      setStudyToolMode('none');
      setModePhase('in');
      setTimeout(() => { setModePhase('idle'); setModeAnimating(false); }, 350);
    }, 200);
  };
  const [selectedOverviewNoteId, setSelectedOverviewNoteId] = useState<string | null>(null);
  const [overviewNoteEditMode, setOverviewNoteEditMode] = useState(false);
  const [overviewNoteHighlights, setOverviewNoteHighlights] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('owa_course_note_highlights') || '[]'); } catch { return []; }
  });
  const [confirmDeleteNoteId, setConfirmDeleteNoteId] = useState<string | null>(null);
  const [pendingTaskDeleteId, setPendingTaskDeleteId] = useState<string | null>(null);
  const [showOverviewNoteDates, setShowOverviewNoteDates] = useState(false);
  const [showCourseNotesInOverview, setShowCourseNotesInOverview] = useState(() => {
    try { return JSON.parse(localStorage.getItem('owa_show_course_notes') || 'false'); } catch { return false; }
  });
  useEffect(() => { localStorage.setItem('owa_show_course_notes', JSON.stringify(showCourseNotesInOverview)); }, [showCourseNotesInOverview]);
  const eyePressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const overviewNoteContainerRef = useRef<HTMLDivElement>(null);
  // Inline note creator state (Mode 1)
  const [overviewNoteContent, setOverviewNoteContent] = useState('');
  const overviewNoteRef = useRef<HTMLTextAreaElement>(null);
  const [overviewAddingNote, setOverviewAddingNote] = useState(false);
  const [overviewEditContent, setOverviewEditContent] = useState('');
  const [overviewNotesSort, setOverviewNotesSort] = useState<'date' | 'title'>('date');
  const [showCompletedTasks, setShowCompletedTasks] = useState(false);

  // Escape key closes expanded overview note or editing mode
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (selectedOverviewNoteId) {
          setSelectedOverviewNoteId(null);
          setOverviewNoteEditMode(false);
          setConfirmDeleteNoteId(null);
        } else if (editingNoteId) {
          setEditingNoteId(null);
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedOverviewNoteId, editingNoteId]);

  useEffect(() => {
    localStorage.setItem('owa_course_note_highlights', JSON.stringify(overviewNoteHighlights));
  }, [overviewNoteHighlights]);

  const toggleHighlight = (id: string) => {
    setOverviewNoteHighlights(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  // PDF preview modal
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState('');
  const [pdfPreviewName, setPdfPreviewName] = useState('');

  // Inline audio player
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [audioProgress, setAudioProgress] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onTime = () => setAudioProgress(a.currentTime);
    const onDur = () => setAudioDuration(a.duration || 0);
    const onEnd = () => { setPlayingAudioId(null); setAudioProgress(0); };
    a.addEventListener('timeupdate', onTime);
    a.addEventListener('loadedmetadata', onDur);
    a.addEventListener('ended', onEnd);
    return () => { a.removeEventListener('timeupdate', onTime); a.removeEventListener('loadedmetadata', onDur); a.removeEventListener('ended', onEnd); };
  }, []);

  // Image preview modal
  const [showImagePreview, setShowImagePreview] = useState(false);
  const [previewImageSrc, setPreviewImageSrc] = useState<string | null>(null);
  const [previewZoom, setPreviewZoom] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0, offX: 0, offY: 0 });

  const handleWheel = useCallback((e: React.WheelEvent) => {
    const delta = e.deltaY > 0 ? -0.05 : 0.05;
    setPreviewZoom(z => {
      const next = Math.max(1, Math.min(2.5, z + delta));
      if (next <= 1) setPanOffset({ x: 0, y: 0 });
      return next;
    });
  }, []);

  const handlePanStart = useCallback((e: React.MouseEvent) => {
    setIsPanning(true);
    panStartRef.current = { x: e.clientX, y: e.clientY, offX: panOffset.x, offY: panOffset.y };
  }, [panOffset]);

  const handlePanMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning) return;
    const dx = e.clientX - panStartRef.current.x;
    const dy = e.clientY - panStartRef.current.y;
    const limit = previewZoom <= 1 ? 0 : Math.max(20, (previewZoom - 1) * 300);
    setPanOffset({
      x: Math.max(-limit, Math.min(limit, panStartRef.current.offX + dx)),
      y: Math.max(-limit, Math.min(limit, panStartRef.current.offY + dy)),
    });
  }, [isPanning, previewZoom]);

  const handlePanEnd = useCallback(() => {
    setIsPanning(false);
  }, []);



  // Refs
  const courseCoverInputRef = useRef<HTMLInputElement>(null);
  const groupCoverInputRef = useRef<HTMLInputElement>(null);

  const course = useMemo(() => courses.find(c => c.id === selectedCourseId) || courses[0], [courses, selectedCourseId]);

  // Planned sessions for the selected plan date
  const dayPlannedSessions = useMemo(() => {
    return (plannedSessions || []).filter(s => s.courseId === course?.id && s.date === planDate && !s.completed);
  }, [plannedSessions, course?.id, planDate]);

  useEffect(() => {
    if (course) {
      setEditCourseName(course.name);
      setEditCourseCover(course.coverUrl || course.coverImage);
      setEditCourseTeacher(course.teacher || course.teacherName || '');
    }
  }, [course]);

  // Sync initial tab
  useEffect(() => { setActiveTab(initialTab); }, [initialTab]);

  // Save last active tab per course to localStorage for hub recall
  useEffect(() => {
    if (selectedCourseId && activeTab !== 'overview') {
      try {
        const raw = localStorage.getItem('owa_last_course_tab') || '{}';
        const map = JSON.parse(raw);
        map[selectedCourseId] = activeTab;
        localStorage.setItem('owa_last_course_tab', JSON.stringify(map));
      } catch {}
    }
  }, [selectedCourseId, activeTab]);

  // Escape key
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (noteMenuTarget) { setNoteMenuTarget(null); return; }
        if (notasTabMenuTarget) { setNotasTabMenuTarget(null); return; }
        if (showMaterialModal) setShowMaterialModal(false);
        else if (showGroupModal) setShowGroupModal(false);
        else if (showTopicModal) setShowTopicModal(false);
        else if (showEditCourse) setShowEditCourse(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showMaterialModal, showGroupModal, showTopicModal, showEditCourse, noteMenuTarget]);

  // Close note menus on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (noteMenuTarget && noteMenuRef.current && !noteMenuRef.current.contains(e.target as Node)) {
        setNoteMenuTarget(null);
      }
      if (notasTabMenuTarget && notasTabMenuRef.current && !notasTabMenuRef.current.contains(e.target as Node)) {
        setNotasTabMenuTarget(null);
      }
    };
    if (noteMenuTarget || notasTabMenuTarget) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [noteMenuTarget, notasTabMenuTarget]);

  const activeTopic = useMemo(() => {
    if (!course || !activeTopicId) return null;
    return (course.studyTopics || []).find(t => t.id === activeTopicId) || null;
  }, [course, activeTopicId]);

  // Course tasks
  const courseTasks = useMemo(() => tasks.filter(t => t.course === course?.name), [tasks, course]);
  const courseTaskStats = useMemo(() => {
    const total = courseTasks.length;
    const done = courseTasks.filter(t => t.status === 'completado').length;
    const pending = courseTasks.filter(t => t.status === 'inicio').length;
    const progress = courseTasks.filter(t => t.status === 'progreso').length;
    return { total, done, pending, progress, pct: total > 0 ? Math.round((done / total) * 100) : 0 };
  }, [courseTasks]);
  const pendingTasks = useMemo(() => courseTasks.filter(t => t.status !== 'completado'), [courseTasks]);

  // Course notes
  const courseNotes = useMemo(() => notes.filter(n => n.course === course?.name && !n.deletedAt), [notes, course]);
  const filteredCourseNotes = useMemo(() => {
    return showCourseNotesInOverview ? courseNotes : courseNotes.filter(n => n.isCoursePrivate);
  }, [courseNotes, showCourseNotesInOverview]);
  const sortedIds = useMemo(() => {
    const arr = [...filteredCourseNotes].sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      const ao = a.sortOrder ?? 9999, bo = b.sortOrder ?? 9999;
      if (ao !== bo) return ao - bo;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
    return arr.map(n => n.id);
  }, [filteredCourseNotes]);

  const handleDeleteImage = useCallback(() => {
    if (!selectedOverviewNoteId || !previewImageSrc) return;
    const note = filteredCourseNotes.find(n => n.id === selectedOverviewNoteId);
    if (!note || !note.content) { setShowImagePreview(false); return; }
    const temp = document.createElement('div');
    temp.innerHTML = note.content;
    const imgs = temp.querySelectorAll('img');
    for (const img of imgs) {
      if (img.getAttribute('src') === previewImageSrc) {
        img.remove();
        break;
      }
    }
    const newContent = temp.innerHTML;
    if (newContent !== note.content) updateNote(note.id, { content: newContent });
    setShowImagePreview(false);
    setPreviewZoom(1);
    setPanOffset({ x: 0, y: 0 });
  }, [selectedOverviewNoteId, previewImageSrc, filteredCourseNotes, updateNote]);



  const expandedFirst = useMemo(() => {
    const arr = [...filteredCourseNotes].sort((a, b) => {
      if (a.id === selectedOverviewNoteId) return -1;
      if (b.id === selectedOverviewNoteId) return 1;
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      const ao = a.sortOrder ?? 9999, bo = b.sortOrder ?? 9999;
      if (ao !== bo) return ao - bo;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
    return arr;
  }, [filteredCourseNotes, selectedOverviewNoteId]);
  const filteredNotes = useMemo(() => {
    if (!notesSearch.trim()) return courseNotes;
    const q = notesSearch.toLowerCase();
    return courseNotes.filter(n => (n.title || '').toLowerCase().includes(q) || (n.content || '').toLowerCase().includes(q));
  }, [courseNotes, notesSearch]);
  const sortedNotes = useMemo(() => {
    return [...courseNotes].sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      const ao = a.sortOrder ?? 9999, bo = b.sortOrder ?? 9999;
      if (ao !== bo) return ao - bo;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }, [courseNotes]);
  const allCourseTags = useMemo(() => {
    const s = new Set<string>();
    courseNotes.forEach(n => n.tags?.forEach((t: string) => s.add(t)));
    try { JSON.parse(localStorage.getItem("owa_created_tags") || "[]").forEach((t: string) => s.add(t)); } catch {}
    if (course?.name) s.add(course.name);
    return Array.from(s);
  }, [courseNotes, course]);

  // Course resources (from all topics)
  const allCourseMaterials = useMemo(() => {
    const mats: SubjectMaterial[] = [];
    (course?.studyTopics || []).forEach(t => (t.materials || []).forEach(m => mats.push({ ...m, _topicTitle: t.title } as SubjectMaterial & { _topicTitle: string })));
    return mats.filter(m => m.type === 'resource');
  }, [course]);

  // --- Handlers ---
  const handleSaveCourseSettings = () => {
    if (!editCourseName.trim()) return;
    updateCourse(course.id, { name: editCourseName.trim(), coverImage: editCourseCover, coverUrl: editCourseCover, color: editCourseColor, teacher: editCourseTeacher.trim() || undefined, teacherName: editCourseTeacher.trim() || undefined });
    setShowEditCourse(false);
    toast.success('Guardado');
  };

  const handleConfirmDeleteCourse = () => {
    if (deleteConfirmName.trim() !== course.name) return;
    deleteCourse(course.id);
    setShowDeleteConfirm(false);
    setShowEditCourse(false);
    setDeleteConfirmName('');
    setCurrentView('overview');
    setOverviewMode('tareas_notas');
    toast.success('Asignatura eliminada');
  };

  // --- Topic CRUD ---
  const handleAddTopic = () => {
    if (!topicName.trim()) return;
    const current = course.studyTopics || [];
    if (editingTopicId) {
      updateCourse(course.id, { studyTopics: current.map(t => t.id === editingTopicId ? { ...t, title: topicName.trim() } : t) });
      toast.success('Tema actualizado');
    } else {
      updateCourse(course.id, { studyTopics: [...current, { id: Math.random().toString(), title: topicName.trim(), status: 'pending' as const, createdAt: Date.now(), reviewLevel: 0, nextReview: Date.now(), materials: [] }] });
      toast.success('Tema creado');
    }
    setTopicName(''); setEditingTopicId(null); setShowTopicModal(false);
  };

  const handleDeleteTopic = (id: string) => {
    const current = course.studyTopics || [];
    updateCourse(course.id, { studyTopics: current.filter(t => t.id !== id) });
    toast.success('Tema eliminado');
  };

  // --- Group CRUD ---
  const handleSaveGroup = () => {
    if (!groupName.trim()) return;
    const currentGroups = course.groups || [];
    let updatedGroups = [...currentGroups];
    if (editingGroupId) updatedGroups = updatedGroups.map(g => g.id === editingGroupId ? { ...g, name: groupName.trim(), image: groupCover } : g);
    else updatedGroups.push({ id: editingGroupId || Math.random().toString(), name: groupName.trim(), image: groupCover, createdAt: Date.now() });
    updateCourse(course.id, { groups: updatedGroups });
    setGroupName(''); setGroupCover(undefined); setEditingGroupId(null); setShowGroupModal(false);
    toast.success(editingGroupId ? 'Agrupacion actualizada' : 'Agrupacion creada');
  };

  const startEditGroup = (g: SubjectGroup) => {
    setEditingGroupId(g.id); setGroupName(g.name); setGroupCover(g.image); setShowGroupModal(true);
  };
  const handleDeleteGroup = (groupId: string) => {
    const currentGroups = course.groups || [];
    updateCourse(course.id, { groups: currentGroups.filter(g => g.id !== groupId), studyTopics: (course.studyTopics || []).map(t => t.groupId === groupId ? { ...t, groupId: undefined } : t) });
    toast.success('Agrupación eliminada');
  };

  // --- Materials ---
  const handleAddMaterialClick = (type: MaterialType, colIdx: number) => {
    if (type === 'resource') { setMaterialColIndex(colIdx); resourceInputRef.current?.click(); return; }
    setMaterialType(type); setMaterialColIndex(colIdx); setEditingMaterial(null); resetForm(); setShowMaterialModal(true);
  };

  const estudioFileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, overrideTopicId?: string) => {
    const file = e.target.files?.[0]; if (!file) return;
    const tid = overrideTopicId || activeTopic?.id;
    if (!tid) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const newMat: SubjectMaterial = { id: Math.random().toString(), type: 'resource', createdAt: Date.now(), columnIndex: materialColIndex, name: file.name, fileType: file.type, dataUrl: event.target?.result as string };
      updateCourse(course.id, { studyTopics: (course.studyTopics || []).map(t => t.id === tid ? { ...t, materials: [...(t.materials || []), newMat] } : t) });
      toast.success('Archivo subido');
    };
    reader.readAsDataURL(file); if (e.target) e.target.value = '';
  };

  const handleAddLink = () => {
    if (!addLinkUrl.trim()) return;
    const topic = parsedTopics[0];
    if (!topic) return;
    const url = addLinkUrl.trim();
    const name = addLinkName.trim() || url;
    const newMat: SubjectMaterial = { id: Math.random().toString(), type: 'resource', createdAt: Date.now(), columnIndex: 0, name, dataUrl: url };
    updateCourse(course.id, { studyTopics: (course.studyTopics || []).map(t => t.id === topic.id ? { ...t, materials: [...(t.materials || []), newMat] } : t) });
    setAddLinkUrl(''); setAddLinkName(''); setShowAddLinkModal(false);
    toast.success('Enlace agregado');
  };

  const handleSaveEditLink = () => {
    if (!editLinkId || !editLinkUrl.trim()) return;
    updateCourse(course.id, {
      studyTopics: (course.studyTopics || []).map(t => ({
        ...t,
        materials: (t.materials || []).map(m => m.id === editLinkId ? { ...m, name: editLinkName.trim() || editLinkUrl.trim(), dataUrl: editLinkUrl.trim() } : m)
      }))
    });
    setEditLinkId(null); setEditLinkUrl(''); setEditLinkName('');
    toast.success('Enlace actualizado');
  };

  const handleSaveMaterial = () => {
    if (!materialType || !activeTopic) return;
    const { name, clarification, title, content, word, meaning, question, answer, description, image } = materialForm;
    let payload: Partial<SubjectMaterial> = {};
    switch (materialType) {
      case 'formula': if (!name.trim()) return; payload = { name: name.trim(), clarification: clarification.trim(), image }; break;
      case 'concept': if (!title.trim()) return; payload = { title: title.trim(), content: content.trim() }; break;
      case 'key-data': if (!content.trim()) return; payload = { title: title.trim(), content: content.trim() }; break;
      case 'meaning': if (!word.trim() || !meaning.trim()) return; payload = { word: word.trim(), meaning: meaning.trim() }; break;
      case 'quiz': if (!question.trim() || !answer.trim()) return; payload = { question: question.trim(), answer: answer.trim() }; break;
      case 'procedure': if (!title.trim() || !content.trim()) return; payload = { title: title.trim(), description: description.trim(), content: content.trim(), image }; break;
    }
    updateCourse(course.id, {
      studyTopics: (course.studyTopics || []).map(t => {
        if (t.id === activeTopic.id) {
          let ms = t.materials || [];
          if (editingMaterial) ms = ms.map(m => m.id === editingMaterial.id ? { ...m, ...payload } : m);
          else ms = [...ms, { id: Math.random().toString(), type: materialType, createdAt: Date.now(), columnIndex: materialColIndex, ...payload } as SubjectMaterial];
          return { ...t, materials: ms };
        }
        return t;
      })
    });
    setShowMaterialModal(false); toast.success(editingMaterial ? 'Actualizado' : 'Guardado');
  };

  const startEditMaterial = (mat: SubjectMaterial) => {
    setEditingMaterial(mat); setMaterialType(mat.type); setMaterialColIndex(mat.columnIndex);
    setForm({ name: mat.name || '', clarification: mat.clarification || '', title: mat.title || '', content: mat.content || '', word: mat.word || '', meaning: mat.meaning || '', question: mat.question || '', answer: mat.answer || '', description: mat.description || '', image: mat.image });
    setShowMaterialModal(true);
  };

  const handleDeleteMaterial = (mat: SubjectMaterial) => {
    if (!activeTopic) return;
    updateCourse(course.id, { studyTopics: (course.studyTopics || []).map(t => t.id === activeTopic.id ? { ...t, materials: (t.materials || []).filter(m => m.id !== mat.id) } : t) });
    toast.success('Material removido');
  };

  const handleDeleteResourceFromOverview = (matId: string) => {
    updateCourse(course.id, { studyTopics: (course.studyTopics || []).map(t => ({ ...t, materials: (t.materials || []).filter(m => m.id !== matId) })) });
    toast.success('Material eliminado');
    setConfirmDeleteMatId(null);
  };

  const handleOpenResource = (mat: SubjectMaterial) => {
    if (!mat.dataUrl) return;
    setPdfPreviewUrl(mat.dataUrl);
    setPdfPreviewName(mat.name || 'Archivo');
    setShowPdfPreview(true);
  };

  const setTopicReviewLevel = (topicId: string, level: number) => {
    updateCourse(course.id, { studyTopics: (course.studyTopics || []).map(t => t.id === topicId ? { ...t, reviewLevel: level, status: level >= 4 ? 'done' as const : 'studying' as const } : t) });
    toast.success(`Nivel: ${level}/5`);
  };

  // --- Drag and Drop ---
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const activeTopicMaterials = useMemo(() => {
    if (!activeTopic) return [];
    const all = activeTopic.materials || [];
    return filterMaterialType === 'all' ? all : all.filter(m => m.type === filterMaterialType);
  }, [activeTopic, filterMaterialType]);
  const columns = useMemo(() => {
    const cols: SubjectMaterial[][] = [[], [], []];
    activeTopicMaterials.forEach(mat => { const ci = mat.columnIndex; if (typeof ci === 'number' && ci >= 0 && ci <= 2) cols[ci].push(mat); else cols[0].push(mat); });
    cols.forEach(c => c.sort((a, b) => b.createdAt - a.createdAt));
    return cols;
  }, [activeTopicMaterials]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event; if (!over || !activeTopic) return;
    const activeId = active.id as string, overId = over.id as string;
    let aci = -1, oci = -1;
    for (let i = 0; i < 3; i++) { if (columns[i].some(m => m.id === activeId)) aci = i; if (columns[i].some(m => m.id === overId)) oci = i; }
    if (overId.startsWith('col-')) oci = parseInt(overId.split('-')[1]);
    if (aci === -1 || oci === -1) return;
    const mats = [...(activeTopic.materials || [])];
    const tm = mats.find(m => m.id === activeId);
    if (tm) { tm.columnIndex = oci; tm.createdAt = Date.now(); updateCourse(course.id, { studyTopics: (course.studyTopics || []).map(t => t.id === activeTopic.id ? { ...t, materials: mats } : t) }); }
  };

  const handleNoteDragEnd = (event: DragEndEvent) => {
    if (notesSearch) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = sortedNotes.map(n => n.id);
    const oldIdx = ids.indexOf(active.id as string);
    const newIdx = ids.indexOf(over.id as string);
    if (oldIdx < 0 || newIdx < 0) return;
    const newIds = [...ids];
    const [moved] = newIds.splice(oldIdx, 1);
    newIds.splice(newIdx, 0, moved);
    reorderNotes(newIds);
  };

  const handleOverviewNoteDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const sorted = [...courseNotes].sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      const ao = a.sortOrder ?? 9999, bo = b.sortOrder ?? 9999;
      if (ao !== bo) return ao - bo;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
    const ids = sorted.map(n => n.id);
    const oldIdx = ids.indexOf(active.id as string);
    const newIdx = ids.indexOf(over.id as string);
    if (oldIdx < 0 || newIdx < 0) return;
    const newIds = [...ids];
    const [moved] = newIds.splice(oldIdx, 1);
    newIds.splice(newIdx, 0, moved);
    reorderNotes(newIds);
  };

  // --- Task Handlers ---
  const handleAddTask = () => {
    if (!newTaskTitle.trim() || !course) return;
    const dueDateTime = newTaskDueDate ? (newTaskDueTime ? `${newTaskDueDate}T${newTaskDueTime}` : newTaskDueDate) : undefined;
    addTask({ title: newTaskTitle.trim(), course: course.name, courseColor: course.color, priority: newTaskPriority, urgent: false, important: false, dueDate: dueDateTime, notes: newTaskDescription.trim() || '', estimatedMinutes: undefined });
    setNewTaskTitle(''); setNewTaskDescription(''); setNewTaskPriority('none'); setNewTaskDueDate(''); setNewTaskDueTime('');
    toast.success('Tarea añadida');
  };

  const handleToggleTask = (taskId: string) => {
    const task = courseTasks.find(t => t.id === taskId);
    if (!task) return;
    const nextStatus = task.status === 'inicio' ? 'progreso' as const : task.status === 'progreso' ? 'completado' as const : 'inicio' as const;
    updateTask(taskId, { status: nextStatus, completedAt: nextStatus === 'completado' ? new Date().toISOString() : undefined });
  };

  const handleSaveTaskTitle = () => {
    if (!editingTaskId || !editTaskTitle.trim()) return;
    updateTask(editingTaskId, { title: editTaskTitle.trim() });
    setEditingTaskId(null); setEditTaskTitle('');
    toast.success('Tarea actualizada');
  };

  // --- Note Handlers ---
  const handleSaveNoteData = (id: string, data: any) => {
    if (id === 'new') {
      addNote({ title: data.title, content: data.content, tags: data.tags || [course.name], folderId: '', isPinned: false, course: course.name, courseColor: course.color });
      setEditingNoteId(null);
    } else {
      updateNote(id, data);
    }
  };

  const handleCreateNote = () => {
    const courseFolder = noteFolders.find(f => f.courseId === course.id);
    const id = addNote({ title: '', content: '', tags: courseFolder ? [] : [course.name], folderId: courseFolder?.id || '', isPinned: false, course: course.name, courseColor: course.color });
    setEditingNoteId(id);
    setEditContent('');
    setSelectedNoteId(id);
  };

  const handleOverviewCreateNote = () => {
    if (!overviewNoteContent.trim() || !course) return;
    const content = `<p>${overviewNoteContent.trim()}</p>`;
    addNote({ title: '', content, tags: [course.name], folderId: '', isPinned: false, course: course.name, courseColor: course.color });
    setOverviewNoteContent('');
    setOverviewAddingNote(false);
    toast.success('Apunte creado');
  };

  const handleTogglePinNote = (id: string) => {
    const note = courseNotes.find(n => n.id === id);
    if (note) updateNote(id, { isPinned: !note.isPinned });
  };

  const handleNoteFormat = (cmd: string, value?: string) => {
    document.execCommand(cmd, false, value);
    editContentRef.current?.focus();
  };

  const handleOverviewDeleteNote = (id: string) => {
    deleteNote(id);
    if (selectedOverviewNoteId === id) setSelectedOverviewNoteId(null);
    toast.success('Nota eliminada');
  };

  const handleDeleteNote = (id: string) => {
    deleteNote(id);
    if (selectedNoteId === id) setSelectedNoteId(null);
    if (editingNoteId === id) setEditingNoteId(null);
    toast.success('Nota eliminada');
  };

  // --- Stats ---
  const topicMasteryStats = useMemo(() => {
    const pt = course?.studyTopics || [];
    const total = pt.length;
    const mastered = pt.filter(t => t.reviewLevel >= 4).length;
    const progressPct = total > 0 ? Math.round((mastered / total) * 100) : 0;
    return { total, mastered, studying: pt.filter(t => t.reviewLevel > 0 && t.reviewLevel < 4).length, pending: pt.filter(t => t.reviewLevel === 0).length, totalMaterials: pt.reduce((s, t) => s + (t.materials?.length || 0), 0), progressPct };
  }, [course]);

  if (!course) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: 40, gap: 12 }}>
        <GraduationCap size={48} style={{ color: 'var(--text-muted)', opacity: 0.3 }} />
        <p style={{ color: 'var(--text-secondary)', fontSize: 15 }}>Asignatura no encontrada</p>
        <button onClick={() => setNavigateTo('cursos')} style={{ height: 36, padding: '0 20px', borderRadius: 10, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Volver</button>
      </div>
    );
  }

  const parsedTopics = course.studyTopics || [];
  const groups = course.groups || [];
  const ungroupedTopics = parsedTopics.filter(t => !t.groupId);

  // ─── RENDER ───
  return (
    <div className="cursos-root-view" style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg-base)', overflow: 'hidden' }}>
      {/* Breadcrumb - only when not in overview */}
      {activeTab !== 'overview' && (
        <div className="bento-card" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 20px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0, background: 'var(--bg-surface)' }}>
          <button onClick={() => setNavigateTo('cursos')} style={{ display: 'flex', alignItems: 'center', gap: 4, height: 26, padding: '0 8px', borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 11, fontWeight: 500 }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--text-secondary)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
            <ChevronLeft size={14} /> Asignaturas
          </button>
          <span style={{ color: 'var(--text-muted)', fontSize: 9 }}>/</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: currentView === 'topic' ? 'var(--text-muted)' : 'var(--text-primary)' }}>{course.name}</span>
          {currentView === 'topic' && activeTopic && (
            <><span style={{ color: 'var(--text-muted)', fontSize: 9 }}>/</span><span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{activeTopic.title}</span></>
          )}
        </div>
      )}

      {/* Tabs - only when not in overview */}
      {activeTab !== 'overview' && currentView === 'overview' && (
        <div className="bento-card" style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border-subtle)', flexShrink: 0, background: 'var(--bg-surface)', padding: '0 20px' }}>
          {(['overview', 'tareas', 'notas', 'archivos'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, height: 36, padding: '0 16px',
                border: 'none', borderBottom: `2px solid ${activeTab === tab ? course.color : 'transparent'}`,
                background: 'transparent', cursor: 'pointer', color: activeTab === tab ? course.color : 'var(--text-muted)',
                fontSize: 11, fontWeight: activeTab === tab ? 600 : 400, textTransform: 'uppercase', letterSpacing: '0.06em',
                transition: 'all 200ms',
              }}>
              {tab === 'overview' && <BookOpen size={13} />}
              {tab === 'tareas' && <ListTodo size={13} />}
              {tab === 'notas' && <StickyNote size={13} />}
              {tab === 'archivos' && <FolderOpen size={13} />}
              {tab === 'overview' ? 'General' : tab === 'tareas' ? 'Lista' : tab === 'notas' ? 'Apuntes' : tab === 'archivos' ? 'Archivos' : ''}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      <div style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column', overflowY: currentView === 'overview' ? 'hidden' : 'auto', overflowX: 'hidden' }}>
        {currentView === 'topic' && activeTopic ? (
          /* ─── TOPIC VIEW ─── */
          <div style={{ padding: '16px 24px 60px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button onClick={() => setCurrentView('overview')} style={{ width: 30, height: 30, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', cursor: 'pointer', color: 'var(--text-secondary)' }}><ChevronLeft size={13} /></button>
                <div>
                  <div style={{ fontSize: 8, fontWeight: 700, color: course.color, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{course.name}</div>
                  <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: '2px 0 0', fontFamily: "'Inter Tight', sans-serif" }}>{activeTopic.title}</h2>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 8, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Comprensión:</span>
                <div style={{ display: 'flex', gap: 2 }}>{[...Array(5)].map((_, i) => (
                  <button key={i} onClick={() => setTopicReviewLevel(activeTopic.id, i + 1)} style={{ width: 10, height: 5, borderRadius: 2, border: 'none', cursor: 'pointer', background: i < activeTopic.reviewLevel ? course.color : 'var(--bg-hover)', transition: 'all 200ms' }} />
                ))}</div>
              </div>
            </div>
            {/* Filter */}
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 12, paddingBottom: 10, borderBottom: '1px solid var(--border-subtle)' }}>
              <button onClick={() => setFilterMaterialType('all')} style={{ height: 26, padding: '0 8px', borderRadius: 5, fontSize: 9, fontWeight: 600, border: filterMaterialType === 'all' ? 'none' : '1px solid var(--border-subtle)', background: filterMaterialType === 'all' ? course.color : 'transparent', color: filterMaterialType === 'all' ? '#fff' : 'var(--text-secondary)', cursor: 'pointer', transition: 'all 150ms' }}>Todos ({activeTopic.materials?.length || 0})</button>
              {(Object.keys(MATERIAL_META) as MaterialType[]).map(type => {
                const count = (activeTopic.materials || []).filter(m => m.type === type).length;
                if (count === 0) return null;
                const Icon = MATERIAL_META[type].icon;
                return <button key={type} onClick={() => setFilterMaterialType(type)} style={{ height: 26, padding: '0 8px', borderRadius: 5, fontSize: 9, fontWeight: 600, border: filterMaterialType === type ? 'none' : '1px solid var(--border-subtle)', background: filterMaterialType === type ? course.color : 'transparent', color: filterMaterialType === type ? '#fff' : 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3, transition: 'all 150ms' }}><Icon size={9} /> {MATERIAL_META[type].label} ({count})</button>;
              })}
            </div>
            {/* Quick add */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 12, flexWrap: 'wrap' }}>
              {(Object.keys(MATERIAL_META) as MaterialType[]).filter(t => t !== 'resource').map(type => {
                const Icon = MATERIAL_META[type].icon;
                const accentColors: Record<string, string> = { formula: '#8B5CF6', concept: '#3B82F6', 'key-data': '#F59E0B', meaning: '#10B981', quiz: '#EF4444', procedure: '#EC4899' };
                const c = accentColors[type] || course.color;
                return <button key={type} onClick={() => handleAddMaterialClick(type, 0)} style={{ display: 'flex', alignItems: 'center', gap: 3, height: 24, padding: '0 8px', borderRadius: 5, fontSize: 9, fontWeight: 600, border: 'none', background: `${c}12`, color: c, cursor: 'pointer', transition: 'all 150ms' }}
                  onMouseEnter={e => e.currentTarget.style.background = `${c}25`} onMouseLeave={e => e.currentTarget.style.background = `${c}12`}><Icon size={9} /> {MATERIAL_META[type].label}</button>;
              })}
              <button onClick={() => handleAddMaterialClick('resource', 0)} style={{ display: 'flex', alignItems: 'center', gap: 3, height: 24, padding: '0 8px', borderRadius: 5, fontSize: 9, fontWeight: 600, border: '1px dashed var(--border-subtle)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', transition: 'all 150ms' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = course.color; e.currentTarget.style.color = course.color; }} onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.color = 'var(--text-muted)'; }}><Upload size={9} /> Archivo</button>
            </div>
            {/* 3-col kanban */}
            <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, alignItems: 'start' }}>
                {[{ idx: 0, label: 'Teoría', desc: 'Conceptos, fórmulas' }, { idx: 1, label: 'Práctica', desc: 'Cuestionarios, procedimientos' }, { idx: 2, label: 'Anexos', desc: 'Recursos, archivos' }].map(({ idx, label, desc }) => {
                  const colItems = columns[idx] || [];
                  return (
                    <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ padding: '8px 10px', borderRadius: 8, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-primary)' }}>{label}</div>
                        <div style={{ fontSize: 8, color: 'var(--text-muted)', marginTop: 2 }}>{desc} · {colItems.length}</div>
                      </div>
                      <DroppableColumn id={`col-${idx}`} items={colItems}>
                        {colItems.map(mat => (
                          <SortableWrapper key={mat.id} id={mat.id}>
                            {({ attributes, listeners }) => <MaterialCard mat={mat} dragAttributes={attributes} dragListeners={listeners} onEdit={startEditMaterial} onDelete={handleDeleteMaterial} onOpenResource={handleOpenResource} />}
                          </SortableWrapper>
                        ))}
                        {colItems.length === 0 && <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 80, borderRadius: 6, border: '1px dashed var(--border-subtle)', opacity: 0.2, fontSize: 9, color: 'var(--text-muted)' }}>Arrastra aquí</div>}
                      </DroppableColumn>
                    </div>
                  );
                })}
              </div>
            </DndContext>
            <input type="file" ref={resourceInputRef} style={{ display: 'none' }} onChange={handleFileUpload} />
          </div>
        ) : activeTab === 'overview' ? (
            /* ─── OVERVIEW TAB ─── */
          <div>
            {/* Big banner */}
            <div style={{ position: 'relative', height: 200, overflow: 'hidden', background: `linear-gradient(135deg, ${course.color}33 0%, var(--bg-surface) 100%)` }}>
              {(() => {
                const grpImage = currentView === 'group' && selectedGroupId ? groups.find(g => g.id === selectedGroupId)?.image : undefined;
                const imgSrc = grpImage || course.coverUrl || course.coverImage;
                return imgSrc ? (
                  <><img src={imgSrc} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.6 }} /><div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, rgba(0,0,0,0.65) 0%, transparent 60%)' }} /></>
                ) : <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(135deg, ${course.color}22, rgba(0,0,0,0.4))` }} />;
              })()}
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', padding: '0 32px', gap: 20 }}>
                <div style={{ flex: 1 }}>
                  {currentView === 'group' && selectedGroupId ? (() => {
                    const activeGrp = groups.find(g => g.id === selectedGroupId);
                    return activeGrp ? (
                      <>
                        <h1 style={{ fontSize: 40, fontWeight: 200, color: '#fff', margin: '0 0 10px', letterSpacing: '-0.03em', fontFamily: "'Inter Tight', sans-serif", textShadow: '0 2px 20px rgba(0,0,0,0.6)' }}>{activeGrp.name}</h1>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <span style={{ fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.6)', letterSpacing: '0.01em', borderBottom: '1px solid rgba(255,255,255,0.15)', paddingBottom: 2 }}>{course.name}</span>
                        </div>
                      </>
                    ) : null;
                  })() : (
                    <>
                      <h1 style={{ fontSize: 48, fontWeight: 200, color: '#fff', margin: '0 0 12px', letterSpacing: '-0.03em', fontFamily: "'Inter Tight', sans-serif", textShadow: '0 2px 20px rgba(0,0,0,0.6)' }}>{course.name}</h1>
                      {(course.teacher || course.teacherName) && <span style={{ fontSize: 16, fontWeight: 300, color: 'rgba(255,255,255,0.5)', display: 'block', lineHeight: 1.4, letterSpacing: '0.02em' }}>{course.teacher || course.teacherName}</span>}
                    </>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {currentView === 'group' ? (
                    <>
                      <button onClick={() => { setCurrentView('overview'); setSelectedGroupId(null); }} style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)', cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 150ms' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.25)'} onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}><ChevronLeft size={14} /></button>
                       <button onClick={() => { const grp = groups.find(g => g.id === selectedGroupId); if (grp) { setEditingGroupId(grp.id); setGroupName(grp.name); setGroupCover(grp.image); setShowGroupModal(true); } }} style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)', cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 150ms' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.25)'} onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}><Pencil size={13} /></button>
                       <button onClick={() => { setImportExportMode('choose'); setImportPreviewData(null); setImportSelected([]); setImportTargetGroupId(selectedGroupId); setShowAgrupacionImportExport(true); }} style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)', cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 150ms' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.25)'} onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'} title="Importar / Exportar"><Package size={13} /></button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => { setEditCourseName(course.name); setEditCourseTeacher(course.teacher || course.teacherName || ''); setEditCourseCover(course.coverUrl || course.coverImage); setEditCourseColor(course.color); setDeleteConfirmName(''); setShowEditCourse(true); }} style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)', cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.25)'} onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}><Pencil size={13} /></button>
                      <button onClick={handleToggleMode}
                        title={overviewMode === 'tareas_notas' ? 'Modo Estudio' : 'Vista General'}
                        style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)', cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 300ms cubic-bezier(0.16, 1, 0.3, 1)' }}>
                        <ArrowLeftRight size={13} style={{ transition: 'transform 400ms cubic-bezier(0.16, 1, 0.3, 1)', transform: overviewMode === 'temas_archivos' ? 'rotate(180deg)' : 'rotate(0deg)' }} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
            {/* Content based on mode — with crossfade animation */}
            <div style={{
              transition: 'all 350ms cubic-bezier(0.16, 1, 0.3, 1)',
              opacity: modePhase === 'out' ? 0 : 1,
              transform: modePhase === 'out' ? 'translateY(8px) scale(0.97)' : modePhase === 'in' ? 'translateY(-4px) scale(1.005)' : 'none',
              filter: modePhase === 'out' ? 'blur(4px)' : modePhase === 'in' ? 'blur(1px)' : 'none',
            }}>
            {overviewMode === 'tareas_notas' ? (
              <div key="tasks_notes" style={{ display: 'flex', gap: 24, maxWidth: 1440, margin: '0 auto', padding: '16px 24px 60px' }}>
                {/* ─── LEFT: Tasks — AETHER CLONE (3/5) ─── */}
                <div style={{ flex: 3, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 24 }}>
                  {/* Task Creator Card */}
                  <div className="bento-card" style={{ borderRadius: 10, border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', overflow: 'hidden', padding: 0, boxShadow: '0 1px 8px rgba(0,0,0,0.04)' }}>
                    <div style={{ padding: '14px 16px' }}>
                      <input value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)} placeholder="Nombre de la tarea"
                        style={{ width: '100%', border: 'none', borderBottom: 'none', height: 'auto', padding: '2px 0', fontSize: 16, fontWeight: 600, background: 'transparent', color: 'var(--text-primary)', outline: 'none', fontFamily: "'Inter Tight', sans-serif", borderRadius: 0, letterSpacing: '-0.02em' }}
                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) handleAddTask(); }} />
                      <div style={{ padding: '0 0', margin: '6px 0' }}>
                        <div style={{ height: 1, background: `linear-gradient(to right, transparent, ${course.color}30, transparent)` }} />
                      </div>
                      <textarea value={newTaskDescription} onChange={e => setNewTaskDescription(e.target.value)} placeholder="Descripción (opcional)"
                        rows={1} style={{ width: '100%', border: 'none', padding: 0, fontSize: 12, color: 'var(--text-tertiary)', background: 'transparent', outline: 'none', resize: 'none', fontFamily: "'Inter', sans-serif", overflow: 'hidden', lineHeight: 1.6 }}
                        onInput={e => { const t = e.currentTarget; t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px'; }} />

                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 12 }}>
                        <input type="date" value={newTaskDueDate} onChange={e => setNewTaskDueDate(e.target.value)}
                          style={{ height: 42, borderRadius: 8, border: selectBorder, background: newTaskDueDate ? `${course.color}08` : 'var(--bg-surface)', color: newTaskDueDate ? course.color : 'var(--text-tertiary)', padding: '0 14px', cursor: 'pointer', fontSize: 13, fontWeight: 500, fontFamily: "'Inter Tight', sans-serif", outline: 'none', width: 170, minWidth: 170, boxSizing: 'border-box' }} />
                        <select value={newTaskPriority} onChange={e => setNewTaskPriority(e.target.value as any)}
                          style={{ height: 40, borderRadius: 8, border: selectBorder, background: newTaskPriority !== 'none' ? `${({ high: '#EF4444', medium: '#F59E0B', low: '#10B981' })[newTaskPriority]}18` : 'var(--bg-surface)', color: newTaskPriority !== 'none' ? ({ high: '#EF4444', medium: '#F59E0B', low: '#10B981' })[newTaskPriority] : 'var(--text-tertiary)', padding: '0 28px 0 12px', cursor: 'pointer', fontSize: 12, fontWeight: 500, fontFamily: "'Inter Tight', sans-serif", outline: 'none', width: 120, minWidth: 120, boxSizing: 'border-box' }}>
                          <option value="none">Sin prioridad</option>
                          <option value="high">Alta</option>
                          <option value="medium">Media</option>
                          <option value="low">Baja</option>
                        </select>
                        <div style={{ flex: 1 }} />
                        <button onClick={handleAddTask} disabled={!newTaskTitle.trim()}
                          style={{ width: 40, height: 40, borderRadius: 10, border: `1.5px solid ${newTaskTitle.trim() ? course.color : 'var(--border-subtle)'}`, background: 'transparent', color: newTaskTitle.trim() ? course.color : 'var(--text-muted)', cursor: newTaskTitle.trim() ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 200ms ' + EASE }}
                          title="Añadir tarea">
                          <PlusCircle size={20} />
                        </button>
                      </div>
                    </div>
                  </div>
                  {/* Task list header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, marginBottom: 8 }}>
                    <div style={{ height: 1, flex: 1, background: `linear-gradient(to right, transparent, ${course.color}25)` }} />
                    <h3 style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: "'Inter Tight', sans-serif" }}>Tareas académicas</h3>
                    <button onClick={() => setShowCompletedTasks(prev => !prev)}
                      style={{ width: 22, height: 22, borderRadius: 4, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.5, transition: 'opacity 200ms' }}
                      onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                      onMouseLeave={e => e.currentTarget.style.opacity = '0.5'}
                      title={showCompletedTasks ? 'Ocultar completadas' : 'Mostrar completadas'}>
                      {showCompletedTasks ? <EyeOff size={11} /> : <Eye size={11} />}
                    </button>
                    <div style={{ height: 1, flex: 1, background: `linear-gradient(to left, transparent, ${course.color}25)` }} />
                  </div>
                  {/* Task list */}
                  {(() => {
                    const tasksToShow = showCompletedTasks
                      ? [...courseTasks].sort((a, b) => {
                          if (a.status === 'completado' && b.status !== 'completado') return 1;
                          if (a.status !== 'completado' && b.status === 'completado') return -1;
                          return 0;
                        })
                      : pendingTasks;
                    return tasksToShow.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {tasksToShow.map(task => {
                          const descPreview = (task.notes || '').replace(/<[^>]+>/g, '').trim().slice(0, 45);
                          let dueDisplay = '';
                          let isOverdue = false;
                          if (task.dueDate) {
                            const dueStr = task.dueDate.split('T')[0];
                            const today = new Date(); today.setHours(0,0,0,0);
                            const due = new Date(dueStr + 'T12:00:00');
                            const day = due.getDate().toString().padStart(2, '0');
                            const month = (due.getMonth() + 1).toString().padStart(2, '0');
                            const year = due.getFullYear();
                            dueDisplay = `${day}/${month}/${year}`;
                            isOverdue = Math.ceil((due.getTime() - today.getTime()) / (1000*60*60*24)) < 0;
                          }
                          const isDone = task.status === 'completado';
                          return (
                            <div key={task.id} className={isDone ? '' : 'item-card'} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10, border: '1px solid var(--border-subtle)', background: isDone ? 'var(--bg-surface-alpha, var(--bg-surface))' : 'var(--bg-elevated-alpha, var(--bg-elevated))', transition: 'all 200ms ' + EASE, opacity: isDone ? 0.7 : 1 }}
                              onMouseEnter={e => { e.currentTarget.style.borderColor = `${course.color}30`; }}
                              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; }}>
                              <div onClick={() => handleToggleTask(task.id)}
                                style={{ width: 26, height: 26, borderRadius: 7, flexShrink: 0, cursor: 'pointer',
                                  border: `1.5px solid ${isDone ? '#10B981' : task.status === 'progreso' ? '#3B82F6' : `${course.color}40`}`,
                                  background: isDone ? '#10B981' : task.status === 'progreso' ? '#3B82F6' : `${course.color}08`,
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  transition: 'all 200ms ' + EASE,
                                  boxShadow: isDone ? '0 0 0 3px #10B98118' : task.status === 'progreso' ? '0 0 0 3px #3B82F618' : 'none' }}
                                onMouseEnter={e => { if (!isDone && task.status === 'inicio') { e.currentTarget.style.background = `${course.color}15`; e.currentTarget.style.borderColor = `${course.color}60`; e.currentTarget.style.transform = 'scale(1.08)'; } }}
                                onMouseLeave={e => { if (!isDone && task.status === 'inicio') { e.currentTarget.style.background = `${course.color}08`; e.currentTarget.style.borderColor = `${course.color}40`; e.currentTarget.style.transform = 'scale(1)'; } }}>
                                {isDone ? <Check size={14} strokeWidth={2.5} color="#fff" /> : task.status === 'progreso' && <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#fff' }} />}
                                {!isDone && task.status === 'inicio' && <div style={{ width: 7, height: 7, borderRadius: '50%', background: course.color, opacity: 0.4 }} />}
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 14, fontWeight: 500, color: isDone ? 'var(--text-tertiary)' : 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: "'Inter', sans-serif", textDecoration: isDone ? 'line-through' : 'none' }}>{task.title}</div>
                                {descPreview && <div style={{ fontSize: 10, color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 1 }}>{descPreview}</div>}
                              </div>
                              {task.priority !== 'none' && task.priority && (
                                <span style={{ fontSize: 8, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: task.priority === 'high' ? '#EF444420' : task.priority === 'medium' ? '#F59E0B20' : '#10B98120', color: task.priority === 'high' ? '#EF4444' : task.priority === 'medium' ? '#F59E0B' : '#10B981', textTransform: 'uppercase', letterSpacing: '0.03em', fontFamily: "'Inter Tight', sans-serif", whiteSpace: 'nowrap', flexShrink: 0 }}>
                                  {task.priority === 'high' ? 'Alta' : task.priority === 'medium' ? 'Media' : 'Baja'}
                                </span>
                              )}
                              {dueDisplay && (
                                <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 500, color: isDone ? 'var(--text-tertiary)' : isOverdue ? '#EF4444' : 'var(--text-secondary)', fontFamily: "'Inter Tight', sans-serif", whiteSpace: 'nowrap', flexShrink: 0 }}>
                                  <LI.Calendar size={12} style={{ opacity: 0.5, flexShrink: 0 }} />
                                  {dueDisplay}
                                </span>
                              )}
                              <button onClick={(e) => { e.stopPropagation(); setFocusedTaskId(task.id); setNavigateTo('tareas'); }} title="Ir a Tareas"
                                style={{ width: 26, height: 26, borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, opacity: 0, transition: 'all 150ms ' + EASE }}
                                onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.background = `${course.color}10`; e.currentTarget.style.color = course.color; }}
                                onMouseLeave={e => { e.currentTarget.style.opacity = '0'; e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}>
                                <ArrowUpRight size={13} />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 96, borderRadius: 10, border: '1px dashed var(--border-subtle)', background: 'var(--bg-surface)' }}>
                        <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>No hay tareas para este curso.</p>
                      </div>
                    );
                  })()}
                </div>
                {/* ─── RIGHT: Mis Apuntes — Vertical Expandable Blocks ─── */}
                <div style={{ flex: 2, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 0 }}>
                  {/* Header */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 2px', marginBottom: 12 }}>
                    <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: "'Inter Tight', sans-serif" }}>{showCourseNotesInOverview ? 'Mi conocimiento' : 'Mis apuntes'}</h3>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        onMouseDown={() => { eyePressTimerRef.current = setTimeout(() => { setShowCourseNotesInOverview((prev: boolean) => !prev); eyePressTimerRef.current = null; }, 500); }}
                        onMouseUp={() => { if (eyePressTimerRef.current) { clearTimeout(eyePressTimerRef.current); eyePressTimerRef.current = null; setShowOverviewNoteDates((prev: boolean) => !prev); } }}
                        onMouseLeave={(e) => { if (eyePressTimerRef.current) { clearTimeout(eyePressTimerRef.current); eyePressTimerRef.current = null; } e.currentTarget.style.background = `${course.color}10`; e.currentTarget.style.borderColor = `${course.color}30`; }}
                        title={showOverviewNoteDates ? 'Ocultar fechas' : 'Mostrar fechas'}
                        style={{ width: 28, height: 28, borderRadius: 6, border: `1px solid ${course.color}30`, background: `${course.color}10`, cursor: 'pointer', color: showOverviewNoteDates ? course.color : `${course.color}60`, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 200ms ' + EASE }}
                        onMouseEnter={e => { e.currentTarget.style.background = `${course.color}22`; e.currentTarget.style.borderColor = `${course.color}50`; }}>
                        {showOverviewNoteDates ? <LI.CalendarDays size={13} /> : <LI.CalendarX size={13} />}
                      </button>
                      <button onClick={() => {
                        const newId = addNote({ title: '', content: '', course: course.name, courseColor: course.color, isCoursePrivate: true, isPinned: false });
                        setSelectedOverviewNoteId(newId);
                        setOverviewNoteEditMode(true);
                      }}
                        title="Nuevo apunte"
                        style={{ width: 28, height: 28, borderRadius: 6, border: `1px solid ${course.color}30`, background: `${course.color}10`, cursor: 'pointer', color: course.color, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 200ms ' + EASE }}
                        onMouseEnter={e => { e.currentTarget.style.background = `${course.color}22`; e.currentTarget.style.borderColor = `${course.color}50`; }}
                        onMouseLeave={e => { e.currentTarget.style.background = `${course.color}10`; e.currentTarget.style.borderColor = `${course.color}30`; }}>
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Note Blocks — always collapsed */}
                  {filteredCourseNotes.length > 0 ? (
                    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleOverviewNoteDragEnd}>
                      <SortableContext items={sortedIds} strategy={rectSortingStrategy}>
                        <div ref={overviewNoteContainerRef} style={{ display: 'flex', flexDirection: 'column', gap: 8, position: 'relative', zIndex: 2 }}>
                          {expandedFirst.map(n => {
                            const isHighlighted = overviewNoteHighlights.includes(n.id);
                            const isCourseNote = !n.isCoursePrivate;
                            const isExpanded = selectedOverviewNoteId === n.id;
                            return (
                              <SortableWrapper key={n.id} id={n.id}>
                                {({ attributes, listeners, isDragging }) => (
                                  <div style={{
                                    borderRadius: 12, position: 'relative',
                                    border: isHighlighted ? `1.5px solid #D4A017` : isCourseNote ? `1px solid ${course.color}25` : `1px solid var(--border-subtle)`,
                                    borderLeft: isHighlighted ? `3px solid #D4A017` : isCourseNote ? `3px solid ${course.color}50` : `1px solid var(--border-subtle)`,
                                    background: isHighlighted ? `linear-gradient(135deg, rgba(212,160,23,0.06), rgba(212,160,23,0.015))` : isCourseNote ? `linear-gradient(135deg, var(--bg-elevated), ${course.color}03)` : 'var(--bg-elevated)',
                                    overflow: 'hidden', transition: 'all 200ms ' + EASE,
                                    boxShadow: isHighlighted ? `0 0 0 2px #D4A01720, 0 2px 16px #D4A01710` : 'none',
                                    cursor: isExpanded ? 'default' : 'grab',
                                    opacity: isDragging ? 0.4 : 1,
                                  }}
                                    {...(!isExpanded ? { ...attributes, ...listeners } : {})}
                                    onClick={() => { if (!isExpanded) { setSelectedOverviewNoteId(n.id); setOverviewNoteEditMode(false); } }}
                                    onMouseEnter={e => { if (!isExpanded) { e.currentTarget.style.background = isHighlighted ? 'rgba(212,160,23,0.09)' : isCourseNote ? `linear-gradient(135deg, var(--bg-surface), ${course.color}06)` : 'var(--bg-surface)'; } }}
                                    onMouseLeave={e => { if (!isExpanded) { e.currentTarget.style.background = isHighlighted ? `linear-gradient(135deg, rgba(212,160,23,0.06), rgba(212,160,23,0.015))` : isCourseNote ? `linear-gradient(135deg, var(--bg-elevated), ${course.color}03)` : 'var(--bg-elevated)'; } }}
                                  >
                                    {isExpanded ? (
                                      <>
                                        {/* ── EXPANDED ── */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0, padding: '4px 10px', borderBottom: '1px solid var(--border-subtle)', background: `${course.color}05`, flexWrap: 'wrap', minHeight: 32 }}>
                                          {overviewNoteEditMode && (
                                            <>
                                              <FormatToolbar onFormat={(cmd, val) => document.execCommand(cmd, false, val)} color={course.color}
                                                toolbarItems={['bold','italic','underline','strikethrough','list','orderedList']} />
                                              <div style={{ width: 1, height: 18, background: 'var(--border-subtle)', margin: '0 4px' }} />
                                            </>
                                          )}
                                          {showOverviewNoteDates && !overviewNoteEditMode && (
                                            <span style={{ fontSize: 8.5, fontWeight: 600, color: 'rgba(255,255,255,0.25)', marginRight: 6, letterSpacing: '0.03em', fontFamily: "'JetBrains Mono', monospace", opacity: 0.85 }}>
                                              {format(new Date(n.createdAt), "dd/MM/yy · HH:mm", { locale: es })}
                                            </span>
                                          )}
                                          <div style={{ flex: 1 }} />
                                          <button onClick={() => { toggleHighlight(n.id); }}
                                            title="Destacar"
                                            style={{ width: 24, height: 24, borderRadius: 5, border: 'none', background: 'transparent', cursor: 'pointer', color: isHighlighted ? '#D4A017' : 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 150ms' }}
                                            onMouseEnter={e => e.currentTarget.style.background = `${course.color}10`}
                                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                            <Star size={11} fill={isHighlighted ? '#D4A017' : 'none'} />
                                          </button>
                                          {!overviewNoteEditMode && (
                                            <button onClick={() => { setOverviewNoteEditMode(true); }}
                                              title="Editar"
                                              style={{ width: 24, height: 24, borderRadius: 5, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 150ms' }}
                                              onMouseEnter={e => e.currentTarget.style.background = `${course.color}10`}
                                              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                              <Pencil size={11} />
                                            </button>
                                          )}
                                          <button onClick={() => setConfirmDeleteNoteId(n.id)}
                                            title="Eliminar"
                                            style={{ width: 24, height: 24, borderRadius: 5, border: 'none', background: 'transparent', cursor: 'pointer', color: 'rgba(239,68,68,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 150ms' }}
                                            onMouseEnter={e => e.currentTarget.style.background = `${course.color}10`}
                                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                            <Trash2 size={11} />
                                          </button>
                                          <div style={{ width: 1, height: 18, background: 'var(--border-subtle)', margin: '0 4px' }} />
                                          <button onClick={() => { setSelectedOverviewNoteId(null); setOverviewNoteEditMode(false); setConfirmDeleteNoteId(null); }}
                                            style={{ width: 24, height: 24, borderRadius: 5, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                            onMouseEnter={e => e.currentTarget.style.background = `${course.color}10`}
                                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                            <X size={12} />
                                          </button>
                                        </div>
                                        <div style={{ maxHeight: 340, overflowY: 'auto', minHeight: 0 }}>
                                          <NoteEditor
                                            note={n}
                                            courseColor={course.color}
                                            onSave={updateNote}
                                            editable={overviewNoteEditMode}
                                            hideToolbar
                                            onImageClick={(src) => { setPreviewImageSrc(src); setShowImagePreview(true); }}
                                          />
                                        </div>
                                      </>
                                    ) : (
                                      <>
                                        {/* Date display */}
                                        {showOverviewNoteDates && (
                                          <div style={{ padding: '8px 16px 0', fontSize: 9, fontWeight: 600, color: 'rgba(255,255,255,0.2)', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.03em', opacity: 0.8 }}>
                                            {format(new Date(n.createdAt), "dd/MM/yy", { locale: es })}
                           </div>
                                         )}
                                         {/* ── COLLAPSED (preview) ── */}
                                        <div style={{ padding: showOverviewNoteDates ? '6px 16px 12px' : '12px 16px' }}>
                                          <div style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--text-primary)', fontFamily: "'Atkinson Hyperlegible', system-ui, serif", wordBreak: 'break-word', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical' }}
                                            dangerouslySetInnerHTML={{ __html: n.content?.replace(/<img[^>]+style="([^"]*)"/g, (m: string, s: string) => m.replace(s, s + ';max-height:100px;width:auto') ) || '<span style="color:var(--text-muted);font-style:italic;font-size:12px">Vacío</span>' }} />
                                        </div>
                                      </>
                                    )}
                                  </div>
                                )}
                              </SortableWrapper>
                            );
                          })}
                        </div>
                      </SortableContext>
                    </DndContext>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 96, borderRadius: 10, border: '1px dashed var(--border-subtle)', background: 'var(--bg-surface)' }}>
                      <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{showCourseNotesInOverview ? 'Vacío' : 'No hay apuntes. Crea el primero.'}</p>
                    </div>
                  )}
                </div>
              </div>
              ) : (
                /* ═══ MODO ESTUDIO — New Study Mode Layout ═══ */
                currentView === 'topic' && activeTopic ? (
                  /* ─── TOPIC DETAIL VIEW (inside estudio mode) ─── */
                <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
                  {/* Left: back to study overview */}
                  <div style={{ width: 44, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 16, borderRight: '1px solid var(--border-subtle)', background: 'var(--bg-surface)' }}>
                    <button onClick={() => { setCurrentView('overview'); setStudyToolMode('none'); }} style={{ width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', cursor: 'pointer', color: 'var(--text-secondary)', transition: 'all 150ms' }} title="Volver">
                      <ChevronLeft size={14} />
                    </button>
                  </div>
                  {/* Center: topic content */}
                  <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px 60px' }}>
                    {/* Breadcrumb */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16 }}>
                      <span style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{course.name}</span>
                      {activeTopic.groupId && (() => { const grp = groups.find(g => g.id === activeTopic.groupId); return grp ? <><span style={{ color: 'var(--text-muted)', fontSize: 8 }}>/</span><span style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>{grp.name}</span></> : null; })()}
                      <span style={{ color: 'var(--text-muted)', fontSize: 8 }}>/</span>
                      <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-primary)' }}>{activeTopic.title}</span>
                    </div>
                    {/* Topic header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                      <div>
                        <h2 style={{ fontSize: 22, fontWeight: 600, color: 'var(--text-primary)', margin: 0, fontFamily: "'Inter Tight', sans-serif", letterSpacing: '-0.02em' }}>{activeTopic.title}</h2>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                          <span style={{ fontSize: 8, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Comprension:</span>
                          <div style={{ display: 'flex', gap: 3 }}>{[...Array(5)].map((_, i) => (
                            <button key={i} onClick={() => setTopicReviewLevel(activeTopic.id, i + 1)} style={{ width: 28, height: 6, borderRadius: 3, border: 'none', cursor: 'pointer', background: i < activeTopic.reviewLevel ? course.color : 'var(--bg-hover)', transition: 'all 200ms' }} />
                          ))}</div>
                          <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>{activeTopic.reviewLevel}/5</span>
                        </div>
                      </div>
                      <button onClick={() => { setEditingTopicId(activeTopic.id); setTopicName(activeTopic.title); setShowTopicModal(true); }} style={{ width: 30, height: 30, borderRadius: 6, border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Edit3 size={12} /></button>
                    </div>
                    {/* Material filter */}
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 14, paddingBottom: 10, borderBottom: '1px solid var(--border-subtle)' }}>
                      <button onClick={() => setFilterMaterialType('all')} style={{ height: 26, padding: '0 8px', borderRadius: 5, fontSize: 9, fontWeight: 600, border: filterMaterialType === 'all' ? 'none' : '1px solid var(--border-subtle)', background: filterMaterialType === 'all' ? course.color : 'transparent', color: filterMaterialType === 'all' ? '#fff' : 'var(--text-secondary)', cursor: 'pointer', transition: 'all 150ms' }}>Todos ({activeTopic.materials?.length || 0})</button>
                      {(Object.keys(MATERIAL_META) as MaterialType[]).map(type => {
                        const count = (activeTopic.materials || []).filter(m => m.type === type).length;
                        if (count === 0) return null;
                        const Icon = MATERIAL_META[type].icon;
                        return <button key={type} onClick={() => setFilterMaterialType(type)} style={{ height: 26, padding: '0 8px', borderRadius: 5, fontSize: 9, fontWeight: 600, border: filterMaterialType === type ? 'none' : '1px solid var(--border-subtle)', background: filterMaterialType === type ? course.color : 'transparent', color: filterMaterialType === type ? '#fff' : 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3, transition: 'all 150ms' }}><Icon size={9} /> {MATERIAL_META[type].label} ({count})</button>;
                      })}
                    </div>
                    {/* Quick add */}
                    <div style={{ display: 'flex', gap: 4, marginBottom: 16, flexWrap: 'wrap' }}>
                      {(Object.keys(MATERIAL_META) as MaterialType[]).filter(t => t !== 'resource').map(type => {
                        const Icon = MATERIAL_META[type].icon;
                        const accentColors: Record<string, string> = { formula: '#8B5CF6', concept: '#3B82F6', 'key-data': '#F59E0B', meaning: '#10B981', quiz: '#EF4444', procedure: '#EC4899' };
                        const c = accentColors[type] || course.color;
                        return <button key={type} onClick={() => handleAddMaterialClick(type, 0)} style={{ display: 'flex', alignItems: 'center', gap: 3, height: 24, padding: '0 8px', borderRadius: 5, fontSize: 9, fontWeight: 600, border: 'none', background: `${c}12`, color: c, cursor: 'pointer', transition: 'all 150ms' }}
                          onMouseEnter={e => e.currentTarget.style.background = `${c}25`} onMouseLeave={e => e.currentTarget.style.background = `${c}12`}><Icon size={9} /> {MATERIAL_META[type].label}</button>;
                      })}
                      <button onClick={() => handleAddMaterialClick('resource', 0)} style={{ display: 'flex', alignItems: 'center', gap: 3, height: 24, padding: '0 8px', borderRadius: 5, fontSize: 9, fontWeight: 600, border: '1px dashed var(--border-subtle)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', transition: 'all 150ms' }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = course.color; e.currentTarget.style.color = course.color; }} onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.color = 'var(--text-muted)'; }}><Upload size={9} /> Archivo</button>
                    </div>
                    {/* 3-col kanban */}
                    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, alignItems: 'start' }}>
                        {[{ idx: 0, label: 'Teoria', desc: 'Conceptos, formulas' }, { idx: 1, label: 'Practica', desc: 'Cuestionarios, procedimientos' }, { idx: 2, label: 'Anexos', desc: 'Recursos, archivos' }].map(({ idx, label, desc }) => {
                          const colItems = columns[idx] || [];
                          return (
                            <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                              <div style={{ padding: '8px 10px', borderRadius: 8, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
                                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-primary)' }}>{label}</div>
                                <div style={{ fontSize: 8, color: 'var(--text-muted)', marginTop: 2 }}>{desc} · {colItems.length}</div>
                              </div>
                              <DroppableColumn id={`col-${idx}`} items={colItems}>
                                {colItems.map(mat => (
                                  <SortableWrapper key={mat.id} id={mat.id}>
                                    {({ attributes, listeners }) => <MaterialCard mat={mat} dragAttributes={attributes} dragListeners={listeners} onEdit={startEditMaterial} onDelete={handleDeleteMaterial} onOpenResource={handleOpenResource} />}
                                  </SortableWrapper>
                                ))}
                                {colItems.length === 0 && <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 80, borderRadius: 6, border: '1px dashed var(--border-subtle)', opacity: 0.2, fontSize: 9, color: 'var(--text-muted)' }}>Arrastra aqui</div>}
                              </DroppableColumn>
                            </div>
                          );
                        })}
                      </div>
                    </DndContext>
                    <input type="file" ref={resourceInputRef} style={{ display: 'none' }} onChange={handleFileUpload} />
                  </div>
                  {/* Right: Study Tools Sidebar */}
                  <div style={{ width: 220, flexShrink: 0, borderLeft: '1px solid var(--border-subtle)', background: 'var(--bg-surface)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border-subtle)' }}>
                      <span style={{ fontSize: 8, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Herramientas</span>
                    </div>
                    <div style={{ flex: 1, overflowY: 'auto', padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {[
                        { mode: 'flashcards' as const, icon: BookOpen, label: 'Flashcards', desc: 'Repaso activo', color: '#8B5CF6' },
                        { mode: 'quizzes' as const, icon: HelpCircle, label: 'Cuestionarios', desc: 'Autoevaluacion', color: '#EF4444' },
                        { mode: 'blurting' as const, icon: NotebookPen, label: 'Blurting', desc: 'Escribir de memoria', color: '#3B82F6' },
                        { mode: 'feynman' as const, icon: Lightbulb, label: 'Feynman', desc: 'Explicar simplemente', color: '#F59E0B' },
                        { mode: 'notes' as const, icon: StickyNote, label: 'Notas del tema', desc: 'Apuntes rápidos', color: '#10B981' },
                        { mode: 'mindmap' as const, icon: Layers, label: 'Mapa Mental', desc: 'Organizar ideas', color: '#EC4899' },
                        { mode: 'review' as const, icon: Sigma, label: 'Repaso Espaciado', desc: 'SRS / FSRS', color: '#06B6D4' },
                      ].map(tool => {
                        const Icon = tool.icon;
                        const isActive = studyToolMode === tool.mode;
                        return (
                          <button key={tool.mode} onClick={() => setStudyToolMode(isActive ? 'none' : tool.mode)}
                            style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 10px', borderRadius: 6, border: `1px solid ${isActive ? `${tool.color}40` : 'transparent'}`, background: isActive ? `${tool.color}10` : 'transparent', cursor: 'pointer', textAlign: 'left', transition: 'all 150ms' }}
                            onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--bg-hover)'; }}
                            onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}>
                            <div style={{ width: 28, height: 28, borderRadius: 6, background: `${tool.color}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <Icon size={13} style={{ color: tool.color }} />
                            </div>
                            <div>
                              <div style={{ fontSize: 10, fontWeight: 600, color: isActive ? tool.color : 'var(--text-primary)' }}>{tool.label}</div>
                              <div style={{ fontSize: 8, color: 'var(--text-muted)', marginTop: 1 }}>{tool.desc}</div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                    {/* Active tool content area */}
                    {studyToolMode !== 'none' && (
                      <div style={{ borderTop: '1px solid var(--border-subtle)', padding: '10px 14px', maxHeight: 260, overflowY: 'auto' }}>
                        {studyToolMode === 'flashcards' && (
                          <div style={{ textAlign: 'center', padding: '12px 0' }}>
                            <div style={{ width: 44, height: 44, borderRadius: 10, background: '#8B5CF612', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px' }}><BookOpen size={18} style={{ color: '#8B5CF6' }} /></div>
                            <p style={{ fontSize: 10, color: 'var(--text-secondary)', marginBottom: 10 }}>Crea tarjetas de repaso con preguntas y respuestas.</p>
                            <button style={{ width: '100%', height: 30, borderRadius: 6, border: 'none', background: '#8B5CF6', color: '#fff', fontSize: 9, fontWeight: 600, cursor: 'pointer' }}>Nueva Flashcard</button>
                          </div>
                        )}
                        {studyToolMode === 'quizzes' && (
                          <div style={{ textAlign: 'center', padding: '12px 0' }}>
                            <div style={{ width: 44, height: 44, borderRadius: 10, background: '#EF444412', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px' }}><HelpCircle size={18} style={{ color: '#EF4444' }} /></div>
                            <p style={{ fontSize: 10, color: 'var(--text-secondary)', marginBottom: 10 }}>Pon a prueba tu conocimiento con quizzes.</p>
                            <button style={{ width: '100%', height: 30, borderRadius: 6, border: 'none', background: '#EF4444', color: '#fff', fontSize: 9, fontWeight: 600, cursor: 'pointer' }}>Crear Quiz</button>
                          </div>
                        )}
                        {studyToolMode === 'blurting' && (
                          <div style={{ textAlign: 'center', padding: '12px 0' }}>
                            <div style={{ width: 44, height: 44, borderRadius: 10, background: '#3B82F612', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px' }}><NotebookPen size={18} style={{ color: '#3B82F6' }} /></div>
                            <p style={{ fontSize: 10, color: 'var(--text-secondary)', marginBottom: 10 }}>Escribe todo lo que recuerdas sin mirar apuntes.</p>
                            <button style={{ width: '100%', height: 30, borderRadius: 6, border: 'none', background: '#3B82F6', color: '#fff', fontSize: 9, fontWeight: 600, cursor: 'pointer' }}>Iniciar Blurting</button>
                          </div>
                        )}
                        {studyToolMode === 'feynman' && (
                          <div style={{ textAlign: 'center', padding: '12px 0' }}>
                            <div style={{ width: 44, height: 44, borderRadius: 10, background: '#F59E0B12', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px' }}><Lightbulb size={18} style={{ color: '#F59E0B' }} /></div>
                            <p style={{ fontSize: 10, color: 'var(--text-secondary)', marginBottom: 10 }}>Explica el concepto como si fueras profesor.</p>
                            <button style={{ width: '100%', height: 30, borderRadius: 6, border: 'none', background: '#F59E0B', color: '#fff', fontSize: 9, fontWeight: 600, cursor: 'pointer' }}>Iniciar Feynman</button>
                          </div>
                        )}
                        {studyToolMode === 'notes' && (
                          <div style={{ textAlign: 'center', padding: '12px 0' }}>
                            <div style={{ width: 44, height: 44, borderRadius: 10, background: '#10B98112', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px' }}><StickyNote size={18} style={{ color: '#10B981' }} /></div>
                            <p style={{ fontSize: 10, color: 'var(--text-secondary)', marginBottom: 10 }}>Anota ideas clave durante el estudio.</p>
                            <button onClick={() => { const id = addNote({ title: '', content: '', course: course.name, courseColor: course.color, isCoursePrivate: true, isPinned: false }); setEditingNoteId(id); setNavigateTo('apuntes'); }} style={{ width: '100%', height: 30, borderRadius: 6, border: 'none', background: '#10B981', color: '#fff', fontSize: 9, fontWeight: 600, cursor: 'pointer' }}>Nuevo Apunte</button>
                          </div>
                        )}
                        {studyToolMode === 'mindmap' && (
                          <div style={{ textAlign: 'center', padding: '12px 0' }}>
                            <div style={{ width: 44, height: 44, borderRadius: 10, background: '#EC489912', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px' }}><Layers size={18} style={{ color: '#EC4899' }} /></div>
                            <p style={{ fontSize: 10, color: 'var(--text-secondary)', marginBottom: 10 }}>Organiza ideas visualmente en un mapa.</p>
                            <button style={{ width: '100%', height: 30, borderRadius: 6, border: 'none', background: '#EC4899', color: '#fff', fontSize: 9, fontWeight: 600, cursor: 'pointer' }}>Crear Mapa</button>
                          </div>
                        )}
                        {studyToolMode === 'review' && (
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                              <Sigma size={11} style={{ color: '#06B6D4' }} />
                              <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Cola de Repaso</span>
                            </div>
                            {(course.studyTopics || []).filter(t => t.nextReview <= Date.now() && t.reviewLevel > 0).length > 0 ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                {(course.studyTopics || []).filter(t => t.nextReview <= Date.now() && t.reviewLevel > 0).slice(0, 5).map(t => (
                                  <div key={t.id} onClick={() => { setActiveTopicId(t.id); setCurrentView('topic'); }} style={{ padding: '6px 8px', borderRadius: 5, background: 'var(--bg-hover)', cursor: 'pointer', fontSize: 10, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6, transition: 'all 120ms' }}
                                    onMouseEnter={e => e.currentTarget.style.background = `${course.color}15`} onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-hover)'}>
                                    <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#06B6D4', flexShrink: 0 }} />
                                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</span>
                                    <span style={{ fontSize: 8, color: 'var(--text-muted)' }}>{t.reviewLevel}/5</span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p style={{ fontSize: 9, color: 'var(--text-muted)', textAlign: 'center', padding: '10px 0' }}>Sin temas para repasar</p>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ) : currentView === 'group' && selectedGroupId ? (
                /* ═══ GROUP DETAIL VIEW ═══ */
                (() => {
                  const grp = groups.find(g => g.id === selectedGroupId);
                  const grpTopics = parsedTopics.filter(t => t.groupId === selectedGroupId);
                  if (!grp) return null;
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

              <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px 40px' }} className="no-scrollbar">
                        {grpTopics.length === 0 ? (
                          <div onClick={() => { setEditingTopicId(null); setTopicName(''); setShowTopicModal(true); }}
                            style={{ padding: '64px 24px', textAlign: 'center', borderRadius: 16, border: `2px dashed ${course.color}30`, background: `linear-gradient(145deg, ${course.color}06, transparent 70%)`, cursor: 'pointer', transition: 'all 300ms cubic-bezier(0.16,1,0.3,1)', minHeight: 200, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14 }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = `${course.color}55`; e.currentTarget.style.background = `linear-gradient(145deg, ${course.color}0c, ${course.color}04)`; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 8px 32px ${course.color}10`; }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = `${course.color}30`; e.currentTarget.style.background = `linear-gradient(145deg, ${course.color}06, transparent 70%)`; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}>
                            <div style={{ width: 56, height: 56, borderRadius: 16, background: `${course.color}12`, border: `1.5px solid ${course.color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 4px 16px ${course.color}10` }}>
                              <Plus size={24} style={{ color: course.color, opacity: 0.7 }} />
                            </div>
                            <div>
                              <span style={{ display: 'block', fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', fontFamily: "'Inter Tight', sans-serif", marginBottom: 4 }}>Agregar tema</span>
                              <span style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>Organiza tu contenido en temas dentro de esta agrupacion</span>
                            </div>
                          </div>
                        ) : (
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
                            {grpTopics.map(topic => {
                                const mats = topic.materials || [];
                                const matCount = mats.length;
                                const isConfirmingDelete = confirmDeleteGroupId === `topic_${topic.id}`;
                                const typeCounts: Record<string, number> = {};
                                mats.forEach(m => { typeCounts[m.type] = (typeCounts[m.type] || 0) + 1; });
                                const typeColors: Record<string, string> = { resource: '#3B82F6', flashcard: '#8B5CF6', qa: '#10B981', definition: '#F59E0B', note: '#6B7280' };
                                const typeLabels: Record<string, string> = { resource: 'Recursos', flashcard: 'Flashcards', qa: 'Preguntas', definition: 'Definiciones', note: 'Notas' };
                                return (
                                   <div key={topic.id} onClick={() => { setActiveTopicId(topic.id); setCurrentView('topic'); }}
                                     style={{ borderRadius: 14, border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', overflow: 'hidden', cursor: 'pointer', transition: 'all 250ms cubic-bezier(0.16,1,0.3,1)', display: 'flex', flexDirection: 'column', position: 'relative' }}
                                     className="topic-card"
                                     onMouseEnter={e => { e.currentTarget.style.borderColor = `${course.color}40`; e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = `0 12px 36px ${course.color}14`; const icons = e.currentTarget.querySelector('.topic-hover-icons'); if (icons) (icons as HTMLElement).style.opacity = '1'; }}
                                     onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; const icons = e.currentTarget.querySelector('.topic-hover-icons'); if (icons) (icons as HTMLElement).style.opacity = '0'; }}>
                                     {/* Hover material icons overlay */}
                                     <div className="topic-hover-icons" style={{ position: 'absolute', top: 14, right: 14, display: 'flex', gap: 4, opacity: 0, transition: 'opacity 200ms', zIndex: 3 }}>
                                       {Object.entries(typeCounts).map(([type, count]) => (
                                         <div key={type} style={{ width: 24, height: 24, borderRadius: 6, background: `${typeColors[type] || '#6B7280'}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${typeColors[type] || '#6B7280'}25` }} title={`${count} ${typeLabels[type] || type}`}>
                                           <div style={{ width: 8, height: 8, borderRadius: '50%', background: typeColors[type] || '#6B7280' }} />
                                         </div>
                                       ))}
                                     </div>
                                      <div style={{ padding: '20px 18px 16px', flex: 1 }}>
                                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                                          <h4 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0, fontFamily: "'Inter Tight', sans-serif", letterSpacing: '-0.03em', lineHeight: 1.2, flex: 1, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', transition: 'all 200ms' }}>{topic.title}</h4>
                                        <div style={{ display: 'flex', gap: 2, flexShrink: 0, opacity: 0, transition: 'opacity 150ms' }}
                                          className="topic-actions">
                                          <button onClick={(e) => { e.stopPropagation(); setEditingTopicId(topic.id); setTopicName(topic.title); setShowTopicModal(true); }}
                                            style={{ width: 26, height: 26, borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 150ms' }}
                                            onMouseEnter={ev => { ev.currentTarget.style.background = 'var(--bg-hover)'; ev.currentTarget.style.color = 'var(--text-secondary)'; }}
                                            onMouseLeave={ev => { ev.currentTarget.style.background = 'transparent'; ev.currentTarget.style.color = 'var(--text-muted)'; }}>
                                            <Edit3 size={12} />
                                          </button>
                                          {!isConfirmingDelete ? (
                                            <button onClick={(e) => { e.stopPropagation(); setConfirmDeleteGroupId(`topic_${topic.id}`); }}
                                              style={{ width: 26, height: 26, borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 150ms' }}
                                              onMouseEnter={ev => { ev.currentTarget.style.background = 'rgba(239,68,68,0.08)'; ev.currentTarget.style.color = '#EF4444'; }}
                                              onMouseLeave={ev => { ev.currentTarget.style.background = 'transparent'; ev.currentTarget.style.color = 'var(--text-muted)'; }}>
                                              <Trash2 size={12} />
                                            </button>
                                          ) : (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                                              <button onClick={(e) => { e.stopPropagation(); handleDeleteTopic(topic.id); setConfirmDeleteGroupId(null); }}
                                                style={{ height: 24, padding: '0 10px', borderRadius: 6, border: 'none', background: '#EF4444', color: '#fff', fontSize: 10, fontWeight: 600, cursor: 'pointer', fontFamily: "'Inter', sans-serif" }}>Eliminar</button>
                                              <button onClick={(e) => { e.stopPropagation(); setConfirmDeleteGroupId(null); }}
                                                style={{ width: 24, height: 24, borderRadius: 6, border: 'none', background: 'var(--bg-hover)', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <X size={10} />
                                              </button>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                      {topic.reviewLevel > 0 && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginTop: 8 }}>
                                          <div style={{ display: 'flex', gap: 2 }}>{[...Array(5)].map((_, i) => <div key={i} style={{ width: 10, height: 4, borderRadius: 2, background: i < topic.reviewLevel ? course.color : 'var(--bg-hover)', transition: 'background 200ms' }} />)}</div>
                                        </div>
                                      )}
                                    </div>
                                    <div style={{ borderTop: '1px solid var(--border-subtle)', padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                      {matCount > 0 ? (
                                        Object.entries(typeCounts).map(([type, count]) => (
                                          <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 500, color: 'var(--text-muted)' }}>
                                            <div style={{ width: 7, height: 7, borderRadius: '50%', background: typeColors[type] || '#6B7280', flexShrink: 0 }} />
                                            <span>{count} {typeLabels[type] || type}</span>
                                          </div>
                                        ))
                                      ) : (
                                        <span style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>Sin materiales</span>
                                      )}
                                    </div>
                                  </div>
                                );
                            })}
                            <div onClick={() => { setEditingTopicId(null); setTopicName(''); setShowTopicModal(true); }}
                              style={{ borderRadius: 14, border: `2px dashed ${course.color}30`, background: `${course.color}05`, cursor: 'pointer', transition: 'all 300ms cubic-bezier(0.16,1,0.3,1)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, minHeight: 140 }}
                              onMouseEnter={e => { e.currentTarget.style.borderColor = `${course.color}60`; e.currentTarget.style.background = `${course.color}10`; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 8px 28px ${course.color}12`; }}
                              onMouseLeave={e => { e.currentTarget.style.borderColor = `${course.color}30`; e.currentTarget.style.background = `${course.color}05`; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}>
                              <div style={{ width: 48, height: 48, borderRadius: 14, background: `${course.color}14`, border: `1.5px dashed ${course.color}25`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Plus size={22} style={{ color: course.color, opacity: 0.7 }} />
                              </div>
                              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', fontFamily: "'Inter Tight', sans-serif" }}>Agregar tema</span>
                              <span style={{ fontSize: 10, color: 'var(--text-muted)', opacity: 0.6 }}>Haz clic para crear</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()
              ) : (
/* ═══ ESTUDIO MODE ═══ */
                <>
                <div style={{ display: 'flex', flexDirection: 'row', flex: 1, minHeight: 0, overflow: 'hidden' }}>

                  {/* ══ LEFT: MATERIALS + CENTER ══ */}
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

                    {/* ══ WEEKLY PLANNER ══ */}
                    <div style={{ padding: '16px 18px 14px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0, maxHeight: '38vh', overflowY: 'auto' }} className="no-scrollbar">
                      {/* ── WEEKLY PLANNER ── */}
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <button onClick={() => setWeekOffset(o => o - 1)}
                                  style={{ width: 26, height: 26, borderRadius: 7, border: '1px solid var(--border-subtle)', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 150ms' }}
                                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.borderColor = `${course.color}40`; e.currentTarget.style.color = course.color; }}
                                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.color = 'var(--text-muted)'; }}>
                                  <ChevronLeft size={12} />
                                </button>
                                <span style={{ fontSize: 11, fontWeight: 600, color: weekOffset === 0 ? course.color : 'var(--text-secondary)', fontFamily: "'Inter', sans-serif", minWidth: 100, textAlign: 'center' }}>
                                  {(() => {
                                    const ws = startOfWeek(addDays(new Date(), weekOffset * 7), { weekStartsOn: 1 });
                                    const we = endOfWeek(addDays(new Date(), weekOffset * 7), { weekStartsOn: 1 });
                                    return `${format(ws, 'd MMM', { locale: es })} — ${format(we, 'd MMM', { locale: es })}`;
                                  })()}
                                </span>
                                <button onClick={() => setWeekOffset(o => o + 1)}
                                  style={{ width: 26, height: 26, borderRadius: 7, border: '1px solid var(--border-subtle)', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 150ms' }}
                                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.borderColor = `${course.color}40`; e.currentTarget.style.color = course.color; }}
                                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.color = 'var(--text-muted)'; }}>
                                  <ChevronRight size={12} />
                                </button>
                                {weekOffset !== 0 && (
                                  <button onClick={() => setWeekOffset(0)}
                                    style={{ height: 24, borderRadius: 6, border: '1px solid var(--border-subtle)', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)', padding: '0 8px', fontSize: 9, fontWeight: 600, fontFamily: "'Inter', sans-serif", transition: 'all 150ms' }}
                                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
                                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
                                    Hoy
                                  </button>
                                )}
                              </div>
                              <button onClick={() => { setPlanDate(format(new Date(), 'yyyy-MM-dd')); setPlanTitle(''); setPlanGroupId(''); setPlanTopicId(''); setPlanType('estudio'); setPlanDuration(30); setShowPlanModal(true); }}
                                style={{ height: 26, borderRadius: 7, border: `1px solid ${course.color}30`, background: `${course.color}0d`, cursor: 'pointer', color: course.color, padding: '0 10px', fontSize: 10, fontWeight: 600, fontFamily: "'Inter Tight', sans-serif", display: 'flex', alignItems: 'center', gap: 4, transition: 'all 150ms' }}
                                onMouseEnter={e => { e.currentTarget.style.background = `${course.color}1a`; e.currentTarget.style.borderColor = `${course.color}50`; }}
                                onMouseLeave={e => { e.currentTarget.style.background = `${course.color}0d`; e.currentTarget.style.borderColor = `${course.color}30`; }}>
                                <Plus size={10} /> Agregar
                              </button>
                            </div>

                            {/* Day blocks grid */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 5 }}>
                              {(() => {
                                const dayNames = ['Lun','Mar','Mie','Jue','Vie','Sab','Dom'];
                                const typeColors2: Record<string, string> = { estudio: '#8B5CF6', repaso: '#3B82F6', ejercicio: '#10B981', lectura: '#F59E0B', otro: '#6B7280' };
                                const todayStr = format(new Date(), 'yyyy-MM-dd');
                                const ws2 = startOfWeek(addDays(new Date(), weekOffset * 7), { weekStartsOn: 1 });
                                return Array.from({ length: 7 }, (_, i) => {
                                  const d = addDays(ws2, i);
                                  const dayNum = d.getDate();
                                  const dayStr = format(d, 'yyyy-MM-dd');
                                  const today = dayStr === todayStr;
                                  const secs = weeklyStudyTime?.[dayStr] || 0;
                                  const mins = Math.round(secs / 60);
                                  const isFuture = d > new Date() && !today;
                                  const dayPlanned = (plannedSessions || []).filter(s => s.courseId === course.id && s.date === dayStr && !s.completed);
                                  const plannedMins = dayPlanned.reduce((a, s) => a + s.durationMinutes, 0);
                                  return (
                                    <div key={i}
                                      style={{ borderRadius: 10, border: today ? `1.5px solid ${course.color}` : '1px solid var(--border-subtle)', background: today ? `${course.color}08` : 'var(--bg-surface)', padding: '8px 6px 6px', display: 'flex', flexDirection: 'column', gap: 0, transition: 'all 200ms cubic-bezier(0.16,1,0.3,1)', opacity: isFuture ? 0.4 : 1, position: 'relative', cursor: 'pointer', minHeight: 90, overflow: 'hidden' }}
                                      onClick={() => { setDayDetailDate(dayStr); setShowDayDetail(true); }}
                                      onMouseEnter={e => { e.currentTarget.style.borderColor = `${course.color}50`; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                                      onMouseLeave={e => { e.currentTarget.style.borderColor = today ? `1.5px solid ${course.color}` : 'var(--border-subtle)'; e.currentTarget.style.transform = 'translateY(0)'; }}>
                                      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
                                        <span style={{ fontSize: 9, fontWeight: 700, color: today ? course.color : 'var(--text-tertiary)', fontFamily: "'Inter Tight', sans-serif", letterSpacing: '0.04em' }}>{dayNames[i]}</span>
                                        <span style={{ fontSize: 14, fontWeight: 800, color: today ? course.color : 'var(--text-primary)', fontFamily: "'Inter Tight', sans-serif", lineHeight: 1 }}>{dayNum}</span>
                                      </div>
                                      {dayPlanned.length > 0 && (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, overflow: 'hidden' }}>
                                          {dayPlanned.slice(0, 2).map(s => (
                                            <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 4px', borderRadius: 4, background: `${typeColors2[s.type] || '#8B5CF6'}0a` }}>
                                              <div style={{ width: 4, height: 4, borderRadius: '50%', background: typeColors2[s.type] || '#8B5CF6', flexShrink: 0 }} />
                                              <span style={{ fontSize: 8, fontWeight: 600, color: 'var(--text-primary)', fontFamily: "'Inter', sans-serif", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>{s.title}</span>
                                            </div>
                                          ))}
                                          {dayPlanned.length > 2 && <span style={{ fontSize: 7, fontWeight: 600, color: 'var(--text-muted)', textAlign: 'center' }}>+{dayPlanned.length - 2}</span>}
                                        </div>
                                      )}
                                      <div style={{ marginTop: 'auto', paddingTop: 4 }}>
                                        {plannedMins > 0 && (
                                          <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 3 }}>
                                            <div style={{ flex: 1, height: 2, borderRadius: 2, background: `${course.color}12`, overflow: 'hidden' }}>
                                              {mins > 0 && <div style={{ width: `${Math.min(100, (mins / plannedMins) * 100)}%`, height: '100%', background: mins >= plannedMins ? '#10B981' : course.color, borderRadius: 2 }} />}
                                            </div>
                                            <span style={{ fontSize: 7, fontWeight: 700, color: mins >= plannedMins ? '#10B981' : 'var(--text-muted)', fontFamily: "'Inter Tight', sans-serif", minWidth: 18, textAlign: 'right' }}>{mins}/{plannedMins}m</span>
                                          </div>
                                        )}
                                      </div>
                                      {today && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, borderRadius: '10px 10px 0 0', background: course.color }} />}
                                    </div>
                                  );
                                });
                              })()}
                            </div>
                          </div>
                    </div>

                    {/* ══ MATERIALS + CENTER ROW ══ */}
                    <div style={{ display: 'flex', flex: 1, overflow: 'hidden', marginTop: 4 }}>

                      {/* ══ LEFT: MATERIALES (380px) ══ */}
                      <div style={{ width: 380, flexShrink: 0, display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--border-subtle)', overflow: 'hidden' }}>

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px 8px', flexShrink: 0 }}>
                          <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: "'Inter Tight', sans-serif" }}>Materiales</h3>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button onClick={() => { estudioFileInputRef.current?.click(); }}
                              style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${course.color}30`, background: `${course.color}10`, cursor: 'pointer', color: course.color, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 200ms ' + EASE }}
                              onMouseEnter={e => { e.currentTarget.style.background = `${course.color}22`; e.currentTarget.style.borderColor = `${course.color}50`; }}
                              onMouseLeave={e => { e.currentTarget.style.background = `${course.color}10`; e.currentTarget.style.borderColor = `${course.color}30`; }}
                              title="Subir archivo">
                              <Upload size={15} />
                            </button>
                            <button onClick={() => { setShowAddLinkModal(true); setAddLinkUrl(''); setAddLinkName(''); }}
                              style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${course.color}30`, background: `${course.color}10`, cursor: 'pointer', color: course.color, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 200ms ' + EASE }}
                              onMouseEnter={e => { e.currentTarget.style.background = `${course.color}22`; e.currentTarget.style.borderColor = `${course.color}50`; }}
                              onMouseLeave={e => { e.currentTarget.style.background = `${course.color}10`; e.currentTarget.style.borderColor = `${course.color}30`; }}
                              title="Anadir enlace">
                              <Link2 size={15} />
                            </button>
                          </div>
                        </div>
                        <input type="file" ref={estudioFileInputRef} style={{ display: 'none' }} onChange={e => handleFileUpload(e, parsedTopics[0]?.id)} />
                        <div style={{ flex: 1, minHeight: 0, maxHeight: 390, overflowY: 'auto', padding: '10px 14px 24px', display: 'flex', flexDirection: 'column', gap: 12 }} className="no-scrollbar">
                          {allCourseMaterials.length === 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 120, borderRadius: 12, border: '1px dashed var(--border-subtle)', background: 'var(--bg-surface)', gap: 8 }}>
                              <File size={20} style={{ color: 'var(--text-muted)', opacity: 0.5 }} />
                              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>Sin materiales todavia</p>
                            </div>
                          ) : allCourseMaterials.map((mat, idx) => {
                            const matName = mat.name || 'Sin nombre';
                            const dataUrl = mat.dataUrl || '';
                            const isLink = dataUrl.startsWith('http');
                            const ext = (mat.name || '').split('.').pop()?.toLowerCase() || '';
                            const isImg = ['png','jpg','jpeg','webp','gif','svg'].includes(ext) || dataUrl.startsWith('data:image');
                            const isPdf = ext === 'pdf';
                            const isDoc = ['doc','docx'].includes(ext);
                            const isXls = ['xls','xlsx','csv'].includes(ext);
                            const isPpt = ['ppt','pptx'].includes(ext);
                            const isAudio = ['mp3','wav','ogg','flac','aac'].includes(ext) || dataUrl.startsWith('data:audio');
                            const isVideo = ['mp4','webm','avi','mov','mkv'].includes(ext) || dataUrl.startsWith('data:video');
                            const isYouTube = isLink && (dataUrl.includes('youtube.com') || dataUrl.includes('youtu.be'));
                            const isClassroom = isLink && dataUrl.includes('classroom.google.com');
                            const isDrive = isLink && dataUrl.includes('drive.google.com');
                            const isWeb = isLink && !isYouTube && !isDrive && !isClassroom;
                            const isLocal = dataUrl && !dataUrl.startsWith('http') && !dataUrl.startsWith('data:') && !dataUrl.startsWith('blob:');

                            const openFile = (path: string) => {
                              if ((window as any).__TAURI__?.shell?.open) {
                                (window as any).__TAURI__.shell.open(path).catch(() => window.open(path, '_blank', 'noopener,noreferrer'));
                              } else { window.open(path, '_blank', 'noopener,noreferrer'); }
                            };

                            const handleMatClick = () => {
                              if (isPdf && dataUrl) { setPdfPreviewUrl(isLocal ? (window as any).__TAURI__?.convertFileSrc?.(dataUrl) || dataUrl : dataUrl); setPdfPreviewName(matName); setShowPdfPreview(true); }
                              else if (isImg && dataUrl) { setPdfPreviewUrl(dataUrl); setPdfPreviewName(matName); setShowPdfPreview(true); }
                              else if (isYouTube) { setPipUrl(dataUrl, matName); }
                              else if (isVideo) { setPipUrl(dataUrl, matName); }
                              else if (isWeb || isDrive || isClassroom || isLink || isDoc || isXls || isPpt) { openFile(dataUrl); }
                              else if (isAudio) { /* toggle inline — handled by audio player below */ }
                              else if (dataUrl.startsWith('http')) { openFile(dataUrl); }
                              else if (isLocal) { openFile(dataUrl); }
                            };

                            const svgIcon = (d: string, c: string) => <svg viewBox="0 0 24 24" width={17} height={17} fill={c} style={{ flexShrink: 0, display: 'block' }}><path d={d} /></svg>;
                            let iconEl: React.ReactNode;
                            let badgeColor = '#888';
                            if (isDoc) { badgeColor = '#2563EB'; iconEl = svgIcon('M23.004 1.5q.41 0 .703.293t.293.703v19.008q0 .41-.293.703t-.703.293H6.996q-.41 0-.703-.293T6 21.504V18H.996q-.41 0-.703-.293T0 17.004V6.996q0-.41.293-.703T.996 6H6V2.496q0-.41.293-.703t.703-.293zM6.035 11.203l1.442 4.735h1.64l1.57-7.876H9.036l-.937 4.653-1.325-4.5H5.38l-1.406 4.523-.938-4.675H1.312l1.57 7.874h1.641zM22.5 21v-3h-15v3zm0-4.5v-3.75H12v3.75zm0-5.25V7.5H12v3.75zm0-5.25V3h-15v3Z', '#2563EB'); }
                            else if (isXls) { badgeColor = '#10B981'; iconEl = svgIcon('M23 1.5q.41 0 .7.3.3.29.3.7v19q0 .41-.3.7-.29.3-.7.3H7q-.41 0-.7-.3-.3-.29-.3-.7V18H1q-.41 0-.7-.3-.3-.29-.3-.7V7q0-.41.3-.7Q.58 6 1 6h5V2.5q0-.41.3-.7.29-.3.7-.3zM6 13.28l1.42 2.66h2.14l-2.38-3.87 2.34-3.8H7.46l-1.3 2.4-.05.08-.04.09-.64-1.28-.66-1.29H2.59l2.27 3.82-2.48 3.85h2.16zM14.25 21v-3H7.5v3zm0-4.5v-3.75H12v3.75zm0-5.25V7.5H12v3.75zm0-5.25V3H7.5v3zm8.25 15v-3h-6.75v3zm0-4.5v-3.75h-6.75v3.75zm0-5.25V7.5h-6.75v3.75zm0-5.25V3h-6.75v3Z', '#10B981'); }
                            else if (isPpt) { badgeColor = '#F97316'; iconEl = svgIcon('M13.5 1.5q1.453 0 2.795.375 1.342.375 2.508 1.06 1.166.686 2.12 1.641.956.955 1.641 2.121.686 1.166 1.061 2.508Q24 10.547 24 12q0 1.453-.375 2.795-.375 1.342-1.06 2.508-.686 1.166-1.641 2.12-.955.956-2.121 1.641-1.166.686-2.508 1.061-1.342.375-2.795.375-1.29 0-2.52-.305-1.23-.304-2.337-.884-1.108-.58-2.063-1.418-.955-.838-1.693-1.893H.997q-.411 0-.704-.293T0 17.004V6.996q0-.41.293-.703T.996 6h3.89q.739-1.055 1.694-1.893.955-.837 2.063-1.418 1.107-.58 2.337-.884Q12.21 1.5 13.5 1.5z', '#F97316'); }
                            else if (isPdf) { badgeColor = '#EF4444'; iconEl = svgIcon('M23.63 15.3c-.71-.745-2.166-1.17-4.224-1.17-1.1 0-2.377.106-3.761.354a19.443 19.443 0 0 1-2.307-2.661c-.532-.71-.994-1.49-1.42-2.236.817-2.484 1.207-4.507 1.207-5.962 0-1.632-.603-3.336-2.342-3.336-.532 0-1.065.32-1.349.781-.78 1.384-.425 4.4.923 7.381a60.277 60.277 0 0 1-1.703 4.507c-.568 1.349-1.207 2.733-1.917 4.01C2.834 18.53.314 20.34.03 21.758c-.106.533.071 1.03.462 1.42.142.107.639.533 1.49.533 2.59 0 5.323-4.188 6.707-6.707 1.065-.355 2.13-.71 3.194-.994a34.963 34.963 0 0 1 3.407-.745c2.732 2.448 5.145 2.839 6.352 2.839 1.49 0 2.023-.604 2.2-1.1.32-.64.106-1.349-.213-1.704z', '#EF4444'); }
                            else if (isYouTube) { badgeColor = '#EF4444'; iconEl = svgIcon('M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z', '#EF4444'); }
                            else if (isClassroom) { badgeColor = '#0F9D58'; iconEl = <svg viewBox="0 0 24 24" width={17} height={17} style={{ flexShrink: 0, display: 'block' }}><path d="M12 3L1 9l4 2.18v6L12 21l7-3.82v-6l2-1.09V17h2V9L12 3z" fill="#0F9D58"/><path d="M12 3l7 3.82v6L12 17 5 12.82v-6L12 3z" fill="#0F9D58" opacity="0.6"/></svg>; }
                            else if (isDrive) { badgeColor = '#4285F4'; iconEl = <svg viewBox="0 0 24 24" width={17} height={17} style={{ flexShrink: 0, display: 'block' }}><path d="M8.5 3L3 13l3 5h4l5-10z" fill="#4285F4"/><path d="M15.5 3L21 13l-3 5h-4L9.5 8z" fill="#FBBC04"/><path d="M3 13l3 5h12l3-5H3z" fill="#0F9D58"/></svg>; }
                            else if (isAudio) { badgeColor = '#8B5CF6'; iconEl = <Music size={13} />; }
                            else if (isImg) { badgeColor = '#F59E0B'; iconEl = <ImageIcon size={13} />; }
                            else if (isVideo) { badgeColor = '#EC4899'; iconEl = <File size={13} />; }
                            else if (isWeb) {
                              badgeColor = '#10B981';
                              let domain = ''; try { domain = new URL(dataUrl).hostname; } catch {}
                              iconEl = (
                                <span style={{ position: 'relative', width: 17, height: 17, display: 'inline-flex', flexShrink: 0 }}>
                                  <img src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`} alt="" style={{ width: 17, height: 17, borderRadius: 3, position: 'absolute', inset: 0 }}
                                    onError={e => { e.currentTarget.style.display = 'none'; const fb = e.currentTarget.parentElement?.querySelector('.link-fb') as HTMLElement; if (fb) fb.style.display = 'flex'; }} />
                                  <span className="link-fb" style={{ display: 'none', position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center', color: '#10B981' }}><Link2 size={12} /></span>
                                </span>
                              );
                            }
                            else { iconEl = <File size={13} />; }

                            return (
                              <React.Fragment key={mat.id || idx}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 7, background: isAudio && playingAudioId === mat.id ? `${badgeColor}08` : 'var(--bg-elevated)', border: `1px solid ${isAudio && playingAudioId === mat.id ? `${badgeColor}30` : 'var(--border-soft)'}`, cursor: 'pointer', transition: 'all 150ms' }}
                                  onMouseEnter={e => { e.currentTarget.style.borderColor = `${badgeColor}40`; e.currentTarget.style.background = 'var(--bg-hover)'; }}
                                  onMouseLeave={e => { e.currentTarget.style.borderColor = isAudio && playingAudioId === mat.id ? `${badgeColor}30` : 'var(--border-soft)'; e.currentTarget.style.background = isAudio && playingAudioId === mat.id ? `${badgeColor}08` : 'var(--bg-elevated)'; }}>
                                  <div onClick={() => {
                                    if (isAudio) {
                                      if (playingAudioId === mat.id && audioRef.current) {
                                        audioRef.current.paused ? audioRef.current.play() : audioRef.current.pause();
                                      } else {
                                        setPlayingAudioId(mat.id);
                                        setTimeout(() => { if (audioRef.current) { audioRef.current.src = dataUrl; audioRef.current.play().catch(() => {}); } }, 50);
                                      }
                                    } else { handleMatClick(); }
                                  }} style={{ width: 30, height: 30, borderRadius: 7, background: `${badgeColor}14`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 150ms', color: badgeColor, position: 'relative' }}>
                                    {iconEl}
                                  </div>
                                  <div onClick={() => {
                                    if (isAudio) {
                                      if (playingAudioId === mat.id && audioRef.current) {
                                        audioRef.current.paused ? audioRef.current.play() : audioRef.current.pause();
                                      } else {
                                        setPlayingAudioId(mat.id);
                                        setTimeout(() => { if (audioRef.current) { audioRef.current.src = dataUrl; audioRef.current.play().catch(() => {}); } }, 50);
                                      }
                                    } else { handleMatClick(); }
                                  }} style={{ flex: 1, minWidth: 0 }}>
                                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.3 }}>{matName}</span>
                                  </div>
                                  {isAudio && playingAudioId === mat.id && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                                      <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 28, textAlign: 'right', fontFamily: "'JetBrains Mono', monospace" }}>{formatTime(audioProgress)}</span>
                                      <div style={{ width: 60, height: 3, borderRadius: 2, background: 'var(--bg-hover)', cursor: 'pointer', position: 'relative' }}
                                        onClick={e => { if (audioRef.current) { const r = e.currentTarget.getBoundingClientRect(); audioRef.current.currentTime = ((e.clientX - r.left) / r.width) * audioDuration; } }}>
                                        <div style={{ width: `${(audioProgress / (audioDuration || 1)) * 100}%`, height: '100%', borderRadius: 2, background: badgeColor, transition: 'width 100ms linear' }} />
                                      </div>
                                      <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 28, fontFamily: "'JetBrains Mono', monospace" }}>{formatTime(audioDuration)}</span>
                                    </div>
                                  )}
                                  {isLink ? (
                                    <button onClick={e => { e.stopPropagation(); setEditLinkId(mat.id); setEditLinkUrl(dataUrl); setEditLinkName(matName); }}
                                      style={{ width: 24, height: 24, borderRadius: 6, border: 'none', background: 'transparent', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, transition: 'all 150ms', opacity: 0 }}
                                      onMouseEnter={ev => { ev.currentTarget.style.background = 'var(--bg-hover)'; ev.currentTarget.style.color = 'var(--text-primary)'; ev.currentTarget.style.opacity = '1'; }}
                                      onMouseLeave={ev => { ev.currentTarget.style.background = 'transparent'; ev.currentTarget.style.color = 'var(--text-muted)'; ev.currentTarget.style.opacity = '0'; }}
                                      title="Editar enlace">
                                      <Edit3 size={11} />
                                    </button>
                                  ) : (
                                    <button onClick={e => { e.stopPropagation(); setConfirmDeleteMatId(mat.id); }}
                                      style={{ width: 24, height: 24, borderRadius: 6, border: 'none', background: 'transparent', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, transition: 'all 150ms', opacity: 0 }}
                                      onMouseEnter={ev => { ev.currentTarget.style.background = 'rgba(239,68,68,0.1)'; ev.currentTarget.style.color = '#EF4444'; ev.currentTarget.style.opacity = '1'; }}
                                      onMouseLeave={ev => { ev.currentTarget.style.background = 'transparent'; ev.currentTarget.style.color = 'var(--text-muted)'; ev.currentTarget.style.opacity = '0'; }}
                                      title="Eliminar">
                                      <X size={11} />
                                    </button>
                                  )}
                                </div>
                              </React.Fragment>
                            );
                          })}
                        </div>
                      </div>

                      {/* ══ CENTER: PLANNER + TIME BAR + RADAR ══ */}
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px 28px', display: 'flex', flexDirection: 'column', gap: 18 }} className="no-scrollbar">

                          {/* ── WEEKLY TIME BAR ── */}
                          {(() => {
                            const typeColors3: Record<string, string> = { estudio: '#8B5CF6', repaso: '#3B82F6', ejercicio: '#10B981', lectura: '#F59E0B', otro: '#6B7280' };
                            const typeLabels: Record<string, string> = { estudio: 'Estudio', repaso: 'Repaso', ejercicio: 'Ejercicio', lectura: 'Lectura', otro: 'Otro' };
                            const ws3 = startOfWeek(addDays(new Date(), weekOffset * 7), { weekStartsOn: 1 });
                            const we3 = endOfWeek(addDays(new Date(), weekOffset * 7), { weekStartsOn: 1 });
                            const weekSessions = (plannedSessions || []).filter(s => {
                              if (s.courseId !== course.id) return false;
                              const d = new Date(s.date);
                              return d >= ws3 && d <= we3;
                            });
                            const totalTime = weekSessions.reduce((a, s) => a + s.durationMinutes, 0);
                            if (totalTime === 0) return null;
                            const byType = Object.keys(typeColors3).map(type => ({ type, minutes: weekSessions.filter(s => s.type === type).reduce((a, s) => a + s.durationMinutes, 0), color: typeColors3[type], label: typeLabels[type] })).filter(t => t.minutes > 0);
                            return (
                              <div>
                                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8, fontFamily: "'Inter Tight', sans-serif" }}>Tiempo Semanal</div>
                                <div style={{ height: 26, borderRadius: 8, background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', overflow: 'hidden', display: 'flex' }}>
                                  {byType.map((t, idx) => (
                                    <div key={t.type}
                                      title={`${t.label}: ${t.minutes}m (${Math.round((t.minutes / totalTime) * 100)}%)`}
                                      style={{ width: `${(t.minutes / totalTime) * 100}%`, background: t.color, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'width 400ms cubic-bezier(0.16,1,0.3,1)', cursor: 'default', position: 'relative' }}
                                      onMouseEnter={e => { e.currentTarget.style.filter = 'brightness(1.15)'; }}
                                      onMouseLeave={e => { e.currentTarget.style.filter = 'none'; }}>
                                      {(t.minutes / totalTime) > 0.12 && <span style={{ fontSize: 8, fontWeight: 700, color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>{Math.round((t.minutes / totalTime) * 100)}%</span>}
                                    </div>
                                  ))}
                                </div>
                                <div style={{ display: 'flex', gap: 10, marginTop: 6, flexWrap: 'wrap' }}>
                                  {byType.map(t => (
                                    <div key={t.type} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: t.color }} />
                                      <span style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: "'Inter', sans-serif" }}>{t.label} {t.minutes}m</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })()}

                          {/* ── RADAR / SPIDER CHART ── */}
                          {(() => {
                            const radarCx = 140, radarCy = 120, radarR = 85;
                            const typeColors4: Record<string, string> = { estudio: '#8B5CF6', repaso: '#3B82F6', ejercicio: '#10B981', lectura: '#F59E0B', otro: '#6B7280' };
                            const dayLabels = ['Lun','Mar','Mie','Jue','Vie','Sab','Dom'];
                            const ws4 = startOfWeek(addDays(new Date(), weekOffset * 7), { weekStartsOn: 1 });

                            let labels: string[] = [];
                            let values: number[] = [];

                            if (radarFilter === 'agrupaciones' && groups.length > 0) {
                              labels = groups.slice(0, 8).map(g => g.name);
                              values = groups.slice(0, 8).map(g => {
                                const gs = (plannedSessions || []).filter(s => s.courseId === course.id && s.groupId === g.id);
                                const done = gs.filter(s => s.completed).length;
                                return gs.length > 0 ? done / gs.length : 0;
                              });
                            } else if (radarFilter === 'dias') {
                              labels = dayLabels;
                              values = Array.from({ length: 7 }, (_, i) => {
                                const d = format(addDays(ws4, i), 'yyyy-MM-dd');
                                const ds = (plannedSessions || []).filter(s => s.courseId === course.id && s.date === d);
                                const done = ds.filter(s => s.completed).length;
                                return ds.length > 0 ? done / ds.length : 0;
                              });
                            } else if (radarFilter === 'tipos') {
                              labels = Object.keys(typeColors4);
                              values = Object.keys(typeColors4).map(t => {
                                const ts = (plannedSessions || []).filter(s => s.courseId === course.id && s.type === t);
                                const done = ts.filter(s => s.completed).length;
                                return ts.length > 0 ? done / ts.length : 0;
                              });
                            }

                            const n = labels.length;
                            if (n < 3) return null;
                            const angleStep = (2 * Math.PI) / n;

                            const gridLevels = [0.25, 0.5, 0.75, 1];
                            const getPoint = (idx: number, val: number) => {
                              const angle = angleStep * idx - Math.PI / 2;
                              return { x: radarCx + radarR * val * Math.cos(angle), y: radarCy + radarR * val * Math.sin(angle) };
                            };
                            const dataPoints = values.map((v, i) => getPoint(i, v));
                            const dataPath = dataPoints.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ') + 'Z';

                            return (
                              <div>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: "'Inter Tight', sans-serif" }}>Progreso</div>
                                  <div style={{ display: 'flex', gap: 3 }}>
                                    {([['agrupaciones','Agrupaciones'],['dias','Días'],['tipos','Tipos']] as const).map(([key, lbl]) => (
                                      <button key={key} onClick={() => setRadarFilter(key)}
                                        style={{ height: 22, borderRadius: 6, border: `1px solid ${radarFilter === key ? course.color + '50' : 'var(--border-subtle)'}`, background: radarFilter === key ? `${course.color}12` : 'transparent', cursor: 'pointer', color: radarFilter === key ? course.color : 'var(--text-muted)', padding: '0 8px', fontSize: 9, fontWeight: 600, fontFamily: "'Inter', sans-serif", transition: 'all 150ms' }}
                                        onMouseEnter={e => { if (radarFilter !== key) { e.currentTarget.style.background = 'var(--bg-hover)'; } }}
                                        onMouseLeave={e => { if (radarFilter !== key) { e.currentTarget.style.background = 'transparent'; } }}>
                                        {lbl}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'center' }}>
                                  <svg width="100%" viewBox="0 0 280 240" style={{ maxWidth: 320 }}>
                                    {/* Grid */}
                                    {gridLevels.map(lv => (
                                      <polygon key={lv}
                                        points={Array.from({ length: n }, (_, i) => { const p = getPoint(i, lv); return `${p.x},${p.y}`; }).join(' ')}
                                        fill="none" stroke="var(--border-subtle)" strokeWidth="0.5" opacity={0.5} />
                                    ))}
                                    {/* Spokes */}
                                    {Array.from({ length: n }, (_, i) => {
                                      const p = getPoint(i, 1);
                                      return <line key={i} x1={radarCx} y1={radarCy} x2={p.x} y2={p.y} stroke="var(--border-subtle)" strokeWidth="0.5" opacity={0.4} />;
                                    })}
                                    {/* Data polygon */}
                                    <path d={dataPath} fill={`${course.color}18`} stroke={course.color} strokeWidth="1.5" strokeLinejoin="round" style={{ transition: 'all 400ms cubic-bezier(0.16,1,0.3,1)' }} />
                                    {/* Data points */}
                                    {dataPoints.map((p, i) => (
                                      <circle key={i} cx={p.x} cy={p.y} r={3} fill={course.color} stroke="var(--bg-surface)" strokeWidth="1.5" style={{ transition: 'all 400ms cubic-bezier(0.16,1,0.3,1)' }} />
                                    ))}
                                    {/* Labels */}
                                    {labels.map((lbl, i) => {
                                      const p = getPoint(i, 1.18);
                                      const anchor = p.x < radarCx - 5 ? 'end' : p.x > radarCx + 5 ? 'start' : 'middle';
                                      return <text key={i} x={p.x} y={p.y} textAnchor={anchor} dominantBaseline="middle" fill="var(--text-muted)" fontSize="8" fontFamily="'Inter', sans-serif" fontWeight="600">{lbl}</text>;
                                    })}
                                    {/* Center dot */}
                                    <circle cx={radarCx} cy={radarCy} r={2} fill={course.color} opacity={0.3} />
                                  </svg>
                                </div>
                              </div>
                            );
                          })()}

                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ══ RIGHT: AGRUPACIONES — FULL LATERAL ══ */}
                  <div style={{ width: 320, flexShrink: 0, display: 'flex', flexDirection: 'column', borderLeft: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 20px 14px', flexShrink: 0 }}>
                      <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: "'Inter Tight', sans-serif" }}>Agrupaciones</h3>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <button onClick={() => { setEditingGroupId(null); setGroupName(''); setGroupCover(undefined); setShowGroupModal(true); }}
                          style={{ width: 28, height: 28, borderRadius: 8, border: `1.5px solid ${course.color}40`, background: `${course.color}08`, cursor: 'pointer', color: course.color, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 200ms ' + EASE }}
                          onMouseEnter={e => { e.currentTarget.style.background = `${course.color}18`; e.currentTarget.style.borderColor = `${course.color}60`; }}
                          onMouseLeave={e => { e.currentTarget.style.background = `${course.color}08`; e.currentTarget.style.borderColor = `${course.color}40`; }}
                          title="Nueva agrupacion">
                          <Plus size={14} />
                        </button>
                      </div>
                    </div>
                    <div style={{ flex: 1, minHeight: 0, maxHeight: 550, overflowY: 'auto', padding: '0 14px 24px', display: 'flex', flexDirection: 'column', gap: 7 }} className="no-scrollbar">
                      {groups.length === 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 120, borderRadius: 12, border: '1px dashed var(--border-subtle)', background: 'var(--bg-surface)', gap: 8 }}>
                          <Layers size={20} style={{ color: 'var(--text-muted)', opacity: 0.5 }} />
                          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>Sin agrupaciones</p>
                        </div>
                      ) : groups.map(group => {
                        return (
                          <div key={group.id}
                            style={{ borderRadius: 12, border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated-alpha, var(--bg-elevated))', overflow: 'hidden', cursor: 'pointer', transition: 'all 200ms ' + EASE, position: 'relative' }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = `${course.color}40`; e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = `0 6px 20px ${course.color}12`; }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
                            onClick={() => { setSelectedGroupId(group.id); setCurrentView('group'); }}>
                            {group.image ? (
                                <div style={{ width: '100%', height: 120, overflow: 'hidden', position: 'relative' }}>
                                <img src={group.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', transition: 'transform 400ms cubic-bezier(0.16,1,0.3,1)' }}
                                  onMouseEnter={ev => { ev.currentTarget.style.transform = 'scale(1.04)'; }}
                                  onMouseLeave={ev => { ev.currentTarget.style.transform = 'scale(1)'; }} />
                                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.15) 50%, transparent 100%)' }} />
                                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '14px 16px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                                  <div style={{ minWidth: 0, flex: 1 }}>
                                    <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', fontFamily: "'Inter Tight', sans-serif", textShadow: '0 1px 6px rgba(0,0,0,0.5)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', letterSpacing: '-0.01em' }}>{group.name}</div>
                                  </div>
                                  <button onClick={e => { e.stopPropagation(); setInlineEditGroupId(group.id); setInlineGroupName(group.name); setInlineGroupCover(group.image); }}
                                    style={{ width: 26, height: 26, borderRadius: 6, border: 'none', background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(6px)', cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 150ms', opacity: 0.7 }}
                                    onMouseEnter={ev => { ev.currentTarget.style.background = 'rgba(255,255,255,0.22)'; ev.currentTarget.style.opacity = '1'; }}
                                    onMouseLeave={ev => { ev.currentTarget.style.background = 'rgba(255,255,255,0.12)'; ev.currentTarget.style.opacity = '0.7'; }}
                                    title="Editar">
                                    <Edit3 size={11} />
                                  </button>
                                </div>
                                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${course.color}, transparent)` }} />
                              </div>
                            ) : (
                              <div style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 14, position: 'relative' }}>
                                <div style={{ width: 36, height: 36, borderRadius: 10, background: `linear-gradient(135deg, ${course.color}18, ${course.color}08)`, border: `1px solid ${course.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 200ms ' + EASE }}>
                                  <Layers size={15} style={{ color: course.color }} />
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', fontFamily: "'Inter Tight', sans-serif", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', letterSpacing: '-0.01em' }}>{group.name}</div>
                                </div>
                                <button onClick={e => { e.stopPropagation(); setInlineEditGroupId(group.id); setInlineGroupName(group.name); setInlineGroupCover(group.image); }}
                                  style={{ width: 26, height: 26, borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 150ms', opacity: 0 }}
                                  onMouseEnter={ev => { ev.currentTarget.style.background = 'var(--bg-hover)'; ev.currentTarget.style.opacity = '1'; }}
                                  onMouseLeave={ev => { ev.currentTarget.style.background = 'transparent'; ev.currentTarget.style.opacity = '0'; }}
                                  title="Editar">
                                  <Edit3 size={11} />
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* ══ DELETE MATERIAL CONFIRMATION ══ */}
                {confirmDeleteMatId && (() => {
                  const delMat = allCourseMaterials.find(m => m.id === confirmDeleteMatId);
                  return (
                    <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      onClick={e => { if (e.target === e.currentTarget) setConfirmDeleteMatId(null); }}>
                      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }} />
                      <div style={{ position: 'relative', width: 380, background: 'var(--bg-surface)', borderRadius: 16, border: '1px solid var(--border-subtle)', boxShadow: '0 24px 64px rgba(0,0,0,0.5)', overflow: 'hidden' }} className="bento-card">
                        <div style={{ padding: '24px 24px 16px', textAlign: 'center' }}>
                          <div style={{ width: 48, height: 48, borderRadius: 14, background: 'rgba(239,68,68,0.1)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
                            <AlertTriangle size={24} style={{ color: '#EF4444' }} />
                          </div>
                          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', fontFamily: "'Inter Tight', sans-serif" }}>Eliminar material</h3>
                          {delMat && <p style={{ margin: '8px 0 0', fontSize: 13, color: 'var(--text-secondary)', fontFamily: "'Inter', sans-serif" }}>"{delMat.name || 'Sin nombre'}" sera eliminado</p>}
                        </div>
                        <div style={{ padding: '12px 24px 24px', display: 'flex', gap: 10, justifyContent: 'center' }}>
                          <button onClick={() => setConfirmDeleteMatId(null)}
                            style={{ height: 38, borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 13, fontWeight: 500, cursor: 'pointer', padding: '0 20px', transition: 'all 150ms', fontFamily: "'Inter', sans-serif" }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
                            Cancelar
                          </button>
                          <button onClick={() => { handleDeleteResourceFromOverview(confirmDeleteMatId); }}
                            style={{ height: 38, borderRadius: 8, border: 'none', background: '#EF4444', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: '0 20px', transition: 'all 150ms', fontFamily: "'Inter', sans-serif" }}
                            onMouseEnter={e => { e.currentTarget.style.opacity = '0.9'; }}
                            onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}>
                            Eliminar
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* ══ ADD LINK MODAL ══ */}
                {showAddLinkModal && (
                  <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    onClick={e => { if (e.target === e.currentTarget) setShowAddLinkModal(false); }}>
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }} />
                    <div style={{ position: 'relative', width: 400, background: 'var(--bg-surface)', borderRadius: 16, border: '1px solid var(--border-subtle)', boxShadow: '0 24px 64px rgba(0,0,0,0.5)', overflow: 'hidden' }} className="bento-card">
                      <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', fontFamily: "'Inter Tight', sans-serif" }}>Agregar enlace</h3>
                        <button onClick={() => setShowAddLinkModal(false)}
                          style={{ width: 28, height: 28, borderRadius: 7, border: 'none', background: 'var(--bg-hover)', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 150ms' }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; e.currentTarget.style.color = '#EF4444'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-muted)'; }}>
                          <X size={14} />
                        </button>
                      </div>
                      <div style={{ padding: '18px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                        <div>
                          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6, letterSpacing: '0.02em' }}>URL del enlace</label>
                          <input value={addLinkUrl} onChange={e => setAddLinkUrl(e.target.value)}
                            placeholder="https://..."
                            onKeyDown={e => { if (e.key === 'Enter') handleAddLink(); }}
                            autoFocus
                            style={{ width: '100%', height: 40, borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--bg-deep)', color: 'var(--text-primary)', padding: '0 12px', fontSize: 13, outline: 'none', fontFamily: "'Inter', sans-serif" }}
                            className="input-base" />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6, letterSpacing: '0.02em' }}>Nombre <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(opcional)</span></label>
                          <input value={addLinkName} onChange={e => setAddLinkName(e.target.value)}
                            placeholder="Mi enlace"
                            onKeyDown={e => { if (e.key === 'Enter') handleAddLink(); }}
                            style={{ width: '100%', height: 40, borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--bg-deep)', color: 'var(--text-primary)', padding: '0 12px', fontSize: 13, outline: 'none', fontFamily: "'Inter', sans-serif" }}
                            className="input-base" />
                        </div>
                      </div>
                      <div style={{ padding: '12px 24px 18px', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                        <button onClick={() => setShowAddLinkModal(false)}
                          style={{ height: 36, borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: '0 16px', transition: 'all 150ms' }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
                          Cancelar
                        </button>
                        <button onClick={handleAddLink}
                          style={{ height: 36, borderRadius: 8, border: 'none', background: course.color, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: '0 20px', transition: 'all 150ms' }}
                          onMouseEnter={e => { e.currentTarget.style.opacity = '0.9'; }}
                          onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}>
                          Agregar
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* ══ EDIT LINK MODAL ══ */}
                {editLinkId && (
                  <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    onClick={e => { if (e.target === e.currentTarget) setEditLinkId(null); }}>
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }} />
                    <div style={{ position: 'relative', width: 400, background: 'var(--bg-surface)', borderRadius: 16, border: '1px solid var(--border-subtle)', boxShadow: '0 24px 64px rgba(0,0,0,0.5)', overflow: 'hidden' }} className="bento-card">
                      <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', fontFamily: "'Inter Tight', sans-serif" }}>Editar enlace</h3>
                        <button onClick={() => setEditLinkId(null)}
                          style={{ width: 28, height: 28, borderRadius: 7, border: 'none', background: 'var(--bg-hover)', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 150ms' }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; e.currentTarget.style.color = '#EF4444'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-muted)'; }}>
                          <X size={14} />
                        </button>
                      </div>
                      <div style={{ padding: '18px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                        <div>
                          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6, letterSpacing: '0.02em' }}>URL del enlace</label>
                          <input value={editLinkUrl} onChange={e => setEditLinkUrl(e.target.value)}
                            placeholder="https://..."
                            onKeyDown={e => { if (e.key === 'Enter') handleSaveEditLink(); }}
                            autoFocus
                            style={{ width: '100%', height: 40, borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--bg-deep)', color: 'var(--text-primary)', padding: '0 12px', fontSize: 13, outline: 'none', fontFamily: "'Inter', sans-serif" }}
                            className="input-base" />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6, letterSpacing: '0.02em' }}>Nombre</label>
                          <input value={editLinkName} onChange={e => setEditLinkName(e.target.value)}
                            placeholder="Nombre del enlace"
                            onKeyDown={e => { if (e.key === 'Enter') handleSaveEditLink(); }}
                            style={{ width: '100%', height: 40, borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--bg-deep)', color: 'var(--text-primary)', padding: '0 12px', fontSize: 13, outline: 'none', fontFamily: "'Inter', sans-serif" }}
                            className="input-base" />
                        </div>
                      </div>
                      <div style={{ padding: '12px 24px 18px', display: 'flex', gap: 10, justifyContent: 'space-between' }}>
                        <button onClick={() => { setConfirmDeleteMatId(editLinkId); setEditLinkId(null); }}
                          style={{ height: 36, borderRadius: 8, border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.08)', color: '#EF4444', fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: '0 16px', transition: 'all 150ms' }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.15)'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; }}>
                          Eliminar
                        </button>
                        <div style={{ display: 'flex', gap: 10 }}>
                          <button onClick={() => setEditLinkId(null)}
                            style={{ height: 36, borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: '0 16px', transition: 'all 150ms' }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
                            Cancelar
                          </button>
                          <button onClick={handleSaveEditLink}
                            style={{ height: 36, borderRadius: 8, border: 'none', background: course.color, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: '0 20px', transition: 'all 150ms' }}
                            onMouseEnter={e => { e.currentTarget.style.opacity = '0.9'; }}
                            onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}>
                            Guardar
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ══ PLAN SESSION MODAL ══ */}
                {showPlanModal && (
                  <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    onClick={e => { if (e.target === e.currentTarget) setShowPlanModal(false); }}>
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }} />
                    <div style={{ position: 'relative', width: 420, background: 'var(--bg-surface)', borderRadius: 16, border: '1px solid var(--border-subtle)', boxShadow: '0 24px 64px rgba(0,0,0,0.5)', overflow: 'hidden' }} className="bento-card">
                      <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', fontFamily: "'Inter Tight', sans-serif" }}>Planificar sesion</h3>
                        <button onClick={() => setShowPlanModal(false)}
                          style={{ width: 28, height: 28, borderRadius: 7, border: 'none', background: 'var(--bg-hover)', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 150ms' }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; e.currentTarget.style.color = '#EF4444'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-muted)'; }}>
                          <X size={14} />
                        </button>
                      </div>
                      <div style={{ padding: '18px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                        <div>
                          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 6, letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: "'Inter Tight', sans-serif" }}>Fecha</label>
                          <input type="date" value={planDate} onChange={e => setPlanDate(e.target.value)}
                            style={{ width: '100%', height: 40, borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--bg-deep)', color: 'var(--text-primary)', padding: '0 12px', fontSize: 13, outline: 'none', fontFamily: "'Inter', sans-serif" }}
                            className="input-base" />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 6, letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: "'Inter Tight', sans-serif" }}>Titulo</label>
                          <input value={planTitle} onChange={e => setPlanTitle(e.target.value)}
                            placeholder="Ej: Repasar capitulo 3"
                            autoFocus
                            style={{ width: '100%', height: 40, borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--bg-deep)', color: 'var(--text-primary)', padding: '0 12px', fontSize: 13, outline: 'none', fontFamily: "'Inter', sans-serif" }}
                            className="input-base" />
                        </div>
                        <div style={{ display: 'flex', gap: 12 }}>
                          <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 6, letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: "'Inter Tight', sans-serif" }}>Agrupacion</label>
                            <select value={planGroupId} onChange={e => setPlanGroupId(e.target.value)}
                              style={{ width: '100%', height: 40, borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--bg-deep)', color: 'var(--text-primary)', padding: '0 12px', fontSize: 13, outline: 'none', fontFamily: "'Inter', sans-serif", cursor: 'pointer' }}
                              className="input-base">
                              <option value="">Ninguna</option>
                              {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                            </select>
                          </div>
                          <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 6, letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: "'Inter Tight', sans-serif" }}>Tema</label>
                            <select value={planTopicId} onChange={e => setPlanTopicId(e.target.value)}
                              style={{ width: '100%', height: 40, borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--bg-deep)', color: 'var(--text-primary)', padding: '0 12px', fontSize: 13, outline: 'none', fontFamily: "'Inter', sans-serif", cursor: 'pointer' }}
                              className="input-base">
                              <option value="">Ninguno</option>
                              {parsedTopics.filter(t => !planGroupId || t.groupId === planGroupId).map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
                            </select>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 12 }}>
                          <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 6, letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: "'Inter Tight', sans-serif" }}>Tipo</label>
                            <select value={planType} onChange={e => setPlanType(e.target.value as any)}
                              style={{ width: '100%', height: 40, borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--bg-deep)', color: 'var(--text-primary)', padding: '0 12px', fontSize: 13, outline: 'none', fontFamily: "'Inter', sans-serif", cursor: 'pointer' }}
                              className="input-base">
                              <option value="estudio">Estudio</option>
                              <option value="repaso">Repaso</option>
                              <option value="ejercicio">Ejercicio</option>
                              <option value="lectura">Lectura</option>
                              <option value="otro">Otro</option>
                            </select>
                          </div>
                          <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 6, letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: "'Inter Tight', sans-serif" }}>Duracion (min)</label>
                            <input type="number" value={planDuration} onChange={e => setPlanDuration(Math.max(5, parseInt(e.target.value) || 5))} min={5} step={5}
                              style={{ width: '100%', height: 40, borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--bg-deep)', color: 'var(--text-primary)', padding: '0 12px', fontSize: 13, outline: 'none', fontFamily: "'Inter', sans-serif" }}
                              className="input-base" />
                          </div>
                        </div>
                        {dayPlannedSessions.length > 0 && (
                          <div>
                            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 8, letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: "'Inter Tight', sans-serif" }}>Sesiones existentes este dia</label>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                              {dayPlannedSessions.map(s => (
                                <div key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', borderRadius: 6, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
                                  <span style={{ fontSize: 12, color: 'var(--text-primary)', fontFamily: "'Inter', sans-serif" }}>{s.title} <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>({s.durationMinutes}m)</span></span>
                                  <button onClick={() => deletePlannedSession(s.id)}
                                    style={{ width: 20, height: 20, borderRadius: 5, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <X size={10} />
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      <div style={{ padding: '12px 24px 18px', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                        <button onClick={() => setShowPlanModal(false)}
                          style={{ height: 36, borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: '0 16px', transition: 'all 150ms' }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
                          Cancelar
                        </button>
                        <button onClick={() => {
                            if (!planDate || !planTitle.trim()) return;
                            addPlannedSession({ courseId: course.id, date: planDate, title: planTitle.trim(), groupId: planGroupId || undefined, topicId: planTopicId || undefined, durationMinutes: planDuration, type: planType, completed: false });
                            setShowPlanModal(false);
                          }}
                          style={{ height: 36, borderRadius: 8, border: 'none', background: course.color, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: '0 20px', transition: 'all 150ms' }}
                          onMouseEnter={e => { e.currentTarget.style.opacity = '0.9'; }}
                          onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}>
                          Planificar
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* ══ DAY DETAIL MODAL ══ */}
                {showDayDetail && (
                  <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    onClick={e => { if (e.target === e.currentTarget) setShowDayDetail(false); }}>
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }} />
                    <div style={{ position: 'relative', width: 420, maxHeight: '70vh', background: 'var(--bg-surface)', borderRadius: 16, border: '1px solid var(--border-subtle)', boxShadow: '0 24px 64px rgba(0,0,0,0.5)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }} className="bento-card">
                      {/* Header */}
                      <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div style={{ width: 36, height: 36, borderRadius: 10, background: `${course.color}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${course.color}20`, flexDirection: 'column' }}>
                            <span style={{ fontSize: 14, fontWeight: 800, color: course.color, fontFamily: "'Inter Tight', sans-serif", lineHeight: 1 }}>{dayDetailDate ? format(new Date(dayDetailDate + 'T12:00:00'), 'd') : ''}</span>
                            <span style={{ fontSize: 7, fontWeight: 700, color: `${course.color}80`, fontFamily: "'Inter Tight', sans-serif", textTransform: 'uppercase', letterSpacing: '0.06em' }}>{dayDetailDate ? format(new Date(dayDetailDate + 'T12:00:00'), 'EEE', { locale: es }) : ''}</span>
                          </div>
                          <div>
                            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', fontFamily: "'Inter Tight', sans-serif" }}>
                              {dayDetailDate ? format(new Date(dayDetailDate + 'T12:00:00'), "d 'de' MMMM", { locale: es }) : ''}
                            </h3>
                            <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-muted)', fontFamily: "'Inter', sans-serif" }}>
                              {(plannedSessions || []).filter(s => s.courseId === course.id && s.date === dayDetailDate && !s.completed).length} sesiones planificadas
                            </span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <button onClick={() => { setPlanDate(dayDetailDate); setPlanTitle(''); setPlanGroupId(''); setPlanTopicId(''); setPlanType('estudio'); setPlanDuration(30); setShowDayDetail(false); setShowPlanModal(true); }}
                            style={{ height: 28, borderRadius: 7, border: `1px solid ${course.color}30`, background: `${course.color}0d`, cursor: 'pointer', color: course.color, padding: '0 10px', fontSize: 10, fontWeight: 600, fontFamily: "'Inter Tight', sans-serif", display: 'flex', alignItems: 'center', gap: 4, transition: 'all 150ms' }}
                            onMouseEnter={e => { e.currentTarget.style.background = `${course.color}1a`; }}
                            onMouseLeave={e => { e.currentTarget.style.background = `${course.color}0d`; }}>
                            <Plus size={10} /> Agregar
                          </button>
                          <button onClick={() => setShowDayDetail(false)}
                            style={{ width: 28, height: 28, borderRadius: 7, border: 'none', background: 'var(--bg-hover)', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 150ms' }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; e.currentTarget.style.color = '#EF4444'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-muted)'; }}>
                            <X size={14} />
                          </button>
                        </div>
                      </div>

                      {/* Session list */}
                      <div style={{ flex: 1, overflow: 'auto', padding: '12px 24px 20px' }}>
                        {(() => {
                          const typeColors: Record<string, string> = { estudio: '#8B5CF6', repaso: '#3B82F6', ejercicio: '#10B981', lectura: '#F59E0B', otro: '#6B7280' };
                          const typeLabels: Record<string, string> = { estudio: 'Estudio', repaso: 'Repaso', ejercicio: 'Ejercicio', lectura: 'Lectura', otro: 'Otro' };
                          const daySessions = (plannedSessions || []).filter(s => s.courseId === course.id && s.date === dayDetailDate && !s.completed);
                          if (daySessions.length === 0) {
                            return (
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 0', gap: 8 }}>
                                <Calendar size={24} style={{ color: 'var(--text-muted)', opacity: 0.4 }} />
                                <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: "'Inter', sans-serif" }}>No hay sesiones planificadas</span>
                                <button onClick={() => { setPlanDate(dayDetailDate); setPlanTitle(''); setPlanGroupId(''); setPlanTopicId(''); setPlanType('estudio'); setPlanDuration(30); setShowDayDetail(false); setShowPlanModal(true); }}
                                  style={{ marginTop: 4, height: 28, borderRadius: 7, border: `1px solid ${course.color}30`, background: `${course.color}0d`, cursor: 'pointer', color: course.color, padding: '0 12px', fontSize: 11, fontWeight: 600, fontFamily: "'Inter', sans-serif", display: 'flex', alignItems: 'center', gap: 4, transition: 'all 150ms' }}
                                  onMouseEnter={e => { e.currentTarget.style.background = `${course.color}1a`; }}
                                  onMouseLeave={e => { e.currentTarget.style.background = `${course.color}0d`; }}>
                                  <Plus size={10} /> Planificar primera sesion
                                </button>
                              </div>
                            );
                          }
                          const totalMins = daySessions.reduce((a, s) => a + s.durationMinutes, 0);
                          return (
                            <>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                                <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: "'Inter Tight', sans-serif" }}>Sesiones</span>
                                <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', fontFamily: "'Inter', sans-serif" }}>{totalMins} min totales</span>
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {daySessions.map((s, idx) => {
                                  const tc = typeColors[s.type] || '#8B5CF6';
                                  return (
                                    <div key={s.id} style={{
                                      display: 'flex', alignItems: 'center', gap: 10,
                                      padding: '10px 12px', borderRadius: 10,
                                      background: 'var(--bg-elevated)',
                                      border: '1px solid var(--border-subtle)',
                                      transition: 'all 150ms',
                                    }}
                                    onMouseEnter={e => { e.currentTarget.style.borderColor = `${tc}30`; e.currentTarget.style.background = `${tc}06`; }}
                                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.background = 'var(--bg-elevated)'; }}>
                                      {/* Type dot */}
                                      <div style={{ width: 32, height: 32, borderRadius: 8, background: `${tc}12`, border: `1px solid ${tc}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: tc }} />
                                      </div>
                                      {/* Info */}
                                      <div style={{ flex: 1, minWidth: 0 }}>
                                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', fontFamily: "'Inter', sans-serif", display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.title}</span>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                                          <span style={{ fontSize: 9, fontWeight: 600, color: tc, fontFamily: "'Inter Tight', sans-serif" }}>{typeLabels[s.type] || 'Otro'}</span>
                                          <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>·</span>
                                          <span style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-muted)', fontFamily: "'Inter', sans-serif" }}>{s.durationMinutes} min</span>
                                        </div>
                                      </div>
                                      {/* Delete */}
                                      <button onClick={(e) => { e.stopPropagation(); deletePlannedSession(s.id); }}
                                        style={{ width: 26, height: 26, borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 150ms', flexShrink: 0 }}
                                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; e.currentTarget.style.color = '#EF4444'; }}
                                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}>
                                        <Trash2 size={12} />
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                )}

                {/* ══ INLINE EDIT MODAL OVERLAY ══ */}
                {inlineEditGroupId && (() => {
                  const editingGroup = groups.find(g => g.id === inlineEditGroupId);
                  if (!editingGroup) return null;
                  return (
                    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      onClick={e => { if (e.target === e.currentTarget) setInlineEditGroupId(null); }}>
                      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }} />
                      <div style={{ position: 'relative', width: 440, background: 'var(--bg-surface)', borderRadius: 16, border: '1px solid var(--border-subtle)', boxShadow: '0 24px 64px rgba(0,0,0,0.4)', padding: 0, overflow: 'hidden' }} className="bento-card">
                        {/* Header */}
                        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', fontFamily: "'Inter Tight', sans-serif" }}>Editar agrupacion</h3>
                          <button onClick={() => setInlineEditGroupId(null)}
                            style={{ width: 28, height: 28, borderRadius: 7, border: 'none', background: 'var(--bg-hover)', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 150ms' }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.12)'; e.currentTarget.style.color = '#EF4444'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-muted)'; }}>
                            <X size={14} />
                          </button>
                        </div>

                        {/* Body */}
                        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                          {/* Name */}
                          <div>
                            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6, display: 'block', fontFamily: "'Inter Tight', sans-serif" }}>Nombre</label>
                            <input value={inlineGroupName} onChange={e => setInlineGroupName(e.target.value)} placeholder="Nombre de la agrupacion"
                              style={{ width: '100%', height: 40, borderRadius: 10, padding: '0 14px', fontSize: 13, fontWeight: 500, border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box', fontFamily: "'Inter', sans-serif", transition: 'border-color 150ms' }}
                              onFocus={e => { e.currentTarget.style.borderColor = `${course.color}60`; }}
                              onBlur={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; }} />
                          </div>

                          {/* Banner */}
                          <div>
                            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6, display: 'block', fontFamily: "'Inter Tight', sans-serif" }}>Banner</label>
                            {inlineGroupCover ? (
                              <div style={{ position: 'relative', width: '100%', height: 100, borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border-subtle)' }}>
                                <img src={inlineGroupCover} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                <button onClick={() => setInlineGroupCover(undefined)}
                                  style={{ position: 'absolute', top: 8, right: 8, width: 24, height: 24, borderRadius: 7, background: 'rgba(239,68,68,0.85)', backdropFilter: 'blur(4px)', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 150ms' }}
                                  onMouseEnter={e => { e.currentTarget.style.background = '#EF4444'; }}
                                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.85)'; }}>
                                  <X size={12} />
                                </button>
                              </div>
                            ) : (
                              <button onClick={() => groupCoverInputInlineRef.current?.click()}
                                style={{ width: '100%', height: 80, borderRadius: 10, border: '1px dashed var(--border-subtle)', background: 'var(--bg-elevated)', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, color: 'var(--text-muted)', transition: 'all 150ms', fontSize: 12, fontWeight: 500 }}
                                onMouseEnter={e => { e.currentTarget.style.borderColor = `${course.color}50`; e.currentTarget.style.background = `${course.color}08`; }}
                                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.background = 'var(--bg-elevated)'; }}>
                                <Upload size={16} />
                                <span>Subir imagen de portada</span>
                              </button>
                            )}
                            <input type="file" ref={groupCoverInputInlineRef} style={{ display: 'none' }} accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) { const r = new FileReader(); r.onload = ev => setInlineGroupCover(ev.target?.result as string); r.readAsDataURL(f); } }} />
                          </div>
                        </div>

                        {/* Footer */}
                        <div style={{ padding: '16px 24px 20px', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <button onClick={() => setConfirmDeleteGroupId(inlineEditGroupId)}
                            style={{ height: 36, borderRadius: 8, border: '1px solid rgba(239,68,68,0.25)', background: 'rgba(239,68,68,0.06)', color: '#EF4444', fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: '0 14px', display: 'flex', alignItems: 'center', gap: 6, transition: 'all 150ms', fontFamily: "'Inter', sans-serif" }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.12)'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.06)'; }}>
                            <Trash2 size={13} /> Eliminar
                          </button>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button onClick={() => setInlineEditGroupId(null)}
                              style={{ height: 36, borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 12, fontWeight: 500, cursor: 'pointer', padding: '0 16px', transition: 'all 150ms', fontFamily: "'Inter', sans-serif" }}
                              onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
                              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
                              Cancelar
                            </button>
                            <button onClick={() => {
                              if (inlineGroupName.trim()) {
                                const currentGroups = course.groups || [];
                                updateCourse(course.id, { groups: currentGroups.map(g => g.id === inlineEditGroupId ? { ...g, name: inlineGroupName.trim(), image: inlineGroupCover } : g) });
                                toast.success('Agrupacion actualizada');
                              }
                              setInlineEditGroupId(null);
                            }}
                              style={{ height: 36, borderRadius: 8, border: 'none', background: inlineGroupName.trim() ? course.color : 'var(--bg-hover)', color: inlineGroupName.trim() ? '#fff' : 'var(--text-muted)', fontSize: 12, fontWeight: 600, cursor: inlineGroupName.trim() ? 'pointer' : 'default', padding: '0 20px', transition: 'all 150ms', fontFamily: "'Inter', sans-serif" }}
                              onMouseEnter={e => { if (inlineGroupName.trim()) e.currentTarget.style.opacity = '0.9'; }}
                              onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}>
                              Guardar
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* ══ DELETE CONFIRMATION DIALOG ══ */}
                {confirmDeleteGroupId && (() => {
                  const delGroup = groups.find(g => g.id === confirmDeleteGroupId);
                  const delCount = parsedTopics.filter(t => t.groupId === confirmDeleteGroupId).length;
                  return (
                    <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      onClick={e => { if (e.target === e.currentTarget) setConfirmDeleteGroupId(null); }}>
                      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }} />
                      <div style={{ position: 'relative', width: 380, background: 'var(--bg-surface)', borderRadius: 16, border: '1px solid var(--border-subtle)', boxShadow: '0 24px 64px rgba(0,0,0,0.5)', overflow: 'hidden' }} className="bento-card">
                        <div style={{ padding: '24px 24px 16px', textAlign: 'center' }}>
                          <div style={{ width: 48, height: 48, borderRadius: 14, background: 'rgba(239,68,68,0.1)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
                            <AlertTriangle size={24} style={{ color: '#EF4444' }} />
                          </div>
                          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', fontFamily: "'Inter Tight', sans-serif" }}>Eliminar agrupacion</h3>
                          {delGroup && <p style={{ margin: '8px 0 0', fontSize: 13, color: 'var(--text-secondary)', fontFamily: "'Inter', sans-serif" }}>"{delGroup.name}" sera eliminada</p>}
                          {delCount > 0 && <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>{delCount} tema{delCount !== 1 ? 's' : ''} se desvincular{delCount !== 1 ? 'an' : 'a'}</p>}
                        </div>
                        <div style={{ padding: '12px 24px 24px', display: 'flex', gap: 10, justifyContent: 'center' }}>
                          <button onClick={() => setConfirmDeleteGroupId(null)}
                            style={{ height: 38, borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 13, fontWeight: 500, cursor: 'pointer', padding: '0 20px', transition: 'all 150ms', fontFamily: "'Inter', sans-serif" }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
                            Cancelar
                          </button>
                          <button onClick={() => { handleDeleteGroup(confirmDeleteGroupId); setConfirmDeleteGroupId(null); if (inlineEditGroupId === confirmDeleteGroupId) setInlineEditGroupId(null); }}
                            style={{ height: 38, borderRadius: 8, border: 'none', background: '#EF4444', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: '0 20px', transition: 'all 150ms', fontFamily: "'Inter', sans-serif" }}
                            onMouseEnter={e => { e.currentTarget.style.opacity = '0.9'; }}
                            onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}>
                            Eliminar
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })()}
                </>
              )
            )
            }
            </div>
          </div>
        ) : activeTab === 'tareas' ? (
          /* ─── TAREAS TAB ─── */
            <div style={{ maxWidth: 800, margin: '0 auto', padding: '20px 24px 60px' }}>
            {/* Create task card */}
            <div className="bento-card" style={{ borderRadius: 10, border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', overflow: 'hidden', marginBottom: 20, padding: 0, boxShadow: '0 1px 8px rgba(0,0,0,0.04)' }}>
              <div style={{ padding: '14px 16px' }}>
                <input value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)} placeholder="Nombre de la tarea"
                  style={{ width: '100%', border: 'none', borderBottom: 'none', height: 'auto', padding: '2px 0', fontSize: 16, fontWeight: 600, background: 'transparent', color: 'var(--text-primary)', outline: 'none', fontFamily: "'Inter Tight', sans-serif", borderRadius: 0, letterSpacing: '-0.02em' }}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) handleAddTask(); }} />
                <div style={{ padding: '0 0', margin: '6px 0' }}>
                  <div style={{ height: 1, background: `linear-gradient(to right, transparent, ${course.color}30, transparent)` }} />
                </div>
                <textarea value={newTaskDescription} onChange={e => setNewTaskDescription(e.target.value)} placeholder="Descripción (opcional)"
                  rows={1} style={{ width: '100%', border: 'none', padding: 0, fontSize: 12, color: 'var(--text-tertiary)', background: 'transparent', outline: 'none', resize: 'none', fontFamily: "'Inter', sans-serif", overflow: 'hidden', lineHeight: 1.6 }}
                  onInput={e => { const t = e.currentTarget; t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px'; }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 12 }}>
                  <input type="date" value={newTaskDueDate} onChange={e => setNewTaskDueDate(e.target.value)}
                    style={{ height: 42, borderRadius: 8, border: selectBorder, background: newTaskDueDate ? `${course.color}08` : 'var(--bg-surface)', color: newTaskDueDate ? course.color : 'var(--text-tertiary)', padding: '0 14px', cursor: 'pointer', fontSize: 13, fontWeight: 500, fontFamily: "'Inter Tight', sans-serif", outline: 'none', width: 170, minWidth: 170, boxSizing: 'border-box' }} />
                  <select value={newTaskPriority} onChange={e => setNewTaskPriority(e.target.value as any)}
                    style={{ height: 40, borderRadius: 8, border: selectBorder, background: newTaskPriority !== 'none' ? `${({ high: '#EF4444', medium: '#F59E0B', low: '#10B981' })[newTaskPriority]}18` : 'var(--bg-surface)', color: newTaskPriority !== 'none' ? ({ high: '#EF4444', medium: '#F59E0B', low: '#10B981' })[newTaskPriority] : 'var(--text-tertiary)', padding: '0 28px 0 12px', cursor: 'pointer', fontSize: 12, fontWeight: 500, fontFamily: "'Inter Tight', sans-serif", outline: 'none', width: 120, minWidth: 120, boxSizing: 'border-box' }}>
                    <option value="none">Sin prioridad</option>
                    <option value="high">Alta</option>
                    <option value="medium">Media</option>
                    <option value="low">Baja</option>
                  </select>
                  <div style={{ flex: 1 }} />
                  <button onClick={handleAddTask} disabled={!newTaskTitle.trim()}
                    style={{ width: 40, height: 40, borderRadius: 10, border: `1.5px solid ${newTaskTitle.trim() ? course.color : 'var(--border-subtle)'}`, background: 'transparent', color: newTaskTitle.trim() ? course.color : 'var(--text-muted)', cursor: newTaskTitle.trim() ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 200ms ' + EASE }}
                    title="Añadir tarea">
                    <PlusCircle size={20} />
                  </button>
                </div>
              </div>
            </div>
            {/* Task list header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 12 }}>
              <div style={{ height: 1, flex: 1, background: `linear-gradient(to right, transparent, ${course.color}25)` }} />
              <h3 style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: "'Inter Tight', sans-serif" }}>Tareas académicas</h3>
              <div style={{ height: 1, flex: 1, background: `linear-gradient(to left, transparent, ${course.color}25)` }} />
            </div>
            {/* Task list */}
            {pendingTasks.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {pendingTasks.map((task, idx) => {
                  const priorityColors: Record<string, string> = { high: '#EF4444', medium: '#F59E0B', low: '#10B981' };
                  const priorityLabels: Record<string, string> = { high: 'Alta', medium: 'Media', low: 'Baja' };
                  const descPreview = (task.notes || '').replace(/<[^>]+>/g, '').trim().slice(0, 45);
                  let dueDisplay = ''; let isOverdue = false;
                  if (task.dueDate) {
                    const dueStr = task.dueDate.split('T')[0];
                    const today = new Date(); today.setHours(0,0,0,0);
                    const due = new Date(dueStr + 'T12:00:00');
                    const day = due.getDate().toString().padStart(2, '0');
                    const month = (due.getMonth() + 1).toString().padStart(2, '0');
                    const year = due.getFullYear();
                    dueDisplay = `${day}/${month}/${year}`;
                    isOverdue = Math.ceil((due.getTime() - today.getTime()) / (1000*60*60*24)) < 0;
                  }
                  return (
                    <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10, border: '1px solid var(--border-subtle)', borderLeft: task.priority !== 'none' && task.priority ? `3px solid ${priorityColors[task.priority]}` : '3px solid transparent', background: 'var(--bg-elevated-alpha, var(--bg-elevated))', transition: 'all 200ms ' + EASE, boxShadow: '0 0 0 0 rgba(0,0,0,0)' }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = `${course.color}30`; e.currentTarget.style.boxShadow = `0 2px 10px ${course.color}08`; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.boxShadow = '0 0 0 0 rgba(0,0,0,0)'; }}>
                      <span style={{ fontSize: 9, fontWeight: 500, color: 'var(--text-tertiary)', minWidth: 14, textAlign: 'right', flexShrink: 0, fontFamily: "'Inter Tight', sans-serif" }}>{idx + 1}</span>
                      <div onClick={() => handleToggleTask(task.id)} style={{ width: 20, height: 20, borderRadius: 6, flexShrink: 0, cursor: 'pointer', border: `1.5px solid ${task.status === 'progreso' ? '#3B82F6' : task.status === 'completado' ? '#10B981' : `${course.color}40`}`, background: task.status === 'progreso' ? '#3B82F6' : task.status === 'completado' ? '#10B981' : `${course.color}08`, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 200ms ' + EASE }}>
                        {task.status === 'completado' && <Check size={11} strokeWidth={2.5} color="#fff" />}
                        {task.status === 'progreso' && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff' }} />}
                        {task.status === 'inicio' && <div style={{ width: 6, height: 6, borderRadius: '50%', background: course.color, opacity: 0.4 }} />}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: "'Inter', sans-serif" }}>{task.title}</div>
                        {descPreview && <div style={{ fontSize: 10, color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 1 }}>{descPreview}</div>}
                      </div>
                      <div style={{ width: 52, flexShrink: 0, textAlign: 'center' }}>
                        {task.priority !== 'none' && task.priority && (
                          <span style={{ fontSize: 8, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: `${priorityColors[task.priority]}20`, color: priorityColors[task.priority], textTransform: 'uppercase', letterSpacing: '0.03em', fontFamily: "'Inter Tight', sans-serif", whiteSpace: 'nowrap' }}>{priorityLabels[task.priority]}</span>
                        )}
                      </div>
                      <div style={{ width: 100, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
                        {dueDisplay && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 500, color: isOverdue ? '#EF4444' : 'var(--text-secondary)', fontFamily: "'Inter Tight', sans-serif", whiteSpace: 'nowrap' }}>
                            <LI.Calendar size={12} style={{ opacity: 0.5, flexShrink: 0 }} />
                            {dueDisplay}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)', border: '1px dashed var(--border-subtle)', borderRadius: 10 }}>
                <ListTodo size={28} style={{ margin: '0 auto 6px', opacity: 0.3 }} />
                <p style={{ fontSize: 12 }}>Vacío</p>
              </div>
            )}
            {/* Completed tasks */}
            {courseTasks.filter(t => t.status === 'completado').length > 0 && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16, marginBottom: 8 }}>
                  <div style={{ height: 1, flex: 1, background: `linear-gradient(to right, transparent, ${course.color}20)` }} />
                  <h4 style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: "'Inter Tight', sans-serif" }}>Completadas</h4>
                  <div style={{ height: 1, flex: 1, background: `linear-gradient(to left, transparent, ${course.color}20)` }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {courseTasks.filter(t => t.status === 'completado').map((task, idx) => {
                    const isConfirm = pendingTaskDeleteId === task.id;
                    return (
                      <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', borderRadius: 10, border: '1px solid var(--border-subtle)', background: 'var(--bg-surface-alpha, var(--bg-surface))', opacity: 0.7 }}>
                        <Check size={12} style={{ color: '#10B981', flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: "'Inter', sans-serif", textDecoration: 'line-through' }}>{task.title}</div>
                        </div>
                        {isConfirm ? (
                          <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                            <button onClick={() => setPendingTaskDeleteId(null)} style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 9, cursor: 'pointer' }}>Cancelar</button>
                            <button onClick={() => { deleteTask(task.id); setPendingTaskDeleteId(null); toast.success('Tarea eliminada'); }} style={{ padding: '4px 8px', borderRadius: 4, border: 'none', background: '#EF4444', color: '#fff', fontSize: 9, fontWeight: 600, cursor: 'pointer' }}>Eliminar</button>
                          </div>
                        ) : (
                          <button onClick={() => setPendingTaskDeleteId(task.id)} style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid rgba(239,68,68,0.3)', background: 'transparent', color: 'rgba(239,68,68,0.6)', fontSize: 9, cursor: 'pointer', transition: 'all 150ms' }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; e.currentTarget.style.color = '#EF4444'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(239,68,68,0.6)'; }}>
                            <Trash2 size={9} style={{ marginRight: 2, verticalAlign: 'middle' }} /> Eliminar
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        ) : activeTab === 'notas' ? (
          /* ─── APUNTES TAB ─── */
          <div style={{ maxWidth: 800, margin: '0 auto', padding: editingNoteId ? '20px 24px 20px' : '20px 24px 60px' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 3, height: 15, borderRadius: 2, background: course.color, flexShrink: 0 }} />
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: "'Inter Tight', sans-serif" }}>Apuntes</span>
                <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-muted)', background: 'var(--bg-hover)', height: 18, padding: '0 7px', borderRadius: 9, display: 'inline-flex', alignItems: 'center', fontFamily: "'Inter Tight', sans-serif" }}>{courseNotes.length}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {courseNotes.length > 0 && (
                  <>
                    <div style={{ position: 'relative', width: 140 }}>
                      <Search size={11} style={{ position: 'absolute', left: 8, top: '50%', marginTop: -5.5, color: 'var(--text-muted)', pointerEvents: 'none' }} />
                      <input value={notesSearch} onChange={e => setNotesSearch(e.target.value)} placeholder="Buscar..."
                        style={{ width: '100%', height: 28, padding: '0 10px 0 26px', borderRadius: 6, border: '1px solid var(--border-soft)', background: 'var(--bg-deep)', color: 'var(--text-primary)', fontSize: 10, outline: 'none', boxSizing: 'border-box', fontFamily: "'Inter', sans-serif" }} />
                    </div>
                  </>
                )}
                <button onClick={handleCreateNote} disabled={!!editingNoteId}
                  title={editingNoteId ? 'Termina de editar el apunte actual' : 'Nuevo apunte'}
                  style={{ width: 32, height: 32, borderRadius: 8, border: `1.5px solid ${editingNoteId ? 'var(--border-subtle)' : course.color}`, background: 'transparent', color: editingNoteId ? 'var(--text-muted)' : course.color, cursor: editingNoteId ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 200ms ' + EASE, opacity: editingNoteId ? 0.35 : 1 }}
                  onMouseEnter={e => { if (!editingNoteId) { e.currentTarget.style.background = course.color; e.currentTarget.style.color = '#fff'; } }}
                  onMouseLeave={e => { if (!editingNoteId) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = course.color; } }}>
                  <Plus size={14} />
                </button>
              </div>
            </div>
            {(notesSearch ? filteredNotes : sortedNotes).length > 0 ? (
              <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleNoteDragEnd}>
                <SortableContext items={(notesSearch ? filteredNotes : sortedNotes).map(n => n.id)} strategy={rectSortingStrategy}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
                    {(notesSearch ? filteredNotes : sortedNotes).map(n => {
                      const isEditing = editingNoteId === n.id;
                      const handleStartEdit = () => {
                        if (!isEditing && !editingNoteId) {
                          setEditingNoteId(n.id);
                          setEditContent(n.content || '');
                        }
                      };
                      const handleDoneEditing = () => {
                        updateNote(n.id, { content: editContent });
                        setEditingNoteId(null);
                      };
                      return (
                        <SortableWrapper key={n.id} id={n.id}>
                          {({ attributes, listeners, isDragging }) => (
                            <div style={{
                              borderRadius: 16, border: `1px solid ${isEditing ? `${course.color}40` : 'var(--border-subtle)'}`, background: 'var(--bg-elevated-alpha, var(--bg-elevated))', transition: 'all 200ms ' + EASE, cursor: !isEditing && !editingNoteId ? 'pointer' : 'default', boxShadow: isEditing ? `0 4px 24px ${course.color}14` : 'none', minHeight: isEditing ? 'auto' : 140,
                              position: 'relative', opacity: isDragging ? 0.4 : 1,
                            }}
                              onClick={() => { if (!isEditing && !editingNoteId) handleStartEdit(); }}
                              onMouseEnter={e => { if (!isEditing && !editingNoteId) { e.currentTarget.style.borderColor = `${course.color}28`; e.currentTarget.style.background = `${course.color}03`; } }}
                              onMouseLeave={e => { if (!isEditing && !editingNoteId) { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.background = 'var(--bg-elevated-alpha, var(--bg-elevated))'; } }}>
                              {/* Drag handle */}
                              <div {...attributes} {...listeners} style={{
                                position: 'absolute', top: 6, right: 6, width: 22, height: 22,
                                borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: 'var(--text-muted)', cursor: 'grab', opacity: 0,
                                transition: 'opacity 150ms', zIndex: 5,
                              }}
                                onMouseEnter={e => e.currentTarget.style.opacity = '0.6'}
                                onMouseLeave={e => e.currentTarget.style.opacity = '0'}>
                                <GripVertical size={11} />
                              </div>
                              {/* ── NOT EDITING ── */}
                              {!isEditing ? (
                                <div style={{ padding: '28px' }}>
                                  <div style={{ fontSize: 15, lineHeight: 1.8, color: 'var(--text-primary)', fontFamily: "'Atkinson Hyperlegible', system-ui, serif", wordBreak: 'break-word', maxHeight: 360, overflowY: 'auto' }}
                                    dangerouslySetInnerHTML={{ __html: n.content || '<span style="color:var(--text-muted);font-style:italic;font-size:13px">Haz clic para añadir contenido...</span>' }} />
                                </div>
                              ) : (
                                /* ── EDITING ── */
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                  <FormatToolbar onFormat={handleNoteFormat} color={course.color} />
                                  <div ref={editContentRef}
                                    contentEditable
                                    suppressContentEditableWarning
                                    dangerouslySetInnerHTML={{ __html: editContent }}
                                    onInput={(e: React.FormEvent<HTMLDivElement>) => { const html = (e.target as HTMLDivElement).innerHTML; setEditContent(html); if (saveTimerRef.current) clearTimeout(saveTimerRef.current); saveTimerRef.current = setTimeout(() => updateNote(n.id, { content: html }), 800); }}
                                    onBlur={() => { updateNote(n.id, { content: editContent }); }}
                                    style={{ padding: '16px 20px 12px', minHeight: 80, maxHeight: 'calc(100vh - 240px)', overflowY: 'auto', fontSize: 15, lineHeight: 1.9, color: 'var(--text-primary)', background: 'transparent', outline: 'none', fontFamily: "'Atkinson Hyperlegible', system-ui, serif", wordBreak: 'break-word' }} />
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 14px 10px', borderTop: '1px solid var(--border-subtle)', background: `${course.color}04` }}>
                                    <button onClick={() => handleTogglePinNote(n.id)}
                                      style={{ width: 30, height: 30, borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: n.isPinned ? '#F59E0B' : 'var(--text-muted)', transition: 'color 150ms ' + EASE }}
                                      title={n.isPinned ? 'Quitar destacado' : 'Destacar'}>
                                      <Star size={13} fill={n.isPinned ? '#F59E0B' : 'none'} />
                                    </button>
                                    <div style={{ display: 'flex', gap: 4 }}>
                                      <button onClick={() => setConfirmDeleteNoteId(n.id)}
                                        style={{ width: 30, height: 30, borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer', color: 'rgba(239,68,68,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'color 150ms ' + EASE }}
                                        onMouseEnter={e => e.currentTarget.style.color = '#EF4444'}
                                        onMouseLeave={e => e.currentTarget.style.color = 'rgba(239,68,68,0.4)'}
                                        title="Eliminar">
                                        <Trash2 size={13} />
                                      </button>
                                      <button onClick={handleDoneEditing}
                                        style={{ width: 30, height: 30, borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.55, transition: 'opacity 150ms ' + EASE }}
                                        onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                                        onMouseLeave={e => e.currentTarget.style.opacity = '0.55'}
                                        title="Hecho (Esc)">
                                        <ChevronUp size={14} />
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </SortableWrapper>
                      );
                    })}
                  </div>
                </SortableContext>
              </DndContext>
            ) : notesSearch ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
                <Search size={24} style={{ margin: '0 auto 6px', opacity: 0.25 }} />
                <p style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>Sin resultados para "{notesSearch}"</p>
              </div>
            ) : (
              <div onClick={handleCreateNote} style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)', border: '1px dashed var(--border-subtle)', borderRadius: 12, cursor: 'pointer', transition: 'all 200ms ' + EASE }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = `${course.color}30`; e.currentTarget.style.background = `${course.color}04`; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.background = 'transparent'; }}>
                <StickyNote size={26} style={{ margin: '0 auto 6px', opacity: 0.25 }} />
                <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-tertiary)' }}>Nuevo apunte</p>
              </div>
            )}
          </div>
        ) : activeTab === 'archivos' ? (
          /* ─── ARCHIVOS TAB ─── */
          <div style={{ maxWidth: 800, margin: '0 auto', padding: '20px 24px 60px' }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16, fontFamily: "'Inter Tight', sans-serif" }}>Archivos de {course.name}</h2>
            {allCourseMaterials.filter(m => m.type === 'resource').length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10 }}>
                {allCourseMaterials.filter(m => m.type === 'resource').map(mat => (
                  <div key={mat.id} style={{ padding: '12px 14px', borderRadius: 10, border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 8, background: `${course.color}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <File size={16} style={{ color: course.color }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{mat.name || 'Archivo'}</div>
                      <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>{(mat as any)._topicTitle || 'Tema general'}</div>
                    </div>
                    {mat.dataUrl && (
                      <button onClick={() => handleOpenResource(mat)} style={{ width: 28, height: 28, borderRadius: 6, border: 'none', background: 'var(--bg-hover)', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <ExternalLink size={12} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)', border: '1px dashed var(--border-subtle)', borderRadius: 10 }}>
                <FolderOpen size={32} style={{ margin: '0 auto 8px', opacity: 0.3 }} />
                <p style={{ fontSize: 13 }}>No hay archivos subidos en los temas de este curso</p>
                <p style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 4 }}>Los archivos se añaden desde la vista de cada tema</p>
              </div>
            )}
          </div>
        ) : null}
      </div>

      {/* ═══════════ MODALS ═══════════ */}
      {showEditCourse && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }} onClick={() => setShowEditCourse(false)}>
          <div className="bento-card" style={{ width: 400, padding: 22, borderRadius: 12, background: 'var(--bg-surface)', border: '1px solid var(--border-default)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <h3 style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', margin: 0, fontFamily: "'Inter Tight', sans-serif", letterSpacing: '-0.01em' }}>Configurar curso</h3>
              <button onClick={() => setShowEditCourse(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}><X size={15} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <div style={{ fontSize: 7.5, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Nombre</div>
                <input value={editCourseName} onChange={e => setEditCourseName(e.target.value)} placeholder="Nombre del curso"
                  style={{ width: '100%', height: 40, borderRadius: 8, padding: '0 12px', fontSize: 15, fontWeight: 300, fontFamily: "'Inter Tight', sans-serif", border: '1px solid var(--border-soft)', background: 'var(--bg-deep)', color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box', letterSpacing: '-0.01em' }} />
              </div>
              <div>
                <div style={{ fontSize: 7.5, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Profesor</div>
                <input value={editCourseTeacher} onChange={e => setEditCourseTeacher(e.target.value)} placeholder="Nombre del profesor"
                  style={{ width: '100%', height: 38, borderRadius: 8, padding: '0 12px', fontSize: 13, fontWeight: 300, fontFamily: "'Inter Tight', sans-serif", border: '1px solid var(--border-soft)', background: 'var(--bg-deep)', color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box', letterSpacing: '-0.01em' }} />
               </div>
               <div style={{ fontSize: 7.5, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Color</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, background: 'var(--bg-deep)' }}>
                <div style={{ width: 34, height: 34, borderRadius: '50%', background: editCourseColor, flexShrink: 0, border: '2px solid var(--bg-surface)', boxShadow: '0 2px 8px rgba(0,0,0,0.3)', transition: 'background 200ms ' + EASE }} />
                <div style={{ flex: 1, position: 'relative', height: 30, borderRadius: 6, overflow: 'hidden' }}>
                  <div style={{ width: '100%', height: '100%', background: 'linear-gradient(to right, #E11D48, #EC4899, #8B5CF6, #3B82F6, #06B6D4, #10B981, #84CC16, #F59E0B, #F97316)', borderRadius: 6 }} />
                  <input type="color" value={editCourseColor} onChange={e => setEditCourseColor(e.target.value)}
                    style={{ position: 'absolute', top: -4, left: -4, width: 'calc(100% + 8px)', height: 'calc(100% + 8px)', opacity: 0, cursor: 'pointer' }} />
                </div>
                <input value={editCourseColor.toUpperCase()} onChange={e => { const v = e.target.value; if (/^#[0-9A-Fa-f]{6}$/.test(v)) setEditCourseColor(v.toLowerCase()); }} style={{ width: 68, height: 26, borderRadius: 4, padding: '0 6px', fontSize: 9, fontFamily: 'monospace', fontWeight: 600, border: '1px solid var(--border-soft)', background: 'var(--bg-deep)', color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box', textAlign: 'center' }} />
              </div>
              <div style={{ fontSize: 7.5, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Banner</div>
              {editCourseCover ? (
                <div style={{ position: 'relative', width: '100%', aspectRatio: '16/7', borderRadius: 6, overflow: 'hidden' }}>
                  <img src={editCourseCover} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <button onClick={() => setEditCourseCover(undefined)} style={{ position: 'absolute', top: 4, right: 4, width: 20, height: 20, borderRadius: '50%', background: 'rgba(239,68,68,0.9)', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={9} /></button>
                </div>
              ) : (
                <button onClick={() => courseCoverInputRef.current?.click()} style={{ width: '100%', height: 56, borderRadius: 6, border: '1px dashed var(--border-subtle)', background: 'transparent', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, color: 'var(--text-muted)' }}>
                  <Upload size={12} /><span style={{ fontSize: 8, fontWeight: 600, textTransform: 'uppercase' }}>Subir</span>
                </button>
              )}
              <input type="file" ref={courseCoverInputRef} style={{ display: 'none' }} accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) { const r = new FileReader(); r.onload = ev => setEditCourseCover(ev.target?.result as string); r.readAsDataURL(f); }}} />
              <button onClick={handleSaveCourseSettings} style={{ width: '100%', height: 34, borderRadius: 6, border: 'none', background: course.color, color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Guardar</button>
              <div style={{ borderTop: '1px solid var(--border-subtle)', marginTop: 8, paddingTop: 12, display: 'flex', justifyContent: 'center' }}>
                <button onClick={() => { setShowDeleteConfirm(true); setDeleteConfirmName(''); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px', borderRadius: 8, border: '1px solid rgba(239,68,68,0.25)', background: 'transparent', color: 'rgba(239,68,68,0.7)', fontSize: 10, fontWeight: 600, cursor: 'pointer', transition: 'all 150ms', letterSpacing: '0.02em' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.5)'; e.currentTarget.style.color = '#EF4444'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.25)'; e.currentTarget.style.color = 'rgba(239,68,68,0.7)'; }}>
                  <Trash2 size={11} /> Eliminar asignatura
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 2100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }} onClick={() => setShowDeleteConfirm(false)}>
          <div className="bento-card" style={{ width: 380, padding: 24, borderRadius: 14, background: 'var(--bg-surface)', border: '1px solid var(--border-default)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(239,68,68,0.12)' }}>
                <Trash2 size={16} style={{ color: '#EF4444' }} />
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', margin: 0, fontFamily: "'Inter Tight', sans-serif", letterSpacing: '-0.01em' }}>Eliminar asignatura</h3>
                <p style={{ fontSize: 10, color: 'var(--text-tertiary)', margin: '2px 0 0', lineHeight: 1.4 }}>Esta acción no se puede deshacer.</p>
              </div>
              <button onClick={() => setShowDeleteConfirm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}><X size={15} /></button>
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 12 }}>
              Escribe <strong style={{ color: '#EF4444' }}>{course.name}</strong> para confirmar:
            </div>
            <input value={deleteConfirmName} onChange={e => setDeleteConfirmName(e.target.value)} autoFocus
              placeholder="Nombre de la asignatura..."
              style={{ width: '100%', height: 38, borderRadius: 8, padding: '0 12px', fontSize: 12, fontFamily: "'Inter Tight', sans-serif", border: `1px solid ${deleteConfirmName.trim() === course.name ? 'rgba(239,68,68,0.5)' : 'var(--border-soft)'}`, background: 'var(--bg-deep)', color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box', marginBottom: 14 }} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => setShowDeleteConfirm(false)} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border-default)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 11, fontWeight: 500, cursor: 'pointer' }}>Cancelar</button>
              <button onClick={handleConfirmDeleteCourse} disabled={deleteConfirmName.trim() !== course.name}
                style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: deleteConfirmName.trim() === course.name ? '#EF4444' : 'var(--bg-hover)', color: deleteConfirmName.trim() === course.name ? '#fff' : 'var(--text-muted)', fontSize: 11, fontWeight: 600, cursor: deleteConfirmName.trim() === course.name ? 'pointer' : 'default', transition: 'all 150ms', display: 'flex', alignItems: 'center', gap: 5 }}>
                <Trash2 size={11} /> Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
      {showTopicModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={e => { if (e.target === e.currentTarget) setShowTopicModal(false); }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }} />
          <div className="bento-card" style={{ position: 'relative', width: 400, background: 'var(--bg-surface)', borderRadius: 16, border: '1px solid var(--border-subtle)', boxShadow: '0 24px 64px rgba(0,0,0,0.5)', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: `${course.color}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${course.color}20` }}>
                  <Book size={14} style={{ color: course.color }} />
                </div>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: 0, fontFamily: "'Inter Tight', sans-serif" }}>{editingTopicId ? 'Editar' : 'Nuevo'} Tema</h3>
              </div>
              <button onClick={() => setShowTopicModal(false)}
                style={{ width: 28, height: 28, borderRadius: 7, border: 'none', background: 'var(--bg-hover)', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 150ms' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; e.currentTarget.style.color = '#EF4444'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-muted)'; }}>
                <X size={14} />
              </button>
            </div>
            <div style={{ padding: '18px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 6, letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: "'Inter Tight', sans-serif" }}>Nombre</label>
                <input value={topicName} onChange={e => setTopicName(e.target.value)} placeholder="Ej: Capitulo 1 - Introduccion" autoFocus
                  style={{ width: '100%', height: 40, borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--bg-deep)', color: 'var(--text-primary)', padding: '0 12px', fontSize: 13, outline: 'none', fontFamily: "'Inter', sans-serif", transition: 'border-color 150ms' }}
                  onFocus={e => { e.currentTarget.style.borderColor = `${course.color}60`; }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; }}
                  onKeyDown={e => { if (e.key === 'Enter' && topicName.trim()) handleAddTopic(); }} />
              </div>
            </div>
            <div style={{ padding: '12px 24px 18px', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowTopicModal(false)}
                style={{ height: 36, borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 12, fontWeight: 500, cursor: 'pointer', padding: '0 16px', transition: 'all 150ms', fontFamily: "'Inter', sans-serif" }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
                Cancelar
              </button>
              <button onClick={handleAddTopic} disabled={!topicName.trim()}
                style={{ height: 36, borderRadius: 8, border: 'none', background: topicName.trim() ? course.color : 'var(--bg-hover)', color: topicName.trim() ? '#fff' : 'var(--text-muted)', fontSize: 12, fontWeight: 600, cursor: topicName.trim() ? 'pointer' : 'default', padding: '0 20px', transition: 'all 150ms', fontFamily: "'Inter', sans-serif" }}
                onMouseEnter={e => { if (topicName.trim()) e.currentTarget.style.opacity = '0.9'; }}
                onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}>
                {editingTopicId ? 'Guardar' : 'Crear'}
              </button>
            </div>
          </div>
        </div>
      )}
      {showGroupModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={e => { if (e.target === e.currentTarget) setShowGroupModal(false); }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }} />
          <div className="bento-card" style={{ position: 'relative', width: 440, maxHeight: '80vh', background: 'var(--bg-surface)', borderRadius: 16, border: '1px solid var(--border-subtle)', boxShadow: '0 24px 64px rgba(0,0,0,0.5)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: `${course.color}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${course.color}20` }}>
                  <Layers size={14} style={{ color: course.color }} />
                </div>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: 0, fontFamily: "'Inter Tight', sans-serif" }}>{editingGroupId ? 'Editar' : 'Nueva'} Agrupacion</h3>
              </div>
              <button onClick={() => setShowGroupModal(false)}
                style={{ width: 28, height: 28, borderRadius: 7, border: 'none', background: 'var(--bg-hover)', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 150ms' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; e.currentTarget.style.color = '#EF4444'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-muted)'; }}>
                <X size={14} />
              </button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '18px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 6, letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: "'Inter Tight', sans-serif" }}>Nombre</label>
                <input value={groupName} onChange={e => setGroupName(e.target.value)} placeholder="Ej: Unidad 1 - Fundamentos"
                  style={{ width: '100%', height: 40, borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--bg-deep)', color: 'var(--text-primary)', padding: '0 12px', fontSize: 13, outline: 'none', fontFamily: "'Inter', sans-serif", transition: 'border-color 150ms' }}
                  onFocus={e => { e.currentTarget.style.borderColor = `${course.color}60`; }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 6, letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: "'Inter Tight', sans-serif" }}>Banner</label>
                {groupCover ? (
                  <div style={{ position: 'relative', width: '100%', height: 100, borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border-subtle)' }}>
                    <img src={groupCover} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <button onClick={() => setGroupCover(undefined)}
                      style={{ position: 'absolute', top: 8, right: 8, width: 24, height: 24, borderRadius: 7, background: 'rgba(239,68,68,0.85)', backdropFilter: 'blur(4px)', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 150ms' }}
                      onMouseEnter={e => { e.currentTarget.style.background = '#EF4444'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.85)'; }}>
                      <X size={12} />
                    </button>
                  </div>
                ) : (
                  <button onClick={() => groupCoverInputRef.current?.click()}
                    style={{ width: '100%', height: 80, borderRadius: 10, border: '1px dashed var(--border-subtle)', background: 'var(--bg-elevated)', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, color: 'var(--text-muted)', transition: 'all 150ms', fontSize: 12, fontWeight: 500, fontFamily: "'Inter', sans-serif" }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = `${course.color}50`; e.currentTarget.style.background = `${course.color}08`; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.background = 'var(--bg-elevated)'; }}>
                    <Upload size={16} />
                    <span>Subir imagen de portada</span>
                  </button>
                )}
                <input type="file" ref={groupCoverInputRef} style={{ display: 'none' }} accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) { const r = new FileReader(); r.onload = ev => setGroupCover(ev.target?.result as string); r.readAsDataURL(f); } }} />
              </div>
            </div>
            <div style={{ padding: '12px 24px 18px', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', flexShrink: 0, gap: 8 }}>
                <button onClick={() => setShowGroupModal(false)}
                  style={{ height: 36, borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 12, fontWeight: 500, cursor: 'pointer', padding: '0 16px', transition: 'all 150ms', fontFamily: "'Inter', sans-serif" }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
                  Cancelar
                </button>
                <button onClick={handleSaveGroup} disabled={!groupName.trim()}
                  style={{ height: 36, borderRadius: 8, border: 'none', background: groupName.trim() ? course.color : 'var(--bg-hover)', color: groupName.trim() ? '#fff' : 'var(--text-muted)', fontSize: 12, fontWeight: 600, cursor: groupName.trim() ? 'pointer' : 'default', padding: '0 20px', transition: 'all 150ms', fontFamily: "'Inter', sans-serif" }}
                  onMouseEnter={e => { if (groupName.trim()) e.currentTarget.style.opacity = '0.9'; }}
                  onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}>
                  {editingGroupId ? 'Guardar' : 'Crear'}
                </button>
              </div>
          </div>
        </div>
      )}
      {/* Agrupacion Import/Export Modal */}
      {showAgrupacionImportExport && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={e => { if (e.target === e.currentTarget) { setShowAgrupacionImportExport(false); setImportPreviewData(null); } }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }} />
          <div className="bento-card" style={{ position: 'relative', width: 420, maxHeight: '80vh', background: 'var(--bg-surface)', borderRadius: 16, border: '1px solid var(--border-subtle)', boxShadow: '0 24px 64px rgba(0,0,0,0.5)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: `${course.color}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${course.color}20` }}>
                  {importPreviewData ? <FileUp size={14} style={{ color: course.color }} /> : importExportMode === 'choose' ? <Package size={14} style={{ color: course.color }} /> : importExportMode === 'import' ? <FileUp size={14} style={{ color: course.color }} /> : <FileDown size={14} style={{ color: course.color }} />}
                </div>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: 0, fontFamily: "'Inter Tight', sans-serif" }}>{importPreviewData ? 'Vista previa de importacion' : importExportMode === 'choose' ? 'Importar / Exportar' : importExportMode === 'import' ? 'Importar temas' : 'Exportar temas'}</h3>
              </div>
              <button onClick={() => { setShowAgrupacionImportExport(false); setImportPreviewData(null); }}
                style={{ width: 28, height: 28, borderRadius: 7, border: 'none', background: 'var(--bg-hover)', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 150ms' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; e.currentTarget.style.color = '#EF4444'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-muted)'; }}>
                <X size={14} />
              </button>
            </div>
            <div style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 12, flexShrink: 0, overflowY: 'auto', maxHeight: 'calc(80vh - 70px)' }} className="no-scrollbar">
              {importPreviewData ? (
                <>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '0 0 4px' }}>Selecciona los temas que deseas importar.</p>
                  {!selectedGroupId && groups.length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, background: 'var(--bg-deep)', border: '1px solid var(--border-subtle)' }}>
                      <Layers size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                      <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0 }}>Destino:</span>
                      <select value={importTargetGroupId || ''} onChange={e => setImportTargetGroupId(e.target.value)}
                        style={{ flex: 1, height: 26, borderRadius: 6, border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', fontSize: 11, fontWeight: 500, padding: '0 8px', outline: 'none', cursor: 'pointer' }}>
                        {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                      </select>
                    </div>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 320, overflowY: 'auto' }} className="no-scrollbar">
                    {importPreviewData.map((item, gi) => {
                      const allSelected = item.topics.every((_, ti) => importSelected[gi]?.[ti]);
                      const someSelected = item.topics.some((_, ti) => importSelected[gi]?.[ti]);
                      return (
                        <div key={gi} style={{ borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--bg-deep)', overflow: 'hidden' }}>
                          <div
                            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', cursor: 'pointer', transition: 'all 150ms', background: allSelected ? `${course.color}08` : 'transparent' }}
                            onClick={() => {
                              const next = importSelected.map((row: boolean[]) => row ? [...row] : []);
                              const newVal = !allSelected;
                              next[gi] = item.topics.map(() => newVal);
                              setImportSelected(next);
                            }}>
                            <div style={{ width: 16, height: 16, borderRadius: 5, border: `2px solid ${allSelected ? course.color : someSelected ? `${course.color}60` : 'var(--text-muted)'}`, background: allSelected ? course.color : someSelected ? `${course.color}30` : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 150ms' }}>
                              {allSelected && <Check size={10} style={{ color: '#fff', strokeWidth: 3 }} />}
                              {!allSelected && someSelected && <div style={{ width: 6, height: 2, borderRadius: 1, background: '#fff' }} />}
                            </div>
                            <Layers size={12} style={{ color: 'var(--text-muted)', opacity: 0.5 }} />
                            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', fontFamily: "'Inter Tight', sans-serif", flex: 1 }}>{item.group.name}</span>
                            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{item.topics.length} tema{item.topics.length !== 1 ? 's' : ''}</span>
                          </div>
                          <div style={{ borderTop: '1px solid var(--border-subtle)', padding: '4px 8px' }}>
                            {item.topics.map((topic: any, ti: number) => {
                              const checked = importSelected[gi]?.[ti] ?? false;
                              return (
                                <div key={ti}
                                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 6, cursor: 'pointer', transition: 'all 150ms', background: checked ? `${course.color}08` : 'transparent' }}
                                  onClick={() => {
                                    const next = importSelected.map((row: boolean[]) => row ? [...row] : []);
                                    if (!next[gi]) next[gi] = [];
                                    next[gi][ti] = !checked;
                                    setImportSelected(next);
                                  }}>
                                  <div style={{ width: 14, height: 14, borderRadius: 4, border: `2px solid ${checked ? course.color : 'var(--text-muted)'}`, background: checked ? course.color : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 150ms' }}>
                                    {checked && <Check size={8} style={{ color: '#fff', strokeWidth: 3 }} />}
                                  </div>
                                  <Book size={10} style={{ color: 'var(--text-muted)', opacity: 0.5 }} />
                                  <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 500 }}>{topic.title || 'Sin titulo'}</span>
                                  {topic.materials?.length > 0 && <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>{topic.materials.length} material{topic.materials.length !== 1 ? 'es' : ''}</span>}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                    <button onClick={() => { setImportPreviewData(null); setImportSelected([]); setImportExportMode('choose'); }}
                      style={{ flex: 1, height: 34, borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', color: 'var(--text-secondary)', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: "'Inter', sans-serif", transition: 'all 150ms' }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-elevated)'; }}>
                      Volver
                    </button>
                    <button onClick={() => {
                      if (!importPreviewData) return;
                      const totalSelectedTopics = importSelected.reduce((sum, row) => sum + (row?.filter(Boolean).length || 0), 0);
                      if (totalSelectedTopics === 0) { toast.error('Selecciona al menos un tema'); return; }
                      const currentTopics = course.studyTopics || [];
                      const newTopics = [...currentTopics];
                      let importedCount = 0;
                      importPreviewData.forEach((data, gi) => {
                        const selectedTopics = data.topics.filter((_: any, ti: number) => importSelected[gi]?.[ti]);
                        selectedTopics.forEach((t: any) => {
                          newTopics.push({ id: Math.random().toString(), title: t.title || 'Sin titulo', status: t.status || 'pending', createdAt: Date.now(), reviewLevel: t.reviewLevel || 0, nextReview: Date.now(), groupId: selectedGroupId || importTargetGroupId || (groups[0]?.id || ''), materials: t.materials || [] });
                          importedCount++;
                        });
                      });
                      updateCourse(course.id, { studyTopics: newTopics });
                      setShowAgrupacionImportExport(false);
                      setImportPreviewData(null);
                      setImportSelected([]);
                      toast.success(`${importedCount} tema${importedCount !== 1 ? 's' : ''} importado${importedCount !== 1 ? 's' : ''} en esta agrupacion`);
                    }}
                      style={{ flex: 1, height: 34, borderRadius: 8, border: 'none', background: course.color, color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: "'Inter', sans-serif", transition: 'all 150ms', boxShadow: `0 2px 8px ${course.color}35` }}
                      onMouseEnter={e => { e.currentTarget.style.opacity = '0.88'; }}
                      onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}>
                      Importar {importSelected.reduce((sum, row) => sum + (row?.filter(Boolean).length || 0), 0) > 0 ? `(${importSelected.reduce((sum, row) => sum + (row?.filter(Boolean).length || 0), 0)})` : ''}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {importExportMode === 'choose' ? (
                    /* ══ CHOOSE: Two Elegant Blocks ══ */
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '8px 0' }}>
                      <button onClick={() => setImportExportMode('import')}
                        style={{ display: 'flex', alignItems: 'center', gap: 14, width: '100%', padding: '16px 18px', borderRadius: 10, border: '1px solid var(--border-subtle)', background: 'var(--bg-deep)', cursor: 'pointer', textAlign: 'left', transition: 'all 200ms ' + EASE }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = `${course.color}40`; e.currentTarget.style.background = `${course.color}06`; e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = `0 4px 16px ${course.color}12`; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.background = 'var(--bg-deep)'; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}>
                        <div style={{ width: 40, height: 40, borderRadius: 10, background: `${course.color}12`, border: `1px solid ${course.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <FileUp size={18} style={{ color: course.color }} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', fontFamily: "'Inter Tight', sans-serif", marginBottom: 2 }}>Importar</div>
                          <div style={{ fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.4 }}>Cargar temas desde un archivo JSON exportado</div>
                        </div>
                        <ChevronRight size={14} style={{ color: 'var(--text-muted)', opacity: 0.4 }} />
                      </button>
                      <button onClick={() => setImportExportMode('export')}
                        style={{ display: 'flex', alignItems: 'center', gap: 14, width: '100%', padding: '16px 18px', borderRadius: 10, border: '1px solid var(--border-subtle)', background: 'var(--bg-deep)', cursor: 'pointer', textAlign: 'left', transition: 'all 200ms ' + EASE }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = `${course.color}40`; e.currentTarget.style.background = `${course.color}06`; e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = `0 4px 16px ${course.color}12`; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.background = 'var(--bg-deep)'; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}>
                        <div style={{ width: 40, height: 40, borderRadius: 10, background: `${course.color}12`, border: `1px solid ${course.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <FileDown size={18} style={{ color: course.color }} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', fontFamily: "'Inter Tight', sans-serif", marginBottom: 2 }}>Exportar</div>
                          <div style={{ fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.4 }}>Exportar temas de las agrupaciones a un archivo JSON</div>
                        </div>
                        <ChevronRight size={14} style={{ color: 'var(--text-muted)', opacity: 0.4 }} />
                      </button>
                    </div>
                  ) : importExportMode === 'export' ? (
                    /* ══ EXPORT ══ */
                    <div>
                      <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '0 0 10px' }}>Selecciona las agrupaciones cuyos temas deseas exportar.</p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 200, overflowY: 'auto' }} className="no-scrollbar">
                        {groups.length === 0 ? (
                          <span style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', padding: 12 }}>No hay agrupaciones</span>
                        ) : groups.map(g => {
                          const count = parsedTopics.filter(t => t.groupId === g.id).length;
                          const isSelected = exportSelectedIds.has(g.id);
                          return (
                            <div key={g.id}
                              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, cursor: 'pointer', transition: 'all 150ms', background: isSelected ? `${course.color}08` : 'transparent', border: `1px solid ${isSelected ? `${course.color}25` : 'var(--border-subtle)'}` }}
                              onClick={() => { const next = new Set(exportSelectedIds); if (isSelected) next.delete(g.id); else next.add(g.id); setExportSelectedIds(next); }}>
                              <div style={{ width: 16, height: 16, borderRadius: 5, border: `2px solid ${isSelected ? course.color : 'var(--text-muted)'}`, background: isSelected ? course.color : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 150ms' }}>
                                {isSelected && <Check size={10} style={{ color: '#fff', strokeWidth: 3 }} />}
                              </div>
                              <span style={{ flex: 1, fontSize: 12, color: 'var(--text-primary)', fontWeight: 500 }}>{g.name}</span>
                              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{count} tema{count !== 1 ? 's' : ''}</span>
                            </div>
                          );
                        })}
                      </div>
                      {groups.length > 0 && (
                        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                          <button onClick={() => setImportExportMode('choose')}
                            style={{ flex: 1, height: 34, borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', color: 'var(--text-secondary)', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: "'Inter', sans-serif", transition: 'all 150ms' }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-elevated)'; }}>
                            Volver
                          </button>
                          <button onClick={async () => {
                            const selected = groups.filter(g => exportSelectedIds.has(g.id));
                            if (selected.length === 0) { toast.error('Selecciona al menos una agrupacion'); return; }
                            try {
                              const dest = await save({ filters: [{ name: 'JSON', extensions: ['json'] }], defaultPath: `${selected.length === 1 ? selected[0].name.replace(/[^a-zA-Z0-9]/g, '_') : 'agrupaciones'}_export.json`, title: 'Exportar temas' });
                              if (!dest) return;
                              const exportData = selected.map(g => {
                                const gTopics = parsedTopics.filter(t => t.groupId === g.id);
                                return { group: { name: g.name, image: g.image }, topics: gTopics.map(t => ({ title: t.title, status: t.status, reviewLevel: t.reviewLevel, materials: (t.materials || []).map(m => ({ ...m, dataUrl: m.dataUrl && m.dataUrl.startsWith('data:') ? '[BASE64_DATA]' : m.dataUrl })) })) };
                              });
                              await writeTextFile(dest, JSON.stringify(exportData.length === 1 ? exportData[0] : exportData, null, 2));
                              toast.success(`${selected.length} agrupacion${selected.length !== 1 ? 'es' : ''} exportada${selected.length !== 1 ? 's' : ''}`);
                              setShowAgrupacionImportExport(false);
                            } catch (err) { console.error('Export error:', err); toast.error('Error al exportar'); }
                          }}
                            style={{ flex: 1, height: 34, borderRadius: 8, border: 'none', background: course.color, color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer', transition: 'all 150ms', boxShadow: `0 2px 8px ${course.color}35` }}
                            onMouseEnter={e => { e.currentTarget.style.opacity = '0.88'; }}
                            onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}>
                            {exportSelectedIds.size > 0 ? `Exportar ${exportSelectedIds.size} seleccionada${exportSelectedIds.size !== 1 ? 's' : ''}` : 'Selecciona una agrupacion'}
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* ══ IMPORT ══ */
                    <div>
                      <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '0 0 10px' }}>Selecciona un archivo JSON exportado desde Owa Studio.</p>
                      <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, height: 44, borderRadius: 8, border: '1px dashed var(--border-subtle)', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 11, fontWeight: 500, transition: 'all 200ms ' + EASE }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = `${course.color}40`; e.currentTarget.style.background = `${course.color}06`; e.currentTarget.style.color = course.color; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}>
                        <FileUp size={13} /> Seleccionar archivo
                        <input type="file" style={{ display: 'none' }} accept=".json" onChange={e => {
                          const f = e.target.files?.[0]; if (!f) return;
                          const r = new FileReader(); r.onload = ev => {
                            try {
                              const raw = JSON.parse(ev.target?.result as string);
                              const items = (Array.isArray(raw) ? raw : [raw]).filter((d: any) => d.group && d.topics);
                              if (items.length === 0) { toast.error('No se encontraron agrupaciones validas'); return; }
                              setImportPreviewData(items);
                              setImportSelected(items.map((item: any) => item.topics.map(() => true)));
                            } catch { toast.error('Error al leer el archivo'); }
                          }; r.readAsText(f); e.target.value = '';
                        }} />
                      </label>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
      {/* PDF Preview Modal */}
      {showPdfPreview && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(12px)' }} onClick={() => setShowPdfPreview(false)}>
          <div className="bento-card" style={{ width: '90vw', height: '90vh', borderRadius: 12, background: 'var(--bg-surface)', border: '1px solid var(--border-default)', display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 0 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)' }}>
              <File size={14} style={{ color: course?.color }} />
              <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pdfPreviewName}</span>
              <a href={pdfPreviewUrl} download={pdfPreviewName} style={{ height: 26, padding: '0 10px', borderRadius: 5, border: '1px solid var(--border-subtle)', background: 'var(--bg-surface)', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 9, fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                <ExternalLink size={9} /> Abrir
              </a>
              <button onClick={() => setShowPdfPreview(false)} style={{ width: 26, height: 26, borderRadius: 5, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={13} /></button>
            </div>
            <div style={{ flex: 1, background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
              {pdfPreviewUrl.match(/\.(pdf|PDF)$/) || pdfPreviewUrl.startsWith('data:application/pdf') ? (
                <object data={pdfPreviewUrl} type="application/pdf" style={{ width: '100%', height: '100%', border: 'none' }}>
                  <iframe src={pdfPreviewUrl} title={pdfPreviewName} style={{ width: '100%', height: '100%', border: 'none' }} />
                </object>
              ) : pdfPreviewUrl.startsWith('data:image/') ? (
                <img src={pdfPreviewUrl} alt={pdfPreviewName} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
              ) : (
                <iframe src={pdfPreviewUrl} title={pdfPreviewName} style={{ width: '100%', height: '100%', border: 'none' }} />
              )}
            </div>
          </div>
        </div>
      )}
      {showMaterialModal && materialType && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }} onClick={() => setShowMaterialModal(false)}>
          <div className="bento-card" style={{ width: 420, padding: 22, borderRadius: 12, background: 'var(--bg-surface)', border: '1px solid var(--border-default)', maxHeight: '80vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6, margin: 0 }}>
                {editingMaterial ? 'Editar' : 'Añadir'} {materialType && MATERIAL_META[materialType]?.label}
              </h3>
              <button onClick={() => setShowMaterialModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}><X size={15} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {materialType === 'formula' && (
                <><input value={materialForm.name} onChange={e => setForm({ name: e.target.value })} placeholder="Nombre" style={{ width: '100%', height: 32, borderRadius: 5, padding: '0 10px', fontSize: 11, border: '1px solid var(--border-soft)', background: 'var(--bg-deep)', color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }} />
                <textarea value={materialForm.clarification} onChange={e => setForm({ clarification: e.target.value })} placeholder="Explicación..." style={{ width: '100%', minHeight: 50, padding: 8, borderRadius: 5, fontSize: 11, border: '1px solid var(--border-soft)', background: 'var(--bg-deep)', color: 'var(--text-primary)', resize: 'vertical', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }} /></>
              )}
              {materialType === 'concept' && (
                <><input value={materialForm.title} onChange={e => setForm({ title: e.target.value })} placeholder="Título" style={{ width: '100%', height: 32, borderRadius: 5, padding: '0 10px', fontSize: 11, border: '1px solid var(--border-soft)', background: 'var(--bg-deep)', color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }} />
                <textarea value={materialForm.content} onChange={e => setForm({ content: e.target.value })} placeholder="Desarrollo..." style={{ width: '100%', minHeight: 80, padding: 8, borderRadius: 5, fontSize: 11, border: '1px solid var(--border-soft)', background: 'var(--bg-deep)', color: 'var(--text-primary)', resize: 'vertical', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }} /></>
              )}
              {materialType === 'key-data' && (
                <><input value={materialForm.title} onChange={e => setForm({ title: e.target.value })} placeholder="Título (opcional)" style={{ width: '100%', height: 32, borderRadius: 5, padding: '0 10px', fontSize: 11, border: '1px solid var(--border-soft)', background: 'var(--bg-deep)', color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }} />
                <textarea value={materialForm.content} onChange={e => setForm({ content: e.target.value })} placeholder="Dato clave..." style={{ width: '100%', minHeight: 50, padding: 8, borderRadius: 5, fontSize: 11, border: '1px solid var(--border-soft)', background: 'var(--bg-deep)', color: 'var(--text-primary)', resize: 'vertical', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }} /></>
              )}
              {materialType === 'meaning' && (
                <><input value={materialForm.word} onChange={e => setForm({ word: e.target.value })} placeholder="Término" style={{ width: '100%', height: 32, borderRadius: 5, padding: '0 10px', fontSize: 11, border: '1px solid var(--border-soft)', background: 'var(--bg-deep)', color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }} />
                <textarea value={materialForm.meaning} onChange={e => setForm({ meaning: e.target.value })} placeholder="Significado..." style={{ width: '100%', minHeight: 60, padding: 8, borderRadius: 5, fontSize: 11, border: '1px solid var(--border-soft)', background: 'var(--bg-deep)', color: 'var(--text-primary)', resize: 'vertical', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }} /></>
              )}
              {materialType === 'quiz' && (
                <><input value={materialForm.question} onChange={e => setForm({ question: e.target.value })} placeholder="Pregunta" style={{ width: '100%', height: 32, borderRadius: 5, padding: '0 10px', fontSize: 11, border: '1px solid var(--border-soft)', background: 'var(--bg-deep)', color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }} />
                <textarea value={materialForm.answer} onChange={e => setForm({ answer: e.target.value })} placeholder="Respuesta..." style={{ width: '100%', minHeight: 60, padding: 8, borderRadius: 5, fontSize: 11, border: '1px solid var(--border-soft)', background: 'var(--bg-deep)', color: 'var(--text-primary)', resize: 'vertical', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }} /></>
              )}
              {materialType === 'procedure' && (
                <><input value={materialForm.title} onChange={e => setForm({ title: e.target.value })} placeholder="Título" style={{ width: '100%', height: 32, borderRadius: 5, padding: '0 10px', fontSize: 11, border: '1px solid var(--border-soft)', background: 'var(--bg-deep)', color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }} />
                <input value={materialForm.description} onChange={e => setForm({ description: e.target.value })} placeholder="Descripción" style={{ width: '100%', height: 32, borderRadius: 5, padding: '0 10px', fontSize: 11, border: '1px solid var(--border-soft)', background: 'var(--bg-deep)', color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }} />
                <textarea value={materialForm.content} onChange={e => setForm({ content: e.target.value })} placeholder="Pasos..." style={{ width: '100%', minHeight: 80, padding: 8, borderRadius: 5, fontSize: 11, border: '1px solid var(--border-soft)', background: 'var(--bg-deep)', color: 'var(--text-primary)', resize: 'vertical', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }} /></>
              )}
              {['formula', 'procedure'].includes(materialType) && (
                <div>{materialForm.image ? (
                  <div style={{ position: 'relative', width: '100%', aspectRatio: '16/9', borderRadius: 6, overflow: 'hidden', border: '1px solid var(--border-subtle)' }}>
                    <img src={materialForm.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', background: 'var(--bg-deep)' }} />
                    <button onClick={() => setForm({ image: undefined })} style={{ position: 'absolute', top: 4, right: 4, width: 20, height: 20, borderRadius: '50%', background: 'rgba(239,68,68,0.9)', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={9} /></button>
                  </div>
                ) : (
                  <button onClick={() => materialImageInputRef.current?.click()} style={{ width: '100%', height: 48, borderRadius: 6, border: '1px dashed var(--border-subtle)', background: 'transparent', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, color: 'var(--text-muted)' }}>
                    <Upload size={10} /><span style={{ fontSize: 7, fontWeight: 600, textTransform: 'uppercase' }}>Imagen</span>
                  </button>
                )}</div>
              )}
              <button onClick={handleSaveMaterial} style={{ width: '100%', height: 34, borderRadius: 6, border: 'none', background: course.color, color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>{editingMaterial ? 'Guardar' : 'Crear Material'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ===== IMAGE PREVIEW (zoom + pan + delete) ===== */}
      {showImagePreview && previewImageSrc && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10002, display: 'flex', flexDirection: 'column', background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)' }}
          onClick={() => { setShowImagePreview(false); setPreviewZoom(1); setPanOffset({ x: 0, y: 0 }); }}>
          {/* TOP BAR — floating bare icons */}
          <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', top: 24, right: 24, zIndex: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
            <button onClick={handleDeleteImage} title="Eliminar imagen"
              style={{ width: 32, height: 32, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(6px)', cursor: 'pointer', color: 'rgba(255,255,255,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 120ms' }}>
              <LI.Trash2 size={14} />
            </button>
            <button onClick={() => { setShowImagePreview(false); setPreviewZoom(1); setPanOffset({ x: 0, y: 0 }); }} title="Cerrar"
              style={{ width: 32, height: 32, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(6px)', cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 120ms' }}>
              <LI.X size={15} />
            </button>
          </div>
          {/* IMAGE with pan + zoom */}
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative', minHeight: 0, cursor: isPanning ? 'grabbing' : 'grab', padding: '32px' }}
            onClick={e => e.stopPropagation()}
            onWheel={handleWheel}
            onMouseDown={handlePanStart}
            onMouseMove={(e) => { handlePanMove(e); }}
            onMouseUp={handlePanEnd}
            onMouseLeave={handlePanEnd}>
            <div style={{ transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${previewZoom})`, transformOrigin: 'center center', transition: isPanning ? 'none' : 'transform 150ms' }}>
              <img src={previewImageSrc} alt="" style={{ maxWidth: '75vw', maxHeight: '60vh', borderRadius: 10, display: 'block', userSelect: 'none', pointerEvents: 'none' }} />
            </div>
          </div>
          {/* Zoom controls */}
          <div onClick={e => e.stopPropagation()} style={{
            position: 'absolute', bottom: 80, left: '50%', transform: 'translateX(-50%)', zIndex: 10,
            display: 'flex', alignItems: 'center', gap: 14,
          }}>
            <button onClick={() => setPreviewZoom(z => Math.max(1, z - 0.1))} title="Alejar"
              style={{ width: 38, height: 38, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(8px)', cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 120ms' }}>
              <LI.ZoomOut size={16} />
            </button>
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', fontWeight: 500, minWidth: 38, textAlign: 'center', fontVariantNumeric: 'tabular-nums', letterSpacing: '0.02em' }}>{Math.round(previewZoom * 100)}%</span>
            <button onClick={() => setPreviewZoom(z => Math.min(2.5, z + 0.1))} title="Acercar"
              style={{ width: 38, height: 38, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(8px)', cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 120ms' }}>
              <LI.ZoomIn size={16} />
            </button>
            <button onClick={() => setPreviewZoom(1)} title="Restablecer"
              style={{ height: 34, padding: '0 14px', borderRadius: 17, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.06)', backdropFilter: 'blur(8px)', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: 600, letterSpacing: '0.03em', transition: 'all 120ms' }}>100%</button>
          </div>
        </div>
      )}

      {/* ===== DELETE NOTE CONFIRM MODAL ===== */}
      {confirmDeleteNoteId && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 10001,
          background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }} onClick={() => setConfirmDeleteNoteId(null)}>
          <div className="bento-card" style={{
            background: "linear-gradient(135deg, var(--bg-surface) 0%, var(--bg-base) 100%)",
            border: "1px solid var(--border-default)",
            borderRadius: 14, padding: 24, minWidth: 300, maxWidth: 380,
            boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <AlertTriangle size={18} style={{ color: "#EF4444", flexShrink: 0 }} />
              <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", margin: 0, fontFamily: "'Inter Tight', sans-serif" }}>
                Eliminar apunte
              </h3>
            </div>
            <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: 0, lineHeight: 1.5 }}>
              ¿Estás seguro de eliminar este apunte?
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
              <button onClick={() => setConfirmDeleteNoteId(null)}
                style={{
                  background: "none", border: "1px solid var(--border-default)", borderRadius: 8,
                  padding: "7px 16px", color: "var(--text-secondary)", fontSize: 11, cursor: "pointer",
                  fontFamily: "'Inter', sans-serif", fontWeight: 500,
                }}>Cancelar</button>
              <button onClick={() => { deleteNote(confirmDeleteNoteId); if (selectedOverviewNoteId === confirmDeleteNoteId) { setSelectedOverviewNoteId(null); setOverviewNoteEditMode(false); } if (editingNoteId === confirmDeleteNoteId) setEditingNoteId(null); if (selectedNoteId === confirmDeleteNoteId) setSelectedNoteId(null); setConfirmDeleteNoteId(null); toast.success('Apunte eliminado'); }}
                style={{
                  background: "#EF4444", color: "#fff", border: "none", borderRadius: 8,
                  padding: "7px 16px", fontSize: 11, fontWeight: 600, cursor: "pointer",
                  fontFamily: "'Inter', sans-serif",
                }}>Eliminar</button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden inline audio player */}
      <audio ref={audioRef} preload="metadata" />
    </div>
  );
}
