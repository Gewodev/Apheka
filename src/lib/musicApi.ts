import { invoke, isTauri } from './tauri';

// ── Re-export for convenience ──
export { isTauri };

// ── Types ──

export interface YouTubeMetadata {
  id: string;
  title: string;
  thumbnail: string;
  duration: number;
  channel: string;
  webpage_url: string;
  playlist?: string;
  playlist_index?: number;
  playlist_count?: number;
  [key: string]: unknown;
}

export interface YouTubePlaylist {
  id: string;
  title: string;
  channel: string;
  thumbnail: string;
  webpage_url: string;
  entries: YouTubeMetadata[];
  playlist_count: number;
  [key: string]: unknown;
}

export interface DownloadProgress {
  downloadId: string;
  progress: number;
  line: string;
}

export interface DownloadFile {
  downloadId: string;
  file: string;
  type: string;
}

export interface DownloadComplete {
  downloadId: string;
  success: boolean;
  code: number | null;
  errorMessage?: string;
}

export interface SearchResult {
  id: string;
  title: string;
  channel: string;
  duration: number;
  thumbnail: string;
  webpage_url: string;
  [key: string]: unknown;
}

// ── Helpers ──

function parseDuration(duration: string | number | undefined): number {
  if (!duration) return 0;
  if (typeof duration === 'number') return duration;
  if (/^\d+$/.test(duration)) return parseInt(duration, 10);
  const parts = duration.split(':').map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parseInt(duration, 10) || 0;
}

function getThumbnail(data: Record<string, unknown>): string {
  if (typeof data.thumbnail === 'string') return data.thumbnail;
  if (data.thumbnails && Array.isArray(data.thumbnails)) {
    const thumbs = data.thumbnails as Record<string, unknown>[];
    const sorted = thumbs
      .filter(t => typeof t.url === 'string')
      .sort((a, b) => ((b.height as number) || 0) - ((a.height as number) || 0));
    if (sorted.length > 0) return String(sorted[0].url);
  }
  return '';
}

const API_KEY = import.meta.env.VITE_GOOGLE_API_KEY || '';

async function webSearchMusic(query: string): Promise<SearchResult[]> {
  if (!API_KEY) {
    console.warn('[webSearchMusic] No API key (VITE_GOOGLE_API_KEY)');
    return [];
  }
  const tryFetch = async (url: string): Promise<SearchResult[]> => {
    const r = await fetch(url);
    if (!r.ok) {
      const errorText = await r.text().catch(() => 'unknown error');
      console.warn(`[webSearchMusic] HTTP ${r.status}: ${errorText}`);
      return [];
    }
    const data = await r.json();
    if (data.error) {
      console.warn('[webSearchMusic] API error:', data.error);
      return [];
    }
    return (data.items || []).map((item: any) => ({
      id: item.id?.videoId || '',
      title: item.snippet?.title || 'Unknown',
      channel: item.snippet?.channelTitle || 'Unknown',
      duration: 0,
      thumbnail: item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.default?.url || '',
      webpage_url: `https://www.youtube.com/watch?v=${item.id?.videoId}`,
    }));
  };
  try {
    const results = await tryFetch(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoCategoryId=10&maxResults=20&q=${encodeURIComponent(query)}&key=${API_KEY}`
    );
    if (results.length > 0) return results;
  } catch (e) {
    console.warn('[webSearchMusic] First attempt failed, trying without category filter:', e);
  }
  try {
    return await tryFetch(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=20&q=${encodeURIComponent(query)}&key=${API_KEY}`
    );
  } catch (e) {
    console.warn('[webSearchMusic] All attempts failed:', e);
    return [];
  }
}

async function webStreamUrl(videoId: string): Promise<string> {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

// Web download using multiple free conversion APIs
async function webDownloadAudio(downloadId: string, ytUrl: string, format: string): Promise<void> {
  const match = ytUrl.match(/(?:v=|youtu\.be\/)([\w-]{11})/);
  if (!match) throw new Error('URL de YouTube inválida');
  const videoId = match[1];

  // 1) Try Cobalt API (api.cobalt.tools)
  try {
    const resp = await fetch('https://api.cobalt.tools/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({
        url: ytUrl,
        videoQuality: 'max',
        audioFormat: format === 'mp3' ? 'mp3' : 'aac',
        filenameStyle: 'basic',
      }),
    });
    if (resp.ok) {
      const data = await resp.json();
      if (data.url) {
        const a = document.createElement('a');
        a.href = data.url;
        a.download = `audio.${format}`;
        a.click();
        return;
      }
    }
  } catch { /* try next */ }

  // 2) Try direct download via y2mate API
  try {
    const resp = await fetch('https://www.y2mate.com/mates/en676/analyzeV2/ajax', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ k_query: ytUrl, k_page: 'home', hl: 'en', q_auto: '0' }),
    });
    if (resp.ok) {
      const data = await resp.json();
      if (data?.links?.mp3?.['mp3128']?.url || data?.links?.mp4?.['mp4']?.url) {
        const dlUrl = data.links.mp3['mp3128']?.url || data.links.mp4['mp4']?.url;
        window.open(dlUrl, '_blank');
        return;
      }
    }
  } catch { /* try next */ }

  // 3) Try loadingfem using public API
  try {
    const resp = await fetch(`https://yt-downloader-xi-six.vercel.app/api/download?url=${ytUrl}&format=${format}`, {
      method: 'GET',
    });
    if (resp.ok) {
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${videoId}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
      return;
    }
  } catch { /* try next */ }

  throw new Error('web-download-unavailable');
}

// ── Commands ──

export async function streamAudioUrl(url: string): Promise<string> {
  if (!isTauri()) {
    const match = url.match(/(?:v=|youtu\.be\/)([\w-]{11})/);
    if (match) return webStreamUrl(match[1]);
    throw new Error('Streaming requires Tauri desktop app');
  }
  return invoke<string>('stream_youtube_audio', { url });
}

export async function fetchMetadata(url: string): Promise<YouTubePlaylist | YouTubeMetadata> {
  if (!isTauri()) {
    const match = url.match(/(?:v=|youtu\.be\/)([\w-]{11})/);
    if (match) {
      const results = await webSearchMusic(match[1]);
      if (results.length > 0) {
        return {
          id: results[0].id,
          title: results[0].title,
          thumbnail: results[0].thumbnail,
          duration: results[0].duration,
          channel: results[0].channel,
          webpage_url: results[0].webpage_url,
        } as YouTubeMetadata;
      }
    }
    throw new Error('Metadata fetch requires Tauri desktop app');
  }
  const raw = await invoke<string>('get_youtube_metadata', { url });
  const data: Record<string, unknown> = JSON.parse(raw);

  if (data.entries) {
    const rawEntries = data.entries as Record<string, unknown>[];
    const playlistCount = Number(data.playlist_count) || rawEntries.length;
    const entries: YouTubeMetadata[] = rawEntries.map(e => ({
      id: String(e.id || ''),
      title: String(e.title || 'Unknown'),
      thumbnail: getThumbnail(e),
      duration: parseDuration(e.duration as string | number | undefined),
      channel: String(e.channel || e.uploader || 'Unknown'),
      webpage_url: String(e.webpage_url || e.url || ''),
      playlist: String(data.title || ''),
      playlist_index: Number(e.playlist_index) || 0,
      playlist_count: playlistCount,
      ...e,
    }));

    return {
      id: String(data.id || ''),
      title: String(data.title || 'Playlist'),
      channel: String(data.channel || data.uploader || 'Unknown'),
      thumbnail: getThumbnail(data as Record<string, unknown>),
      webpage_url: String(data.webpage_url || url),
      entries,
      playlist_count: playlistCount,
      ...(data as Record<string, unknown>),
    } as YouTubePlaylist;
  }

  return {
    id: String(data.id || ''),
    title: String(data.title || 'Unknown'),
    thumbnail: getThumbnail(data as Record<string, unknown>),
    duration: parseDuration(data.duration as string | number | undefined),
    channel: String(data.channel || data.uploader || 'Unknown'),
    webpage_url: String(data.webpage_url || data.url || url),
    ...(data as Record<string, unknown>),
  } as YouTubeMetadata;
}

export async function searchMusic(query: string): Promise<SearchResult[]> {
  if (!isTauri()) return webSearchMusic(query);
  try {
    const raw = await invoke<string>('search_youtube', { query });
    const data = JSON.parse(raw);
    if (!data.entries) return [];
    return (data.entries as Record<string, unknown>[]).map(e => ({
      id: String(e.id || ''),
      title: String(e.title || 'Unknown'),
      channel: String(e.channel || e.uploader || 'Unknown'),
      duration: parseDuration(e.duration as string | number | undefined),
      thumbnail: getThumbnail(e),
      webpage_url: String(e.webpage_url || e.url || ''),
      ...e,
    })) as SearchResult[];
  } catch (e) {
    console.warn('[searchMusic] Rust backend failed, falling back to web API:', e);
    return webSearchMusic(query);
  }
}

export async function validateUrl(url: string): Promise<YouTubePlaylist | YouTubeMetadata> {
  if (!isTauri()) {
    return fetchMetadata(url);
  }
  const raw = await invoke<string>('validate_url', { url });
  const data = JSON.parse(raw);

  if (data.entries) {
    const entries = (data.entries as Record<string, unknown>[]).map(e => ({
      id: String(e.id || ''),
      title: String(e.title || 'Unknown'),
      thumbnail: getThumbnail(e),
      duration: parseDuration(e.duration as string | number | undefined),
      channel: String(e.channel || e.uploader || 'Unknown'),
      webpage_url: String(e.webpage_url || e.url || ''),
      ...e,
    }));

    return {
      id: String(data.id || ''),
      title: String(data.title || 'Playlist'),
      channel: String(data.channel || data.uploader || 'Unknown'),
      thumbnail: getThumbnail(data as Record<string, unknown>),
      webpage_url: String(data.webpage_url || url),
      entries,
      playlist_count: Number(data.playlist_count) || entries.length,
      ...(data as Record<string, unknown>),
    } as YouTubePlaylist;
  }

  return {
    id: String(data.id || ''),
    title: String(data.title || 'Unknown'),
    thumbnail: getThumbnail(data as Record<string, unknown>),
    duration: parseDuration(data.duration as string | number | undefined),
    channel: String(data.channel || data.uploader || 'Unknown'),
    webpage_url: String(data.webpage_url || data.url || url),
    ...(data as Record<string, unknown>),
  } as YouTubeMetadata;
}

export async function startDownload(
  url: string,
  downloadId: string,
  outputDir?: string,
  format: string = 'mp3',
  includeCover: boolean = true,
): Promise<void> {
  if (!isTauri()) {
    return webDownloadAudio(downloadId, url, format);
  }
  return invoke('start_download', {
    url, downloadId,
    outputDir: outputDir || '',
    format,
    includeCover,
  });
}

export async function cancelDownload(downloadId: string): Promise<void> {
  if (!isTauri()) return;
  return invoke('cancel_download', { downloadId });
}

export async function getDownloadPath(): Promise<string> {
  if (!isTauri()) return '';
  return invoke<string>('get_download_path');
}

export async function setDownloadPath(path: string): Promise<void> {
  if (!isTauri()) return;
  return invoke('set_download_path', { path });
}

export async function extractZip(zipPath: string): Promise<boolean> {
  if (!isTauri()) return false;
  try {
    await invoke('extract_download_zip', { path: zipPath });
    return true;
  } catch { return false; }
}

// Event listeners
export function onDownloadProgress(cb: (data: DownloadProgress) => void): Promise<() => void> {
  if (!isTauri()) {
    return Promise.resolve(() => {});
  }
  return import('@tauri-apps/api/event').then(m => m.listen<DownloadProgress>('download:progress', e => cb(e.payload)));
}

export function onDownloadFile(cb: (data: DownloadFile) => void): Promise<() => void> {
  if (!isTauri()) return Promise.resolve(() => {});
  return import('@tauri-apps/api/event').then(m => m.listen<DownloadFile>('download:file', e => cb(e.payload)));
}

export function onDownloadComplete(cb: (data: DownloadComplete) => void): Promise<() => void> {
  if (!isTauri()) {
    return Promise.resolve(() => {});
  }
  return import('@tauri-apps/api/event').then(m => m.listen<DownloadComplete>('download:complete', e => cb(e.payload)));
}

// Format helpers
export function detectUrlType(url: string): 'youtube' | 'spotify' | 'other' {
  if (/youtube\.com|youtu\.be/i.test(url)) return 'youtube';
  if (/spotify\.com/i.test(url)) return 'spotify';
  return 'other';
}

export function generateDownloadId(): string {
  return crypto.randomUUID();
}

export function formatDuration(secs: number): string {
  if (!secs || !isFinite(secs)) return '0:00';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function exportToZip(savePath: string): Promise<string> {
  if (!isTauri()) return Promise.reject(new Error('ZIP requires Tauri desktop app'));
  return invoke<string>('export_to_zip', { savePath });
}
