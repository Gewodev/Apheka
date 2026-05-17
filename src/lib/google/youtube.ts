import { apiFetch } from './index';

interface SearchResult {
  id: { videoId: string };
  snippet: {
    title: string;
    channelTitle: string;
    thumbnails: { default: { url: string }; medium: { url: string } };
  };
}

interface SearchResponse {
  items: SearchResult[];
}

interface PlaylistItem {
  id: string;
  snippet: {
    title: string;
    resourceId: { videoId: string };
    thumbnails: { default: { url: string } };
  };
}

interface PlaylistItemsResponse {
  items: PlaylistItem[];
}

interface VideoDetails {
  id: string;
  snippet: {
    title: string;
    channelTitle: string;
    thumbnails: { default: { url: string }; medium: { url: string } };
  };
  contentDetails: { duration: string };
}

interface VideoResponse {
  items: VideoDetails[];
}

export async function searchMusic(query: string, maxResults = 10): Promise<SearchResult[]> {
  const res = await apiFetch<SearchResponse>(
    `/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=video&videoCategoryId=10&maxResults=${maxResults}`,
  );
  return res.items || [];
}

export async function getVideoDetails(videoIds: string[]): Promise<VideoDetails[]> {
  const res = await apiFetch<VideoResponse>(
    `/youtube/v3/videos?part=snippet,contentDetails&id=${videoIds.join(',')}`,
  );
  return res.items || [];
}

export async function getPlaylistItems(playlistId: string, maxResults = 50): Promise<PlaylistItem[]> {
  const res = await apiFetch<PlaylistItemsResponse>(
    `/youtube/v3/playlistItems?part=snippet&playlistId=${playlistId}&maxResults=${maxResults}`,
  );
  return res.items || [];
}

export async function searchStudyMusic(query: string): Promise<{ videoId: string; title: string; channel: string; thumbnail: string }[]> {
  const results = await searchMusic(`${query} lofi study music`, 10);
  return results.map(r => ({
    videoId: r.id.videoId,
    title: r.snippet.title,
    channel: r.snippet.channelTitle,
    thumbnail: r.snippet.thumbnails.medium?.url || r.snippet.thumbnails.default.url,
  }));
}

export async function searchEducationalContent(query: string): Promise<{ videoId: string; title: string; channel: string }[]> {
  const results = await searchMusic(`${query} educational tutorial`, 10);
  return results.map(r => ({
    videoId: r.id.videoId,
    title: r.snippet.title,
    channel: r.snippet.channelTitle,
  }));
}

const API_KEY = import.meta.env.VITE_GOOGLE_API_KEY || '';

interface VideoSearchResult {
  id: { videoId: string };
  snippet: {
    title: string;
    channelTitle: string;
    thumbnails: { default: { url: string }; medium: { url: string } };
  };
}

interface VideoSearchResponse {
  items: VideoSearchResult[];
}

export async function searchVideos(query: string, maxResults = 10): Promise<{ videoId: string; title: string; channel: string; thumbnail: string }[]> {
  if (!API_KEY) return [];
  try {
    const r = await fetch(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=video&maxResults=${maxResults}&key=${API_KEY}`
    );
    if (!r.ok) return [];
    const data: VideoSearchResponse = await r.json();
    return (data.items || []).map(item => ({
      videoId: item.id.videoId,
      title: item.snippet.title,
      channel: item.snippet.channelTitle,
      thumbnail: item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.default.url,
    }));
  } catch { return []; }
}
