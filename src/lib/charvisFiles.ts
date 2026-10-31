import type {CharvisAttachment} from './charvis';
export async function readCharvisFile(file:File):Promise<CharvisAttachment>{
 const attachment={id:crypto.randomUUID(),name:file.name};
 if(file.size>8*1024*1024)throw Error('Cada adjunto de chat puede ocupar como máximo 8 MB.');
 if(/\.(docx|xlsx|pptx)$/i.test(file.name))return (await import('./officeAttachments')).readOfficeAttachment(file);
 if(/^image\/(png|jpeg|webp|gif)$/.test(file.type))return {...attachment,image:await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(Error('No se pudo leer la imagen.'));reader.readAsDataURL(file);})};
 if(file.type==='application/pdf'||/\.pdf$/i.test(file.name)){
  const pdfjs=await import('pdfjs-dist'),worker=await import('pdfjs-dist/build/pdf.worker.min.mjs?url');pdfjs.GlobalWorkerOptions.workerSrc=worker.default;
  const pdfData=new Uint8Array(await file.arrayBuffer()),task=pdfjs.getDocument({data:pdfData.slice()}),timeout=setTimeout(()=>void task.destroy(),20000);let text='',thumbnail:string|undefined;
  try{const doc=await task.promise;let readPages=0;for(let page=1;page<=Math.min(doc.numPages,30)&&text.length<60000;page++){const item=await doc.getPage(page),content=await item.getTextContent();text+=`\nPágina ${page}\n`+content.items.map(i=>'str' in i?i.str:'').join(' ');readPages=page;if(page===1){const viewport=item.getViewport({scale:1}),view=item.getViewport({scale:180/viewport.width}),canvas=document.createElement('canvas');canvas.width=view.width;canvas.height=view.height;await item.render({canvas,canvasContext:canvas.getContext('2d')!,viewport:view}).promise;thumbnail=canvas.toDataURL('image/webp',.75);}item.cleanup();}const readable=!!text.replace(/Página \d+/g,'').trim(),partial=readPages<doc.numPages||text.length>60000;return {...attachment,pdfData,thumbnail,pages:doc.numPages,kind:'file',readStatus:readable?partial?'Lectura parcial':'Texto extraído':'Requiere OCR',text:readable?text.slice(0,60000)+(partial?'\n[Lectura parcial: texto limitado a 30 páginas o 60.000 caracteres.]':''):'[PDF adjunto sin texto extraíble. Solo se puede mostrar la vista previa; no se ha realizado OCR.]'};}finally{clearTimeout(timeout);await task.destroy();}
 }
 if(file.type.startsWith('text/')||/\.(txt|md|csv|json|tex|html|xml|log)$/i.test(file.name)){const text=await file.text();if(text.includes('\u0000'))throw Error('El archivo no contiene texto legible.');return {...attachment,text:text.slice(0,60000)+(text.length>60000?'\n[Texto limitado a 60.000 caracteres.]':'')};}
 throw Error('Adjunta texto, PDF o imagen. Los audios se incorporan desde el control de transcripción.');
}
