import {musicConnection} from './musicNetwork';
import { invoke, isTauri } from './tauri';
function musicProxyArgs(){const c=musicConnection.getTransportOptions();return {proxyMode:c.mode,proxyUrl:c.mode==='custom'?c.proxyUrl:undefined};}

const mediaCache=new Map<string,{time:number;value:string}>(),mediaPending=new Map<string,Promise<string>>();
async function mediaRequest(command:string,url:string):Promise<string>{const connection=musicProxyArgs(),key=JSON.stringify([command,url,connection]),hit=mediaCache.get(key),ttl=command==='stream_youtube_audio'?30000:600000;if(hit&&Date.now()-hit.time<ttl)return hit.value;const existing=mediaPending.get(key);if(existing)return existing;const operation=invoke<string>(command,{url,...connection}).then(value=>{if(mediaCache.size>=30)mediaCache.delete(mediaCache.keys().next().value!);mediaCache.set(key,{time:Date.now(),value});return value;}).finally(()=>mediaPending.delete(key));mediaPending.set(key,operation);return operation;}

export async function downloadYtDlp(): Promise<string> {
  if (!isTauri()) throw new Error('Solo disponible en la app de escritorio');
  return invoke<string>('download_yt_dlp');
}

// ── Nuevas funciones para YouTube Music (usando yt-dlp vía main.rs) ──

export async function searchYouTubeMusic(query: string): Promise<any> {
  if (!isTauri()) return {};
  return invoke('search_youtube', { query,...musicProxyArgs() });
}

export async function getYouTubeMetadata(url: string): Promise<any> {
  if (!isTauri()) return {};
  return mediaRequest('get_youtube_metadata',url);
}

export async function streamYouTubeAudio(url: string): Promise<string> {
  if (!isTauri()) return '';
  return mediaRequest('stream_youtube_audio',url);
}

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
  url?: string;
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

async function webSearchMusic(query:string):Promise<SearchResult[]>{const {searchMusicCatalog}=await import('./youtubeMusic');const value=await searchMusicCatalog(query,'song');return value.songs.map(song=>({id:song.id,title:song.title,channel:song.artist,duration:song.duration,thumbnail:song.cover,webpage_url:'https://www.youtube.com/watch?v='+song.id}));}

async function webStreamUrl(videoId: string): Promise<string> {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

async function webDownloadAudio(_id:string,_url:string,_format:string):Promise<void>{throw Error('Descarga el audio desde APHEKA de escritorio. No se envían enlaces a conversores públicos.');}

// ── Commands ──

export async function streamAudioUrl(url: string): Promise<string> {
  if (!isTauri()) {
    const match = url.match(/(?:v=|youtu\.be\/)([\w-]{11})/);
    if (match) return webStreamUrl(match[1]);
    throw new Error('Streaming requires Tauri desktop app');
  }
  return mediaRequest('stream_youtube_audio',url);
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
  const raw = await mediaRequest('get_youtube_metadata',url);
  const data: Record<string, unknown> = JSON.parse(raw);

  if (data.entries) {
    const rawEntries = data.entries as Record<string, unknown>[];
    const playlistCount = Number(data.playlist_count) || rawEntries.length;
    const entries: YouTubeMetadata[] = rawEntries.map(e => ({
      ...e,
      id: String(e.id || ''),
      title: String(e.title || 'Sin título'),
      thumbnail: getThumbnail(e),
      duration: parseDuration(e.duration as string | number | undefined),
      channel: String(e.channel || e.uploader || 'Fuente externa'),
      webpage_url: String(e.webpage_url || e.url || ''),
      playlist: String(data.title || ''),
      playlist_index: Number(e.playlist_index) || 0,
      playlist_count: playlistCount,
    }));

    return {
      ...(data as Record<string, unknown>),
      id: String(data.id || ''),
      title: String(data.title || 'Playlist'),
      channel: String(data.channel || data.uploader || 'Fuente externa'),
      thumbnail: getThumbnail(data as Record<string, unknown>),
      webpage_url: String(data.webpage_url || url),
      entries,
      playlist_count: playlistCount,
    } as YouTubePlaylist;
  }

  return {
    ...(data as Record<string, unknown>),
    id: String(data.id || ''),
    title: String(data.title || 'Sin título'),
    thumbnail: getThumbnail(data as Record<string, unknown>),
    duration: parseDuration(data.duration as string | number | undefined),
    channel: String(data.channel || data.uploader || 'Fuente externa'),
    webpage_url: String(data.webpage_url || data.url || url),
  } as YouTubeMetadata;
}

export async function searchMusic(query:string):Promise<SearchResult[]>{return webSearchMusic(query);}

export async function validateUrl(url: string): Promise<YouTubePlaylist | YouTubeMetadata> {
  if (!isTauri()) {
    return fetchMetadata(url);
  }
  const raw = await mediaRequest('validate_url',url);
  const data = JSON.parse(raw);

  if (data.entries) {
    const entries = (data.entries as Record<string, unknown>[]).filter(e=>e&&typeof e==='object').map(e => ({
      ...e,
      id: String(e.id || ''),
      title: String(e.title || 'Sin título'),
      thumbnail: getThumbnail(e),
      duration: parseDuration(e.duration as string | number | undefined),
      channel: String(e.channel || e.uploader || 'Fuente externa'),
      webpage_url: String(e.webpage_url || e.url || ''),
    }));

    return {
      ...(data as Record<string, unknown>),
      id: String(data.id || ''),
      title: String(data.title || 'Playlist'),
      channel: String(data.channel || data.uploader || 'Fuente externa'),
      thumbnail: getThumbnail(data as Record<string, unknown>),
      webpage_url: String(data.webpage_url || url),
      entries,
      playlist_count: Number(data.playlist_count) || entries.length,
    } as YouTubePlaylist;
  }

  return {
    ...(data as Record<string, unknown>),
    id: String(data.id || ''),
    title: String(data.title || 'Sin título'),
    thumbnail: getThumbnail(data as Record<string, unknown>),
    duration: parseDuration(data.duration as string | number | undefined),
    channel: String(data.channel || data.uploader || 'Fuente externa'),
    webpage_url: String(data.webpage_url || data.url || url),
  } as YouTubeMetadata;
}

export async function startDownload(
  url: string,
  downloadId: string,
  outputDir?: string,
  format: string = 'mp3',
  includeCover: boolean = true,
  audioQuality: string = '3',
  videoQuality: string = '1080',
): Promise<void> {
  if (!isTauri()) {
    return webDownloadAudio(downloadId, url, format);
  }
  return invoke('start_download', {
    url, downloadId,videoQuality,...musicProxyArgs(),
    outputDir: outputDir || '',
    format,
    includeCover,
    audioQuality,
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
