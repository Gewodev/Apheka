import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Play, Pause, SkipBack, SkipForward, Volume2, Search,
  Music, Download, Trash2, X, ListMusic, Upload,
  Link, Globe, Loader, CheckCircle, AlertCircle,
  ArrowLeft, ArrowRight, ChevronDown, ChevronUp,
  ExternalLink, FolderOpen, Plus,
  Disc3, Activity, Heart, Copy, Clock,
  User,
} from 'lucide-react';
import { useApp } from '../../store/AppContext';
import toast from 'react-hot-toast';
import { open, save } from '@tauri-apps/plugin-dialog';
import {
  fetchMetadata, searchMusic, startDownload, cancelDownload,
  streamAudioUrl, getDownloadPath, setDownloadPath,
  onDownloadProgress, onDownloadComplete, onDownloadFile,
  detectUrlType, generateDownloadId, formatDuration, validateUrl,
  exportToZip,
  type YouTubePlaylist, type YouTubeMetadata, type SearchResult,
  type DownloadProgress, type DownloadComplete,
} from '../../lib/musicApi';

type TabId = 'explorar' | 'descargas' | 'biblioteca' | 'me_gusta' | 'playlist';

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

  const [activeTab, setActiveTab] = useState<TabId>('explorar');
  const [url, setUrl] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [preview, setPreview] = useState<YouTubePlaylist | YouTubeMetadata | null>(null);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [downloadPath, setDownloadPathState] = useState('');
  const [audioFormat, setAudioFormat] = useState<'mp3' | 'm4a'>('mp3');
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);
  const [showSearch, setShowSearch] = useState(false);

  const urlInputRef = useRef<HTMLInputElement>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);

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

  const currentTrack = tracks.find(t => t.id === currentTrackId);
  const activeDownloads = downloadQueue.filter(d => d.status === 'downloading' || d.status === 'queued');
  const completedDownloads = downloadQueue.filter(d => d.status === 'completed');

  return (
    <div style={{ display: 'flex', height: '100%', background: 'var(--bg-base)', overflow: 'hidden' }}>
      {/* Sidebar */}
      <aside style={{ width: 240, background: '#000000', display: 'flex', flexDirection: 'column', padding: '12px 8px', gap: 8 }}>
        
        {/* Top Navigation Block */}
        <div style={{ background: 'var(--bg-elevated)', borderRadius: 8, padding: '12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <button onClick={() => { setActiveTab('biblioteca'); setSelectedPlaylistId(null); }} className="nav-btn" style={{ background: activeTab === 'biblioteca' ? 'rgba(255,255,255,0.1)' : 'transparent', color: activeTab === 'biblioteca' ? '#fff' : 'var(--text-secondary)' }}>
            <ListMusic size={18} />
            <span style={{ fontWeight: 600 }}>Tu Biblioteca</span>
          </button>
          <button onClick={() => setActiveTab('explorar')} className="nav-btn" style={{ background: activeTab === 'explorar' ? 'rgba(255,255,255,0.1)' : 'transparent', color: activeTab === 'explorar' ? '#fff' : 'var(--text-secondary)' }}>
            <Search size={18} />
            <span style={{ fontWeight: 600 }}>Explorar</span>
          </button>
        </div>

        {/* Library Block */}
        <div style={{ background: 'var(--bg-elevated)', borderRadius: 8, flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>Colección</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setActiveTab('descargas')} className="btn-ghost" style={{ padding: 4, position: 'relative' }} title="Descargas">
                <Download size={16} />
                {activeDownloads.length > 0 && <div style={{ position: 'absolute', top: 0, right: 0, width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)' }} />}
              </button>
              <button onClick={() => addPlaylist({ name: 'Nueva Playlist', trackIds: [] })} className="btn-ghost" style={{ padding: 4 }} title="Crear Playlist">
                <Plus size={16} />
              </button>
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px 8px' }}>
            {/* Me Gusta */}
            <div
              onClick={() => setActiveTab('me_gusta')}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '8px', borderRadius: 6,
                cursor: 'pointer', marginBottom: 2,
                background: activeTab === 'me_gusta' ? 'rgba(255,255,255,0.1)' : 'transparent',
                transition: 'all 200ms',
              }}
            >
              <div style={{ width: 44, height: 44, borderRadius: 4, background: 'linear-gradient(135deg, #450af5, #c4efd9)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Heart size={20} fill="#fff" color="#fff" />
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: activeTab === 'me_gusta' ? '#fff' : 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Tus me gusta</div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Playlist • {tracks.filter(t => t.isFavorite).length} canciones</div>
              </div>
            </div>

            {/* Playlists */}
            {playlists.map(p => (
              <div
                key={p.id}
                onClick={() => { setSelectedPlaylistId(p.id); setActiveTab('playlist'); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '8px', borderRadius: 6,
                  cursor: 'pointer', marginBottom: 2,
                  background: activeTab === 'playlist' && selectedPlaylistId === p.id ? 'rgba(255,255,255,0.1)' : 'transparent',
                  transition: 'all 200ms',
                }}
              >
                <div style={{ width: 44, height: 44, borderRadius: 4, background: 'var(--bg-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Music size={20} style={{ color: 'var(--text-muted)' }} />
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: activeTab === 'playlist' && selectedPlaylistId === p.id ? '#fff' : 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Playlist • OWA</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Mini Player inside sidebar */}
        {currentTrack && (
          <div style={{ padding: '12px', background: 'var(--bg-elevated)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 4, background: 'var(--bg-surface)', flexShrink: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {currentTrack.coverImage ? <img src={currentTrack.coverImage} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Music size={16} color="var(--text-muted)" />}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{currentTrack.title}</div>
              <div style={{ fontSize: 10, color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{currentTrack.artist}</div>
            </div>
          </div>
        )}
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* ─── TAB: EXPLORAR ─── */}
        {activeTab === 'explorar' && (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* URL Input */}
            <div style={{ padding: '16px 24px', background: 'linear-gradient(180deg, #0d0d12 0%, #14141e 100%)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-default)', borderRadius: 8, padding: '0 12px', transition: 'all 200ms' }}>
                  <Link size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                  <input
                    ref={urlInputRef}
                    type="text"
                    value={url}
                    onChange={e => setUrl(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Pega un enlace de YouTube o Spotify..."
                    className="input-base"
                    style={{ border: 'none', background: 'transparent', height: 40, padding: 0, fontSize: 13 }}
                  />
                  {url && (
                    <button onClick={() => setUrl('')} className="btn-ghost" style={{ padding: 4, flexShrink: 0 }}>
                      <X size={14} />
                    </button>
                  )}
                </div>
                <button onClick={handleUrlSubmit} className="btn-primary" style={{ height: 40, padding: '0 20px', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }} disabled={isLoading}>
                  {isLoading ? <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Search size={14} />}
                  Analizar
                </button>
                <button
                  onClick={() => setShowSearch(!showSearch)}
                  className="btn-secondary"
                  style={{ height: 40, padding: '0 14px', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}
                >
                  <Search size={14} />
                  Buscar
                </button>
              </div>

              {/* Search bar */}
              {showSearch && (
                <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-default)', borderRadius: 8, padding: '0 12px' }}>
                    <Search size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Busca canciones en YouTube..."
                      className="input-base"
                      style={{ border: 'none', background: 'transparent', height: 38, padding: 0, fontSize: 13 }}
                    />
                  </div>
                  <button onClick={handleSearch} className="btn-primary" style={{ height: 38, padding: '0 16px', display: 'flex', alignItems: 'center', gap: 6 }} disabled={isLoading}>
                    {isLoading ? <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Search size={14} />}
                  </button>
                </div>
              )}

              {/* Format selector + download path */}
              <div style={{ display: 'flex', gap: 12, marginTop: 10, alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', marginRight: 6 }}>Formato:</span>
                  {(['mp3', 'm4a'] as const).map(f => (
                    <button
                      key={f}
                      onClick={() => setAudioFormat(f)}
                      style={{
                        padding: '3px 10px', borderRadius: 6, fontSize: 10, fontWeight: 600, textTransform: 'uppercase',
                        background: audioFormat === f ? 'var(--accent)' : 'rgba(255,255,255,0.04)',
                        color: audioFormat === f ? '#fff' : 'var(--text-tertiary)',
                        border: 'none', cursor: 'pointer', transition: 'all 200ms', letterSpacing: '0.04em',
                      }}
                    >{f}</button>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 4, alignItems: 'center', flex: 1 }}>
                  <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', marginRight: 6 }}>Destino:</span>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{downloadPath || 'Descargas/OWA Music'}</span>
                    <button
                      onClick={async () => {
                        try {
                          const folder = await open({ directory: true, multiple: false, title: 'Carpeta de descargas' });
                          if (folder) {
                            setDownloadPathState(String(folder));
                            await setDownloadPath(String(folder));
                            toast.success('Carpeta de descarga actualizada');
                          }
                        } catch (e) { console.error(e); toast.error('No se pudo cambiar la carpeta'); }
                      }}
                    className="btn-ghost" style={{ padding: 4, display: 'flex' }}
                  >
                    <FolderOpen size={13} />
                  </button>
                </div>
              </div>
            </div>

            {/* Content area */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
              {/* Loading */}
              {isLoading && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 0', gap: 12 }}>
                  <Loader size={28} style={{ animation: 'spin 1s linear infinite', color: 'var(--accent)' }} />
                  <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Analizando...</span>
                </div>
              )}

              {/* Search results */}
              {searchResults.length > 0 && !isLoading && (
                <div>
                  <div style={{ fontSize: 9, fontWeight: 500, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
                    Resultados de búsqueda
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {searchResults.map((r, i) => (
                      <div
                        key={`${r.id}-${i}`}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px',
                          borderRadius: 8, cursor: 'pointer', transition: 'all 200ms',
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                        onMouseLeave={e => e.currentTarget.style.background = ''}
                      >
                        <div style={{ width: 44, height: 32, borderRadius: 4, background: 'var(--bg-elevated)', flexShrink: 0, overflow: 'hidden' }}>
                          {r.thumbnail ? <img src={r.thumbnail} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Music size={14} style={{ color: 'var(--text-muted)' }} /></div>}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</div>
                          <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{r.channel} · {formatDuration(r.duration)}</div>
                        </div>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button onClick={() => handleStream(r)} className="btn-ghost" style={{ padding: 6, borderRadius: 6, display: 'flex' }} title="Reproducir">
                            <Play size={13} />
                          </button>
                          <button onClick={() => handleDownloadOne(r)} className="btn-ghost" style={{ padding: 6, borderRadius: 6, display: 'flex' }} title="Descargar">
                            <Download size={13} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Preview */}
              {preview && !isLoading && (
                <div>
                  {/* Hero */}
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 20, padding: '8px 0 20px' }}>
                    <div style={{ width: 140, height: 140, borderRadius: 8, background: 'linear-gradient(135deg, var(--accent), #8B1A3B)', flexShrink: 0, overflow: 'hidden' }}>
                      {preview.thumbnail ? (
                        <img src={preview.thumbnail} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Music size={56} style={{ color: 'rgba(255,255,255,0.3)' }} />
                        </div>
                      )}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 9, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6, color: 'var(--text-tertiary)' }}>
                        {isPlaylist(preview) ? 'Playlist' : 'Video'}
                      </div>
                      <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>{preview.title || 'Sin título'}</h1>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>{preview.channel}</div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        {isPlaylist(preview) && (
                          <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{preview.entries.length} canciones</span>
                        )}
                        <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>·</span>
                        <a href={preview.webpage_url} target="_blank" rel="noreferrer" style={{ fontSize: 10, color: 'var(--accent)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <ExternalLink size={10} /> Abrir en YouTube
                        </a>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                    <button onClick={handleDownloadAll} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
                      <Download size={14} /> {isPlaylist(preview) ? 'Descargar todo' : 'Descargar'}
                    </button>
                    <button onClick={handleSelectForLibrary} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
                      <ListMusic size={14} /> Añadir a biblioteca
                    </button>
                  </div>

                  {/* Track list */}
                  {isPlaylist(preview) && preview.entries.length > 0 && (
                    <div>
                      <div style={{ display: 'grid', gridTemplateColumns: '24px 1fr 70px 70px', padding: '6px 10px', borderBottom: '1px solid var(--border-subtle)', fontSize: 9, fontWeight: 500, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                        <span>#</span>
                        <span>Título</span>
                        <span style={{ textAlign: 'right' }}>Duración</span>
                        <span style={{ textAlign: 'center' }}>Acción</span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {preview.entries.map((entry: YouTubeMetadata, i: number) => (
                          <div
                            key={`${entry.id}-${i}`}
                            style={{
                              display: 'grid', gridTemplateColumns: '24px 1fr 70px 70px', padding: '6px 10px',
                              borderRadius: 6, alignItems: 'center', cursor: 'pointer', transition: 'all 200ms',
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                            onMouseLeave={e => e.currentTarget.style.background = ''}
                          >
                            <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{i + 1}</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                              <div style={{ width: 32, height: 24, borderRadius: 3, background: 'var(--bg-elevated)', flexShrink: 0, overflow: 'hidden' }}>
                                {entry.thumbnail ? <img src={entry.thumbnail} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Music size={10} style={{ color: 'var(--text-muted)' }} /></div>}
                              </div>
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.title}</div>
                                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.channel}</div>
                              </div>
                            </div>
                            <div style={{ textAlign: 'right', fontSize: 10, color: 'var(--text-tertiary)' }}>{formatDuration(entry.duration)}</div>
                            <div style={{ display: 'flex', justifyContent: 'center', gap: 2 }}>
                              <button onClick={() => handleStream(entry)} className="btn-ghost" style={{ padding: 4, borderRadius: 4, display: 'flex' }} title="Reproducir"><Play size={12} /></button>
                              <button onClick={() => handleDownloadOne(entry)} className="btn-ghost" style={{ padding: 4, borderRadius: 4, display: 'flex' }} title="Descargar"><Download size={12} /></button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Empty state */}
              {!preview && searchResults.length === 0 && !isLoading && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 0', color: 'var(--text-muted)' }}>
                  <Disc3 size={48} style={{ opacity: 0.1, marginBottom: 20 }} />
                  <h2 style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-tertiary)', marginBottom: 4 }}>¿Qué quieres escuchar?</h2>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', maxWidth: 320 }}>
                    Pega un enlace de YouTube o Spotify arriba, o busca canciones para empezar.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── TAB: DESCARGAS ─── */}
        {activeTab === 'descargas' && (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(180deg, #0d0d12 0%, #14141e 100%)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>Descargas</h2>
                <p style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                  {activeDownloads.length > 0 ? `${activeDownloads.length} activa(s)` : 'Sin descargas activas'}
                  {completedDownloads.length > 0 && ` · ${completedDownloads.length} completa(s)`}
                </p>
              </div>
              {completedDownloads.length > 0 && (
                <button onClick={clearCompletedDownloads} className="btn-ghost" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, padding: '6px 10px' }}>
                  <Trash2 size={13} /> Limpiar completadas
                </button>
              )}
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
              {downloadQueue.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
                  <Download size={40} style={{ opacity: 0.1, marginBottom: 16 }} />
                  <h3 style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-tertiary)', marginBottom: 4 }}>Cola vacía</h3>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>Las descargas aparecerán aquí</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {downloadQueue.map(item => (
                    <div
                      key={item.id}
                      className="bento-card"
                      style={{
                        padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14,
                        opacity: item.status === 'completed' ? 0.6 : 1,
                      }}
                    >
                      <div style={{ width: 40, height: 40, borderRadius: 6, background: 'var(--bg-base)', flexShrink: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {item.thumbnail ? (
                          <img src={item.thumbnail} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : item.status === 'completed' ? (
                          <CheckCircle size={18} style={{ color: 'var(--success)' }} />
                        ) : item.status === 'error' ? (
                          <AlertCircle size={18} style={{ color: 'var(--error)' }} />
                        ) : item.status === 'cancelled' ? (
                          <X size={18} style={{ color: 'var(--text-tertiary)' }} />
                        ) : (
                          <Music size={18} style={{ color: 'var(--text-muted)' }} />
                        )}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 6 }}>{item.artist}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div className="progress-track" style={{ flex: 1, height: 3 }}>
                            <div
                              className="progress-fill"
                              style={{
                                width: `${item.progress * 100}%`,
                                background: item.status === 'completed' ? 'var(--success)' : item.status === 'error' ? 'var(--error)' : 'var(--accent)',
                              }}
                            />
                          </div>
                          <span style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-tertiary)', whiteSpace: 'nowrap', minWidth: 32, textAlign: 'right' }}>
                            {item.status === 'downloading' ? `${Math.round(item.progress * 100)}%` : item.status === 'queued' ? 'Espera' : item.status === 'completed' ? '100%' : item.status}
                          </span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                        {(item.status === 'downloading' || item.status === 'queued') && (
                          <button onClick={() => handleCancelDownload(item.id)} className="btn-ghost" style={{ padding: 6, borderRadius: 6, display: 'flex' }} title="Cancelar">
                            <X size={14} style={{ color: 'var(--text-tertiary)' }} />
                          </button>
                        )}
                        {(item.status === 'completed' || item.status === 'error' || item.status === 'cancelled') && (
                          <button onClick={() => removeFromDownloadQueue(item.id)} className="btn-ghost" style={{ padding: 6, borderRadius: 6, display: 'flex' }} title="Eliminar">
                            <Trash2 size={14} style={{ color: 'var(--text-tertiary)' }} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── TAB: BIBLIOTECA / ME_GUSTA / PLAYLIST ─── */}
        {(activeTab === 'biblioteca' || activeTab === 'me_gusta' || activeTab === 'playlist') && (() => {
          const isPlaylistView = activeTab === 'playlist' && selectedPlaylist;
          const isMeGusta = activeTab === 'me_gusta';
          
          const viewTitle = isPlaylistView ? selectedPlaylist!.name : isMeGusta ? 'Tus me gusta' : 'Tu Biblioteca';
          const viewTracks = isPlaylistView ? tracks.filter(t => selectedPlaylist!.trackIds.includes(t.id)) : isMeGusta ? tracks.filter(t => t.isFavorite) : tracks;
          const viewIcon = isMeGusta ? <Heart size={64} fill="#fff" color="#fff" /> : <ListMusic size={64} style={{ color: 'rgba(255,255,255,0.3)' }} />;
          const viewBg = isMeGusta ? 'linear-gradient(135deg, #450af5, #c4efd9)' : 'linear-gradient(135deg, var(--accent), var(--bg-elevated))';
          const heroBg = isMeGusta ? 'linear-gradient(135deg, #450af5 0%, #0d0d12 80%)' : 'linear-gradient(135deg, var(--accent) 0%, #0d0d12 80%)';

          return (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <>
                {/* Spotify-style gradient hero */}
                <div style={{
                  padding: '24px 32px',
                  display: 'flex', alignItems: 'flex-end', gap: 24,
                  background: heroBg,
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                  flexShrink: 0,
                }}>
                  <div style={{
                    width: 192, height: 192, borderRadius: 8,
                    background: viewBg,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0, boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                  }}>
                    {viewIcon}
                  </div>
                  <div style={{ flex: 1, paddingBottom: 8 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8, color: 'rgba(255,255,255,0.6)' }}>
                      {isPlaylistView ? 'Playlist' : isMeGusta ? 'Playlist' : 'Colección'}
                    </div>
                    <h1 style={{ fontSize: 28, fontWeight: 600, color: '#fff', marginBottom: 8, lineHeight: 1, letterSpacing: '-0.02em' }}>{viewTitle}</h1>
                    <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 500, marginTop: 16 }}>
                      <span style={{ color: '#fff', fontWeight: 600 }}>OWA Studio</span>
                      <span>•</span>
                      <span>{viewTracks.length} canciones</span>
                      {viewTracks.length > 0 && (
                        <>
                          <span>•</span>
                          <span>{formatTime(viewTracks.reduce((sum, t) => sum + (t.duration || 0), 0))}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Action buttons */}
                <div style={{
                  padding: '24px 32px',
                  display: 'flex', gap: 24, alignItems: 'center',
                  background: 'linear-gradient(180deg, rgba(0,0,0,0.4) 0%, transparent 100%)',
                  flexShrink: 0,
                }}>
                  <button
                    onClick={() => {
                      if (viewTracks.length > 0) playTrack(viewTracks[0].id);
                    }}
                    style={{
                      width: 56, height: 56, borderRadius: '50%', background: 'var(--accent)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      border: 'none', cursor: 'pointer', boxShadow: '0 8px 16px rgba(0,0,0,0.3)'
                    }}
                    className="hover-lift"
                  >
                    <Play size={24} fill="#000" color="#000" style={{ marginLeft: 4 }} />
                  </button>
                  <button
                    onClick={async () => {
                      if (viewTracks.length === 0) { toast.error('Lista vacía'); return; }
                      const dir = downloadPath;
                      for (const track of viewTracks) {
                        if (!track.url) continue;
                        const dlId = generateDownloadId();
                        const dlItemId = addToDownloadQueue({
                          title: track.title,
                          artist: track.artist,
                          url: track.url,
                          type: 'video',
                          totalItems: viewTracks.length,
                          thumbnail: track.coverImage,
                          duration: track.duration,
                        });
                        updateDownloadStatus(dlItemId, 'downloading');
                        try {
                          await startDownload(track.url, dlId, dir, audioFormat);
                        } catch {
                          updateDownloadStatus(dlItemId, 'error', 'Error al descargar');
                        }
                      }
                      toast.success(`${viewTracks.length} canción(es) añadida(s) a la cola`);
                      setActiveTab('descargas');
                    }}
                    className="btn-ghost"
                    style={{ padding: 8, color: 'rgba(255,255,255,0.6)' }}
                    title="Descargar todo"
                  >
                    <Download size={24} />
                  </button>
                  <button
                    onClick={async () => {
                      const result = await save({
                        filters: [{ name: 'ZIP', extensions: ['zip'] }],
                        defaultPath: 'OWA_Music_Export.zip',
                      });
                      if (!result) return;
                      const toastId = toast.loading('Creando ZIP...');
                      try {
                        const path = await exportToZip(result);
                        toast.success(`ZIP creado: ${path}`, { id: toastId });
                      } catch (e: any) {
                        toast.error(String(e), { id: toastId });
                      }
                    }}
                    className="btn-ghost"
                    style={{ padding: 8, color: 'rgba(255,255,255,0.6)' }}
                    title="Exportar como ZIP"
                  >
                    <FolderOpen size={24} />
                  </button>
                </div>

                {/* Track list */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '0 32px 80px' }}>
                  {/* Column headers */}
                  <div style={{
                    display: 'grid', gridTemplateColumns: '40px 1fr 100px 60px',
                    padding: '8px 16px', marginBottom: 12,
                    fontSize: 11, fontWeight: 500, color: 'var(--text-tertiary)',
                    borderBottom: '1px solid rgba(255,255,255,0.1)',
                    position: 'sticky', top: 0,
                    background: 'var(--bg-base)',
                    zIndex: 10,
                  }}>
                    <span style={{ textAlign: 'center' }}>#</span>
                    <span>Título</span>
                    <span style={{ textAlign: 'right', display: 'flex', justifyContent: 'flex-end' }}><Clock size={14} /></span>
                    <span></span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {viewTracks.length === 0 ? (
                      <div style={{ padding: '60px 0', textAlign: 'center', fontSize: 14, color: 'var(--text-muted)' }}>
                        <Music size={48} style={{ opacity: 0.2, margin: '0 auto 16px', display: 'block' }} />
                        Lista vacía
                        <div style={{ fontSize: 12, marginTop: 8, color: 'var(--text-tertiary)' }}>
                          Añade canciones desde Explorar
                        </div>
                      </div>
                    ) : (
                      viewTracks.map((track, i) => (
                        <div
                          key={track.id}
                          onClick={() => playTrack(track.id)}
                          style={{
                            display: 'grid', gridTemplateColumns: '40px 1fr 100px 60px',
                            padding: '8px 16px', borderRadius: 6,
                            alignItems: 'center', cursor: 'pointer',
                            transition: 'all 150ms',
                            background: track.id === currentTrackId && isPlayingMusic
                              ? 'rgba(255,255,255,0.1)'
                              : 'transparent',
                          }}
                          onMouseEnter={e => {
                            if (!(track.id === currentTrackId && isPlayingMusic)) {
                              e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                            }
                          }}
                          onMouseLeave={e => {
                            if (!(track.id === currentTrackId && isPlayingMusic)) {
                              e.currentTarget.style.background = '';
                            }
                          }}
                        >
                          <span style={{
                            color: track.id === currentTrackId ? 'var(--accent)' : 'var(--text-tertiary)',
                            fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>
                            {track.id === currentTrackId && isPlayingMusic ? (
                              <Activity size={14} style={{ color: 'var(--accent)' }} />
                            ) : (
                              i + 1
                            )}
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                            <div style={{ width: 40, height: 40, borderRadius: 4, background: 'var(--bg-surface)', flexShrink: 0, overflow: 'hidden' }}>
                              {track.coverImage ? <img src={track.coverImage} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Music size={16} color="var(--text-muted)" />}
                            </div>
                            <div style={{ minWidth: 0 }}>
                              <div style={{
                                fontSize: 14, fontWeight: 500,
                                color: track.id === currentTrackId ? 'var(--accent)' : '#fff',
                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                marginBottom: 2
                              }}>
                                {track.title}
                              </div>
                              <div style={{
                                fontSize: 12, color: 'var(--text-tertiary)',
                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                              }}>
                                {track.artist}
                              </div>
                            </div>
                          </div>
                          <div style={{ textAlign: 'right', fontSize: 12, color: 'var(--text-tertiary)' }}>
                            {formatTime(track.duration)}
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'center' }}>
                            <Heart
                              size={16}
                              style={{
                                color: track.isFavorite ? 'var(--accent)' : 'var(--text-tertiary)',
                                cursor: 'pointer',
                                transition: 'all 150ms',
                                fill: track.isFavorite ? 'var(--accent)' : 'transparent'
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleTrackFavorite(track.id);
                              }}
                            />
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </>
            </div>
          );
        })()}
      </main>

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
