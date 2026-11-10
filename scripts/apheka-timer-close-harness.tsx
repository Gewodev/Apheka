import React, {useCallback, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {WebviewWindow} from '@tauri-apps/api/webviewWindow';
import {getCurrentWindow} from '@tauri-apps/api/window';
import {emitTo} from '@tauri-apps/api/event';
import {useFullscreenLifecycle, windowFullscreen} from '../src/hooks/useWindowFullscreen';

function Harness() {
  const [error, setError] = useState('');
  const [clicks, setClicks] = useState(0);
  const report = useCallback((message: string) => setError(message), []);
  useFullscreenLifecycle(report);
  return <main style={{padding:40, fontFamily:'Segoe UI', background:'#171719', color:'#fff', minHeight:'100vh'}}>
    <h1>Cierre real del contador · QA aislada</h1>
    <p>Contador emergente real, foco y cursor nativos de Windows.</p>
    <div style={{display:'flex',gap:24}}>
      <button onClick={()=>void getCurrentWindow().maximize()}>Maximizar</button>
      <button onClick={()=>void windowFullscreen.toggle()}>Pantalla completa</button>
      <button onClick={async()=>{
        const timer = new WebviewWindow('floating-timer', {url:'/',title:'Timer QA',width:156,height:112,resizable:false,decorations:false,transparent:true,alwaysOnTop:true,skipTaskbar:true});
        await timer.once('tauri://created',async()=>{await timer.setFocus(); await emitTo('floating-timer','timer:sync',{sessionTime:30,isTimerActive:true,isRest:false,sessionType:'pomodoro',pomodoroTime:1500,shortBreakTime:300});});
      }}>Abrir contador</button>
      <button onClick={()=>setClicks(value=>value+1)}>Comprobar clic</button>
    </div>
    <output style={{display:'block',marginTop:30}}>Clics: {clicks} {error}</output>
    <input aria-label="Entrada de prueba" placeholder="Comprobar cursor de texto" style={{marginTop:30,padding:12}}/>
  </main>;
}
createRoot(document.getElementById('root')!).render(<Harness/>);
