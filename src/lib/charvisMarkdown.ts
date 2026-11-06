import {marked} from 'marked';
import {sanitizePastedHtml} from './editorHtml';
import {renderFormula} from './latex';
const formulas=new Map<string,string|null>();let formulaCharacters=0;
function cachedFormula(tex:string,display:boolean){const key=(display?'D':'I')+tex;if(formulas.has(key)){const hit=formulas.get(key)!;formulas.delete(key);formulas.set(key,hit);return hit;}const html=renderFormula(tex,display);while(formulas.size>=32||formulaCharacters+(html?.length||0)>400000){const first=formulas.keys().next().value;if(first===undefined)break;formulaCharacters-=formulas.get(first)?.length||0;formulas.delete(first);}if((html?.length||0)<=400000){formulas.set(key,html);formulaCharacters+=html?.length||0;}return html;}
/** Protect TeX from Markdown punctuation, then insert trusted KaTeX output only into text nodes. */
export function renderChatMarkdown(source:string){
 const math=new Map<string,{raw:string;html:string|null}>(),prefix='APHKMATH'+crypto.randomUUID().replace(/-/g,'');let count=0;
 const prepared=source.replace(/```(?:math|latex|tex)\s*\n([\s\S]*?)```/gi,(_raw,tex)=>'$$\n'+tex+'\n$$');
 const text=prepared.split(/(```[\s\S]*?```|`[^`\n]*`)/g).map((part,index)=>index%2?part:part.replace(/(^|\n)(\\begin\{(align\*?|aligned|gather\*?|equation\*?|[bpvV]?matrix|cases)\}[\s\S]*?\\end\{\3\})(?=\n|$)/g,(_raw,lead,tex)=>lead+'$$'+tex+'$$').replace(/\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\\\(([\s\S]+?)\\\)|(?<!\\)\$([^$\n]+?)\$/g,(raw,a,b,c,d)=>{const token=prefix+(count++)+'END';math.set(token,{raw,html:cachedFormula(a??b??c??d,!!(a||b))});return token;})).join('');
 const html=sanitizePastedHtml(marked.parse(text,{async:false}) as string);if(!math.size)return html;const doc=new DOMParser().parseFromString(html,'text/html'),walker=doc.createTreeWalker(doc.body,NodeFilter.SHOW_TEXT),nodes:Text[]=[];
 while(walker.nextNode()){const node=walker.currentNode as Text;if(node.data.includes(prefix)&&!node.parentElement?.closest('pre,code'))nodes.push(node);}
 const pattern=new RegExp(prefix+'\\d+END','g');for(const node of nodes){const fragment=doc.createDocumentFragment();let last=0;for(const match of node.data.matchAll(pattern)){fragment.append(doc.createTextNode(node.data.slice(last,match.index)));const value=math.get(match[0])!;if(value.html){const template=doc.createElement('template');template.innerHTML=value.html;for(const el of template.content.querySelectorAll('[data-latex-source]')){el.removeAttribute('contenteditable');el.removeAttribute('title');}fragment.append(template.content);}else fragment.append(doc.createTextNode(value.raw));last=match.index!+match[0].length;}fragment.append(doc.createTextNode(node.data.slice(last)));node.replaceWith(fragment);}
 return doc.body.innerHTML;
}
