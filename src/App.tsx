import './workspace-6266.css';
import HabitReminderHost from './components/ui/HabitReminderHost';
import NotificationNavigation from './components/NotificationNavigation';
import {useCharvisEnabled, setCharvisEnabled} from './lib/charvisAvailability';
import {ViewActivity} from './lib/viewActivity';
import {nextMusicSelection} from './lib/musicRadio';
import {useYouTubeRecovery} from './hooks/useYouTubeRecovery';
import {primeStudyAlarm} from './lib/studyAlarm';
import MediaDownloadBridge from './components/music/MediaDownloadBridge';
import CatalogDownloadBridge from './components/music/CatalogDownloadBridge';
import {useWallpaperPalette} from './hooks/useWallpaperPalette';
import {useAppSlice} from './store/AppContext';
import {useWorkspaceNavigation} from './hooks/useWorkspaceNavigation';
import {useAutoDock} from './hooks/useAutoDock';
import WorkspaceLauncher from './components/ui/WorkspaceLauncher';
import AnimatedWallpaper from './components/AnimatedWallpaper';
import EditorBlockMenu from './components/ui/EditorBlockMenu';
import ReleaseNotice from './components/ui/ReleaseNotice';
import McpBridge from './components/McpBridge';
import { useFullscreenLifecycle } from './hooks/useWindowFullscreen';
import AphekaWordmark from './components/ui/AphekaWordmark';
import React, { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo, lazy, Suspense } from 'react';
import {
  Home, NotebookPen, Clock, ListTodo, Settings,
  Music, Bot,
  Calendar, Layers, Plus, GraduationCap, X, Image as ImageIcon,
  Loader2,
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { AppProvider, useApp } from './store/AppContext';
import toast, { Toaster } from 'react-hot-toast';
import ErrorBoundary from './components/ErrorBoundary';
import { ensureYouTubeApi, extractYouTubeId, extractPlaylistId, generalYtControl } from './lib/ytEngine';

const Inicio = React.memo(lazy(() => import('./components/views/Inicio')));
const Estudio = React.memo(lazy(() => import('./components/views/Estudio')));
const Tareas = React.memo(lazy(() => import('./components/views/Tareas')));
const Notas = React.memo(lazy(() => import('./components/views/Notas')));
const Musica = React.memo(lazy(() => import('./components/views/Musica')));
const Planificacion = React.memo(lazy(() => import('./components/views/Planificacion')));
const Ajustes = React.memo(lazy(() => import('./components/views/Ajustes')));
const Cursos = React.memo(lazy(() => import('./components/views/Cursos')));
const CursosHub = React.memo(lazy(() => import('./components/views/CursosHub')));
const CharvisSidebar = React.memo(lazy(() => import('./components/ui/CharvisSidebar')));
const IA = React.memo(lazy(() => import('./components/views/IA')));
import OAuthCallback from './components/OAuthCallback';
import GlobalPlayer from './components/GlobalPlayer';
import SchedulePeek from './components/ui/SchedulePeek';
import AppCommandsPanel from './components/ui/AppCommandsPanel';
import DownloadManager from './components/ui/DownloadManager';
import TrackArtworkDialog from './components/music/TrackArtworkDialog';
import ImageContextMenu from './components/ui/ImageContextMenu';

type ViewId = 'inicio' | 'estudio' | 'tareas' | 'notas' | 'musica' | 'planificacion' | 'cursos' | 'ia' | 'ajustes' | 'curso_detalle';

interface AppContentProps {
  setGlobalView: (view: ViewId) => void;
}

export function AppContent() {
  useWallpaperPalette();
  const reportFullscreenError = useCallback((message: string) => { toast.error(message); }, []);
  useFullscreenLifecycle(reportFullscreenError);
  const { hydrated, settings, courses, addCourse, navigateTo, setNavigateTo, importState, updateSettings, toastMessage, deleteOldCompletedTasks, youtubeVideoUrl, setYoutubeVideoUrl, isPlayingMusic, musicVolume, setMusicDuration, setMusicProgressRaw, setIsPlayingMusic, playTrack, musicQueue, setMusicQueue, shuffleMode, repeatMode, tracks, currentTrackId, setRepeatMode, coverModalTrackId, showRestPrompt, handlePomodoroBannerClick, queueSource, trackHistory, playCounts, courseDeepLink, setCourseDeepLink, addNotification } = useAppSlice(["hydrated","settings","courses","addCourse","navigateTo","setNavigateTo","importState","updateSettings","toastMessage","deleteOldCompletedTasks","youtubeVideoUrl","setYoutubeVideoUrl","isPlayingMusic","musicVolume","setMusicDuration","setMusicProgressRaw","setIsPlayingMusic","playTrack","musicQueue","setMusicQueue","shuffleMode","repeatMode","tracks","currentTrackId","setRepeatMode","coverModalTrackId","showRestPrompt","handlePomodoroBannerClick","queueSource","trackHistory","playCounts","courseDeepLink","setCourseDeepLink","addNotification"]);
  useEffect(()=>{if(!toastMessage)return;const options={id:"apheka-system-notice"};if(toastMessage.type==='success')toast.success(toastMessage.message,options);else if(toastMessage.type==='error')toast.error(toastMessage.message,options);else toast(toastMessage.message,{...options,className:"apheka-toast-info"});},[toastMessage]);
  // Suspender Música: oculta el apartado sin borrar nada; el click derecho en la barra la devuelve
  const aiSuspended = !useCharvisEnabled();
  const [musicSuspended, setMusicSuspended] = useState<boolean>(() => { try { return localStorage.getItem('owa_music_suspended') === '1'; } catch { return false; } });
  useEffect(() => { try { localStorage.setItem('owa_music_suspended', musicSuspended ? '1' : '0'); } catch { } }, [musicSuspended]);
  // Ventanas: la gestión vive íntegramente en la extensión v2.0 (independiente
  // de la app). El servidor local y la barra lateral de la app se retiraron.
  const workspace=useWorkspaceNavigation(),activeView=workspace.view,setActiveView=workspace.setView;
  useEffect(() => { if (aiSuspended && activeView === 'ia') setNavigateTo('inicio'); }, [aiSuspended, activeView, setNavigateTo]);
  const timerState=useAppSlice(['isTimerActive']);
  const [studyMounted,setStudyMounted]=useState(activeView==='estudio');
  useEffect(()=>{if(activeView==='estudio'||timerState.isTimerActive)setStudyMounted(true);},[activeView,timerState.isTimerActive]);
  useEffect(()=>{window.addEventListener('pointerdown',primeStudyAlarm,{once:true});return()=>window.removeEventListener('pointerdown',primeStudyAlarm);},[]);
  const dock=useAutoDock(),[launcherOpen,setLauncherOpen]=useState(false);

  useEffect(() => {
    try { localStorage.setItem('owa_active_view_v1', activeView); } catch {}
  }, [activeView]);

  // Auto-clean completed tasks older than 2 months on startup
  useEffect(() => { deleteOldCompletedTasks(); }, []);

  // One persistent YouTube engine serves the integrated music player.
  const ytHolderRef = useRef<HTMLDivElement>(null);
  const ytPlayerRef = useRef<any>(null);
  const pendingLoadRef = useRef<string | null>(null);
  const ytReadyRef=useRef(false);
  const youtubeSourceRef=useRef(youtubeVideoUrl);youtubeSourceRef.current=youtubeVideoUrl;
  const [ytMode, setYtMode] = useState<'api' | 'fallback'>('api');
  const ytRecovery=useYouTubeRecovery({track:tracks.find(track=>track.id===currentTrackId),url:youtubeVideoUrl,onUrl:setYoutubeVideoUrl,onStop:()=>setIsPlayingMusic(false),onNotice:text=>addNotification(text,'error')});
  const musicVolumeRef=useRef(musicVolume);musicVolumeRef.current=musicVolume;
  const isPlayingMusicRef = useRef(isPlayingMusic);
  isPlayingMusicRef.current = isPlayingMusic;

  // The provider loads only when used, never while opening unrelated study views.
  const ytFallbackSrc = useMemo(() => {
    if (!youtubeVideoUrl || ytMode !== 'fallback') return null;
    const ytId = extractYouTubeId(youtubeVideoUrl);
    const ytList = extractPlaylistId(youtubeVideoUrl);
    if (ytList) return `https://www.youtube.com/embed/videoseries?list=${ytList}&autoplay=1&loop=0&rel=0&modestbranding=1&controls=1`;
    if (ytId) return `https://www.youtube.com/embed/${ytId}?autoplay=1&loop=0&rel=0&modestbranding=1&controls=1`;
    return null;
  }, [youtubeVideoUrl, ytMode]);

  const handleYtEnded = useCallback(() => {
    const selected=nextMusicSelection({tracks,currentId:currentTrackId,queue:musicQueue,sourcePool:queueSource?.pool,shuffle:shuffleMode,repeat:repeatMode,history:trackHistory,counts:playCounts,offline:settings.musicOffline});
    setMusicQueue(selected.queue);
    if(selected.id===currentTrackId&&selected.id&&youtubeVideoUrl){generalYtControl.seekTo?.(0);generalYtControl.playVideo?.();setIsPlayingMusic(true);return;}
    if(selected.id)playTrack(selected.id,true);else setIsPlayingMusic(false);
  },[tracks,currentTrackId,musicQueue,queueSource,shuffleMode,repeatMode,trackHistory,playCounts,settings.musicOffline,setMusicQueue,youtubeVideoUrl,setYoutubeVideoUrl,playTrack,setIsPlayingMusic]);
  const handleYtEndedRef = useRef(handleYtEnded);
  handleYtEndedRef.current = handleYtEnded;

  useEffect(() => {
    const url = youtubeVideoUrl;
    const wrap = ytHolderRef.current;
    if (!url || !wrap) {
      pendingLoadRef.current = null;
      try { ytPlayerRef.current?.destroy?.(); } catch { /* noop */ }
      ytPlayerRef.current = null;ytReadyRef.current=false;
      generalYtControl.seekTo = undefined;generalYtControl.getTime=undefined;generalYtControl.getDuration=undefined;generalYtControl.playVideo=undefined;generalYtControl.pauseVideo=undefined;
      return;
    }
    // Sin player todavía → crearlo (la creación pendiente guarda el URL por si cambia antes del ready)
    pendingLoadRef.current = url;
    setYtMode('api');
    setMusicProgressRaw(generalYtControl.pendingSeek?.url===url?generalYtControl.pendingSeek.ratio:0);
    setMusicDuration(0);
    let cancelled = false;
    ensureYouTubeApi().then((ok) => {
      if (cancelled) return;
      if (!ok || !wrap) { setYtMode('fallback'); return; }
      if (cancelled) return;
      try {
        const w = window as any;
        wrap.innerHTML = '';
        const holder = document.createElement('div');
        holder.style.width = '640px';
        holder.style.height = '360px';
        wrap.appendChild(holder);
        const ytId = extractYouTubeId(url);
        const ytList = extractPlaylistId(url);
        const cfg: any = {
          width: '640px', height: '360px',
          playerVars: { origin:window.location.origin,widget_referrer:'https://com.owa.studio/', autoplay: isPlayingMusicRef.current ? 1 : 0, loop: 0, rel: 0, modestbranding: 1, controls: 0, playsinline: 1, disablekb: 1, fs: 0 },
          events: {
            onReady: (e: any) => {
              if (cancelled) return;
              ytPlayerRef.current = e.target;ytReadyRef.current=true;e.target.setVolume?.(Math.round(musicVolumeRef.current*100));
              e.target.getIframe?.()?.setAttribute('tabindex', '-1');e.target.getIframe?.()?.setAttribute('referrerpolicy','strict-origin-when-cross-origin');e.target.getIframe?.()?.setAttribute('allow','autoplay; encrypted-media');
              const d = e.target.getDuration?.() || 0;
              if (d) setMusicDuration(d);
              // La barra de progreso del reproductor general busca DENTRO del iframe
              generalYtControl.getTime=()=>{const p=ytPlayerRef.current,actual=p?.getVideoData?.()?.video_id,expected=extractYouTubeId(youtubeSourceRef.current||'');return actual&&expected&&actual!==expected?Number.NaN:(p?.getCurrentTime?.()||0);};
              generalYtControl.getDuration=()=>ytPlayerRef.current?.getDuration?.()||0;
              generalYtControl.restorePosition=()=>{
                const pending=generalYtControl.pendingSeek,p=ytPlayerRef.current,duration=p?.getDuration?.()||0;
                if(!pending||pending.url!==youtubeSourceRef.current||extractYouTubeId(pending.url)!==p?.getVideoData?.()?.video_id||duration<=0)return;
                try{p.seekTo(pending.ratio*duration,true);setMusicProgressRaw(pending.ratio);setMusicDuration(duration);generalYtControl.pendingSeek=undefined;}catch{/* Retry on the next player state once the recording is ready. */}
              };
              generalYtControl.seekTo = (ratio: number) => {
                const p = ytPlayerRef.current;
                const dur = p?.getDuration?.() || 0;
                if (p && dur > 0) {
                  try { p.seekTo(ratio * dur, true); } catch { /* noop */ }
                }
                setMusicProgressRaw(ratio);
              };
              // Play/Pausa INSTANTÁNEOS: el botón del general los llama de forma
              // síncrona (AppContext) sin esperar el ciclo de render de React
              generalYtControl.playVideo = () => {
                const p = ytPlayerRef.current;
                if (!p) return;
                try { if (p.getPlayerState?.() !== 1) p.playVideo(); } catch { /* noop */ }
              };
              generalYtControl.pauseVideo = () => {
                const p = ytPlayerRef.current;
                if (!p) return;
                try { p.pauseVideo(); } catch { /* noop */ }
              };
              // Si el usuario cambió de canción mientras se cargaba el player, cargar la última
              const pending = pendingLoadRef.current;
              if (pending && pending !== url) {
                pendingLoadRef.current = null;
                const pid = extractYouTubeId(pending);
                const plist = extractPlaylistId(pending);
                try {
                  if (plist && typeof e.target.loadPlaylist === 'function') e.target.loadPlaylist({ list: plist, listType: 'playlist' });
                  else if (pid) e.target.loadVideoById(pid);
                } catch { /* noop */ }
              } else {
                pendingLoadRef.current = null;
              }
              generalYtControl.restorePosition?.();
              if (isPlayingMusicRef.current) {
                try { e.target.playVideo?.(); } catch { /* noop */ }
              }
            },
            onError:(e:any)=>{if(!cancelled)ytRecovery.onError(e);},
            onStateChange: (e: any) => {
              if (cancelled) return;
              generalYtControl.restorePosition?.();
              if (e.data === 1) {
                const d = ytPlayerRef.current?.getDuration?.() || 0;
                if (d) setMusicDuration(d);
              }
              // GUARDIA ANTI-DESYNC: si el usuario quería PAUSADO (pausó durante
              // buffering/carga, cuando pauseVideo aún se traga el comando) y el
              // video igualmente arranca (o empieza a buffering), cortar al INSTANTE.
              if ((e.data === 1 || e.data === 3) && !isPlayingMusicRef.current) {
                try { e.target.pauseVideo?.(); } catch { /* noop */ }
              }
              if (e.data === 0) {
                const actual=e.target.getVideoData?.()?.video_id,expected=extractYouTubeId(youtubeSourceRef.current||'');if(actual&&expected&&actual!==expected)return;
                // ENDED → cola / "después de la actual" / loop — misma lógica del general
                handleYtEndedRef.current();
              }
            },
          },
        };
        if (ytId) cfg.videoId = ytId;
        if (ytList) {
          cfg.playerVars.listType = 'playlist';
          cfg.playerVars.list = ytList;
        } else if (ytId) {
          cfg.playerVars.playlist = ytId;
        }
        const player = new w.YT.Player(holder, cfg);
        if (player && player.getIframe) ytPlayerRef.current = player;
      } catch { if (!cancelled) setYtMode('fallback'); }
    });
    return () => {
      cancelled = true;
      try { ytPlayerRef.current?.destroy?.(); } catch { /* noop */ }
      ytPlayerRef.current = null;ytReadyRef.current=false;generalYtControl.restorePosition=undefined;
      generalYtControl.seekTo = undefined;generalYtControl.getTime=undefined;generalYtControl.getDuration=undefined;generalYtControl.playVideo=undefined;generalYtControl.pauseVideo=undefined;
    };
  }, [!!youtubeVideoUrl, ytRecovery.generation, setMusicDuration, setMusicProgressRaw]);
  useEffect(()=>{if(!youtubeVideoUrl)return;pendingLoadRef.current=youtubeVideoUrl;setMusicProgressRaw(generalYtControl.pendingSeek?.url===youtubeVideoUrl?generalYtControl.pendingSeek.ratio:0);setMusicDuration(0);const player=ytPlayerRef.current;if(!player||!ytReadyRef.current)return;const id=extractYouTubeId(youtubeVideoUrl),list=extractPlaylistId(youtubeVideoUrl);try{if(list)player.loadPlaylist({list,listType:'playlist'});else if(id)player.loadVideoById(id);pendingLoadRef.current=null;generalYtControl.restorePosition?.();if(!isPlayingMusicRef.current)player.pauseVideo();}catch{setIsPlayingMusic(false);addNotification('No se pudo cambiar de canción. Vuelve a intentarlo.','error');}},[youtubeVideoUrl,setMusicDuration,setMusicProgressRaw]);

  // Play/Pausa del botón del reproductor general → playVideo/pauseVideo del iframe
  useEffect(() => {
    const p = ytPlayerRef.current;
    if (!p || !youtubeVideoUrl) return;
    try {
      if (isPlayingMusic) {
        if (typeof p.playVideo === 'function' && p.getPlayerState?.() !== 1) p.playVideo();
      } else if (typeof p.pauseVideo === 'function') {
        p.pauseVideo();
      }
    } catch { /* noop */ }
  }, [isPlayingMusic, youtubeVideoUrl]);

  useEffect(()=>{try{ytPlayerRef.current?.setVolume?.(Math.round(musicVolume*100));}catch{}},[musicVolume,youtubeVideoUrl]);

  // A second-resolution clock avoids redrawing the whole workspace five times a second.
  useEffect(() => {
    if (!youtubeVideoUrl || !isPlayingMusic) return;
    const t = window.setInterval(() => {
      const p = ytPlayerRef.current;
      if (!p || typeof p.getCurrentTime !== 'function') return;
      const cur = generalYtControl.getTime?.();
      if (!Number.isFinite(cur)) return;
      const d = p.getDuration?.() || 0;
      if (d > 0) {
        setMusicProgressRaw(Math.min(1, cur! / d));
        setMusicDuration(d);
      }
    }, 1000);
    return () => window.clearInterval(t);
  }, [youtubeVideoUrl, isPlayingMusic, setMusicProgressRaw, setMusicDuration]);

  useEffect(() => {
    if (navigateTo) {
      let mappedView = navigateTo as string;
      if (mappedView === 'apuntes') mappedView = 'notas';
      if (mappedView === 'flujo') mappedView = 'planificacion';
      if (mappedView === 'curso_detalle' && courseDeepLink) {
        setSelectedCourseId(courseDeepLink.courseId);
        setSelectedCourseTab('archivos' as any);
        setActiveView('curso_detalle');
        setNavigateTo(null);
        return;
      }
      setActiveView(mappedView as ViewId);
      setNavigateTo(null);
    }
  }, [navigateTo, setNavigateTo, courseDeepLink]);

  const autoNav=settings.navigationMode!=='pinned',isCollapsed=!autoNav&&!!settings.navigationCollapsed;
  const toggleSidebar=()=>autoNav?dock.hide():updateSettings({navigationCollapsed:!isCollapsed});
  useEffect(()=>{const note=(e:Event)=>{if(activeView==='notas')workspace.update({noteId:(e as CustomEvent).detail.id});},task=(e:Event)=>{if(activeView==='tareas')workspace.update({taskId:(e as CustomEvent).detail.id});};window.addEventListener('apheka:note-focus',note);window.addEventListener('apheka:task-focus',task);return()=>{window.removeEventListener('apheka:note-focus',note);window.removeEventListener('apheka:task-focus',task);};},[activeView,workspace.update]);
  const [isOAuthCallback, setIsOAuthCallback] = useState(false);

  useEffect(() => {
    const path = window.location.pathname;
    if (path.startsWith('/oauth/callback')) {
      setIsOAuthCallback(true);
    }
  }, []);

  // Close cursos popup when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (coursesPopupRef.current && !coursesPopupRef.current.contains(e.target as Node)) {
        setShowCoursesPopup(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(() => {
    return workspace.current.courseId;
  });
  const [selectedCourseTab, setSelectedCourseTab] = useState<string>('overview');
  useEffect(()=>{workspace.update({courseId:selectedCourseId});},[selectedCourseId,workspace.update]);
  const openNote=useCallback((id:string)=>{window.dispatchEvent(new Event('apheka:flush-editors'));sessionStorage.setItem('apheka_open_note',id);workspace.update({noteId:id});setActiveView('notas');window.dispatchEvent(new Event('apheka:open-note'));},[setActiveView]);
  const openTask=useCallback((id:string)=>{sessionStorage.setItem('apheka_open_task',id);workspace.update({taskId:id});setActiveView('tareas');window.dispatchEvent(new Event('apheka:open-task'));},[setActiveView]);
  useLayoutEffect(()=>{const initial=workspace.current;if(initial.view==='notas'&&initial.noteId)sessionStorage.setItem('apheka_open_note',initial.noteId);if(initial.view==='tareas'&&initial.taskId)sessionStorage.setItem('apheka_open_task',initial.taskId);},[]);
  useEffect(()=>{const key=(e:KeyboardEvent)=>{if(document.querySelector('[role="dialog"][aria-modal="true"]'))return;const editable=(e.target as Element)?.closest?.('input,textarea,[contenteditable="true"]');if((e.ctrlKey||e.metaKey)&&(e.code==='Space'||(!editable&&e.key.toLowerCase()==='k'))){e.preventDefault();setLauncherOpen(true);}if((e.ctrlKey||e.metaKey)&&!editable&&e.key.toLowerCase()==='b'){e.preventDefault();if(autoNav)dock.show();else toggleSidebar();}};const room=(e:Event)=>{sessionStorage.setItem('apheka_music_studio_main',JSON.stringify('escuchando'));setActiveView('musica');window.dispatchEvent(new CustomEvent('apheka:music-room',{detail:(e as CustomEvent).detail}));};window.addEventListener('keydown',key);window.addEventListener('apheka:open-music-room',room);return()=>{window.removeEventListener('keydown',key);window.removeEventListener('apheka:open-music-room',room);};},[autoNav,isCollapsed,setActiveView]);
  useEffect(() => {
    try {
      if (selectedCourseId) localStorage.setItem('owa_selected_course_id', selectedCourseId);
      else localStorage.removeItem('owa_selected_course_id');
    } catch { /* cuota */ }
  }, [selectedCourseId]);
  useEffect(() => {
    // Solo expulsar de la vista del curso cuando la carga de datos ya terminó
    // (courses.length > 0): durante el arranque courses llega vacío y sin esta
    // guarda la vista del curso restaurada saltaría a la lista de cursos.
    if (courses.length > 0 && activeView === 'curso_detalle' && selectedCourseId && !courses.some(c => c && c.id === selectedCourseId)) {
      setActiveView('cursos');
    }
  }, [activeView, selectedCourseId, courses]);
  const [showCoursesPopup, setShowCoursesPopup] = useState(false);
  const coursesPopupRef = useRef<HTMLDivElement>(null);
  const [showPopupAddModal, setShowPopupAddModal] = useState(false);
  const [popupAddName, setPopupAddName] = useState('');
  const [popupAddColor, setPopupAddColor] = useState('#758bfa');
  const [popupAddCover, setPopupAddCover] = useState<string | undefined>(undefined);
  const fileInputRefPopup = useRef<HTMLInputElement>(null);
  const EASE_POPUP = 'cubic-bezier(0.16, 1, 0.3, 1)';
  const backgroundLoadAttemptedRef = useRef(false);

  useEffect(() => {
    const root = document.documentElement;
    const h2r = (hex: string) => {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return { r, g, b };
    };
    const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));

    if (settings.useThreeColors) {
      root.setAttribute('data-theme',((0.2126*parseInt(settings.surfaceColor?.slice(1,3)||'0a',16)+0.7152*parseInt(settings.surfaceColor?.slice(3,5)||'0a',16)+0.0722*parseInt(settings.surfaceColor?.slice(5,7)||'0c',16))/255)<.5?'oscuro':'claro');
      const c1 = settings.accentColor;
      const c2 = settings.secondaryColor || c1;
      const c3 = settings.surfaceColor || '#0a0a0c';
      const b3 = h2r(c3);
      const lum = (0.2126 * b3.r + 0.7152 * b3.g + 0.0722 * b3.b) / 255;
      const isDark = lum < 0.5;
      const white = isDark ? 255 : 0;
      const dir = isDark ? 1 : -1;

      // Color 1 — accent
      root.style.setProperty('--accent', c1);
      const accentRGB=h2r(c1);root.style.setProperty('--accent-text',(accentRGB.r*.2126+accentRGB.g*.7152+accentRGB.b*.0722)>155?'#102026':'#ffffff');
      root.style.setProperty('--theme-secondary', c2);
      root.style.setProperty('--theme-tertiary', c3);
      const a1 = h2r(c1);
      root.style.setProperty('--accent-soft', `rgba(${a1.r},${a1.g},${a1.b},0.12)`);
      root.style.setProperty('--accent-glow', `rgba(${a1.r},${a1.g},${a1.b},0.30)`);
      root.style.setProperty('--accent-dim', `rgba(${a1.r},${a1.g},${a1.b},0.06)`);
      root.style.setProperty('--led-color', c1);
      root.style.setProperty('--led-glow', `rgba(${a1.r},${a1.g},${a1.b},0.45)`);
      root.style.setProperty('--led-dim', `rgba(${a1.r},${a1.g},${a1.b},0.08)`);
      root.style.setProperty('--led-segment-off', `rgba(${a1.r},${a1.g},${a1.b},0.06)`);

      // Color 3 — background & all surface/border/text variants
      const lift = (amount: number) =>
        `rgb(${clamp(b3.r + dir * amount)},${clamp(b3.g + dir * amount)},${clamp(b3.b + dir * amount)})`;
      root.style.setProperty('--bg-base', c3);
      root.style.setProperty('--bg-primary', c3);
      root.style.setProperty('--bg-secondary', lift(4));
      root.style.setProperty('--bg-surface', lift(8));
      root.style.setProperty('--bg-elevated', lift(14));
      root.style.setProperty('--bg-deep', lift(-6));
      root.style.setProperty('--surface', lift(6));
      root.style.setProperty('--surface-elevated', lift(16));
      root.style.setProperty('--surface-hover', lift(20));

      const textBase = isDark ? 255 : 0;
      root.style.setProperty('--text-primary', `rgba(${textBase},${textBase},${textBase},0.92)`);
      root.style.setProperty('--text-secondary', `rgba(${textBase},${textBase},${textBase},0.70)`);
      root.style.setProperty('--text-tertiary', `rgba(${textBase},${textBase},${textBase},0.54)`);
      root.style.setProperty('--text-muted', `rgba(${textBase},${textBase},${textBase},0.42)`);

      const borderAlpha = isDark ? 0.06 : 0.08;
      root.style.setProperty('--border-default', `rgba(${textBase},${textBase},${textBase},${borderAlpha})`);
      root.style.setProperty('--border-subtle', `rgba(${textBase},${textBase},${textBase},${borderAlpha * 0.5})`);
      root.style.setProperty('--border-strong', `rgba(${textBase},${textBase},${textBase},${borderAlpha * 1.6})`);
      root.style.setProperty('--border-soft', `rgba(${textBase},${textBase},${textBase},${borderAlpha})`);
      root.style.setProperty('--border-hover', `rgba(${textBase},${textBase},${textBase},${borderAlpha * 1.3})`);

      root.style.setProperty('--bg-hover', `rgba(${textBase},${textBase},${textBase},0.03)`);
      root.style.setProperty('--bg-active', `rgba(${textBase},${textBase},${textBase},0.05)`);
    } else {
      if (settings.theme === 'claro') {
        root.setAttribute('data-theme', 'claro');
      } else if (settings.theme === 'oscuro') {
        root.setAttribute('data-theme', 'oscuro');
      } else if (settings.theme === 'vibrante') {
        root.setAttribute('data-theme', 'vibrante');
      } else {
        const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        root.setAttribute('data-theme', isDark ? 'oscuro' : 'claro');
      }
      const c = settings.accentColor;
      root.style.setProperty('--accent', c);
      const accentRGB=h2r(c);root.style.setProperty('--accent-text',(accentRGB.r*.2126+accentRGB.g*.7152+accentRGB.b*.0722)>155?'#102026':'#ffffff');
      const { r, g, b } = h2r(c);
      root.style.setProperty('--accent-soft', `rgba(${r},${g},${b},0.12)`);
      root.style.setProperty('--accent-glow', `rgba(${r},${g},${b},0.30)`);
      root.style.setProperty('--accent-dim', `rgba(${r},${g},${b},0.06)`);
      root.style.setProperty('--led-color', c);
      root.style.setProperty('--led-glow', `rgba(${r},${g},${b},0.45)`);
      root.style.setProperty('--led-dim', `rgba(${r},${g},${b},0.08)`);
      root.style.setProperty('--led-segment-off', `rgba(${r},${g},${b},0.06)`);
      
      // Cleanup 3-color mode JS variables so CSS values take effect
      root.style.removeProperty('--bg-base');
      root.style.removeProperty('--bg-primary');
      root.style.removeProperty('--bg-secondary');
      root.style.removeProperty('--bg-surface');
      root.style.removeProperty('--bg-elevated');
      root.style.removeProperty('--bg-deep');
      root.style.removeProperty('--theme-secondary');
      root.style.removeProperty('--theme-tertiary');
      root.style.removeProperty('--surface');
      root.style.removeProperty('--surface-elevated');
      root.style.removeProperty('--surface-hover');
      root.style.removeProperty('--border-soft');
      root.style.removeProperty('--border-hover');
      root.style.removeProperty('--border-default');
      root.style.removeProperty('--border-subtle');
      root.style.removeProperty('--border-strong');
      root.style.removeProperty('--text-primary');
      root.style.removeProperty('--text-secondary');
      root.style.removeProperty('--text-tertiary');
      root.style.removeProperty('--text-muted');
      root.style.removeProperty('--bg-hover');
      root.style.removeProperty('--bg-active');
    }
    
    if (settings.useThreeColors) {
      const c3 = settings.surfaceColor || '#0a0a0c';
      const b = parseInt(c3.slice(5,7), 16);
      const g = parseInt(c3.slice(3,5), 16);
      const r = parseInt(c3.slice(1,3), 16);
      const selectScheme = (0.2126*r + 0.7152*g + 0.0722*b)/255 < 0.5 ? 'dark' : 'light';
      root.style.colorScheme = selectScheme;
      root.style.setProperty('--select-scheme', selectScheme);
    } else {
      const schemeIsDark = root.getAttribute('data-theme') === 'oscuro' || root.getAttribute('data-theme') === 'vibrante';
      const selectScheme = schemeIsDark ? 'dark' : 'light';
      root.style.colorScheme = selectScheme;
      root.style.setProperty('--select-scheme', selectScheme);
    }

    // Read the current theme before freezing opaque surface colors. A previous
    // inline snapshot otherwise overrides the new theme's raw color variables.
    const surfaceNames=['base','surface','elevated','deep'];
    for(const name of surfaceNames)root.style.removeProperty('--bg-'+name+'-raw');
    const resolved=getComputedStyle(root);
    const opaqueSurfaces=surfaceNames.map(name=>[name,resolved.getPropertyValue('--bg-'+name).trim()] as const);
    for(const [name,value] of opaqueSurfaces)root.style.setProperty('--bg-'+name+'-raw',value);
    root.style.backgroundColor=resolved.getPropertyValue('--bg-base').trim();document.body.style.backgroundColor=resolved.getPropertyValue('--bg-base').trim();
    root.style.setProperty('--font-primary', settings.fontFamily);
    
    const applyBg = (url: string) => {
      root.style.setProperty('--app-bg-image', `url("${url}")`);
      root.style.setProperty('--app-bg-blend', 'normal');
    };
    const removeBg = () => {
      root.style.removeProperty('--app-bg-image');
      root.style.removeProperty('--app-bg-blend');
    };

    if (settings.backgroundImage && settings.appearanceMode!=='colors') {
      applyBg(settings.backgroundImage);
      document.documentElement.dataset.hasBg = 'true';
    } else {
      removeBg();
      delete document.documentElement.dataset.hasBg;
    }
    
    root.style.setProperty('--ui-opacity', (settings.uiOpacity ?? 0.85).toString());
    root.style.setProperty('--bg-brightness', `${settings.backgroundBrightness ?? 100}%`);
    root.style.setProperty('--bg-blur', `${settings.backgroundBlur ?? 0}px`);
    root.style.setProperty('--bg-overlay', `${(settings.backgroundOverlay ?? 0) / 100}`);
    root.style.setProperty('--bg-size', settings.backgroundSize === 'tile' ? 'auto' : (settings.backgroundSize || 'cover'));
    root.style.setProperty('--bg-repeat', settings.backgroundSize === 'tile' ? 'repeat' : 'no-repeat');
  }, [settings.theme, settings.accentColor, settings.fontFamily, settings.backgroundImage, settings.uiOpacity, settings.backgroundBrightness, settings.backgroundBlur, settings.backgroundOverlay, settings.backgroundSize,settings.appearanceMode, settings.useThreeColors, settings.secondaryColor, settings.surfaceColor]);

  const initials = settings.userName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  const NAV_ITEMS = [
    { id: 'inicio', label: 'Inicio', icon: Home },
    { id: 'estudio', label: 'Estudio', icon: Clock },
    { id: 'tareas', label: 'Tareas', icon: ListTodo },
    { id: 'notas', label: 'Notas', icon: NotebookPen },
    { id: 'musica', label: 'Música', icon: Music },
    { id: 'planificacion', label: 'Planificador', icon: Calendar },
    { id: 'cursos', label: 'Cursos', icon: Layers },
    { id: 'ia', label: 'IA', icon: Bot },
  ];

  const handleCourseClick = (courseId: string) => {
    setSelectedCourseId(courseId);
    setActiveView('curso_detalle');
  };

  const activeCourse = courses.find(c => c && c.id === selectedCourseId) || null;

  // Collapsed sidebar: short click → last course; long-press → popup with all courses
  const coursesPressTimer = useRef<number | null>(null);
  const coursesLongPressFired = useRef(false);
  const handleCoursesPointerDown = () => {
    if (coursesPressTimer.current) window.clearTimeout(coursesPressTimer.current);
    coursesLongPressFired.current = false;
    coursesPressTimer.current = window.setTimeout(() => {
      coursesPressTimer.current = null;
      coursesLongPressFired.current = true;
      setShowCoursesPopup(true);
    }, 450);
  };
  const handleCoursesPointerEnd = () => {
    if (coursesPressTimer.current) { window.clearTimeout(coursesPressTimer.current); coursesPressTimer.current = null; }
  };
  const handleCollapsedCoursesClick = () => {
    if (coursesLongPressFired.current) { coursesLongPressFired.current = false; return; }
    if (selectedCourseId && courses.some(c => c && c.id === selectedCourseId)) {
      setActiveView('curso_detalle');
    } else {
      setShowCoursesPopup(prev => !prev);
    }
  };

  return (
    <div className={'app-layout studio-environment single-environment '+(autoNav?'nav-auto':'nav-pinned')+(isCollapsed?' nav-collapsed':'')} data-auto-dock={autoNav} style={{'--navigation-width':(isCollapsed?64:224)+'px'} as React.CSSProperties}>
      <AnimatedWallpaper/>
      <NotificationNavigation/><McpBridge /><CatalogDownloadBridge/>{!aiSuspended&&<Suspense fallback={null}><CharvisSidebar pageActive={activeView==='ia'} activeView={activeView}/></Suspense>}
      <EditorBlockMenu/>
      
      {autoNav&&<><button ref={dock.trigger} className="app-navigation-handle" aria-label="Abrir navegación" onClick={dock.show}><span aria-hidden="true"/></button><div className="desktop-dock-edge" aria-hidden="true" onPointerEnter={dock.show} onPointerLeave={dock.leave}/></>}
      <aside id="apheka-navigation-dock" ref={dock.root} inert={autoNav&&!dock.open} aria-hidden={autoNav&&!dock.open} data-open={!autoNav||dock.open} onPointerEnter={dock.cancel} onPointerLeave={dock.leave} onFocusCapture={dock.show} onBlurCapture={e=>{if(!e.currentTarget.contains(e.relatedTarget))dock.leave();}} onClick={e=>{if(autoNav&&(e.target as Element).closest('.sidebar-nav-btn'))dock.hide();}} className={`sidebar ${isCollapsed ? 'collapsed' : ''}${coverModalTrackId ? ' cover-tinted' : ''}`}>

        {/* ─── Logo / Home Anchor (click to toggle) ─── */}
        <div className="sidebar-logo" role="button" tabIndex={0} aria-label={isCollapsed ? 'Expandir menú' : 'Contraer menú'} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();toggleSidebar();}}} onClick={toggleSidebar} style={{ cursor: 'pointer' }}>
          <img src="/owa_logo.png" alt="APHEKA" className="sidebar-logo-img" />
          {!isCollapsed && <AphekaWordmark />}
        </div>

        {/* ─── Navigation ─── */}
        <nav className="sidebar-nav" onContextMenu={e => {
          e.preventDefault();
          // Si Música está suspendida, el click derecho en la barra la devuelve
          if (musicSuspended) { setMusicSuspended(false); return; }
        }}>
          {NAV_ITEMS.filter(item => !(musicSuspended && item.id === 'musica') && !(aiSuspended && item.id === 'ia')).map(item => (
            <div key={item.id} style={{ position: 'relative' }}
              onContextMenu={item.id==='ia'?(e=>{e.preventDefault();e.stopPropagation();setCharvisEnabled(false);}):item.id === 'musica' ? (e => { e.preventDefault(); e.stopPropagation(); setMusicSuspended(true); if (activeView === 'musica') setNavigateTo('inicio'); }) : undefined}>
              {item.id === 'cursos' && isCollapsed ? (
                <button
                  onPointerDown={handleCoursesPointerDown}
                  onPointerUp={handleCoursesPointerEnd}
                  onPointerLeave={handleCoursesPointerEnd}
                  onClick={handleCollapsedCoursesClick}
                  className={`sidebar-nav-btn ${activeView === 'cursos' || activeView === 'curso_detalle' ? 'active' : ''}`}
                  aria-label={item.label} title={item.label}
                  style={activeView === 'curso_detalle' && activeCourse ? {
                    boxShadow: `inset 0 0 0 1px ${activeCourse.color}`,
                    background: `linear-gradient(135deg, color-mix(in srgb, ${activeCourse.color} 16%, transparent), color-mix(in srgb, ${activeCourse.color} 7%, transparent))`,
                    color: activeCourse.color,
                  } : undefined}
                >
                  <item.icon size={20} strokeWidth={1.5} />
                </button>
              ) : (
                <button
                  onClick={() => {
                    if (item.id === 'cursos') {
                      setShowCoursesPopup(false);
                      setActiveView('cursos');
                    } else {
                      setActiveView(item.id as ViewId);
                      setShowCoursesPopup(false);
                    }
                  }}
                  className={`sidebar-nav-btn ${activeView === item.id ? 'active' : ''}`}
                  aria-label={item.label} title={item.id==='ia'?'IA · clic derecho para desactivar. Se habilita en Sistema.':isCollapsed?item.label:undefined}
                >
                  <item.icon size={20} strokeWidth={1.5} />
                  {!isCollapsed && <span className="sidebar-nav-label">{item.label}</span>}
                </button>
              )}
              {/* Collapsed sidebar: cursos popup */}
              {item.id === 'cursos' && isCollapsed && showCoursesPopup && (
                <div ref={coursesPopupRef}
                  style={{
                    position: 'absolute', left: '100%', top: '50%', transform: 'translateY(-50%)', marginLeft: 8,
                    width: 280, maxHeight: 'min(680px, 88vh)', overflowY: 'auto',
                    background: 'var(--bg-elevated)', border: '1px solid var(--border-default)',
                    borderRadius: 14, padding: 10, zIndex: 9999, boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
                  }}
                >
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)', padding: '8px 12px 4px' }}>
                    Mis Cursos
                  </div>
                  {courses.map(course => (
                    <button key={course.id} onClick={() => { setSelectedCourseId(course.id); setActiveView('curso_detalle'); setShowCoursesPopup(false); }}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 12px', borderRadius: 8, border: 'none', background: 'transparent', color: 'var(--text-primary)', fontSize: 12, cursor: 'pointer', textAlign: 'left', transition: 'background 150ms' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: course.color, flexShrink: 0 }} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{course.name}</span>
                    </button>
                  ))}
                  <button onClick={() => { setPopupAddName(''); setPopupAddColor('#758bfa'); setPopupAddCover(undefined); setShowPopupAddModal(true); }}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '9px 12px', borderRadius: 8, border: 'none', background: 'transparent', color: 'var(--accent)', fontSize: 11, fontWeight: 600, cursor: 'pointer', textAlign: 'left', marginTop: 4 }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <Plus size={12} /> Añadir curso
                  </button>
                </div>
              )}
            </div>
          ))}
        </nav>

        {/* ─── Spacer ─── */}
        <div className="sidebar-spacer" />

        {/* ─── Settings (always at bottom) ─── */}
        <div className="sidebar-footer">
          <button aria-label="Ajustes" title={isCollapsed ? 'Ajustes' : undefined} onClick={() => setActiveView('ajustes')} className={`sidebar-nav-btn ${activeView === 'ajustes' ? 'active' : ''}`}>
            <Settings size={20} strokeWidth={1.5} />
            {!isCollapsed && <span className="sidebar-nav-label">Ajustes</span>}
          </button>
        </div>
      </aside>

      <main className="main-area" style={{ position: 'relative' }}>
        {showRestPrompt && activeView !== 'estudio' && (
          <div onClick={() => { handlePomodoroBannerClick(); setActiveView('estudio'); }}
            style={{
              position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 9999,
              padding: '12px 24px', borderRadius: 10, backdropFilter: 'blur(16px)',
              background: 'rgba(245,158,11,0.10)',
              border: '1px solid rgba(245,158,11,0.22)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10,
              animation: 'fadeInDown 300ms ease-out',
            }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#F59E0B', flexShrink: 0, boxShadow: '0 0 8px rgba(245,158,11,0.4)' }} />
            <span style={{ color: '#fff', fontSize: 12.5, fontWeight: 500, fontFamily: "'Inter', sans-serif", letterSpacing: '0.01em', whiteSpace: 'nowrap' }}>Te espera un descanso</span>
          </div>
        )}
        <div className="desktop-stage">
        {!hydrated ? (<div className="desktop-startup" role="status"><Loader2 size={20} className="spin"/><span>Preparando tu espacio…</span></div>) : isOAuthCallback ? (
          <OAuthCallback />
        ) : (
          <div key={activeView} data-apheka-view={activeView} className="fade-in-animation" style={{ flex: 1, overflow: 'hidden',display:activeView==='estudio'?'none':undefined }}>
            <Suspense fallback={<div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Loader2 className="spin" size={22} style={{ color: 'var(--text-tertiary)' }} /></div>}>
              {activeView === 'inicio' && <Inicio />}
              
              {activeView === 'tareas' && <Tareas />}
              {activeView === 'notas' && <Notas />}
              {activeView === 'musica' && <Musica workspaceId="main"/>}
              {activeView === 'planificacion' && <Planificacion />}
              {activeView === 'cursos' && <CursosHub onSelectCourse={(courseId) => { setSelectedCourseId(courseId); setActiveView('curso_detalle'); }} onTabSelect={(courseId, tab) => { setSelectedCourseId(courseId); setSelectedCourseTab(tab); setActiveView('curso_detalle'); }} />}
              {activeView === 'ajustes' && <Ajustes />}
            {activeView === 'curso_detalle' && <Cursos initialCourseId={selectedCourseId || undefined} initialTab={selectedCourseTab as any} onNavigate={(v) => setActiveView(v as ViewId)} />}
            {activeView === 'ia' && !aiSuspended && <IA/>}
            </Suspense>
          </div>
        )}
        
        {hydrated&&studyMounted&&!isOAuthCallback&&<div data-apheka-view="estudio" style={{display:activeView==="estudio"?"flex":"none",flex:1,minHeight:0,overflow:"hidden"}}><Suspense fallback={null}><ViewActivity.Provider value={activeView==='estudio'}><Estudio/></ViewActivity.Provider></Suspense></div>}
        </div>
        {launcherOpen&&<WorkspaceLauncher onClose={()=>setLauncherOpen(false)} onNavigate={(view,courseId)=>{if(courseId){setSelectedCourseId(courseId);setSelectedCourseTab('overview');}setActiveView(view);}} onOpenNote={openNote} onOpenTask={openTask}/>}
        {youtubeVideoUrl && <div inert aria-hidden="true" ref={ytHolderRef} style={{ position: 'fixed', top: 0, left: -10000, width: 640, height: 360, zIndex: -1, opacity: 0.01, pointerEvents: 'none' }} />}
        {ytFallbackSrc && (
          <iframe tabIndex={-1} aria-hidden="true" inert src={ytFallbackSrc} title="YouTube" allow="autoplay; encrypted-media"
            style={{ position: 'fixed', top: 0, left: -10000, width: 640, height: 360, border: 0, zIndex: -1, opacity: 0.01, pointerEvents: 'none' }} />
        )}
        <ReleaseNotice/>
        <MediaDownloadBridge/><GlobalPlayer sidebarCollapsed={isCollapsed} />
        <TrackArtworkDialog/>
        <HabitReminderHost/><SchedulePeek onConfigure={()=>{try{localStorage.setItem('owa_show_schedule','true');}catch{}setActiveView('planificacion');window.dispatchEvent(new Event('apheka:open-schedule'));}}/>
        <AppCommandsPanel onNavigate={view=>setActiveView(view)} onOpenNote={openNote} onOpenTask={openTask}/>

        {/* Contenedor global de avisos (react-hot-toast) — sin esto ningún toast() se muestra */}
        <Toaster
          position="top-center"
          gutter={8}
          toastOptions={{
            duration: 2800,
            style: {
              background: 'var(--bg-elevated-raw)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-default)',
              borderRadius: 11,
              fontSize: 12,
              fontWeight: 500,
              fontFamily: "'Inter', sans-serif",
              padding: '10px 14px',
              boxShadow: '0 6px 20px rgba(0,0,0,0.12)',
              maxWidth: 480,
            },
            success: { icon: null, style:{background:'color-mix(in srgb, #10b981 14%, var(--bg-elevated-raw))',border:'1px solid color-mix(in srgb, #10b981 32%, var(--border-default))'},iconTheme: { primary: '#10B981', secondary: '#0b0c0f' } },
            error: { style:{background:'color-mix(in srgb, #ef4444 14%, var(--bg-elevated-raw))',border:'1px solid color-mix(in srgb, #ef4444 32%, var(--border-default))'},iconTheme: { primary: '#EF4444', secondary: '#0b0c0f' } },
          }}
        />
      </main>

      {importState.active && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'color-mix(in srgb, var(--bg-base) 80%, transparent)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          animation: 'fadeIn 0.3s ease-out',
        }}>
          <div style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-default)',
            borderRadius: 16,
            padding: '32px 40px',
            width: '100%',
            maxWidth: 460,
            boxShadow: '0 20px 60px color-mix(in srgb, var(--accent) 8%, transparent)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
          }}>
            {/* High-tech rotating gradient loader */}
            <div style={{ position: 'relative', width: 80, height: 80, marginBottom: 24 }}>
              <svg width="80" height="80" viewBox="0 0 80 80">
                <circle cx="40" cy="40" r="34" stroke="var(--border-soft)" strokeWidth="4" fill="none" />
                <circle
                  cx="40"
                  cy="40"
                  r="34"
                  stroke="var(--accent)"
                  strokeWidth="4"
                  strokeDasharray="213"
                  strokeDashoffset={213 - (213 * importState.overallProgress) / 100}
                  strokeLinecap="round"
                  fill="none"
                  transform="rotate(-90 40 40)"
                  style={{ transition: 'stroke-dashoffset 0.3s ease' }}
                />
              </svg>
              <div style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 16,
                fontWeight: 700,
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-mono)'
              }}>
                {importState.overallProgress}%
              </div>
            </div>

            <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8, letterSpacing: '-0.02em' }}>
              Procesando Biblioteca de Música
            </h3>
            
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>
              Cargando canción <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{importState.current}</span> de <span style={{ fontWeight: 600 }}>{importState.total}</span>
            </p>

            <div style={{
              width: '100%',
              background: 'var(--bg-elevated)',
              borderRadius: 8,
              padding: 12,
              marginBottom: 20,
              border: '1px solid var(--border-subtle)',
              textAlign: 'left'
            }}>
              <div style={{
                fontSize: 11,
                color: 'var(--text-tertiary)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: 4
              }}>
                Archivo actual
              </div>
              <div style={{
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--text-primary)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                marginBottom: 10
              }}>
                {importState.fileName || 'Preparando archivo...'}
              </div>

              {/* Individual phase checklist */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: importState.phase === 'loading_file' ? 'var(--accent)' : 'var(--text-secondary)' }}>
                  <div style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: importState.phase === 'loading_file' ? 'var(--accent)' : (['extracting_metadata', 'validating_audio', 'saving_to_db', 'finished'].includes(importState.phase) ? 'var(--accent)' : 'transparent'),
                    boxShadow: importState.phase === 'loading_file' ? '0 0 8px var(--accent)' : 'none'
                  }} />
                  <span style={{ textDecoration: (['extracting_metadata', 'validating_audio', 'saving_to_db', 'finished'].includes(importState.phase)) ? 'line-through' : 'none', opacity: (['extracting_metadata', 'validating_audio', 'saving_to_db', 'finished'].includes(importState.phase)) ? 0.5 : 1 }}>
                    Lectura e indexación en disco
                  </span>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: importState.phase === 'extracting_metadata' ? 'var(--accent)' : 'var(--text-secondary)' }}>
                  <div style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: importState.phase === 'extracting_metadata' ? 'var(--accent)' : (['validating_audio', 'saving_to_db', 'finished'].includes(importState.phase) ? 'var(--accent)' : 'transparent'),
                    boxShadow: importState.phase === 'extracting_metadata' ? '0 0 8px var(--accent)' : 'none'
                  }} />
                  <span style={{ textDecoration: (['validating_audio', 'saving_to_db', 'finished'].includes(importState.phase)) ? 'line-through' : 'none', opacity: (['validating_audio', 'saving_to_db', 'finished'].includes(importState.phase)) ? 0.5 : 1 }}>
                    Extracción de metadatos ID3 (Título, Artista, Portada)
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: importState.phase === 'validating_audio' ? 'var(--accent)' : 'var(--text-secondary)' }}>
                  <div style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: importState.phase === 'validating_audio' ? 'var(--accent)' : (['saving_to_db', 'finished'].includes(importState.phase) ? 'var(--accent)' : 'transparent'),
                    boxShadow: importState.phase === 'validating_audio' ? '0 0 8px var(--accent)' : 'none'
                  }} />
                  <span style={{ textDecoration: (['saving_to_db', 'finished'].includes(importState.phase)) ? 'line-through' : 'none', opacity: (['saving_to_db', 'finished'].includes(importState.phase)) ? 0.5 : 1 }}>
                    Validación de reproducción y duración de audio
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: importState.phase === 'saving_to_db' ? 'var(--accent)' : (importState.phase === 'finished' ? 'var(--accent)' : 'var(--text-secondary)') }}>
                  <div style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: importState.phase === 'saving_to_db' ? 'var(--accent)' : (importState.phase === 'finished' ? 'var(--accent)' : 'transparent'),
                    boxShadow: importState.phase === 'saving_to_db' ? '0 0 8px var(--accent)' : 'none'
                  }} />
                  <span style={{ textDecoration: importState.phase === 'finished' ? 'line-through' : 'none', opacity: importState.phase === 'finished' ? 0.5 : 1 }}>
                    Guardando en base de datos local
                  </span>
                </div>
              </div>
            </div>

            {/* Horizontal Overall Progress Bar */}
            <div style={{ width: '100%', height: 4, background: 'var(--bg-hover)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{
                width: `${importState.overallProgress}%`,
                height: '100%',
                background: 'linear-gradient(90deg, var(--accent) 0%, var(--accent-glow) 100%)',
                boxShadow: '0 0 8px var(--accent-glow)',
                transition: 'width 0.3s ease-out'
              }} />
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginTop: 8, fontSize: 11, color: 'var(--text-tertiary)' }}>
              <span>Procesando...</span>
              <span>Por favor, no cierres la aplicación</span>
            </div>
          </div>
        </div>
      )}

      <DownloadManager />

      {/* Add course modal (from collapsed popup) */}
      {showPopupAddModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 2000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)'
        }} onClick={() => setShowPopupAddModal(false)}>
          <div style={{
            width: 420, padding: 24, borderRadius: 'var(--radius-lg)',
            background: "linear-gradient(135deg, var(--bg-elevated) 0%, var(--bg-base) 100%)",
            border: "1px solid var(--border-default)",
            boxShadow: "var(--shadow-elevated)"
          }} onClick={e => e.stopPropagation()}>
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              alignItems: 'center', marginBottom: 20
            }}>
              <h3 style={{
                fontSize: 16, fontWeight: 600, color: 'var(--text-primary)',
                display: 'flex', alignItems: 'center', gap: 8,
                fontFamily: "'Inter Tight', sans-serif", margin: 0
              }}>
                <GraduationCap size={18} style={{ color: "var(--accent)" }} /> Nueva Asignatura
              </h3>
              <button onClick={() => setShowPopupAddModal(false)} style={{
                background: 'none', border: 'none', color: 'var(--text-muted)',
                cursor: 'pointer', padding: 4, display: 'flex'
              }}><X size={16} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{
                  fontSize: 9, fontWeight: 700, color: 'var(--text-tertiary)',
                  textTransform: 'uppercase', letterSpacing: '0.08em',
                  display: 'block', marginBottom: 6
                }}>Nombre</label>
                <input value={popupAddName} onChange={e => setPopupAddName(e.target.value)}
                  className="input-base"
                  style={{
                    width: '100%', height: 40, fontSize: 13, padding: '0 12px',
                    borderRadius: 'var(--radius-sm)', boxSizing: 'border-box'
                  }}
                  placeholder="Ej: Cálculo, Biología..." autoFocus />
              </div>
              <div>
                <label style={{
                  fontSize: 9, fontWeight: 700, color: 'var(--text-tertiary)',
                  textTransform: 'uppercase', letterSpacing: '0.08em',
                  display: 'block', marginBottom: 6
                }}>Color</label>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {['#E11D48','#3B82F6','#10B981','#F59E0B','#8B5CF6','#EC4899',
                    '#06B6D4','#84CC16','#F97316','#6366F1','#14B8A6','#D946EF',
                    '#0EA5E9','#22C55E','#EAB308','#A855F7','#758bfa','#6B7280'
                  ].map(c => (
                    <button key={c} onClick={() => setPopupAddColor(c)}
                      style={{
                        width: 22, height: 22, borderRadius: '50%',
                        border: `2px solid ${popupAddColor === c ? '#fff' : 'transparent'}`,
                        background: c, cursor: 'pointer',
                        outline: popupAddColor === c ? `2px solid ${c}` : 'none',
                        outlineOffset: 1, transition: 'all 150ms'
                      }} />
                  ))}
                </div>
              </div>
              <div>
                <label style={{
                  fontSize: 9, fontWeight: 700, color: 'var(--text-tertiary)',
                  textTransform: 'uppercase', letterSpacing: '0.08em',
                  display: 'block', marginBottom: 6
                }}>Banner (opcional)</label>
                {popupAddCover ? (
                  <div style={{
                    position: 'relative', width: '100%', aspectRatio: '16/7',
                    borderRadius: 'var(--radius-sm)', overflow: 'hidden',
                    border: '1px solid var(--border-subtle)'
                  }}>
                    <img src={popupAddCover} alt=""
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <button onClick={() => setPopupAddCover(undefined)} style={{
                      position: 'absolute', top: 6, right: 6,
                      width: 24, height: 24, borderRadius: '50%',
                      background: 'rgba(239,68,68,0.9)', border: 'none',
                      color: '#fff', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}><X size={12} /></button>
                  </div>
                ) : (
                  <button onClick={() => fileInputRefPopup.current?.click()}
                    style={{
                      width: '100%', height: 80, borderRadius: 'var(--radius-sm)',
                      border: '1px dashed var(--border-default)',
                      background: 'transparent', color: 'var(--text-secondary)',
                      cursor: 'pointer', display: 'flex', flexDirection: 'column',
                      alignItems: 'center', justifyContent: 'center', gap: 6,
                      transition: "all 200ms " + EASE_POPUP
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.borderColor = 'var(--accent)';
                      e.currentTarget.style.color = 'var(--accent)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.borderColor = 'var(--border-default)';
                      e.currentTarget.style.color = 'var(--text-secondary)';
                    }}>
                    <ImageIcon size={18} style={{ color: "var(--accent)" }} />
                    <span style={{
                      fontSize: 9, fontWeight: 600, textTransform: 'uppercase',
                      letterSpacing: '0.08em'
                    }}>Subir Banner</span>
                  </button>
                )}
                <input type="file" ref={fileInputRefPopup} style={{ display: 'none' }}
                  accept="image/*" onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = (event) => { setPopupAddCover(event.target?.result as string); toast.success('Imagen cargada'); };
                    reader.readAsDataURL(file);
                  }} />
              </div>
              <button onClick={() => {
                const name = popupAddName.trim();
                if (!name) { toast.error('El nombre es obligatorio'); return; }
                if (courses.some(c => c.name.toLowerCase() === name.toLowerCase())) { toast.error('Ya existe'); return; }
                const newId = addCourse({ name, color: popupAddColor, progress: 0, totalTasks: 0, completedTasks: 0, hoursStudied: 0, coverImage: popupAddCover, coverUrl: popupAddCover, groups: [], studyTopics: [] });
                setPopupAddName(''); setPopupAddColor('#758bfa'); setPopupAddCover(undefined); setShowPopupAddModal(false);
                setSelectedCourseId(typeof newId === 'string' ? newId : '');
                setActiveView('curso_detalle');
                setShowCoursesPopup(false);
                toast.success('Asignatura creada');
              }} disabled={!popupAddName.trim()}
                style={{
                  width: '100%', height: 40, border: 'none',
                  borderRadius: 'var(--radius-sm)', cursor: 'pointer', marginTop: 4,
                  background: popupAddName.trim() ? "var(--accent)" : "var(--bg-hover)",
                  color: popupAddName.trim() ? "#fff" : "var(--text-muted)",
                  fontSize: 12, fontWeight: 600, fontFamily: "var(--font-primary)",
                  transition: "all 200ms " + EASE_POPUP
                }}>
                Crear Asignatura
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PiP Video Player */}

      {/* Menú contextual global de imágenes (copiar/descargar) */}
      <ImageContextMenu />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <AppContent />
      </AppProvider>
    </ErrorBoundary>
  );
}
