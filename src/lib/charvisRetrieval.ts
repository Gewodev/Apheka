/** Bounded, cached BM25 retrieval with phrase proximity and source diversity. */
export type RetrievalSource={id:string;name:string;text:string;readTool:string;selector:Record<string,string>};
const stop=new Set('para como sobre desde donde cuando porque quiero puedes favor necesito analiza explica resume archivo archivos documento documentos material materiales proyecto chat este esta estos estas todos todas tengo tienes hacer hacerme que del los las una uno unos unas por con sin mas muy sus son sea eso esa ese cual cuales entre'.split(' '));
const normalized=(s:string)=>s.normalize('NFKD').replace(/\p{M}/gu,'').toLocaleLowerCase();
const words=(s:string)=>normalized(s).match(/[\p{L}\p{N}]{2,}/gu)?.filter(word=>!stop.has(word))||[];
type Chunk={offset:number;text:string;counts:Map<string,number>;length:number;sequence:string;lineStart:number};
type Indexed={text:string;chunks:Chunk[]};const indexes=new Map<string,Indexed>();let cachedCharacters=0;
async function indexSource(id:string,text:string,signal:AbortSignal){
 const hit=indexes.get(id);if(hit?.text===text){indexes.delete(id);indexes.set(id,hit);return hit.chunks;}
 if(hit){cachedCharacters-=hit.text.length;indexes.delete(id);}const chunks:Chunk[]=[];let offset=0,line=1;
 while(offset<text.length){signal.throwIfAborted();let end=Math.min(offset+1400,text.length);if(end<text.length){const boundary=text.lastIndexOf('\n',end);if(boundary>offset+650)end=boundary;else{const space=text.lastIndexOf(' ',end);if(space>offset+650)end=space;}}
  const body=text.slice(offset,end),tokens=words(body),counts=new Map<string,number>();for(const token of tokens)counts.set(token,(counts.get(token)||0)+1);chunks.push({offset,text:body,counts,length:tokens.length,sequence:tokens.join(' '),lineStart:line});if(end===text.length)break;const next=Math.max(offset+1,end-120);line+=(text.slice(offset,next).match(/\n/g)||[]).length;offset=next;if(chunks.length%8===0)await new Promise<void>(resolve=>setTimeout(resolve,0));
 }
 while(indexes.size>=12||cachedCharacters+text.length>480000){const first=indexes.keys().next().value;if(first===undefined)break;cachedCharacters-=indexes.get(first)!.text.length;indexes.delete(first);}indexes.set(id,{text,chunks});cachedCharacters+=text.length;return chunks;
}
export async function retrieveCharvisContext(query:string,sources:RetrievalSource[],signal:AbortSignal){
 const terms=[...new Set(words(query))].slice(0,24),phrases=terms.slice(0,10).slice(1).map((term,i)=>terms[i]+' '+term),chunks:Array<{source:RetrievalSource;chunk:Chunk;title:Set<string>}> = [];let scannedCharacters=0;const truncatedSourceIds:string[]=[];
 if(!terms.length)return {method:'local-lexical',version:'bm25-phrase-v2',scannedCharacters,fragments:[],truncatedSourceIds};
 // Cached text is never selected unless the caller supplies it in this scope.
 const scoped=[...new Map(sources.filter(source=>source.text?.trim()).map(source=>[source.id,source])).values()].slice(0,80);
 for(const source of scoped){signal.throwIfAborted();const bound=Math.min(source.text.length,120000,Math.max(0,480000-scannedCharacters));if(bound<source.text.length)truncatedSourceIds.push(source.id);if(!bound)continue;const rows=await indexSource(source.id,source.text.slice(0,bound),signal);for(const chunk of rows)chunks.push({source,chunk,title:new Set(words(source.name))});scannedCharacters+=bound;await new Promise<void>(resolve=>setTimeout(resolve,0));}
 signal.throwIfAborted();const average=chunks.reduce((sum,row)=>sum+row.chunk.length,0)/Math.max(1,chunks.length),frequency=new Map(terms.map(term=>[term,chunks.filter(row=>row.chunk.counts.has(term)||row.title.has(term)).length]));
 const ranked=chunks.map(row=>{let matched=0;const lexical=terms.reduce((sum,term)=>{const count=row.chunk.counts.get(term)||0;if(count||row.title.has(term))matched++;const df=frequency.get(term)||0,idf=Math.log(1+(chunks.length-df+.5)/(df+.5));return sum+idf*(count*2.2/(count+1.2*(.25+.75*row.chunk.length/Math.max(1,average)))+(row.title.has(term)?.75:0));},0);return {...row,score:lexical*(.5+.5*matched/terms.length)+phrases.filter(phrase=>row.chunk.sequence.includes(phrase)).length*.65};}).filter(row=>row.score>0).sort((a,b)=>b.score-a.score||a.source.id.localeCompare(b.source.id)||a.chunk.offset-b.chunk.offset);
 const selected:typeof ranked=[],counts=new Map<string,number>();let characters=0;for(const item of ranked){if((counts.get(item.source.id)||0)>=2||selected.some(row=>row.source.id===item.source.id&&Math.abs(row.chunk.offset-item.chunk.offset)<700)||characters+item.chunk.text.length>5600)continue;selected.push(item);counts.set(item.source.id,(counts.get(item.source.id)||0)+1);characters+=item.chunk.text.length;if(selected.length===4)break;}
 return {method:'local-lexical',version:'bm25-phrase-v2',scannedCharacters,truncatedSourceIds,fragments:selected.map(({source,chunk,score})=>({sourceId:source.id,name:source.name,offset:chunk.offset,lineStart:chunk.lineStart,lineEnd:chunk.lineStart+(chunk.text.match(/\n/g)||[]).length,score:Math.round(score*1000)/1000,text:chunk.text,readTool:source.readTool,selector:source.selector}))};
}
