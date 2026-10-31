import React, { useEffect, useMemo, useRef, useState } from 'react';
import { convertFileSrc, isTauri } from '@tauri-apps/api/core';
import { useAppSlice } from '../store/AppContext';
export default function AnimatedWallpaper() {
    const { settings } = useAppSlice(['settings']), ref = useRef<HTMLVideoElement>(null), [failed, setFailed] = useState(''), path = settings.appearanceMode !== 'colors' && settings.backgroundMotion === 'smart' ? settings.backgroundVideoPath || '' : '';
    const src = useMemo(() => { if (!path)
        return ''; if (isTauri())
        return convertFileSrc(path); return path.startsWith('blob:') ? path : ''; }, [path]);
    useEffect(() => {
        const video = ref.current;
        if (!video || !src || failed === src)
            return;
        if (video.getAttribute('src') !== src)
            video.src = src;
        const reduced = window.matchMedia('(prefers-reduced-motion:reduce)');
        const sync = () => { const active = !reduced.matches && document.visibilityState === 'visible' && document.hasFocus() && document.documentElement.dataset.fullscreen !== 'true' && document.documentElement.dataset.workspaceOverlay!=='true' && !document.fullscreenElement; if (active) {
            if (video.paused)
                void video.play().catch(() => { });
        }
        else if (!video.paused)
            video.pause(); };
        const observer = new MutationObserver(sync);
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-fullscreen','data-workspace-overlay'] });
        document.addEventListener('visibilitychange', sync);
        document.addEventListener('fullscreenchange', sync);
        window.addEventListener('focus', sync);
        window.addEventListener('blur', sync);
        reduced.addEventListener('change', sync);
        video.addEventListener('loadeddata', sync);
        sync();
        return () => { observer.disconnect(); document.removeEventListener('visibilitychange', sync); document.removeEventListener('fullscreenchange', sync); window.removeEventListener('focus', sync); window.removeEventListener('blur', sync); reduced.removeEventListener('change', sync); video.removeEventListener('loadeddata', sync); video.pause(); video.removeAttribute('src'); video.load(); };
    }, [src, failed]);
    if (!src || failed === src)
        return null;
    return <video ref={ref} className="desktop-live-wallpaper" src={src} muted loop playsInline preload="metadata" aria-hidden="true" tabIndex={-1} onError={() => setFailed(src)}/>;
}
