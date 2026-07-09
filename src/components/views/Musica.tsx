import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  Play, Pause, SkipBack, SkipForward, Volume2, Search,
  Music, Download, Trash2, X, ListMusic, Upload,
  Link, Globe, Loader, CheckCircle, AlertCircle,
  ArrowLeft, ArrowRight, ChevronDown, ChevronUp,
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
  const [colocarTrackId, setColocarTrackId] = useState<string | null>(null);
  const [youtubePlayerUrl, setYoutubePlayerUrl] = useState<string | null>(null);
  const [youtubePlayerTitle, setYoutubePlayerTitle] = useState('');
  const [youtubePlayerThumb, setYoutubePlayerThumb] = useState('');

  const [downloadSelection, setDownloadSelection] = useState<{ url: string; title: string; channel?: string; thumbnail?: string; duration?: number }[]>([]);

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
    setIsLoading(true);
    setSearchResults([]);
    setSearchPerformed(false);
    try {
      const results = await searchMusic(q);
      setSearchResults(results);
      setSearchPerformed(true);
    } catch {
      addNotification('Error al buscar', 'error');
      setSearchPerformed(true);
    } finally {
      setIsLoading(false);
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
      updateDownloadStatus(dlItemId, 'completed');
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
            <h1 style={{ fontSize: 32, fontWeight: 700, color: 'var(--accent)', lineHeight: 1.15, letterSpacing: '-0.02em', fontFamily: "'Inter Tight', sans-serif", textShadow: '0 0 20px var(--accent-glow)' }}>Música</h1>
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
            {/* Clock background illumination */}
            <div style={{
              position: 'absolute',
              top: '50%',
              right: 0,
              width: 150,
              height: 100,
              background: 'radial-gradient(circle at center, var(--accent-dim) 0%, transparent 70%)',
              opacity: 0.4,
              transform: 'translateY(-50%)',
              pointerEvents: 'none',
              zIndex: 0
            }} />
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10B981', boxShadow: '0 0 8px rgba(16,185,129,0.5)', position: 'relative', zIndex: 1 }} />
            <div style={{ textAlign: 'right', position: 'relative', zIndex: 1 }}>
              <div className="flex items-baseline gap-2 justify-end">
                <span style={{ fontFamily: "'Inter Tight', sans-serif", fontSize: 68, fontWeight: 200, lineHeight: 0.9, color: 'var(--accent)', letterSpacing: '0.02em', textShadow: '0 0 20px var(--accent-glow)' }}>
                  {timeStr}
                </span>
                <span style={{ fontFamily: "'Inter Tight', sans-serif", fontSize: 22, fontWeight: 200, color: 'var(--accent)', opacity: 0.7, letterSpacing: '0.02em' }}>
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
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, background: 'var(--accent)', borderRadius: 2, boxShadow: '0 0 8px var(--accent-glow)' }} />
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

            <button onClick={() => setActiveTab('explorar')} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 8, height: 38, borderRadius: 10, fontSize: 12, fontWeight: 700, padding: '0 18px', boxShadow: '0 4px 15px var(--accent-dim)' }}>
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
              { label: 'Canciones', val: tracks.length, sub: 'en tu biblioteca', icon: Music, color: 'var(--accent)' },
              { label: 'Favoritas', val: tracks.filter(t => t.isFavorite).length, sub: 'guardadas', icon: Heart, color: '#10B981' },
              { label: 'Hoy', val: formatHm(musicListeningTime), sub: 'escuchando Música', icon: Activity, color: '#F59E0B' },
            ].map((s, i) => (
              <div key={i} className="bento-card" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10, background: 'linear-gradient(135deg, var(--bg-elevated) 0%, var(--bg-base) 100%)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span className="stat-label" style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{s.label}</span>
                  <div style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <s.icon size={16} style={{ color: s.color }} />
                  </div>
                </div>
                <div>
                  <div className="stat-value" style={{ fontSize: 24, fontWeight: 700 }}>{s.val}</div>
                  <div className="stat-subtext" style={{ fontSize: 11, marginTop: 2, color: 'var(--text-tertiary)' }}>{s.sub}</div>
                </div>
              </div>
            ))}
          </div>

          {/* ARTISTAS VIEW */}
          {activeTab === 'artistas' && (
            <div>
              {!selectedArtist ? (
                <div className="bento-card" style={{ padding: '28px', background: 'linear-gradient(135deg, var(--bg-elevated) 0%, var(--bg-base) 100%)' }}>
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
                        <div key={artist.id} className="hover-lift" style={{ padding: '32px 20px', borderRadius: 16, border: '1px solid var(--border-subtle)', transition: 'all 250ms', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, position: 'relative', background: 'linear-gradient(135deg, var(--bg-elevated) 0%, var(--bg-base) 100%)', cursor: 'pointer' }}
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
                  <div style={{ position: 'relative', borderRadius: 16, overflow: 'hidden' }}>
                    {/* Blurred cover background */}
                    {firstCover && (
                      <div style={{ position: 'absolute', inset: 0, background: `url(${firstCover}) center/cover no-repeat`, filter: 'blur(80px) saturate(1.8)', opacity: 0.5 }} />
                    )}
                    <div style={{ position: 'relative', padding: '32px', background: firstCover ? 'rgba(0,0,0,0.25)' : 'transparent' }}>
                      <button onClick={() => setSelectedArtist(null)} className="btn-ghost" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 20, padding: '6px 12px', borderRadius: 8 }}>
                        <ArrowLeft size={14} /> Volver a artistas
                      </button>

                      <div style={{ display: 'flex', gap: 32, alignItems: 'flex-end', marginBottom: 32 }}>
                        <div style={{ width: 160, height: 160, borderRadius: '50%', background: firstCover ? 'var(--bg-surface)' : `color-mix(in srgb, var(--accent) 25%, var(--bg-deep))`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 48, fontWeight: 700, boxShadow: '0 10px 40px rgba(0,0,0,0.5)', flexShrink: 0, overflow: 'hidden' }}>
                          {artists.find(a => a.name === selectedArtist)?.profileImage ? <img src={artists.find(a => a.name === selectedArtist)?.profileImage} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : selectedArtist.slice(0, 2).toUpperCase()}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8, opacity: 0.8 }}>ARTISTA</div>
                          <h2 style={{ fontSize: 34, fontWeight: 800, color: 'var(--text-primary)', margin: 0, lineHeight: 1.15 }}>{selectedArtist}</h2>
                          <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 8 }}>{artistTracks.length} canciones</div>
                          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                            <button onClick={() => {
                              if (artistTracks.length === 0) return;
                              if (isPlayingAll) { toggleMusicPlayback(); return; }
                              const allIds = artistTracks.map(t => t.id);
                              setQueueSource({ pool: allIds });
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

                      {/* Track List */}
                      {artistTracks.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {artistTracks.map((t, idx) => {
                            const isPlaying = currentTrackId === t.id && isPlayingMusic;
                            return (
                              <div key={t.id} onClick={() => { const pool = artistTracks.map(x => x.id); setQueueSource({ pool }); handlePlayWithTabCb(t.id); }} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 10, cursor: 'pointer', background: isPlaying ? 'var(--accent-dim)' : 'transparent', transition: 'background 150ms' }}
                                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-surface)'}
                                onMouseLeave={e => e.currentTarget.style.background = isPlaying ? 'var(--accent-dim)' : 'transparent'}>
                                <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-tertiary)', width: 24, textAlign: 'center' }}>{isPlaying ? <Play size={10} fill="var(--accent)" style={{ color: 'var(--accent)' }} /> : idx + 1}</span>
                                <div style={{ width: 36, height: 36, borderRadius: 6, overflow: 'hidden', flexShrink: 0, background: t.coverImage ? 'transparent' : `color-mix(in srgb, var(--accent) 15%, var(--bg-deep))`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  {t.coverImage ? <img src={t.coverImage} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Music size={16} style={{ color: 'var(--text-muted)', opacity: 0.4 }} />}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontSize: 13, fontWeight: isPlaying ? 600 : 500, color: isPlaying ? 'var(--accent)' : 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</div>
                                </div>
                                <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{formatTime(t.duration)}</span>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)', background: 'rgba(0,0,0,0.15)', borderRadius: 12 }}>
                          <Music size={32} style={{ margin: '0 auto 10px', opacity: 0.3 }} />
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>Sin canciones de este artista</div>
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
                <div className="bento-card" style={{ padding: '28px', background: 'linear-gradient(135deg, var(--bg-elevated) 0%, var(--bg-base) 100%)' }}>
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
                        <div key={pl.id} className="hover-lift" style={{ padding: '24px', borderRadius: 16, border: '1px solid var(--border-subtle)', transition: 'all 250ms', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, position: 'relative', background: 'linear-gradient(135deg, var(--bg-elevated) 0%, var(--bg-base) 100%)', cursor: 'pointer' }}
                          onClick={() => setSelectedPlaylistId(pl.id)}>
                          <div style={{ width: 150, height: 150, borderRadius: 16, background: firstCover ? 'var(--bg-surface)' : `color-mix(in srgb, var(--accent) 25%, var(--bg-deep))`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 28px rgba(0,0,0,0.35)', overflow: 'hidden', position: 'relative' }}>
                            {firstCover ? <img src={firstCover} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Music size={40} style={{ color: 'var(--text-muted)', opacity: 0.3 }} />}
                          </div>
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{pl.name}</div>
                            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4 }}>{plTracks.length} canciones</div>
                          </div>
                          <div style={{ position: 'absolute', top: 10, right: 10, display: 'flex', gap: 6 }}>
                            <button onClick={(e) => { e.stopPropagation(); setEditingPlaylistId(pl.id); setShowCreatePlaylist(true); setNewPlaylistName(pl.name); setSelectedTrackIds(new Set(pl.trackIds)); }} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '50%', width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)', cursor: 'pointer' }}><Edit2 size={13} /></button>
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
                  <div style={{ position: 'relative', borderRadius: 16, overflow: 'hidden' }}>
                    {firstCover && (
                      <div style={{ position: 'absolute', inset: 0, background: `url(${firstCover}) center/cover no-repeat`, filter: 'blur(80px) saturate(1.8)', opacity: 0.5 }} />
                    )}
                    <div style={{ position: 'relative', padding: '32px', background: firstCover ? 'rgba(0,0,0,0.25)' : 'transparent' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
                        <button onClick={() => setSelectedPlaylistId(null)} className="btn-ghost" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-tertiary)', padding: '6px 12px', borderRadius: 8 }}>
                          <ArrowLeft size={14} /> Volver a playlists
                        </button>
                        <button onClick={() => { setEditingPlaylistId(pl.id); setShowCreatePlaylist(true); setNewPlaylistName(pl.name); setSelectedTrackIds(new Set(pl.trackIds)); }} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '6px 12px', fontSize: 11, color: 'var(--text-tertiary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
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
                              setQueueSource({ pool: allIds });
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
                                onClick={() => { const pool = plTracks.map(x => x.id); setQueueSource({ pool }); handlePlayWithTabCb(t.id); }}
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
                  onClick={(e) => { if (e.target === e.currentTarget) { setShowCreatePlaylist(false); } }}>
                  <div className="bento-card" style={{ width: 'min(480px, 90vw)', maxHeight: '80vh', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>
                    <div style={{ padding: '24px 24px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
                      <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>{editingPlaylistId && newPlaylistName ? 'Editar playlist' : 'Nueva playlist'}</h3>
                      <input autoFocus value={newPlaylistName} onChange={e => setNewPlaylistName(e.target.value)}
                        placeholder="Nombre de la playlist"
                        style={{ width: '100%', height: 40, padding: '0 14px', borderRadius: 10, border: '1px solid var(--border-default)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); const target = e.currentTarget.parentElement?.parentElement?.querySelector('.save-playlist-btn') as HTMLButtonElement; target?.click(); } }} />
                    </div>
                    <div style={{ padding: '8px 24px', display: 'flex', gap: 8, alignItems: 'center', borderBottom: '1px solid var(--border-subtle)' }}>
                      <select value={playlistArtistFilter} onChange={e => setPlaylistArtistFilter(e.target.value)}
                        style={{ flex: 1, height: 34, padding: '0 10px', borderRadius: 8, border: '1px solid var(--border-default)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', fontSize: 12, outline: 'none' }}>
                        <option value="">Todos los artistas</option>
                        {[...new Set(tracks.filter(t => t.source === 'local').map(t => t.artist))].sort().map(a => (
                          <option key={a} value={a}>{a}</option>
                        ))}
                      </select>
                      {playlistArtistFilter && !artists.some(a => a.name.toLowerCase() === playlistArtistFilter.toLowerCase()) && (
                        <button onClick={() => {
                          addArtist(playlistArtistFilter);
                        }} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                          <Plus size={12} /> Crear "{playlistArtistFilter}"
                        </button>
                      )}
                    </div>
                    <div style={{ flex: 1, overflow: 'auto', padding: '12px 24px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                        <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Canciones en biblioteca</span>
                        <div style={{ position: 'relative', flex: 1, maxWidth: 200 }}>
                          <Search size={12} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                          <input value={playlistSongSearch} onChange={e => setPlaylistSongSearch(e.target.value)} placeholder="Buscar canción..." className="input-base" style={{ width: '100%', height: 28, fontSize: 11, paddingLeft: 26, borderRadius: 6 }} />
                        </div>
                      </div>
                      {tracks.filter(t => t.source === 'local').filter(t => !playlistArtistFilter || t.artist === playlistArtistFilter).filter(t => !playlistSongSearch || t.title.toLowerCase().includes(playlistSongSearch.toLowerCase()) || t.artist.toLowerCase().includes(playlistSongSearch.toLowerCase())).map(t => {
                        const selected = selectedTrackIds.has(t.id);
                        return (
                          <div key={t.id} onClick={() => {
                            const next = new Set(selectedTrackIds);
                            if (selected) next.delete(t.id); else next.add(t.id);
                            setSelectedTrackIds(next);
                          }} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, cursor: 'pointer', background: selected ? 'var(--accent-dim)' : 'transparent', transition: 'background 100ms' }}>
                            <div style={{ width: 32, height: 32, borderRadius: 6, overflow: 'hidden', flexShrink: 0, background: t.coverImage ? 'transparent' : `color-mix(in srgb, var(--accent) 15%, var(--bg-deep))`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              {t.coverImage ? <img src={t.coverImage} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Music size={14} style={{ color: 'var(--text-muted)', opacity: 0.3 }} />}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</div>
                              <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{t.artist}</div>
                            </div>
                            <div style={{ width: 18, height: 18, borderRadius: 4, border: `2px solid ${selected ? 'var(--accent)' : 'var(--border-default)'}`, background: selected ? 'var(--accent)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              {selected && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                            </div>
                          </div>
                        );
                      })}
                      {tracks.filter(t => t.source === 'local').length === 0 && (
                        <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                          <div style={{ fontSize: 13 }}>No hay canciones en la biblioteca</div>
                        </div>
                      )}
                      {tracks.filter(t => t.source === 'local').length > 0 && tracks.filter(t => t.source === 'local').filter(t => !playlistArtistFilter || t.artist === playlistArtistFilter).filter(t => !playlistSongSearch || t.title.toLowerCase().includes(playlistSongSearch.toLowerCase()) || t.artist.toLowerCase().includes(playlistSongSearch.toLowerCase())).length === 0 && (
                        <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                          <div style={{ fontSize: 13 }}>Sin resultados</div>
                        </div>
                      )}
                    </div>
                    <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                      <button onClick={() => { setShowCreatePlaylist(false); setEditingPlaylistId(null); }} style={{ padding: '10px 20px', borderRadius: 10, fontSize: 12, border: '1px solid var(--border-default)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                        Cancelar
                      </button>
                      <button className="save-playlist-btn" onClick={() => {
                        const name = newPlaylistName.trim();
                        if (!name) return;
                        const ids = Array.from(selectedTrackIds);
                        if (editingPlaylistId) {
                          updatePlaylist(editingPlaylistId, { name, trackIds: ids });
                        } else {
                          // Auto-set cover from first selected track
                          const firstSel = tracks.find(t => ids.includes(t.id));
                          addPlaylist(name, ids, firstSel?.coverImage || undefined);
                        }
                        setShowCreatePlaylist(false);
                        setEditingPlaylistId(null);
                        setPlaylistArtistFilter('');
                      }} style={{ padding: '10px 24px', borderRadius: 10, fontSize: 12, fontWeight: 600, background: 'var(--accent)', color: '#fff', border: 'none', cursor: 'pointer', opacity: newPlaylistName.trim() ? 1 : 0.5 }}>
                        {editingPlaylistId ? 'Guardar cambios' : 'Crear playlist'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* RECIENTES ALBUMS GRID */}
          {(activeTab === 'biblioteca' || activeTab === 'favoritas') && (
            <div className="bento-card" style={{ padding: '20px 24px', background: 'linear-gradient(135deg, var(--bg-elevated) 0%, var(--bg-base) 100%)' }}>
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
            <div className="bento-card" style={{ padding: '20px 24px', background: 'linear-gradient(135deg, var(--bg-elevated) 0%, var(--bg-base) 100%)' }}>
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
                        setQueueSource({ pool: allIds });
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
                      style={{ height: 28, padding: '0 8px', fontSize: 11, background: 'transparent', color: 'var(--text-secondary)', border: 'none', outline: 'none', appearance: 'auto', minWidth: 120 }}
                    >
                      <option value="">Filtrar Artista...</option>
                      {artists.map(a => (
                        <option key={a.id} value={a.name}>{a.name}</option>
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
            <div className="bento-card" style={{ padding: '24px 28px', border: '1px solid var(--accent-glow)', background: 'linear-gradient(135deg, var(--bg-elevated) 0%, var(--bg-base) 100%)' }}>
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

              {/* Download options: Quality + Format + Cover toggle + Destination */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '12px 16px', borderRadius: 8, border: '1px solid var(--border-subtle)', marginBottom: 20 }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>Calidad:</span>
                  {([['7', '96 kbps'], ['5', '128 kbps'], ['3', '192 kbps'], ['0', '320 kbps']] as const).map(([q, label]) => {
                    return (
                      <button key={q}
                        onClick={() => setAudioQuality(q)}
                        style={{
                          padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap',
                          background: audioQuality === q ? 'var(--accent)' : 'var(--bg-surface)',
                          color: audioQuality === q ? '#fff' : 'var(--text-secondary)',
                          border: audioQuality === q ? 'none' : '1px solid var(--border-default)',
                          cursor: 'pointer', transition: 'all 200ms',
                        }}
                      >{label}</button>
                    );
                  })}
                  <div style={{ width: 1, height: 22, background: 'var(--border-subtle)', flexShrink: 0 }} />
                  <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>Formato:</span>
                  {(['mp3', 'm4a'] as const).map(f => (
                    <button key={f}
                      onClick={() => setAudioFormat(f)}
                      style={{
                        padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', whiteSpace: 'nowrap',
                        background: audioFormat === f ? 'var(--accent)' : 'var(--bg-surface)',
                        color: audioFormat === f ? '#fff' : 'var(--text-secondary)',
                        border: audioFormat === f ? 'none' : '1px solid var(--border-default)', cursor: 'pointer', transition: 'all 200ms',
                      }}
                    >{f}</button>
                  ))}
                  {audioFormat === 'm4a' && (
                    <span style={{ fontSize: 10, color: 'var(--accent)', fontWeight: 500, whiteSpace: 'nowrap' }}>
                      ✓ Mejor calidad al mismo bitrate
                    </span>
                  )}
                  <div style={{ width: 1, height: 22, background: 'var(--border-subtle)', flexShrink: 0 }} />
                  <button
                    onClick={() => setIncludeCover(!includeCover)}
                    style={{
                      padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap',
                      background: includeCover ? 'var(--accent)' : 'var(--bg-surface)',
                      color: includeCover ? '#fff' : 'var(--text-secondary)',
                      border: '1px solid var(--border-default)', cursor: 'pointer', transition: 'all 200ms',
                      display: 'flex', alignItems: 'center', gap: 6,
                    }}
                  ><Image size={12} /> {includeCover ? 'Con portada' : 'Sin portada'}</button>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>Destino:</span>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', wordBreak: 'break-all' }}>{persistentDownloadPath || 'Descargas/OWA Music'}</span>
                  <button
                    onClick={handleSelectFolder}
                    className="btn-ghost" style={{ padding: 6, background: 'var(--bg-surface)', borderRadius: 6, border: '1px solid var(--border-default)', flexShrink: 0 }}
                  >
                    <FolderOpen size={14} />
                  </button>
                  <span style={{ fontSize: 10, color: 'var(--text-tertiary)', marginLeft: 'auto' }}>
                    La calidad se mide en kbps (kilobits por segundo) — más alto = mejor sonido
                  </span>
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
            <div className="bento-card" style={{ padding: '24px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', border: isPlayingMusic ? '1px solid var(--accent)' : '1px solid var(--border-default)', boxShadow: isPlayingMusic ? '0 8px 32px var(--accent-glow)' : 'none', transition: 'all 300ms', background: 'linear-gradient(135deg, var(--bg-elevated) 0%, var(--bg-base) 100%)' }}>
              <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: isPlayingMusic ? 'var(--accent)' : 'var(--text-muted)', boxShadow: isPlayingMusic ? '0 0 8px var(--accent)' : 'none', animation: isPlayingMusic ? 'pulseGlow 1.5s infinite' : 'none' }} />
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
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, transparent 60%, var(--accent-soft) 100%)', pointerEvents: 'none' }} />
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
                  const idx = tracks.findIndex(t => t.id === currentTrack.id);
                  if (idx > 0) handlePlayWithTabCb(tracks[idx - 1].id);
                }} className="btn-ghost" style={{ padding: 8 }}>
                  <SkipBack size={20} style={{ color: 'var(--text-primary)' }} />
                </button>
                <button onClick={toggleMusicPlayback} style={{ width: 42, height: 42, borderRadius: '50%', background: 'var(--accent)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', cursor: 'pointer', transition: 'transform 120ms' }} onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.08)'} onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'} onMouseDown={e => e.currentTarget.style.transform = 'scale(0.94)'} onMouseUp={e => e.currentTarget.style.transform = 'scale(1.08)'}>
                  {isPlayingMusic ? <Pause size={18} fill="#fff" /> : <Play size={18} fill="#fff" style={{ marginLeft: 2 }} />}
                </button>
                <button onClick={() => {
                  const idx = tracks.findIndex(t => t.id === currentTrack.id);
                  if (idx < tracks.length - 1) handlePlayWithTabCb(tracks[idx + 1].id);
                  else if (repeatMode === 'all' && tracks.length > 0) handlePlayWithTabCb(tracks[0].id);
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
            <div className="bento-card" style={{ padding: '24px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, border: '1px dashed var(--border-subtle)', background: 'linear-gradient(135deg, var(--bg-elevated) 0%, var(--bg-base) 100%)' }}>
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
          <div className="bento-card" style={{ padding: '20px', border: '1px solid var(--border-subtle)', position: 'relative', overflow: 'hidden', background: 'linear-gradient(135deg, var(--bg-elevated) 0%, var(--bg-base) 100%)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <span className="section-header" style={{ marginBottom: 0, fontSize: 12, color: 'var(--text-primary)' }}>Cola de Reproducción</span>
            </div>

            {shuffleMode ? (
              <div style={{ padding: '24px 0', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, animation: 'fadeIn 0.4s' }}>
                <Shuffle size={20} className="spin-slow" style={{ color: 'var(--accent)' }} />
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', lineHeight: 1.5, padding: '0 10px' }}>
                  Modo aleatorio activo
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {(() => {
                  // Show next 5 from library after current track (always upcoming, never history)
                  if (!currentTrackId) return null;
                  const currentIdx = tracks.findIndex(t => t.id === currentTrackId);
                  const queueItems = musicQueue.length > 0
                    ? musicQueue.slice(0, 5)
                    : tracks.slice(currentIdx + 1, currentIdx + 6).map(t => t.id);

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
          <div className="bento-card" style={{ padding: '20px', background: 'linear-gradient(135deg, var(--bg-elevated) 0%, var(--bg-base) 100%)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <span className="section-header" style={{ marginBottom: 0, fontSize: 12, color: 'var(--text-primary)' }}>Estadísticas de escucha</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '3px', borderRadius: 6, border: '1px solid var(--border-subtle)' }}>
                <button onClick={() => setStatsPeriod('week')} style={{ padding: '3px 8px', borderRadius: 4, border: 'none', background: statsPeriod === 'week' ? 'var(--accent)' : 'transparent', color: statsPeriod === 'week' ? '#fff' : 'var(--text-tertiary)', cursor: 'pointer', fontSize: 10, fontWeight: 600 }}>Semana</button>
                <button onClick={() => setStatsPeriod('month')} style={{ padding: '3px 8px', borderRadius: 4, border: 'none', background: statsPeriod === 'month' ? 'var(--accent)' : 'transparent', color: statsPeriod === 'month' ? '#fff' : 'var(--text-tertiary)', cursor: 'pointer', fontSize: 10, fontWeight: 600 }}>Mes</button>
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>{formatTime(statsPeriod === 'week' ? weeklyListeningTime : monthlyListeningTime)}</div>
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, borderTop: '1px solid var(--border-subtle)', paddingTop: 16 }}>
              <div style={{ textAlign: 'center', padding: '8px 4px', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 2 }}>Hoy</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{formatTime(musicListeningTime)}</div>
              </div>
              <div style={{ textAlign: 'center', padding: '8px 4px', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 2 }}>Favoritas</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{tracks.filter(t => t.isFavorite).length}</div>
              </div>
            </div>
          </div>

          {/* DOWNLOADS CARD — inline en columna derecha */}
          {(downloadSelection.length > 0 || downloadQueue.length > 0) && (
            <div className="bento-card" style={{ padding: '16px 18px', background: 'linear-gradient(135deg, var(--bg-elevated) 0%, var(--bg-base) 100%)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                  <Download size={14} style={{ color: 'var(--accent)' }} />
                  Descargas
                </div>
                <button onClick={() => {
                  setDownloadSelection([]);
                  clearCompletedDownloads();
                }} className="btn-ghost" style={{ padding: 4, color: 'var(--text-tertiary)', borderRadius: '50%' }}><X size={14} /></button>
              </div>

              {/* Activos: progress + Cancel (sin X) */}
              {downloadQueue.filter(d => d.status === 'downloading' || d.status === 'queued').length > 0 && (
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                    Descargando...
                  </div>
                  {downloadQueue.filter(d => d.status === 'downloading' || d.status === 'queued').map(dl => (
                    <div key={dl.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, background: 'var(--bg-surface)', marginBottom: 6 }}>
                      <div style={{ width: 28, height: 28, borderRadius: 4, background: 'var(--bg-deep)', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {dl.thumbnail ? <img src={dl.thumbnail} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Music size={12} style={{ color: 'var(--text-muted)' }} />}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{dl.title}</div>
                        <div style={{ height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.06)', marginTop: 4, overflow: 'hidden' }}>
                          <div style={{ width: `${dl.progress * 100}%`, height: '100%', borderRadius: 2, background: 'var(--accent)', transition: 'width 300ms' }} />
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                        <span style={{ fontSize: 9, color: 'var(--text-tertiary)', fontVariantNumeric: 'tabular-nums' }}>
                          {Math.round(dl.progress * 100)}%
                        </span>
                        <button onClick={() => handleCancelDownload(dl.id)} style={{ padding: '4px 8px', background: 'var(--bg-deep)', border: 'none', borderRadius: 4, fontSize: 9, fontWeight: 600, color: '#F59E0B', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Completados / Error / Cancelados: solo X (delete) */}
              {downloadQueue.filter(d => d.status !== 'downloading' && d.status !== 'queued').length > 0 && (
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                    Finalizadas
                  </div>
                  {downloadQueue.filter(d => d.status !== 'downloading' && d.status !== 'queued').map(dl => (
                    <div key={dl.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 6, background: 'var(--bg-surface)', marginBottom: 4 }}>
                      <div style={{ width: 24, height: 24, borderRadius: 4, background: 'var(--bg-deep)', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {dl.thumbnail ? <img src={dl.thumbnail} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Music size={10} style={{ color: 'var(--text-muted)' }} />}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{dl.title}</div>
                        <div style={{ fontSize: 9, color: dl.status === 'error' ? 'var(--error)' : 'var(--text-tertiary)', marginTop: 1 }}>
                          {dl.status === 'completed' ? 'Completado' : dl.status === 'error' ? `Error: ${dl.errorMessage || 'desconocido'}` : 'Cancelado'}
                        </div>
                      </div>
                      <button onClick={() => removeFromDownloadQueue(dl.id)} style={{ padding: 4, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', opacity: 0.5, flexShrink: 0 }}><X size={10} /></button>
                    </div>
                  ))}
                </div>
              )}

              {/* Pendientes: selección para descargar */}
              {downloadSelection.length > 0 && (
                <>
                  <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                    Pendientes ({downloadSelection.length})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 10, maxHeight: 200, overflowY: 'auto' }}>
                    {downloadSelection.map((item, i) => (
                      <div key={item.url} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px', borderRadius: 6, background: 'var(--bg-surface)' }}>
                        <div style={{ width: 22, height: 22, borderRadius: 3, background: 'var(--bg-deep)', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {item.thumbnail ? <img src={item.thumbnail} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Music size={9} style={{ color: 'var(--text-muted)' }} />}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</div>
                        </div>
                        <button onClick={() => setDownloadSelection(prev => prev.filter((_, idx) => idx !== i))} style={{ padding: 2, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', opacity: 0.4, flexShrink: 0 }}><X size={8} /></button>
                      </div>
                    ))}
                  </div>
                  <button onClick={startBulkDownload} className="btn-primary" style={{ width: '100%', height: 36, fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 8 }}>
                    <Download size={14} /> Descargar Todo ({downloadSelection.length})
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
          <div className="bento-card" style={{ padding: 28, width: 380, maxWidth: '90vw', background: 'linear-gradient(135deg, var(--bg-elevated) 0%, var(--bg-base) 100%)' }} onClick={e => e.stopPropagation()}>
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
          <div className="bento-card" style={{ padding: 28, width: 400, maxWidth: '92vw', background: 'linear-gradient(135deg, var(--bg-elevated) 0%, var(--bg-base) 100%)' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 20 }}>{editingArtistId === 'new' ? 'Crear Artista' : 'Editar Artista'}</h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Nombre del Artista</label>
                <input value={editArtistName} onChange={e => setEditArtistName(e.target.value)} className="input-base" style={{ width: '100%', height: 40, fontSize: 13 }} placeholder="Nombre" />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Foto de Perfil (URL)</label>
                <div style={{ display: 'flex', gap: 10 }}>
                  <input value={editArtistImage} onChange={e => setEditArtistImage(e.target.value)} className="input-base" style={{ flex: 1, height: 40, fontSize: 13 }} placeholder="https://..." />
                  <label className="btn-secondary" style={{ width: 40, height: 40, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, cursor: 'pointer' }}>
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
                </div>
              </div>

              {editArtistImage && (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0' }}>
                  <div style={{ width: 80, height: 80, borderRadius: '50%', overflow: 'hidden', border: '2px solid var(--accent)' }}>
                    <img src={editArtistImage} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>Canciones de este artista ({artistSelectedTrackIds.length} seleccionadas)</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, borderRadius: 8, border: '1px solid var(--border-subtle)', padding: 6 }}>
                  <div style={{ position: 'relative' }}>
                    <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)', pointerEvents: 'none' }} />
                    <input value={artistTrackSearch} onChange={e => setArtistTrackSearch(e.target.value)} placeholder="Buscar canciones..." className="input-base" style={{ width: '100%', height: 34, fontSize: 12, paddingLeft: 30, borderRadius: 6 }} />
                  </div>
                  <div style={{ maxHeight: 220, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {tracks.filter(t => !artistTrackSearch || t.title.toLowerCase().includes(artistTrackSearch.toLowerCase()) || t.artist?.toLowerCase().includes(artistTrackSearch.toLowerCase())).length === 0 && (
                      <div style={{ fontSize: 12, color: 'var(--text-tertiary)', padding: '12px 8px', textAlign: 'center' }}>
                        {artistTrackSearch ? 'Sin resultados' : 'No hay canciones'}
                      </div>
                    )}
                    {tracks.filter(t => !artistTrackSearch || t.title.toLowerCase().includes(artistTrackSearch.toLowerCase()) || t.artist?.toLowerCase().includes(artistTrackSearch.toLowerCase())).map(t => {
                      const selected = artistSelectedTrackIds.includes(t.id);
                      return (
                        <div key={t.id} onClick={() => setArtistSelectedTrackIds(prev => prev.includes(t.id) ? prev.filter(id => id !== t.id) : [...prev, t.id])} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, cursor: 'pointer', background: selected ? 'var(--accent-alpha)' : 'transparent', transition: 'background 150ms', border: selected ? '1px solid var(--accent)' : '1px solid transparent' }}>
                          <div style={{ width: 20, height: 20, borderRadius: 4, border: selected ? '2px solid var(--accent)' : '2px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: selected ? 'var(--accent)' : 'transparent', flexShrink: 0 }}>
                            {selected && <CheckCircle size={14} color="#fff" />}
                          </div>
                          <div style={{ width: 28, height: 28, borderRadius: 4, overflow: 'hidden', background: 'var(--bg-deep)', flexShrink: 0 }}>
                            {t.coverImage && <img src={t.coverImage} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{t.artist || 'Sin artista'}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 28 }}>
              <button onClick={() => setEditingArtistId(null)} className="btn-secondary" style={{ height: 38, padding: '0 20px', fontSize: 12 }}>Cancelar</button>
              <button onClick={() => {
                const artistName = editArtistName.trim();

                if (editingArtistId === 'new') {
                  if (!artistName) return;
                  addArtist(artistName, editArtistImage || undefined);
                  // Assign selected tracks to this artist
                  artistSelectedTrackIds.forEach(trackId => {
                    const track = tracks.find(t => t.id === trackId);
                    if (track && track.artist !== artistName) updateTrack(trackId, { artist: artistName });
                  });
                } else {
                  const oldName = artists.find(a => a.id === editingArtistId)?.name;

                  // Update artist metadata
                  updateArtist(editingArtistId, {
                    name: artistName || undefined,
                    profileImage: editArtistImage || undefined
                  });

                  // Selected tracks → assign to this artist
                  artistSelectedTrackIds.forEach(trackId => {
                    const track = tracks.find(t => t.id === trackId);
                    if (track && track.artist !== (artistName || oldName)) updateTrack(trackId, { artist: artistName || oldName });
                  });

                  // Tracks that used to belong but are now deselected → clear artist
                  tracks.forEach(t => {
                    if (!artistSelectedTrackIds.includes(t.id) && (t.artist === oldName || t.artist === artistName)) {
                      updateTrack(t.id, { artist: '' });
                    }
                  });
                }

                setEditingArtistId(null);
              }} className="btn-primary" style={{ height: 38, padding: '0 20px', fontSize: 12 }}>Guardar</button>
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
          <div onClick={e => e.stopPropagation()} style={{
            width: '90%', maxWidth: 480,
            borderRadius: 16, overflow: 'hidden',
            background: 'linear-gradient(135deg, var(--bg-elevated) 0%, var(--bg-base) 100%)',
            border: '1px solid var(--border-subtle)',
            boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
            animation: 'fadeIn 200ms ease',
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

