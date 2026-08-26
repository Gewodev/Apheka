import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Play, Pause, SkipBack, SkipForward, Volume2, Search,
  Music, Download, Trash2, X, ListMusic, Upload,
  Link, Globe, Loader, Check, CheckCircle, AlertCircle,
  ArrowLeft, ArrowRight, ChevronDown, ChevronUp, ChevronLeft, ChevronRight,
  ExternalLink, FolderOpen, Plus,
  Disc3, Activity, Heart, Copy, Clock,
  User, Wifi, Sliders, Repeat, Shuffle, BarChart2,
  Edit2, Grid, List, Image, ListPlus, ListX, CornerDownRight,
} from 'lucide-react';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { restrictToParentElement } from '@dnd-kit/modifiers';
import { CSS } from '@dnd-kit/utilities';
import { useApp, type Track } from '../../store/AppContext';
import { open, save } from '@tauri-apps/plugin-dialog';
import { readFile } from '@tauri-apps/plugin-fs';
import { format, subDays, addDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { extractYouTubeId } from '../../lib/ytEngine';
import { fuzzyMatch as sharedFuzzyMatch, normalizeSearch } from '../../lib/fuzzy';
import {
  fetchMetadata, searchMusic, startDownload, cancelDownload,
  getDownloadPath, setDownloadPath,
  onDownloadProgress, onDownloadComplete, onDownloadFile,
  detectUrlType, formatDuration, validateUrl,
  exportToZip,
  isTauri,
  type YouTubePlaylist, type YouTubeMetadata, type SearchResult,
  type DownloadProgress, type DownloadComplete,
} from '../../lib/musicApi';
import NotificationBell from '../ui/NotificationBell';

type TabId = 'biblioteca' | 'artistas' | 'playlists' | 'favoritas' | 'explorar';

function isPlaylist(data: YouTubePlaylist | YouTubeMetadata): data is YouTubePlaylist {
  return 'entries' in data && Array.isArray((data as YouTubePlaylist).entries);
}

function getEntries(data: YouTubePlaylist | YouTubeMetadata): YouTubeMetadata[] {
  if (isPlaylist(data)) return data.entries;
  return [data as YouTubeMetadata];
}

function loadExploreState() {
  try {
    const raw = localStorage.getItem('owa_music_explore_v1');
    if (!raw) return null;
    const d = JSON.parse(raw);
    return {
      searchMode: d.searchMode === 'query' ? 'query' : 'link',
      url: typeof d.url === 'string' ? d.url : '',
      searchQuery: typeof d.searchQuery === 'string' ? d.searchQuery : '',
      searchResults: Array.isArray(d.searchResults) ? (d.searchResults as SearchResult[]) : [],
      searchPerformed: !!d.searchPerformed,
      preview: (d.preview || null) as YouTubePlaylist | YouTubeMetadata | null,
    };
  } catch { return null; }
}

const MUSIC_TABS: TabId[] = ['biblioteca', 'artistas', 'playlists', 'favoritas', 'explorar'];

function loadUiState() {
  try {
    const raw = localStorage.getItem('owa_music_ui_v1');
    if (!raw) return null;
    const d = JSON.parse(raw);
    return {
      activeTab: MUSIC_TABS.includes(d.activeTab) ? (d.activeTab as TabId) : undefined,
      viewMode: d.viewMode === 'lista' || d.viewMode === 'bloques' ? d.viewMode : undefined,
      showRightSidebar: typeof d.showRightSidebar === 'boolean' ? d.showRightSidebar : undefined,
      selectedArtist: typeof d.selectedArtist === 'string' ? d.selectedArtist : undefined,
      selectedPlaylistId: typeof d.selectedPlaylistId === 'string' ? d.selectedPlaylistId : undefined,
      showAllLibrary: typeof d.showAllLibrary === 'boolean' ? d.showAllLibrary : undefined,
      showAllRecents: typeof d.showAllRecents === 'boolean' ? d.showAllRecents : undefined,
      showSearch: typeof d.showSearch === 'boolean' ? d.showSearch : undefined,
      statsPeriod: d.statsPeriod === 'week' || d.statsPeriod === 'month' ? d.statsPeriod : undefined,
      audioFormat: d.audioFormat === 'mp3' || d.audioFormat === 'm4a' ? d.audioFormat : undefined,
      includeCover: typeof d.includeCover === 'boolean' ? d.includeCover : undefined,
      audioQuality: typeof d.audioQuality === 'string' ? d.audioQuality : undefined,
      artistTrackSearch: typeof d.artistTrackSearch === 'string' ? d.artistTrackSearch : undefined,
      playlistSongSearch: typeof d.playlistSongSearch === 'string' ? d.playlistSongSearch : undefined,
      playlistArtistFilter: typeof d.playlistArtistFilter === 'string' ? d.playlistArtistFilter : undefined,
    };
  } catch { return null; }
}

function SortableQueueRow({ track, index, onSelect, onMenu, formatTime }: { track: Track; index: number; onSelect: () => void; onMenu: (e: React.MouseEvent, trackId: string) => void; formatTime: (secs: number) => string }) {
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({ id: track.id });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={onSelect}
      onContextMenu={(e) => onMenu(e, track.id)}
      className="hover-lift"
      style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', padding: '4px 0', borderRadius: 6, transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1, zIndex: isDragging ? 20 : undefined, position: 'relative', touchAction: 'none' }}
    >
      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', width: 16, textAlign: 'center' }}>{index + 1}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{track.title}</div>
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{track.artist}</div>
      </div>
      <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>{formatTime(track.duration)}</span>
    </div>
  );
}

function normalizeStr(s: string): string {
  return normalizeSearch(s);
}

function fuzzyMatch(hay: string, needle: string): boolean {
  return sharedFuzzyMatch(hay, needle);
}

function SortableLibraryRow({ track, index, isPlaying, isOnline, formatTime, onSelect, onMenu, onToggleFav, onEdit, onDelete }: {
  track: Track; index: number; isPlaying: boolean; isOnline: boolean;
  formatTime: (secs: number) => string;
  onSelect: () => void; onMenu: (e: React.MouseEvent, trackId: string) => void;
  onToggleFav: () => void; onEdit: () => void; onDelete: () => void;
}) {
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({ id: track.id });
  const cloudOffline = !isOnline && track.source !== 'local';
  const cloudBorder = track.source !== 'local'
    ? '1.5px solid color-mix(in srgb, var(--accent) 58%, transparent)'
    : '1px solid transparent';
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={onSelect}
      onContextMenu={(e) => onMenu(e, track.id)}
      style={{
        display: 'grid', gridTemplateColumns: '40px 3.5fr 1.5fr 80px 130px', padding: '10px 12px',
        borderRadius: 8, alignItems: 'center', cursor: 'pointer', transition: 'all 150ms',
        background: isPlaying ? 'var(--accent-dim)' : 'transparent',
        border: isPlaying ? '1px solid var(--accent-glow)' : cloudBorder,
        opacity: cloudOffline ? 0.45 : 1,
        pointerEvents: cloudOffline ? 'none' : undefined,
        position: 'relative',
        transform: CSS.Transform.toString(transform),
        touchAction: 'none',
      }}
      onMouseEnter={e => { if (!isPlaying) e.currentTarget.style.background = 'var(--bg-hover)'; }}
      onMouseLeave={e => { if (!isPlaying) e.currentTarget.style.background = 'transparent'; }}
    >
      {cloudOffline && (
        <div style={{ position: 'absolute', top: -1, left: 12, fontSize: 8.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--error)', background: 'var(--bg-surface)', border: '1px solid color-mix(in srgb, var(--error) 40%, transparent)', borderRadius: 999, padding: '2px 8px', zIndex: 2 }}>
          No hay conexión a internet
        </div>
      )}
      {!cloudOffline && track.source !== 'local' && (
        <div style={{ position: 'absolute', top: -1, left: -1, bottom: -1, width: 3, borderRadius: '6px 0 0 6px', background: 'var(--accent)', opacity: 0.55, pointerEvents: 'none' }} />
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {isPlaying ? (
          <div style={{ width: 24, height: 24, borderRadius: 6, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
            <Pause size={12} fill="#fff" />
          </div>
        ) : (
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)', width: 24, textAlign: 'center' }}>{index + 1}</span>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
        <div style={{ width: 36, height: 36, borderRadius: 6, flexShrink: 0, overflow: 'hidden', position: 'relative' }}>
          {track.coverImage ? <img src={track.coverImage} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Music size={14} style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', color: 'var(--text-muted)', opacity: 0.3 }} />}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: isPlaying ? 600 : 500, color: isPlaying ? 'var(--accent)' : 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{track.title}</div>
        </div>
      </div>

      <div style={{ fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{track.artist}</div>

      <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', whiteSpace: 'nowrap', textAlign: 'left' }}>{formatTime(track.duration)}</div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
        <button onClick={(e) => { e.stopPropagation(); onToggleFav(); }} className="btn-ghost" style={{ padding: 6, color: track.isFavorite ? 'var(--accent)' : 'var(--text-tertiary)' }} title={track.isFavorite ? 'Quitar de favoritos' : 'Añadir a favoritos'}>
          <Heart size={16} style={{ fill: track.isFavorite ? 'var(--accent)' : 'transparent' }} />
        </button>
        <button onClick={(e) => { e.stopPropagation(); onEdit(); }} className="btn-ghost" style={{ padding: 6, color: 'var(--text-tertiary)' }} title="Editar canción">
          <Edit2 size={14} />
        </button>
        <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="btn-ghost" style={{ padding: 6, color: 'var(--text-tertiary)' }} title="Eliminar canción">
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

export default function Musica() {
  const {
    tracks, currentTrackId, isPlayingMusic, toggleMusicPlayback,
    playTrack, musicVolume, setMusicVolume, setMusicProgress, musicProgress, musicDuration,
    shuffleMode, repeatMode, musicQueue, setMusicQueue, setShuffleMode, setRepeatMode,
    setQueueSource, queueSource,
    addTrack, addToDownloadQueue, musicListeningTime, dailyMusicTime,
    weeklyMusicTime, monthlyMusicTime,
    updateDownloadProgress, updateDownloadStatus, toggleTrackFavorite,
    downloadQueue, removeFromDownloadQueue, clearCompletedDownloads,
    updateTrack, deleteTrack,
    trackHistory, playCounts, studySessions, artists, addArtist, deleteArtist, updateArtist,
    playlists, addPlaylist, updatePlaylist, deletePlaylist,
    clearAllMusicData,
    addNotification,
    importLocalTracks,
    setCoverModalTrackId,
    downloadPath: persistentDownloadPath, setDownloadPathCtx,
    setPipUrl, pipPlaying, pipUrl, pipTitle, queuePipAfter,
  } = useApp();

  const pipId = pipUrl ? extractYouTubeId(pipUrl) : null;

  const [activeTab, setActiveTab] = useState<TabId>(() => loadUiState()?.activeTab || 'biblioteca');
  const [url, setUrl] = useState(() => loadExploreState()?.url || '');
  const [searchQuery, setSearchQuery] = useState(() => loadExploreState()?.searchQuery || '');
  const [isLoading, setIsLoading] = useState(false);
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [spotifyUrl, setSpotifyUrl] = useState('');
  const [preview, setPreview] = useState<YouTubePlaylist | YouTubeMetadata | null>(() => loadExploreState()?.preview || null);
  const [searchResults, setSearchResults] = useState<SearchResult[]>(() => loadExploreState()?.searchResults || []);
  const [showAllLibrary, setShowAllLibrary] = useState(() => loadUiState()?.showAllLibrary ?? false);
  const [showAllRecents, setShowAllRecents] = useState(() => loadUiState()?.showAllRecents ?? false);
  const [audioFormat, setAudioFormat] = useState<'mp3' | 'm4a'>(() => loadUiState()?.audioFormat || 'mp3');
  const [includeCover, setIncludeCover] = useState(() => loadUiState()?.includeCover ?? true);
  const [audioQuality, setAudioQuality] = useState(() => loadUiState()?.audioQuality || '3');
  const [selectedArtist, setSelectedArtist] = useState<string | null>(() => loadUiState()?.selectedArtist || null);
  const [showSearch, setShowSearch] = useState(() => loadUiState()?.showSearch ?? false);
  const [coverHover, setCoverHover] = useState(false);
  const [searchMode, setSearchMode] = useState<'link' | 'query' | 'spotify'>(() => (loadExploreState()?.searchMode as 'link' | 'query' | 'spotify' | undefined) || 'link');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [confirmDelete, setConfirmDelete] = useState<{ type: 'track' | 'artist' | 'playlist'; id: string; name: string } | null>(null);
  const [showClearAllConfirm, setShowClearAllConfirm] = useState(false);
  const [searchPerformed, setSearchPerformed] = useState(() => loadExploreState()?.searchPerformed || false);
  const [statsPeriod, setStatsPeriod] = useState<'week' | 'month'>(() => loadUiState()?.statsPeriod || 'week');
  const [chartTooltip, setChartTooltip] = useState<{ text: string; date: string; x: number; y: number } | null>(null);
  const [editingArtistId, setEditingArtistId] = useState<string | null>(null);
  const [editArtistName, setEditArtistName] = useState('');
  const [editArtistImage, setEditArtistImage] = useState('');
  const [artistSelectedTrackIds, setArtistSelectedTrackIds] = useState<string[]>([]);
  const [artistTrackSearch, setArtistTrackSearch] = useState(() => loadUiState()?.artistTrackSearch || '');
  // Playlist state
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(() => loadUiState()?.selectedPlaylistId || null);
  const [showCreatePlaylist, setShowCreatePlaylist] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [editingPlaylistId, setEditingPlaylistId] = useState<string | null>(null);
  const [selectedTrackIds, setSelectedTrackIds] = useState<Set<string>>(new Set());
  const [playlistArtistFilter, setPlaylistArtistFilter] = useState(() => loadUiState()?.playlistArtistFilter || '');
  const [playlistSongSearch, setPlaylistSongSearch] = useState(() => loadUiState()?.playlistSongSearch || '');
  const [playlistStep, setPlaylistStep] = useState(0);
  const [playlistCoverData, setPlaylistCoverData] = useState<string>('');

  const [viewMode, setViewMode] = useState<'lista' | 'bloques'>(() => loadUiState()?.viewMode || 'lista');
  const [editingTrackId, setEditingTrackId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editArtist, setEditArtist] = useState('');
  const [editCover, setEditCover] = useState('');

  const mainContainerRef = useRef<HTMLDivElement>(null);
  const [showRightSidebar, setShowRightSidebar] = useState(() => loadUiState()?.showRightSidebar ?? true);
  const [showSidebarArrow, setShowSidebarArrow] = useState(false);
  const [sidebarArrowPos, setSidebarArrowPos] = useState(0);
  const sidebarArrowTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const urlInputRef = useRef<HTMLInputElement>(null);
  const searchRequestId = useRef(0);

  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; trackId: string } | null>(null);

  const openTrackMenu = useCallback((e: React.MouseEvent, trackId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setCtxMenu({ x: e.clientX, y: e.clientY, trackId });
  }, []);

  const ctxPlayNext = useCallback((trackId: string) => {
    setMusicQueue([trackId, ...musicQueue.filter(id => id !== trackId)]);
    setCtxMenu(null);
    addNotification('Se reproducirá después de la canción actual', 'success');
  }, [musicQueue, setMusicQueue, addNotification]);

  const ctxRemoveFromQueue = useCallback((trackId: string) => {
    setMusicQueue(musicQueue.filter(id => id !== trackId));
    setCtxMenu(null);
    addNotification('Canción quitada de la cola', 'success');
  }, [musicQueue, setMusicQueue, addNotification]);

  const ctxAddToQueue = useCallback((trackId: string) => {
    setMusicQueue([...musicQueue.filter(id => id !== trackId), trackId]);
    setCtxMenu(null);
    addNotification('Agregada a la cola de reproducción', 'success');
  }, [musicQueue, setMusicQueue, addNotification]);

  const queueSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { delay: 300, tolerance: 8 } }));
  const librarySensors = useSensors(useSensor(PointerSensor, { activationConstraint: { delay: 300, tolerance: 8 } }));
  const queueDragEndedRef = useRef(false);
  const handleQueueDragEnd = useCallback((e: DragEndEvent) => {
    const { active, over } = e;
    if (over && active.id !== over.id) {
      const oldIndex = musicQueue.indexOf(active.id as string);
      const newIndex = musicQueue.indexOf(over.id as string);
      if (oldIndex >= 0 && newIndex >= 0) setMusicQueue(arrayMove(musicQueue, oldIndex, newIndex));
    }
    queueDragEndedRef.current = true;
    setTimeout(() => { queueDragEndedRef.current = false; }, 250);
  }, [musicQueue, setMusicQueue]);
  const [colocarTrackId, setColocarTrackId] = useState<string | null>(null);

  const [manualOrder, setManualOrder] = useState<string[] | null>(() => {
    try {
      const raw = localStorage.getItem('owa_library_order_v1');
      if (!raw) return null;
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr.filter((x: any) => typeof x === 'string') : null;
    } catch { return null; }
  });

  const buildCloudTrack = useCallback((r: SearchResult): Omit<Track, 'id'> => ({
    title: r.title,
    artist: r.channel || 'YouTube',
    duration: r.duration || 0,
    source: 'youtube',
    url: r.id ? `https://www.youtube.com/watch?v=${r.id}` : r.webpage_url,
    coverUrl: r.thumbnail,
    isFavorite: false,
    listenedTime: 0,
  }), []);

  const addCloudTrack = useCallback((r: SearchResult): string | null => {
    const url = r.id ? `https://www.youtube.com/watch?v=${r.id}` : r.webpage_url;
    if (!url) return null;
    const existing = tracks.find(t => t.url === url);
    if (existing) return existing.id;
    return addTrack(buildCloudTrack(r));
  }, [tracks, addTrack, buildCloudTrack]);

  const [ctxSearchMenu, setCtxSearchMenu] = useState<{ x: number; y: number; result: SearchResult } | null>(null);
  const openSearchMenu = useCallback((e: React.MouseEvent, result: SearchResult) => {
    e.preventDefault();
    e.stopPropagation();
    setCtxSearchMenu({ x: e.clientX, y: e.clientY, result });
  }, []);

  const ctxSearchAddToLibrary = useCallback((r: SearchResult) => {
    const id = addCloudTrack(r);
    setCtxSearchMenu(null);
    if (id) addNotification('Agregada a tu biblioteca', 'success');
  }, [addCloudTrack, addNotification]);

  const ctxSearchPlayNext = useCallback((r: SearchResult) => {
    setCtxSearchMenu(null);
    const url = r.id ? `https://www.youtube.com/watch?v=${r.id}` : r.webpage_url;
    if (!url) return;
    queuePipAfter(url, r.title || 'Canción');
    addNotification('Se reproducirá en el emergente cuando termine la canción actual', 'success');
  }, [queuePipAfter, addNotification]);


  const [downloadSelection, setDownloadSelection] = useState<{ url: string; title: string; channel?: string; thumbnail?: string; duration?: number }[]>(() => {
    try {
      const saved = localStorage.getItem('owa_download_selection');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  useEffect(() => {
    localStorage.setItem('owa_download_selection', JSON.stringify(downloadSelection));
  }, [downloadSelection]);

  useEffect(() => {
    try {
      localStorage.setItem('owa_music_explore_v1', JSON.stringify({
        searchMode, url, searchQuery, searchResults, searchPerformed, preview,
      }));
    } catch { /* noop */ }
  }, [searchMode, url, searchQuery, searchResults, searchPerformed, preview]);

  useEffect(() => {
    try {
      localStorage.setItem('owa_music_ui_v1', JSON.stringify({
        activeTab, viewMode, showRightSidebar, selectedArtist, selectedPlaylistId,
        showAllLibrary, showAllRecents, showSearch, statsPeriod,
        audioFormat, includeCover, audioQuality,
        artistTrackSearch, playlistSongSearch, playlistArtistFilter,
      }));
    } catch { /* noop */ }
  }, [
    activeTab, viewMode, showRightSidebar, selectedArtist, selectedPlaylistId,
    showAllLibrary, showAllRecents, showSearch, statsPeriod,
    audioFormat, includeCover, audioQuality,
    artistTrackSearch, playlistSongSearch, playlistArtistFilter,
  ]);

  const handlePlayWithTabCb = useCallback((trackOrId: string | Track, sourceTab?: TabId) => {
    const trackId = typeof trackOrId === 'string' ? trackOrId : trackOrId.id;
    const track = tracks.find(t => t.id === trackId);
    if (!track) return;
    const tab = sourceTab || activeTab;
    if (tab !== activeTab) {
      setActiveTab(tab);
      if (tab === 'artistas' && track.artist) setSelectedArtist(track.artist);
    }
    // Reproducir en el reproductor general cierra el emergente (uno u otro, sin doble audio)
    if (pipUrl) setPipUrl(null);
    // Las canciones de la nube se reproducen en el reproductor general (playTrack
    // las enruta a YouTube → ReactPlayer); el emergente solo se usa cuando se
    // reproduce desde la búsqueda o se programa "después de la actual".
    playTrack(trackId);
  }, [activeTab, playTrack, pipUrl, setPipUrl]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => { window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline); };
  }, []);

  // Lock body scroll when any modal is open
  useEffect(() => {
    const modalOpen = !!(editingArtistId || showCreatePlaylist || editingTrackId || confirmDelete || showClearAllConfirm);
    const html = document.documentElement;
    const pageContainer = document.querySelector('.page-container') as HTMLElement | null;
    if (modalOpen) {
      document.body.style.overflow = 'hidden';
      html.style.overflow = 'hidden';
      if (pageContainer) pageContainer.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      html.style.overflow = '';
      if (pageContainer) pageContainer.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
      html.style.overflow = '';
      if (pageContainer) pageContainer.style.overflow = '';
    };
  }, [editingArtistId, showCreatePlaylist, editingTrackId, confirmDelete, showClearAllConfirm]);

  const timeStr = format(currentTime, 'HH:mm');
  const secondsStr = format(currentTime, 'ss');
  const dateStr = format(currentTime, "EEEE, d 'de' MMMM, yyyy", { locale: es as any });
  const dateStrCapitalized = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);


  const formatTime = useCallback((secs: number) => {
    if (!secs || !isFinite(secs)) return '0:00';
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = Math.floor(secs % 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }, []);

  const formatHm = useCallback((secs: number) => {
    if (!secs || !isFinite(secs)) return '0h 0m';
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    return `${h}h ${m}m`;
  }, []);

  const handleSelectFolder = useCallback(async () => {
    try {
      const folder = await open({ directory: true, multiple: false, title: 'Carpeta de descargas' });
      if (folder) {
        setDownloadPathCtx(String(folder));
        addNotification('Carpeta de descarga actualizada', 'success');
      }
    } catch {
      try {
        const input = document.createElement('input');
        input.type = 'file';
        input.setAttribute('webkitdirectory', '');
        input.setAttribute('directory', '');
        input.style.display = 'none';
        input.addEventListener('change', () => {
          if (input.files && input.files.length > 0) {
            const path = input.files[0].webkitRelativePath.split('/')[0];
            setDownloadPathCtx(path || 'Descargas/OWA Music');
            addNotification('Carpeta seleccionada (solo visible en esta sesión)', 'success');
          }
        });
        document.body.appendChild(input);
        input.click();
        document.body.removeChild(input);
      } catch {
        addNotification('Cambiar carpeta solo disponible en la app de escritorio', 'error');
      }
    }
  }, []);

  useEffect(() => {
    const unlistenProgress = onDownloadProgress((data: DownloadProgress) => {
      updateDownloadProgress(data.downloadId, data.progress);
    });
    const unlistenComplete = onDownloadComplete((data: DownloadComplete) => {
      const errorMsg = data.errorMessage ? data.errorMessage.slice(0, 500) : undefined;
      updateDownloadStatus(data.downloadId, data.success ? 'completed' : 'error', errorMsg);
      if (data.success) {
        addNotification('Descarga completada', 'success');
      } else {
        addNotification(errorMsg ? `Error: ${errorMsg}` : `Error en la descarga (código ${data.code ?? '?'})`, 'error');
      }
    });
    return () => {
      unlistenProgress.then(fn => fn());
      unlistenComplete.then(fn => fn());
    };
  }, [updateDownloadProgress, updateDownloadStatus]);

  const handleUrlSubmit = async () => {
    const trimmedUrl = url.trim();
    if (!trimmedUrl) return;
    if (!navigator.onLine) {
      addNotification('Sin conexión a internet. No se puede procesar enlaces en línea.', 'error');
      return;
    }

    setIsLoading(true);
    setPreview(null);
    try {
      const result = await validateUrl(trimmedUrl);
      setPreview(result);
    } catch (e) {
      const msg = String(e).replace(/^(Error:\s*|Invalid URL:\s*|Metadata error:\s*)/i, '');
      addNotification(msg || 'Error al procesar la URL. Verifica que sea correcta.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSpotifyImport = async () => {
    const link = spotifyUrl.trim();
    if (!link) return;
    if (!link.includes('spotify.com/playlist/') && !link.includes('spotify.com/album/') && !link.includes('spotify.com/track/')) {
      addNotification('Pega un enlace válido de playlist, álbum o track de Spotify', 'error');
      return;
    }
    setIsLoading(true);
    try {
      const match = link.match(/spotify\.com\/(playlist|album|track)\/([a-zA-Z0-9]+)/);
      if (!match) throw new Error('No se pudo extraer el ID del enlace');
      const [, type, id] = match;

      // Spotify embed page contiene el JSON con todos los tracks sin auth
      const endpoint = `https://open.spotify.com/embed/${type}/${id}`;
      const res = await fetch(endpoint);
      if (!res.ok) throw new Error(`No se pudo acceder (HTTP ${res.status}). Verifica que la playlist sea pública.`);
      const html = await res.text();
      const jsonMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/);
      if (!jsonMatch) throw new Error('No se pudieron leer los tracks. La playlist podría ser privada.');
      let data: any;
      try { data = JSON.parse(jsonMatch[1]); } catch { throw new Error('Error al procesar la respuesta de Spotify'); }
      const entity = data?.props?.pageProps?.state?.data?.entity;
      if (!entity) throw new Error('Formato inesperado. Spotify pudo haber cambiado su estructura.');

      const playlistName: string = entity.name || 'Playlist de Spotify';
      const trackList: { title: string; artist: string; uri: string }[] = [];
      if (type === 'track') {
        trackList.push({ title: entity.name || 'Track', artist: entity.artists?.[0]?.name || 'Spotify', uri: id });
      } else {
        const items = entity.trackList || [];
        for (const tr of items) {
          trackList.push({ title: tr.title || '', artist: tr.subtitle || '', uri: tr.uri || '' });
        }
      }
      if (trackList.length === 0) throw new Error('La playlist no tiene canciones');

      setSpotifyUrl('');
      addNotification(`"${playlistName}": ${trackList.length} canciones encontradas. Importando a tu biblioteca…`, 'success');

      let imported = 0, skipped = 0;
      for (const tr of trackList.slice(0, 30)) {
        if (!tr.title.trim()) { skipped++; continue; }
        try {
          const entries = await searchMusic(`${tr.title} ${tr.artist}`);
          if (entries.length > 0) {
            const first = entries[0] as any;
            const ytId = first.id || (first.url || first.webpage_url || '').match(/[?&]v=([^&]+)/)?.[1];
            if (ytId) {
              addCloudTrack({
                id: ytId,
                title: tr.title,
                channel: tr.artist,
                duration: first.duration || 0,
                thumbnail: first.thumbnail || '',
                webpage_url: '',
              } as any);
              imported++;
            } else skipped++;
          } else skipped++;
        } catch { skipped++; }
      }
      addNotification(
        `${imported}/${trackList.length} importadas${skipped > 0 ? ` · ${skipped} omitidas` : ''}`,
        imported > 0 ? 'success' : 'error'
      );
    } catch (e: any) {
      addNotification(e?.message || 'Error inesperado al importar desde Spotify', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = async () => {
    const q = searchQuery.trim();
    if (!q) return;
    if (!navigator.onLine) {
      addNotification('Sin conexión a internet. No se puede buscar en línea.', 'error');
      return;
    }
    const id = ++searchRequestId.current;
    setIsLoading(true);
    setSearchResults([]);
    setSearchPerformed(false);
    try {
      const results = await searchMusic(q);
      if (id !== searchRequestId.current) return;
      setSearchResults(results);
      setSearchPerformed(true);
    } catch {
      if (id !== searchRequestId.current) return;
      addNotification('Error al buscar', 'error');
      setSearchPerformed(true);
    } finally {
      if (id === searchRequestId.current) setIsLoading(false);
    }
  };

  const getVideoUrl = useCallback((entry: YouTubeMetadata): string => {
    return entry.webpage_url || entry.url || (entry.id ? `https://www.youtube.com/watch?v=${entry.id}` : '');
  }, []);

  const autoImportTracks = useCallback((entries: YouTubeMetadata[]) => {
    entries.forEach(entry => {
      if (!entry.id) return;
      const exists = tracks.some(t => t.url?.includes(entry.id!) || t.url?.includes(entry.webpage_url || ''));
      if (exists) return;
      addTrack({
        title: entry.title || 'Unknown',
        artist: (entry.channel as string) || 'Artista Desconocido',
        duration: entry.duration || 0,
        source: 'youtube',
        url: getVideoUrl(entry),
        coverImage: entry.thumbnail,
        isFavorite: false,
        listenedTime: 0,
      });
    });
  }, [addTrack, tracks, getVideoUrl]);

  const doDownload = useCallback(async (entry: YouTubeMetadata, dlItemId: string, path: string) => {
    const videoUrl = getVideoUrl(entry);
    if (!videoUrl) {
      updateDownloadStatus(dlItemId, 'error', 'URL del video no disponible');
      return;
    }
    if (!navigator.onLine) {
      updateDownloadStatus(dlItemId, 'error', 'Sin conexión a internet');
      addNotification('Sin conexión a internet. No se puede descargar.', 'error');
      return;
    }
    updateDownloadStatus(dlItemId, 'downloading');
    try {
      await startDownload(videoUrl, dlItemId, path, audioFormat, includeCover, audioQuality);
      if (!isTauri()) {
        updateDownloadStatus(dlItemId, 'completed');
      }
    } catch (e) {
      const msg = String(e);
      if (msg.includes('web-download-unavailable')) {
        updateDownloadStatus(dlItemId, 'error', 'Solo disponible en la app de escritorio');
        addNotification('Descargar requiere la app de escritorio. Usa "npm run tauri dev"', 'error');
      } else {
        const cleanMsg = msg.replace(/^(Error:\s*|Invoke error:\s*)/i, '').slice(0, 500);
        updateDownloadStatus(dlItemId, 'error', cleanMsg || 'Error desconocido');
        addNotification(`Error: ${cleanMsg || 'Error al descargar'}`, 'error');
      }
    }
  }, [getVideoUrl, audioFormat, includeCover, updateDownloadStatus, addNotification]);

  const handleDownloadAll = async () => {
    if (!preview) return;
    const entries = getEntries(preview);
    // Add all entries to download selection panel
    entries.forEach(entry => {
      const videoUrl = getVideoUrl(entry);
      if (videoUrl && !downloadSelection.some(s => s.url === videoUrl)) {
        setDownloadSelection(prev => [...prev, { url: videoUrl, title: entry.title || 'Unknown', channel: entry.channel, thumbnail: entry.thumbnail, duration: entry.duration }]);
      }
    });
  };

  const handleDownloadOne = (entry: YouTubeMetadata) => {
    addToDownloadSelection(entry);
  };

  const addToDownloadSelection = (entry: YouTubeMetadata) => {
    const videoUrl = getVideoUrl(entry);
    if (!videoUrl) return;
    if (downloadSelection.some(s => s.url === videoUrl)) return;
    setDownloadSelection(prev => [...prev, { url: videoUrl, title: entry.title || 'Unknown', channel: entry.channel, thumbnail: entry.thumbnail, duration: entry.duration }]);
  };

  const startBulkDownload = async () => {
    if (downloadSelection.length === 0) return;
    for (const item of downloadSelection) {
      const entry: YouTubeMetadata = { title: item.title, channel: item.channel || '', thumbnail: item.thumbnail || '', duration: item.duration || 0, id: '', webpage_url: item.url, url: item.url };
      const dlItemId = addToDownloadQueue({ title: item.title, artist: item.channel || '', url: item.url, type: 'video', totalItems: downloadSelection.length, thumbnail: item.thumbnail, duration: item.duration });
      doDownload(entry, dlItemId, persistentDownloadPath);
    }
    setDownloadSelection([]);
    addNotification(`Descargando ${downloadSelection.length} canciones`, 'success');
  };

  const handleCancelDownload = async (itemId: string) => {
    try {
      await cancelDownload(itemId);
      updateDownloadStatus(itemId, 'cancelled');
    } catch {
      removeFromDownloadQueue(itemId);
    }
  };

  const handleSelectForLibrary = () => {
    if (!preview) return;
    const entries = getEntries(preview);

    entries.forEach((entry, i) => {
      addTrack({
        title: entry.title,
        artist: (entry.channel as string) || 'Artista Desconocido',
        duration: entry.duration || 0,
        source: 'youtube',
        url: entry.webpage_url,
        coverImage: entry.thumbnail,
        isFavorite: false,
        listenedTime: 0
      });
    });
    addNotification(`Importado a biblioteca: ${entries.length} temas`, 'success');
    setActiveTab('biblioteca');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (searchMode === 'query') handleSearch();
      else handleUrlSubmit();
    }
  };

  const currentTrack = tracks.find(t => t.id === currentTrackId);


  const activeDownloads = downloadQueue.filter(d => d.status === 'downloading' || d.status === 'queued');
  const completedDownloads = downloadQueue.filter(d => d.status === 'completed');

  const sortedTracks = useMemo(() => {
    return [...tracks].reverse();
  }, [tracks]);

  const recentTracks = useMemo(() => {
    const seen = new Set<string>();
    const result: typeof tracks = [];
    for (const id of trackHistory) {
      if (seen.has(id)) continue;
      seen.add(id);
      const t = tracks.find(track => track.id === id);
      if (t) result.push(t);
      if (result.length >= 10) break;
    }
    return result;
  }, [trackHistory, tracks]);

  const dailyShuffledTracks = useMemo(() => {
    const seed = format(new Date(), 'yyyy-MM-dd');
    const seededRandom = (s: string) => {
      let hash = 0;
      for (let i = 0; i < s.length; i++) {
        hash = ((hash << 5) - hash) + s.charCodeAt(i);
        hash |= 0;
      }
      return () => {
        hash = (hash * 16807) % 2147483647;
        return (hash - 1) / 2147483646;
      };
    };
    const rng = seededRandom(seed);
    return [...tracks].sort(() => rng() - 0.5);
  }, [tracks]);

  const libraryTracks = useMemo(() => {
    let filtered = dailyShuffledTracks;
    if (manualOrder && manualOrder.length > 0) {
      const orderMap = new Map(manualOrder.map((id, idx) => [id, idx]));
      filtered = [...filtered].sort((a, b) => (orderMap.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (orderMap.get(b.id) ?? Number.MAX_SAFE_INTEGER));
    }
    if (selectedArtist) {
      filtered = filtered.filter(t => t.artist === selectedArtist);
    }
    if (searchQuery) {
      filtered = filtered.filter(t => fuzzyMatch(t.title, searchQuery) || fuzzyMatch(t.artist, searchQuery));
    }
    return filtered;
  }, [dailyShuffledTracks, selectedArtist, searchQuery, manualOrder]);

  const displayTracks = activeTab === 'favoritas'
    ? tracks.filter(t => t.isFavorite)
    : (showAllLibrary ? libraryTracks : libraryTracks.slice(0, 25));

  const handleLibraryDragEnd = useCallback((e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = displayTracks.findIndex(t => t.id === active.id);
    const newIndex = displayTracks.findIndex(t => t.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const moved = arrayMove(displayTracks, oldIndex, newIndex);
    const movedIds = new Set(moved.map(t => t.id));
    const rest = libraryTracks.filter(t => !movedIds.has(t.id));
    const full = [...moved, ...rest].map(t => t.id);
    setManualOrder(full);
    try { localStorage.setItem('owa_library_order_v1', JSON.stringify(full)); } catch { }
  }, [displayTracks, libraryTracks]);

  const weeklyListeningTime = useMemo(() => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    let total = 0;
    for (let i = 0; i <= dayOfWeek; i++) {
      const dateStr = format(addDays(subDays(today, dayOfWeek), i), 'yyyy-MM-dd');
      total += dailyMusicTime[dateStr] || 0;
    }
    return total;
  }, [dailyMusicTime]);

  const monthlyListeningTime = useMemo(() => {
    const monthKey = format(new Date(), 'yyyy-MM');
    let total = 0;
    for (const [dateStr, seconds] of Object.entries(dailyMusicTime)) {
      if (dateStr.startsWith(monthKey)) {
        total += seconds;
      }
    }
    return total;
  }, [dailyMusicTime]);

  return (
    <div className="page-container" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto' }}>

      {/* â”€â”€ HEADER â”€â”€ */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, paddingTop: 8 }}>
        <h1 style={{ flex: 1, fontSize: 42, fontWeight: 200, color: 'var(--accent)', lineHeight: 1.1, letterSpacing: '-0.03em', fontFamily: "'Inter Tight', sans-serif" }}>Música</h1>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', border: `1px solid ${isOnline ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`, borderRadius: 16, fontSize: 11, fontWeight: 600, color: isOnline ? '#10B981' : '#EF4444' }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: isOnline ? '#10B981' : '#EF4444', boxShadow: `0 0 8px ${isOnline ? '#10B981' : '#EF4444'}` }} />
              {isOnline ? 'Conectado' : 'Desconectado'}
            </div>
            <button className="btn-ghost" style={{ padding: 8, borderRadius: '50%' }}><Wifi size={16} /></button>
            <NotificationBell />
          </div>

          <div className="flex items-center gap-4 flex-shrink-0" style={{
            paddingLeft: 16,
            borderLeft: '1px solid var(--border-subtle)',
            position: 'relative'
          }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#10B981', position: 'relative' }} />
            <div style={{ textAlign: 'right' }}>
              <div className="flex items-baseline gap-2 justify-end">
                <span style={{ fontFamily: "'Inter Tight', sans-serif", fontSize: 54, fontWeight: 200, lineHeight: 0.9, color: 'var(--accent)', letterSpacing: '-0.01em' }}>
                  {timeStr}
                </span>
                <span style={{ fontFamily: "'Inter Tight', sans-serif", fontSize: 18, fontWeight: 300, color: 'var(--text-tertiary)', letterSpacing: '0.01em' }}>
                  {secondsStr}
                </span>
              </div>
              <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.12em', marginTop: 6 }}>
                {dateStrCapitalized}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* â”€â”€ NAVIGATION TABS & SEARCH BAR â”€â”€ */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28, borderBottom: '1px solid var(--border-subtle)', paddingBottom: 16, gap: 16 }}>
        <div style={{ display: 'flex', gap: 24, flexShrink: 0 }}>
          {(['biblioteca', 'artistas', 'playlists', 'favoritas', 'explorar'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => { setActiveTab(tab); if (tab !== 'artistas') setSelectedArtist(null); if (tab !== 'playlists') setSelectedPlaylistId(null); }}
              style={{
                background: 'transparent', border: 'none', cursor: 'pointer',
                fontSize: 14, fontWeight: activeTab === tab ? 600 : 500,
                color: activeTab === tab ? 'var(--accent)' : 'var(--text-secondary)',
                position: 'relative', paddingBottom: 16, marginBottom: -16,
                transition: 'all 200ms', textTransform: 'capitalize',
              }}
            >
              {tab === 'explorar' ? 'Explorar & Descargar' : tab}
              {activeTab === tab && (
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, background: 'var(--accent)', borderRadius: 2 }} />
              )}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <div style={{ position: 'relative', width: 280 }}>
            <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
            <input
              type="text"
              placeholder="Buscar canciones, artistas..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && searchQuery.trim()) {
                  const q = searchQuery.trim();
                  const hasLocal = tracks.some(t => fuzzyMatch(t.title, q) || fuzzyMatch(t.artist, q));
                  if (!hasLocal) {
                    setActiveTab('explorar');
                    setSearchMode('query');
                    setTimeout(() => handleSearch(), 0);
                  }
                }
              }}
              className="input-base"
              style={{ width: '100%', height: 38, paddingLeft: 36, fontSize: 12, borderRadius: 10, border: '1px solid var(--border-subtle)', transition: 'all 200ms' }}
            />
            {searchQuery.trim() && (() => {
              const q = searchQuery.trim();
              const localCount = tracks.filter(t => fuzzyMatch(t.title, q) || fuzzyMatch(t.artist, q)).length;
              if (localCount === 0) return null;
              return (
                <div style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', gap: 5, pointerEvents: 'none' }}>
                  <span style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                    {localCount} local{localCount !== 1 ? 's' : ''}
                  </span>
                </div>
              );
            })()}
          </div>

          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button
              onClick={async () => {
                const selected = await open({
                  multiple: true,
                  filters: [{ name: 'Audio', extensions: ['mp3', 'wav', 'ogg', 'm4a', 'flac'] }]
                });
                if (selected && Array.isArray(selected)) {
                  await importLocalTracks(selected);
                } else if (selected && typeof selected === 'string') {
                  await importLocalTracks([selected]);
                }
              }}
              className="btn-secondary hover-glow"
              style={{
                display: 'flex', alignItems: 'center', gap: 8, height: 38, borderRadius: 10,
                fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: '0 18px',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-secondary)', transition: 'all 200ms'
              }}
            >
              <Upload size={16} /> Subir
            </button>

            <button onClick={() => setActiveTab('explorar')} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 8, height: 38, borderRadius: 10, fontSize: 12, fontWeight: 600, padding: '0 18px' }}>
              <Plus size={16} /> Añadir <ChevronDown size={12} style={{ marginLeft: 2 }} />
            </button>
          </div>
        </div>
      </div>

      {/* â”€â”€ MAIN CONTENT AREA â”€â”€ */}
      <div ref={mainContainerRef} style={{ position: 'relative', flex: 1, display: 'flex', minHeight: 0 }}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const rightEdge = rect.right;
          const dist = rightEdge - e.clientX;
          const near = dist < 60 && dist >= 0;
          if (near) {
            setSidebarArrowPos(Math.max(0, Math.min(e.clientY - rect.top - 16, rect.height - 32)));
            if (!showSidebarArrow) setShowSidebarArrow(true);
            if (sidebarArrowTimeoutRef.current) { clearTimeout(sidebarArrowTimeoutRef.current); sidebarArrowTimeoutRef.current = null; }
          } else if (showSidebarArrow && !showRightSidebar) {
            if (!sidebarArrowTimeoutRef.current) {
              sidebarArrowTimeoutRef.current = setTimeout(() => { setShowSidebarArrow(false); }, 500);
            }
          }
        }}
        onMouseLeave={() => {
          if (!showRightSidebar && sidebarArrowTimeoutRef.current) { clearTimeout(sidebarArrowTimeoutRef.current); sidebarArrowTimeoutRef.current = null; }
          setShowSidebarArrow(false);
        }}
      >
      <div style={{ display: 'grid', gridTemplateColumns: showRightSidebar ? '1fr 320px' : '1fr', gap: 24, flex: 1, alignItems: 'flex-start' }}>

        {/* LEFT COLUMN */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

          {/* â”€â”€ STATS ROW (3 CARDS) â”€â”€ */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {[
              { label: 'Canciones', val: tracks.length, sub: 'en tu biblioteca', icon: Music, color: '#6366F1' },
              { label: 'Favoritas', val: tracks.filter(t => t.isFavorite).length, sub: 'guardadas', icon: Heart, color: '#10B981' },
              { label: 'Hoy', val: formatHm(musicListeningTime), sub: 'escuchando Música', icon: Activity, color: '#F59E0B' },
            ].map((s, i) => (
              <div key={i} className="bento-card" style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 10, position: 'relative', overflow: 'hidden' }}>
                <s.icon size={56} style={{ position: 'absolute', bottom: -8, right: -6, color: s.color, opacity: 0.08, pointerEvents: 'none', strokeWidth: 1.5 }} />
                <div style={{ position: 'relative', zIndex: 1, fontSize: 9, fontWeight: 700, color: s.color, textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.75 }}>{s.label}</div>
                <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <div className="stat-value" style={{ fontSize: 26, fontWeight: 650, letterSpacing: '-0.02em', lineHeight: 1.1 }}>{s.val}</div>
                  <div className="stat-subtext" style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 450 }}>{s.sub}</div>
                </div>
              </div>
            ))}
          </div>

          {/* ARTISTAS VIEW */}
          {activeTab === 'artistas' && (
            <div>
              {!selectedArtist ? (
                <div className="bento-card" style={{ padding: '28px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                    <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>Tus Artistas</h3>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                      <button onClick={() => { setEditingArtistId('new'); setEditArtistName(''); setEditArtistImage(''); setArtistSelectedTrackIds([]); setArtistTrackSearch(''); }} className="btn-primary" style={{ height: 32, padding: '0 16px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, borderRadius: 16 }}>
                        <Plus size={13} /> Crear artista
                      </button>
                      <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{artists.length} artistas</span>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
                    {artists.map(artist => {
                      const artistTracks = tracks.filter(t => t.artist === artist.name);
                      return (
                        <div key={artist.id} className="hover-lift bento-card" style={{ padding: '32px 20px', borderRadius: 16, border: '1px solid var(--border-subtle)', transition: 'all 250ms', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, position: 'relative', cursor: 'pointer' }}
                          onClick={() => setSelectedArtist(artist.name)}>
                          <div style={{ width: 110, height: 110, borderRadius: '50%', background: artist.profileImage ? 'var(--bg-surface)' : `color-mix(in srgb, var(--accent) 30%, var(--bg-deep))`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 32, fontWeight: 700, boxShadow: '0 6px 20px rgba(0,0,0,0.35)', overflow: 'hidden' }}>
                            {artist.profileImage ? <img src={artist.profileImage} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : artist.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{artist.name}</div>
                            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 6 }}>{artistTracks.length} canciones</div>
                          </div>
                          <div style={{ position: 'absolute', top: 10, right: 10, display: 'flex', gap: 6 }}>
                            <button onClick={(e) => { e.stopPropagation(); setEditingArtistId(artist.id); setEditArtistName(artist.name); setEditArtistImage(artist.profileImage || ''); setArtistSelectedTrackIds(tracks.filter(t => t.artist === artist.name).map(t => t.id)); setArtistTrackSearch(''); }} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '50%', width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)', cursor: 'pointer' }}><Edit2 size={13} /></button>
                            <button onClick={(e) => { e.stopPropagation(); setConfirmDelete({ type: 'artist', id: artist.id, name: artist.name }); }} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '50%', width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--error)', cursor: 'pointer' }}><Trash2 size={13} /></button>
                          </div>
                        </div>
                      );
                    })}
                    {artists.length === 0 && (
                      <div style={{ gridColumn: '1 / -1', padding: '48px 20px', textAlign: 'center', color: 'var(--text-muted)', borderRadius: 12, border: '1px dashed var(--border-subtle)' }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>No tienes artistas guardados</div>
                        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4 }}>Puedes agregar artistas desde Editar Canción.</div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (() => {
                const artistTracks = tracks.filter(t => t.artist === selectedArtist);
                const firstCover = artistTracks.find(t => t.coverImage)?.coverImage;
                const isPlayingAll = currentTrackId && artistTracks.some(t => t.id === currentTrackId) && isPlayingMusic;
                return (
                  <div>
                    <div className="bento-card" style={{ padding: '28px 32px 32px' }}>
                      <button onClick={() => setSelectedArtist(null)} className="btn-ghost" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 20, padding: '6px 12px', borderRadius: 8, transition: 'color 150ms' }}
                        onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
                        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-tertiary)'}>
                        <ArrowLeft size={14} /> Volver a artistas
                      </button>

                      <div style={{ display: 'flex', gap: 28, alignItems: 'flex-end', marginBottom: 28 }}>
                        <div style={{ width: 148, height: 148, borderRadius: '50%', background: firstCover ? `linear-gradient(135deg, color-mix(in srgb, var(--accent) 70%, #fff), color-mix(in srgb, var(--accent) 20%, var(--bg-deep)))` : `color-mix(in srgb, var(--accent) 25%, var(--bg-deep))`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 44, fontWeight: 700, boxShadow: '0 8px 32px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.06)', flexShrink: 0, overflow: 'hidden' }}>
                          {artists.find(a => a.name === selectedArtist)?.profileImage ? <img src={artists.find(a => a.name === selectedArtist)?.profileImage} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : selectedArtist.slice(0, 2).toUpperCase()}
                        </div>
                        <div style={{ flex: 1 }}>
                          <span style={{ fontSize: 10, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 600, marginBottom: 6, display: 'block', opacity: 0.7 }}>Artista</span>
                          <h2 style={{ fontSize: 32, fontWeight: 750, color: 'var(--text-primary)', margin: 0, lineHeight: 1.15, letterSpacing: '-0.02em' }}>{selectedArtist}</h2>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                            <span style={{ fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 500 }}>{artistTracks.length} {artistTracks.length === 1 ? 'canción' : 'canciones'}</span>
                            <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'var(--text-muted)' }} />
                            <span style={{ fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 500 }}>{formatTime(artistTracks.reduce((a, t) => a + (t.duration || 0), 0))}</span>
                          </div>
                          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                            <button onClick={() => {
                              if (artistTracks.length === 0) return;
                              if (isPlayingAll) { toggleMusicPlayback(); return; }
                              const allIds = artistTracks.map(t => t.id);
                              setQueueSource({ pool: allIds, name: selectedArtist || undefined });
                              const rest = allIds.slice(1);
                              setMusicQueue(rest);
                              handlePlayWithTabCb(allIds[0]);
                            }} style={{ height: 34, padding: '0 22px', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, borderRadius: 18, background: 'linear-gradient(135deg, var(--accent), color-mix(in srgb, var(--accent) 85%, #fff))', color: '#fff', border: 'none', cursor: 'pointer', boxShadow: '0 2px 10px color-mix(in srgb, var(--accent) 25%, transparent)', transition: 'all 200ms' }}
                              onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 16px color-mix(in srgb, var(--accent) 30%, transparent)'; e.currentTarget.style.transform = 'scale(1.03)'; }}
                              onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 2px 10px color-mix(in srgb, var(--accent) 25%, transparent)'; e.currentTarget.style.transform = 'scale(1)'; }}>
                              {isPlayingAll ? <Pause size={14} fill="#fff" /> : <Play size={14} fill="#fff" />}
                              {isPlayingAll ? 'Reproduciendo' : 'Reproducir todo'}
                            </button>
                          </div>
                        </div>
                      </div>

                      <div style={{ width: '100%', height: 1, background: 'linear-gradient(90deg, transparent, var(--border-soft), transparent)', marginBottom: 20 }} />

                      {/* Track List */}
                      {artistTracks.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                          {artistTracks.map((t, idx) => {
                            const isPlaying = currentTrackId === t.id && isPlayingMusic;
                            return (
                              <div key={t.id} onClick={() => { const pool = artistTracks.map(x => x.id); setQueueSource({ pool, name: selectedArtist || undefined }); handlePlayWithTabCb(t.id); }} onContextMenu={(e) => openTrackMenu(e, t.id)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 8, cursor: 'pointer', background: isPlaying ? 'color-mix(in srgb, var(--accent) 12%, transparent)' : 'transparent', transition: 'all 150ms', border: '1px solid transparent' }}
                                onMouseEnter={e => { if (!isPlaying) { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.borderColor = 'var(--border-subtle)'; } }}
                                onMouseLeave={e => { if (!isPlaying) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent'; } }}>
                                <span style={{ fontSize: 11, fontWeight: 500, color: isPlaying ? 'var(--accent)' : 'var(--text-tertiary)', width: 22, textAlign: 'center', fontFamily: "'JetBrains Mono',monospace" }}>{isPlaying ? <Play size={9} fill="var(--accent)" style={{ color: 'var(--accent)' }} /> : idx + 1}</span>
                                <div style={{ width: 34, height: 34, borderRadius: 6, overflow: 'hidden', flexShrink: 0, background: t.coverImage ? 'transparent' : `color-mix(in srgb, var(--accent) 12%, var(--bg-deep))`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.04)' }}>
                                  {t.coverImage ? <img src={t.coverImage} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Music size={14} style={{ color: 'var(--text-muted)', opacity: 0.35 }} />}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontSize: 12, fontWeight: isPlaying ? 600 : 500, color: isPlaying ? 'var(--accent)' : 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', letterSpacing: '-0.01em' }}>{t.title}</div>
                                </div>
                                <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: "'JetBrains Mono',monospace" }}>{formatTime(t.duration)}</span>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div style={{ padding: '36px 20px', textAlign: 'center', color: 'var(--text-muted)', background: 'color-mix(in srgb, var(--accent) 6%, transparent)', borderRadius: 10, border: '1px dashed var(--border-soft)' }}>
                          <Music size={28} style={{ margin: '0 auto 8px', opacity: 0.25 }} />
                          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Sin canciones de este artista</div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* PLAYLISTS VIEW */}
          {activeTab === 'playlists' && (
            <div>
              {!selectedPlaylistId ? (
                <div className="bento-card" style={{ padding: '28px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                    <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>Tus Playlists</h3>
                    <button onClick={() => { setShowCreatePlaylist(true); setNewPlaylistName(''); setSelectedTrackIds(new Set()); }} style={{ padding: '8px 18px', borderRadius: 10, fontSize: 12, fontWeight: 600, background: 'var(--accent)', color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Plus size={14} /> Nueva
                    </button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
                    {playlists.map(pl => {
                      const plTracks = pl.trackIds.map(id => tracks.find(t => t.id === id)).filter((t): t is Track => !!t);
                      const firstCover = pl.coverImage || plTracks.find(t => t.coverImage)?.coverImage;
                      return (
                        <div key={pl.id} className="hover-lift bento-card" style={{ padding: '24px', borderRadius: 16, border: '1px solid var(--border-subtle)', transition: 'all 250ms', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, position: 'relative', cursor: 'pointer' }}
                          onClick={() => setSelectedPlaylistId(pl.id)}>
                          <div style={{ width: 150, height: 150, borderRadius: 16, background: firstCover ? 'var(--bg-surface)' : `color-mix(in srgb, var(--accent) 25%, var(--bg-deep))`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 28px rgba(0,0,0,0.35)', overflow: 'hidden', position: 'relative' }}>
                            {firstCover ? <img src={firstCover} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Music size={40} style={{ color: 'var(--text-muted)', opacity: 0.3 }} />}
                          </div>
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{pl.name}</div>
                            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4 }}>{plTracks.length} canciones</div>
                          </div>
                          <div style={{ position: 'absolute', top: 10, right: 10, display: 'flex', gap: 6 }}>
                            <button onClick={(e) => { e.stopPropagation(); setEditingPlaylistId(pl.id); setShowCreatePlaylist(true); setNewPlaylistName(pl.name); setPlaylistCoverData(pl.coverImage || ''); setSelectedTrackIds(new Set(pl.trackIds)); }} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '50%', width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)', cursor: 'pointer' }}><Edit2 size={13} /></button>
                            <button onClick={(e) => { e.stopPropagation(); setConfirmDelete({ type: 'playlist', id: pl.id, name: pl.name }); }} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '50%', width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--error)', cursor: 'pointer' }}><Trash2 size={13} /></button>
                          </div>
                        </div>
                      );
                    })}
                    {playlists.length === 0 && (
                      <div style={{ gridColumn: '1 / -1', padding: '60px 20px', textAlign: 'center', color: 'var(--text-muted)', borderRadius: 12, border: '1px dashed var(--border-subtle)' }}>
                        <Music size={40} style={{ margin: '0 auto 12px', opacity: 0.2 }} />
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>No tienes playlists</div>
                        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4 }}>Crea una playlist con tus canciones favoritas.</div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (() => {
                const pl = playlists.find(p => p.id === selectedPlaylistId);
                if (!pl) return null;
                const plTracks = pl.trackIds.map(id => tracks.find(t => t.id === id)).filter((t): t is Track => !!t);
                const firstCover = pl.coverImage || plTracks.find(t => t.coverImage)?.coverImage;
                const isPlayingAll = currentTrackId && plTracks.some(t => t.id === currentTrackId) && isPlayingMusic;
                return (
                  <div>
                    <div className="bento-card" style={{ padding: '28px 32px 32px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
                        <button onClick={() => setSelectedPlaylistId(null)} className="btn-ghost" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-tertiary)', padding: '6px 12px', borderRadius: 8, transition: 'color 150ms' }}
                          onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
                          onMouseLeave={e => e.currentTarget.style.color = 'var(--text-tertiary)'}>
                          <ArrowLeft size={14} /> Volver a playlists
                        </button>
                        <button onClick={() => { setEditingPlaylistId(pl.id); setShowCreatePlaylist(true); setNewPlaylistName(pl.name); setPlaylistCoverData(pl.coverImage || ''); setSelectedTrackIds(new Set(pl.trackIds)); }} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '6px 12px', fontSize: 11, color: 'var(--text-tertiary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Edit2 size={12} /> Editar
                        </button>
                      </div>

                      <div style={{ display: 'flex', gap: 32, alignItems: 'flex-end', marginBottom: 32 }}>
                        <div style={{ width: 200, height: 200, borderRadius: 18, background: firstCover ? 'var(--bg-surface)' : `color-mix(in srgb, var(--accent) 25%, var(--bg-deep))`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 12px 48px rgba(0,0,0,0.5)', flexShrink: 0, overflow: 'hidden', position: 'relative', cursor: 'pointer' }}
                          onClick={() => {
                            const input = document.createElement('input');
                            input.type = 'file';
                            input.accept = 'image/*';
                            input.onchange = (e: any) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const reader = new FileReader();
                                reader.onload = (e) => updatePlaylist(pl.id, { coverImage: e.target?.result as string });
                                reader.readAsDataURL(file);
                              }
                            };
                            input.click();
                          }}>
                          {firstCover ? <img src={firstCover} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Music size={56} style={{ color: 'var(--text-muted)', opacity: 0.25 }} />}
                          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.3)', opacity: 0, transition: 'opacity 200ms', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = '1'}
                            onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = '0'}>
                            <Upload size={24} style={{ color: '#fff', opacity: 0.8 }} />
                          </div>
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8, opacity: 0.8 }}>PLAYLIST</div>
                          <h2 style={{ fontSize: 34, fontWeight: 800, color: 'var(--text-primary)', margin: 0, lineHeight: 1.15 }}>{pl.name}</h2>
                          <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 8 }}>{plTracks.length} canciones</div>
                          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                            <button onClick={() => {
                              if (plTracks.length === 0) return;
                              if (isPlayingAll) { toggleMusicPlayback(); return; }
                              const allIds = plTracks.map(t => t.id);
                              setQueueSource({ pool: allIds, name: pl.name });
                              const rest = allIds.slice(1);
                              setMusicQueue(rest);
                              handlePlayWithTabCb(allIds[0]);
                            }} className="btn-primary" style={{ height: 38, padding: '0 28px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, borderRadius: 20 }}>
                              {isPlayingAll ? <Pause size={15} fill="#fff" /> : <Play size={15} fill="#fff" />}
                              {isPlayingAll ? 'Reproduciendo' : 'Reproducir'}
                            </button>
                          </div>
                        </div>
                      </div>

                      {plTracks.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {plTracks.map((t, idx) => {
                            const isPlaying = currentTrackId === t.id && isPlayingMusic;
                            return (
                              <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 10, cursor: 'pointer', background: isPlaying ? 'var(--accent-dim)' : 'transparent', transition: 'background 150ms' }}
                                onClick={() => { const pool = plTracks.map(x => x.id); setQueueSource({ pool, name: pl.name }); handlePlayWithTabCb(t.id); }}
                                onContextMenu={(e) => openTrackMenu(e, t.id)}
                                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-surface)'}
                                onMouseLeave={e => e.currentTarget.style.background = isPlaying ? 'var(--accent-dim)' : 'transparent'}>
                                <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-tertiary)', width: 24, textAlign: 'center' }}>{isPlaying ? <Play size={10} fill="var(--accent)" style={{ color: 'var(--accent)' }} /> : idx + 1}</span>
                                <div style={{ width: 36, height: 36, borderRadius: 6, overflow: 'hidden', flexShrink: 0, background: t.coverImage ? 'transparent' : `color-mix(in srgb, var(--accent) 15%, var(--bg-deep))`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  {t.coverImage ? <img src={t.coverImage} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Music size={16} style={{ color: 'var(--text-muted)', opacity: 0.4 }} />}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontSize: 13, fontWeight: isPlaying ? 600 : 500, color: isPlaying ? 'var(--accent)' : 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</div>
                                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 1 }}>{t.artist}</div>
                                </div>
                                <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{formatTime(t.duration)}</span>
                                <button onClick={(e) => {
                                  e.stopPropagation();
                                  const newIds = pl.trackIds.filter(id => id !== t.id);
                                  updatePlaylist(pl.id, { trackIds: newIds });
                                }} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4, opacity: 0.5 }} title="Quitar de la playlist">
                                  <X size={14} />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                  ) : (
                    <div style={{ gridColumn: '1 / -1', padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      <Music size={32} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>No hay canciones</div>
                      <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4 }}>Añade Música desde Explorar o sube audio local</div>
                      {searchQuery && (
                        <button onClick={() => { setActiveTab('explorar'); setSearchMode('query'); }} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 24px', borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: 'var(--accent)', color: '#fff', border: 'none', marginTop: 20, transition: 'all 200ms' }}>
                          <Globe size={14} /> Buscar &ldquo;{searchQuery}&rdquo; en internet
                        </button>
                      )}
                    </div>
                  )}
                    </div>
                  </div>
                );
              })()}

              {/* Create/Edit Playlist Dialog */}
              {showCreatePlaylist && (() => {
                const isEdit = !!editingPlaylistId;
                const closePL = () => { setShowCreatePlaylist(false); setPlaylistStep(0); setPlaylistCoverData(''); setNewPlaylistName(''); setSelectedTrackIds(new Set()); setEditingPlaylistId(null); };
                const filteredPLTracks = tracks.filter(t => {
                  if (playlistArtistFilter && t.artist !== playlistArtistFilter) return false;
                  if (playlistSongSearch && !fuzzyMatch(t.title, playlistSongSearch) && !fuzzyMatch(t.artist || '', playlistSongSearch)) return false;
                  return true;
                });
                const SongPickerListInner = ({ items }: { items: Track[] }) => (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {items.length === 0 && (
                      <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 11.5, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                        <Music size={20} strokeWidth={1.2} style={{ opacity: 0.3 }} />
                        <span>No hay canciones</span>
                      </div>
                    )}
                    {items.map(t => {
                      const sel = selectedTrackIds.has(t.id);
                      return (
                        <div key={t.id} onClick={() => setSelectedTrackIds(prev => { const next = new Set(prev); sel ? next.delete(t.id) : next.add(t.id); return next; })}
                          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 8px', borderRadius: 8, cursor: 'pointer', transition: 'all 150ms', background: sel ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : 'transparent' }}
                          onMouseEnter={e => { if (!sel) e.currentTarget.style.background = 'var(--bg-hover)'; }}
                          onMouseLeave={e => { if (!sel) e.currentTarget.style.background = sel ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : 'transparent'; }}>
                          <div style={{ width: 16, height: 16, borderRadius: 4, border: sel ? 'none' : '1.5px solid var(--border-default)', background: sel ? 'var(--accent)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 150ms' }}>
                            {sel && <Check size={10} strokeWidth={3} color="#fff" />}
                          </div>
                          <div style={{ width: 30, height: 30, borderRadius: 5, overflow: 'hidden', flexShrink: 0, background: 'var(--bg-deep)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {t.coverImage ? <img src={t.coverImage} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Music size={12} color="var(--text-muted)" style={{ opacity: 0.35 }} />}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 500, color: sel ? 'var(--accent)' : 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.3 }}>{t.title}</div>
                            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.3 }}>{t.artist}</div>
                          </div>
                          <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', flexShrink: 0, opacity: 0.7 }}>{formatTime(t.duration)}</span>
                        </div>
                      );
                    })}
                  </div>
                );
                return (
                <div style={{ position: 'fixed', inset: 0, zIndex: 10050, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}
                  onClick={(e) => { if (e.target === e.currentTarget) closePL(); }}>
                  <div style={{ width: 'min(480px, 92vw)', maxHeight: 'calc(100vh - 48px)', display: 'flex', flexDirection: 'column', background: 'var(--bg-surface)', borderRadius: 16, border: '1px solid var(--border-default)', boxShadow: '0 32px 80px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.04) inset', overflow: 'hidden' }}>

                    {/* ── Cover Hero ── */}
                    <div style={{ position: 'relative', height: 150, flexShrink: 0, overflow: 'hidden' }}
                      onClick={() => document.getElementById('pl-cover-input')?.click()}>
                      {playlistCoverData ? (
                        <>
                          <img src={playlistCoverData} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.55) 0%, transparent 50%)' }} />
                          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'opacity 200ms', cursor: 'pointer' }}
                            onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                            onMouseLeave={e => e.currentTarget.style.opacity = '0'}
                            onClick={(e) => { e.stopPropagation(); document.getElementById('pl-cover-input')?.click(); }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px', borderRadius: 10, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.15)' }}>
                              <Image size={13} color="#fff" />
                              <span style={{ fontSize: 11.5, fontWeight: 600, color: '#fff' }}>Cambiar portada</span>
                            </div>
                          </div>
                        </>
                      ) : (
                        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, background: 'var(--bg-deep)', cursor: 'pointer', border: '2px dashed var(--border-subtle)', boxSizing: 'border-box', transition: 'border-color 200ms, background 200ms' }}
                          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.background = 'color-mix(in srgb, var(--accent) 5%, var(--bg-deep))'; }}
                          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.background = 'var(--bg-deep)'; }}>
                          <div style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Image size={18} strokeWidth={1.5} color="var(--text-muted)" />
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                            <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-secondary)' }}>Subir portada</span>
                            <span style={{ fontSize: 9.5, color: 'var(--text-tertiary)' }}>Click para seleccionar imagen</span>
                          </div>
                        </div>
                      )}
                      <input id="pl-cover-input" type="file" accept="image/*" style={{ display: 'none' }} onChange={e => {
                        const file = e.target.files?.[0]; if (file) { const r = new FileReader(); r.onload = ev => setPlaylistCoverData(ev.target?.result as string); r.readAsDataURL(file); }
                      }} />
                      {/* Close button */}
                      <button onClick={(e) => { e.stopPropagation(); closePL(); }}
                        style={{ position: 'absolute', top: 10, right: 10, width: 30, height: 30, borderRadius: 9, background: playlistCoverData ? 'rgba(0,0,0,0.4)' : 'var(--bg-elevated)', backdropFilter: playlistCoverData ? 'blur(6px)' : 'none', border: playlistCoverData ? '1px solid rgba(255,255,255,0.12)' : '1px solid var(--border-subtle)', color: playlistCoverData ? '#fff' : 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 150ms' }}
                        onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.08)'; }}
                        onMouseLeave={e => { e.currentTarget.style.transform = ''; }}>
                        <X size={14} />
                      </button>
                    </div>

                    {/* ── Name + Info ── */}
                    <div style={{ padding: '14px 20px 12px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
                      <input autoFocus value={newPlaylistName} onChange={e => setNewPlaylistName(e.target.value)}
                        placeholder="Nombre de la playlist"
                        style={{ width: '100%', background: 'transparent', border: 'none', fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', outline: 'none', padding: 0, fontFamily: "'Inter Tight', sans-serif", lineHeight: 1.3 }}
                        onKeyDown={e => { if (e.key === 'Enter' && newPlaylistName.trim() && !isEdit) setPlaylistStep(1); }} />
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                        <span style={{ fontSize: 10.5, color: 'var(--text-tertiary)' }}>
                          {isEdit ? `${selectedTrackIds.size} de ${tracks.length} canciones` : playlistStep === 0 ? `${selectedTrackIds.size} seleccionadas` : `${selectedTrackIds.size} seleccionadas`}
                        </span>
                        {!isEdit && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            {[0, 1].map((s) => (
                              <React.Fragment key={s}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                  <div style={{ width: 18, height: 18, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8.5, fontWeight: 700, flexShrink: 0, transition: 'all 250ms',
                                    background: playlistStep >= s ? 'var(--accent)' : 'var(--bg-hover)',
                                    color: playlistStep >= s ? '#fff' : 'var(--text-muted)',
                                    border: playlistStep >= s ? 'none' : '1px solid var(--border-subtle)' }}>
                                    {playlistStep > s ? <Check size={9} strokeWidth={3} /> : s === 0 ? '1' : '2'}
                                  </div>
                                </div>
                                {s === 0 && (
                                  <div style={{ width: 24, height: 1.5, borderRadius: 1, background: playlistStep > 0 ? 'var(--accent)' : 'var(--border-subtle)', transition: 'background 300ms' }} />
                                )}
                              </React.Fragment>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* ── Scrollable Content ── */}
                    <div style={{ flex: 1, overflowY: 'auto', padding: '10px 16px' }} className="no-scrollbar">

                      {/* EDIT MODE: Song list */}
                      {isEdit && (
                        <SongPickerListInner items={tracks} />
                      )}

                      {/* CREATE Step 1: Song selection */}
                      {!isEdit && playlistStep === 1 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <div style={{ position: 'relative', flex: 1 }}>
                              <Search size={12} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)', pointerEvents: 'none' }} />
                              <input value={playlistSongSearch} onChange={e => setPlaylistSongSearch(e.target.value)} placeholder="Buscar..."
                                style={{ width: '100%', height: 32, fontSize: 11.5, paddingLeft: 28, borderRadius: 8, background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }} />
                            </div>
                            <select value={playlistArtistFilter} onChange={e => setPlaylistArtistFilter(e.target.value)}
                              style={{ height: 32, padding: '0 10px', fontSize: 10.5, background: 'var(--bg-elevated)', color: 'var(--text-primary)', border: '1px solid var(--border-default)', outline: 'none', borderRadius: 8, cursor: 'pointer', colorScheme: 'dark', minWidth: 100 }}>
                              <option value="">Todos</option>
                              {artists.map(a => <option key={a.id} value={a.name}>{a.name}</option>)}
                            </select>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
                              {selectedTrackIds.size} de {tracks.length}
                            </span>
                            <button onClick={() => setSelectedTrackIds(prev => prev.size === tracks.length ? new Set() : new Set(tracks.map(t => t.id)))} className="btn-ghost" style={{ fontSize: 10, color: 'var(--accent)', padding: '2px 8px', height: 22 }}>
                              {selectedTrackIds.size === tracks.length ? 'Limpiar' : 'Seleccionar todo'}
                            </button>
                          </div>
                          <SongPickerListInner items={filteredPLTracks} />
                        </div>
                      )}
                    </div>

                    {/* ── Footer ── */}
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center', padding: '12px 20px', borderTop: '1px solid var(--border-subtle)', flexShrink: 0, background: 'var(--bg-surface)' }}>
                      {!isEdit && playlistStep > 0 && (
                        <button onClick={() => setPlaylistStep(s => s - 1)} className="btn-ghost" style={{ marginRight: 'auto', height: 34, padding: '0 14px', fontSize: 12, whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <ChevronLeft size={14} /> Atrás
                        </button>
                      )}
                      <button onClick={closePL}
                        className="btn-ghost"
                        style={{ height: 34, padding: '0 16px', fontSize: 12, whiteSpace: 'nowrap', display: 'flex', alignItems: 'center' }}>
                        Cancelar
                      </button>
                      {isEdit ? (
                        <button onClick={() => {
                          const name = newPlaylistName.trim();
                          if (!name) return;
                          updatePlaylist(editingPlaylistId, { name, coverImage: playlistCoverData || undefined, trackIds: Array.from(selectedTrackIds) });
                          closePL();
                        }} className="btn-primary" style={{ height: 34, padding: '0 20px', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 5 }}>
                          <Check size={14} /> Guardar
                        </button>
                      ) : playlistStep === 0 ? (
                        <button onClick={() => { if (!newPlaylistName.trim()) return; setPlaylistStep(1); }}
                          className="btn-primary" style={{ height: 34, padding: '0 20px', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 5, opacity: !newPlaylistName.trim() ? 0.4 : 1, pointerEvents: !newPlaylistName.trim() ? 'none' : 'auto' }}>
                          Siguiente <ChevronRight size={14} />
                        </button>
                      ) : (
                        <button onClick={() => {
                          const name = newPlaylistName.trim();
                          if (!name) return;
                          addPlaylist(name, Array.from(selectedTrackIds), playlistCoverData || undefined);
                          closePL();
                        }} className="btn-primary" style={{ height: 34, padding: '0 20px', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 5 }}>
                          <Check size={14} /> Crear playlist
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                );
              })()}
            </div>
          )}

          {/* RECIENTES ALBUMS GRID */}
          {(activeTab === 'biblioteca' || activeTab === 'favoritas') && (
            <div className="bento-card" style={{ padding: '20px 24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div className="section-header" style={{ marginBottom: 0, fontSize: 13, color: 'var(--text-primary)' }}>Recientes</div>
                <span onClick={() => setShowAllRecents(!showAllRecents)} className="text-accent" style={{ fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>{showAllRecents ? 'Ver menos' : 'Ver todo'}</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16, minWidth: 0 }}>
                {recentTracks.length > 0 ? recentTracks.slice(0, showAllRecents ? 10 : 5).map((track, i) => (
                  <div key={track.id} onClick={() => handlePlayWithTabCb(track.id)} style={{ minWidth: 0, padding: 14, borderRadius: 14, cursor: 'pointer', transition: 'all 250ms cubic-bezier(0.16, 1, 0.3, 1)', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column' }} onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.borderColor = 'var(--border-strong)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.25)'; }} onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.boxShadow = 'none'; }}>
                    <div style={{ width: '100%', aspectRatio: '1/1', borderRadius: 10, overflow: 'hidden', position: 'relative', background: 'var(--bg-deep)' }}>
                      {track.coverImage ? <img src={track.coverImage} alt={track.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Music size={24} style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', color: 'var(--text-muted)', opacity: 0.3 }} />}
                      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.12)', borderRadius: 10, opacity: 0, transition: 'opacity 180ms', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        onMouseEnter={e => { e.currentTarget.style.opacity = '1'; }}
                        onMouseLeave={e => { e.currentTarget.style.opacity = '0'; }}>
                        <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 10px rgba(0,0,0,0.4)' }}>
                          <Play size={18} fill="#fff" style={{ marginLeft: 2 }} />
                        </div>
                      </div>
                    </div>
                    <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 3 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.3, height: '1.3em' }}>{track.title}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.3, height: '1.3em' }}>{track.artist}</div>
                    </div>
                  </div>
                )) : (
                  <div style={{ gridColumn: '1 / -1', padding: '30px 20px', textAlign: 'center', color: 'var(--text-muted)', borderRadius: 12, border: '1px dashed var(--border-subtle)' }}>
                    <Music size={28} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>No hay canciones Aún</div>
                    <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4 }}>Sube Música desde "Explorar" o "Subir audio local"</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* SONGS TABLE / CARDS GRID */}
          {(activeTab === 'biblioteca' || activeTab === 'favoritas') && (
            <div className="bento-card" style={{ padding: '20px 24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <span className="section-header" style={{ marginBottom: 0, fontSize: 14, color: 'var(--text-primary)' }}>
                  {activeTab === 'favoritas' ? 'Tus Canciones Favoritas' : 'Biblioteca de Canciones'} ({displayTracks.length})
                </span>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  {activeTab === 'favoritas' && displayTracks.length > 0 && (
                    <button
                      onClick={() => {
                        if (isPlayingMusic && currentTrackId && displayTracks.some(t => t.id === currentTrackId)) { toggleMusicPlayback(); return; }
                        const allIds = displayTracks.map(t => t.id);
                        setQueueSource({ pool: allIds, name: 'Favoritas' });
                        const rest = allIds.slice(1);
                        setMusicQueue(rest);
                        handlePlayWithTabCb(allIds[0]);
                      }}
                      className="btn-primary"
                      style={{ height: 30, padding: '0 16px', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4, borderRadius: 15 }}
                    >
                      {isPlayingMusic && currentTrackId && displayTracks.some(t => t.id === currentTrackId) ? <Pause size={11} fill="#fff" /> : <Play size={11} fill="#fff" />}
                      {isPlayingMusic && currentTrackId && displayTracks.some(t => t.id === currentTrackId) ? 'Reproduciendo' : 'Reproducir todo'}
                    </button>
                  )}
                  {activeTab === 'biblioteca' && libraryTracks.length > 25 && (
                    <button
                      onClick={() => setShowAllLibrary(!showAllLibrary)}
                      className="btn-ghost"
                      style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600, padding: '4px 12px' }}
                    >
                      {showAllLibrary ? 'Ver menos' : `Ver todo (${libraryTracks.length})`}
                    </button>
                  )}
                  <div style={{ display: 'flex', gap: 6, padding: 4, borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
                    <select
                      value={selectedArtist || ''}
                      onChange={(e) => setSelectedArtist(e.target.value || null)}
                      className="btn-ghost"
                      style={{ height: 28, padding: '0 8px', fontSize: 11, background: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border-soft)', outline: 'none', borderRadius: 6, minWidth: 130, cursor: 'pointer' }}
                    >
                      <option value="" style={{ background: 'var(--bg-surface)', color: 'var(--text-secondary)' }}>Filtrar Artista...</option>
                      {artists.map(a => (
                        <option key={a.id} value={a.name} style={{ background: 'var(--bg-surface)', color: 'var(--text-primary)' }}>{a.name}</option>
                      ))}
                    </select>
                    <div style={{ width: 1, height: 16, background: 'var(--border-subtle)', alignSelf: 'center', margin: '0 4px' }} />
                    <button onClick={() => setViewMode('lista')} className="btn-ghost" style={{ padding: '4px 8px', borderRadius: 6, background: viewMode === 'lista' ? 'var(--bg-surface)' : 'transparent', color: viewMode === 'lista' ? 'var(--accent)' : 'var(--text-tertiary)' }}>
                      <List size={14} />
                    </button>
                    <button onClick={() => setViewMode('bloques')} className="btn-ghost" style={{ padding: '4px 8px', borderRadius: 6, background: viewMode === 'bloques' ? 'var(--bg-surface)' : 'transparent', color: viewMode === 'bloques' ? 'var(--accent)' : 'var(--text-tertiary)' }}>
                      <Grid size={14} />
                    </button>
                  </div>
                </div>
              </div>

              {viewMode === 'lista' ? (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '40px 3.5fr 1.5fr 80px 130px', padding: '0 12px 12px', borderBottom: '1px solid var(--border-subtle)', fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                    <span></span>
                    <span>Título</span>
                    <span>Artista</span>
                    <span>Duración</span>
                    <span style={{ textAlign: 'right' }}>Acciones</span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {displayTracks.length > 0 ? (
                      <DndContext sensors={librarySensors} collisionDetection={closestCenter} onDragEnd={handleLibraryDragEnd} modifiers={[restrictToParentElement]}>
                        <SortableContext items={displayTracks.map(t => t.id)} strategy={verticalListSortingStrategy}>
                          {displayTracks.map((track, i) => {
                            const isPlaying = currentTrackId === track.id && isPlayingMusic;
                            return (
                              <SortableLibraryRow
                                key={track.id}
                                track={track}
                                index={i}
                                isPlaying={isPlaying}
                                isOnline={isOnline}
                                formatTime={formatTime}
                                onSelect={() => handlePlayWithTabCb(track.id)}
                                onMenu={(e) => openTrackMenu(e, track.id)}
                                onToggleFav={() => toggleTrackFavorite(track.id)}
                                onEdit={() => { setEditingTrackId(track.id); setEditTitle(track.title); setEditArtist(track.artist); setEditCover(track.coverImage || ''); }}
                                onDelete={() => setConfirmDelete({ type: 'track', id: track.id, name: track.title })}
                              />
                            );
                          })}
                        </SortableContext>
                      </DndContext>
                    ) : (
                      <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                        <Music size={32} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>No hay canciones</div>
                        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4 }}>Añade Música desde Explorar o sube audio local</div>
                        {searchQuery && (
                          <button onClick={() => { setActiveTab('explorar'); setSearchMode('query'); }} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 24px', borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: 'var(--accent)', color: '#fff', border: 'none', marginTop: 20, transition: 'all 200ms' }}>
                            <Globe size={14} /> Buscar &ldquo;{searchQuery}&rdquo; en internet
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
                  {displayTracks.length > 0 ? displayTracks.map((track, i) => {
                    const isPlaying = currentTrackId === track.id && isPlayingMusic;
                    const cloudOffline = !isOnline && track.source !== 'local';
                    const cloudBorder = track.source !== 'local' && !isPlaying
                      ? '1.5px solid color-mix(in srgb, var(--accent) 60%, transparent)'
                      : '1px solid var(--border-subtle)';
                    return (
                      <div
                        key={track.id}
                        onClick={() => handlePlayWithTabCb(track.id)}
                        onContextMenu={(e) => openTrackMenu(e, track.id)}
                        style={{
                          padding: '10px 10px 12px', display: 'flex', flexDirection: 'column', gap: 10, cursor: 'pointer',
                          borderRadius: 12,
                          background: isPlaying ? 'var(--accent-dim)' : 'var(--bg-deep)',
                          border: isPlaying ? '1px solid var(--accent-glow)' : cloudBorder,
                          transition: 'transform 200ms ease, box-shadow 250ms ease, border-color 200ms',
                          boxShadow: isPlaying ? '0 4px 16px rgba(0,0,0,0.12)' : '0 1px 3px rgba(0,0,0,0.04)',
                          opacity: cloudOffline ? 0.45 : 1,
                          pointerEvents: cloudOffline ? 'none' : undefined,
                          position: 'relative',
                        }}
                        onMouseEnter={e => { if (!isPlaying) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.10)'; e.currentTarget.style.borderColor = 'var(--accent-glow)'; } }}
                        onMouseLeave={e => { if (!isPlaying) { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)'; e.currentTarget.style.borderColor = 'var(--border-subtle)'; } }}
                      >
                        {cloudOffline && (
                          <div style={{ position: 'absolute', top: 8, left: 8, fontSize: 8.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--error)', background: 'var(--bg-surface)', border: '1px solid color-mix(in srgb, var(--error) 40%, transparent)', borderRadius: 999, padding: '2px 8px', zIndex: 2 }}>
                            No hay conexión a internet
                          </div>
                        )}
                        {!cloudOffline && track.source !== 'local' && (
                          <div style={{ position: 'absolute', top: -1, left: -1, bottom: -1, width: 3, borderRadius: '12px 0 0 12px', background: 'var(--accent)', opacity: 0.55, pointerEvents: 'none' }} />
                        )}
                        <div style={{ position: 'relative', width: '100%', aspectRatio: '1', borderRadius: 8, overflow: 'hidden', background: 'var(--bg-surface)' }}>
                          {track.coverImage ? <img src={track.coverImage} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} /> : <Music size={28} style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', color: 'var(--text-muted)', opacity: 0.25 }} />}
                          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.25) 0%, transparent 60%)', opacity: 0, transition: 'opacity 180ms', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: 10 }}
                            onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                            onMouseLeave={e => e.currentTarget.style.opacity = isPlaying ? '1' : '0'}>
                            <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'var(--accent)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 10px rgba(0,0,0,0.5)' }}>
                              {isPlaying ? <Pause size={16} fill="#fff" /> : <Play size={16} fill="#fff" style={{ marginLeft: 2 }} />}
                            </div>
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: isPlaying ? 'var(--accent)' : 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', letterSpacing: '-0.01em' }}>{track.title}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>{track.artist} <span style={{ opacity: 0.4 }}>·</span> {formatTime(track.duration)}</div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-subtle)', paddingTop: 8 }}>
                          <button onClick={(e) => { e.stopPropagation(); toggleTrackFavorite(track.id); }} className="btn-ghost" style={{ padding: 4, color: track.isFavorite ? 'var(--accent)' : 'var(--text-tertiary)', transition: 'color 200ms' }}>
                            <Heart size={14} style={{ fill: track.isFavorite ? 'var(--accent)' : 'transparent' }} />
                          </button>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button onClick={(e) => { e.stopPropagation(); setEditingTrackId(track.id); setEditTitle(track.title); setEditArtist(track.artist); setEditCover(track.coverImage || ''); }} className="btn-ghost" style={{ padding: 4, color: 'var(--text-tertiary)', transition: 'color 200ms' }} onMouseEnter={e => e.currentTarget.style.color = 'var(--text-secondary)'} onMouseLeave={e => e.currentTarget.style.color = 'var(--text-tertiary)'}>
                              <Edit2 size={13} />
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); setConfirmDelete({ type: 'track', id: track.id, name: track.title }); }} className="btn-ghost" style={{ padding: 4, color: 'var(--text-tertiary)', transition: 'color 200ms' }} onMouseEnter={e => e.currentTarget.style.color = 'var(--danger)'} onMouseLeave={e => e.currentTarget.style.color = 'var(--text-tertiary)'}>
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  }) : (
                    <div style={{ gridColumn: '1 / -1', padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      <Music size={32} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>No hay canciones</div>
                      <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4 }}>Añade Música desde Explorar o sube audio local</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* EXPLORAR & DESCARGAR SECTION */}
          {activeTab === 'explorar' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Web mode banner */}
              {!isTauri() && (
                <div className="bento-card" style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 16px', background: 'color-mix(in srgb, #F59E0B 6%, var(--bg-surface))', borderColor: 'color-mix(in srgb, #F59E0B 20%, var(--border-subtle))' }}>
                  <div style={{ width: 28, height: 28, borderRadius: 7, background: 'color-mix(in srgb, #F59E0B 12%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                    <AlertCircle size={15} style={{ color: '#F59E0B' }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 3 }}>App de escritorio requerida</div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
                      Las descargas usan <code style={{ background: 'rgba(0,0,0,0.2)', padding: '1px 5px', borderRadius: 4, fontSize: 10 }}>yt-dlp</code> que solo funciona en la app de escritorio. Ejecuta <code style={{ background: 'rgba(0,0,0,0.2)', padding: '1px 5px', borderRadius: 4, fontSize: 10 }}>npm run tauri dev</code> para habilitar descargas.
                    </div>
                  </div>
                </div>
              )}

              {/* Input Card */}
              <div className="bento-card" style={{ padding: '20px 24px' }}>
                {/* Mode toggle */}
                <div style={{ display: 'flex', padding: 3, background: 'var(--bg-deep)', borderRadius: 10, border: '1px solid var(--border-subtle)', marginBottom: 16 }}>
                  {([
                    { mode: 'link' as const, icon: Link, label: 'Pegar enlace' },
                    { mode: 'query' as const, icon: Search, label: 'Buscar en YouTube' },
                    { mode: 'spotify' as const, icon: Music, label: 'Spotify' },
                  ]).map(({ mode, icon: Icon, label }) => (
                    <button key={mode} onClick={() => setSearchMode(mode)}
                      style={{
                        flex: 1, height: 36, padding: '0 14px', fontSize: 11.5, fontWeight: 600,
                        fontFamily: "'Inter Tight', sans-serif", letterSpacing: '0.01em',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                        borderRadius: 8, cursor: 'pointer', border: 'none', transition: 'all 200ms ease',
                        background: searchMode === mode ? 'var(--bg-surface)' : 'transparent',
                        color: searchMode === mode ? 'var(--text-primary)' : 'var(--text-muted)',
                        boxShadow: searchMode === mode ? '0 1px 4px rgba(0,0,0,0.15), 0 0 0 1px var(--border-default)' : 'none',
                      }}>
                      <Icon size={13} /> {label}
                    </button>
                  ))}
                </div>

                {/* Unified input area */}
                <div style={{ display: 'flex', gap: 10 }}>
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, borderRadius: 10, padding: '0 14px', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', transition: 'border-color 200ms, box-shadow 200ms' }}
                    onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.boxShadow = '0 0 0 3px color-mix(in srgb, var(--accent) 12%, transparent)'; }}
                    onBlur={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.boxShadow = 'none'; }}>
                    {searchMode === 'spotify'
                      ? <Music size={15} style={{ color: '#1DB954', flexShrink: 0 }} />
                      : searchMode === 'link'
                        ? <Link size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                        : <Search size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />}
                    <input
                      ref={searchMode === 'link' ? urlInputRef : undefined}
                      type="text"
                      value={searchMode === 'spotify' ? spotifyUrl : searchMode === 'link' ? url : searchQuery}
                      onChange={e => searchMode === 'spotify' ? setSpotifyUrl(e.target.value) : searchMode === 'link' ? setUrl(e.target.value) : setSearchQuery(e.target.value)}
                      onKeyDown={searchMode === 'spotify' ? (e => { if (e.key === 'Enter') handleSpotifyImport(); }) : handleKeyDown}
                      placeholder={searchMode === 'spotify' ? 'Pega un enlace de playlist de Spotify...' : searchMode === 'link' ? 'Pega un enlace de YouTube...' : 'Busca canciones, artistas o playlists...'}
                      style={{ border: 'none', background: 'transparent', height: 42, padding: 0, fontSize: 13, flex: 1, color: 'var(--text-primary)', outline: 'none', fontFamily: 'inherit' }}
                    />
                    {((searchMode === 'link' && url) || (searchMode === 'query' && searchQuery) || (searchMode === 'spotify' && spotifyUrl)) && (
                      <button onClick={() => searchMode === 'spotify' ? setSpotifyUrl('') : searchMode === 'link' ? setUrl('') : setSearchQuery('')} style={{ padding: 4, background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', borderRadius: 4, transition: 'color 150ms' }}
                        onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
                        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
                        <X size={14} />
                      </button>
                    )}
                  </div>
                  <button onClick={searchMode === 'spotify' ? handleSpotifyImport : searchMode === 'link' ? handleUrlSubmit : handleSearch}
                    className="btn-primary"
                    style={{ height: 44, padding: '0 22px', display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', borderRadius: 10, background: searchMode === 'spotify' ? '#1DB954' : undefined }}
                    disabled={isLoading}>
                    {isLoading ? <Loader size={15} style={{ animation: 'spin 1s linear infinite' }} /> : searchMode === 'spotify' ? <Music size={15} /> : <Search size={15} />}
                    {searchMode === 'spotify' ? 'Importar' : searchMode === 'link' ? 'Analizar' : 'Buscar'}
                  </button>
                </div>

                {/* Quick tip under input */}
                <div style={{ marginTop: 10, fontSize: 10, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 5 }}>
                  {searchMode === 'spotify'
                    ? <><Music size={10} style={{ color: '#1DB954', opacity: 0.6 }} /> Pega el enlace de una playlist pública de Spotify para importar las canciones</>
                    : searchMode === 'link'
                      ? <><Link size={10} style={{ opacity: 0.4 }} /> Soporta enlaces de YouTube, playlists y canales</>
                      : <><Search size={10} style={{ opacity: 0.4 }} /> Busca en YouTube o pega un enlace directamente</>
                  }
                </div>
              </div>

              {/* Download Options Card */}
              <div className="bento-card" style={{ padding: '20px 24px' }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Sliders size={11} style={{ opacity: 0.5 }} /> Opciones de descarga
                </div>

                {/* Quality + Format row */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                  <div>
                    <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Calidad de audio</div>
                    <div style={{ display: 'flex', gap: 3, padding: 3, background: 'var(--bg-deep)', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
                      {([['7', '96k'], ['5', '128k'], ['3', '192k'], ['0', '320k']] as const).map(([q, label]) => (
                        <button key={q} onClick={() => setAudioQuality(q)}
                          style={{
                            flex: 1, padding: '6px 0', borderRadius: 6, fontSize: 10, fontWeight: 600, textAlign: 'center',
                            background: audioQuality === q ? 'var(--accent)' : 'transparent',
                            color: audioQuality === q ? '#fff' : 'var(--text-tertiary)',
                            border: 'none', cursor: 'pointer', transition: 'all 150ms',
                            boxShadow: audioQuality === q ? '0 1px 4px rgba(0,0,0,0.2)' : 'none',
                          }}>{label}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Formato</div>
                    <div style={{ display: 'flex', gap: 3, padding: 3, background: 'var(--bg-deep)', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
                      {(['mp3', 'm4a'] as const).map(f => (
                        <button key={f} onClick={() => setAudioFormat(f)}
                          style={{
                            flex: 1, padding: '6px 0', borderRadius: 6, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', textAlign: 'center',
                            background: audioFormat === f ? 'var(--accent)' : 'transparent',
                            color: audioFormat === f ? '#fff' : 'var(--text-tertiary)',
                            border: 'none', cursor: 'pointer', transition: 'all 150ms',
                            boxShadow: audioFormat === f ? '0 1px 4px rgba(0,0,0,0.2)' : 'none',
                          }}>{f}</button>
                      ))}
                    </div>
                    {audioFormat === 'm4a' && <div style={{ fontSize: 9, color: 'var(--accent)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3, marginTop: 5 }}><Check size={9} /> AAC de alta calidad</div>}
                  </div>
                </div>

                {/* Cover + Folder row */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 14 }}>
                  <div>
                    <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Portada</div>
                    <button onClick={() => setIncludeCover(!includeCover)}
                      style={{
                        width: '100%', padding: '8px 0', borderRadius: 8, fontSize: 10, fontWeight: 600,
                        background: includeCover ? 'color-mix(in srgb, var(--accent) 12%, transparent)' : 'var(--bg-elevated)',
                        color: includeCover ? 'var(--accent)' : 'var(--text-tertiary)',
                        border: includeCover ? '1px solid color-mix(in srgb, var(--accent) 25%, transparent)' : '1px solid var(--border-subtle)',
                        cursor: 'pointer', transition: 'all 150ms', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                      }}><Image size={11} /> {includeCover ? 'Sí incluir' : 'No incluir'}</button>
                  </div>
                  <div>
                    <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Carpeta de destino</div>
                    <button onClick={handleSelectFolder} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', borderRadius: 8, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', cursor: 'pointer', transition: 'all 150ms', textAlign: 'left' }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.background = 'color-mix(in srgb, var(--accent) 5%, var(--bg-elevated))'; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.background = 'var(--bg-elevated)'; }}>
                      <div style={{ width: 30, height: 30, borderRadius: 7, background: 'color-mix(in srgb, var(--accent) 10%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <FolderOpen size={14} style={{ color: 'var(--accent)' }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{persistentDownloadPath || 'Descargas/OWA Music'}</div>
                        <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 1 }}>Click para cambiar</div>
                      </div>
                      <FolderOpen size={10} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Loading State — only in query mode */}
              {isLoading && searchMode === 'query' && (
                <div className="bento-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '44px 20px', gap: 16 }}>
                  <div style={{ position: 'relative', width: 44, height: 44 }}>
                    <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '2.5px solid var(--border-subtle)' }} />
                    <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '2.5px solid transparent', borderTopColor: 'var(--accent)', animation: 'spin 0.8s linear infinite' }} />
                    <div style={{ position: 'absolute', inset: 6, borderRadius: '50%', border: '2px solid transparent', borderBottomColor: 'color-mix(in srgb, var(--accent) 50%, transparent)', animation: 'spin 1.4s linear infinite reverse' }} />
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>Procesando con Owa Downloader</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>Esto puede tardar unos segundos</div>
                  </div>
                </div>
              )}

              {/* Search Results — only in query mode */}
              {searchMode === 'query' && searchResults.length > 0 && !isLoading && (
                <div className="bento-card" style={{ padding: '16px 20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Resultados</div>
                      <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--accent)', background: 'color-mix(in srgb, var(--accent) 10%, transparent)', padding: '2px 8px', borderRadius: 10, fontVariantNumeric: 'tabular-nums' }}>{searchResults.length}</div>
                    </div>
                    <button onClick={() => setSearchResults([])} style={{ padding: '4px 10px', fontSize: 10, fontWeight: 500, color: 'var(--text-muted)', background: 'none', border: '1px solid var(--border-subtle)', borderRadius: 6, cursor: 'pointer', transition: 'all 150ms' }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-strong)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.color = 'var(--text-muted)'; }}>Limpiar</button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {searchResults.map((r, i) => (
                      <div key={i}
                        onContextMenu={(e) => openSearchMenu(e, r)}
                        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 8px', borderRadius: 10, border: '1px solid transparent', transition: 'all 180ms ease' }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'color-mix(in srgb, var(--bg-elevated) 60%, var(--bg-hover))'; e.currentTarget.style.borderColor = 'var(--border-subtle)'; const ov = e.currentTarget.querySelector('.play-ov') as HTMLElement; if (ov) ov.style.opacity = '1'; const act = e.currentTarget.querySelector('.row-act') as HTMLElement; if (act) act.style.opacity = '1'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent'; const ov = e.currentTarget.querySelector('.play-ov') as HTMLElement; if (ov) ov.style.opacity = '0'; const act = e.currentTarget.querySelector('.row-act') as HTMLElement; if (act) act.style.opacity = '0.35'; }}>
                        {/* Thumbnail with play overlay */}
                        <div style={{ width: 60, height: 42, borderRadius: 8, background: 'var(--bg-deep)', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border-subtle)', position: 'relative', cursor: 'pointer' }}
                          onClick={() => { if (!isOnline) { addNotification('Sin conexión a internet: no se puede reproducir desde YouTube', 'error'); return; } if (isPlayingMusic) toggleMusicPlayback(); setPipUrl(r.id ? `https://www.youtube.com/watch?v=${r.id}` : r.webpage_url, r.title); }}>
                          {r.thumbnail ? <img src={r.thumbnail} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Music size={14} color="var(--text-muted)" style={{ opacity: 0.3 }} />}
                          <div className="play-ov" style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'opacity 180ms', borderRadius: 8 }}>
                            <Play size={15} fill="white" color="white" />
                          </div>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.3, display: 'flex', alignItems: 'center', gap: 6 }}>
                            {(pipPlaying && !!r.id && pipId === r.id) && <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#10B981', boxShadow: '0 0 8px rgba(16,185,129,0.9)', animation: 'pulse 1.6s ease-in-out infinite', flexShrink: 0 }} />}
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</span>
                          </div>
                          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.channel}</span>
                            <span style={{ opacity: 0.3, flexShrink: 0 }}>·</span>
                            <span style={{ fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{formatDuration(r.duration)}</span>
                          </div>
                        </div>
                        <div className="row-act" style={{ display: 'flex', gap: 4, flexShrink: 0, opacity: 0.35, transition: 'opacity 180ms' }}>
                          <button onClick={() => handleDownloadOne(r)} style={{ height: 28, padding: '0 10px', fontSize: 10, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap', borderRadius: 6, border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', color: 'var(--text-secondary)', cursor: 'pointer', transition: 'all 150ms' }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)'; }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}>
                            <Download size={10} /> Descargar
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* No Results — only in query mode */}
              {searchMode === 'query' && searchPerformed && searchResults.length === 0 && !isLoading && (
                <div className="bento-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: '44px 24px' }}>
                  <div style={{ width: 56, height: 56, borderRadius: 14, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Music size={24} style={{ color: 'var(--text-muted)', opacity: 0.4 }} />
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>Sin resultados</div>
                    <div style={{ fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
                      No encontramos &ldquo;{searchQuery}&rdquo; en tu biblioteca o en YouTube.
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => { setSearchMode('link'); setUrl(`https://www.youtube.com/results?search_query=${encodeURIComponent(searchQuery)}`); }}
                      className="btn-primary"
                      style={{ height: 36, padding: '0 20px', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                      <Plus size={14} /> Buscar en YouTube
                    </button>
                    <button onClick={() => { setSearchResults([]); setSearchPerformed(false); setSearchQuery(''); }}
                      className="btn-ghost"
                      style={{ height: 36, padding: '0 14px', fontSize: 12 }}>
                      Nueva búsqueda
                    </button>
                  </div>
                </div>
              )}

              {/* Preview Area */}
              {preview && !isLoading && (
                <div className="bento-card" style={{ padding: 0, overflow: 'hidden' }}>
                  {/* Preview hero */}
                  <div style={{ display: 'flex', gap: 20, padding: '20px 24px', alignItems: 'flex-start' }}>
                    <div style={{ width: 120, height: 120, borderRadius: 12, background: 'var(--bg-deep)', overflow: 'hidden', flexShrink: 0, boxShadow: '0 6px 20px rgba(0,0,0,0.35)', border: '1px solid var(--border-subtle)' }}>
                      {preview.thumbnail ? <img src={preview.thumbnail} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Music size={36} style={{ margin: '42px auto', display: 'block', color: 'var(--text-muted)', opacity: 0.2 }} />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--accent)', background: 'color-mix(in srgb, var(--accent) 10%, transparent)', padding: '3px 8px', borderRadius: 5 }}>
                          {isPlaylist(preview) ? 'Playlist' : 'Video'}
                        </div>
                        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>YouTube</span>
                      </div>
                      <h3 style={{ fontSize: 17, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4, lineHeight: 1.3, fontFamily: "'Inter Tight', sans-serif" }}>{preview.title || 'Sin título'}</h3>
                      <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 14 }}>{preview.channel}</div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={handleDownloadAll} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, height: 36, padding: '0 20px', whiteSpace: 'nowrap' }}>
                          <Download size={14} /> {isPlaylist(preview) ? 'Descargar Playlist' : 'Descargar Audio'}
                        </button>
                        <button onClick={handleSelectFolder} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, height: 36, padding: '0 14px', whiteSpace: 'nowrap' }}>
                          <FolderOpen size={14} /> Carpeta
                        </button>
                        <button onClick={() => setPreview(null)} className="btn-ghost" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, height: 36, padding: '0 12px', color: 'var(--text-muted)' }}>
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Playlist entries */}
                  {isPlaylist(preview) && preview.entries.length > 0 && (
                    <div style={{ borderTop: '1px solid var(--border-subtle)', padding: '14px 24px', maxHeight: 360, overflowY: 'auto' }} className="no-scrollbar">
                      <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span>{preview.entries.length} canciones</span>
                        <button onClick={() => {
                          if (!isOnline) { addNotification('Sin conexión a internet: no se puede reproducir la playlist', 'error'); return; }
                          if (preview.entries.length > 0) {
                            const plUrl = preview.webpage_url?.includes('list=') ? preview.webpage_url : `https://www.youtube.com/playlist?list=${preview.id}`;
                            if (isPlayingMusic) toggleMusicPlayback();
                            setPipUrl(plUrl, preview.title);
                          }
                        }} style={{ fontSize: 9, fontWeight: 500, color: pipPlaying ? '#10B981' : 'var(--accent)', background: pipPlaying ? 'color-mix(in srgb, #10B981 10%, transparent)' : 'color-mix(in srgb, var(--accent) 8%, transparent)', border: `1px solid ${pipPlaying ? 'color-mix(in srgb, #10B981 30%, transparent)' : 'color-mix(in srgb, var(--accent) 15%, transparent)'}`, padding: '2px 8px', borderRadius: 5, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, transition: 'all 150ms' }}
                          onMouseEnter={e => { if (!pipPlaying) e.currentTarget.style.background = 'color-mix(in srgb, var(--accent) 15%, transparent)'; }}
                          onMouseLeave={e => { if (!pipPlaying) e.currentTarget.style.background = 'color-mix(in srgb, var(--accent) 8%, transparent)'; }}>
                          {pipPlaying ? <Pause size={8} fill="currentColor" /> : <Play size={8} fill="currentColor" />} {pipPlaying ? 'Reproduciendo' : 'Reproducir'}
                        </button>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        {preview.entries.map((entry: YouTubeMetadata, i: number) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 7, transition: 'all 150ms', border: '1px solid transparent' }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.borderColor = 'var(--border-subtle)'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent'; }}>
                            <span style={{ fontSize: 10, color: 'var(--text-muted)', width: 20, textAlign: 'right', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{i + 1}</span>
                            <div
                              onClick={() => { if (!isOnline) { addNotification('Sin conexión a internet: no se puede reproducir desde YouTube', 'error'); return; } if (isPlayingMusic) toggleMusicPlayback(); setPipUrl(entry.id ? `https://www.youtube.com/watch?v=${entry.id}` : entry.webpage_url, entry.title); }}
                              style={{ width: 36, height: 26, borderRadius: 5, background: 'var(--bg-deep)', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', position: 'relative' }}
                            >
                              {entry.thumbnail ? <img src={entry.thumbnail} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Music size={10} color="var(--text-muted)" style={{ opacity: 0.3 }} />}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6 }}>
                                {(pipPlaying && !!entry.id && pipId === entry.id) && <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#10B981', boxShadow: '0 0 8px rgba(16,185,129,0.9)', animation: 'pulse 1.6s ease-in-out infinite', flexShrink: 0 }} />}
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.title}</span>
                              </div>
                            </div>
                            <span style={{ fontSize: 9, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{formatDuration(entry.duration)}</span>
                            <button onClick={() => handleDownloadOne(entry)} style={{ padding: 4, background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', borderRadius: 5, transition: 'all 150ms', flexShrink: 0 }}
                              onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent)'; e.currentTarget.style.background = 'color-mix(in srgb, var(--accent) 10%, transparent)'; }}
                              onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'none'; }}><Download size={11} /></button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

            </div>
          )}

        </div>

        {/* RIGHT COLUMN (REPRODUCIENDO, COLA, ESTADÍSTICAS) */}
        {showRightSidebar && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* REPRODUCIENDO CARD — SOLO el reproductor general. Lo del emergente
              vive exclusivamente en su ventana PiP y NUNCA se refleja aquí */}
          {currentTrack ? (() => {
            const nowPlaying = isPlayingMusic;
            const nowTitle = currentTrack.title;
            const nowArtist = currentTrack.artist || '';
            const nowCover = currentTrack.coverImage || '';
            return (
            <div className="bento-card" style={{ padding: '24px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', border: nowPlaying ? '1px solid var(--accent)' : '1px solid var(--border-default)', boxShadow: nowPlaying ? '0 0 0 1px color-mix(in srgb, var(--accent) 18%, transparent), 0 10px 34px rgba(0,0,0,0.22)' : undefined, transition: 'all 300ms' }}>
              <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: nowPlaying ? 'var(--accent)' : 'var(--text-muted)', boxShadow: nowPlaying ? '0 0 8px var(--accent-glow)' : 'none', animation: nowPlaying ? 'pulse 1.6s ease-in-out infinite' : 'none' }} />
                  <span className="section-header" style={{ marginBottom: 0, fontSize: 12, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    {nowPlaying ? 'Reproduciendo' : 'Pausado'}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  {currentTrack && (
                    <>
                      <Heart size={16} style={{ color: currentTrack.isFavorite ? 'var(--accent)' : 'var(--text-muted)', fill: currentTrack.isFavorite ? 'var(--accent)' : 'none', cursor: 'pointer' }} onClick={() => toggleTrackFavorite(currentTrack.id)} />
                      <Edit2 size={13} style={{ color: 'var(--text-muted)', cursor: 'pointer', opacity: 0.5 }} onClick={() => { setEditingTrackId(currentTrack.id); setEditTitle(currentTrack.title); setEditArtist(currentTrack.artist); setEditCover(currentTrack.coverImage || ''); }} />
                    </>
                  )}
                </div>
              </div>

              <div onClick={() => currentTrack && setCoverModalTrackId(currentTrack.id)} style={{ width: '100%', aspectRatio: '1/1', borderRadius: 12, overflow: 'hidden', marginBottom: 20, boxShadow: '0 8px 24px rgba(0,0,0,0.6)', position: 'relative', background: 'var(--bg-surface)', cursor: currentTrack ? 'pointer' : 'default' }}
                onMouseEnter={() => currentTrack && setCoverHover(true)}
                onMouseLeave={() => currentTrack && setCoverHover(false)}>
                {nowCover ? <img src={nowCover} alt={nowTitle} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Music size={48} style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', color: 'var(--text-muted)', opacity: 0.15 }} />}
                {nowPlaying && (
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, transparent 60%, rgba(0,0,0,0.12) 100%)', pointerEvents: 'none' }} />
                )}
                {/* Expand hint overlay */}
                {currentTrack && (
                <div style={{
                  position: 'absolute', inset: 0,
                  background: 'rgba(0,0,0,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  opacity: coverHover ? 1 : 0,
                  transition: 'opacity 200ms ease',
                  borderRadius: 12,
                  pointerEvents: 'none',
                }}>
                  <div style={{
                    width: 36, height: 36,
                    borderRadius: '50%',
                    background: 'rgba(255,255,255,0.08)',
                    backdropFilter: 'blur(6px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transform: coverHover ? 'scale(1)' : 'scale(0.85)',
                    transition: 'transform 250ms cubic-bezier(0.32,0.72,0,1)',
                  }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.85 }}>
                      <path d="M8 3H5a2 2 0 0 0-2 2v3" />
                      <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
                      <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
                      <path d="M3 16v3a2 2 0 0 0 2 2h3" />
                    </svg>
                  </div>
                </div>
                )}
              </div>

              <div style={{ textAlign: 'center', marginBottom: 20, width: '100%' }}>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nowTitle}</h3>
                {nowArtist && <p style={{ fontSize: 13, color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nowArtist}</p>}
              </div>

              <div style={{ width: '100%', marginBottom: 20 }}>
                  <div className="progress-track" style={{ height: 4, marginBottom: 8, borderRadius: 2, overflow: 'hidden', cursor: 'pointer', position: 'relative' }}
                    onClick={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const x = (e.clientX - rect.left) / rect.width;
                      setMusicProgress(Math.max(0, Math.min(1, x)));
                    }}
                  >
                    <div className="progress-fill" style={{ width: `${musicProgress * 100}%`, background: 'var(--accent)', boxShadow: '0 0 8px var(--accent-glow)' }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                    <span>{formatTime(musicProgress * (musicDuration || currentTrack.duration || 0))}</span>
                    <span>{formatTime(musicDuration || currentTrack.duration || 0)}</span>
                  </div>
                </div>

                {/* Player Controls */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '0 12px' }}>
                  <button onClick={() => setShuffleMode(!shuffleMode)} className="btn-ghost" style={{ padding: 8, color: shuffleMode ? 'var(--accent)' : 'var(--text-tertiary)' }}>
                    <Shuffle size={16} />
                  </button>
                  <button onClick={() => {
                    const pool = queueSource?.pool ?? tracks.map(t => t.id);
                    const idx = pool.indexOf(currentTrack.id);
                    if (idx > 0) playTrack(pool[idx - 1]);
                    else if (repeatMode !== 'none' && pool.length > 0) playTrack(pool[pool.length - 1]);
                  }} className="btn-ghost" style={{ padding: 8 }}>
                    <SkipBack size={20} style={{ color: 'var(--text-primary)' }} />
                  </button>
                  <button onClick={toggleMusicPlayback} style={{ width: 42, height: 42, borderRadius: '50%', background: 'var(--accent)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', cursor: 'pointer', transition: 'transform 120ms' }} onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.08)'} onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'} onMouseDown={e => e.currentTarget.style.transform = 'scale(0.94)'} onMouseUp={e => e.currentTarget.style.transform = 'scale(1.08)'}>
                    {isPlayingMusic ? <Pause size={18} fill="#fff" /> : <Play size={18} fill="#fff" style={{ marginLeft: 2 }} />}
                  </button>
                  <button onClick={() => {
                    if (musicQueue.length > 0) { setMusicQueue(musicQueue.slice(1)); playTrack(musicQueue[0]); return; }
                    const pool = queueSource?.pool ?? tracks.map(t => t.id);
                    if (shuffleMode) {
                      const rest = pool.filter(tid => tid !== currentTrack.id);
                      if (rest.length > 0) { const pick = rest[Math.floor(Math.random() * rest.length)]; playTrack(pick); }
                      else if (pool.length > 0) playTrack(pool[0]);
                    } else {
                      const idx = pool.indexOf(currentTrack.id);
                      if (idx < pool.length - 1) playTrack(pool[idx + 1]);
                      else if (repeatMode === 'all' && pool.length > 0) playTrack(pool[(idx + 1) % pool.length]);
                    }
                  }} className="btn-ghost" style={{ padding: 8 }}>
                    <SkipForward size={20} style={{ color: 'var(--text-primary)' }} />
                  </button>
                  <button onClick={() => {
                    const next = repeatMode === 'none' ? 'all' : repeatMode === 'all' ? 'one' : 'none';
                    setRepeatMode(next);
                  }} className="btn-ghost" style={{ padding: 8, position: 'relative', color: repeatMode !== 'none' ? 'var(--accent)' : 'var(--text-tertiary)' }} title={repeatMode === 'none' ? 'Sin bucle' : repeatMode === 'all' ? 'Repetir lista' : 'Repetir una'}>
                    <Repeat size={16} />
                    {repeatMode === 'one' && <span style={{ position: 'absolute', top: 2, right: 2, fontSize: 8, fontWeight: 900, background: 'var(--bg-surface)', padding: '0 3px', borderRadius: 4, border: '1px solid var(--accent)' }}>1</span>}
                  </button>
                </div>
            </div>
            );
          })() : (
            <div className="bento-card" style={{ padding: '24px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, border: '1px dashed var(--border-subtle)' }}>
              <Music size={32} style={{ color: 'var(--text-muted)', opacity: 0.4 }} />
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>Tiempo hoy</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)', marginTop: 4 }}>{formatTime(musicListeningTime)}</div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>de estudio con Música</div>
              </div>
              <div style={{ width: '100%', borderTop: '1px solid var(--border-subtle)', paddingTop: 16, textAlign: 'center', fontSize: 11, color: 'var(--text-tertiary)' }}>
                Selecciona una canción para empezar
              </div>
            </div>
          )}

          {/* COLA DE REPRODUCCIÃ“N */}
          <div className="bento-card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <span className="section-header" style={{ marginBottom: 0, fontSize: 12, color: 'var(--text-primary)' }}>Cola de Reproducción</span>
            </div>
            {queueSource?.name && currentTrackId && (
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--accent)', marginBottom: 12, padding: '4px 10px', background: 'var(--accent-alpha)', borderRadius: 6, display: 'inline-block', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {shuffleMode ? 'Aleatorio · ' : 'Reproduciendo · '}{queueSource.name}
              </div>
            )}

            {shuffleMode ? (
              <div style={{ padding: '24px 0', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, animation: 'fadeIn 0.4s' }}>
                <Shuffle size={20} style={{ color: 'var(--accent)' }} />
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', lineHeight: 1.5, padding: '0 10px' }}>
                  {queueSource?.name
                    ? `Estamos escogiendo aleatoriamente las canciones de: ${queueSource.name}`
                    : 'Modo aleatorio activo'}
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {(() => {
                  if (!currentTrackId) return null;
                  const pool = queueSource?.pool || tracks.map(t => t.id);
                  const currentIdx = pool.indexOf(currentTrackId);
                  const queueItems = musicQueue.length > 0
                    ? musicQueue.slice(0, 5)
                    : pool.slice(currentIdx + 1, currentIdx + 6);
                  const draggable = musicQueue.length > 0;

                  if (queueItems.length === 0) {
                    return (
                      <div style={{ padding: '20px 0', textAlign: 'center', fontSize: 12, color: 'var(--text-tertiary)' }}>
                        Fin de la lista
                      </div>
                    );
                  }

                  if (draggable) {
                    return (
                      <DndContext sensors={queueSensors} collisionDetection={closestCenter} onDragEnd={handleQueueDragEnd} modifiers={[restrictToParentElement]}>
                        <SortableContext items={queueItems} strategy={verticalListSortingStrategy}>
                          {queueItems.map((trackId, i) => {
                            const t = tracks.find(tr => tr.id === trackId);
                            if (!t) return null;
                            return (
                              <SortableQueueRow
                                key={t.id}
                                track={t}
                                index={i}
                                formatTime={formatTime}
                                onSelect={() => { if (queueDragEndedRef.current) return; handlePlayWithTabCb(t.id); }}
                                onMenu={(e) => openTrackMenu(e, t.id)}
                              />
                            );
                          })}
                        </SortableContext>
                      </DndContext>
                    );
                  }

                  return queueItems.map((trackId, i) => {
                    const t = tracks.find(tr => tr.id === trackId);
                    if (!t) return null;
                    return (
                      <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', padding: '4px 0', borderRadius: 6 }} onClick={() => handlePlayWithTabCb(t.id)} onContextMenu={(e) => openTrackMenu(e, t.id)} className="hover-lift">
                        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', width: 16, textAlign: 'center' }}>{i + 1}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.artist}</div>
                        </div>
                        <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>{formatTime(t.duration)}</span>
                      </div>
                    );
                  });
                })()}
              </div>
            )}
          </div>

          {/* ESTADÍSTICAS DE ESCUCHA */}
          <div className="bento-card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <span className="section-header" style={{ marginBottom: 0, fontSize: 12, color: 'var(--text-primary)' }}>Estadísticas de escucha</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '3px', borderRadius: 6, border: '1px solid var(--border-subtle)' }}>
                <button onClick={() => setStatsPeriod('week')} style={{ padding: '3px 8px', borderRadius: 4, border: 'none', background: statsPeriod === 'week' ? 'var(--accent)' : 'transparent', color: statsPeriod === 'week' ? '#fff' : 'var(--text-tertiary)', cursor: 'pointer', fontSize: 10, fontWeight: 600 }}>Semana</button>
                <button onClick={() => setStatsPeriod('month')} style={{ padding: '3px 8px', borderRadius: 4, border: 'none', background: statsPeriod === 'month' ? 'var(--accent)' : 'transparent', color: statsPeriod === 'month' ? '#fff' : 'var(--text-tertiary)', cursor: 'pointer', fontSize: 10, fontWeight: 600 }}>Mes</button>
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 22, fontWeight: 650, color: 'var(--text-primary)' }}>{formatTime(statsPeriod === 'week' ? weeklyListeningTime : monthlyListeningTime)}</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{statsPeriod === 'week' ? 'Esta semana' : 'Este mes'}</div>
            </div>

            {/* SVG Wave Chart - with hover tooltips and real-time updates */}
            <div style={{ width: '100%', height: 72, marginBottom: 20, position: 'relative' }}>
              <svg viewBox="0 0 300 72" style={{ width: '100%', height: '100%', overflow: 'visible' }}
                onMouseMove={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const x = (e.clientX - rect.left) / rect.width;
                  const days = statsPeriod === 'week' ? 7 : 30;
                  const idx = Math.min(days - 1, Math.max(0, Math.round(x * (days - 1))));
                  const date = new Date();
                  date.setDate(date.getDate() - (days - 1 - idx));
                  const dayStr = format(date, 'yyyy-MM-dd');
                  const val = dailyMusicTime[dayStr] || 0;
                  setChartTooltip({ text: formatTime(val), date: dayStr, x: e.clientX - rect.left, y: e.clientY - rect.top });
                }}
                onMouseLeave={() => setChartTooltip(null)}
              >
                <defs>
                  <linearGradient id="waveGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.0" />
                  </linearGradient>
                </defs>
                {(() => {
                  const days = statsPeriod === 'week' ? 7 : 30;
                  const now = new Date();
                  const maxSecs = 14400; // 4 hours = max bar
                  const vals = Array.from({ length: days }, (_, i) => {
                    const date = new Date(now);
                    date.setDate(date.getDate() - (days - 1 - i));
                    const dayStr = format(date, 'yyyy-MM-dd');
                    const totalSecs = dailyMusicTime[dayStr] || 0;
                    return Math.max(2, Math.min(67, (totalSecs / maxSecs) * 67));
                  });
                  const points = vals.map((v, i) => `${(i / (days - 1 || 1)) * 300},${72 - v}`).join(' ');
                  const linePath = `M${points}`;
                  const areaPath = `${linePath} L300,72 L0,72 Z`;
                  return (
                    <>
                      <path d={areaPath} fill="url(#waveGrad)" />
                      <path d={linePath} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" />
                      {/* Interactive dots */}
                      {vals.map((v, i) => {
                        const cx = (i / (days - 1 || 1)) * 300;
                        const cy = 72 - v;
                        return (
                          <g key={i}>
                            <circle cx={cx} cy={cy} r="5" fill="transparent" style={{ cursor: 'pointer' }}
                              onMouseEnter={(e) => {
                                const date = new Date(now);
                                date.setDate(date.getDate() - (days - 1 - i));
                                const dayStr = format(date, 'yyyy-MM-dd');
                                const val = dailyMusicTime[dayStr] || 0;
                                setChartTooltip({ text: formatTime(val), date: dayStr, x: parseFloat(e.currentTarget.getAttribute('cx') || '0') * 300 / 300 * 300, y: parseFloat(e.currentTarget.getAttribute('cy') || '0') });
                              }}
                            />
                            <circle cx={cx} cy={cy} r="3" fill={i === days - 1 ? 'var(--accent)' : 'var(--text-muted)'} style={{ filter: i === days - 1 ? 'drop-shadow(0 0 6px var(--accent))' : 'none' }} />
                          </g>
                        );
                      })}
                    </>
                  );
                })()}
              </svg>
              {/* Tooltip */}
              {chartTooltip && (
                <div style={{ position: 'absolute', left: Math.min(chartTooltip.x - 50, 250), top: -8, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '6px 10px', boxShadow: '0 4px 16px rgba(0,0,0,0.4)', pointerEvents: 'none', zIndex: 10, fontSize: 11 }}>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{chartTooltip.text}</div>
                  <div style={{ color: 'var(--text-tertiary)', fontSize: 10, marginTop: 2 }}>{chartTooltip.date}</div>
                </div>
              )}
            </div>

            {/* Micro Stats Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, borderTop: '1px solid var(--border-subtle)', paddingTop: 14 }}>
              <div style={{ textAlign: 'center', padding: '6px 4px', borderRadius: 6 }}>
                <div style={{ fontSize: 9, color: 'var(--text-tertiary)', marginBottom: 2 }}>Hoy</div>
                <div style={{ fontSize: 13, fontWeight: 650, color: 'var(--text-primary)' }}>{formatTime(musicListeningTime)}</div>
              </div>
              <div style={{ textAlign: 'center', padding: '6px 4px', borderRadius: 6 }}>
                <div style={{ fontSize: 9, color: 'var(--text-tertiary)', marginBottom: 2 }}>Favoritas</div>
                <div style={{ fontSize: 13, fontWeight: 650, color: 'var(--text-primary)' }}>{tracks.filter(t => t.isFavorite).length}</div>
              </div>
            </div>
          </div>

          {/* DOWNLOADS CARD */}
          {(downloadSelection.length > 0 || downloadQueue.length > 0) && (
            <div className="bento-card" style={{ padding: '18px 20px' }}>
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 7, background: 'color-mix(in srgb, var(--accent) 10%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Download size={13} style={{ color: 'var(--accent)' }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '0.01em' }}>Descargas</div>
                    {activeDownloads.length > 0 && <div style={{ fontSize: 9, color: 'var(--accent)', fontWeight: 500, marginTop: 1 }}>{activeDownloads.length} activa{activeDownloads.length !== 1 ? 's' : ''}</div>}
                  </div>
                </div>
                <button onClick={() => { setDownloadSelection([]); clearCompletedDownloads(); }}
                  style={{ padding: '4px 8px', fontSize: 9, fontWeight: 500, color: 'var(--text-muted)', background: 'none', border: '1px solid var(--border-subtle)', borderRadius: 5, cursor: 'pointer', transition: 'all 150ms' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-strong)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.color = 'var(--text-muted)'; }}>
                  Limpiar
                </button>
              </div>

              {/* Active downloads */}
              {activeDownloads.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {activeDownloads.map(dl => (
                      <div key={dl.id} style={{ padding: '10px 12px', borderRadius: 10, background: 'color-mix(in srgb, var(--accent) 4%, var(--bg-elevated))', border: '1px solid color-mix(in srgb, var(--accent) 12%, var(--border-subtle))' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                          <div style={{ width: 32, height: 32, borderRadius: 7, background: 'var(--bg-deep)', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border-subtle)' }}>
                            {dl.thumbnail ? <img src={dl.thumbnail} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Music size={12} color="var(--text-muted)" style={{ opacity: 0.3 }} />}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{dl.title}</div>
                            <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                              <span style={{ fontVariantNumeric: 'tabular-nums', color: dl.status === 'queued' ? 'var(--text-muted)' : 'var(--accent)', fontWeight: dl.status === 'downloading' ? 600 : 400 }}>
                                {dl.status === 'queued' ? 'En cola' : `${Math.round(dl.progress * 100)}%`}
                              </span>
                            </div>
                          </div>
                          <button onClick={() => handleCancelDownload(dl.id)}
                            style={{ padding: '4px 10px', fontSize: 9, fontWeight: 600, background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 5, color: 'var(--text-tertiary)', cursor: 'pointer', transition: 'all 150ms', whiteSpace: 'nowrap' }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--danger)'; e.currentTarget.style.color = 'var(--danger)'; }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.color = 'var(--text-tertiary)'; }}>
                            Cancelar
                          </button>
                        </div>
                        {/* Progress bar */}
                        <div style={{ height: 4, borderRadius: 3, background: 'var(--bg-deep)', overflow: 'hidden' }}>
                          <div style={{ width: `${dl.progress * 100}%`, height: '100%', borderRadius: 3, background: 'linear-gradient(90deg, var(--accent), color-mix(in srgb, var(--accent) 70%, white))', transition: 'width 400ms ease', position: 'relative' }}>
                            {dl.status === 'downloading' && <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)', animation: 'shimmer 1.5s infinite' }} />}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Completed / Error / Cancelled */}
              {completedDownloads.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Finalizadas</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {completedDownloads.map(dl => (
                      <div key={dl.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 8, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', transition: 'all 150ms' }}>
                        <div style={{ width: 28, height: 28, borderRadius: 6, background: 'var(--bg-deep)', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {dl.thumbnail ? <img src={dl.thumbnail} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Music size={10} color="var(--text-muted)" style={{ opacity: 0.3 }} />}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{dl.title}</div>
                          <div style={{ fontSize: 9, marginTop: 2, display: 'flex', alignItems: 'center', gap: 3, color: dl.status === 'completed' ? 'var(--success)' : dl.status === 'error' ? 'var(--danger)' : 'var(--text-muted)' }}>
                            {dl.status === 'completed' && <Check size={9} />}
                            {dl.status === 'error' && <AlertCircle size={9} />}
                            {dl.status === 'completed' ? 'Descargado' : dl.status === 'error' ? (dl.errorMessage || 'Error') : 'Cancelado'}
                          </div>
                        </div>
                        <button onClick={() => removeFromDownloadQueue(dl.id)}
                          style={{ padding: 3, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', flexShrink: 0, opacity: 0.3, transition: 'opacity 150ms', display: 'flex' }}
                          onMouseEnter={e => { e.currentTarget.style.opacity = '1'; }}
                          onMouseLeave={e => { e.currentTarget.style.opacity = '0.3'; }}><X size={11} /></button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Pending selections */}
              {downloadSelection.length > 0 && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      Pendientes ({downloadSelection.length})
                    </div>
                    <button onClick={() => setDownloadSelection([])} style={{ fontSize: 9, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 2 }}>Limpiar</button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12, maxHeight: 200, overflowY: 'auto', paddingRight: 4 }} className="no-scrollbar">
                    {downloadSelection.map((item, i) => (
                      <div key={item.url} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', transition: 'all 150ms' }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-strong)'; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; }}>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--text-muted)', flexShrink: 0, opacity: 0.4 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</div>
                        </div>
                        <button onClick={() => setDownloadSelection(prev => prev.filter((_, idx) => idx !== i))}
                          style={{ padding: 3, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', flexShrink: 0, opacity: 0.3, transition: 'opacity 150ms', display: 'flex', borderRadius: 4 }}
                          onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.color = 'var(--danger)'; }}
                          onMouseLeave={e => { e.currentTarget.style.opacity = '0.3'; e.currentTarget.style.color = 'var(--text-muted)'; }}><X size={11} /></button>
                      </div>
                    ))}
                  </div>
                  <button onClick={startBulkDownload} className="btn-primary" style={{ width: '100%', height: 38, fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 9, whiteSpace: 'nowrap', boxShadow: '0 2px 8px color-mix(in srgb, var(--accent) 25%, transparent)' }}>
                    <Download size={14} /> Descargar Todo ({downloadSelection.length})
                  </button>
                </div>
              )}
            </div>
          )}

        </div>
        )}

      </div>

      {/* Floating arrow to show sidebar when hidden - inside mainContainerRef to avoid mouseleave issues */}
      {!showRightSidebar && showSidebarArrow && (
        <div style={{
          position: 'absolute', top: sidebarArrowPos, right: 0, zIndex: 50,
          width: 28, height: 28, borderRadius: '8px 0 0 8px',
          background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
          borderRight: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', color: 'var(--text-secondary)', transition: 'all 200ms',
          boxShadow: '-2px 0 8px rgba(0,0,0,0.15)',
        }}
          onClick={() => { setShowRightSidebar(true); setShowSidebarArrow(false); }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-elevated)'; }}
        >
          <ArrowLeft size={14} />
        </div>
      )}
      </div>

      {/* Edit Track Dialog */}
      {editingTrackId && createPortal(
        <div style={{
          position: 'fixed', inset: 0, zIndex: 99995,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
        }} onClick={() => setEditingTrackId(null)}>
          <div className="bento-card" style={{ padding: 28, width: 380, maxWidth: '90vw' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16 }}>Editar Canción</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Título</label>
                <input value={editTitle} onChange={e => setEditTitle(e.target.value)} className="input-base" style={{ width: '100%', height: 38, fontSize: 12 }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Artista</label>
                <div style={{ display: 'flex', gap: 8, flexDirection: 'column' }}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input value={editArtist} onChange={e => setEditArtist(e.target.value)} className="input-base" placeholder="Escribe o elige un artista..." style={{ flex: 1, height: 38, fontSize: 12 }} />
                    <button onClick={() => { if (editArtist.trim()) { addArtist(editArtist.trim()); } }} className="btn-secondary" style={{ padding: '0 12px' }} title="Guardar a predeterminados"><Plus size={14} /></button>
                  </div>
                  {(artists || []).length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
                      {(artists || []).map(a => (
                        <div key={a.id}
                          onClick={() => setEditArtist(a.name)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 6,
                            background: editArtist === a.name ? 'var(--accent-alpha)' : 'var(--surface-hover)',
                            borderRadius: 14, padding: '6px 12px', fontSize: 12, fontWeight: 500,
                            color: editArtist === a.name ? 'var(--accent)' : 'var(--text-secondary)',
                            cursor: 'pointer', border: editArtist === a.name ? '1px solid var(--accent)' : '1px solid transparent',
                            transition: 'all 150ms',
                          }}>
                          {a.name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Portada</label>
                <div style={{ display: 'flex', gap: 8, flexDirection: 'column' }}>
                  <input value={editCover} onChange={e => setEditCover(e.target.value)} className="input-base" placeholder="URL de la imagen..." style={{ width: '100%', height: 38, fontSize: 12 }} />
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <button
                      onClick={async () => {
                        try {
                          const file = await open({
                            multiple: false,
                            filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }]
                          });
                          if (file && typeof file === 'string') {
                            const data = await readFile(file);
                            const ext = file.split('.').pop()?.toLowerCase() || 'png';
                            const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'webp' ? 'image/webp' : 'image/png';
                            let binary = '';
                            for (let i = 0; i < data.length; i++) binary += String.fromCharCode(data[i]);
                            setEditCover(`data:${mime};base64,${btoa(binary)}`);
                          }
                        } catch {
                          const input = document.createElement('input');
                          input.type = 'file';
                          input.accept = 'image/*';
                          input.onchange = (e: any) => {
                            const file = e.target.files[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onload = (e) => setEditCover(e.target?.result as string);
                              reader.readAsDataURL(file);
                            }
                          };
                          input.click();
                        }
                      }}
                      className="btn-secondary"
                      style={{ flex: 1, height: 38, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                    >
                      <Upload size={14} /> Subir desde PC
                    </button>
                    {editCover && (
                      <div style={{ width: 38, height: 38, borderRadius: 6, overflow: 'hidden', border: '1px solid var(--border-subtle)' }}>
                        <img src={editCover} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 20 }}>
              <button onClick={() => setEditingTrackId(null)} className="btn-secondary" style={{ height: 38, padding: '0 20px', fontSize: 12 }}>Cancelar</button>
              <button onClick={() => {
                updateTrack(editingTrackId, { title: editTitle, artist: editArtist, coverImage: editCover || undefined });
                setEditingTrackId(null);
              }} className="btn-primary" style={{ height: 38, padding: '0 20px', fontSize: 12 }}>Guardar</button>
            </div>
          </div>
        </div>, document.body)}

      {/* Edit Artist Dialog */}
      {editingArtistId && createPortal(
        <div style={{
          position: 'fixed', inset: 0, zIndex: 99995,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
        }} onClick={() => setEditingArtistId(null)}>
          <div className="bento-card" style={{ padding: 28, width: 440, maxWidth: '92vw', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
              {editArtistImage ? (
                <div style={{ width: 48, height: 48, borderRadius: '50%', overflow: 'hidden', border: '2px solid var(--accent)', flexShrink: 0, background: 'var(--bg-deep)' }}>
                  <img src={editArtistImage} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
              ) : (
                <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--bg-deep)', border: '2px dashed var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: 'var(--text-muted)' }}>
                  <User size={20} />
                </div>
              )}
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
                  {editingArtistId === 'new' ? 'Crear Artista' : 'Editar Artista'}
                </h3>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
                  {editingArtistId === 'new' ? 'Añade un nuevo artista a tu biblioteca' : 'Actualiza la información del artista'}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Name */}
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Nombre del Artista</label>
                <input autoFocus value={editArtistName} onChange={e => setEditArtistName(e.target.value)} className="input-base" style={{ width: '100%', height: 42, fontSize: 14, padding: '0 14px', borderRadius: 8 }} placeholder="Nombre del artista" />
              </div>

              {/* Photo */}
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Foto de Perfil</label>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <div style={{ flex: 1, position: 'relative' }}>
                    <input value={editArtistImage} onChange={e => setEditArtistImage(e.target.value)} className="input-base" style={{ width: '100%', height: 42, fontSize: 13, padding: '0 14px', borderRadius: 8 }} placeholder="https://..." />
                  </div>
                  <label className="btn-secondary" style={{ width: 42, height: 42, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, cursor: 'pointer', flexShrink: 0 }}>
                    <Upload size={16} />
                    <input type="file" accept="image/*" onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = (ev) => setEditArtistImage(ev.target?.result as string);
                        reader.readAsDataURL(file);
                      }
                    }} style={{ display: 'none' }} />
                  </label>
                  {editArtistImage && (
                    <button onClick={() => setEditArtistImage('')} className="btn-ghost" style={{ width: 42, height: 42, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, color: 'var(--text-muted)', flexShrink: 0 }}>
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>

              {/* Track selection */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>Canciones ({artistSelectedTrackIds.length} seleccionadas)</label>
                  <button onClick={() => setArtistSelectedTrackIds(prev =>
                    prev.length === tracks.length ? [] : tracks.map(t => t.id)
                  )} className="btn-ghost" style={{ fontSize: 10, color: 'var(--accent)', padding: '2px 8px' }}>
                    {artistSelectedTrackIds.length === tracks.length ? 'Deseleccionar todo' : 'Seleccionar todo'}
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, borderRadius: 10, border: '1px solid var(--border-subtle)', padding: 6 }}>
                  <div style={{ position: 'relative' }}>
                    <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)', pointerEvents: 'none' }} />
                    <input value={artistTrackSearch} onChange={e => setArtistTrackSearch(e.target.value)} placeholder="Buscar canciones..." className="input-base" style={{ width: '100%', height: 34, fontSize: 12, paddingLeft: 30, borderRadius: 6 }} />
                  </div>
                  <div style={{ maxHeight: 240, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {tracks.filter(t => {
                      if (!artistTrackSearch) return true;
                      const q = artistTrackSearch.trim();
                      return fuzzyMatch(t.title, q) || fuzzyMatch(t.artist || '', q);
                    }).length === 0 && (
                      <div style={{ fontSize: 12, color: 'var(--text-tertiary)', padding: '16px 8px', textAlign: 'center' }}>
                        {artistTrackSearch ? 'Sin resultados' : 'No hay canciones en tu biblioteca'}
                      </div>
                    )}
                    {tracks.filter(t => {
                      if (!artistTrackSearch) return true;
                      const q = artistTrackSearch.trim();
                      return fuzzyMatch(t.title, q) || fuzzyMatch(t.artist || '', q);
                    }).map(t => {
                      const selected = artistSelectedTrackIds.includes(t.id);
                      return (
                        <div key={t.id} onClick={() => setArtistSelectedTrackIds(prev => prev.includes(t.id) ? prev.filter(id => id !== t.id) : [...prev, t.id])}
                          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', borderRadius: 8, cursor: 'pointer', background: selected ? 'var(--accent-alpha)' : 'transparent', transition: 'background 150ms', border: selected ? '1px solid var(--accent)' : '1px solid transparent' }}>
                          <div style={{ width: 18, height: 18, borderRadius: 4, border: selected ? '2px solid var(--accent)' : '2px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: selected ? 'var(--accent)' : 'transparent', flexShrink: 0, transition: 'all 150ms' }}>
                            {selected && <Check size={11} color="#fff" strokeWidth={3} />}
                          </div>
                          <div style={{ width: 28, height: 28, borderRadius: 4, overflow: 'hidden', background: 'var(--bg-deep)', flexShrink: 0 }}>
                            {t.coverImage && <img src={t.coverImage} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</div>
                            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.artist || 'Sin artista'}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 28, paddingTop: 16, borderTop: '1px solid var(--border-subtle)' }}>
              <button onClick={() => setEditingArtistId(null)} className="btn-secondary" style={{ height: 40, padding: '0 24px', fontSize: 12, borderRadius: 8 }}>Cancelar</button>
              <button onClick={() => {
                const artistName = editArtistName.trim();

                if (editingArtistId === 'new') {
                  if (!artistName) return;
                  addArtist(artistName, editArtistImage || undefined);
                  artistSelectedTrackIds.forEach(trackId => {
                    const track = tracks.find(t => t.id === trackId);
                    if (track && track.artist !== artistName) updateTrack(trackId, { artist: artistName });
                  });
                } else {
                  const oldName = artists.find(a => a.id === editingArtistId)?.name;
                  updateArtist(editingArtistId, {
                    name: artistName || undefined,
                    profileImage: editArtistImage || undefined
                  });
                  artistSelectedTrackIds.forEach(trackId => {
                    const track = tracks.find(t => t.id === trackId);
                    if (track && track.artist !== (artistName || oldName)) updateTrack(trackId, { artist: artistName || oldName });
                  });
                  tracks.forEach(t => {
                    if (!artistSelectedTrackIds.includes(t.id) && (t.artist === oldName || t.artist === artistName)) {
                      updateTrack(t.id, { artist: '' });
                    }
                  });
                }

                setEditingArtistId(null);
              }} className="btn-primary" style={{ height: 40, padding: '0 24px', fontSize: 12, borderRadius: 8, fontWeight: 700 }}>
                {editingArtistId === 'new' ? 'Crear Artista' : 'Guardar Cambios'}
              </button>
            </div>
          </div>
        </div>, document.body
      )}

      {confirmDelete && createPortal(
        <div style={{
          position: 'fixed', inset: 0, zIndex: 99995,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
        }} onClick={() => setConfirmDelete(null)}>
          <div className="bento-card" style={{ padding: 28, width: 360, maxWidth: '90vw' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10 }}>
              {confirmDelete.type === 'artist' ? 'Eliminar Artista' : confirmDelete.type === 'playlist' ? 'Eliminar Playlist' : 'Eliminar Canción'}
            </h3>
            <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 22, lineHeight: 1.5 }}>
              {confirmDelete.type === 'track'
                ? `Se eliminará "${confirmDelete.name}" de tu biblioteca.`
                : confirmDelete.type === 'artist'
                  ? `Se eliminará "${confirmDelete.name}" y se desvincularán sus canciones.`
                  : `Se eliminará la playlist "${confirmDelete.name}" de tu biblioteca.`}
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setConfirmDelete(null)} className="btn-secondary" style={{ height: 36, padding: '0 18px', fontSize: 12, fontWeight: 600 }}>
                Cancelar
              </button>
              <button onClick={() => {
                const d = confirmDelete;
                if (d.type === 'track') deleteTrack(d.id);
                else if (d.type === 'artist') deleteArtist(d.id);
                else if (d.type === 'playlist') deletePlaylist(d.id);
                setConfirmDelete(null);
              }} style={{ height: 36, padding: '0 18px', fontSize: 12, fontWeight: 700, borderRadius: 8, cursor: 'pointer', border: 'none', background: '#EF4444', color: '#fff', display: 'flex', alignItems: 'center', gap: 6 }}>
                Eliminar
              </button>
            </div>
          </div>
        </div>, document.body
      )}

      {ctxMenu && createPortal(
        <div style={{ position: 'fixed', inset: 0, zIndex: 99998 }} onClick={() => setCtxMenu(null)} onContextMenu={(e) => { e.preventDefault(); setCtxMenu(null); }}>
          <div style={{ position: 'fixed', left: Math.min(ctxMenu.x, window.innerWidth - 230), top: Math.min(ctxMenu.y, window.innerHeight - 150), zIndex: 99999, background: 'var(--bg-elevated)', border: '1px solid var(--border-soft)', borderRadius: 10, boxShadow: '0 14px 44px rgba(0,0,0,0.38)', padding: 6, width: 220 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-tertiary)', padding: '5px 10px 8px', borderBottom: '1px solid var(--border-subtle)', marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {tracks.find(t => t.id === ctxMenu.trackId)?.title || 'Canción'}
            </div>
            {musicQueue.includes(ctxMenu.trackId) ? (
              <button onClick={() => ctxRemoveFromQueue(ctxMenu.trackId)} style={{ display: 'flex', alignItems: 'center', gap: 9, width: '100%', padding: '8px 10px', borderRadius: 7, border: 'none', background: 'transparent', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer', textAlign: 'left' }}>
                <ListX size={14} style={{ color: 'var(--error)', flexShrink: 0 }} />
                Quitar de la cola
              </button>
            ) : (
              <button onClick={() => ctxAddToQueue(ctxMenu.trackId)} style={{ display: 'flex', alignItems: 'center', gap: 9, width: '100%', padding: '8px 10px', borderRadius: 7, border: 'none', background: 'transparent', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer', textAlign: 'left' }}>
                <ListPlus size={14} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                Agregar a la cola
              </button>
            )}
            <button onClick={() => ctxPlayNext(ctxMenu.trackId)} style={{ display: 'flex', alignItems: 'center', gap: 9, width: '100%', padding: '8px 10px', borderRadius: 7, border: 'none', background: 'transparent', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer', textAlign: 'left' }}>
              <CornerDownRight size={14} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
              Reproducir a continuación
            </button>
          </div>
        </div>,
        document.body
      )}

      {ctxSearchMenu && createPortal(
        <div style={{ position: 'fixed', inset: 0, zIndex: 99998 }} onClick={() => setCtxSearchMenu(null)} onContextMenu={(e) => { e.preventDefault(); setCtxSearchMenu(null); }}>
          <div style={{ position: 'fixed', left: Math.min(ctxSearchMenu.x, window.innerWidth - 230), top: Math.min(ctxSearchMenu.y, window.innerHeight - 180), zIndex: 99999, background: 'var(--bg-elevated)', border: '1px solid var(--border-soft)', borderRadius: 10, boxShadow: '0 14px 44px rgba(0,0,0,0.38)', padding: 6, width: 220 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-tertiary)', padding: '5px 10px 8px', borderBottom: '1px solid var(--border-subtle)', marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {ctxSearchMenu.result.title || 'Canción'}
            </div>
            <button onClick={() => ctxSearchAddToLibrary(ctxSearchMenu.result)} style={{ display: 'flex', alignItems: 'center', gap: 9, width: '100%', padding: '8px 10px', borderRadius: 7, border: 'none', background: 'transparent', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer', textAlign: 'left' }}>
              <ListPlus size={14} style={{ color: 'var(--accent)', flexShrink: 0 }} />
              Agregar a lista de música
            </button>
            <button
              onClick={() => ctxSearchPlayNext(ctxSearchMenu.result)}
              disabled={!currentTrackId}
              style={{ display: 'flex', alignItems: 'center', gap: 9, width: '100%', padding: '8px 10px', borderRadius: 7, border: 'none', background: 'transparent', color: currentTrackId ? 'var(--text-secondary)' : 'var(--text-muted)', fontSize: 12, cursor: currentTrackId ? 'pointer' : 'not-allowed', textAlign: 'left', opacity: currentTrackId ? 1 : 0.5 }}
              title={currentTrackId ? undefined : 'No hay ninguna canción reproduciéndose en este momento'}
            >
              <CornerDownRight size={14} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
              Reproducir después de la actual
            </button>
          </div>
        </div>,
        document.body
      )}


    </div>
  );
}

