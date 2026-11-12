import React,{useLayoutEffect} from 'react';import {createRoot} from 'react-dom/client';import {AppProvider,useAppSnapshot} from '../src/store/AppContext';
import Current from '../src/components/ui/AppCommandsPanel';import Baseline from './fixtures/CommandsBaseline6266';import '../src/fonts.css';import '../src/index.css';import '../src/input-polish.css';import '../src/workspace-6266.css';import '../src/workspace-6267.css';
function Probe(){const snapshot=useAppSnapshot();useLayoutEffect(()=>{Object.assign(window,{__commandApp:snapshot});},[snapshot]);return null;}
const Panel=location.search.includes('baseline')?Baseline:Current;
createRoot(document.getElementById('root')!).render(<AppProvider><Probe/><Panel onNavigate={()=>{}} onOpenNote={()=>{}} onOpenTask={()=>{}}/></AppProvider>);
