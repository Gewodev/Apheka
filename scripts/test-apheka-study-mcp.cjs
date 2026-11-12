const base=process.env.APHEKA_QA_URL||'http://127.0.0.1:1420';
const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
function pdfFixture(){
 const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
 const stream='BT /F1 18 Tf 72 720 Td (APHEKA PDF QA) Tj ET';objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
 let data='%PDF-1.4\n',offsets=[0];objects.forEach((v,i)=>{offsets.push(data.length);data+=`${i+1} 0 obj\n${v}\nendobj\n`;});const start=data.length;data+=`xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${start}\n%%EOF`;
 return 'data:application/pdf;base64,'+Buffer.from(data).toString('base64');
}
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const page=await browser.newPage({viewport:{width:1200,height:850}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/scripts/apheka-mcp-preview.html');await page.waitForFunction(()=>window.__mcpApp?.hydrated);
 const raw=(name,args={})=>page.evaluate(([n,a])=>window.__mcpRequest(n,a),[name,args]);
 const call=async(n,a={})=>{const r=await raw(n,a);assert.equal(r.isError,false,JSON.stringify(r));return r.structuredContent.result;};
 const fail=async(n,a)=>assert.equal((await raw(n,a)).isError,true,JSON.stringify(a));
 const c=await call('apheka_create',{entity:'courses',data:{name:'Herramientas QA'}});
 const createTopic=title=>call('apheka_create',{entity:'topics',courseId:c.id,data:{title}});
 const t=await createTopic('Origen'),t2=await createTopic('Destino'),scope={courseId:c.id,topicId:t.id};
 const folder=await call('apheka_create',{entity:'tool_folders',...scope,data:{name:'Repaso'}});
 await call('apheka_create',{entity:'tool_folders',...scope,data:{name:'Semana 1',parentPath:folder.id}});
 const tag=await call('apheka_create',{entity:'tags',courseId:c.id,data:{name:'Examen',color:'#789A88'}});
 const decks={flashcardsDeck:{cards:[{q:'¿Pregunta?',a:'Respuesta'}]},quizDeck:{questions:[{q:'¿Capital?',options:['Lima','Quito'],correct:0}]},matchDeck:{pairs:[{a:'A',b:'1'},{a:'B',b:'2'}]},clozeDeck:{items:[{text:'La capital es [Lima]',answers:['Lima']}]},feynmanDeck:{concepts:[{concept:'Memoria',source:'Fuente',points:['Recuperación activa']}]},vfDeck:{items:[{text:'Dos más dos son cuatro',answer:true}]},seqDeck:{seqs:[{name:'Método',steps:['Observar','Probar']}]},catDeck:{items:[{item:'Ballena',cat:'Mamífero'}]}};
 const saved=[];
 for(const [toolMode,deck] of Object.entries(decks)){const v=await call('apheka_create',{entity:'tools',...scope,data:{title:toolMode,toolMode,deck,groupName:'Repaso/Semana 1',tagIds:[tag.id]}});saved.push(v.id);const read=await call('apheka_read_content',{entity:'tools',...scope,id:v.id});assert.deepEqual(JSON.parse(read.text),deck);}
 const contract=await call('apheka_describe');assert.equal(Object.keys(contract.studyTools.decks).length,8);
 for(const mode of Object.keys(contract.studyTools.techniques))await call('apheka_create',{entity:'tools',...scope,data:{title:mode,toolMode:mode,content:'Texto para practicar',question:'Pregunta',answer:'Respuesta',word:'Concepto',meaning:'Explicación'}});
 await fail('apheka_create',{entity:'tools',...scope,data:{title:'Inválido',toolMode:'quizDeck',deck:{questions:[{q:'Q',options:['A','B'],correct:3}]}}});
 await fail('apheka_create',{entity:'tools',...scope,data:{title:'Inválido',toolMode:'clozeDeck',deck:{items:[{text:'[A]',answers:['B']}]}}});
 await fail('apheka_update',{entity:'tools',...scope,id:saved[0],data:{content:'romper JSON'}});
 await fail('apheka_update',{entity:'materials',...scope,id:saved[0],data:{toolMode:'vfDeck'}});
 await fail('apheka_update',{entity:'tool_folders',...scope,id:'Repaso',data:{parentPath:'Repaso/Semana 1'}});
 await call('apheka_update',{entity:'tool_folders',...scope,id:'Repaso',data:{name:'Práctica'}});
 assert.equal((await call('apheka_get',{entity:'tools',...scope,id:saved[0]})).groupName,'Práctica/Semana 1');
 await call('apheka_move',{entity:'tools',...scope,id:saved[0],targetTopicId:t2.id});
 assert.equal((await call('apheka_get',{entity:'tools',courseId:c.id,topicId:t2.id,id:saved[0]})).groupName,undefined);
 const ordered=await call('apheka_list',{entity:'materials',...scope,limit:100});const ids=ordered.items.map(i=>i.id).reverse();
 await fail('apheka_reorder',{entity:'materials',...scope,ids:ids.slice(1)});await call('apheka_reorder',{entity:'materials',...scope,ids});assert.deepEqual((await call('apheka_list',{entity:'materials',...scope,limit:100})).items.map(i=>i.id),ids);
 const source=await call('apheka_create',{entity:'sources',...scope,data:{name:'Referencia',sourceUrl:'https://example.com/study',topicOnly:true}});
 assert.equal((await call('apheka_get',{entity:'sources',...scope,id:source.id})).sourceUrl,'https://example.com/study');assert.ok((await call('apheka_list',{entity:'sources',courseId:c.id})).items[0].topicId);
 await fail('apheka_create',{entity:'sources',...scope,data:{name:'Privada',sourceUrl:'https://user:secret@example.com'}});
 await fail('apheka_create',{entity:'sources',...scope,data:{name:'Interna',sourceUrl:'https://asset.localhost/C%3A/doc.pdf'}});
 await page.evaluate(({scope,pdf})=>{const a=window.__mcpApp,c=a.courses.find(c=>c.id===scope.courseId);a.updateCourse(c.id,{studyTopics:c.studyTopics.map(t=>t.id===scope.topicId?{...t,materials:[...t.materials,{id:'pdf-qa',type:'resource',createdAt:Date.now(),columnIndex:0,name:'Prueba.pdf',dataUrl:pdf},{id:'txt-qa',type:'resource',createdAt:Date.now(),columnIndex:0,name:'Prueba.txt',dataUrl:'data:text/plain,'+encodeURIComponent('Un texto completo con  dos espacios')}]}:t)});},{scope,pdf:pdfFixture()});
 const pdf=await call('apheka_read_resource',{...scope,id:'pdf-qa'});assert.equal(pdf.totalPages,1);assert.ok(pdf.pages[0].text.includes('APHEKA PDF QA'));
 const text=await call('apheka_read_resource',{...scope,id:'txt-qa',offset:3,limit:5});assert.equal(text.text,'texto');assert.equal(text.nextOffset,8);
 const link=await call('apheka_read_resource',{...scope,id:source.id});assert.equal(link.kind,'link');assert.equal(link.text,null);
 await page.reload();await page.waitForFunction(()=>window.__mcpApp?.hydrated);assert.equal((await call('apheka_list',{entity:'tools',...scope,limit:100})).total,7+Object.keys(contract.studyTools.techniques).length);
 const deletion=raw('apheka_delete',{entity:'tags',courseId:c.id,id:tag.id});await page.getByRole('button',{name:'Confirmar acción'}).click();assert.equal((await deletion).isError,false);assert.equal((await call('apheka_get',{entity:'tools',...scope,id:saved[1]})).tagIdsCount,0);
 assert.deepEqual(errors,[]);console.log('PASS expanded MCP: 8 deck modes, all study techniques, strict schemas, nested folders/rename/cycle protection, sources, paged PDF/text, link provenance, tags, move/reorder and reload persistence');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
