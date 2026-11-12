import React,{useLayoutEffect,useRef} from 'react';
import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import {AppProvider,useApp,useAppSlice} from '../src/store/AppContext';
const Slice=React.memo(function Slice(){const a=useAppSlice(['notes','addNote']),renders=useRef(0);renders.current++;useLayoutEffect(()=>{(window as any).__slice={renders:renders.current,count:a.notes.length,action:a.addNote};});return <output>{a.notes.length}</output>;});
function Full(){const a=useApp(),renders=useRef(0);renders.current++;useLayoutEffect(()=>{(window as any).__full={renders:renders.current,app:a};(window as any).__pulse=()=>{for(let i=1;i<=120;i++)flushSync(()=>a.setMusicProgressRaw(i/120));};});return null;}
createRoot(document.getElementById('root')!).render(<React.StrictMode><AppProvider><Slice/><Full/></AppProvider></React.StrictMode>);
