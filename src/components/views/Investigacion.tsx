import React, { useState } from 'react';
import {
  Search, Book, Globe, PlayCircle, ExternalLink, BookOpen,
  ChevronRight, ChevronLeft, GraduationCap, FileText, Sparkles,
  Info, ArrowRight, Loader2,
} from 'lucide-react';
import { useApp } from '../../store/AppContext';

const STUDY_CATEGORIES = [
  { id: 'all', label: 'Todo', icon: Sparkles },
  { id: 'books', label: 'Libros', icon: Book },
  { id: 'web', label: 'Web', icon: Globe },
  { id: 'video', label: 'Videos', icon: PlayCircle },
  { id: 'docs', label: 'Documentos', icon: FileText },
];

const SUGGESTED_TOPICS = [
  'Cálculo Diferencial', 'Álgebra Lineal', 'Física Cuántica',
  'Programación en Python', 'Estructuras de Datos', 'Machine Learning',
  'Historia Universal', 'Química Orgánica', 'Literatura Española',
  'Economía', 'Filosofía', 'Biología Molecular',
];

interface SearchResult {
  title: string;
  url: string;
  description: string;
  thumbnail?: string;
  source: 'books' | 'web' | 'youtube' | 'docs';
}

export default function Investigacion() {
  const { searchStudyResources, searchVideos } = useApp();
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);

  const handleSearch = async () => {
    const q = query.trim() || selectedTopic || '';
    if (!q) return;
    setIsSearching(true);
    setSearched(true);

    const allResults: SearchResult[] = [];

    if (activeCategory === 'all' || activeCategory === 'web') {
      const web = await searchStudyResources(q);
      allResults.push(...web.map(r => ({ ...r, source: 'web' as const })));
    }

    if (activeCategory === 'all' || activeCategory === 'video') {
      const yt = await searchVideos(q);
      allResults.push(...yt.map(r => ({
        title: r.title,
        url: `https://youtube.com/watch?v=${r.videoId}`,
        description: r.channel,
        thumbnail: r.thumbnail,
        source: 'youtube' as const,
      })));
    }

    if (activeCategory === 'all' || activeCategory === 'books') {
      allResults.push(...[
        { title: `"${q}" - Google Books`, url: `https://books.google.com/books?q=${encodeURIComponent(q)}`, description: 'Buscar en Google Books', source: 'books' as const },
        { title: `"${q}" - PDF Drive`, url: `https://www.pdfdrive.com/search?q=${encodeURIComponent(q)}`, description: 'Buscar en PDF Drive', source: 'books' as const },
        { title: `"${q}" - Open Library`, url: `https://openlibrary.org/search?q=${encodeURIComponent(q)}`, description: 'Buscar en Open Library', source: 'books' as const },
      ]);
    }

    if (activeCategory === 'all' || activeCategory === 'docs') {
      allResults.push(...[
        { title: `"${q}" - ResearchGate`, url: `https://www.researchgate.net/search/publication?q=${encodeURIComponent(q)}`, description: 'Artículos académicos', source: 'docs' as const },
        { title: `"${q}" - arXiv.org`, url: `https://arxiv.org/search/?query=${encodeURIComponent(q)}&searchtype=all`, description: 'Papers científicos', source: 'docs' as const },
        { title: `"${q}" - Google Scholar`, url: `https://scholar.google.com/scholar?q=${encodeURIComponent(q)}`, description: 'Literatura académica', source: 'docs' as const },
      ]);
    }

    setResults(allResults);
    setIsSearching(false);
  };

  return (
    <div className="h-full flex flex-col bg-background">
      <header className="h-16 px-6 flex items-center justify-between shrink-0 border-b border-borderDark/40">
        <h1 className="text-lg font-semibold text-textMain flex items-center gap-2.5">
          <Search size={18} className="text-accent" /> Investigación
        </h1>
        <div className="flex items-center gap-2 text-[10px] text-textDim">
          <Info size={12} />
          Resultados de múltiples fuentes
        </div>
      </header>

      <div className="flex-1 overflow-y-auto custom-scroll p-6">
        <div className="max-w-4xl mx-auto">

          {/* Search Bar */}
          <div className="mb-6">
            <div className="relative">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-textDim" />
              <input
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                placeholder="Busca libros, tutoriales, papers, recursos educativos..."
                className="w-full h-12 pl-11 pr-24 rounded-xl bg-surface border border-borderDark text-sm text-textMain placeholder:text-textDim outline-none focus:border-accent transition-colors"
              />
              <button
                onClick={handleSearch}
                disabled={isSearching}
                className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-accent text-white text-xs font-semibold hover:bg-accent/90 disabled:opacity-50 transition-all"
              >
                {isSearching ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />}
                Buscar
              </button>
            </div>
          </div>

          {/* Categories */}
          <div className="flex gap-2 mb-6">
            {STUDY_CATEGORIES.map(cat => {
              const Icon = cat.icon;
              const isActive = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => { setActiveCategory(cat.id); if (searched) handleSearch(); }}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-accent text-white shadow-sm'
                      : 'bg-surface border border-borderDark text-textDim hover:text-textMain hover:border-textDim/40'
                  }`}
                >
                  <Icon size={14} />
                  {cat.label}
                </button>
              );
            })}
          </div>

          {/* Topics Grid (when no search) */}
          {!searched && (
            <>
              <div className="mb-4">
                <h2 className="text-sm font-semibold text-textMain mb-1">Temas sugeridos</h2>
                <p className="text-[10px] text-textDim">Selecciona un tema para investigar</p>
              </div>
              <div className="grid grid-cols-3 md:grid-cols-4 gap-2.5 mb-8">
                {SUGGESTED_TOPICS.map(topic => (
                  <button
                    key={topic}
                    onClick={() => { setSelectedTopic(topic); setQuery(topic); }}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      selectedTopic === topic
                        ? 'bg-accent/10 border-accent text-accent'
                        : 'bg-surface border-borderDark text-textDim hover:text-textMain hover:border-textDim/30'
                    }`}
                  >
                    <GraduationCap size={16} className="mb-1.5 opacity-60" />
                    <p className="text-[11px] font-medium leading-tight">{topic}</p>
                  </button>
                ))}
              </div>

              {/* Quick Links */}
              <div className="bg-surface border border-borderDark rounded-xl p-5">
                <h3 className="text-xs font-semibold text-textMain mb-3 flex items-center gap-2">
                  <BookOpen size={14} className="text-accent" />
                  Accesos directos
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {[
                    { name: 'Google Books', url: 'https://books.google.com', color: '#3B82F6' },
                    { name: 'Google Scholar', url: 'https://scholar.google.com', color: '#10B981' },
                    { name: 'arXiv.org', url: 'https://arxiv.org', color: '#8B5CF6' },
                    { name: 'ResearchGate', url: 'https://researchgate.net', color: '#EC4899' },
                    { name: 'PDF Drive', url: 'https://pdfdrive.com', color: '#F59E0B' },
                    { name: 'Open Library', url: 'https://openlibrary.org', color: '#06B6D4' },
                    { name: 'Coursera', url: 'https://coursera.org', color: '#6366F1' },
                    { name: 'Khan Academy', url: 'https://khanacademy.org', color: '#14B8A6' },
                  ].map(link => (
                    <a key={link.name} href={link.url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-background border border-borderDark hover:border-accent/40 transition-all group">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: link.color }} />
                      <span className="text-[11px] font-medium text-textMain truncate">{link.name}</span>
                      <ExternalLink size={10} className="text-textDim ml-auto opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                    </a>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Results */}
          {searched && (
            <div>
              {isSearching ? (
                <div className="flex items-center justify-center py-16">
                  <div className="text-center">
                    <Loader2 size={24} className="animate-spin text-accent mx-auto mb-3" />
                    <p className="text-sm text-textDim">Buscando en todas las fuentes...</p>
                  </div>
                </div>
              ) : results.length === 0 ? (
                <div className="flex items-center justify-center py-16">
                  <div className="text-center">
                    <Search size={32} className="text-textDim/30 mx-auto mb-3" />
                    <p className="text-sm text-textDim mb-1">Sin resultados</p>
                    <p className="text-[10px] text-textDim">Intenta con otros términos de búsqueda</p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs text-textDim">
                      <span className="text-textMain font-semibold">{results.length}</span> resultados encontrados
                    </p>
                    <div className="flex gap-1">
                      {['all', 'web', 'video', 'books', 'docs'].map(src => {
                        const count = src === 'all' ? results.length : results.filter(r => r.source === src).length;
                        if (count === 0) return null;
                        return (
                          <span key={src} className="px-2 py-0.5 rounded-full bg-surface border border-borderDark text-[9px] font-medium text-textDim">
                            {src === 'all' ? 'Todo' : src} {count}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    {results.map((r, i) => (
                      <a
                        key={`${r.url}-${i}`}
                        href={r.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-start gap-3 p-3.5 rounded-xl bg-surface border border-borderDark hover:bg-surface/80 hover:border-accent/30 transition-all group"
                      >
                        {/* Source icon */}
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                          r.source === 'books' ? 'bg-blue-500/15' :
                          r.source === 'web' ? 'bg-emerald-500/15' :
                          r.source === 'youtube' ? 'bg-red-500/15' :
                          'bg-purple-500/15'
                        }`}>
                          {r.source === 'books' && <Book size={14} className="text-blue-400" />}
                          {r.source === 'web' && <Globe size={14} className="text-emerald-400" />}
                          {r.source === 'youtube' && <PlayCircle size={14} className="text-red-400" />}
                          {r.source === 'docs' && <FileText size={14} className="text-purple-400" />}
                        </div>

                        {/* Content */}
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] font-medium text-textMain leading-snug group-hover:text-accent transition-colors line-clamp-2">
                            {r.title}
                          </p>
                          <p className="text-[11px] text-textDim mt-0.5 line-clamp-1">{r.description}</p>
                        </div>

                        {/* Thumbnail */}
                        {r.thumbnail && (
                          <img src={r.thumbnail} alt="" className="w-14 h-10 rounded-lg object-cover shrink-0" />
                        )}

                        <ExternalLink size={12} className="text-textDim opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-1" />
                      </a>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
