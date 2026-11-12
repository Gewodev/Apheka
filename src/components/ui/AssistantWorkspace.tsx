import React,{useRef,useState} from 'react';
import {flushSync} from 'react-dom';
import {Copy,NotebookPen,Check,ChevronRight,Bot} from 'lucide-react';
import {useCharvisEnabled,setCharvisEnabled} from '../../lib/charvisAvailability';
import {useApp} from '../../store/AppContext';
import {ASSISTANT_SKILLS,assistantNoteHtml,buildAssistantSkillPrompt,parseAssistantPack} from '../../lib/assistantPack';
import type {AssistantPack,AssistantSkill} from '../../lib/assistantPack';
import McpSettings from './McpSettings';
import JevSettings from './JevSettings';
import CharvisSettings from './CharvisSettings';
import './mcp.css';

export default function AssistantWorkspace(){
  const [importOpen,setImportOpen]=useState(false);
  const enabled=useCharvisEnabled();
  return <div className="assistant-workspace">
    <section className="bento-card charvis-availability" aria-labelledby="charvis-availability-title">
      <div className="charvis-availability-copy"><Bot size={20}/><div><h3 id="charvis-availability-title">Charvis</h3><p id="charvis-availability-help">{enabled?'Disponible en la barra lateral. El clic derecho en IA lo desactiva.':'Desactivado. Su panel y sus consultas permanecen detenidos; tus chats se conservan.'}</p></div></div>
      <button type="button" role="switch" aria-label="Habilitar Charvis" aria-describedby="charvis-availability-help" aria-checked={enabled} className="charvis-availability-switch" onClick={()=>setCharvisEnabled(!enabled)}><span/></button>
    </section>
    {enabled&&<CharvisSettings/>}<McpSettings/><JevSettings/><details className="assistant-direct" onToggle={e=>setImportOpen(e.currentTarget.open)}><summary>Traer una respuesta de IA sin conexión <span>Opcional</span></summary>{importOpen&&<AssistantStudyImport/>}</details></div>;
}
function AssistantStudyImport(){
  const app=useApp(),latest=useRef(app);latest.current=app;
  const [client,setClient]=useState('ChatGPT'),[skill,setSkill]=useState<AssistantSkill>('notes');
  const [courseId,setCourseId]=useState(''),[request,setRequest]=useState(''),[response,setResponse]=useState('');
  const [pack,setPack]=useState<AssistantPack|null>(null),[error,setError]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
  const selected=app.courses.find(c=>c.id===courseId);
  const copy=async()=>{try{await navigator.clipboard.writeText(buildAssistantSkillPrompt(client,skill,request,selected?.name||''));setMessage('Instrucciones copiadas. Pégalas en '+client+' junto con el material que quieras estudiar.');setError('');}catch{setError('No se pudo copiar. Vuelve a intentarlo.');}};
  const apply=async()=>{
    if(!pack||busy)return;setBusy(true);setError('');setMessage('');
    try{
      const a=latest.current,c=courseId?a.courses.find(c=>c.id===courseId):undefined;
      if(courseId&&!c)throw Error('El curso ya no existe. Elige otro destino.');
      if(pack.flashcards.length&&!c)throw Error('Elige un curso para guardar las tarjetas.');
      const notes=pack.notes.map(n=>({...n,content:assistantNoteHtml(n.content)})).filter(n=>!a.notes.some(old=>!old.deletedAt&&old.title===n.title&&old.content===n.content&&old.course===(c?.name||'')));
      const tasks=pack.tasks.filter(t=>!a.tasks.some(old=>old.title===t.title&&old.course===(c?.name||'')));
      const cardKeys=new Set((c?.studyTopics||[]).flatMap(t=>(t.flashcards||[]).map(f=>JSON.stringify([f.question,f.answer]))));
      const cards=pack.flashcards.filter(f=>!cardKeys.has(JSON.stringify([f.question,f.answer])));
      flushSync(()=>{
        for(const n of notes)a.addNote({...n,course:c?.name||'',courseColor:c?.color||'#737373',isPinned:false,isCoursePrivate:!!c});
        for(const t of tasks)a.addTask({...t,course:c?.name||'',courseColor:c?.color||'#737373',urgent:false,important:false});
        if(c&&cards.length)a.updateCourse(c.id,{studyTopics:[...(c.studyTopics||[]),{id:crypto.randomUUID(),title:pack.title,createdAt:Date.now(),status:'pending',reviewLevel:0,nextReview:0,materials:[],flashcards:cards.map(f=>({...f,id:crypto.randomUUID(),difficulty:'bueno',nextReview:0,lastReviewed:0,createdAt:Date.now()}))}]});
      });
      await latest.current.persistWorkspace();
      const count=notes.length+tasks.length+cards.length;
      setMessage(count?`Añadidos: ${notes.length} apuntes, ${tasks.length} tareas y ${cards.length} tarjetas. Puedes abrirlos en sus apartados.`:'Este contenido ya estaba guardado. No se ha duplicado.');
      setPack(null);setResponse('');
    }catch(e){setError(String(e instanceof Error?e.message:e));}finally{setBusy(false);}
  };
  return <div className="assistant-workspace">
    <section className="bento-card mcp-settings" aria-labelledby="assistant-study-title">
      <div className="mcp-card-heading"><span className="mcp-mark"><NotebookPen size={20}/></span><div><h3 id="assistant-study-title">Traer contenido de mi IA</h3><p>Convierte una respuesta de tu asistente en contenido de POUH.</p></div></div>
      <p className="mcp-description">Elige una habilidad, copia las instrucciones y pégalas en tu IA. Después trae su respuesta aquí: podrás revisarla y guardar apuntes, tareas y tarjetas sin configurar una conexión.</p>
      <div className="mcp-fields-grid">
        <label>Mi asistente<select aria-label="Mi asistente" value={client} onChange={e=>setClient(e.target.value)}>{['ChatGPT','Claude','Gemini','Copilot','Otro asistente o IDE'].map(name=><option key={name}>{name}</option>)}</select></label>
        <label>Qué quiero preparar<select aria-label="Qué quiero preparar" value={skill} onChange={e=>setSkill(e.target.value as AssistantSkill)}>{ASSISTANT_SKILLS.map(s=><option value={s.id} key={s.id}>{s.name}</option>)}</select></label>
        <label>Guardar en<select aria-label="Guardar en" value={courseId} onChange={e=>{setCourseId(e.target.value);setPack(null);}}><option value="">Mi espacio general</option>{app.courses.map(c=><option value={c.id} key={c.id}>{c.name}</option>)}</select></label>
      </div>
      <label className="mcp-prompt-preferences">Qué necesitas estudiar<textarea value={request} onChange={e=>setRequest(e.target.value)} rows={3} maxLength={6000} placeholder="Por ejemplo: crea apuntes de álgebra con ejemplos y un repaso de 10 preguntas."/></label>
      <div className="mcp-actions"><button className="mcp-confirm" onClick={()=>void copy()}><Copy size={16}/>Copiar instrucciones para mi IA</button></div>
      <section className="mcp-setup-section" aria-labelledby="assistant-import-heading">
        <div className="mcp-section-heading"><h4 id="assistant-import-heading">Traer la respuesta a POUH</h4></div>
        <label className="mcp-prompt-label">Respuesta de mi asistente<textarea aria-label="Respuesta de mi asistente" rows={5} value={response} onChange={e=>{setResponse(e.target.value);setPack(null);setError('');setMessage('');}} placeholder="Pega el bloque de respuesta que preparó tu IA siguiendo las instrucciones." maxLength={220001}/></label>
        <div className="mcp-actions"><button disabled={!response.trim()||busy} onClick={()=>{try{setPack(parseAssistantPack(response));setError('');setMessage('');}catch(e){setPack(null);setError((e as Error).message);}}}><Check size={16}/>Revisar contenido</button></div>
        {pack&&<div className="assistant-review"><h4>{pack.title}</h4><p>{pack.notes.length} apuntes · {pack.tasks.length} tareas · {pack.flashcards.length} tarjetas</p><p>Destino: {selected?.name||'Mi espacio general'}. Las tarjetas se guardan en un tema nuevo del curso.</p><ul>{[...pack.notes.map(n=>'Apunte: '+n.title),...pack.tasks.map(t=>'Tarea: '+t.title),...pack.flashcards.map(c=>'Tarjeta: '+c.question)].slice(0,12).map((text,i)=><li key={i}>{text}</li>)}</ul><button className="mcp-confirm" disabled={busy} onClick={()=>void apply()}>{busy?'Guardando…':'Añadir a POUH'}<ChevronRight size={16}/></button></div>}
      </section>
      {error&&<p className="mcp-feedback" role="alert">{error}</p>}{message&&<p className="mcp-feedback is-success" role="status">{message}</p>}
      <p className="mcp-muted">Solo se comparten las instrucciones que copies. La respuesta no ejecuta comandos ni reemplaza tus notas. El contenido se añade después de revisarlo; comprueba su exactitud antes de estudiar.</p>
    </section>
  </div>;
}
