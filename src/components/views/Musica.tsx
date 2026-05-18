import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  Play, Pause, SkipBack, SkipForward, Volume2, Search,
  Music, Download, Trash2, X, ListMusic, Upload,
  Link, Globe, Loader, CheckCircle, AlertCircle,
  ArrowLeft, ArrowRight, ChevronDown, ChevronUp,
  ExternalLink, FolderOpen, Plus,
  Disc3, Activity, Heart, Copy, Clock,
  User, Wifi, Bell, Sliders, Repeat, Shuffle, BarChart2,
  Edit2, Grid, List,
} from 'lucide-react';
import { useApp } from '../../store/AppContext';
import { open, save } from '@tauri-apps/plugin-dialog';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
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

type TabId = 'biblioteca' | 'playlists' | 'favoritas' | 'explorar';

function isPlaylist(data: YouTubePlaylist | YouTubeMetadata): data is YouTubePlaylist {
  return 'entries' in data && Array.isArray((data as YouTubePlaylist).entries);
}

function getEntries(data: YouTubePlaylist | YouTubeMetadata): YouTubeMetadata[] {
  if (isPlaylist(data)) return data.entries;
  return [data as YouTubeMetadata];
}

export default function Musica() {
  const {
    playlists, tracks, currentTrackId, isPlayingMusic, toggleMusicPlayback,
    playTrack, musicVolume, setMusicVolume, setMusicProgress, musicProgress, musicDuration,
    shuffleMode, repeatMode, musicQueue, setMusicQueue, setShuffleMode, setRepeatMode,
    addPlaylist, updatePlaylist, addTrack, addToDownloadQueue,
    updateDownloadProgress, updateDownloadStatus, toggleTrackFavorite,
    downloadQueue, removeFromDownloadQueue, clearCompletedDownloads,
    updateTrack, deleteTrack, deletePlaylist,
    trackHistory, playCounts, studySessions,
    clearAllMusicData,
    addNotification,
  } = useApp();

  const [activeTab, setActiveTab] = useState<TabId>('biblioteca');
  const [url, setUrl] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [preview, setPreview] = useState<YouTubePlaylist | YouTubeMetadata | null>(null);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [downloadPath, setDownloadPathState] = useState('');
  const [audioFormat, setAudioFormat] = useState<'mp3' | 'm4a'>('mp3');
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [searchMode, setSearchMode] = useState<'link' | 'query'>('link');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [statsPeriod, setStatsPeriod] = useState<'week' | 'month'>('week');
  const [showPlaylistForm, setShowPlaylistForm] = useState(false);
  const [editingPlaylistId, setEditingPlaylistId] = useState<string | null>(null);
  const [plFormName, setPlFormName] = useState('');
  const [plFormCover, setPlFormCover] = useState('');
  const [plFormCoverFile, setPlFormCoverFile] = useState<string | null>(null);

  const [viewMode, setViewMode] = useState<'lista' | 'bloques'>('lista');
  const [editingTrackId, setEditingTrackId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editArtist, setEditArtist] = useState('');
  const [editCover, setEditCover] = useState('');

  const urlInputRef = useRef<HTMLInputElement>(null);
  const [colocarTrackId, setColocarTrackId] = useState<string | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const timeStr = format(currentTime, 'HH:mm');
  const secondsStr = format(currentTime, 'ss');
  const dateStr = format(currentTime, "EEEE, d 'de' MMMM, yyyy", { locale: es as any });
  const dateStrCapitalized = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);

  const selectedPlaylist = playlists.find(p => p.id === selectedPlaylistId);

  const formatTime = useCallback((secs: number) => {
    if (!secs || !isFinite(secs)) return '0:00';
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = Math.floor(secs % 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }, []);

  useEffect(() => {
    getDownloadPath().then(setDownloadPathState).catch(() => {});
  }, []);

  const handleSelectFolder = useCallback(async () => {
    try {
      const folder = await open({ directory: true, multiple: false, title: 'Carpeta de descargas' });
      if (folder) {
        setDownloadPathState(String(folder));
        await setDownloadPath(String(folder));
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
            setDownloadPathState(path || 'Descargas/OWA Music');
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
      updateDownloadStatus(data.downloadId, data.success ? 'completed' : 'error');
      if (data.success) {
        addNotification('Descarga completada', 'success');
      } else {
        addNotification('Error en la descarga', 'error');
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
    try {
      const results = await searchMusic(q);
      setSearchResults(results);
    } catch {
      toast.error('Error al buscar');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadAll = async () => {
    if (!preview) return;
    const entries = getEntries(preview);
    const path = downloadPath;

    for (const entry of entries) {
      const dlItemId = addToDownloadQueue({
        title: entry.title,
        artist: entry.channel,
        url: entry.webpage_url,
        type: entries.length > 1 ? 'playlist' : 'video',
        totalItems: entries.length,
        thumbnail: entry.thumbnail,
        duration: entry.duration,
      });

      updateDownloadStatus(dlItemId, 'downloading');
      try {
        await startDownload(entry.webpage_url, dlItemId, path, audioFormat);
        updateDownloadStatus(dlItemId, 'completed');
      } catch (e) {
        const msg = String(e);
        if (msg.includes('web-download-unavailable')) {
          updateDownloadStatus(dlItemId, 'error', 'Solo disponible en la app de escritorio');
          toast.error('Descargar requiere la app de escritorio. Usa "npm run tauri dev"');
        } else {
          updateDownloadStatus(dlItemId, 'error', 'Error al descargar');
        }
      }
    }
  };

  const handleDownloadOne = async (entry: YouTubeMetadata) => {
    const dlItemId = addToDownloadQueue({
      title: entry.title,
      artist: entry.channel,
      url: entry.webpage_url,
      type: 'video',
      totalItems: 1,
      thumbnail: entry.thumbnail,
      duration: entry.duration,
    });

    updateDownloadStatus(dlItemId, 'downloading');
    try {
      await startDownload(entry.webpage_url, dlItemId, downloadPath, audioFormat);
      updateDownloadStatus(dlItemId, 'completed');
      toast.success(`"${entry.title}" descargada`);
    } catch (e) {
      const msg = String(e);
      if (msg.includes('web-download-unavailable')) {
        updateDownloadStatus(dlItemId, 'error', 'Solo disponible en la app de escritorio');
        toast.error('Descargar requiere la app de escritorio. Usa "npm run tauri dev"');
      } else {
        updateDownloadStatus(dlItemId, 'error', 'Error al descargar');
      }
    }
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
    const plName = 'title' in preview && preview.title ? preview.title : 'YouTube Import';
    const plId = Date.now().toString();

    addPlaylist({ name: plName, trackIds: [] });
    entries.forEach((entry, i) => {
      const trackId = Date.now().toString() + i;
      addTrack({
        title: entry.title || 'Unknown',
        artist: entry.channel || 'Unknown',
        duration: entry.duration || 0,
        source: 'youtube',
        url: entry.webpage_url,
        coverImage: entry.thumbnail,
        isFavorite: false,
      });
    });
    setSelectedPlaylistId(plId);
    toast.success(`Importado a biblioteca: ${entries.length} temas`);
    setActiveTab('biblioteca');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (searchMode === 'query') handleSearch();
      else handleUrlSubmit();
    }
  };

  const currentTrack = tracks.find(t => t.id === currentTrackId);

  const addTrackToPlaylist = useCallback((trackId: string, playlistId: string) => {
    const pl = playlists.find(p => p.id === playlistId);
    if (pl && !pl.trackIds.includes(trackId)) {
      updatePlaylist(playlistId, { trackIds: [...pl.trackIds, trackId] });
      toast.success('Canción añadida a la playlist');
    } else if (pl && pl.trackIds.includes(trackId)) {
      toast.error('Esta canción ya está en la playlist');
    }
    setColocarTrackId(null);
  }, [playlists, updatePlaylist]);

  const activeDownloads = downloadQueue.filter(d => d.status === 'downloading' || d.status === 'queued');
  const completedDownloads = downloadQueue.filter(d => d.status === 'completed');

  // Real tracks sorted: latest added first (by id DESC = newest)
  const sortedTracks = useMemo(() => {
    return [...tracks].reverse();
  }, [tracks]);

  // Recent tracks = last played from history, not last uploaded
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

  const displayTracks = activeTab === 'favoritas' ? tracks.filter(t => t.isFavorite) : sortedTracks;

  return (
    <div className="page-container" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto' }}>
      
      {/* ── HEADER ── */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, paddingTop: 8 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 style={{ fontSize: 32, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.15, letterSpacing: '-0.02em' }}>Música</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 3, color: 'var(--text-tertiary)' }}>
              <div style={{ width: 3, height: 12, background: 'var(--text-secondary)', borderRadius: 2 }} />
              <div style={{ width: 3, height: 18, background: 'var(--accent)', borderRadius: 2 }} />
              <div style={{ width: 3, height: 8, background: 'var(--text-secondary)', borderRadius: 2 }} />
              <div style={{ width: 3, height: 14, background: 'var(--text-tertiary)', borderRadius: 2 }} />
            </div>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 6, fontWeight: 500 }}>Tu música, tu enfoque.</p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: 'var(--bg-deep)', border: '1px solid var(--border-default)', borderRadius: 16, fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--success)', boxShadow: '0 0 8px var(--success)' }} />
              Conectado
            </div>
            <button className="btn-ghost" style={{ padding: 8, borderRadius: '50%' }}><Wifi size={16} /></button>
            <button className="btn-ghost" style={{ padding: 8, borderRadius: '50%' }}><Bell size={16} /></button>
          </div>

          <div style={{ textAlign: 'right', borderLeft: '1px solid var(--border-subtle)', paddingLeft: 16 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, justifyContent: 'flex-end' }}>
              <div className="led-display" style={{ fontSize: 28, lineHeight: 1 }}>{timeStr}</div>
              <div className="led-seconds" style={{ fontSize: 14 }}>{secondsStr}</div>
            </div>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{dateStrCapitalized}</div>
          </div>
        </div>
      </header>

      {/* ── NAVIGATION TABS & SEARCH BAR ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28, borderBottom: '1px solid var(--border-subtle)', paddingBottom: 16 }}>
        <div style={{ display: 'flex', gap: 24 }}>
          {(['biblioteca', 'playlists', 'favoritas', 'explorar'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
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

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ position: 'relative', width: 240 }}>
            <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input type="text" placeholder="Buscar música..." className="input-base" style={{ paddingLeft: 36, paddingRight: 32, height: 36, fontSize: 12, background: 'var(--bg-deep)', borderRadius: 18 }} />
            <div style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 10, color: 'var(--text-tertiary)', background: 'var(--bg-surface)', padding: '2px 6px', borderRadius: 4, border: '1px solid var(--border-subtle)' }}>⌘K</div>
          </div>

          <label className="btn-secondary hover-lift" style={{ display: 'flex', alignItems: 'center', gap: 6, height: 36, borderRadius: 18, fontSize: 12, cursor: 'pointer', padding: '0 16px' }}>
            <Upload size={14} /> Subir audio local
            <input type="file" accept="audio/*" multiple onChange={e => {
              const files = Array.from(e.target.files || []);
              files.forEach(file => {
                addTrack({
                  title: file.name.replace(/\.[^/.]+$/, ""),
                  artist: 'Audio Local',
                  duration: 180,
                  source: 'local',
                  url: URL.createObjectURL(file),
                  coverImage: undefined,
                  isFavorite: false,
                });
              });
              if (files.length > 0) toast.success(`${files.length} audio(s) local(es) subido(s)`);
              e.target.value = '';
            }} style={{ display: 'none' }} />
          </label>

          <button onClick={() => setActiveTab('explorar')} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6, height: 36, borderRadius: 18, fontSize: 12 }}>
            <Plus size={14} /> Añadir música <ChevronDown size={12} style={{ marginLeft: 2 }} />
          </button>
        </div>
      </div>

      {/* ── MAIN CONTENT AREA (GRID 1fr 320px) ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24, flex: 1, alignItems: 'flex-start' }}>

        {/* LEFT COLUMN */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          
          {/* ── STATS ROW (3 CARDS) ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {[
              { label: 'Canciones', val: tracks.length, sub: 'en tu biblioteca', icon: Music, color: 'var(--accent)' },
              { label: 'Favoritas', val: tracks.filter(t => t.isFavorite).length, sub: 'guardadas', icon: Heart, color: '#10B981' },
              { label: 'Hoy', val: formatTime(studySessions.reduce((sum, s) => sum + s.duration, 0)), sub: 'escuchando música', icon: Activity, color: '#F59E0B' },
            ].map((s, i) => (
              <div key={i} className="bento-card" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10, background: 'linear-gradient(135deg, var(--bg-elevated) 0%, var(--bg-base) 100%)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span className="stat-label" style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{s.label}</span>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--bg-deep)', border: '1px solid rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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

          {/* PLAYLISTS VIEW */}
          {activeTab === 'playlists' && (
            <div>
              {!selectedPlaylistId ? (
                <div className="bento-card" style={{ padding: '24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                    <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>Mis Playlists</h3>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{playlists.length} playlists creadas</span>
                      <button onClick={() => { setShowPlaylistForm(true); setPlFormName(''); setPlFormCover(''); setPlFormCoverFile(null); }} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6, height: 32, borderRadius: 16, fontSize: 11, marginLeft: 12 }}>
                        <Plus size={12} /> Agregar Playlist
                      </button>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                    {playlists.map(pl => {
                      return (
                        <div key={pl.id} onClick={() => setSelectedPlaylistId(pl.id)} className="bento-card hover-lift" style={{ padding: 0, background: 'var(--bg-deep)', border: '1px solid var(--border-subtle)', cursor: 'pointer', transition: 'all 200ms', position: 'relative', overflow: 'hidden', borderRadius: 12 }}>
                          {pl.coverImage && (
                            <div style={{ position: 'absolute', inset: 0, background: `url(${pl.coverImage}) center/cover`, filter: 'blur(24px) brightness(0.25)', transform: 'scale(1.1)' }} />
                          )}
                          <div style={{ position: 'relative', padding: 16 }}>
                            <div style={{ width: '100%', aspectRatio: '16/9', borderRadius: 8, background: pl.coverImage ? `url(${pl.coverImage}) center/cover` : 'linear-gradient(135deg, var(--accent), #3B82F6)', marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 16, boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
                              {!pl.coverImage && pl.name.slice(0, 2).toUpperCase()}
                            </div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pl.name}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>{pl.trackIds.length} canciones</div>
                            <div style={{ display: 'flex', gap: 8, marginTop: 10, justifyContent: 'flex-end' }} onClick={e => e.stopPropagation()}>
                              <button onClick={() => { setEditingPlaylistId(pl.id); setPlFormName(pl.name); setPlFormCover(pl.coverImage || ''); setPlFormCoverFile(null); setShowPlaylistForm(true); }} className="btn-ghost" style={{ padding: '4px 8px', borderRadius: 6, fontSize: 10 }}>
                                <Edit2 size={12} />
                              </button>
                              <button onClick={() => setConfirmDelete(pl.id)} className="btn-ghost" style={{ padding: '4px 8px', borderRadius: 6, fontSize: 10, color: 'var(--error)' }}>
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {playlists.length === 0 && (
                      <div style={{ gridColumn: '1 / -1', padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)', background: 'var(--bg-deep)', borderRadius: 12, border: '1px dashed var(--border-subtle)' }}>
                        <ListMusic size={32} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>No tienes playlists creadas</div>
                        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4 }}>Crea tu primera playlist con el botón "Agregar Playlist"</div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (() => {
                const pl = playlists.find(p => p.id === selectedPlaylistId);
                if (!pl) return null;
                const plTracks = pl.trackIds.map(tId => tracks.find(t => t.id === tId)).filter((t): t is NonNullable<typeof t> => t != null);
                return (
                  <div style={{ position: 'relative', borderRadius: 16, overflow: 'hidden' }}>
                    {pl.coverImage && (
                      <div style={{ position: 'absolute', inset: 0, background: `url(${pl.coverImage}) center/cover`, filter: 'blur(56px) brightness(0.12)', transform: 'scale(1.15)' }} />
                    )}
                    <div style={{ position: 'relative', padding: '28px', background: pl.coverImage ? 'rgba(0,0,0,0.5)' : 'var(--bg-deep)', borderRadius: 16 }}>
                      {/* Back button */}
                      <button onClick={() => setSelectedPlaylistId(null)} className="btn-ghost" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 16, padding: '6px 12px', borderRadius: 8 }}>
                        <ArrowLeft size={14} /> Volver a playlists
                      </button>

                      <div style={{ display: 'flex', gap: 28, alignItems: 'flex-end', marginBottom: 28 }}>
                        <div style={{ width: 180, height: 180, borderRadius: 12, overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.6)', flexShrink: 0 }}>
                          {pl.coverImage ? <img src={pl.coverImage} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (
                            <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, var(--accent), #3B82F6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Music size={56} color="#fff" opacity={0.5} /></div>
                          )}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8, opacity: 0.8 }}>PLAYLIST</div>
                          <h2 style={{ fontSize: 32, fontWeight: 800, color: '#fff', margin: 0, lineHeight: 1.15, textShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>{pl.name}</h2>
                          <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 8 }}>{plTracks.length} canciones</div>
                          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                            <button onClick={() => { if (plTracks.length > 0) playTrack(plTracks[0].id); }} className="btn-primary" style={{ height: 36, padding: '0 24px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, borderRadius: 20 }}>
                              <Play size={15} fill="#fff" /> Reproducir
                            </button>
                            <button onClick={() => setConfirmDelete(selectedPlaylistId!)} className="btn-ghost" style={{ height: 36, width: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--error)', border: '1px solid rgba(225,29,72,0.3)' }}>
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Track List */}
                      {plTracks.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 20 }}>
                          {plTracks.map((t, idx) => {
                            const isPlaying = currentTrackId === t.id && isPlayingMusic;
                            return (
                              <div key={t.id} onClick={() => playTrack(t.id)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', borderRadius: 8, cursor: 'pointer', background: isPlaying ? 'rgba(225,29,72,0.15)' : 'transparent', transition: 'background 150ms' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-surface)'} onMouseLeave={e => e.currentTarget.style.background = isPlaying ? 'rgba(225,29,72,0.15)' : 'transparent'}>
                                <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-tertiary)', width: 24, textAlign: 'center' }}>{isPlaying ? <Play size={10} fill="var(--accent)" style={{ color: 'var(--accent)' }} /> : idx + 1}</span>
                                <div style={{ width: 32, height: 32, borderRadius: 4, overflow: 'hidden', flexShrink: 0, background: 'var(--bg-surface)' }}>
                                  {t.coverImage ? <img src={t.coverImage} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Music size={14} style={{ margin: 9, color: 'var(--text-muted)', opacity: 0.3 }} />}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontSize: 13, fontWeight: isPlaying ? 600 : 500, color: isPlaying ? 'var(--accent)' : 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</div>
                                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{t.artist}</div>
                                </div>
                                <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{formatTime(t.duration)}</span>
                                <button onClick={e => { e.stopPropagation(); updatePlaylist(pl.id, { trackIds: pl.trackIds.filter(id => id !== t.id) }); }} className="btn-ghost" style={{ padding: 4, color: 'var(--text-muted)' }} title="Quitar de playlist">
                                  <X size={12} />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div style={{ padding: '30px 20px', textAlign: 'center', color: 'var(--text-muted)', background: 'rgba(0,0,0,0.2)', borderRadius: 12, marginBottom: 20 }}>
                          <Music size={28} style={{ margin: '0 auto 10px', opacity: 0.3 }} />
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>Playlist vacía</div>
                          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>Añade canciones desde las opciones de abajo</div>
                        </div>
                      )}

                      {/* Add Songs Section */}
                      <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 16 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>Agregar canciones</div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <label className="btn-secondary" style={{ padding: '8px 14px', fontSize: 11, borderRadius: 8, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', height: 34 }}>
                            <Upload size={12} /> Desde ordenador
                            <input type="file" accept="audio/*" multiple style={{ display: 'none' }} onChange={e => {
                              const files = Array.from(e.target.files || []);
                              files.forEach(file => {
                                const newId = addTrack({ title: file.name.replace(/\.[^/.]+$/, ''), artist: 'Audio Local', duration: 180, source: 'local', url: URL.createObjectURL(file), coverImage: undefined, isFavorite: false });
                                updatePlaylist(pl.id, { trackIds: [...pl.trackIds, newId] });
                              });
                              if (files.length > 0) toast.success(`${files.length} canción(es) añadida(s)`);
                              e.target.value = '';
                            }} />
                          </label>
                          <button onClick={() => setShowSearch(!showSearch)} className="btn-secondary" style={{ padding: '8px 14px', fontSize: 11, borderRadius: 8, display: 'flex', alignItems: 'center', gap: 6, height: 34 }}>
                            <Search size={12} /> Buscar
                          </button>
                          <div style={{ flex: 1, display: 'flex', gap: 8, alignItems: 'center' }}>
                            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-deep)', border: '1px solid var(--border-default)', borderRadius: 6, padding: '0 10px' }}>
                              <Link size={12} style={{ color: 'var(--text-muted)' }} />
                              <input type="text" value={url} onChange={e => setUrl(e.target.value)} placeholder="Pega un enlace..." className="input-base" style={{ border: 'none', background: 'transparent', height: 32, padding: 0, fontSize: 11 }} />
                            </div>
                            <button onClick={async () => {
                              if (!url.trim()) return;
                              setIsLoading(true);
                              try {
                                const result = await validateUrl(url.trim());
                                const entries = getEntries(result);
                                entries.forEach(entry => {
                                  const newId = addTrack({ title: entry.title, artist: entry.channel, duration: entry.duration || 0, source: 'youtube', url: entry.webpage_url, coverImage: entry.thumbnail, isFavorite: false });
                                  updatePlaylist(pl.id, { trackIds: [...pl.trackIds, newId] });
                                });
                                toast.success(`${entries.length} canción(es) añadida(s) desde enlace`);
                                setUrl('');
                              } catch { toast.error('Error al procesar enlace'); }
                              setIsLoading(false);
                            }} className="btn-primary" style={{ height: 32, padding: '0 12px', fontSize: 11, borderRadius: 6 }} disabled={isLoading}>
                              {isLoading ? <Loader size={12} /> : <Plus size={12} />} Añadir
                            </button>
                          </div>
                        </div>
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
                <span onClick={() => {
                  setActiveTab('biblioteca');
                  setViewMode('lista');
                }} className="text-accent" style={{ fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Ver todo</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16 }}>
                {recentTracks.length > 0 ? recentTracks.map((track, i) => (
                  <div key={track.id} onClick={() => playTrack(track.id)} className="bento-card" style={{ padding: 12, background: 'var(--bg-deep)', cursor: 'pointer', transition: 'all 200ms' }} onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-4px)'} onMouseLeave={e => e.currentTarget.style.transform = ''}>
                    <div style={{ width: '100%', aspectRatio: '1/1', borderRadius: 8, overflow: 'hidden', marginBottom: 12, position: 'relative', boxShadow: '0 4px 12px rgba(0,0,0,0.5)', background: 'var(--bg-surface)' }}>
                      {track.coverImage ? <img src={track.coverImage} alt={track.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Music size={24} style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', color: 'var(--text-muted)', opacity: 0.3 }} />}
                      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', opacity: 0, transition: 'opacity 200ms', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onMouseEnter={e => e.currentTarget.style.opacity = '1'} onMouseLeave={e => e.currentTarget.style.opacity = '0'}>
                        <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
                          <Play size={18} fill="#fff" style={{ marginLeft: 2 }} />
                        </div>
                      </div>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{track.title}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{track.artist}</div>
                  </div>
                )) : (
                  <div style={{ gridColumn: '1 / -1', padding: '30px 20px', textAlign: 'center', color: 'var(--text-muted)', background: 'var(--bg-deep)', borderRadius: 12, border: '1px dashed var(--border-subtle)' }}>
                    <Music size={28} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>No hay canciones aún</div>
                    <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4 }}>Sube música desde "Explorar" o "Subir audio local"</div>
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
                <div style={{ display: 'flex', gap: 6, background: 'var(--bg-deep)', padding: 4, borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
                  <button onClick={() => setViewMode('lista')} className="btn-ghost" style={{ padding: '4px 8px', borderRadius: 6, background: viewMode === 'lista' ? 'var(--bg-surface)' : 'transparent', color: viewMode === 'lista' ? 'var(--accent)' : 'var(--text-tertiary)' }}>
                    <List size={16} />
                  </button>
                  <button onClick={() => setViewMode('bloques')} className="btn-ghost" style={{ padding: '4px 8px', borderRadius: 6, background: viewMode === 'bloques' ? 'var(--bg-surface)' : 'transparent', color: viewMode === 'bloques' ? 'var(--accent)' : 'var(--text-tertiary)' }}>
                    <Grid size={16} />
                  </button>
                </div>
              </div>

              {viewMode === 'lista' ? (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '40px 2fr 1.5fr 1fr 1fr 180px', padding: '0 12px 12px', borderBottom: '1px solid var(--border-subtle)', fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                    <span></span>
                    <span>Título</span>
                    <span>Artista</span>
                    <span>Source</span>
                    <span>Duración</span>
                    <span style={{ textAlign: 'right' }}>Acciones</span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {displayTracks.length > 0 ? displayTracks.map((track, i) => {
                      const isPlaying = currentTrackId === track.id && isPlayingMusic;
                      return (
                      <div
                        key={track.id}
                        onClick={() => playTrack(track.id)}
                        style={{
                          display: 'grid', gridTemplateColumns: '40px 2fr 1.5fr 1fr 1fr 180px', padding: '10px 12px',
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
                          <div style={{ width: 36, height: 36, borderRadius: 6, background: 'var(--bg-deep)', flexShrink: 0, overflow: 'hidden', position: 'relative' }}>
                            {track.coverImage ? <img src={track.coverImage} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Music size={14} style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', color: 'var(--text-muted)', opacity: 0.3 }} />}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: isPlaying ? 600 : 500, color: isPlaying ? 'var(--accent)' : 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{track.title}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>{track.artist}</div>
                          </div>
                        </div>

                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{track.artist}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{track.source}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{formatTime(track.duration)}</div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                          <button onClick={(e) => { e.stopPropagation(); toggleTrackFavorite(track.id); }} className="btn-ghost" style={{ padding: 6, color: track.isFavorite ? 'var(--accent)' : 'var(--text-tertiary)' }} title={track.isFavorite ? 'Quitar de favoritos' : 'Añadir a favoritos'}>
                            <Heart size={16} style={{ fill: track.isFavorite ? 'var(--accent)' : 'transparent' }} />
                          </button>
                          <div style={{ position: 'relative' }}>
                            <button onClick={(e) => { e.stopPropagation(); setColocarTrackId(colocarTrackId === track.id ? null : track.id); }} className="btn-ghost" style={{ padding: 6, color: 'var(--text-tertiary)' }} title="Colocar en playlist">
                              <ListMusic size={14} />
                            </button>
                            {colocarTrackId === track.id && (
                              <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', bottom: '100%', right: 0, marginBottom: 4, background: 'var(--bg-deep)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 6, zIndex: 100, minWidth: 180, boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
                                {playlists.length === 0 ? (
                                  <div style={{ padding: '8px 12px', fontSize: 11, color: 'var(--text-tertiary)' }}>No hay playlists</div>
                                ) : (
                                  playlists.map(pl => (
                                    <div key={pl.id} onClick={(e) => { e.stopPropagation(); addTrackToPlaylist(track.id, pl.id); }} style={{ padding: '8px 12px', fontSize: 12, color: 'var(--text-primary)', cursor: 'pointer', borderRadius: 4, display: 'flex', alignItems: 'center', gap: 8 }} onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-surface)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                      {pl.coverImage ? <img src={pl.coverImage} alt="" style={{ width: 20, height: 20, borderRadius: 4, objectFit: 'cover' }} /> : <Music size={14} style={{ color: 'var(--text-tertiary)' }} />}
                                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pl.name}</span>
                                    </div>
                                  ))
                                )}
                              </div>
                            )}
                          </div>
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
                            setConfirmDelete(track.id);
                          }} className="btn-ghost" style={{ padding: 6, color: 'var(--text-tertiary)' }} title="Eliminar canción">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    )}) : (
                      <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                        <Music size={32} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>No hay canciones</div>
                        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4 }}>Añade música desde Explorar o sube audio local</div>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                  {displayTracks.length > 0 ? displayTracks.map((track, i) => {
                    const isPlaying = currentTrackId === track.id && isPlayingMusic;
                    return (
                    <div
                      key={track.id}
                      onClick={() => playTrack(track.id)}
                      className="bento-card hover-lift"
                      style={{
                        padding: 16, display: 'flex', flexDirection: 'column', gap: 12, cursor: 'pointer',
                        background: isPlaying ? 'var(--accent-dim)' : 'var(--bg-deep)',
                        border: isPlaying ? '1px solid var(--accent-glow)' : '1px solid var(--border-subtle)',
                      }}
                    >
                      <div style={{ position: 'relative', width: '100%', aspectRatio: '1', borderRadius: 8, overflow: 'hidden', background: 'var(--bg-surface)' }}>
                        {track.coverImage ? <img src={track.coverImage} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Music size={24} style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', color: 'var(--text-muted)', opacity: 0.3 }} />}
                        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', opacity: isPlaying ? 1 : 0, transition: 'opacity 200ms', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onMouseEnter={e => e.currentTarget.style.opacity = '1'} onMouseLeave={e => e.currentTarget.style.opacity = isPlaying ? '1' : '0'}>
                          <div style={{ width: 42, height: 42, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
                            {isPlaying ? <Pause size={20} fill="#fff" /> : <Play size={20} fill="#fff" style={{ marginLeft: 3 }} />}
                          </div>
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: isPlaying ? 'var(--accent)' : 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{track.title}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>{track.artist} · {formatTime(track.duration)}</div>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-subtle)', paddingTop: 12, marginTop: 'auto' }}>
                        <button onClick={(e) => { e.stopPropagation(); toggleTrackFavorite(track.id); }} className="btn-ghost" style={{ padding: 6, color: track.isFavorite ? 'var(--accent)' : 'var(--text-tertiary)' }} title={track.isFavorite ? 'Quitar de favoritos' : 'Añadir a favoritos'}>
                          <Heart size={16} style={{ fill: track.isFavorite ? 'var(--accent)' : 'transparent' }} />
                        </button>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <div style={{ position: 'relative' }}>
                            <button onClick={(e) => { e.stopPropagation(); setColocarTrackId(colocarTrackId === track.id ? null : track.id); }} className="btn-ghost" style={{ padding: 6, color: 'var(--text-tertiary)' }} title="Colocar en playlist">
                              <ListMusic size={14} />
                            </button>
                            {colocarTrackId === track.id && (
                              <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', bottom: '100%', right: 0, marginBottom: 4, background: 'var(--bg-deep)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 6, zIndex: 100, minWidth: 180, boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
                                {playlists.length === 0 ? (
                                  <div style={{ padding: '8px 12px', fontSize: 11, color: 'var(--text-tertiary)' }}>No hay playlists</div>
                                ) : (
                                  playlists.map(pl => (
                                    <div key={pl.id} onClick={(e) => { e.stopPropagation(); addTrackToPlaylist(track.id, pl.id); }} style={{ padding: '8px 12px', fontSize: 12, color: 'var(--text-primary)', cursor: 'pointer', borderRadius: 4, display: 'flex', alignItems: 'center', gap: 8 }} onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-surface)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                      {pl.coverImage ? <img src={pl.coverImage} alt="" style={{ width: 20, height: 20, borderRadius: 4, objectFit: 'cover' }} /> : <Music size={14} style={{ color: 'var(--text-tertiary)' }} />}
                                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pl.name}</span>
                                    </div>
                                  ))
                                )}
                              </div>
                            )}
                          </div>
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
                            setConfirmDelete(track.id);
                          }} className="btn-ghost" style={{ padding: 6, color: 'var(--text-tertiary)' }} title="Eliminar canción">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}) : (
                    <div style={{ gridColumn: '1 / -1', padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      <Music size={32} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>No hay canciones</div>
                      <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4 }}>Añade música desde Explorar o sube audio local</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* EXPLORAR & DESCARGAR SECTION (CUSTOM YT/SPOTIFY SCRAPER) */}
          {activeTab === 'explorar' && (
            <div className="bento-card" style={{ padding: '24px 28px', border: '1px solid var(--accent-glow)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div>
                  <div className="section-header" style={{ marginBottom: 4, fontSize: 14, color: 'var(--text-primary)' }}>Explorar & Descargar Música</div>
                  <p style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Importa canciones o playlists completas desde YouTube y Spotify mediante yt-dlp.</p>
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
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg-deep)', border: '1px solid var(--border-default)', borderRadius: 8, padding: '0 14px' }}>
                  <Link size={16} style={{ color: 'var(--text-muted)' }} />
                  <input
                    ref={urlInputRef}
                    type="text"
                    value={url}
                    onChange={e => setUrl(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Pega un enlace de YouTube o Spotify (video o playlist)..."
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
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg-deep)', border: '1px solid var(--border-default)', borderRadius: 8, padding: '0 14px' }}>
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

              {/* Format Selector + Destination */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'var(--bg-deep)', borderRadius: 8, border: '1px solid var(--border-subtle)', marginBottom: 20 }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Formato de Audio:</span>
                  {(['mp3', 'm4a'] as const).map(f => (
                    <button
                      key={f}
                      onClick={() => setAudioFormat(f)}
                      style={{
                        padding: '4px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
                        background: audioFormat === f ? 'var(--accent)' : 'var(--bg-surface)',
                        color: audioFormat === f ? '#fff' : 'var(--text-secondary)',
                        border: audioFormat === f ? 'none' : '1px solid var(--border-default)', cursor: 'pointer', transition: 'all 200ms',
                      }}
                    >{f}</button>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Destino:</span>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{downloadPath || 'Descargas/OWA Music'}</span>
                  <button
                    onClick={handleSelectFolder}
                    className="btn-ghost" style={{ padding: 6, background: 'var(--bg-surface)', borderRadius: 6, border: '1px solid var(--border-default)' }}
                  >
                    <FolderOpen size={14} />
                  </button>
                </div>
              </div>

              {/* Loading State */}
              {isLoading && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 0', gap: 12 }}>
                  <Loader size={28} style={{ animation: 'spin 1s linear infinite', color: 'var(--accent)' }} />
                  <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Procesando solicitud con yt-dlp...</span>
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
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 14px', background: 'var(--bg-deep)', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
                      <div style={{ width: 48, height: 36, borderRadius: 6, background: 'var(--bg-surface)', overflow: 'hidden', flexShrink: 0 }}>
                        {r.thumbnail ? <img src={r.thumbnail} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Music size={16} />}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>{r.channel} · {formatDuration(r.duration)}</div>
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => window.open(r.webpage_url, '_blank')} className="btn-secondary" style={{ padding: '6px 12px', height: 32, fontSize: 11, display: 'flex', alignItems: 'center', gap: 6 }}><Play size={12} /> YouTube</button>
                        <button onClick={() => handleDownloadOne(r)} className="btn-primary" style={{ padding: '6px 12px', height: 32, fontSize: 11, display: 'flex', alignItems: 'center', gap: 6 }}><Download size={12} /> Descargar</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Preview Area */}
              {preview && !isLoading && (
                <div style={{ background: 'var(--bg-deep)', padding: 20, borderRadius: 12, border: '1px solid var(--border-default)', position: 'relative' }}>
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          
          {/* REPRODUCIENDO CARD */}
          {currentTrack ? (
          <div className="bento-card" style={{ padding: '24px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', border: isPlayingMusic ? '1px solid var(--accent)' : '1px solid var(--border-default)', boxShadow: isPlayingMusic ? '0 8px 32px rgba(225,29,72,0.15)' : 'none', transition: 'all 300ms' }}>
            <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: isPlayingMusic ? 'var(--accent)' : 'var(--text-muted)', boxShadow: isPlayingMusic ? '0 0 8px var(--accent)' : 'none', animation: isPlayingMusic ? 'pulseGlow 1.5s infinite' : 'none' }} />
                <span className="section-header" style={{ marginBottom: 0, fontSize: 12, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  {isPlayingMusic ? 'Reproduciendo' : 'Pausado'}
                </span>
              </div>
              <Heart size={16} style={{ color: currentTrack.isFavorite ? 'var(--accent)' : 'var(--text-muted)', fill: currentTrack.isFavorite ? 'var(--accent)' : 'none', cursor: 'pointer' }} onClick={() => toggleTrackFavorite(currentTrack.id)} />
            </div>

            <div style={{ width: '100%', aspectRatio: '1/1', borderRadius: 12, overflow: 'hidden', marginBottom: 20, boxShadow: '0 8px 24px rgba(0,0,0,0.6)', position: 'relative', background: 'var(--bg-surface)' }}>
              {currentTrack.coverImage ? <img src={currentTrack.coverImage} alt={currentTrack.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Music size={48} style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', color: 'var(--text-muted)', opacity: 0.15 }} />}
              {isPlayingMusic && (
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, transparent 60%, rgba(225,29,72,0.2) 100%)', pointerEvents: 'none' }} />
              )}
            </div>

            <div style={{ textAlign: 'center', marginBottom: 20, width: '100%' }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{currentTrack.title}</h3>
              <p style={{ fontSize: 13, color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{currentTrack.artist}</p>
            </div>

            {/* Progress Bar */}
            <div style={{ width: '100%', marginBottom: 20 }}>
              <div className="progress-track" style={{ height: 4, marginBottom: 8, background: 'var(--bg-deep)', borderRadius: 2, overflow: 'hidden' }}>
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
                const idx = musicQueue.indexOf(currentTrack.id);
                if (idx > 0) playTrack(musicQueue[idx - 1]);
              }} className="btn-ghost" style={{ padding: 8 }}>
                <SkipBack size={20} style={{ color: 'var(--text-primary)' }} />
              </button>
              <button onClick={toggleMusicPlayback} style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--accent)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', cursor: 'pointer', boxShadow: '0 8px 16px rgba(225,29,72,0.4)' }} className="hover-lift">
                {isPlayingMusic ? <Pause size={22} fill="#fff" /> : <Play size={22} fill="#fff" style={{ marginLeft: 3 }} />}
              </button>
              <button onClick={() => {
                const idx = musicQueue.indexOf(currentTrack.id);
                if (idx < musicQueue.length - 1) playTrack(musicQueue[idx + 1]);
                else if (repeatMode === 'all' && musicQueue.length > 0) playTrack(musicQueue[0]);
              }} className="btn-ghost" style={{ padding: 8 }}>
                <SkipForward size={20} style={{ color: 'var(--text-primary)' }} />
              </button>
              <button onClick={() => {
                const next = repeatMode === 'none' ? 'all' : repeatMode === 'all' ? 'one' : 'none';
                setRepeatMode(next);
              }} className="btn-ghost" style={{ padding: 8, color: repeatMode !== 'none' ? 'var(--accent)' : 'var(--text-tertiary)' }}>
                <Repeat size={16} />
              </button>
            </div>
          </div>
          ) : (
          <div className="bento-card" style={{ padding: '24px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, border: '1px dashed var(--border-subtle)' }}>
            <Music size={32} style={{ color: 'var(--text-muted)', opacity: 0.4 }} />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>Tiempo hoy</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)', marginTop: 4 }}>{formatTime(studySessions.reduce((sum, s) => sum + s.duration, 0))}</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>de estudio con música</div>
            </div>
            <div style={{ width: '100%', borderTop: '1px solid var(--border-subtle)', paddingTop: 16, textAlign: 'center', fontSize: 11, color: 'var(--text-tertiary)' }}>
              Selecciona una canción para empezar
            </div>
          </div>
          )}

          {/* COLA DE REPRODUCCIÓN */}
          <div className="bento-card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <span className="section-header" style={{ marginBottom: 0, fontSize: 12, color: 'var(--text-primary)' }}>Cola de reproducción</span>
              {musicQueue.length > 0 && (
                <span onClick={() => setMusicQueue([])} style={{ fontSize: 11, color: 'var(--text-tertiary)', cursor: 'pointer' }} className="hover:text-white">Borrar</span>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {(() => {
                // Show next 5 from queue (skip current playing track)
                const queueItems = musicQueue.length > 0
                  ? musicQueue.filter(id => id !== currentTrackId).slice(0, 5)
                  : trackHistory.slice(0, 5);
                return queueItems.length > 0 ? queueItems.map((trackId, i) => {
                  const t = tracks.find(tr => tr.id === trackId);
                  if (!t) return null;
                  return (
                    <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }} onClick={() => playTrack(t.id)}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', width: 16, textAlign: 'center' }}>{i + 1}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.artist}</div>
                      </div>
                      <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>{formatTime(t.duration)}</span>
                    </div>
                  );
                }) : (
                  <div style={{ padding: '20px 0', textAlign: 'center', fontSize: 12, color: 'var(--text-tertiary)' }}>Sin reproducciones recientes</div>
                );
              })()}
            </div>
          </div>

          {/* ESTADÍSTICAS DE ESCUCHA */}
          <div className="bento-card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <span className="section-header" style={{ marginBottom: 0, fontSize: 12, color: 'var(--text-primary)' }}>Estadísticas de escucha</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, background: 'var(--bg-deep)', padding: '3px', borderRadius: 6, border: '1px solid var(--border-subtle)' }}>
                <button onClick={() => setStatsPeriod('week')} style={{ padding: '3px 8px', borderRadius: 4, border: 'none', background: statsPeriod === 'week' ? 'var(--accent)' : 'transparent', color: statsPeriod === 'week' ? '#fff' : 'var(--text-tertiary)', cursor: 'pointer', fontSize: 10, fontWeight: 600 }}>Semana</button>
                <button onClick={() => setStatsPeriod('month')} style={{ padding: '3px 8px', borderRadius: 4, border: 'none', background: statsPeriod === 'month' ? 'var(--accent)' : 'transparent', color: statsPeriod === 'month' ? '#fff' : 'var(--text-tertiary)', cursor: 'pointer', fontSize: 10, fontWeight: 600 }}>Mes</button>
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>{Object.keys(trackHistory).length} canciones</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Reproducidas</div>
            </div>

            {/* SVG Wave Chart - based on actual listening time */}
            <div style={{ width: '100%', height: 64, marginBottom: 20 }}>
              <svg viewBox="0 0 300 64" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                <defs>
                  <linearGradient id="waveGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.0" />
                  </linearGradient>
                </defs>
                {(() => {
                  const days = statsPeriod === 'week' ? 7 : 30;
                  const now = new Date();
                  const vals = Array.from({ length: days }, (_, i) => {
                    const date = new Date(now);
                    date.setDate(date.getDate() - (days - 1 - i));
                    const dayStr = date.toISOString().slice(0, 10);
                    const daySessions = studySessions.filter(s => s.startedAt?.startsWith(dayStr));
                    const totalSecs = daySessions.reduce((sum, s) => sum + (s.duration || 0), 0);
                    const maxVal = 59;
                    const maxSecs = 14400; // 4 hours = max bar
                    return Math.max(2, Math.min(maxVal, (totalSecs / maxSecs) * maxVal));
                  });
                  const points = vals.map((v, i) => `${(i / (days - 1 || 1)) * 300},${64 - v}`).join(' ');
                  const linePath = `M${points}`;
                  const areaPath = `${linePath} L300,64 L0,64 Z`;
                  return (
                    <>
                      <path d={areaPath} fill="url(#waveGrad)" />
                      <path d={linePath} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" />
                      <circle cx={((days - 1) / (days - 1 || 1)) * 300} cy={64 - vals[vals.length - 1]} r="4" fill="var(--accent)" style={{ filter: 'drop-shadow(0 0 8px var(--accent))' }} />
                    </>
                  );
                })()}
              </svg>
            </div>

            {/* Micro Stats Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, borderTop: '1px solid var(--border-subtle)', paddingTop: 16 }}>
              <div style={{ textAlign: 'center', background: 'var(--bg-deep)', padding: '8px 4px', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 2 }}>Reproducidas</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{Object.values(playCounts).reduce((a, b) => a + b, 0)}</div>
              </div>
              <div style={{ textAlign: 'center', background: 'var(--bg-deep)', padding: '8px 4px', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 2 }}>Artistas</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                  {new Set(tracks.map(t => t.artist)).size}
                </div>
              </div>
              <div style={{ textAlign: 'center', background: 'var(--bg-deep)', padding: '8px 4px', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 2 }}>Favoritas</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{tracks.filter(t => t.isFavorite).length}</div>
              </div>
            </div>
          </div>

          {/* DOWNLOADS CARD */}
          {downloadQueue.length > 0 && (
            <div className="bento-card" style={{ padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span className="section-header" style={{ marginBottom: 0, fontSize: 12, color: 'var(--text-primary)' }}>Descargas</span>
                {completedDownloads.length > 0 && (
                  <button onClick={clearCompletedDownloads} className="btn-ghost" style={{ fontSize: 10, padding: '2px 6px' }}>Limpiar</button>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 200, overflowY: 'auto' }}>
                {downloadQueue.map(item => (
                  <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 4, background: 'var(--bg-surface)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {item.thumbnail ? <img src={item.thumbnail} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Music size={12} />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</div>
                      <div className="progress-track" style={{ height: 3, marginTop: 4 }}>
                        <div className="progress-fill" style={{ width: `${item.progress * 100}%`, background: item.status === 'completed' ? 'var(--success)' : item.status === 'error' ? 'var(--error)' : 'var(--accent)' }} />
                      </div>
                    </div>
                    <span style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-tertiary)', minWidth: 30, textAlign: 'right' }}>
                      {item.status === 'downloading' ? `${Math.round(item.progress * 100)}%` : item.status === 'completed' ? '✓' : item.status === 'error' ? '✗' : ''}
                    </span>
                    {(item.status === 'downloading' || item.status === 'queued') && (
                      <button onClick={() => handleCancelDownload(item.id)} className="btn-ghost" style={{ padding: 2 }}><X size={10} /></button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

      </div>

      {/* Playlist Form Modal */}
      {showPlaylistForm && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
        }} onClick={() => setShowPlaylistForm(false)}>
          <div className="bento-card" style={{ padding: 28, width: 360, maxWidth: '90vw' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16 }}>
              {editingPlaylistId ? 'Editar Playlist' : 'Nueva Playlist'}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Nombre</label>
                <input value={plFormName} onChange={e => setPlFormName(e.target.value)} placeholder="Ej. Enfoque Profundo" className="input-base" style={{ width: '100%', height: 38, fontSize: 12 }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>URL de portada (o selecciona archivo)</label>
                <input value={plFormCover} onChange={e => setPlFormCover(e.target.value)} placeholder="https://ejemplo.com/portada.jpg" className="input-base" style={{ width: '100%', height: 38, fontSize: 12 }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>O sube una imagen</label>
                <input type="file" accept="image/*" onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = (ev) => setPlFormCover(ev.target?.result as string);
                    reader.readAsDataURL(file);
                  }
                }} style={{ fontSize: 11 }} />
              </div>
              {plFormCover && (
                <div style={{ width: 80, height: 80, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border-subtle)' }}>
                  <img src={plFormCover} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 20 }}>
              <button onClick={() => { setShowPlaylistForm(false); setEditingPlaylistId(null); }} className="btn-secondary" style={{ height: 38, padding: '0 20px', fontSize: 12 }}>Cancelar</button>
              <button onClick={() => {
                if (!plFormName.trim()) { toast.error('Ingresa un nombre'); return; }
                if (editingPlaylistId) {
                  updatePlaylist(editingPlaylistId, { name: plFormName.trim(), coverImage: plFormCover || undefined, coverUrl: plFormCover || undefined });
                  toast.success('Playlist actualizada');
                } else {
                  addPlaylist({ name: plFormName.trim(), trackIds: [], coverImage: plFormCover || undefined, coverUrl: plFormCover || undefined });
                  toast.success(`Playlist creada: ${plFormName.trim()}`);
                }
                setShowPlaylistForm(false);
                setEditingPlaylistId(null);
              }} className="btn-primary" style={{ height: 38, padding: '0 20px', fontSize: 12 }}>
                {editingPlaylistId ? 'Guardar' : 'Crear'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Track Dialog */}
      {editingTrackId && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
        }} onClick={() => setEditingTrackId(null)}>
          <div className="bento-card" style={{ padding: 28, width: 340, maxWidth: '90vw' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16 }}>Editar Canción</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Título</label>
                <input value={editTitle} onChange={e => setEditTitle(e.target.value)} className="input-base" style={{ width: '100%', height: 38, fontSize: 12 }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Artista</label>
                <input value={editArtist} onChange={e => setEditArtist(e.target.value)} className="input-base" style={{ width: '100%', height: 38, fontSize: 12 }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>URL Portada</label>
                <input value={editCover} onChange={e => setEditCover(e.target.value)} className="input-base" style={{ width: '100%', height: 38, fontSize: 12 }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 20 }}>
              <button onClick={() => setEditingTrackId(null)} className="btn-secondary" style={{ height: 38, padding: '0 20px', fontSize: 12 }}>Cancelar</button>
              <button onClick={() => {
                updateTrack(editingTrackId, { title: editTitle, artist: editArtist, coverImage: editCover || undefined });
                toast.success('Canción actualizada');
                setEditingTrackId(null);
              }} className="btn-primary" style={{ height: 38, padding: '0 20px', fontSize: 12 }}>Guardar</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog */}
      {confirmDelete && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
        }} onClick={() => setConfirmDelete(null)}>
          <div className="bento-card" style={{ padding: 28, width: 320, maxWidth: '90vw' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>¿Eliminar?</h3>
            <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 24 }}>
              {tracks.find(t => t.id === confirmDelete)
                ? `Se eliminará "${tracks.find(t => t.id === confirmDelete)?.title}" de tu biblioteca.`
                : 'Se eliminará esta playlist de tu biblioteca.'}
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button onClick={() => setConfirmDelete(null)} className="btn-secondary" style={{ height: 38, padding: '0 20px', fontSize: 12 }}>
                Cancelar
              </button>
              <button onClick={() => {
                const track = tracks.find(t => t.id === confirmDelete);
                if (track) {
                  deleteTrack(confirmDelete);
                  toast.success(`"${track.title}" eliminada`);
                } else {
                  deletePlaylist(confirmDelete);
                  setSelectedPlaylistId(null);
                  toast.success('Playlist eliminada');
                }
                setConfirmDelete(null);
              }} className="btn-primary" style={{ height: 38, padding: '0 20px', fontSize: 12, background: 'var(--error)', borderColor: 'var(--error)' }}>
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
