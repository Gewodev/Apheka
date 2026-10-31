import { useEffect, useRef, useState } from 'react';
import { useAppSlice } from '../store/AppContext';
import { paletteFromImage } from '../lib/imagePalette';
export function useWallpaperPalette() {
    const [systemDark, setSystemDark] = useState(() => matchMedia('(prefers-color-scheme:dark)').matches);
    useEffect(() => { const media = matchMedia('(prefers-color-scheme:dark)'), change = () => setSystemDark(media.matches); media.addEventListener('change', change); return () => media.removeEventListener('change', change); }, []);
    const a = useAppSlice(['settings', 'updateSettings']), latest = useRef(a.settings);
    latest.current = a.settings;
    const image = a.settings.backgroundImage, mode = a.settings.appearanceMode || (image ? 'image' : 'colors'), enabled = a.settings.autoWallpaperTheme !== false;
    useEffect(() => {
        let cancelled = false;
        if (mode !== 'image' || !image || !enabled) {
            document.documentElement.dataset.paletteState = 'idle';
            return;
        }
        document.documentElement.dataset.paletteState = 'loading';
        void (async () => { try {
            const dark = a.settings.theme === 'sistema' ? systemDark : a.settings.theme !== 'claro', bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(image + '|' + dark)), key = [...new Uint8Array(bytes)].map(n => n.toString(16).padStart(2, '0')).join('');
            if (cancelled)
                return;
            if (latest.current.paletteImageKey === key) {
                document.documentElement.dataset.paletteState = 'ready';
                return;
            }
            const colors = await paletteFromImage(image, dark);
            if (cancelled || latest.current.backgroundImage !== image || latest.current.appearanceMode === 'colors' || latest.current.autoWallpaperTheme === false)
                return;
            a.updateSettings({ ...colors, paletteImageKey: key });
            document.documentElement.dataset.paletteState = 'ready';
        }
        catch {
            if (!cancelled)
                document.documentElement.dataset.paletteState = 'error';
        } })();
        return () => { cancelled = true; };
    }, [image, mode, enabled, a.settings.theme, systemDark, a.updateSettings]);
}
