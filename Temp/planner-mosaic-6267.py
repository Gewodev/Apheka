from pathlib import Path
p=Path('src/components/views/Planificacion.tsx');s=p.read_text(encoding='utf-8');s=s.replace('tasks, courses, setNavigateTo, addNotification, settings,','tasks, courses, setNavigateTo, setFocusedTaskId, addNotification, settings,',1).replace('["tasks","courses","setNavigateTo",','["tasks","courses","setNavigateTo","setFocusedTaskId",',1)
s=s.replace('  const weekStart = startOfWeek(navDate, { weekStartsOn: 1 });\n  const weekDays  = eachDayOfInterval({ start: weekStart, end: addDays(weekStart, 6) });\n  const monthStart = startOfMonth(navDate);\n  const calStart   = startOfWeek(monthStart, { weekStartsOn: 1 });\n  const calEnd     = endOfWeek(endOfMonth(monthStart), { weekStartsOn: 1 });\n  const calDays    = eachDayOfInterval({ start: calStart, end: calEnd });\n  const weekRows   = calDays.reduce<Date[][]>((a, d, i) => { if (i%7===0) a.push([]); a[a.length-1].push(d); return a; }, []);','''  const tasksByDate=useMemo(()=>{const index=new Map<string,typeof tasks>();for(const task of tasks){if(!task.dueDate)continue;const day=task.dueDate.slice(0,10);const bucket=index.get(day);if(bucket)bucket.push(task);else index.set(day,[task]);}return index;},[tasks]);
  const {weekDays,monthStart,weekRows}=useMemo(()=>{
    const weekStart=startOfWeek(navDate,{weekStartsOn:1});
    const weekDays=eachDayOfInterval({start:weekStart,end:addDays(weekStart,6)});
    const monthStart=startOfMonth(navDate),calStart=startOfWeek(monthStart,{weekStartsOn:1}),calEnd=endOfWeek(endOfMonth(monthStart),{weekStartsOn:1});
    const calDays=eachDayOfInterval({start:calStart,end:calEnd});
    const weekRows=calDays.reduce<Date[][]>((rows,day,i)=>{if(i%7===0)rows.push([]);rows[rows.length-1].push(day);return rows;},[]);
    return {weekDays,monthStart,weekRows};
  },[navDate]);''')
s=s.replace("const dayTasks=tasks.filter(t=>{if(!t.dueDate)return false;if(linkedTaskIds.has(t.id))return false;return (t.dueDate||'').slice(0,10)===iso});","const dayTasks=(tasksByDate.get(iso)||[]).filter(t=>!linkedTaskIds.has(t.id));")
s=s.replace("const dayTasks2 = tasks.filter(t => { if(!t.dueDate) return false; if(dayLinkedIds2.has(t.id)) return false; return (t.dueDate||'').slice(0,10)===iso });","const dayTasks2 = (tasksByDate.get(iso)||[]).filter(t=>!dayLinkedIds2.has(t.id));")
import re
s,n=re.subn(r'tasks\.filter\(t => \{\s*if \(!t\.dueDate\) return false;\s*if \(evLinkedIds\.has\(t\.id\)\) return false;\s*return \(t\.dueDate as string\)\.slice\(0, 10\) === iso;\s*\}\)', '(tasksByDate.get(iso)||[]).filter(t=>!evLinkedIds.has(t.id))',s);assert n==1,n
s=s.replace("onViewTask={(id) => { setSelectedItem(null); setNavigateTo(`tareas`); /* TODO: pass taskId to Tareas to open detail */ }}","onViewTask={(id) => { setSelectedItem(null); setFocusedTaskId(id); setNavigateTo('tareas'); }}")
s=s.replace("{shownTasks.map((t,ti)=><div key={ti} style=", "{shownTasks.map(t=><button type=\"button\" className=\"month-task-entry\" key={t.id} title={t.title} onClick={event=>{event.stopPropagation();setSelectedItem({type:'task',task:t});}} style=")
s=s.replace("{t.status==='completado'?'✓ ':''}{t.title}</div>)}","{t.status==='completado'?'✓ ':''}{t.title}</button>)}")
s=s.replace("backdropFilter: 'blur(var(--bg-blur, 10px))', WebkitBackdropFilter: 'blur(var(--bg-blur, 10px))'","background:'transparent'")
p.write_text(s,encoding='utf-8')
p=Path('src/components/views/Cursos.tsx');s=p.read_text(encoding='utf-8');s=s.replace('className="course-notes-scroll">\n                          {expandedFirst.map','className="course-notes-scroll">\n                          <div className="course-note-mosaic">\n                          {expandedFirst.map',1);s=s.replace('<SortableWrapper key={n.id} id={n.id}>','<SortableWrapper key={n.id} id={n.id} style={{breakInside:\'avoid\',columnSpan:isExpanded?\'all\':undefined,marginBottom:14}}>',1);s=s.replace('                          })}\n                        </div>\n                      </SortableContext>','                          })}\n                          </div>\n                        </div>\n                      </SortableContext>',1);p.write_text(s,encoding='utf-8')

