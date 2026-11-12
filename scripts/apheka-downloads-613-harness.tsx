import React,{useLayoutEffect} from 'react';
import {createRoot} from 'react-dom/client';
import {AppProvider,useApp} from '../src/store/AppContext';
import MusicDownloads from '../src/components/music/MusicDownloads';
import '../src/fonts.css';import '../src/index.css';import '../src/apheka.css';import '../src/workspace.css';import '../src/refinement.css';import '../src/quiet.css';import '../src/interface.css';
function Harness(){const app=useApp();useLayoutEffect(()=>{(window as any).__downloadsApp=app;});return <main className="single-environment" style={{height:'100vh',display:'block',padding:24,overflow:'auto'}}>{app.hydrated&&<MusicDownloads/>}</main>;}
createRoot(document.getElementById('root')!).render(<AppProvider><Harness/></AppProvider>);
