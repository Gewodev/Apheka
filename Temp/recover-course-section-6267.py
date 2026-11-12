from pathlib import Path
import subprocess
p=Path('src/components/views/Cursos.tsx');s=subprocess.check_output(['git','show','HEAD:src/components/views/Cursos.tsx'],text=True,encoding='utf-8')
needle='  const overviewNoteContainerRef = useRef<HTMLDivElement>(null);';assert needle in s;s=s.replace(needle,needle+"\n  const overviewNoteMeasure=useObservedSize<HTMLDivElement>();\n  const bindOverviewNotes=useCallback((node:HTMLDivElement|null)=>{overviewNoteContainerRef.current=node;overviewNoteMeasure.ref(node);},[overviewNoteMeasure.ref]);",1)
s=s.replace('ref={overviewNoteContainerRef} style={{ display:', 'ref={bindOverviewNotes} style={{ display:',1)
start=s.index('{expandedFirst.map(n => {');marker='                          })}';end=s.index(marker,start)
old=s[start:end+len(marker)];body=old[1:-1]+';'
new='''{(() => {
                            const cards='''+body+'''
                            const count=Math.max(1,Math.min(4,Math.floor(((overviewNoteMeasure.size?.w||260)+14)/274)));
                            const columns:React.ReactNode[][]=Array.from({length:count},()=>[]),positions=new Map(sortedIds.map((id,index)=>[id,index]));
                            const hasExpanded=expandedFirst[0]?.id===selectedOverviewNoteId;
                            cards.forEach((card,index)=>{if(index===0&&hasExpanded)return;columns[(positions.get(expandedFirst[index].id)||0)%count].push(card);});
                            return <>{hasExpanded&&<div className="course-note-mosaic-expanded">{cards[0]}</div>}<div className="course-note-mosaic" style={{gridTemplateColumns:`repeat(${count},minmax(0,1fr))`}}>{columns.map((column,index)=><div className="course-note-mosaic-column" key={index}>{column}</div>)}</div></>;
                          })()}'''
s=s[:start]+new+s[end+len(marker):];p.write_text(s,encoding='utf-8')
p=Path('src/workspace-6267.css');s=p.read_text(encoding='utf-8').replace('.course-note-mosaic-column{display:flex;flex-direction:column;min-width:0}', '.course-note-mosaic-column{display:flex;flex-direction:column;min-width:0;gap:14px}');p.write_text(s,encoding='utf-8')
