import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  Play, Pause, SkipBack, SkipForward, Volume2, Search,
  Music, Download, Trash2, X, ListMusic, Upload,
  Link, Globe, Loader, Check, CheckCircle, AlertCircle,
  ArrowLeft, ArrowRight, ChevronDown, ChevronUp, ChevronLeft, ChevronRight,
  ExternalLink, FolderOpen, Plus,
  Disc3, Activity, Heart, Copy, Clock,
  User, Wifi, Sliders, Repeat, Shuffle, BarChart2,
  Edit2, Grid, List, Image,
} from 'lucide-react';
import { useApp, type Track } from '../../store/AppContext';
import { open, save } from '@tauri-apps/plugin-dialog';
import { readFile } from '@tauri-apps/plugin-fs';
import { format, subDays, addDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { emitTo } from '@tauri-apps/api/event';
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
  } = useApp();

  const [activeTab, setActiveTab] = useState<TabId>('biblioteca');
  const [url, setUrl] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [preview, setPreview] = useState<YouTubePlaylist | YouTubeMetadata | null>(null);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [showAllLibrary, setShowAllLibrary] = useState(false);
  const [showAllRecents, setShowAllRecents] = useState(false);
  const [audioFormat, setAudioFormat] = useState<'mp3' | 'm4a'>('mp3');
  const [includeCover, setIncludeCover] = useState(true);
  const [audioQuality, setAudioQuality] = useState('3');
  const [selectedArtist, setSelectedArtist] = useState<string | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [coverHover, setCoverHover] = useState(false);
  const [searchMode, setSearchMode] = useState<'link' | 'query'>('link');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [confirmDelete, setConfirmDelete] = useState<{ type: 'track' | 'artist' | 'playlist'; id: string; name: string } | null>(null);
  const [showClearAllConfirm, setShowClearAllConfirm] = useState(false);
  const [searchPerformed, setSearchPerformed] = useState(false);
  const [statsPeriod, setStatsPeriod] = useState<'week' | 'month'>('week');
  const [chartTooltip, setChartTooltip] = useState<{ text: string; date: string; x: number; y: number } | null>(null);
  const [editingArtistId, setEditingArtistId] = useState<string | null>(null);
  const [editArtistName, setEditArtistName] = useState('');
  const [editArtistImage, setEditArtistImage] = useState('');
  const [artistSelectedTrackIds, setArtistSelectedTrackIds] = useState<string[]>([]);
  const [artistTrackSearch, setArtistTrackSearch] = useState('');
  // Playlist state
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);
  const [showCreatePlaylist, setShowCreatePlaylist] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [editingPlaylistId, setEditingPlaylistId] = useState<string | null>(null);
  const [selectedTrackIds, setSelectedTrackIds] = useState<Set<string>>(new Set());
  const [playlistArtistFilter, setPlaylistArtistFilter] = useState<string>('');
  const [playlistSongSearch, setPlaylistSongSearch] = useState('');
  const [playlistStep, setPlaylistStep] = useState(0);
  const [playlistCoverData, setPlaylistCoverData] = useState<string>('');

  const [viewMode, setViewMode] = useState<'lista' | 'bloques'>('lista');
  const [editingTrackId, setEditingTrackId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editArtist, setEditArtist] = useState('');
  const [editCover, setEditCover] = useState('');

  const mainContainerRef = useRef<HTMLDivElement>(null);
  const [showRightSidebar, setShowRightSidebar] = useState(true);
  const [showSidebarArrow, setShowSidebarArrow] = useState(false);
  const [sidebarArrowPos, setSidebarArrowPos] = useState(0);
  const sidebarArrowTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const urlInputRef = useRef<HTMLInputElement>(null);
  const searchRequestId = useRef(0);
  const [colocarTrackId, setColocarTrackId] = useState<string | null>(null);
  const [youtubePlayerUrl, setYoutubePlayerUrl] = useState<string | null>(null);
  const [youtubePlayerTitle, setYoutubePlayerTitle] = useState('');
  const [youtubePlayerThumb, setYoutubePlayerThumb] = useState('');

  const [downloadSelection, setDownloadSelection] = useState<{ url: string; title: string; channel?: string; thumbnail?: string; duration?: number }[]>(() => {
    try {
      const saved = localStorage.getItem('owa_download_selection');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  useEffect(() => {
    localStorage.setItem('owa_download_selection', JSON.stringify(downloadSelection));
  }, [downloadSelection]);

  const handlePlayWithTabCb = useCallback((trackOrId: string | Track, sourceTab?: TabId) => {
    const trackId = typeof trackOrId === 'string' ? trackOrId : trackOrId.id;
    const track = tracks.find(t => t.id === trackId);
    if (!track) return;
    const tab = sourceTab || activeTab;
    if (tab !== activeTab) {
      setActiveTab(tab);
      if (tab === 'artistas' && track.artist) setSelectedArtist(track.artist);
    }
    playTrack(trackId);
  }, [activeTab, playTrack]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Lock body scroll when any modal is open
  useEffect(() => {
    const modalOpen = !!(editingArtistId || showCreatePlaylist || editingTrackId || confirmDelete || youtubePlayerUrl || showClearAllConfirm);
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
  }, [editingArtistId, showCreatePlaylist, editingTrackId, confirmDelete, youtubePlayerUrl, showClearAllConfirm]);

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

  const handleSearch = async () => {
    const q = searchQuery.trim();
    if (!q) return;
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
    if (selectedArtist) {
      filtered = filtered.filter(t => t.artist === selectedArtist);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(t => t.title.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q));
    }
    return filtered;
  }, [dailyShuffledTracks, selectedArtist, searchQuery]);

  const displayTracks = activeTab === 'favoritas'
    ? tracks.filter(t => t.isFavorite)
    : (showAllLibrary ? libraryTracks : libraryTracks.slice(0, 25));

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
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, paddingTop: 8 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 style={{ fontSize: 30, fontWeight: 650, color: 'var(--accent)', lineHeight: 1.15, letterSpacing: '-0.02em', fontFamily: "'Inter Tight', sans-serif" }}>Música</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 3, color: 'var(--text-tertiary)' }}>
              <div style={{ width: 3, height: 12, background: 'var(--text-secondary)', borderRadius: 2 }} />
              <div style={{ width: 3, height: 18, background: 'var(--accent)', borderRadius: 2 }} />
              <div style={{ width: 3, height: 8, background: 'var(--text-secondary)', borderRadius: 2 }} />
              <div style={{ width: 3, height: 14, background: 'var(--text-tertiary)', borderRadius: 2 }} />
            </div>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 6, fontWeight: 500 }}>Tu Música, tu enfoque.</p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', border: '1px solid var(--border-default)', borderRadius: 16, fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--success)', boxShadow: '0 0 8px var(--success)' }} />
              Conectado
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
          <div style={{ position: 'relative', width: 260 }}>
            <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
            <input
              type="text"
              placeholder="Buscar canciones o artistas..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && searchQuery.trim()) {
                  const q = searchQuery.trim().toLowerCase();
                  const hasLocal = tracks.some(t => t.title.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q));
                  if (!hasLocal) {
                    setActiveTab('explorar');
                    setSearchMode('query');
                    setTimeout(() => handleSearch(), 0);
                  }
                }
              }}
              className="input-base"
              style={{ width: '100%', height: 38, paddingLeft: 36, fontSize: 12, borderRadius: 10, border: '1px solid var(--border-subtle)' }}
            />
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
                  <div style={{ position: 'relative' }}>
                    {firstCover && (
                      <div style={{ position: 'fixed', inset: 0, background: `url(${firstCover}) center/cover no-repeat`, filter: 'blur(100px) saturate(2)', opacity: 0.3, zIndex: 0 }} />
                    )}
                    <div style={{ position: 'relative', zIndex: 1, background: `color-mix(in srgb, var(--bg-primary) 88%, transparent)`, backdropFilter: 'blur(4px)', borderRadius: 16, padding: '28px 32px 32px' }}>
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
                              <div key={t.id} onClick={() => { const pool = artistTracks.map(x => x.id); setQueueSource({ pool, name: selectedArtist || undefined }); handlePlayWithTabCb(t.id); }} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 8, cursor: 'pointer', background: isPlaying ? 'color-mix(in srgb, var(--accent) 12%, transparent)' : 'transparent', transition: 'all 150ms', border: '1px solid transparent' }}
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
                      const firstCover = plTracks.find(t => t.coverImage)?.coverImage || pl.coverImage;
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
                const firstCover = plTracks.find(t => t.coverImage)?.coverImage || pl.coverImage;
                const isPlayingAll = currentTrackId && plTracks.some(t => t.id === currentTrackId) && isPlayingMusic;
                return (
                  <div style={{ position: 'relative' }}>
                    {firstCover && (
                      <div style={{ position: 'fixed', inset: 0, background: `url(${firstCover}) center/cover no-repeat`, filter: 'blur(100px) saturate(2)', opacity: 0.3, zIndex: 0 }} />
                    )}
                    <div style={{ position: 'relative', zIndex: 1, background: `color-mix(in srgb, var(--bg-primary) 88%, transparent)`, backdropFilter: 'blur(4px)', borderRadius: 16, padding: '28px 32px 32px' }}>
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
              {showCreatePlaylist && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 10050, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
                  onClick={(e) => { if (e.target === e.currentTarget) { setShowCreatePlaylist(false); setPlaylistStep(0); setPlaylistCoverData(''); setNewPlaylistName(''); setSelectedTrackIds(new Set()); } }}>
                  <div className="bento-card" style={{ width: 'min(440px, 90vw)', padding: 0, borderRadius: 16, overflow: 'hidden' }}>
                    {/* Header */}
                    <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--accent-alpha, rgba(255,255,255,0.06))', border: '1px solid var(--accent, #E11D48)30', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <ListMusic size={16} style={{ color: 'var(--accent, #E11D48)' }} />
                          </div>
                          <div>
                            <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: 0, fontFamily: "'Inter Tight', sans-serif" }}>
                              {editingPlaylistId ? 'Editar playlist' : playlistStep === 0 ? 'Nueva playlist' : playlistStep === 1 ? 'Portada' : 'Canciones'}
                            </h3>
                            {!editingPlaylistId && (
                              <p style={{ fontSize: 11, color: 'var(--text-tertiary)', margin: '2px 0 0' }}>
                                {playlistStep === 0 ? 'Dale un nombre a tu playlist' : playlistStep === 1 ? 'Elige una portada (opcional)' : `${selectedTrackIds.size} canciones seleccionadas`}
                              </p>
                            )}
                          </div>
                        </div>
                        <button onClick={() => { setShowCreatePlaylist(false); setPlaylistStep(0); setPlaylistCoverData(''); setNewPlaylistName(''); setSelectedTrackIds(new Set()); }}
                          style={{ width: 28, height: 28, borderRadius: 7, background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 150ms' }}
                          onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                          <X size={14} />
                        </button>
                      </div>
                      {/* Step indicator */}
                      {!editingPlaylistId && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
                          {[0, 1, 2].map((s, i) => (
                            <React.Fragment key={s}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: s === 1 ? 0 : 1 }}>
                                <div style={{ width: 20, height: 20, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, flexShrink: 0, transition: 'all 250ms',
                                  background: playlistStep >= s ? 'var(--accent, #E11D48)' : 'var(--bg-hover)',
                                  color: playlistStep >= s ? '#fff' : 'var(--text-muted)',
                                  border: playlistStep >= s ? 'none' : '1px solid var(--border-subtle)' }}>
                                  {playlistStep > s ? <Check size={10} strokeWidth={3} /> : s + 1}
                                </div>
                                {s < 2 && (
                                  <div style={{ flex: 1, height: 2, borderRadius: 1, background: playlistStep > s ? 'var(--accent, #E11D48)' : 'var(--border-subtle)', transition: 'background 300ms', minWidth: 16 }} />
                                )}
                              </div>
                            </React.Fragment>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div style={{ padding: '20px 24px' }}>
                      {/* Step 0: Name */}
                      {playlistStep === 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                          <div style={{ position: 'relative' }}>
                            <Music size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                            <input autoFocus value={newPlaylistName} onChange={e => setNewPlaylistName(e.target.value)}
                              placeholder="Ej: Gym, Relax, Favoritos..."
                              style={{ width: '100%', height: 42, padding: '0 14px 0 34px', borderRadius: 10, border: '1px solid var(--border-default)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', fontSize: 14, fontWeight: 500, outline: 'none', boxSizing: 'border-box', fontFamily: "'Inter Tight', sans-serif", transition: 'border-color 200ms' }}
                              onFocus={e => e.currentTarget.style.borderColor = 'var(--accent, #E11D48)'}
                              onBlur={e => e.currentTarget.style.borderColor = 'var(--border-default)'}
                              onKeyDown={e => { if (e.key === 'Enter' && newPlaylistName.trim()) setPlaylistStep(1); }} />
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textAlign: 'center' }}>
                            {tracks.length} {tracks.length === 1 ? 'canción disponible' : 'canciones disponibles'}
                          </div>
                        </div>
                      )}

                      {/* Step 1: Cover */}
                      {playlistStep === 1 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, alignItems: 'center' }}>
                          <div style={{ width: 140, height: 140, borderRadius: 14, overflow: 'hidden', background: 'var(--bg-deep)', border: `2px dashed ${playlistCoverData ? 'var(--accent, #E11D48)' : 'var(--border-subtle)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', position: 'relative', transition: 'all 250ms' }}
                            onMouseEnter={e => { if (!playlistCoverData) e.currentTarget.style.borderColor = 'var(--accent, #E11D48)'; }}
                            onMouseLeave={e => { if (!playlistCoverData) e.currentTarget.style.borderColor = 'var(--border-subtle)'; }}
                            onClick={() => document.getElementById('playlist-cover-input')?.click()}>
                            {playlistCoverData ? (
                              <>
                                <img src={playlistCoverData} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'opacity 200ms' }}
                                  onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                                  onClick={(e) => { e.stopPropagation(); document.getElementById('playlist-cover-input')?.click(); }}>
                                  <span style={{ fontSize: 11, fontWeight: 600, color: '#fff' }}>Cambiar</span>
                                </div>
                              </>
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, color: 'var(--text-muted)' }}>
                                <Image size={26} strokeWidth={1.5} />
                                <span style={{ fontSize: 11, fontWeight: 500 }}>Subir portada</span>
                              </div>
                            )}
                          </div>
                          <input id="playlist-cover-input" type="file" accept="image/*" style={{ display: 'none' }} onChange={e => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onload = ev => setPlaylistCoverData(ev.target?.result as string);
                              reader.readAsDataURL(file);
                            }
                          }} />
                          <div style={{ display: 'flex', gap: 10, width: '100%' }}>
                            <button onClick={() => setPlaylistCoverData('')} disabled={!playlistCoverData}
                              style={{ flex: 1, padding: '10px 0', borderRadius: 8, border: `1.5px solid ${!playlistCoverData ? 'var(--accent, #E11D48)' : 'var(--border-default)'}`, background: !playlistCoverData ? 'var(--accent-alpha, rgba(255,255,255,0.04))' : 'transparent', color: !playlistCoverData ? 'var(--accent, #E11D48)' : 'var(--text-muted)', fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 200ms' }}>
                              Sin portada
                            </button>
                            <button onClick={() => setPlaylistStep(2)}
                              className="btn-primary" style={{ flex: 1, height: 38, fontSize: 12 }}>
                              {playlistCoverData ? 'Siguiente' : 'Continuar'}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Step 2: Select Songs */}
                      {playlistStep === 2 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                          <div style={{ position: 'relative' }}>
                            <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)', pointerEvents: 'none' }} />
                            <input value={playlistSongSearch} onChange={e => setPlaylistSongSearch(e.target.value)} placeholder="Buscar canciones..."
                              style={{ width: '100%', height: 34, fontSize: 12, paddingLeft: 30, borderRadius: 8, background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }} />
                          </div>
                          <select value={playlistArtistFilter} onChange={e => setPlaylistArtistFilter(e.target.value)}
                            style={{ height: 32, padding: '0 10px', fontSize: 11, background: 'var(--bg-elevated)', color: 'var(--text-primary)', border: '1px solid var(--border-default)', outline: 'none', borderRadius: 8, cursor: 'pointer', colorScheme: 'dark' }}>
                            <option value="">Todos los artistas</option>
                            {artists.map(a => (
                              <option key={a.id} value={a.name}>{a.name}</option>
                            ))}
                          </select>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                              {selectedTrackIds.size} de {tracks.length}
                            </span>
                            <button onClick={() => setSelectedTrackIds(prev => prev.size === tracks.length ? new Set() : new Set(tracks.map(t => t.id)))} className="btn-ghost" style={{ fontSize: 10, color: 'var(--accent)', padding: '2px 8px' }}>
                              {selectedTrackIds.size === tracks.length ? 'Limpiar' : 'Seleccionar todo'}
                            </button>
                          </div>
                          <div style={{ maxHeight: 260, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2, borderRadius: 8, border: '1px solid var(--border-subtle)', padding: 3 }}>
                            {tracks.filter(t => {
                              if (playlistArtistFilter && t.artist !== playlistArtistFilter) return false;
                              if (playlistSongSearch && !t.title.toLowerCase().includes(playlistSongSearch.toLowerCase()) && !t.artist?.toLowerCase().includes(playlistSongSearch.toLowerCase())) return false;
                              return true;
                            }).map(t => {
                              const sel = selectedTrackIds.has(t.id);
                              return (
                                <div key={t.id} onClick={() => setSelectedTrackIds(prev => { const n = new Set(prev); if (n.has(t.id)) n.delete(t.id); else n.add(t.id); return n; })}
                                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 10px', borderRadius: 7, cursor: 'pointer', background: sel ? 'var(--accent-alpha, rgba(255,255,255,0.04))' : 'transparent', transition: 'background 150ms', border: sel ? '1px solid var(--accent, #E11D48)40' : '1px solid transparent' }}>
                                  <div style={{ width: 16, height: 16, borderRadius: 4, border: sel ? '2px solid var(--accent, #E11D48)' : '2px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: sel ? 'var(--accent, #E11D48)' : 'transparent', flexShrink: 0, transition: 'all 150ms' }}>
                                    {sel && <Check size={10} color="#fff" strokeWidth={3} />}
                                  </div>
                                  <div style={{ width: 24, height: 24, borderRadius: 4, overflow: 'hidden', background: 'var(--bg-deep)', flexShrink: 0 }}>
                                    {t.coverImage && <img src={t.coverImage} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                                  </div>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</div>
                                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{t.artist || 'Sin artista'}</div>
                                  </div>
                                </div>
                              );
                            })}
                            {tracks.filter(t => {
                              if (playlistArtistFilter && t.artist !== playlistArtistFilter) return false;
                              if (playlistSongSearch && !t.title.toLowerCase().includes(playlistSongSearch.toLowerCase()) && !t.artist?.toLowerCase().includes(playlistSongSearch.toLowerCase())) return false;
                              return true;
                            }).length === 0 && (
                              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', padding: '20px 8px', textAlign: 'center' }}>
                                No hay canciones
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Footer */}
                    <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between', padding: '14px 24px', borderTop: '1px solid var(--border-subtle)' }}>
                      <div>
                        {playlistStep > 0 && !editingPlaylistId && (
                          <button onClick={() => setPlaylistStep(s => s - 1)} className="btn-ghost" style={{ padding: '8px 14px', fontSize: 12 }}>
                            <ChevronLeft size={14} /> Atrás
                          </button>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 10 }}>
                        <button onClick={() => { setShowCreatePlaylist(false); setPlaylistStep(0); setPlaylistCoverData(''); setNewPlaylistName(''); setSelectedTrackIds(new Set()); }}
                          style={{ height: 36, padding: '0 18px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1px solid var(--border-default)', background: 'transparent', color: 'var(--text-secondary)', transition: 'all 200ms' }}>
                          Cancelar
                        </button>
                        {editingPlaylistId ? (
                          <button onClick={() => {
                            const name = newPlaylistName.trim();
                            if (!name) return;
                            updatePlaylist(editingPlaylistId, { name, coverImage: playlistCoverData || undefined });
                            setShowCreatePlaylist(false); setEditingPlaylistId(null); setPlaylistStep(0);
                          }} className="btn-primary" style={{ height: 36, padding: '0 18px', fontSize: 12 }}>
                            Guardar
                          </button>
                        ) : playlistStep < 2 ? (
                          <button onClick={() => {
                            if (playlistStep === 0 && !newPlaylistName.trim()) return;
                            setPlaylistStep(s => s + 1);
                          }} className="btn-primary" style={{ height: 36, padding: '0 18px', fontSize: 12, opacity: playlistStep === 0 && !newPlaylistName.trim() ? 0.5 : 1 }}>
                            Siguiente <ChevronRight size={14} />
                          </button>
                        ) : (
                          <button onClick={() => {
                            const name = newPlaylistName.trim();
                            if (!name) return;
                            addPlaylist(name, Array.from(selectedTrackIds), playlistCoverData || undefined);
                            setShowCreatePlaylist(false); setPlaylistStep(0); setPlaylistCoverData(''); setNewPlaylistName(''); setSelectedTrackIds(new Set());
                          }} className="btn-primary" style={{ height: 36, padding: '0 18px', fontSize: 12, fontWeight: 700 }}>
                            <Check size={14} /> Crear playlist
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
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
                    {displayTracks.length > 0 ? displayTracks.map((track, i) => {
                      const isPlaying = currentTrackId === track.id && isPlayingMusic;
                      return (
                        <div
                          key={track.id}
                          onClick={() => handlePlayWithTabCb(track.id)}
                          style={{
                            display: 'grid', gridTemplateColumns: '40px 3.5fr 1.5fr 80px 130px', padding: '10px 12px',
                            borderRadius: 8, alignItems: 'center', cursor: 'pointer', transition: 'all 150ms',
                            background: isPlaying ? 'var(--accent-dim)' : 'transparent',
                            border: isPlaying ? '1px solid var(--accent-glow)' : '1px solid transparent',
                          }}
                          onMouseEnter={e => { if (!isPlaying) e.currentTarget.style.background = 'var(--bg-hover)'; }}
                          onMouseLeave={e => { if (!isPlaying) e.currentTarget.style.background = 'transparent'; }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            {isPlaying ? (
                              <div style={{ width: 24, height: 24, borderRadius: 6, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                                <Pause size={12} fill="#fff" />
                              </div>
                            ) : (
                              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)', width: 24, textAlign: 'center' }}>{i + 1}</span>
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
                            <button onClick={(e) => { e.stopPropagation(); toggleTrackFavorite(track.id); }} className="btn-ghost" style={{ padding: 6, color: track.isFavorite ? 'var(--accent)' : 'var(--text-tertiary)' }} title={track.isFavorite ? 'Quitar de favoritos' : 'Añadir a favoritos'}>
                              <Heart size={16} style={{ fill: track.isFavorite ? 'var(--accent)' : 'transparent' }} />
                            </button>

                            <button onClick={(e) => {
                              e.stopPropagation();
                              setEditingTrackId(track.id);
                              setEditTitle(track.title);
                              setEditArtist(track.artist);
                              setEditCover(track.coverImage || '');
                            }} className="btn-ghost" style={{ padding: 6, color: 'var(--text-tertiary)' }} title="Editar canción">
                              <Edit2 size={14} />
                            </button>
                            <button onClick={(e) => {
                              e.stopPropagation();
                              setConfirmDelete({ type: 'track', id: track.id, name: track.title });
                            }} className="btn-ghost" style={{ padding: 6, color: 'var(--text-tertiary)' }} title="Eliminar canción">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      )
                    }                    ) : (
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
                    return (
                      <div
                        key={track.id}
                        onClick={() => handlePlayWithTabCb(track.id)}
                        style={{
                          padding: '10px 10px 12px', display: 'flex', flexDirection: 'column', gap: 10, cursor: 'pointer',
                          borderRadius: 12,
                          background: isPlaying ? 'var(--accent-dim)' : 'var(--bg-deep)',
                          border: isPlaying ? '1px solid var(--accent-glow)' : '1px solid var(--border-subtle)',
                          transition: 'transform 200ms ease, box-shadow 250ms ease, border-color 200ms',
                          boxShadow: isPlaying ? '0 4px 16px rgba(0,0,0,0.12)' : '0 1px 3px rgba(0,0,0,0.04)',
                        }}
                        onMouseEnter={e => { if (!isPlaying) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.10)'; e.currentTarget.style.borderColor = 'var(--accent-glow)'; } }}
                        onMouseLeave={e => { if (!isPlaying) { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)'; e.currentTarget.style.borderColor = 'var(--border-subtle)'; } }}
                      >
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

          {/* EXPLORAR & DESCARGAR SECTION (CUSTOM YT/SPOTIFY SCRAPER) */}
          {activeTab === 'explorar' && (
            <div className="bento-card" style={{ padding: '24px 28px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div>
                  <div className="section-header" style={{ marginBottom: 4, fontSize: 14, color: 'var(--text-primary)' }}>Explorar & Descargar Música</div>
                  <p style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Importa canciones o playlists completas desde YouTube mediante Owa Downloader.</p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                </div>
              </div>

              {/* Web mode banner */}
              {!isTauri() && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.3)', borderRadius: 8, marginBottom: 16 }}>
                  <AlertCircle size={18} style={{ color: '#F59E0B', flexShrink: 0 }} />
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    <strong>Las descargas requieren la app de escritorio.</strong> Estás en modo web. Para descargar canciones con yt-dlp, ejecuta <code style={{ background: 'rgba(0,0,0,0.3)', padding: '2px 6px', borderRadius: 4, fontSize: 11 }}>npm run tauri dev</code>
                  </div>
                </div>
              )}

              {/* Input mode toggle */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                <button onClick={() => setSearchMode('link')} className="btn-secondary" style={{ height: 34, padding: '0 16px', fontSize: 11, display: 'flex', alignItems: 'center', gap: 6, background: searchMode === 'link' ? 'var(--accent)' : 'var(--bg-surface)', color: searchMode === 'link' ? '#fff' : 'var(--text-secondary)', border: searchMode === 'link' ? 'none' : '1px solid var(--border-default)', borderRadius: 8 }}>
                  <Link size={12} /> Pegar enlace
                </button>
                <button onClick={() => setSearchMode('query')} className="btn-secondary" style={{ height: 34, padding: '0 16px', fontSize: 11, display: 'flex', alignItems: 'center', gap: 6, background: searchMode === 'query' ? 'var(--accent)' : 'var(--bg-surface)', color: searchMode === 'query' ? '#fff' : 'var(--text-secondary)', border: searchMode === 'query' ? 'none' : '1px solid var(--border-default)', borderRadius: 8 }}>
                  <Search size={12} /> Buscar
                </button>
              </div>

              {/* URL Input Bar */}
              {searchMode === 'link' && (
                <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, border: '1px solid var(--border-default)', borderRadius: 8, padding: '0 14px' }}>
                    <Link size={16} style={{ color: 'var(--text-muted)' }} />
                    <input
                      ref={urlInputRef}
                      type="text"
                      value={url}
                      onChange={e => setUrl(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Pega un enlace de YouTube (video o playlist)..."
                      className="input-base"
                      style={{ border: 'none', background: 'transparent', height: 42, padding: 0, fontSize: 13 }}
                    />
                    {url && <button onClick={() => setUrl('')} className="btn-ghost" style={{ padding: 4 }}><X size={14} /></button>}
                  </div>

                  <button onClick={handleUrlSubmit} className="btn-primary" style={{ height: 42, padding: '0 24px', display: 'flex', alignItems: 'center', gap: 8 }} disabled={isLoading}>
                    {isLoading ? <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Search size={16} />}
                    Analizar Enlace
                  </button>
                </div>
              )}

              {/* Search Bar */}
              {searchMode === 'query' && (
                <div style={{ display: 'flex', gap: 12, marginBottom: 16, animation: 'fadeIn 200ms' }}>
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, border: '1px solid var(--border-default)', borderRadius: 8, padding: '0 14px' }}>
                    <Search size={16} style={{ color: 'var(--text-muted)' }} />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Busca canciones directamente en YouTube..."
                      className="input-base"
                      style={{ border: 'none', background: 'transparent', height: 40, padding: 0, fontSize: 13 }}
                    />
                  </div>
                  <button onClick={handleSearch} className="btn-primary" style={{ height: 40, padding: '0 20px', display: 'flex', alignItems: 'center', gap: 8 }} disabled={isLoading}>
                    {isLoading ? <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Search size={16} />} Buscar
                  </button>
                </div>
              )}

              {/* Download options */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '16px 18px', borderRadius: 10, border: '1px solid var(--border-subtle)', marginBottom: 20 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', minWidth: 48 }}>Calidad</span>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {([['7', '96'], ['5', '128'], ['3', '192'], ['0', '320']] as const).map(([q, label]) => (
                        <button key={q} onClick={() => setAudioQuality(q)}
                          style={{
                            padding: '5px 10px', borderRadius: 6, fontSize: 10, fontWeight: 600, minWidth: 44, textAlign: 'center',
                            background: audioQuality === q ? 'var(--accent)' : 'var(--bg-surface)',
                            color: audioQuality === q ? '#fff' : 'var(--text-tertiary)',
                            border: '1px solid', borderColor: audioQuality === q ? 'var(--accent)' : 'var(--border-default)',
                            cursor: 'pointer', transition: 'all 150ms',
                          }}
                        >{label}</button>
                      ))}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', minWidth: 48 }}>Formato</span>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {(['mp3', 'm4a'] as const).map(f => (
                        <button key={f} onClick={() => setAudioFormat(f)}
                          style={{
                            padding: '5px 10px', borderRadius: 6, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', minWidth: 44, textAlign: 'center',
                            background: audioFormat === f ? 'var(--accent)' : 'var(--bg-surface)',
                            color: audioFormat === f ? '#fff' : 'var(--text-tertiary)',
                            border: '1px solid', borderColor: audioFormat === f ? 'var(--accent)' : 'var(--border-default)',
                            cursor: 'pointer', transition: 'all 150ms',
                          }}
                        >{f}</button>
                      ))}
                    </div>
                    {audioFormat === 'm4a' && <span style={{ fontSize: 9, color: 'var(--accent)', fontWeight: 500, opacity: 0.8 }}>✓ AAC</span>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', minWidth: 48 }}>Opciones</span>
                    <button onClick={() => setIncludeCover(!includeCover)}
                      style={{
                        padding: '5px 10px', borderRadius: 6, fontSize: 10, fontWeight: 600, whiteSpace: 'nowrap',
                        background: includeCover ? 'var(--accent)' : 'var(--bg-surface)',
                        color: includeCover ? '#fff' : 'var(--text-tertiary)',
                        border: '1px solid', borderColor: includeCover ? 'var(--accent)' : 'var(--border-default)',
                        cursor: 'pointer', transition: 'all 150ms', display: 'flex', alignItems: 'center', gap: 5,
                      }}
                    ><Image size={10} /> {includeCover ? 'Con portada' : 'Sin portada'}</button>
                    <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', wordBreak: 'break-all', opacity: 0.7 }}>{persistentDownloadPath || 'Descargas/OWA Music'}</span>
                    <button onClick={handleSelectFolder} className="btn-ghost" style={{ padding: 4, display: 'flex', color: 'var(--text-tertiary)', cursor: 'pointer' }}><FolderOpen size={13} /></button>
                  </div>
                </div>
              </div>

              {/* Loading State */}
              {isLoading && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 0', gap: 12 }}>
                  <Loader size={28} style={{ animation: 'spin 1s linear infinite', color: 'var(--accent)' }} />
                  <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Procesando solicitud con Owa Downloader...</span>
                </div>
              )}

              {/* Search Results */}
              {searchResults.length > 0 && !isLoading && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Resultados de Búsqueda ({searchResults.length})</div>
                    <button onClick={() => setSearchResults([])} className="btn-ghost" style={{ padding: 4 }}><X size={14} /></button>
                  </div>
                  {searchResults.map((r, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
                      <div style={{ width: 44, height: 33, borderRadius: 6, background: 'var(--bg-surface)', overflow: 'hidden', flexShrink: 0 }}>
                        {r.thumbnail ? <img src={r.thumbnail} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Music size={14} />}
                      </div>
                      <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>{r.title}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.channel} · {formatDuration(r.duration)}</div>
                      </div>
                      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                        <button onClick={async () => {
                          try {
                            const existing = await WebviewWindow.getByLabel('youtube-player');
                            if (existing) {
                              await emitTo('youtube-player', 'youtube:load', { videoUrl: r.webpage_url, title: r.title, thumbnail: r.thumbnail || '' });
                              await existing.show(); await existing.setFocus();
                              return;
                            }
                            try { localStorage.setItem('owa_yt_pending', JSON.stringify({ videoUrl: r.webpage_url, title: r.title, thumbnail: r.thumbnail || '' })); } catch {}
                            const win = new WebviewWindow('youtube-player', {
                              url: '/',
                              title: 'YouTube Player',
                              width: 480, height: 360,
                              minWidth: 320, minHeight: 240,
                              resizable: true,
                              decorations: true,
                              alwaysOnTop: false,
                              skipTaskbar: false,
                              center: true,
                            });
                            win.once('tauri://error', () => {});
                            setTimeout(async () => {
                              try {
                                await emitTo('youtube-player', 'youtube:load', { videoUrl: r.webpage_url, title: r.title, thumbnail: r.thumbnail || '' });
                              } catch {}
                            }, 1500);
                          } catch {
                            setYoutubePlayerUrl(r.webpage_url); setYoutubePlayerTitle(r.title); setYoutubePlayerThumb(r.thumbnail || '');
                          }
                        }} className="btn-secondary" style={{ padding: '5px 10px', height: 30, fontSize: 10, display: 'flex', alignItems: 'center', gap: 4 }}><Play size={11} /> YouTube</button>
                        <button onClick={() => handleDownloadOne(r)} className="btn-primary" style={{ padding: '5px 10px', height: 30, fontSize: 10, display: 'flex', alignItems: 'center', gap: 4 }}><Download size={11} /> Descargar</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* No Results — Recommendation */}
              {searchPerformed && searchResults.length === 0 && !isLoading && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '40px 20px', marginBottom: 20 }}>
                  <Music size={40} style={{ color: 'var(--text-muted)', opacity: 0.4 }} />
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>No se encontraron resultados</div>
                    <div style={{ fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.5, maxWidth: 300 }}>
                      No encontramos &ldquo;{searchQuery}&rdquo; en tu biblioteca o en YouTube.
                    </div>
                  </div>
                  <button onClick={() => { setSearchMode('link'); setUrl(`https://www.youtube.com/results?search_query=${encodeURIComponent(searchQuery)}`); }}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 24px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', border: 'none', background: 'var(--accent)', color: '#fff', transition: 'all 200ms' }}>
                    <Plus size={16} /> Agregar canción &mdash; Buscar en YouTube
                  </button>
                  <button onClick={() => { setSearchResults([]); setSearchPerformed(false); setSearchQuery(''); }}
                    style={{ fontSize: 11, color: 'var(--text-tertiary)', cursor: 'pointer', background: 'none', border: 'none', textDecoration: 'underline', textUnderlineOffset: 3 }}>
                    Nueva búsqueda
                  </button>
                </div>
              )}

              {/* Preview Area */}
              {preview && !isLoading && (
                <div style={{ padding: 20, borderRadius: 12, border: '1px solid var(--border-default)', position: 'relative' }}>
                  <button onClick={() => setPreview(null)} className="btn-ghost" style={{ position: 'absolute', top: 12, right: 12, padding: 6, zIndex: 1 }}><X size={16} /></button>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 24, marginBottom: 20 }}>
                    <div style={{ width: 120, height: 120, borderRadius: 8, background: 'linear-gradient(135deg, var(--accent), #8B1A3B)', overflow: 'hidden', flexShrink: 0, boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
                      {preview.thumbnail ? <img src={preview.thumbnail} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Music size={48} style={{ margin: '36px auto', display: 'block', color: 'rgba(255,255,255,0.3)' }} />}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--accent)', marginBottom: 6 }}>{isPlaylist(preview) ? 'Playlist de YouTube' : 'Video de YouTube'}</div>
                      <h3 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>{preview.title || 'Sin título'}</h3>
                      <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>{preview.channel}</div>
                      <div style={{ display: 'flex', gap: 12 }}>
                        <button onClick={handleDownloadAll} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, height: 36 }}>
                          <Download size={14} /> {isPlaylist(preview) ? 'Descargar Toda la Playlist' : 'Descargar Audio'}
                        </button>
                        <button onClick={handleSelectFolder} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, height: 36 }}>
                          <FolderOpen size={14} /> Elegir Carpeta
                        </button>
                      </div>
                    </div>
                  </div>

                  {isPlaylist(preview) && preview.entries.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 300, overflowY: 'auto', paddingRight: 8 }}>
                      {preview.entries.map((entry: YouTubeMetadata, i: number) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', background: 'var(--bg-surface)', borderRadius: 6, border: '1px solid var(--border-subtle)' }}>
                          <span style={{ fontSize: 11, color: 'var(--text-tertiary)', width: 24 }}>{i + 1}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.title}</div>
                            <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{entry.channel}</div>
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{formatDuration(entry.duration)}</div>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button onClick={() => handleDownloadOne(entry)} className="btn-ghost" style={{ padding: 6 }}><Download size={12} /></button>
                          </div>
                        </div>
                      ))}
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

          {/* REPRODUCIENDO CARD */}
          {currentTrack ? (
            <div className="bento-card" style={{ padding: '24px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', border: isPlayingMusic ? '1px solid var(--accent)' : '1px solid var(--border-default)', transition: 'all 300ms' }}>
              <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: isPlayingMusic ? 'var(--accent)' : 'var(--text-muted)' }} />
                  <span className="section-header" style={{ marginBottom: 0, fontSize: 12, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    {isPlayingMusic ? 'Reproduciendo' : 'Pausado'}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Heart size={16} style={{ color: currentTrack.isFavorite ? 'var(--accent)' : 'var(--text-muted)', fill: currentTrack.isFavorite ? 'var(--accent)' : 'none', cursor: 'pointer' }} onClick={() => toggleTrackFavorite(currentTrack.id)} />
                  <Edit2 size={13} style={{ color: 'var(--text-muted)', cursor: 'pointer', opacity: 0.5 }} onClick={() => { setEditingTrackId(currentTrack.id); setEditTitle(currentTrack.title); setEditArtist(currentTrack.artist); setEditCover(currentTrack.coverImage || ''); }} />
                </div>
              </div>

              <div onClick={() => currentTrack && setCoverModalTrackId(currentTrack.id)} style={{ width: '100%', aspectRatio: '1/1', borderRadius: 12, overflow: 'hidden', marginBottom: 20, boxShadow: '0 8px 24px rgba(0,0,0,0.6)', position: 'relative', background: 'var(--bg-surface)', cursor: 'pointer' }}
                onMouseEnter={() => setCoverHover(true)}
                onMouseLeave={() => setCoverHover(false)}>
                {currentTrack.coverImage ? <img src={currentTrack.coverImage} alt={currentTrack.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Music size={48} style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', color: 'var(--text-muted)', opacity: 0.15 }} />}
                {isPlayingMusic && (
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, transparent 60%, rgba(0,0,0,0.12) 100%)', pointerEvents: 'none' }} />
                )}
                {/* Expand hint overlay */}
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
              </div>

              <div style={{ textAlign: 'center', marginBottom: 20, width: '100%' }}>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{currentTrack.title}</h3>
                <p style={{ fontSize: 13, color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{currentTrack.artist}</p>
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
          ) : (
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

                  return queueItems.length > 0 ? queueItems.map((trackId, i) => {
                    const t = tracks.find(tr => tr.id === trackId);
                    if (!t) return null;
                    return (
                      <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', padding: '4px 0', borderRadius: 6 }} onClick={() => handlePlayWithTabCb(t.id)} className="hover-lift">
                        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', width: 16, textAlign: 'center' }}>{i + 1}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.artist}</div>
                        </div>
                        <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>{formatTime(t.duration)}</span>
                      </div>
                    );
                  }) : (
                    <div style={{ padding: '20px 0', textAlign: 'center', fontSize: 12, color: 'var(--text-tertiary)' }}>
                      Fin de la lista
                    </div>
                  );
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

          {/* DOWNLOADS CARD — inline en columna derecha */}
          {(downloadSelection.length > 0 || downloadQueue.length > 0) && (
            <div className="bento-card" style={{ padding: '16px 18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '0.02em' }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)' }} />
                  Descargas
                </div>
                <button onClick={() => {
                  setDownloadSelection([]);
                  clearCompletedDownloads();
                }} className="btn-ghost" style={{ padding: 4, color: 'var(--text-tertiary)', borderRadius: '50%', opacity: 0.5, cursor: 'pointer', transition: 'opacity 200ms' }}
                  onMouseEnter={e => { e.currentTarget.style.opacity = '1'; }}
                  onMouseLeave={e => { e.currentTarget.style.opacity = '0.5'; }}
                ><X size={13} /></button>
              </div>

              {/* Activos: progress + Cancel (sin X) */}
              {downloadQueue.filter(d => d.status === 'downloading' || d.status === 'queued').length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 8, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
                    Descargando
                  </div>
                  {downloadQueue.filter(d => d.status === 'downloading' || d.status === 'queued').map(dl => (
                    <div key={dl.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', borderRadius: 8, background: 'var(--bg-surface)', marginBottom: 6 }}>
                      <div style={{ width: 28, height: 28, borderRadius: 5, background: 'var(--bg-deep)', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {dl.thumbnail ? <img src={dl.thumbnail} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Music size={11} style={{ color: 'var(--text-muted)' }} />}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 4 }}>{dl.title}</div>
                        <div style={{ height: 3, borderRadius: 2, background: 'var(--bg-deep)', overflow: 'hidden' }}>
                          <div style={{ width: `${dl.progress * 100}%`, height: '100%', borderRadius: 2, background: 'var(--accent)', transition: 'width 400ms ease' }} />
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                        <span style={{ fontSize: 9, color: 'var(--text-tertiary)', fontVariantNumeric: 'tabular-nums' }}>
                          {Math.round(dl.progress * 100)}%
                        </span>
                        <button onClick={() => handleCancelDownload(dl.id)} style={{ padding: '3px 8px', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 4, fontSize: 8, fontWeight: 600, color: 'var(--text-tertiary)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {downloadQueue.filter(d => d.status !== 'downloading' && d.status !== 'queued').length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 8, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>
                    Finalizadas
                  </div>
                  {downloadQueue.filter(d => d.status !== 'downloading' && d.status !== 'queued').map(dl => (
                    <div key={dl.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 8px', borderRadius: 6, marginBottom: 2 }}>
                      <div style={{ width: 24, height: 24, borderRadius: 4, background: 'var(--bg-deep)', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {dl.thumbnail ? <img src={dl.thumbnail} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Music size={10} style={{ color: 'var(--text-muted)' }} />}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{dl.title}</div>
                        <div style={{ fontSize: 8, color: dl.status === 'error' ? 'var(--danger)' : 'var(--text-tertiary)', marginTop: 1, display: 'flex', alignItems: 'center', gap: 3 }}>
                          {dl.status === 'completed' && <Check size={8} style={{ color: 'var(--success)' }} />}
                          {dl.status === 'error' && <AlertCircle size={8} />}
                          {dl.status === 'completed' ? 'Completado' : dl.status === 'error' ? (dl.errorMessage || 'Error') : 'Cancelado'}
                        </div>
                      </div>
                      <button onClick={() => removeFromDownloadQueue(dl.id)} style={{ padding: 2, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', flexShrink: 0, opacity: 0.4 }}><X size={8} /></button>
                    </div>
                  ))}
                </div>
              )}

              {downloadSelection.length > 0 && (
                <>
                  <div style={{ fontSize: 8, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
                    Pendientes ({downloadSelection.length})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 12, maxHeight: 160, overflowY: 'auto', paddingRight: 4 }}>
                    {downloadSelection.map((item, i) => (
                      <div key={item.url} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', borderRadius: 6, background: 'var(--bg-surface)' }}>
                        <div style={{ width: 22, height: 22, borderRadius: 4, background: 'var(--bg-deep)', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {item.thumbnail ? <img src={item.thumbnail} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Music size={9} style={{ color: 'var(--text-muted)' }} />}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 9, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</div>
                        </div>
                        <button onClick={() => setDownloadSelection(prev => prev.filter((_, idx) => idx !== i))} style={{ padding: 2, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', flexShrink: 0, opacity: 0.4 }}><X size={8} /></button>
                      </div>
                    ))}
                  </div>
                  <button onClick={startBulkDownload} className="btn-primary" style={{ width: '100%', height: 32, fontSize: 10, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, borderRadius: 7 }}>
                    <Download size={11} /> Descargar Todo ({downloadSelection.length})
                  </button>
                </>
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
      {editingTrackId && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
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
        </div>
      )}

      {/* Edit Artist Dialog */}
      {editingArtistId && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1100,
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
                      const q = artistTrackSearch.toLowerCase();
                      return t.title.toLowerCase().includes(q) || (t.artist?.toLowerCase() || '').includes(q);
                    }).length === 0 && (
                      <div style={{ fontSize: 12, color: 'var(--text-tertiary)', padding: '16px 8px', textAlign: 'center' }}>
                        {artistTrackSearch ? 'Sin resultados' : 'No hay canciones en tu biblioteca'}
                      </div>
                    )}
                    {tracks.filter(t => {
                      if (!artistTrackSearch) return true;
                      const q = artistTrackSearch.toLowerCase();
                      return t.title.toLowerCase().includes(q) || (t.artist?.toLowerCase() || '').includes(q);
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
        </div>
      )}

      {confirmDelete && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
        }} onClick={() => setConfirmDelete(null)}>
          <div style={{ padding: 28, width: 340, maxWidth: '90vw', background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 16 }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>
              {confirmDelete.type === 'artist' ? 'Eliminar Artista' : confirmDelete.type === 'playlist' ? 'Eliminar Playlist' : 'Eliminar Canción'}
            </h3>
            <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 24, lineHeight: 1.5 }}>
              {confirmDelete.type === 'track'
                ? `Se eliminará "${confirmDelete.name}" de tu biblioteca.`
                : confirmDelete.type === 'artist'
                  ? `Se eliminará "${confirmDelete.name}" y se desvincularán sus canciones.`
                  : `Se eliminará la playlist "${confirmDelete.name}" de tu biblioteca.`}
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button onClick={() => setConfirmDelete(null)} style={{ height: 38, padding: '0 20px', fontSize: 12, fontWeight: 600, borderRadius: 8, cursor: 'pointer', border: '1px solid var(--border-default)', background: 'var(--bg-surface)', color: 'var(--text-secondary)' }}>
                Cancelar
              </button>
              <button onClick={() => {
                const d = confirmDelete;
                if (d.type === 'track') deleteTrack(d.id);
                else if (d.type === 'artist') deleteArtist(d.id);
                else if (d.type === 'playlist') deletePlaylist(d.id);
                setConfirmDelete(null);
              }} style={{ height: 38, padding: '0 20px', fontSize: 12, fontWeight: 700, borderRadius: 8, cursor: 'pointer', border: 'none', background: '#EF4444', color: '#fff', display: 'flex', alignItems: 'center', gap: 6 }}>
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* YOUTUBE FLOATING PLAYER MODAL */}
      {youtubePlayerUrl && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 10000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)',
        }} onClick={() => { setYoutubePlayerUrl(null); }}>
          <div onClick={e => e.stopPropagation()} className="bento-card" style={{
            width: '90%', maxWidth: 480,
            borderRadius: 16, overflow: 'hidden',
            boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
          }}>
            {/* Cover art */}
            <div style={{ width: '100%', aspectRatio: '16/9', position: 'relative', background: '#000', overflow: 'hidden' }}>
              {youtubePlayerThumb ? (
                <img src={youtubePlayerThumb} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.3, filter: 'blur(20px)', position: 'absolute', inset: 0 }} />
              ) : null}
              <iframe
                src={`https://www.youtube.com/embed/${new URL(youtubePlayerUrl).searchParams.get('v') || youtubePlayerUrl.split('/').pop()}?autoplay=1&rel=0&showinfo=0&color=white&iv_load_policy=3&modestbranding=1`}
                title={youtubePlayerTitle}
                style={{ width: '100%', height: '100%', border: 'none', position: 'relative', zIndex: 1 }}
                allow="autoplay; encrypted-media; picture-in-picture"
                allowFullScreen
              />
            </div>
            {/* Info bar */}
            <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{youtubePlayerTitle}</div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>Reproduciendo desde YouTube</div>
              </div>
              <button onClick={() => setYoutubePlayerUrl(null)} style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginLeft: 12 }}>
                <X size={14} />
              </button>
            </div>
          </div>
        </div>
      )}



    </div>
  );
}

