import {musicConnection} from './musicNetwork';
import { get, set } from 'idb-keyval';
import { invoke, isTauri } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type { CatalogTrack } from './musicCatalog';
export type CatalogJob = {
    id: string;
    createdAt?: number;
    item: CatalogTrack;
    status: 'queued' | 'active' | 'cancelling' | 'done' | 'error' | 'cancelled';
    bytes: number;
    total: number;
    error?: string;
    path?: string;
};
type Completion = (job: CatalogJob, path: string) => Promise<void> | void;
let jobs: CatalogJob[] = [], ready = false, running = false, completion: Completion | undefined, budget = 512, persistTimer: ReturnType<typeof setTimeout> | undefined;
const subscribers = new Set<() => void>();
const emit = () => { subscribers.forEach(fn => fn()); clearTimeout(persistTimer); persistTimer = setTimeout(() => void set('apheka_catalog_jobs_v1', jobs.slice(-100)).catch(() => { }), 400); };
const patch = (id: string, fields: Partial<CatalogJob>) => { jobs = jobs.map(job => job.id === id ? { ...job, ...fields } : job); emit(); };
const pump = async () => { if (!ready || running || !completion)
    return; const job = jobs.find(j => j.status === 'queued'); if (!job)
    return; running = true; patch(job.id, { status: 'active', error: undefined }); try {
    if (!isTauri())
        throw Error('Las descargas de audio están disponibles en la aplicación de escritorio.');
    const result = await invoke<{
        path: string;
        bytes: number;
    }>('download_catalog_track', { id: job.item.id, budgetMb: budget, proxyMode:musicConnection.getTransportOptions().mode,proxyUrl:musicConnection.getTransportOptions().proxyUrl });
    await completion(job, result.path);
    patch(job.id, { status: 'done', bytes: result.bytes, total: result.bytes, path: result.path });
}
catch (e) {
    const cancelled = jobs.find(j => j.id === job.id)?.status === 'cancelling';
    patch(job.id, { status: cancelled ? 'cancelled' : 'error', error: cancelled ? undefined : String(e).slice(0, 300) });
}
finally {
    running = false;
    void pump();
} };
export const catalogDownloads = { subscribe: (fn: () => void) => { subscribers.add(fn); return () => { subscribers.delete(fn); }; }, snapshot: () => jobs,
    enqueue(item: CatalogTrack) { if (!item.downloadable)
        throw Error('Esta canción no tiene una descarga pública habilitada.'); if (jobs.some(j => j.item.id === item.id && ['queued', 'active', 'cancelling'].includes(j.status)))
        return; jobs = [...jobs.slice(-99), { id: crypto.randomUUID(), createdAt: Date.now(), item, status: 'queued', bytes: 0, total: 0 }]; emit(); void pump(); },
    cancel(id: string) { const job = jobs.find(j => j.id === id); if (!job)
        return; if (job.status === 'active') {
        patch(id, { status: 'cancelling' });
        void invoke('cancel_catalog_download', { id: job.item.id }).catch(() => { });
    }
    else if (job.status === 'queued')
        patch(id, { status: 'cancelled' }); },
    retry(id: string) { const job = jobs.find(j => j.id === id); if (job && ['error', 'cancelled'].includes(job.status)) {
        patch(id, { status: 'queued', error: undefined, bytes: 0, total: 0 });
        void pump();
    } },
    clear() { jobs = jobs.filter(j => ['queued', 'active', 'cancelling'].includes(j.status)); emit(); },
    async attach(fn: Completion, mb: number) { completion = fn; budget = mb; if (!ready) {
        const saved = await get<CatalogJob[]>('apheka_catalog_jobs_v1').catch(() => []);
        const pending = jobs;
        jobs = Array.isArray(saved) ? saved.slice(-100).filter(j => j?.item && /^[-\w]{1,64}$/.test(j.item.id) && typeof j.id === 'string').map(j => ['queued', 'active', 'cancelling'].includes(j.status) ? { ...j, status: 'error', error: 'Se interrumpió al cerrar APHEKA. Pulsa reintentar.' } : j) : [];
        jobs = [...jobs.filter(j => !pending.some(p => p.id === j.id)), ...pending].slice(-100);
        ready = true;
        emit();
    } void pump(); },
    setBudget(mb: number) { budget = mb; }
};
export async function listenCatalogProgress() { if (!isTauri())
    return () => { }; return listen<{
    id: string;
    bytes: number;
    total: number;
}>('catalog-download-progress', ({ payload }) => { const job = jobs.find(j => j.item.id === payload.id && ['active', 'cancelling'].includes(j.status)); if (job)
    patch(job.id, { bytes: payload.bytes, total: payload.total }); }); }
