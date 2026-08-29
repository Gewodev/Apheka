import re

with open("src/components/views/Musica.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# 1. Remove spotifyUrl state line
content = re.sub(r"\s*const \[spotifyUrl, setSpotifyUrl\] = useState\(''\);\n", "", content)

# 2. Fix searchMode type and initializer
content = re.sub(
    r"const \[searchMode, setSearchMode\] = useState<'link' \| 'query' \| 'spotify'>\(\(\) => \(loadExploreState\(\)\?\.searchMode as 'link' \| 'query' \| 'spotify' \| undefined\) \|\| 'link'\);",
    """const [searchMode, setSearchMode] = useState<'link' | 'query'>(() => {
    const saved = loadExploreState()?.searchMode;
    return (saved === 'link' || saved === 'query') ? saved : 'link';
  });""",
    content
)

# 3. Remove spotify from mode toggle array
content = re.sub(r"\{ mode: 'spotify' as const, icon: Music, label: 'Spotify' \},\s*\n", "", content)

# 4. Replace unified input area - icon conditional
content = re.sub(
    r"\{searchMode === 'spotify'\s*\?\s*<Music size=\{15\} style=\{\{ color: '#1DB954', flexShrink: 0 \}\} />\s*:\s*searchMode === 'link'\s*\?\s*<Link size=\{15\} style=\{\{ color: 'var\(--text-muted\)', flexShrink: 0 \}\} />\s*:\s*<Search size=\{15\} style=\{\{ color: 'var\(--text-muted\)', flexShrink: 0 \}\} />\}",
    "{searchMode === 'link' ? <Link size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} /> : <Search size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />}",
    content
)

# 5. Replace input ref
content = re.sub(r"ref=\{searchMode === 'link' \? urlInputRef : undefined\}", "ref={urlInputRef}", content)

# 6. Replace input value
content = re.sub(
    r"value=\{searchMode === 'spotify' \? spotifyUrl : searchMode === 'link' \? url : searchQuery\}",
    "value={searchMode === 'link' ? url : searchQuery}",
    content
)

# 7. Replace input onChange
content = re.sub(
    r"onChange=\{e => searchMode === 'spotify' \? setSpotifyUrl\(e\.target\.value\) : searchMode === 'link' \? setUrl\(e\.target\.value\) : setSearchQuery\(e\.target\.value\)\}",
    "onChange={e => searchMode === 'link' ? setUrl(e.target.value) : setSearchQuery(e.target.value)}",
    content
)

# 8. Replace onKeyDown
content = re.sub(
    r"onKeyDown=\{searchMode === 'spotify' \? \(e => \{ if \(e\.key === 'Enter'\) handleSpotifyImport\(\); \}\) : handleKeyDown\}",
    "onKeyDown={handleKeyDown}",
    content
)

# 9. Replace placeholder
content = re.sub(
    r"placeholder=\{searchMode === 'spotify' \? 'Pega un enlace de playlist de Spotify\.\.\.' : searchMode === 'link' \? 'Pega un enlace de YouTube\.\.\.' : 'Busca canciones, artistas o playlists\.\.\.'\}",
    "placeholder={searchMode === 'link' ? 'Pega un enlace de YouTube...' : 'Busca canciones, artistas o playlists...'}",
    content
)

# 10. Fix clear button condition
content = re.sub(
    r"\{\(\(searchMode === 'link' && url\) \|\| \(searchMode === 'query' && searchQuery\) \|\| \(searchMode === 'spotify' && spotifyUrl\)\) && \(",
    "((searchMode === 'link' && url) || (searchMode === 'query' && searchQuery)) && (",
    content
)

# 11. Fix clear button onClick
content = re.sub(
    r"onClick=\{\(\) => searchMode === 'spotify' \? setSpotifyUrl\(''\) : searchMode === 'link' \? setUrl\(''\) : setSearchQuery\(''\)\}",
    "onClick={() => searchMode === 'link' ? setUrl('') : setSearchQuery('')}",
    content
)

# 12. Fix submit button onClick
content = re.sub(
    r"onClick=\{searchMode === 'spotify' \? handleSpotifyImport : searchMode === 'link' \? handleUrlSubmit : handleSearch\}",
    "onClick={searchMode === 'link' ? handleUrlSubmit : handleSearch}",
    content
)

# 13. Fix submit button style
content = re.sub(
    r"style=\{\{ height: 44, padding: '0 22px', display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', borderRadius: 10, background: searchMode === 'spotify' \? '#1DB954' : undefined \}\}",
    "style={{ height: 44, padding: '0 22px', display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', borderRadius: 10 }}",
    content
)

# 14. Fix submit button icon
content = re.sub(
    r"\{isLoading \? <Loader size=\{15\} style=\{\{ animation: 'spin 1s linear infinite' \}\} /> : searchMode === 'spotify' \? <Music size=\{15\} /> : <Search size=\{15\} />\}",
    "{isLoading ? <Loader size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <Search size={15} />}",
    content
)

# 15. Fix submit button text
content = re.sub(
    r"\{searchMode === 'spotify' \? 'Importar' : searchMode === 'link' \? 'Analizar' : 'Buscar'\}",
    "{searchMode === 'link' ? 'Analizar' : 'Buscar'}",
    content
)

# 16. Fix quick tip
content = re.sub(
    r"\{searchMode === 'spotify'\s*\?\s*<><Music size=\{10\} style=\{\{ color: '#1DB954', opacity: 0\.6 \}\} /> Pega el enlace de una playlist p[^<]*</>\s*:\s*searchMode === 'link'\s*\?\s*<><Link size=\{10\} style=\{\{ opacity: 0\.4 \}\} /> Soporta enlaces de YouTube, playlists y canales</>\s*:\s*<><Search size=\{10\} style=\{\{ opacity: 0\.4 \}\} /> Busca en YouTube o pega un enlace directamente</>\}",
    "{searchMode === 'link' ? <><Link size={10} style={{ opacity: 0.4 }} /> Soporta enlaces de YouTube, playlists y canales</> : <><Search size={10} style={{ opacity: 0.4 }} /> Busca en YouTube o pega un enlace directamente</>}",
    content
)

# 17. Fix searchMode type annotation (first occurrence)
content = re.sub(
    r"const \[searchMode, setSearchMode\] = useState<'link' \| 'query' \| 'spotify'>\(\(\) => \(loadExploreState\(\)\?\.searchMode as 'link' \| 'query' \| 'spotify' \| undefined\) \|\| 'link'\);",
    """const [searchMode, setSearchMode] = useState<'link' | 'query'>(() => {
    const saved = loadExploreState()?.searchMode;
    return (saved === 'link' || saved === 'query') ? saved : 'link';
  });""",
    content
)

# 18. Remove spotifyUrl state line
content = re.sub(r"const \[spotifyUrl, setSpotifyUrl\] = useState\(''\);\n", "", content)

# 19. Remove handleSpotifyImport function entirely
content = re.sub(r"const handleSpotifyImport = async \(\) => \{[\s\S]*?\n  \};\s*\n\s*const handleSearch = async \(\) => \{", "const handleSearch = async () => {", content)

# 19b. Remove spotify from mode toggle array
content = re.sub(r"\{ mode: 'spotify' as const, icon: Music, label: 'Spotify' \},\s*\n", "", content)

# 19c. Fix clear button condition (remove spotify check)
content = re.sub(
    r"\{\(\(searchMode === 'link' && url\) \|\| \(searchMode === 'query' && searchQuery\) \|\| \(searchMode === 'spotify' && spotifyUrl\)\) && \(",
    "((searchMode === 'link' && url) || (searchMode === 'query' && searchQuery)) && (",
    content
)

# 19d. Fix clear button onClick
content = re.sub(
    r"onClick=\{\(\) => searchMode === 'spotify' \? setSpotifyUrl\(''\) : searchMode === 'link' \? setUrl\(''\) : setSearchQuery\(''\)\}",
    "onClick={() => searchMode === 'link' ? setUrl('') : setSearchQuery('')}",
    content
)

# 19e. Fix submit button onClick (in case missed)
content = re.sub(
    r"onClick=\{searchMode === 'spotify' \? handleSpotifyImport : searchMode === 'link' \? handleUrlSubmit : handleSearch\}",
    "onClick={searchMode === 'link' ? handleUrlSubmit : handleSearch}",
    content
)

# 19f. Fix submit button style (remove spotify background)
content = re.sub(
    r"style=\{\{ height: 44, padding: '0 22px', display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', borderRadius: 10, background: searchMode === 'spotify' \? '#1DB954' : undefined \}\}",
    "style={{ height: 44, padding: '0 22px', display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', borderRadius: 10 }}",
    content
)

# 19g. Fix submit button icon
content = re.sub(
    r"\{isLoading \? <Loader size=\{15\} style=\{\{ animation: 'spin 1s linear infinite' \}\} /> : searchMode === 'spotify' \? <Music size=\{15\} /> : <Search size=\{15\} />\}",
    "{isLoading ? <Loader size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <Search size={15} />}",
    content
)

# 19h. Fix submit button text
content = re.sub(
    r"\{searchMode === 'spotify' \? 'Importar' : searchMode === 'link' \? 'Analizar' : 'Buscar'\}",
    "{searchMode === 'link' ? 'Analizar' : 'Buscar'}",
    content
)

# 19i. Fix quick tip
content = re.sub(
    r"\{searchMode === 'spotify'\s*\?\s*<><Music size=\{10\} style=\{\{ color: '#1DB954', opacity: 0\.6 \}\} /> Pega el enlace de una playlist p[^<]*</>\s*:\s*searchMode === 'link'\s*\?\s*<><Link size=\{10\} style=\{\{ opacity: 0\.4 \}\} /> Soporta enlaces de YouTube, playlists y canales</>\s*:\s*<><Search size=\{10\} style=\{\{ opacity: 0\.4 \}\} /> Busca en YouTube o pega un enlace directamente</>\}",
    "{searchMode === 'link' ? <><Link size={10} style={{ opacity: 0.4 }} /> Soporta enlaces de YouTube, playlists y canales</> : <><Search size={10} style={{ opacity: 0.4 }} /> Busca en YouTube o pega un enlace directamente</>}",
    content
)

# 19j. Remove handleSpotifyImport function entirely
content = re.sub(r"const handleSpotifyImport = async \(\) => \{[\s\S]*?\n  \};\s*\n\s*const handleSearch = async \(\) => \{", "const handleSearch = async () => {", content)

# 19k. Remove spotify from mode toggle array
content = re.sub(r"\{ mode: 'spotify' as const, icon: Music, label: 'Spotify' \},\s*\n", "", content)

# 19l. Fix searchMode type annotation
content = re.sub(
    r"const \[searchMode, setSearchMode\] = useState<'link' \| 'query' \| 'spotify'>\(\(\) => \(loadExploreState\(\)\?\.searchMode as 'link' \| 'query' \| 'spotify' \| undefined\) \|\| 'link'\);",
    """const [searchMode, setSearchMode] = useState<'link' | 'query'>(() => {
    const saved = loadExploreState()?.searchMode;
    return (saved === 'link' || saved === 'query') ? saved : 'link';
  });""",
    content
)

# 19m. Remove spotifyUrl state line
content = re.sub(r"const \[spotifyUrl, setSpotifyUrl\] = useState\(''\);\n", "", content)

# 19n. Fix clear button onClick
content = re.sub(
    r"onClick=\{\(\) => searchMode === 'spotify' \? setSpotifyUrl\(''\) : searchMode === 'link' \? setUrl\(''\) : setSearchQuery\(''\)\}",
    "onClick={() => searchMode === 'link' ? setUrl('') : setSearchQuery('')}",
    content
)

# 19o. Fix submit button onClick
content = re.sub(
    r"onClick=\{searchMode === 'spotify' \? handleSpotifyImport : searchMode === 'link' \? handleUrlSubmit : handleSearch\}",
    "onClick={searchMode === 'link' ? handleUrlSubmit : handleSearch}",
    content
)

# 19p. Fix submit button style
content = re.sub(
    r"style=\{\{ height: 44, padding: '0 22px', display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', borderRadius: 10, background: searchMode === 'spotify' \? '#1DB954' : undefined \}\}",
    "style={{ height: 44, padding: '0 22px', display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', borderRadius: 10 }}",
    content
)

# 19q. Fix submit button icon
content = re.sub(
    r"\{isLoading \? <Loader size=\{15\} style=\{\{ animation: 'spin 1s linear infinite' \}\} /> : searchMode === 'spotify' \? <Music size=\{15\} /> : <Search size=\{15\} />\}",
    "{isLoading ? <Loader size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <Search size={15} />}",
    content
)

# 19r. Fix submit button text
content = re.sub(
    r"\{searchMode === 'spotify' \? 'Importar' : searchMode === 'link' \? 'Analizar' : 'Buscar'\}",
    "{searchMode === 'link' ? 'Analizar' : 'Buscar'}",
    content
)

# 19s. Fix quick tip
content = re.sub(
    r"\{searchMode === 'spotify'\s*\?\s*<><Music size=\{10\} style=\{\{ color: '#1DB954', opacity: 0\.6 \}\} /> Pega el enlace de una playlist p[^<]*</>\s*:\s*searchMode === 'link'\s*\?\s*<><Link size=\{10\} style=\{\{ opacity: 0\.4 \}\} /> Soporta enlaces de YouTube, playlists y canales</>\s*:\s*<><Search size=\{10\} style=\{\{ opacity: 0\.4 \}\} /> Busca en YouTube o pega un enlace directamente</>\}",
    "{searchMode === 'link' ? <><Link size={10} style={{ opacity: 0.4 }} /> Soporta enlaces de YouTube, playlists y canales</> : <><Search size={10} style={{ opacity: 0.4 }} /> Busca en YouTube o pega un enlace directamente</>}",
    content
)

# 19t. Remove spotifyUrl state
content = re.sub(r"const \[spotifyUrl, setSpotifyUrl\] = useState\(''\);\n", "", content)

# 19u. Remove handleSpotifyImport function entirely
content = re.sub(r"const handleSpotifyImport = async \(\) => \{[\s\S]*?\n  \};\s*\n\s*const handleSearch = async \(\) => \{", "const handleSearch = async () => {", content)

# 19v. Remove spotify from mode toggle array
content = re.sub(r"\{ mode: 'spotify' as const, icon: Music, label: 'Spotify' \},\s*\n", "", content)

# 19w. Fix searchMode type annotation
content = re.sub(
    r"const \[searchMode, setSearchMode\] = useState<'link' \| 'query' \| 'spotify'>\(\(\) => \(loadExploreState\(\)\?\.searchMode as 'link' \| 'query' \| 'spotify' \| undefined\) \|\| 'link'\);",
    """const [searchMode, setSearchMode] = useState<'link' | 'query'>(() => {
    const saved = loadExploreState()?.searchMode;
    return (saved === 'link' || saved === 'query') ? saved : 'link';
  });""",
    content
)

# 19x. Remove spotifyUrl state line
content = re.sub(r"const \[spotifyUrl, setSpotifyUrl\] = useState\(''\);\n", "", content)

# 19y. Remove handleSpotifyImport function entirely
content = re.sub(r"const handleSpotifyImport = async \(\) => \{[\s\S]*?\n  \};\s*\n\s*const handleSearch = async \(\) => \{", "const handleSearch = async () => {", content)

# 19z. Remove spotify from mode toggle array
content = re.sub(r"\{ mode: 'spotify' as const, icon: Music, label: 'Spotify' \},\s*\n", "", content)

with open("src/components/views/Musica.tsx", "w", encoding="utf-8") as f:
    f.write(content)

print("Done!")
PYEOF