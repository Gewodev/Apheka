from pathlib import Path
p=Path('src/components/ui/AppCommandsPanel.tsx');s=p.read_text(encoding='utf-8').replace('readCommandShortcuts,shortcutCommand','readCommandShortcuts,shortcutCommand,COMMAND_SHORTCUT_EVENT',1).replace('useEffect,useRef,useState','useDeferredValue,useEffect,useMemo,useRef,useState',1)
old=" const notes=a.notes.filter(n=>!n.deletedAt&&(!course||n.course===a.courses.find(c=>c.id===course)?.name)&&`${n.title} ${n.course} ${n.content.replace(/<[^>]*>/g,' ')}`.toLocaleLowerCase().includes(query.toLocaleLowerCase())).slice(0,30);"
new=""" const deferredQuery=useDeferredValue(query),courseName=a.courses.find(c=>c.id===course)?.name;
 const noteIndex=useMemo(()=>action==='open-note'?a.notes.filter(n=>!n.deletedAt).map(note=>({note,text:`${note.title} ${note.course} ${note.content.replace(/<[^>]*>/g,' ')}`.toLocaleLowerCase()})):[],[a.notes,action]);
 const notes=useMemo(()=>noteIndex.filter(row=>(!course||row.note.course===courseName)&&row.text.includes(deferredQuery.toLocaleLowerCase())).slice(0,30).map(row=>row.note),[noteIndex,course,courseName,deferredQuery]);
 const commands=useMemo(()=>APP_COMMANDS.filter(([id,label])=>(label+' '+COMMAND_META[id].description).toLocaleLowerCase().includes(query.toLocaleLowerCase())),[query]);"""
assert old in s;s=s.replace(old,new)
s=s.replace("{action==='menu'?<div className=\"app-command-grid\">{APP_COMMANDS.map", "{action==='menu'?<><label className=\"command-palette-search\"><Search size={17}/><input autoFocus aria-label=\"Buscar comando\" placeholder=\"Buscar una acción…\" value={query} onChange={e=>setQuery(e.target.value)}/><kbd>Esc</kbd></label><div className=\"app-command-grid\">{commands.map",1)
s=s.replace("</small></span></button>;})}</div>:<form", "</small></span></button>;})}{!commands.length&&<p className=\"command-empty\">No hay acciones con ese nombre.</p>}</div></>:<form",1)
needle="useEffect(()=>{const open=(e:Event)=>"
assert needle in s;s=s.replace(needle,"useEffect(()=>{let bindings=readCommandShortcuts();const refreshBindings=()=>{bindings=readCommandShortcuts();};const storageBindings=(event:StorageEvent)=>{if(event.key==='pohu_command_shortcuts')refreshBindings();};const open=(e:Event)=>",1)
s=s.replace('shortcutCommand(e,readCommandShortcuts())','shortcutCommand(e,bindings)')
s=s.replace("window.addEventListener(APP_COMMAND_EVENT,open);window.addEventListener('keydown',key);return()=>{", "window.addEventListener(APP_COMMAND_EVENT,open);window.addEventListener('keydown',key);window.addEventListener(COMMAND_SHORTCUT_EVENT,refreshBindings);window.addEventListener('storage',storageBindings);return()=>{window.removeEventListener(COMMAND_SHORTCUT_EVENT,refreshBindings);window.removeEventListener('storage',storageBindings);",1)
p.write_text(s,encoding='utf-8')
p=Path('src/lib/commandShortcuts.ts');s=p.read_text(encoding='utf-8').replace("['N','O','T','E','S','P','C','M','A','J','L']","'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').filter(key=>key!=='H')");p.write_text(s.rstrip()+'\n',encoding='utf-8')
