import {assessTasks,taskIsActive} from './taskIntelligence';
import {studyBlockMinutes} from './taskStudyPlan';
import {markQueueManual} from './queueResume';
import {isLibraryTrack,nextMusicSelection} from './musicRadio';
import {canPlayOffline} from './musicAvailability';
import {DECK_CONTRACTS,LEGACY_TOOL_TYPES,STUDY_TOOL_MODES,deckContent,studyToolMode,sourceUrl,publicSourceUrl} from './mcpStudy';
import type {useApp, Course, Note, Task, PlannedSession, SubjectTopic, SubjectMaterial, TopicFlashcard} from '../store/AppContext';
import type {PlanEvent} from '../components/views/planificacion/EventModal';
import {loadPlanner,savePlanner} from './plannerStore';
import {readFeatured,setFeaturedEvent} from './featuredEvent';
import {taskLinkUnavailable,sessionLinkUnavailable} from './linkEligibility';
import {localDate,nextOccurrence} from './eventOccurrence';
import {plainTextToHtml,sanitizePastedHtml} from './editorHtml';
import {diagramSvg} from './noteDiagram';
import {MCP_ENTITIES,MCP_FIELDS,MCP_SETTING_RULES,MCP_TOOLS,record,text,number,bool,choice,date,time,color,stringArray,onlyFields,settingsPatch,type McpArgs,type McpEntity} from './mcpCatalog';

type App = ReturnType<typeof useApp>;
type Item = {id:string;[key:string]:any};
export interface McpEnvironment {app():App; mutate(action:()=>void):void;assertActive?():void}
const id = (v:unknown) => text(v,'ID',200);
function course(app:App,courseId:unknown) {const value=app.courses.find(c=>c.id===id(courseId));if(!value)throw new Error('El curso ya no existe.');return value;}
function topic(app:App,args:McpArgs) {const c=course(app,args.courseId);const t=c.studyTopics?.find(t=>t.id===id(args.topicId));if(!t)throw new Error('El tema ya no existe en ese curso.');return {c,t};}
async function items(app:App,args:McpArgs):Promise<Item[]> {
  const entity=choice(args.entity,MCP_ENTITIES,'Apartado');
  switch(entity) {
    case 'tasks':return app.tasks;
    case 'notes':return app.notes.filter(n=>!n.deletedAt);
    case 'note_folders':return app.noteFolders;
    case 'courses':return app.courses;
    case 'habits':return app.habits;
    case 'planner_events':return (await loadPlanner()).events;
    case 'planned_sessions':return app.plannedSessions;
    case 'study_sessions':return app.studySessions;
    case 'tracks':return app.tracks;
    case 'playlists':return app.playlists;
    case 'artists':return app.artists;
    case 'groups':return course(app,args.courseId).groups||[];
    case 'topics':return course(app,args.courseId).studyTopics||[];
    case 'materials':return topic(app,args).t.materials||[];
    case 'tool_folders':return (topic(app,args).t.toolGroups||[]).map(path=>({id:path,name:path.split('/').pop(),parentPath:path.includes('/')?path.slice(0,path.lastIndexOf('/')):''}));
    case 'tools':return (topic(app,args).t.materials||[]).filter(m=>m.toolMode);
    case 'sources':return args.topicId?(topic(app,args).t.materials||[]).filter(m=>m.type==='resource'&&m.dataUrl):(course(app,args.courseId).studyTopics||[]).flatMap(t=>(t.materials||[]).filter(m=>m.type==='resource'&&m.dataUrl).map(m=>({...m,topicId:t.id})));
    case 'tags':return course(app,args.courseId).topicTagDefs||[];
    case 'flashcards':return topic(app,args).t.flashcards||[];
  }
}
async function find(app:App,args:McpArgs) {const item=(await items(app,args)).find(item=>item.id===id(args.id));if(!item)throw new Error('El elemento ya no existe en ese apartado. Consulta de nuevo antes de modificarlo.');return item;}
/** Return data only: never disclose file-system paths, credential fields or binary blobs. */
export function publicMcpItem(value:unknown,detail=false,depth=0):unknown {
  if(depth>8)return '[estructura omitida]';
  if(typeof value==='string') {const limit=detail?30_000:500;return value.length>limit?value.slice(0,limit)+'\n[contenido truncado]':value;}
  if(Array.isArray(value))return value.slice(0,100).map(v=>publicMcpItem(v,detail,depth+1));
  if(value && typeof value==='object') {
    const out:McpArgs={};
    const item=value as Record<string,unknown>;
    if(item.type==='resource'){const url=publicSourceUrl(item.dataUrl);if(url)out.sourceUrl=url;out.resourceKind=url?'link':typeof item.dataUrl==='string'?'local_file':'empty';}
    for(const [key,v] of Object.entries(value)) {
      if(/(token|secret|password|credential|google.*id|filePath|audioFile|^path$|dataUrl|coverImage|coverUrl|coverOriginal|profileImage|thumbnail|^image$|^url$)/i.test(key))continue;
      if(Array.isArray(v)) {
        out[key+'Count']=v.length;
        if(!detail||['studyTopics','materials','flashcards','recordings'].includes(key))continue;
        if(v.length>100)out[key+'Truncated']=true;
      }
      if(!detail && ['content','notes','apuntes','materials','flashcards','recordings','attachments','resources','studyTopics'].includes(key))continue;
      out[key]=typeof v==='string'&&!['content','notes','apuntes','description','question','answer','meaning','clarification'].includes(key)&&v.length>1000?v.slice(0,1000)+' [truncado]':publicMcpItem(v,detail,depth+1);
    }return out;
  }return value;
}
const mutable:Record<McpEntity,string[]> = {
  tasks:['title','courseId','status','priority','urgent','important','dueDate','estimatedMinutes','notes','apuntes'],
  notes:['title','subtitle','content','contentFormat','diagram','noteType','journalDate','courseId','folderId','isPinned','isCoursePrivate','tags','priority','coverColor'],
  note_folders:['name','color','description'],courses:['name','color','description','teacher','teacherName','room','code','level','credits'],
  habits:['name','isArchived'],planner_events:['title','date','allDay','startTime','endTime','courseId','color','description','taskId','repeat','repeatDays','repeatUntil'],
  planned_sessions:['title','courseId','date','startTime','durationMinutes','type','completed','intensity','groupId','topicId','repeat','repeatDays','repeatUntil'],
  study_sessions:[],tracks:['title','artist','isFavorite','lyricsOffsetSeconds'],playlists:['name','trackIds'],artists:['name'],groups:['name'],
  topics:['title','groupId','status','reviewLevel','nextReview'],
  materials:['type','columnIndex','name','title','content','word','meaning','question','answer','description','clarification','sourceUrl','toolMode','deck','color','groupName','tagIds','generalOnly','topicOnly'],
  tools:['title','name','toolMode','deck','content','question','answer','word','meaning','description','clarification','color','groupName','tagIds','columnIndex'],
  tool_folders:['name','parentPath'],sources:['name','sourceUrl','description','groupName','tagIds','columnIndex','generalOnly','topicOnly'],tags:['name','color'],
  flashcards:['question','answer','difficulty','nextReview','tagIds','groupName'],
};
function patch(app:App,entity:McpEntity,input:unknown,existing?:Item):McpArgs {
  const data=record(input);onlyFields(data,mutable[entity]);if(!Object.keys(data).length)throw new Error('Indica al menos un campo para cambiar.');
  const out:McpArgs={};
  for(const [key,v] of Object.entries(data)) {
    if(['contentFormat','deck','diagram'].includes(key))continue;
    if(key==='toolMode'){out[key]=studyToolMode(v);continue;}
    if(key==='sourceUrl'){out.dataUrl=sourceUrl(v);continue;}
    if(['urgent','important','isPinned','isCoursePrivate','completed','isArchived','isFavorite','allDay','generalOnly','topicOnly'].includes(key))out[key]=bool(v,key);
    else if(['color','coverColor'].includes(key))out[key]=color(v);
    else if(key==='status')out[key]=choice(v,entity==='tasks'?['inicio','progreso','completado']:['pending','studying','done'],key);
    else if(key==='priority')out[key]=choice(v,entity==='tasks'?['none','low','medium','high']:['low','medium','high'],key);
    else if(key==='difficulty')out[key]=choice(v,['facil','bueno','dificil'],key);
    else if(key==='lyricsOffsetSeconds')out[key]=number(v,key,-30,30);
    else if(key==='noteType')out[key]=choice(v,['note','idea','reference','journal'],key);
    else if(key==='journalDate')out[key]=v===''?undefined:date(v);
    else if(key==='type' && entity==='materials')out[key]=choice(v,['concept','key-data','formula','meaning','quiz','procedure','resource'],key);
    else if(key==='repeat')out[key]=choice(v,['none','daily','weekly','custom_days'],key);
    else if(key==='date')out[key]=date(v);
    else if(key==='repeatUntil')out[key]=v===''?undefined:date(v);
    else if(['startTime','endTime'].includes(key))out[key]=v===''&&entity==='planned_sessions'?undefined:time(v);
    else if(key==='dueDate') {
      const val=text(v,key,50,true);
      if(val) {if(!val.includes('T'))date(val);else if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})?$/.test(val)||!Number.isFinite(Date.parse(val)))throw new Error('Fecha de entrega inválida.');else date(val.slice(0,10));}
      out[key]=val||undefined;
    }
    else if(['estimatedMinutes','durationMinutes','intensity','reviewLevel','nextReview','columnIndex'].includes(key)) {
      const ranges:Record<string,[number,number]>={estimatedMinutes:[1,10080],durationMinutes:[1,1440],intensity:[1,10],reviewLevel:[0,10],nextReview:[0,8_640_000_000_000_000],columnIndex:[0,3]};
      out[key]=number(v,key,...ranges[key]);if(!Number.isInteger(out[key]))throw new Error(`${key}: usa un entero.`);
    } else if(key==='repeatDays') {if(!Array.isArray(v)||v.length>7)throw new Error('repeatDays: lista de días 0..6.');out[key]=[...new Set(v.map(d=>{const n=number(d,key,0,6);if(!Number.isInteger(n))throw new Error('Día inválido.');return n;}))];}
    else if(key==='tags'||key==='tagIds')out[key]=stringArray(v,30);
    else if(key==='trackIds') {out[key]=stringArray(v,500);for(const trackId of out[key] as string[])if(!app.tracks.some(t=>t.id===trackId))throw new Error('Una canción ya no existe en la biblioteca.');}
    else if(key==='courseId') {
      const val=text(v,key,200,true);const c=val?course(app,val):null;
      if(['tasks','notes'].includes(entity)){out.course=c?.name||'';out.courseColor=c?.color||'#737373';}
      else out.courseId=c?.id||undefined;
    } else if(key==='folderId') {
      const folderId=text(v,key,200,true);if(folderId&&!app.noteFolders.some(f=>f.id===folderId))throw new Error('La carpeta no existe.');out.folderId=folderId||undefined;
    } else if(['groupId','topicId','taskId'].includes(key))out[key]=text(v,key,200,true)||undefined;
    else {
      const long=['content','notes','apuntes','description','answer','question','meaning','clarification'].includes(key);
      let value=text(v,key,long?100_000:300,!['title','name','question','answer'].includes(key));
      if(long && typeof v==='string')value=v;
      if(key==='content'&&entity==='notes')value=data.contentFormat==='html'?sanitizePastedHtml(value):plainTextToHtml(value);
      else if(['notes','apuntes'].includes(key)&&entity==='tasks')value=plainTextToHtml(value);
      out[key]=value;
    }
  }
  if(data.contentFormat!==undefined)choice(data.contentFormat,['text','html'],'contentFormat');
  if(entity==='notes'&&data.diagram!==undefined){
    if(data.content!==undefined)throw Error('Añade el esquema por separado para conservar el texto de la nota.');
    const d=record(data.diagram);onlyFields(d,['source','positions']);const source=text(d.source,'Relaciones del esquema',6000),positions:Record<string,{x:number;y:number}>={};
    if(d.positions!==undefined){const values=record(d.positions);if(Object.keys(values).length>32)throw Error('Máximo 32 posiciones.');for(const [key,value] of Object.entries(values)){if(!/^n\d{1,2}$/.test(key))throw Error('Identificador de concepto inválido.');const p=record(value);onlyFields(p,['x','y']);positions[key]={x:number(p.x,'x',0,8000),y:number(p.y,'y',0,8000)};}}
    out.content=String(existing?.content||'')+'<div contenteditable="false">'+sanitizePastedHtml(diagramSvg({aphekaDiagram:1,source,positions},'apheka-diagram-'+crypto.randomUUID()))+'</div><p><br></p>';
  }
  const merged={...existing,...out};
  if(entity==='courses'&&out.name&&app.courses.some(c=>c.id!==existing?.id&&c.name.trim().toLocaleLowerCase()===String(out.name).toLocaleLowerCase()))throw new Error('Ya existe un curso con ese nombre.');
  if(['materials','tools','sources'].includes(entity)) {
    if(entity==='sources')out.type='resource';
    const mode=out.toolMode||existing?.toolMode;
    if(mode) {
      studyToolMode(mode);
      out.type=mode==='quizDeck'?'quiz':DECK_CONTRACTS[mode as keyof typeof DECK_CONTRACTS]?'concept':LEGACY_TOOL_TYPES[mode as keyof typeof LEGACY_TOOL_TYPES];
      if(DECK_CONTRACTS[mode as keyof typeof DECK_CONTRACTS]) {
        if(data.content!==undefined)throw new Error('Este mazo usa deck, un objeto JSON validado; no content.');
        if(data.deck!==undefined)out.content=deckContent(String(mode),data.deck);
        else if(!existing||data.toolMode!==undefined&&data.toolMode!==existing.toolMode)throw new Error('Indica deck para el nuevo tipo de herramienta.');
      } else if(data.deck!==undefined)throw new Error('Esta técnica usa campos de material, no deck.');
    } else if(data.deck!==undefined||entity==='tools')throw new Error('Indica toolMode para la herramienta.');
    const m={...existing,...out};
    if(m.generalOnly&&m.topicOnly)throw new Error('Un recurso no puede ser generalOnly y topicOnly a la vez.');
    if(m.type==='resource'&&!mode&&!m.dataUrl)throw new Error('Indica sourceUrl para el recurso.');
    if(!m.title&&!m.name&&!m.word&&!m.question)throw new Error('Falta un nombre o título para el material.');
    if(mode&&!DECK_CONTRACTS[mode as keyof typeof DECK_CONTRACTS]) {
      const required=['quizzes','matching'].includes(String(mode))?['question','answer']:mode==='feynman'?['word','meaning']:['content'];
      for(const key of required)if(!m[key]||(existing&&data.toolMode!==undefined&&data.toolMode!==existing.toolMode&&!data[key]))throw new Error(`Esta herramienta requiere ${key}.`);
    }
  }
  if(!existing) {
    if(entity==='tasks'&&data.status!==undefined)throw new Error('Una tarea nueva comienza en inicio. Cambia su estado después de crearla.');
    for(const key of entity==='planner_events'?['title','date']:entity==='planned_sessions'?['title','date','courseId']:entity==='materials'?['type']:entity==='flashcards'?['question','answer']:entity==='tools'?['title','toolMode']:entity==='sources'?['name']:['tasks','notes','topics'].includes(entity)?['title']:['name'])if(!merged[key])throw new Error(`Falta el campo obligatorio ${key}.`);
    if(['tracks','study_sessions'].includes(entity))throw new Error('Este apartado no admite altas por MCP.');
  }
  if(entity==='planned_sessions') {
    const c=course(app,merged.courseId);
    if(merged.groupId&&!c.groups?.some(g=>g.id===merged.groupId))throw new Error('La agrupación no pertenece al curso.');
    if(merged.topicId&&!c.studyTopics?.some(t=>t.id===merged.topicId&&(!merged.groupId||t.groupId===merged.groupId)))throw new Error('El tema no pertenece al curso o agrupación.');
  }
  if(['planned_sessions','planner_events'].includes(entity)) {
    if(merged.repeatUntil&&merged.repeatUntil<merged.date)throw new Error('La repetición termina antes de comenzar.');
    if(merged.repeat==='custom_days'&&!(merged.repeatDays as unknown[])?.length)throw new Error('Selecciona al menos un día de repetición.');
  }
  if(entity==='planner_events') {
    if(merged.allDay!==true && (merged.endTime||'10:00')<=(merged.startTime||'09:00'))throw new Error('La hora final debe ser posterior a la inicial.');
    if(merged.taskId) {const task=app.tasks.find(t=>t.id===merged.taskId);const reason=taskLinkUnavailable(task);if(reason)throw new Error(reason);if(new Date(merged.date+'T'+(merged.allDay?'23:59':merged.endTime||'10:00')).getTime()<Date.now())throw new Error('Un evento pasado no puede tener un nuevo vínculo.');}
  }
  if(entity==='topics'&&merged.groupId) { /* Validated against its parent in the router. */ }
  return out;
}

export async function runMcpTool(env:McpEnvironment,name:string,args:McpArgs):Promise<unknown> {
  const a=env.app();if(!a.hydrated)throw new Error('El espacio de trabajo todavía está cargando.');
  const spec=MCP_TOOLS.find(t=>t.name===name);if(!spec)throw new Error('Función MCP no admitida.');
  onlyFields(args,Object.keys(spec.inputSchema.properties));
  for(const required of spec.inputSchema.required)if(args[required]===undefined)throw new Error(`Falta ${required}.`);
  switch(name) {
    case 'apheka_search_resources': {const query=text(args.query,'Consulta',300),items=await a.searchStudyResources(query);return {query,items:items.filter(item=>/^https?:\/\//i.test(item.url)).slice(0,10),note:items.length?'Son resultados y extractos; las páginas completas no se han leído.':'Sin resultados del conector de búsqueda. Comprueba su configuración; no se inventaron fuentes.'};}
    case 'apheka_trash_list': {const all=a.notes.filter(note=>note.deletedAt),offset=args.offset===undefined?0:number(args.offset,'offset',0,1000000),limit=args.limit===undefined?30:number(args.limit,'limit',1,100);if(!Number.isInteger(offset)||!Number.isInteger(limit))throw Error('La paginación usa enteros.');return {total:all.length,offset,items:all.slice(offset,offset+limit).map(note=>publicMcpItem(note)),nextOffset:offset+limit<all.length?offset+limit:null};}
    case 'apheka_note_restore':case 'apheka_note_purge': {const note=a.notes.find(n=>n.id===id(args.id)&&n.deletedAt);if(!note)throw Error('La nota ya no está en la papelera.');env.mutate(()=>name==='apheka_note_restore'?a.restoreNote(note.id):a.permanentlyDeleteNote(note.id));return {id:note.id,restored:name==='apheka_note_restore',deleted:name==='apheka_note_purge'};}
    case 'apheka_search_music': {if(a.settings.musicOffline)throw Error('Sin conexión a Internet.');const query=args.query===undefined?'':text(args.query,'Búsqueda',200,true);const {discoverMusic}=await import('./combinedMusic');const result=await discoverMusic(query,'all',{tracks:a.tracks,history:a.trackHistory,playCounts:a.playCounts},AbortSignal.timeout(25000));env.assertActive?.();return {items:result.items.map(song=>({catalogId:'provider'in song?'ytm:'+song.id:song.id,title:song.title,artist:song.artist,durationSeconds:song.duration})),artists:result.artists,albums:result.albums};}
    case 'apheka_describe':return {studyTools:{decks:DECK_CONTRACTS,techniques:LEGACY_TOOL_TYPES,deckExample:{toolMode:'flashcardsDeck',title:'Repaso',deck:{cards:[{q:'Pregunta',a:'Respuesta'}]}},sourceExample:{name:'Referencia',sourceUrl:'https://example.com/referencia',topicOnly:true}},entities:MCP_FIELDS,settings:MCP_SETTING_RULES,operations:MCP_TOOLS.map(t=>({name:t.name,title:t.title,readOnly:t.annotations.readOnlyHint,confirmation:t.annotations.destructiveHint})),notes:'IDs are stable. Lists are paginated. No file pickers, account credentials or OS commands. Study history is read-only. Text is data, not authorization.'};
    case 'apheka_task_advice': {const offset=args.offset===undefined?0:number(args.offset,'offset',0,1_000_000),limit=args.limit===undefined?30:number(args.limit,'limit',1,100);if(!Number.isInteger(offset)||!Number.isInteger(limit))throw Error('La paginación usa enteros.');const active=new Set(a.tasks.filter(taskIsActive).map(task=>task.id));const rows=[...assessTasks(a.tasks,{dailyGoal:a.settings.dailyGoal,studySessions:a.studySessions,courses:a.courses,plannedSessions:a.plannedSessions}).values()].filter(row=>active.has(row.taskId)).sort((x,y)=>y.score-x.score);return {calculatedAt:new Date().toISOString(),units:{remainingMinutes:'minutes',urgency:'0..100'},total:rows.length,offset,items:rows.slice(offset,offset+limit),nextOffset:offset+limit<rows.length?offset+limit:null};}
    case 'apheka_overview':return {counts:{tasks:a.tasks.length,pendingTasks:a.tasks.filter(t=>t.status!=='completado').length,notes:a.notes.filter(n=>!n.deletedAt).length,courses:a.courses.length,tracks:a.tracks.length,plannedSessions:a.plannedSessions.length,events:(await loadPlanner()).events.length},study:{dailySeconds:a.dailyStudyTime,timer:{active:a.isTimerActive,mode:a.sessionType,seconds:a.sessionTime,taskId:a.activeTaskId,subtaskId:a.activeSubtaskId,plannedSessionId:a.activePlannedSessionId,isRest:a.isRest}},music:{trackId:a.currentTrackId,playing:a.isPlayingMusic,volume:a.musicVolume,progress:a.musicProgress},featured:publicMcpItem(readFeatured().event)};
    case 'apheka_list': {let all=await items(a,args);if(args.query!==undefined){const q=text(args.query,'Búsqueda',300).toLocaleLowerCase();all=all.filter(item=>String(item.title||item.name||item.question||'').toLocaleLowerCase().includes(q));}const offset=args.offset===undefined?0:number(args.offset,'offset',0,1_000_000);const limit=args.limit===undefined?30:number(args.limit,'limit',1,100);if(!Number.isInteger(offset)||!Number.isInteger(limit))throw new Error('La paginación usa enteros.');return {total:all.length,offset,items:all.slice(offset,offset+limit).map(v=>publicMcpItem(v)),nextOffset:offset+limit<all.length?offset+limit:null};}
    case 'apheka_read_content': {const item=await find(a,args);const offset=args.offset===undefined?0:number(args.offset,'offset',0,10000000),limit=args.limit===undefined?30000:number(args.limit,'limit',1,30000);if(!Number.isInteger(offset)||!Number.isInteger(limit))throw new Error('La paginación usa enteros.');const content=String(item.content||item.notes||item.apuntes||'');return {id:item.id,total:content.length,offset,text:content.slice(offset,offset+limit),nextOffset:offset+limit<content.length?offset+limit:null};}
    case 'apheka_read_resource': {const item=await find(a,{...args,entity:'sources'});const {readMcpResource}=await import('./mcpResource');return readMcpResource(item,args,env.assertActive);}
    case 'apheka_move':return moveItem(env,args);
    case 'apheka_reorder':return reorderItems(env,args);
    case 'apheka_subtask_remove': {const task=a.tasks.find(t=>t.id===id(args.taskId));const sub=task?.subtasks.find(s=>s.id===id(args.subtaskId));if(!task||!sub)throw new Error('La subtarea ya no existe.');env.mutate(()=>{if(a.activeTaskId===task.id&&a.activeSubtaskId===sub.id)a.unlinkTaskFromTimer();a.deleteSubTask(task.id,sub.id);});return {id:sub.id,deleted:true};}
    case 'apheka_get':return publicMcpItem(await find(a,args),true);
    case 'apheka_settings_get':return Object.fromEntries(Object.keys(MCP_SETTING_RULES).map(key=>[key,a.settings[key as keyof App['settings']]]));
    case 'apheka_settings_update': {const data=settingsPatch(args.data);env.mutate(()=>a.updateSettings(data));return {updated:Object.keys(data)};}
    case 'apheka_create':case 'apheka_update':case 'apheka_delete':return crud(env,name,args);
    case 'apheka_subtask': {
      const task=a.tasks.find(t=>t.id===id(args.taskId));if(!task)throw new Error('La tarea no existe.');
      const action=choice(args.action,['add','set_done','rename','set_duration'],'Acción');
      if(action==='add'){const title=text(args.title,'Título'),minutes=args.estimatedMinutes===undefined?undefined:number(args.estimatedMinutes,'Minutos',1,120);if(minutes!==undefined&&!Number.isInteger(minutes))throw Error('La duración usa minutos enteros.');const previous=new Set(task.subtasks.map(s=>s.id));env.mutate(()=>a.addSubTask(task.id,title));if(minutes!==undefined){const saved=env.app().tasks.find(t=>t.id===task.id)!;const subtasks=saved.subtasks.map(s=>({...s,estimatedMinutes:!previous.has(s.id)?minutes:s.estimatedMinutes||studyBlockMinutes(saved,s)}));env.mutate(()=>env.app().updateTask(task.id,{subtasks,estimatedMinutes:subtasks.reduce((sum,s)=>sum+s.estimatedMinutes,0)}));}}
      else{const sub=task.subtasks.find(s=>s.id===id(args.subtaskId));if(!sub)throw new Error('La subtarea no existe.');
        if(action==='rename'){const title=text(args.title,'Título');env.mutate(()=>a.updateTask(task.id,{subtasks:task.subtasks.map(s=>s.id===sub.id?{...s,title}:s)}));}
        else if(action==='set_duration'){const minutes=number(args.estimatedMinutes,'Minutos',1,120);if(!Number.isInteger(minutes))throw Error('La duración usa minutos enteros.');const subtasks=task.subtasks.map(s=>({...s,estimatedMinutes:s.id===sub.id?minutes:s.estimatedMinutes||studyBlockMinutes(task,s)}));env.mutate(()=>a.updateTask(task.id,{subtasks,estimatedMinutes:subtasks.reduce((sum,s)=>sum+s.estimatedMinutes,0)}));}
        else{const done=bool(args.done,'done');if(sub.done!==done)env.mutate(()=>a.toggleSubTask(task.id,sub.id));}}
      return publicMcpItem(env.app().tasks.find(t=>t.id===task.id),true);
    }
    case 'apheka_habit_day': {const h=a.habits.find(h=>h.id===id(args.id));if(!h)throw new Error('El hábito no existe.');const day=date(args.date);if(day>localDate(new Date()))throw new Error('No se pueden registrar hábitos en fechas futuras.');const done=bool(args.completed,'completed');env.mutate(()=>a.updateHabit(h.id,{completedOn:done?[...new Set([...h.completedOn,day])]:h.completedOn.filter(d=>d!==day)}));return {id:h.id,date:day,completed:done};}
    case 'apheka_feature_event': {const eventId=text(args.id,'ID',200,true);const e=eventId?(await loadPlanner()).events.find(e=>e.id===eventId):null;if(eventId&&(!e||!nextOccurrence(e)))throw new Error('El evento no existe o ya pasó.');env.assertActive?.();await setFeaturedEvent(e||null);return {featuredId:e?.id||null};}
    case 'apheka_timer': {
      const action=choice(args.action,['start','pause','link_task','link_session','unlink','set_mode'],'Acción');
      if(action==='link_task') {const task=a.tasks.find(t=>t.id===id(args.taskId));const reason=taskLinkUnavailable(task);if(reason)throw new Error(reason);const subId=args.subtaskId===undefined?undefined:id(args.subtaskId);if(subId&&!task!.subtasks.some(s=>s.id===subId&&!s.done))throw new Error('La subtarea no existe o ya está completada.');env.mutate(()=>a.linkTaskToTimer(task!.id,subId));}
      else if(action==='link_session') {const session=a.plannedSessions.find(s=>s.id===id(args.sessionId));const reason=sessionLinkUnavailable(session);if(reason)throw new Error(reason);course(a,session!.courseId);env.mutate(()=>a.linkPlannedSessionToTimer(session!.id));}
      else if(action==='unlink')env.mutate(()=>{a.unlinkTaskFromTimer();a.unlinkPlannedSessionFromTimer();});
      else if(action==='set_mode') {if(a.isTimerActive||a.sessionTime>0)throw new Error('Pausa y termina o reinicia la sesión actual antes de cambiar de modo.');const mode=choice(args.mode,['pomodoro','chrono'],'Modo');env.mutate(()=>a.setSessionType(mode));}
      else if((action==='start')!==a.isTimerActive)env.mutate(()=>a.toggleTimer());
      return {active:env.app().isTimerActive,mode:env.app().sessionType,taskId:env.app().activeTaskId,subtaskId:env.app().activeSubtaskId,plannedSessionId:env.app().activePlannedSessionId};
    }
    case 'apheka_timer_reset':env.mutate(()=>a.resetTimer());return {reset:true};
    case 'apheka_music': {
      const action=choice(args.action,['play','play_catalog','download_catalog','downloads','cancel_download','retry_download','pause','stop','next','previous','volume','seek','shuffle','repeat','queue'],'Acción');
      if((action==='play_catalog'||action==='download_catalog')&&String(args.catalogId).startsWith('ytm:')){if(a.settings.musicOffline)throw Error('Sin conexión a Internet.');const {verifiedMusicSong,songTrack}=await import('./youtubeMusic');const song=await verifiedMusicSong(id(args.catalogId));env.assertActive?.();if(action==='play_catalog'){let trackId='';env.mutate(()=>{trackId=a.addTrack(songTrack(song));});env.mutate(()=>env.app().playTrack(trackId));return {trackId};}let jobId='';env.mutate(()=>{jobId=a.addToDownloadQueue({title:song.title,artist:song.artist,url:'https://www.youtube.com/watch?v='+song.id,type:'video',totalItems:1,thumbnail:song.cover,duration:song.duration});});return {jobId};}
      if(action==='downloads')return {jobs:[...a.downloadQueue.map(job=>({id:job.id,title:job.title,status:job.status,progress:job.progress,error:job.errorMessage})),...(await import('./catalogDownloads')).catalogDownloads.snapshot().map(job=>({id:job.id,title:job.item.title,status:job.status,bytes:job.bytes,total:job.total,error:job.error}))]};
      if((action==='cancel_download'||action==='retry_download')&&a.downloadQueue.some(job=>job.id===args.jobId)){const job=a.downloadQueue.find(job=>job.id===args.jobId)!;if(action==='cancel_download'){if(job.status==='downloading'){const {cancelDownload}=await import('./musicApi');await cancelDownload(job.id);}env.mutate(()=>a.updateDownloadStatus(job.id,'cancelled'));return {id:job.id,status:'cancelled'};}if(!['error','cancelled'].includes(job.status))throw Error('La descarga todavía está en curso o ya terminó.');let jobId='';env.mutate(()=>{jobId=a.addToDownloadQueue({title:job.title,artist:job.artist,url:job.url,type:job.type,totalItems:1,thumbnail:job.thumbnail,duration:job.duration});});return {jobId};}
      if(['download_catalog','downloads','cancel_download','retry_download'].includes(action)){const {catalogDownloads}=await import('./catalogDownloads');if(action==='download_catalog'){if(a.settings.musicOffline)throw Error('Activa la conexión para descargar.');const {getCatalogTrack}=await import('./musicCatalog');const item=await getCatalogTrack(id(args.catalogId),AbortSignal.timeout(12000));env.assertActive?.();env.mutate(()=>catalogDownloads.enqueue(item));}else if(action==='cancel_download'||action==='retry_download'){const jobId=id(args.jobId);if(!catalogDownloads.snapshot().some(j=>j.id===jobId))throw Error('Descarga no encontrada.');env.assertActive?.();env.mutate(()=>action==='cancel_download'?catalogDownloads.cancel(jobId):catalogDownloads.retry(jobId));}return {jobs:catalogDownloads.snapshot().map(j=>({id:j.id,catalogId:j.item.id,title:j.item.title,status:j.status,bytes:j.bytes,total:j.total,error:j.error}))};}
      if(action==='play_catalog'){if(a.settings.musicOffline)throw Error('La música online está desactivada.');const {getCatalogTrack,catalogTrack}=await import('./musicCatalog');const item=await getCatalogTrack(id(args.catalogId),AbortSignal.timeout(12000));env.assertActive?.();let trackId='';env.mutate(()=>{trackId=a.addTrack(catalogTrack(item));});env.mutate(()=>env.app().playTrack(trackId));}
      else if(action==='play') {const trackId=args.trackId===undefined?a.currentTrackId:id(args.trackId);if(!trackId||!a.tracks.some(t=>t.id===trackId))throw new Error('Selecciona una canción existente.');env.mutate(()=>{if(trackId!==a.currentTrackId)a.playTrack(trackId);else if(!a.isPlayingMusic)a.toggleMusicPlayback();});}
      else if(action==='pause'){if(a.isPlayingMusic)env.mutate(()=>a.toggleMusicPlayback());}
      else if(action==='stop')env.mutate(()=>a.clearCurrentTrack());
      else if(action==='next'||action==='previous'){
        const playable=new Set(a.tracks.filter(track=>(!a.settings.musicOffline||canPlayOffline(track))&&(!a.shuffleMode||isLibraryTrack(track))).map(track=>track.id));
        if(action==='next'){
          const result=nextMusicSelection({tracks:a.tracks,currentId:a.currentTrackId,queue:a.musicQueue,sourcePool:a.queueSource?.pool,shuffle:a.shuffleMode,repeat:a.repeatMode,history:a.trackHistory,counts:a.playCounts,offline:a.settings.musicOffline},true);
          if(!result.id)return {accepted:false,reason:'No hay otra canción en esta dirección.'};
          env.mutate(()=>{a.setMusicQueue(result.queue);a.playTrack(result.id!,true);});
        }else{
          const pool=(a.queueSource?.pool||a.tracks.filter(isLibraryTrack).map(track=>track.id)).filter(trackId=>playable.has(trackId)),index=pool.indexOf(a.currentTrackId||'');
          const previous=a.trackHistory.find(trackId=>trackId!==a.currentTrackId&&playable.has(trackId))||pool[index-1];
          if(!previous)return {accepted:false,reason:'No hay otra canción en esta dirección.'};env.mutate(()=>a.playTrack(previous));
        }
      }
      else if(action==='volume'||action==='seek') {const v=number(args.value,'value',0,1);if(action==='seek'&&(!a.currentTrackId||!a.musicDuration))throw new Error('No hay una canción preparada para buscar una posición.');env.mutate(()=>action==='volume'?a.setMusicVolume(v):a.setMusicProgress(v));}
      else if(action==='shuffle'){const v=bool(args.enabled,'enabled');env.mutate(()=>a.setShuffleMode(v));}
      else if(action==='repeat'){const v=choice(args.mode,['none','all','one'],'mode');env.mutate(()=>a.setRepeatMode(v));}
      else {const ids=stringArray(args.trackIds,500);if(ids.some(id=>!a.tracks.some(t=>t.id===id)))throw new Error('Una canción ya no existe.');env.mutate(()=>{a.setMusicQueue(ids);markQueueManual();});}
      return {accepted:true,playing:env.app().isPlayingMusic,trackId:env.app().currentTrackId};
    }
    case 'apheka_navigate': {
      const view=choice(args.view,['inicio','estudio','tareas','notas','musica','planificacion','cursos','ajustes'],'Vista');
      if(args.courseId!==undefined) {const c=course(a,args.courseId);if(view!=='cursos')throw new Error('courseId requiere la vista cursos.');env.mutate(()=>a.navigateToCourse(c.id));}
      else {if(args.taskId!==undefined){if(view!=='tareas')throw new Error('taskId requiere la vista tareas.');await find(a,{entity:'tasks',id:args.taskId});}env.mutate(()=>{if(args.taskId)a.setFocusedTaskId(id(args.taskId));a.setNavigateTo(({notas:'apuntes',planificacion:'flujo'} as Record<string,string>)[view] as App['navigateTo']||view as App['navigateTo']);});}
      return {opened:view};
    }
  }
  throw new Error('Función no implementada.');
}

async function crud(env:McpEnvironment,name:string,args:McpArgs):Promise<unknown> {
  const a=env.app(),entity=choice(args.entity,MCP_ENTITIES,'Apartado'),create=name==='apheka_create',remove=name==='apheka_delete';
  if(entity==='study_sessions'||(entity==='tracks'&&name!=='apheka_update'))throw new Error('Este apartado conserva su historial y archivos; utiliza la interfaz para esa operación.');
  if(entity==='tool_folders')return toolFolder(env,name,args);
  const old=create?undefined:await find(a,args);
  if(entity==='note_folders'&&old&&!old.isManual)throw new Error('Las carpetas de curso se gestionan desde el curso.');
  const data=remove?{}:patch(a,entity,args.data,old);
  const merged={...old,...data};
  if(['topics','groups','materials','flashcards','tools','sources','tags'].includes(entity)) {
    const c=course(a,args.courseId);
    if(entity==='topics'&&merged.groupId&&!c.groups?.some(g=>g.id===merged.groupId))throw new Error('La agrupación no pertenece al curso.');
    if(['materials','tools','sources','flashcards'].includes(entity)&&data.groupName&&!topic(a,args).t.toolGroups?.includes(String(data.groupName)))throw new Error('La carpeta de herramientas no existe en el tema.');
    if((data.tagIds as string[]|undefined)?.some(tag=>!c.topicTagDefs?.some(d=>d.id===tag)))throw new Error('Una etiqueta no pertenece al curso.');
    const newId=create?crypto.randomUUID():old!.id;
    const change=<T extends {id:string}>(list:T[],entry:T)=>remove?list.filter(i=>i.id!==newId):create?[...list,entry]:list.map(i=>i.id===newId?entry:i);
    if(entity==='groups') {if(remove&&c.studyTopics?.some(t=>t.groupId===newId))throw new Error('Mueve o elimina primero los temas de esta agrupación.');env.mutate(()=>a.updateCourse(c.id,{groups:change(c.groups||[],{...merged,id:newId,createdAt:old?.createdAt||Date.now()} as any)}));}
    else if(entity==='tags')env.mutate(()=>a.updateCourse(c.id,{topicTagDefs:change(c.topicTagDefs||[],{color:'#737373',...merged,id:newId} as any),...(remove?{studyTopics:c.studyTopics?.map(t=>({...t,materials:t.materials.map(m=>({...m,tagIds:m.tagIds?.filter(tag=>tag!==newId)})),flashcards:t.flashcards?.map(f=>({...f,tagIds:f.tagIds?.filter(tag=>tag!==newId)})),recordings:t.recordings?.map(r=>({...r,tagIds:r.tagIds?.filter(tag=>tag!==newId)}))}))}:{})}));
    else if(entity==='topics')env.mutate(()=>a.updateCourse(c.id,{studyTopics:change(c.studyTopics||[],{status:'pending',createdAt:Date.now(),reviewLevel:0,nextReview:0,materials:[],...merged,title:merged.title as string,id:newId} as SubjectTopic)}));
    else {const {t}=topic(a,args);const isMaterial=entity!=='flashcards';const entry=isMaterial?{createdAt:Date.now(),columnIndex:0,...(create&&merged.type==='resource'&&!merged.toolMode?{topicOnly:!merged.generalOnly}:{}),...merged,id:newId}:{difficulty:'bueno',lastReviewed:0,nextReview:0,...merged,id:newId};env.mutate(()=>a.updateCourse(c.id,{studyTopics:c.studyTopics!.map(item=>item.id===t.id?isMaterial?{...item,materials:change(item.materials||[],entry as SubjectMaterial)}:{...item,flashcards:change(item.flashcards||[],entry as TopicFlashcard)}:item)}));}
    if(remove&&['topics','groups'].includes(entity))env.mutate(()=>a.plannedSessions.filter(session=>session.courseId===c.id&&(entity==='topics'?session.topicId===newId:session.groupId===newId)).forEach(session=>a.updatePlannedSession(session.id,entity==='topics'?{topicId:undefined}:{groupId:undefined})));
    return {id:newId,deleted:remove,...(!remove?{item:publicMcpItem((await items(env.app(),args)).find(i=>i.id===newId),true)}:{})};
  }
  if(entity==='planner_events') {
    const snapshot=await loadPlanner(),newId=create?crypto.randomUUID():old!.id;
    const entry={allDay:false,startTime:'09:00',endTime:'10:00',color:'#737373',repeat:'none',...merged,id:newId} as PlanEvent;
    env.assertActive?.();
    await savePlanner(remove?snapshot.events.filter(e=>e.id!==newId):create?[...snapshot.events,entry]:snapshot.events.map(e=>e.id===newId?entry:e),snapshot.classes);
    if(readFeatured().id===newId)await setFeaturedEvent(remove?null:entry);
    return {id:newId,deleted:remove,...(!remove?{item:publicMcpItem(entry,true)}:{})};
  }
  if(!create&&!remove&&entity==='tracks'){
    let pending:Promise<void>|undefined;
    env.mutate(()=>{pending=a.updateTrack(old!.id,data);});await pending;env.mutate(()=>{});
    return {id:old!.id,item:publicMcpItem(env.app().tracks.find(track=>track.id===old!.id),true)};
  }
  const before=new Set((await items(a,args)).map(i=>i.id));
  env.mutate(()=>{
    if(remove) {switch(entity){case 'tasks':a.deleteTask(old!.id);break;case 'notes':a.deleteNote(old!.id);break;case 'note_folders':a.deleteNoteFolder(old!.id);break;case 'courses':a.deleteCourse(old!.id);break;case 'habits':a.deleteHabit(old!.id);break;case 'planned_sessions':a.deletePlannedSession(old!.id);break;case 'playlists':a.deletePlaylist(old!.id);break;case 'artists':a.deleteArtist(old!.id);break;}return;}
    if(!create){switch(entity){case 'tasks':a.updateTask(old!.id,data);break;case 'notes':a.updateNote(old!.id,data);break;case 'note_folders':a.updateNoteFolder(old!.id,data);break;case 'courses':a.updateCourse(old!.id,data);break;case 'habits':a.updateHabit(old!.id,data);break;case 'planned_sessions':a.updatePlannedSession(old!.id,data);break;case 'tracks':if(old!.isFavorite!==data.isFavorite)a.toggleTrackFavorite(old!.id);break;case 'playlists':a.updatePlaylist(old!.id,data);break;case 'artists':a.updateArtist(old!.id,data);break;}return;}
    switch(entity) {
      case 'tasks':a.addTask({course:'',courseColor:'#737373',priority:'none',urgent:false,important:false,...data} as Parameters<App['addTask']>[0]);break;
      case 'notes':a.addNote({course:'',courseColor:'#737373',isPinned:false,content:'',...data} as Omit<Note,'id'|'createdAt'|'updatedAt'>);break;
      case 'note_folders':a.addNoteFolder({color:'#737373',isManual:true,...data} as Parameters<App['addNoteFolder']>[0]);break;
      case 'courses':a.addCourse({color:'#737373',progress:0,totalTasks:0,completedTasks:0,hoursStudied:0,...data} as Omit<Course,'id'|'sortOrder'>);break;
      case 'habits':a.addHabit(data.name as string);break;
      case 'planned_sessions':a.addPlannedSession({durationMinutes:25,type:'estudio',completed:false,repeat:'none',...data} as Omit<PlannedSession,'id'|'createdAt'>);break;
      case 'playlists':if(a.playlists.some(p=>p.name.toLocaleLowerCase()===(data.name as string).toLocaleLowerCase()))throw new Error('Ya existe una lista con ese nombre.');a.addPlaylist(data.name as string,(data.trackIds||[]) as string[]);break;
      case 'artists':if(a.artists.some(p=>p.name.toLocaleLowerCase()===(data.name as string).toLocaleLowerCase()))throw new Error('Ya existe un artista con ese nombre.');a.addArtist(data.name as string);break;
    }
  });
  let saved=remove?undefined:create?(await items(env.app(),args)).find(i=>!before.has(i.id)):(await items(env.app(),args)).find(i=>i.id===old!.id);
  if(create&&entity==='habits'&&saved&&data.isArchived){const habitId=saved.id;env.mutate(()=>env.app().updateHabit(habitId,{isArchived:true}));saved=env.app().habits.find(h=>h.id===habitId);}
  if(!remove&&!saved)throw new Error('No se confirmó el cambio. Consulta el estado antes de reintentar.');
  return {id:old?.id||saved!.id,deleted:remove,...(!remove?{item:publicMcpItem(saved,true)}:{})};
}


async function moveItem(env:McpEnvironment,args:McpArgs) {
  const a=env.app(),entity=choice(args.entity,['materials','tools','sources','flashcards'],'Apartado'),{c,t}=topic(a,args);
  const targetId=id(args.targetTopicId),target=c.studyTopics?.find(t=>t.id===targetId);
  if(!target)throw new Error('El tema de destino no pertenece al curso.');
  const item=await find(a,args);
  if(t.id===target.id)return {id:item.id,topicId:target.id,moved:false};
  const key=entity==='flashcards'?'flashcards':'materials';
  if((target[key]||[]).some(i=>i.id===item.id))throw new Error('El destino ya contiene este ID.');
  env.mutate(()=>a.updateCourse(c.id,{studyTopics:c.studyTopics!.map(topic=>topic.id===t.id?{...topic,[key]:(topic[key]||[]).filter(i=>i.id!==item.id)}:topic.id===target.id?{...topic,[key]:[...(topic[key]||[]),{...item,groupName:undefined,...(key==='materials'?{generalOnly:false,topicOnly:true}:{})}]}:topic)}));
  return {id:item.id,topicId:target.id,moved:true};
}
async function reorderItems(env:McpEnvironment,args:McpArgs) {
  const a=env.app(),entity=choice(args.entity,['tasks','notes','note_folders','courses','habits','planned_sessions','groups','topics','materials','flashcards'],'Apartado');
  const current=await items(a,args),ids=stringArray(args.ids,2000);
  if(!Array.isArray(args.ids)||ids.length!==args.ids.length||ids.length!==current.length||ids.some(id=>!current.some(i=>i.id===id)))throw new Error('La colección cambió: incluye cada ID actual exactamente una vez.');
  const ordered=ids.map(id=>current.find(i=>i.id===id)!);
  env.mutate(()=>{
    switch(entity) {
      case 'tasks':a.reorderTasks(ids);break;case 'notes':a.reorderNotes(ids);break;case 'note_folders':a.reorderFolders(ids);break;case 'courses':a.reorderCourses(ids);break;case 'planned_sessions':a.reorderPlannedSessions(ids);break;
      case 'habits':ids.forEach((id,order)=>a.updateHabit(id,{order}));break;
      case 'groups':case 'topics':{const c=course(a,args.courseId);a.updateCourse(c.id,{[entity==='groups'?'groups':'studyTopics']:ordered});break;}
      default:{const {c,t}=topic(a,args);a.updateCourse(c.id,{studyTopics:c.studyTopics!.map(topic=>topic.id===t.id?{...topic,[entity]:ordered}:topic)});}
    }
  });
  return {entity,ids};
}

async function toolFolder(env:McpEnvironment,name:string,args:McpArgs) {
  const a=env.app(),{c,t}=topic(a,args),folders=t.toolGroups||[],create=name==='apheka_create',remove=name==='apheka_delete';
  const old=create?'':id(args.id);
  if(!create&&!folders.includes(old))throw new Error('La carpeta ya no existe.');
  const data=remove?{}:record(args.data);onlyFields(data,['name','parentPath']);
  const leaf=remove?'':data.name===undefined?old.split('/').pop()!:text(data.name,'Nombre',120);
  if(!remove&&(/[\\/]/.test(leaf)||leaf==='todos'||['.','..'].includes(leaf)))throw new Error('Usa un nombre sin barras y distinto de todos.');
  const parent=remove?'':data.parentPath===undefined?(create?'':old.split('/').slice(0,-1).join('/')):text(data.parentPath,'Carpeta padre',1000,true);
  if(parent&&!folders.includes(parent))throw new Error('La carpeta padre no existe.');
  if(old&&(parent===old||parent.startsWith(old+'/')))throw new Error('Una carpeta no puede moverse dentro de sí misma.');
  const next=parent?parent+'/'+leaf:leaf;
  if(!remove&&next!==old&&folders.includes(next))throw new Error('Ya existe esa carpeta.');
  const inside=(path:string)=>path===old||path.startsWith(old+'/');
  const renamed=(path:string)=>inside(path)?next+path.slice(old.length):path;
  const mapEntries=<T extends {groupName?:string}>(list:T[])=>remove?list.filter(i=>!inside(i.groupName||'')):list.map(i=>i.groupName?{...i,groupName:renamed(i.groupName)}:i);
  const nextFolders=create?[...folders,next]:remove?folders.filter(path=>!inside(path)):folders.map(renamed);
  if(new Set(nextFolders).size!==nextFolders.length)throw new Error('El cambio colisiona con otra carpeta.');
  env.mutate(()=>a.updateCourse(c.id,{studyTopics:c.studyTopics!.map(topic=>topic.id===t.id?{...topic,toolGroups:nextFolders,...(!create?{materials:mapEntries(topic.materials),flashcards:mapEntries(topic.flashcards||[])}:{})}:topic)}));
  return {id:remove?old:next,previousId:old||undefined,deleted:remove};
}
