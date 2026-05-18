import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  Play, Pause, SkipBack, SkipForward, Volume2, Search,
  Music, Download, Trash2, X, ListMusic, Upload,
  Link, Globe, Loader, CheckCircle, AlertCircle,
  ArrowLeft, ArrowRight, ChevronDown, ChevronUp,
  ExternalLink, FolderOpen, Plus,
  Disc3, Activity, Heart, Copy, Clock,
  User, Wifi, Bell, Sliders, Repeat, Shuffle, BarChart2,
} from 'lucide-react';
import { useApp } from '../../store/AppContext';
import toast from 'react-hot-toast';
import { open, save } from '@tauri-apps/plugin-dialog';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  fetchMetadata, searchMusic, startDownload, cancelDownload,
  streamAudioUrl, getDownloadPath, setDownloadPath,
  onDownloadProgress, onDownloadComplete, onDownloadFile,
  detectUrlType, generateDownloadId, formatDuration, validateUrl,
  exportToZip,
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
    playTrack, musicVolume, setMusicVolume, setMusicProgress, musicProgress,
    addPlaylist, updatePlaylist, addTrack, addToDownloadQueue,
    updateDownloadProgress, updateDownloadStatus, toggleTrackFavorite,
    downloadQueue, removeFromDownloadQueue, clearCompletedDownloads,
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
  const [currentTime, setCurrentTime] = useState(new Date());

  const urlInputRef = useRef<HTMLInputElement>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);

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
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }, []);

  useEffect(() => {
    getDownloadPath().then(setDownloadPathState).catch(() => {});
  }, []);

  useEffect(() => {
    const unlistenProgress = onDownloadProgress((data: DownloadProgress) => {
      updateDownloadProgress(data.downloadId, data.progress);
    });
    const unlistenComplete = onDownloadComplete((data: DownloadComplete) => {
      updateDownloadStatus(data.downloadId, data.success ? 'completed' : 'error');
      if (data.success) {
        toast.success('Descarga completada');
      } else {
        toast.error('Error en la descarga');
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
      toast.error(msg || 'Error al procesar la URL. Verifica que sea correcta.');
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
      const dlId = generateDownloadId();
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
        await startDownload(entry.webpage_url, dlId, path, audioFormat);
      } catch {
        updateDownloadStatus(dlItemId, 'error', 'Error al descargar');
      }
    }
    toast.success(`${entries.length} canción(es) añadida(s) a la cola`);
  };

  const handleDownloadOne = async (entry: YouTubeMetadata) => {
    const dlId = generateDownloadId();
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
      await startDownload(entry.webpage_url, dlId, downloadPath, audioFormat);
    } catch {
      updateDownloadStatus(dlItemId, 'error', 'Error al descargar');
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

  const handleStream = async (entry: YouTubeMetadata) => {
    setIsStreaming(true);
    try {
      const audioUrl = await streamAudioUrl(entry.webpage_url);
      setStreamUrl(audioUrl);
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current = null;
      }
      const audio = new Audio(audioUrl);
      audio.volume = musicVolume;
      currentAudioRef.current = audio;
      audio.play();
      setIsStreaming(true);

      audio.addEventListener('timeupdate', () => {
        if (audio.duration) {
          setMusicProgress(audio.currentTime / audio.duration);
        }
      });
      audio.addEventListener('ended', () => {
        setIsStreaming(false);
        setStreamUrl(null);
      });

      addTrack({
        title: entry.title,
        artist: entry.channel,
        duration: entry.duration,
        source: 'youtube',
        url: audioUrl,
        coverImage: entry.thumbnail,
        isFavorite: false,
      });
    } catch {
      toast.error('Error al reproducir');
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
      if (showSearch) handleSearch();
      else handleUrlSubmit();
    }
  };

  const currentTrack = tracks.find(t => t.id === currentTrackId) || {
    id: '1',
    title: 'Less Than Zero',
    artist: 'The Weeknd',
    album: 'Dawn FM',
    duration: 211,
    coverImage: 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=500&auto=format&fit=crop&q=80',
    isFavorite: true,
  };

  const activeDownloads = downloadQueue.filter(d => d.status === 'downloading' || d.status === 'queued');
  const completedDownloads = downloadQueue.filter(d => d.status === 'completed');

  // Mock albums for Recientes matching the screenshot exactly
  const mockAlbums = [
    { title: 'After Hours', artist: 'The Weeknd', img: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&auto=format&fit=crop&q=80' },
    { title: 'Blinding Lights', predominant: 'The Weeknd', img: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop&q=80' },
    { title: 'Starboy', artist: 'The Weeknd', img: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&auto=format&fit=crop&q=80' },
    { title: 'Dawn FM', artist: 'The Weeknd', img: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=80' },
    { title: 'Kiss Land', artist: 'The Weeknd', img: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=500&auto=format&fit=crop&q=80' },
  ];

  // Combined tracks list
  const combinedTracks = useMemo(() => {
    const baseTracks = [
      { id: '1', title: 'Less Than Zero', artist: 'The Weeknd', album: 'Dawn FM', duration: '3:31', added: 'Hoy, 15:42', fav: true, playing: currentTrack.title === 'Less Than Zero' && isPlayingMusic },
      { id: '2', title: 'Escape From LA', artist: 'The Weeknd', album: 'After Hours', duration: '5:56', added: 'Hoy, 15:33', fav: false, playing: currentTrack.title === 'Escape From LA' && isPlayingMusic },
      { id: '3', title: 'Heartless', artist: 'The Weeknd', album: 'After Hours', duration: '3:18', added: 'Hoy, 15:20', fav: true, playing: currentTrack.title === 'Heartless' && isPlayingMusic },
      { id: '4', title: 'Faith', artist: 'The Weeknd', album: 'After Hours', duration: '4:44', added: 'Hoy, 15:10', fav: false, playing: currentTrack.title === 'Faith' && isPlayingMusic },
      { id: '5', title: 'Out of Time', artist: 'The Weeknd', album: 'Dawn FM', duration: '3:34', added: 'Hoy, 15:01', fav: true, playing: currentTrack.title === 'Out of Time' && isPlayingMusic },
      { id: '6', title: 'Die For You', artist: 'The Weeknd', album: 'Starboy', duration: '4:20', added: 'Hoy, 14:55', fav: false, playing: currentTrack.title === 'Die For You' && isPlayingMusic },
      { id: '7', title: 'Save Your Tears', artist: 'The Weeknd', album: 'After Hours', duration: '3:35', added: 'Hoy, 14:44', fav: false, playing: currentTrack.title === 'Save Your Tears' && isPlayingMusic },
    ];
    // Add dynamic tracks from store
    const storeTracks = tracks.filter(t => !baseTracks.some(bt => bt.title === t.title)).map((t, idx) => ({
      id: t.id,
      title: t.title,
      artist: t.artist,
      album: 'Biblioteca OWA',
      duration: `${Math.floor(t.duration / 60)}:${Math.floor(t.duration % 60).toString().padStart(2, '0')}`,
      added: 'Reciente',
      fav: t.isFavorite,
      playing: currentTrack.id === t.id && isPlayingMusic,
    }));
    return [...baseTracks, ...storeTracks];
  }, [tracks, currentTrack, isPlayingMusic]);

  const displayTracks = activeTab === 'favoritas' ? combinedTracks.filter(t => t.fav) : combinedTracks;

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
            <input type="file" accept="audio/*" onChange={e => {
              const file = e.target.files?.[0];
              if (file) {
                addTrack({
                  title: file.name.replace(/\.[^/.]+$/, ""),
                  artist: 'Audio Local',
                  duration: 180,
                  source: 'local',
                  url: URL.createObjectURL(file),
                  coverImage: 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=500&auto=format&fit=crop&q=80',
                  isFavorite: false,
                });
                toast.success(`Audio local subido: ${file.name}`);
              }
            }} style={{ display: 'none' }} />
          </label>

          <button onClick={() => setActiveTab('explorar')} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6, height: 36, borderRadius: 18, fontSize: 12 }}>
            <Plus size={14} /> Añadir música <ChevronDown size={12} style={{ marginLeft: 2 }} />
          </button>
        </div>
      </div>

      {/* ── STATS ROW (4 CARDS) ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
        {[
          { label: 'Canciones', val: combinedTracks.length, sub: 'en tu biblioteca', icon: Music, color: 'var(--accent)' },
          { label: 'Playlists', val: playlists.length || 3, sub: 'creadas por ti', icon: ListMusic, color: '#3B82F6' },
          { label: 'Tiempo total', val: '82h 34m', sub: 'de música', icon: Clock, color: '#10B981' },
          { label: 'Escuchas hoy', val: '2h 15m', sub: '+18% vs ayer', icon: Activity, color: '#F59E0B' },
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

      {/* ── MAIN CONTENT AREA (GRID 1fr 320px) ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24, flex: 1, alignItems: 'flex-start' }}>

        {/* LEFT COLUMN */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          
          {/* PLAYLISTS VIEW */}
          {activeTab === 'playlists' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 24 }}>
              <div className="bento-card" style={{ padding: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>Mis Playlists</h3>
                  <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{playlists.length} playlists creadas</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 28 }}>
                  {playlists.map(pl => {
                    const isSel = selectedPlaylistId === pl.id;
                    return (
                      <div key={pl.id} onClick={() => setSelectedPlaylistId(pl.id)} className="bento-card hover-lift" style={{ padding: 16, background: isSel ? 'var(--accent-dim)' : 'var(--bg-deep)', border: isSel ? '1px solid var(--accent)' : '1px solid var(--border-subtle)', cursor: 'pointer', transition: 'all 200ms' }}>
                        <div style={{ width: '100%', aspectRatio: '16/9', borderRadius: 8, background: 'linear-gradient(135deg, var(--accent), #3B82F6)', marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 16, boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
                          {pl.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pl.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>{pl.trackIds.length} canciones</div>
                      </div>
                    );
                  })}
                  {playlists.length === 0 && (
                    <div style={{ gridColumn: '1 / -1', padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)', background: 'var(--bg-deep)', borderRadius: 12, border: '1px dashed var(--border-subtle)' }}>
                      <ListMusic size={32} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>No tienes playlists creadas</div>
                      <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4 }}>Usa el formulario lateral para crear tu primera playlist</div>
                    </div>
                  )}
                </div>

                {selectedPlaylistId && (
                  <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 24 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                      <h4 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Canciones en {playlists.find(p => p.id === selectedPlaylistId)?.name}</h4>
                      <button onClick={() => {
                        toast.success('Playlist eliminada');
                        setSelectedPlaylistId(null);
                      }} className="btn-ghost" style={{ color: 'var(--error)', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}><Trash2 size={14} /> Eliminar Playlist</button>
                    </div>
                    {playlists.find(p => p.id === selectedPlaylistId)?.trackIds.length === 0 ? (
                      <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)', background: 'var(--bg-deep)', borderRadius: 12, border: '1px dashed var(--border-subtle)' }}>
                        <Music size={32} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>No hay canciones en esta playlist</div>
                        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4 }}>Añade canciones desde la Biblioteca o Explorar usando las opciones</div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {playlists.find(p => p.id === selectedPlaylistId)?.trackIds.map((tId, idx) => {
                          const t = tracks.find(tr => tr.id === tId) || combinedTracks[0];
                          return (
                            <div key={tId} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'var(--bg-deep)', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
                              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)', width: 20 }}>{idx + 1}</span>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</div>
                                <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{t.artist}</div>
                              </div>
                              <button onClick={() => playTrack(t.id)} className="btn-ghost" style={{ padding: 6 }}><Play size={14} /></button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Formulario Crear Nueva Playlist */}
              <div className="bento-card" style={{ padding: '24px', background: 'var(--bg-deep)', height: 'fit-content' }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Plus size={18} className="text-accent" /> Crear Playlist
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Nombre de la Playlist</label>
                    <input id="new-pl-name" type="text" placeholder="Ej. Enfoque Profundo, Lofi Chill..." className="input-base" style={{ width: '100%', height: 38, fontSize: 12, background: 'var(--bg-surface)' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>URL de Portada (Opcional)</label>
                    <input id="new-pl-cover" type="text" placeholder="https://ejemplo.com/portada.jpg" className="input-base" style={{ width: '100%', height: 38, fontSize: 12, background: 'var(--bg-surface)' }} />
                  </div>
                  <button onClick={() => {
                    const nameEl = document.getElementById('new-pl-name') as HTMLInputElement;
                    const coverEl = document.getElementById('new-pl-cover') as HTMLInputElement;
                    if (nameEl && nameEl.value.trim()) {
                      addPlaylist({ name: nameEl.value.trim(), trackIds: [] });
                      toast.success(`Playlist creada: ${nameEl.value.trim()}`);
                      nameEl.value = '';
                      if (coverEl) coverEl.value = '';
                    } else {
                      toast.error('Por favor ingresa un nombre para la playlist');
                    }
                  }} className="btn-primary hover-lift" style={{ height: 40, fontSize: 12, fontWeight: 600, width: '100%', justifyContent: 'center' }}>
                    Crear Playlist
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* RECIENTES ALBUMS GRID */}
          {(activeTab === 'biblioteca' || activeTab === 'favoritas') && (
            <div className="bento-card" style={{ padding: '20px 24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div className="section-header" style={{ marginBottom: 0, fontSize: 13, color: 'var(--text-primary)' }}>Recientes</div>
                <span className="text-accent" style={{ fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Ver todo</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16 }}>
                {mockAlbums.map((album, i) => (
                  <div key={i} className="bento-card" style={{ padding: 12, background: 'var(--bg-deep)', cursor: 'pointer', transition: 'all 200ms' }} onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-4px)'} onMouseLeave={e => e.currentTarget.style.transform = ''}>
                    <div style={{ width: '100%', aspectRatio: '1/1', borderRadius: 8, overflow: 'hidden', marginBottom: 12, position: 'relative', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
                      <img src={album.img} alt={album.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', opacity: 0, transition: 'opacity 200ms', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onMouseEnter={e => e.currentTarget.style.opacity = '1'} onMouseLeave={e => e.currentTarget.style.opacity = '0'}>
                        <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
                          <Play size={18} fill="#fff" style={{ marginLeft: 2 }} />
                        </div>
                      </div>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{album.title}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{album.predominant || 'The Weeknd'}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SONGS TABLE */}
          {(activeTab === 'biblioteca' || activeTab === 'favoritas') && (
            <div className="bento-card" style={{ padding: '20px 24px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '40px 2fr 1.5fr 1fr 1fr 120px', padding: '0 12px 12px', borderBottom: '1px solid var(--border-subtle)', fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                <span></span>
                <span>Título</span>
                <span>Artista</span>
                <span>Álbum</span>
                <span>Duración</span>
                <span style={{ textAlign: 'right' }}>Me gusta</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {displayTracks.map((track, i) => (
                  <div
                    key={track.id}
                    style={{
                      display: 'grid', gridTemplateColumns: '40px 2fr 1.5fr 1fr 1fr 120px', padding: '10px 12px',
                      borderRadius: 8, alignItems: 'center', cursor: 'pointer', transition: 'all 150ms',
                      background: track.playing ? 'var(--accent-dim)' : 'transparent',
                      border: track.playing ? '1px solid var(--accent-glow)' : '1px solid transparent',
                    }}
                    onMouseEnter={e => { if (!track.playing) e.currentTarget.style.background = 'var(--bg-hover)'; }}
                    onMouseLeave={e => { if (!track.playing) e.currentTarget.style.background = 'transparent'; }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {track.playing ? (
                        <div style={{ width: 24, height: 24, borderRadius: 6, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                          <Pause size={12} fill="#fff" />
                        </div>
                      ) : (
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)', width: 24, textAlign: 'center' }}>{i + 1}</span>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 6, background: 'var(--bg-deep)', flexShrink: 0, overflow: 'hidden' }}>
                        <img src={mockAlbums[i % mockAlbums.length].img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: track.playing ? 600 : 500, color: track.playing ? 'var(--accent)' : 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{track.title}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>{track.artist}</div>
                      </div>
                    </div>

                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{track.artist}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{track.album}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{track.duration}</div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                      <button onClick={(e) => { e.stopPropagation(); toggleTrackFavorite(track.id); }} className="btn-ghost hover-lift" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 12, border: track.fav ? '1px solid var(--accent)' : '1px solid var(--border-subtle)', background: track.fav ? 'var(--accent-dim)' : 'var(--bg-surface)', color: track.fav ? 'var(--accent)' : 'var(--text-secondary)', fontSize: 11, fontWeight: 600 }}>
                        <Heart size={14} style={{ color: track.fav ? 'var(--accent)' : 'var(--text-tertiary)', fill: track.fav ? 'var(--accent)' : 'transparent' }} />
                        <span>{track.fav ? 'Me gusta' : 'No me gusta'}</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* EXPLORAR & DESCARGAR SECTION (CUSTOM YT/SPOTIFY SCRAPER) */}
          <div className="bento-card" style={{ padding: '24px 28px', border: activeTab === 'explorar' ? '1px solid var(--accent-glow)' : '1px solid var(--border-default)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <div className="section-header" style={{ marginBottom: 4, fontSize: 14, color: 'var(--text-primary)' }}>Explorar & Descargar Música</div>
                <p style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Importa canciones o playlists completas desde YouTube y Spotify mediante yt-dlp.</p>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => addPlaylist({ name: 'Nueva Playlist OWA', trackIds: [] })} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, height: 32 }}>
                  <Plus size={14} /> Crear Playlist
                </button>
                <button onClick={async () => {
                  const result = await save({ filters: [{ name: 'ZIP', extensions: ['zip'] }], defaultPath: 'OWA_Music_Export.zip' });
                  if (!result) return;
                  const toastId = toast.loading('Creando ZIP...');
                  try {
                    const path = await exportToZip(result);
                    toast.success(`ZIP creado: ${path}`, { id: toastId });
                  } catch (e: any) { toast.error(String(e), { id: toastId }); }
                }} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, height: 32 }}>
                  <FolderOpen size={14} /> Exportar ZIP
                </button>
              </div>
            </div>

            {/* URL Input Bar */}
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

              <button onClick={() => setShowSearch(!showSearch)} className="btn-secondary" style={{ height: 42, padding: '0 18px', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Search size={16} /> Buscar
              </button>
            </div>

            {/* Search Bar */}
            {showSearch && (
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
                  onClick={async () => {
                    try {
                      const folder = await open({ directory: true, multiple: false, title: 'Carpeta de descargas' });
                      if (folder) {
                        setDownloadPathState(String(folder));
                        await setDownloadPath(String(folder));
                        toast.success('Carpeta de descarga actualizada');
                      }
                    } catch (e) { toast.error('No se pudo cambiar la carpeta'); }
                  }}
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
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Resultados de Búsqueda</div>
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
                      <button onClick={() => handleStream(r)} className="btn-secondary" style={{ padding: '6px 12px', height: 32, fontSize: 11, display: 'flex', alignItems: 'center', gap: 6 }}><Play size={12} /> Reproducir</button>
                      <button onClick={() => handleDownloadOne(r)} className="btn-primary" style={{ padding: '6px 12px', height: 32, fontSize: 11, display: 'flex', alignItems: 'center', gap: 6 }}><Download size={12} /> Descargar</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Preview Area */}
            {preview && !isLoading && (
              <div style={{ background: 'var(--bg-deep)', padding: 20, borderRadius: 12, border: '1px solid var(--border-default)' }}>
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
                      <button onClick={handleSelectForLibrary} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, height: 36 }}>
                        <ListMusic size={14} /> Añadir a Biblioteca OWA
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
                          <button onClick={() => handleStream(entry)} className="btn-ghost" style={{ padding: 6 }}><Play size={12} /></button>
                          <button onClick={() => handleDownloadOne(entry)} className="btn-ghost" style={{ padding: 6 }}><Download size={12} /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Download Queue */}
            {downloadQueue.length > 0 && (
              <div style={{ marginTop: 24, borderTop: '1px solid var(--border-subtle)', paddingTop: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>Cola de Descargas Activas ({downloadQueue.length})</div>
                  {completedDownloads.length > 0 && (
                    <button onClick={clearCompletedDownloads} className="btn-ghost" style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px' }}>
                      <Trash2 size={12} /> Limpiar completadas
                    </button>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {downloadQueue.map(item => (
                    <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'var(--bg-deep)', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
                      <div style={{ width: 36, height: 36, borderRadius: 6, background: 'var(--bg-surface)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {item.thumbnail ? <img src={item.thumbnail} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Music size={16} />}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4 }}>
                          <div className="progress-track" style={{ flex: 1, height: 4 }}>
                            <div className="progress-fill" style={{ width: `${item.progress * 100}%`, background: item.status === 'completed' ? 'var(--success)' : item.status === 'error' ? 'var(--error)' : 'var(--accent)' }} />
                          </div>
                          <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)' }}>{item.status === 'downloading' ? `${Math.round(item.progress * 100)}%` : item.status}</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {(item.status === 'downloading' || item.status === 'queued') && (
                          <button onClick={() => handleCancelDownload(item.id)} className="btn-ghost" style={{ padding: 6 }}><X size={14} /></button>
                        )}
                        {(item.status === 'completed' || item.status === 'error' || item.status === 'cancelled') && (
                          <button onClick={() => removeFromDownloadQueue(item.id)} className="btn-ghost" style={{ padding: 6 }}><Trash2 size={14} /></button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>

        </div>

        {/* RIGHT COLUMN (REPRODUCIENDO, COLA, ESTADÍSTICAS) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          
          {/* REPRODUCIENDO CARD */}
          <div className="bento-card" style={{ padding: '24px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', border: isPlayingMusic ? '1px solid var(--accent)' : '1px solid var(--border-default)', boxShadow: isPlayingMusic ? '0 8px 32px rgba(225,29,72,0.15)' : 'none', transition: 'all 300ms' }}>
            <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: isPlayingMusic ? 'var(--accent)' : 'var(--text-muted)', boxShadow: isPlayingMusic ? '0 0 8px var(--accent)' : 'none', animation: isPlayingMusic ? 'pulseGlow 1.5s infinite' : 'none' }} />
                <span className="section-header" style={{ marginBottom: 0, fontSize: 12, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  {isPlayingMusic ? 'Reproduciendo' : 'Pausado'}
                </span>
              </div>
              <Heart size={16} style={{ color: 'var(--accent)', fill: 'var(--accent)', cursor: 'pointer' }} />
            </div>

            <div style={{ width: '100%', aspectRatio: '1/1', borderRadius: 12, overflow: 'hidden', marginBottom: 20, boxShadow: '0 8px 24px rgba(0,0,0,0.6)', position: 'relative' }}>
              <img src={currentTrack.coverImage} alt={currentTrack.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
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
                <span>{formatTime(musicProgress * (currentTrack.duration || 211))}</span>
                <span>{formatTime(currentTrack.duration || 211)}</span>
              </div>
            </div>

            {/* Player Controls */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '0 12px' }}>
              <button className="btn-ghost" style={{ padding: 8 }}><Shuffle size={16} style={{ color: 'var(--text-tertiary)' }} /></button>
              <button className="btn-ghost" style={{ padding: 8 }}><SkipBack size={20} style={{ color: 'var(--text-primary)' }} /></button>
              <button onClick={toggleMusicPlayback} style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--accent)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', cursor: 'pointer', boxShadow: '0 8px 16px rgba(225,29,72,0.4)' }} className="hover-lift">
                {isPlayingMusic ? <Pause size={22} fill="#fff" /> : <Play size={22} fill="#fff" style={{ marginLeft: 3 }} />}
              </button>
              <button className="btn-ghost" style={{ padding: 8 }}><SkipForward size={20} style={{ color: 'var(--text-primary)' }} /></button>
              <button className="btn-ghost" style={{ padding: 8 }}><Repeat size={16} style={{ color: 'var(--text-tertiary)' }} /></button>
            </div>
          </div>

          {/* COLA DE REPRODUCCIÓN */}
          <div className="bento-card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <span className="section-header" style={{ marginBottom: 0, fontSize: 12, color: 'var(--text-primary)' }}>Cola de reproducción</span>
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)', cursor: 'pointer' }} className="hover:text-white">Borrar</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {combinedTracks.slice(0, 5).map((track, i) => (
                <div key={track.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: i === 0 ? 'var(--accent)' : 'var(--warning)', width: 16, textAlign: 'center' }}>{i + 1}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: i === 0 ? 600 : 500, color: i === 0 ? 'var(--accent)' : 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{track.title}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{track.artist}</div>
                  </div>
                  {i === 0 ? (
                    <div style={{ display: 'flex', gap: 2, alignItems: 'center', height: 12 }}>
                      <div style={{ width: 3, height: 12, background: 'var(--accent)', borderRadius: 1, animation: 'pulseGlow 1s infinite' }} />
                      <div style={{ width: 3, height: 6, background: 'var(--accent)', borderRadius: 1 }} />
                      <div style={{ width: 3, height: 10, background: 'var(--accent)', borderRadius: 1 }} />
                    </div>
                  ) : (
                    <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>{track.duration}</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* ESTADÍSTICAS DE ESCUCHA */}
          <div className="bento-card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <span className="section-header" style={{ marginBottom: 0, fontSize: 12, color: 'var(--text-primary)' }}>Estadísticas de escucha</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-tertiary)', background: 'var(--bg-deep)', padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border-subtle)' }}>
                Esta semana <ChevronDown size={12} />
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>12h 45m</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Tiempo total</div>
            </div>

            {/* Beautiful SVG Wave Chart */}
            <div style={{ width: '100%', height: 64, marginBottom: 20 }}>
              <svg viewBox="0 0 300 64" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                <defs>
                  <linearGradient id="waveGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.0" />
                  </linearGradient>
                </defs>
                <path d="M0,50 Q30,30 60,45 T120,20 T180,40 T240,15 T300,35 L300,64 L0,64 Z" fill="url(#waveGrad)" />
                <path d="M0,50 Q30,30 60,45 T120,20 T180,40 T240,15 T300,35" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" />
                <circle cx="240" cy="15" r="4" fill="var(--accent)" style={{ filter: 'drop-shadow(0 0 8px var(--accent))' }} />
              </svg>
            </div>

            {/* Micro Stats Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, borderTop: '1px solid var(--border-subtle)', paddingTop: 16 }}>
              <div style={{ textAlign: 'center', background: 'var(--bg-deep)', padding: '8px 4px', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 2 }}>Sesiones</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>8</div>
              </div>
              <div style={{ textAlign: 'center', background: 'var(--bg-deep)', padding: '8px 4px', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 2 }}>Artistas</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>4</div>
              </div>
              <div style={{ textAlign: 'center', background: 'var(--bg-deep)', padding: '8px 4px', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 2 }}>Canciones</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>35</div>
              </div>
            </div>
          </div>

        </div>

      </div>

      {/* Streaming audio element (hidden) */}
      {streamUrl && (
        <audio
          ref={currentAudioRef}
          src={streamUrl}
          autoPlay
          style={{ display: 'none' }}
          onVolumeChange={() => {}}
        />
      )}

    </div>
  );
}
