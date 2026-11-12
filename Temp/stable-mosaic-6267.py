from pathlib import Path
p=Path('src/components/views/Cursos.tsx');s=p.read_text(encoding='utf-8');needle='  const overviewNoteContainerRef = useRef<HTMLDivElement>(null);';assert needle in s;s=s.replace(needle,needle+"\n  const overviewNoteMeasure=useObservedSize<HTMLDivElement>();\n  const bindOverviewNotes=useCallback((node:HTMLDivElement|null)=>{overviewNoteContainerRef.current=node;overviewNoteMeasure.ref(node);},[overviewNoteMeasure.ref]);",1)
s=s.replace('ref={overviewNoteContainerRef} style={{ display:', 'ref={bindOverviewNotes} style={{ display:',1)
start=s.index('                          <div className="course-note-mosaic">\n                          {expandedFirst.map(n => {');end=s.index('                          })}\n                          </div>',start)
block=s[start:end+len('                          })}\n                          </div>')];body=block[block.index('expandedFirst.map(n => {'):block.rindex('                          })}')]+ '                          });'
replacement='''                          {(() => {
                            const cards='''+body+'''
                            const count=Math.max(1,Math.min(4,Math.floor(((overviewNoteMeasure.size?.w||260)+14)/274)));
                            const columns:React.ReactNode[][]=Array.from({length:count},()=>[]),positions=new Map(sortedIds.map((id,index)=>[id,index]));
                            const hasExpanded=expandedFirst[0]?.id===selectedOverviewNoteId;
                            cards.forEach((card,index)=>{if(index===0&&hasExpanded)return;columns[(positions.get(expandedFirst[index].id)||0)%count].push(card);});
                            return <>{hasExpanded&&<div className="course-note-mosaic-expanded">{cards[0]}</div>}<div className="course-note-mosaic" style={{gridTemplateColumns:`repeat(${count},minmax(0,1fr))`}}>{columns.map((column,index)=><div className="course-note-mosaic-column" key={index}>{column}</div>)}</div></>;
                          })()}'''
s=s[:start]+replacement+s[end+len(block):];p.write_text(s,encoding='utf-8')
p=Path('src/workspace-6267.css');s=p.read_text(encoding='utf-8').replace('.course-note-mosaic{columns:260px auto;column-gap:14px}', '.course-note-mosaic{display:grid;gap:14px;align-items:start}.course-note-mosaic-column{display:flex;flex-direction:column;min-width:0}.course-note-mosaic-expanded{margin-bottom:14px}');p.write_text(s,encoding='utf-8')
p=Path('scripts/test-details-6267.cjs');s=p.read_text(encoding='utf-8').replace("assert.ok(await p.locator('.task-inspector').getByText('Entrega específica del calendario',{exact:true}).count()>0)","assert.ok(await p.locator('.task-inspector').locator('input').evaluateAll(inputs=>inputs.some(input=>input.value==='Entrega específica del calendario')))")
# Keep just the diagnostic report, rather than logging whole fixture content.
a=s.index("console.log('STATE'");b=s.index("await p.locator('.course-note-mosaic').waitFor();",a);s=s[:a]+s[b:];p.write_text(s,encoding='utf-8')
