import {localPathFromUrl} from './externalTarget';
import {publicSourceUrl} from './mcpStudy';
import {number,type McpArgs} from './mcpCatalog';

const MAX_BYTES=20*1024*1024;
function integer(value:unknown,label:string,fallback:number,min:number,max:number) {
  const n=value===undefined?fallback:number(value,label,min,max);
  if(!Number.isInteger(n))throw new Error(`${label}: usa un entero.`);
  return n;
}
export async function readMcpResource(item:Record<string,any>,args:McpArgs,assertActive?:()=>void) {
  const url=String(item.dataUrl||''),remote=publicSourceUrl(url);
  if(remote)return {id:item.id,name:item.name,kind:'link',sourceUrl:remote,text:null,instructions:'Use your own browsing tools to research this source. A URL is not evidence that its contents were read.'};
  let bytes:Uint8Array;
  const path=localPathFromUrl(url);
  if(path) {
    const {stat,readFile}=await import('@tauri-apps/plugin-fs');
    const info=await stat(path);
    if(!info.isFile||info.size>MAX_BYTES)throw new Error('Solo archivos de hasta 20 MB.');
    assertActive?.();bytes=await readFile(path);
  } else if(url.startsWith('data:')) {
    if(url.length>MAX_BYTES*1.4)throw new Error('Solo archivos de hasta 20 MB.');
    const response=await fetch(url);bytes=new Uint8Array(await response.arrayBuffer());
  } else throw new Error('La fuente ya no está disponible. Vuelve a adjuntarla desde el curso.');
  if(bytes.length>MAX_BYTES)throw new Error('Solo archivos de hasta 20 MB.');
  assertActive?.();
  const name=String(item.name||''),limit=integer(args.limit,'limit',30000,1,30000),offset=integer(args.offset,'offset',0,0,10000000);
  const slice=(text:string)=>({totalCharacters:text.length,offset,text:text.slice(offset,offset+limit),nextOffset:offset+limit<text.length?offset+limit:null});
  if(new TextDecoder().decode(bytes.slice(0,5))==='%PDF-') {
    const pdfjs=await import('pdfjs-dist');
    const worker=await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
    pdfjs.GlobalWorkerOptions.workerSrc=worker.default;
    const task=pdfjs.getDocument({data:bytes,useSystemFonts:true});
    const timer=setTimeout(()=>{void task.destroy();},20000);
    try {
      const pdf=await task.promise;
      const start=integer(args.page,'page',1,1,pdf.numPages),count=integer(args.pages,'pages',1,1,5),end=Math.min(pdf.numPages,start+count-1);
      const pages=[];
      for(let pageNumber=start;pageNumber<=end;pageNumber++) {
        assertActive?.();const page=await pdf.getPage(pageNumber),content=await page.getTextContent();
        const text=content.items.map(item=>'str' in item?item.str+(item.hasEOL?'\n':' '):'').join('').trim();
        pages.push({page:pageNumber,...slice(text),scannedOrEmpty:!text});page.cleanup();
      }
      return {id:item.id,name,kind:'pdf',totalPages:pdf.numPages,pages,nextPage:end<pdf.numPages?end+1:null,note:'Text extraction only. Empty/scanned pages require OCR in another tool. Each page has independent character pagination.'};
    } finally {clearTimeout(timer);await task.destroy();}
  }
  if(!/\.(txt|md|csv|json|html?|xml)$/i.test(name)&&!/^data:(text\/|application\/(json|xml))/.test(url))throw new Error('Se admite texto, Markdown, CSV, JSON, HTML y PDF con texto. Otros formatos deben convertirse desde la app.');
  let text=new TextDecoder().decode(bytes);
  if(/\.html?$/i.test(name)||url.startsWith('data:text/html')) {
    const doc=new DOMParser().parseFromString(text,'text/html');doc.querySelectorAll('script,style,iframe,object').forEach(el=>el.remove());text=doc.body.textContent||'';
  }
  return {id:item.id,name,kind:'text',...slice(text)};
}
