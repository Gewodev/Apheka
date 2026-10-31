import type {CharvisAttachment} from './charvis';
/** Preserve pasted wording; normalize structure, never infer or rewrite its meaning. */
export function pastedMarkdown(raw:string):CharvisAttachment|null{
 if(raw.length<1500&&raw.split('\n').length<14)return null;
 const normalized=raw.replace(/\r\n?/g,'\n').replace(/\u00a0/g,' ').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'');
 let fenced=false;const lines=normalized.split('\n').map((line,index,all)=>{if(/^\s*```/.test(line)){fenced=!fenced;return line;}if(fenced)return line;const text=line.trimEnd();if(/^\s*[•▪◦]\s+/.test(text))return text.replace(/^\s*[•▪◦]\s+/,'- ');if(text.length>=5&&text.length<100&&/\p{L}/u.test(text)&&text===text.toLocaleUpperCase()&&!/^\s*(#|>|[-*]|\d+[.)]|https?:)/.test(text)&&(index===0||!all[index-1].trim()))return '## '+text;return text;});
 const text=lines.join('\n').replace(/\n{4,}/g,'\n\n\n').trim();return {id:crypto.randomUUID(),name:'Texto pegado.md',text,kind:'file',readStatus:'Markdown · texto original'};
}
