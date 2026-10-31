import type {CharvisAttachment} from './charvis';
export async function readCharvisFile(file:File):Promise<CharvisAttachment>{
 const attachment={id:crypto.randomUUID(),name:file.name};
 if(file.size>8*1024*1024)throw Error('Cada adjunto de chat puede ocupar como máximo 8 MB.');
 if(/^image\/(png|jpeg|webp|gif)$/.test(file.type))return {...attachment,image:await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(Error('No se pudo leer la imagen.'));reader.readAsDataURL(file);})};
 if(file.type==='application/pdf'||/\.pdf$/i.test(file.name)){
  const pdfjs=await import('pdfjs-dist'),worker=await import('pdfjs-dist/build/pdf.worker.min.mjs?url');pdfjs.GlobalWorkerOptions.workerSrc=worker.default;
  const task=pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer())}),timeout=setTimeout(()=>void task.destroy(),20000);let text='';
  try{const doc=await task.promise;for(let page=1;page<=Math.min(doc.numPages,30)&&text.length<60000;page++){const item=await doc.getPage(page),content=await item.getTextContent();text+=`\nPágina ${page}\n`+content.items.map(i=>'str' in i?i.str:'').join(' ');item.cleanup();}if(!text.replace(/Página \d+/g,'').trim())throw Error('El PDF no contiene texto extraíble; requiere OCR.');return {...attachment,text:text.slice(0,60000)+(doc.numPages>30?'\n[Se adjuntaron únicamente las primeras 30 páginas.]':'')};}finally{clearTimeout(timeout);await task.destroy();}
 }
 if(file.type.startsWith('text/')||/\.(txt|md|csv|json|tex|html|xml|log)$/i.test(file.name)){const text=await file.text();if(text.includes('\u0000'))throw Error('El archivo no contiene texto legible.');return {...attachment,text:text.slice(0,60000)+(text.length>60000?'\n[Texto limitado a 60.000 caracteres.]':'')};}
 throw Error('Adjunta texto, PDF o imagen. Los audios se incorporan desde el control de transcripción.');
}
