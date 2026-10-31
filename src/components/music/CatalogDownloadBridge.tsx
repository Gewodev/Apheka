import { useEffect, useRef } from 'react';
import { useAppSlice } from '../../store/AppContext';
import { catalogDownloads, listenCatalogProgress } from '../../lib/catalogDownloads';
import { catalogTrack } from '../../lib/musicCatalog';
import { flushSync } from 'react-dom';
export default function CatalogDownloadBridge() {
    const a = useAppSlice(['hydrated', 'settings', 'addTrack', 'updateTrack']), latest = useRef(a);
    latest.current = a;
    useEffect(() => { if (!a.hydrated)
        return; void catalogDownloads.attach(async (job, path) => { let id = ''; flushSync(() => { id = latest.current.addTrack(catalogTrack(job.item)); }); await latest.current.updateTrack(id, { librarySaved:true,localAudioPath: path, audioFile: path.split(/[\\/]/).pop() }, true); }, a.settings.musicDownloadBudgetMB || 512); let disposed = false, stop: undefined | (() => void); void listenCatalogProgress().then(unlisten => { if (disposed)
        unlisten();
    else
        stop = unlisten; }); return () => { disposed = true; stop?.(); }; }, [a.hydrated]);
    useEffect(() => catalogDownloads.setBudget(a.settings.musicDownloadBudgetMB || 512), [a.settings.musicDownloadBudgetMB]);
    return null;
}
