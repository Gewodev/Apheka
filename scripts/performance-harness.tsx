import React, {Profiler, useLayoutEffect} from 'react';
import {createRoot} from 'react-dom/client';
import {AppProvider,useAppSnapshot} from '../src/store/AppContext';
import Inicio from '../src/components/views/Inicio';
import Cursos from '../src/components/views/Cursos';
import {useObservedSize} from '../src/hooks/useObservedSize';
import LiveClock from '../src/components/ui/LiveClock';
import '../src/fonts.css';
import '../src/index.css';
import '../src/interface.css';

const qa=window as any;
qa.__commits=[];
function ResizeQa(){
 const observed=useObservedSize<HTMLDivElement>();
 return <><div ref={observed.ref} id="resize-qa" style={{width:300,height:200}}/><output id="size-qa">{JSON.stringify(observed.size)}</output><LiveClock>{now=><time id="clock-qa">{now.getTime()}</time>}</LiveClock></>;
}
function Workspace(){
 const snapshot=useAppSnapshot();
 useLayoutEffect(()=>{qa.__getApp=snapshot;},[snapshot]);
 const view=new URLSearchParams(location.search).get('view');
 return <Profiler id="workspace" onRender={(_,phase,duration)=>qa.__commits.push({phase,duration})}>
  {view==='resize'?<React.StrictMode><ResizeQa/></React.StrictMode>:view==='course'?<Cursos initialCourseId="perf-course"/>:<Inicio/>}
 </Profiler>;
}
createRoot(document.getElementById('root')!).render(<AppProvider><Workspace/></AppProvider>);
