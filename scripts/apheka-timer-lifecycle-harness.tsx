import React,{useCallback,useLayoutEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {AppProvider,useApp} from '../src/store/AppContext';
import Estudio from '../src/components/views/Estudio';
import {useFullscreenLifecycle} from '../src/hooks/useWindowFullscreen';
import '../src/fonts.css';import '../src/index.css';import '../src/apheka.css';
import '../src/workspace.css';import '../src/refinement.css';import '../src/quiet.css';
import '../src/interface.css';import '../src/interaction-refinement.css';
function Probe(){const app=useApp();useLayoutEffect(()=>{(window as any).__timerQa=app;});return null;}
function Harness(){const [error,setError]=useState('');const report=useCallback((m:string)=>setError(m),[]);useFullscreenLifecycle(report);return <AppProvider><Probe/><output role="alert">{error}</output><Estudio/></AppProvider>;}
createRoot(document.getElementById('root')!).render(<Harness/>);
