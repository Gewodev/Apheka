/** Bounded local lexical retrieval. Only pass sources belonging to this chat/project. */
export type RetrievalSource={id:string;name:string;text:string;readTool:string;selector:Record<string,string>};
const stop=new Set('para como sobre desde donde cuando porque quiero puedes favor necesito analiza explica resume archivo archivos documento documentos material materiales proyecto chat este esta estos estas todos todas tengo tienes hacer hacerme que del los las una uno unos unas por con sin mas muy sus son sea eso esa ese cual cuale entre'.split(' '));
const normalized=(value:string)=>value.normalize('NFKD').replace(/\p{M}/gu,'').toLocaleLowerCase();
const words=(value:string)=>normalized(value).match(/[\p{L}\p{N}]{3,}/gu)?.filter(word=>!stop.has(word))||[];
export async function retrieveCharvisContext(query:string,sources:RetrievalSource[],signal:AbortSignal){
 const terms=[...new Set(words(query))].slice(0,24),chunks:Array<{source:RetrievalSource;offset:number;text:string;counts:Map<string,number>;length:number;title:Set<string>}> = [];
 let scannedCharacters=0;const truncatedSourceIds:string[]=[];
 if(!terms.length)return {method:'local-lexical',scannedCharacters,fragments:[],truncatedSourceIds};
 const unique=[...new Map(sources.filter(source=>source.text?.trim()).map(source=>[source.id,source])).values()].slice(0,80);
 for(const source of unique){
  signal.throwIfAborted();const bound=Math.min(source.text.length,120000,Math.max(0,480000-scannedCharacters));
  if(bound<source.text.length)truncatedSourceIds.push(source.id);
  if(!bound)continue;
  for(let offset=0;offset<bound;offset+=1100){
   const text=source.text.slice(offset,Math.min(offset+1200,bound)),tokens=words(text),counts=new Map<string,number>();
   for(const word of tokens)if(terms.includes(word))counts.set(word,(counts.get(word)||0)+1);
   chunks.push({source,offset,text,counts,length:tokens.length,title:new Set(words(source.name))});
  }
  scannedCharacters+=bound;
  // Yield between documents rather than blocking input while scanning several files.
  await new Promise<void>(resolve=>setTimeout(resolve,0));
 }
 signal.throwIfAborted();
 const average=chunks.reduce((sum,chunk)=>sum+chunk.length,0)/Math.max(1,chunks.length);
 const frequency=new Map(terms.map(term=>[term,chunks.filter(chunk=>chunk.counts.has(term)||chunk.title.has(term)).length]));
 const ranked=chunks.map(chunk=>({chunk,score:terms.reduce((sum,term)=>{
  const count=chunk.counts.get(term)||0,df=frequency.get(term)||0,idf=Math.log(1+(chunks.length-df+.5)/(df+.5));
  return sum+idf*((count*2.2)/(count+1.2*(.25+.75*chunk.length/Math.max(1,average)))+(chunk.title.has(term)?.5:0));
 },0)})).filter(item=>item.score>0).sort((a,b)=>b.score-a.score||a.chunk.source.id.localeCompare(b.chunk.source.id)||a.chunk.offset-b.chunk.offset);
 const selected:typeof ranked=[];const perSource=new Map<string,number>();
 for(const item of ranked){if((perSource.get(item.chunk.source.id)||0)>=2)continue;selected.push(item);perSource.set(item.chunk.source.id,(perSource.get(item.chunk.source.id)||0)+1);if(selected.length===4)break;}
 return {method:'local-lexical',scannedCharacters,truncatedSourceIds,fragments:selected.map(({chunk})=>({sourceId:chunk.source.id,name:chunk.source.name,offset:chunk.offset,text:chunk.text,readTool:chunk.source.readTool,selector:chunk.source.selector}))};
}
