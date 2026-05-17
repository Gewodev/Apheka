const API_KEY = import.meta.env.VITE_GOOGLE_API_KEY || '';
const CX = import.meta.env.VITE_GOOGLE_CUSTOM_SEARCH_CX || '';

interface SearchResult {
  title: string;
  link: string;
  snippet: string;
  displayLink: string;
  pagemap?: {
    cse_thumbnail?: { src: string }[];
    metatags?: { [key: string]: string }[];
  };
}

interface SearchResponse {
  items?: SearchResult[];
  searchInformation?: {
    totalResults: string;
  };
}

export async function searchWeb(query: string, num = 10): Promise<SearchResult[]> {
  if (!API_KEY || !CX) return [];
  try {
    const r = await fetch(
      `https://www.googleapis.com/customsearch/v1?key=${API_KEY}&cx=${CX}&q=${encodeURIComponent(query)}&num=${num}`
    );
    if (!r.ok) return [];
    const data: SearchResponse = await r.json();
    return data.items || [];
  } catch { return []; }
}

export async function searchStudyResources(topic: string): Promise<{ title: string; url: string; description: string }[]> {
  const results = await searchWeb(`${topic} study guide tutorial`, 5);
  return results.map(r => ({
    title: r.title,
    url: r.link,
    description: r.snippet,
  }));
}

export async function searchDocumentation(tool: string): Promise<{ title: string; url: string }[]> {
  const results = await searchWeb(`${tool} documentation API reference`, 5);
  return results.map(r => ({
    title: r.title,
    url: r.link,
  }));
}
