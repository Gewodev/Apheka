import { invoke, isTauri } from '@tauri-apps/api/core';

export interface DetectedBrowser {
  id: string;
  name: string;
  exe: string;
}

let cache: DetectedBrowser[] | null = null;

// Solo los navegadores REALMENTE instalados (detección Rust por rutas conocidas)
export async function getInstalledBrowsers(force = false): Promise<DetectedBrowser[]> {
  if (!isTauri()) return [];
  if (cache && !force) return cache!;
  try {
    const res = await invoke<{ id: string; name: string; exe: string }[]>('detect_installed_browsers');
    cache = Array.isArray(res) ? res : [];
  } catch {
    cache = [];
  }
  return cache!;
}

const GLOBAL_KEY = 'owa_default_browser_global_v1';
const courseKey = (courseId: string) => `owa_default_browser_course_${courseId}`;

export function getDefaultBrowserId(courseId?: string): string | null {
  try {
    if (courseId) {
      const v = localStorage.getItem(courseKey(courseId));
      if (v) return v;
    }
    return localStorage.getItem(GLOBAL_KEY);
  } catch { return null; }
}

export function setDefaultBrowser(browserId: string | null, courseId?: string): void {
  try {
    if (!browserId) {
      if (courseId) localStorage.removeItem(courseKey(courseId));
      else localStorage.removeItem(GLOBAL_KEY);
      return;
    }
    if (courseId) localStorage.setItem(courseKey(courseId), browserId);
    else localStorage.setItem(GLOBAL_KEY, browserId);
  } catch { /* noop */ }
}

/** Abre un enlace http(s) EN UN NAVEGADOR CONCRETO del sistema */
export async function openUrlInBrowser(exe: string, url: string): Promise<void> {
  await invoke('open_url_in_browser', { exe, url });
}

/** Resuelve el navegador predeterminado (curso > global) y devuelve su exe */
export async function resolveDefaultBrowserExe(courseId?: string): Promise<string | null> {
  const id = getDefaultBrowserId(courseId ?? readSelectedCourse());
  if (!id) return null;
  const list = await getInstalledBrowsers();
  return list.find(b => b.id === id)?.exe || null;
}

// ---------- Apps nativas que abren PDF (detección por rutas conocidas) ----------

export interface PdfApp { id: string; name: string; exe: string }

let pdfCache: PdfApp[] | null = null;

const PF = 'C:\\Program Files';
const PFX = 'C:\\Program Files (x86)';
const PDF_CANDIDATES: { id: string; name: string; paths: string[] }[] = [
  { id: 'acrobat', name: 'Adobe Acrobat', paths: [
    `${PF}\\Adobe\\Acrobat DC\\Acrobat\\Acrobat.exe`,
    `${PFX}\\Adobe\\Acrobat DC\\Acrobat\\Acrobat.exe`,
    `${PF}\\Adobe\\Adobe Acrobat\\Acrobat\\Acrobat.exe`,
  ] },
  { id: 'acroread', name: 'Adobe Reader', paths: [
    `${PFX}\\Adobe\\Reader 11.0\\Reader\\AcroRd32.exe`,
    `${PF}\\Adobe\\Reader 11.0\\Reader\\AcroRd32.exe`,
    `${PFX}\\Adobe\\Reader 10.0\\Reader\\AcroRd32.exe`,
  ] },
  { id: 'foxit', name: 'Foxit PDF', paths: [
    `${PFX}\\Foxit Software\\Foxit PDF Reader\\FoxitPDFReader.exe`,
    `${PF}\\Foxit Software\\Foxit PDF Reader\\FoxitPDFReader.exe`,
    `${PFX}\\Foxit Software\\Foxit Reader\\FoxitReader.exe`,
    `${PF}\\Foxit Software\\Foxit Reader\\FoxitReader.exe`,
  ] },
  { id: 'sumatra', name: 'Sumatra PDF', paths: [
    `${PF}\\SumatraPDF\\SumatraPDF.exe`,
    `${PFX}\\SumatraPDF\\SumatraPDF.exe`,
  ] },
];

async function localAppData(): Promise<string> {
  try {
    const { localDataDir } = await import('@tauri-apps/api/path');
    return await localDataDir();
  } catch { return ''; }
}

export async function getPdfApps(force = false): Promise<PdfApp[]> {
  if (!isTauri()) return [];
  if (pdfCache && !force) return pdfCache;
  const out: PdfApp[] = [];
  try {
    const { exists } = await import('@tauri-apps/plugin-fs');
    const lad = await localAppData();
    const ladCandidates: { id: string; name: string; paths: string[] }[] = lad ? [
      { id: 'sumatra', name: 'Sumatra PDF', paths: [`${lad}\\SumatraPDF\\SumatraPDF.exe`] },
      { id: 'foxitLad', name: 'Foxit PDF', paths: [`${lad}\\Foxit Software\\Foxit PDF Reader\\FoxitPDFReader.exe`, `${lad}\\Foxit Software\\Foxit Reader\\FoxitReader.exe`] },
    ] : [];
    for (const group of [...PDF_CANDIDATES, ...ladCandidates]) {
      for (const p of group.paths) {
        try { if (await exists(p)) { out.push({ id: group.id, name: group.name, exe: p }); break; } } catch { /* noop */ }
      }
    }
    // dedupe foxit duplicado (PF + LAD)
    const seen = new Set<string>();
    pdfCache = out.filter(a => { const k = a.id.replace(/Lad$/, ''); if (seen.has(k)) return false; seen.add(k); return true; });
  } catch { pdfCache = []; }
  return pdfCache;
}

function readSelectedCourse(): string | undefined {
  try { return localStorage.getItem('owa_selected_course_id') || undefined; } catch { return undefined; }
}

let courseNameCache: { at: number; value?: string } | null = null;

/** Nombre del curso actualmente abierto (para la ventana de predeterminado) */
export function getSelectedCourseName(): string | undefined {
  const id = readSelectedCourse();
  if (!id) return undefined;
  // Cache corto: evita re-parsear el blob grande en cada apertura del menú
  if (courseNameCache && Date.now() - courseNameCache.at < 5000) return courseNameCache.value;
  let name: string | undefined;
  try {
    const raw = localStorage.getItem('owa_studio_data');
    if (raw) {
      const data = JSON.parse(raw);
      const c = Array.isArray(data?.courses) ? data.courses.find((x: any) => x?.id === id) : null;
      if (c?.name) name = String(c.name);
    }
  } catch { /* noop */ }
  courseNameCache = { at: Date.now(), value: name };
  return name;
}
