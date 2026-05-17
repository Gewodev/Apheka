import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

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
  const parts = duration.split(':').reverse();
  return parts.reduce((acc, p, i) => acc + parseInt(p) * Math.pow(60, i), 0);
}

function getThumbnail(entry: Record<string, unknown>): string {
  if (entry.thumbnail && typeof entry.thumbnail === 'string') return entry.thumbnail;
  if (entry.thumbnails && Array.isArray(entry.thumbnails) && entry.thumbnails.length > 0) {
    return (entry.thumbnails[entry.thumbnails.length - 1] as Record<string, unknown>).url as string || '';
  }
  return '';
}

// ── Commands ──

export async function streamAudioUrl(url: string): Promise<string> {
  return invoke<string>('stream_youtube_audio', { url });
}

export async function fetchMetadata(url: string): Promise<YouTubePlaylist | YouTubeMetadata> {
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
      thumbnail: getThumbnail(data),
      webpage_url: String(data.webpage_url || url),
      entries,
      playlist_count: playlistCount,
      ...data,
    } as YouTubePlaylist;
  }

  return {
    id: String(data.id || ''),
    title: String(data.title || 'Unknown'),
    thumbnail: getThumbnail(data),
    duration: parseDuration(data.duration as string | number | undefined),
    channel: String(data.channel || data.uploader || 'Unknown'),
    webpage_url: String(data.webpage_url || data.url || url),
    ...data,
  } as YouTubeMetadata;
}

export async function searchMusic(query: string): Promise<SearchResult[]> {
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
}

export async function validateUrl(url: string): Promise<YouTubePlaylist | YouTubeMetadata> {
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
): Promise<void> {
  return invoke('start_download', {
    url,
    downloadId,
    outputDir: outputDir || '',
    format,
  });
}

export async function cancelDownload(downloadId: string): Promise<void> {
  return invoke('cancel_download', { downloadId });
}

export async function getDownloadPath(): Promise<string> {
  return invoke<string>('get_download_path');
}

export async function setDownloadPath(path: string): Promise<void> {
  return invoke('set_download_path', { path });
}

export async function exportToZip(savePath: string): Promise<string> {
  return invoke<string>('export_to_zip', { savePath });
}

// ── Event listeners ──

export function onDownloadProgress(callback: (data: DownloadProgress) => void) {
  return listen<DownloadProgress>('download:progress', (event) => callback(event.payload));
}

export function onDownloadFile(callback: (data: DownloadFile) => void) {
  return listen<DownloadFile>('download:file', (event) => callback(event.payload));
}

export function onDownloadComplete(callback: (data: DownloadComplete) => void) {
  return listen<DownloadComplete>('download:complete', (event) => callback(event.payload));
}

// ── URL type detection ──

export type UrlType = 'youtube_video' | 'youtube_playlist' | 'spotify_track' | 'spotify_playlist' | 'unknown';

export function detectUrlType(url: string): UrlType {
  const trimmed = url.trim();
  const u = trimmed.toLowerCase();

  // YouTube video (watch, youtu.be, shorts, embed, m.youtube, music.youtube)
  if (
    /(?:www\.|m\.|music\.)?youtube\.com\/watch\?v=/i.test(u) ||
    /youtu\.be\//i.test(u) ||
    /(?:www\.|m\.)?youtube\.com\/shorts\//i.test(u) ||
    /(?:www\.)?youtube\.com\/embed\//i.test(u)
  ) {
    return 'youtube_video';
  }

  // YouTube playlist
  if (
    /(?:www\.|m\.|music\.)?youtube\.com\/playlist\?list=/i.test(u)
  ) {
    return 'youtube_playlist';
  }

  // Spotify track
  if (/open\.spotify\.com\/track\//i.test(u)) {
    return 'spotify_track';
  }

  // Spotify playlist / album
  if (
    /open\.spotify\.com\/playlist\//i.test(u) ||
    /open\.spotify\.com\/album\//i.test(u)
  ) {
    return 'spotify_playlist';
  }

  // If it contains youtube.com or youtu.be at all, treat as youtube
  if (/(?:www\.|m\.|music\.)?youtube\.com/i.test(u) || /youtu\.be/i.test(u)) {
    return 'youtube_video';
  }

  return 'unknown';
}

export function generateDownloadId(): string {
  return `dl_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}
