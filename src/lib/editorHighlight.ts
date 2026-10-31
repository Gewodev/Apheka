/** Keep highlight contrast independent of the document theme, without changing line geometry. */
export function applyEditorHighlight(editor:HTMLElement,color='rgba(245,158,11,.25)'){
 const selected=getSelection();if(!selected?.rangeCount||!editor.contains(selected.anchorNode))return;
 document.execCommand('styleWithCSS',false,'true');
 document.execCommand('hiliteColor',false,color);
 document.execCommand('styleWithCSS',false,'false');
 if(!selected.rangeCount)return;
 const range=selected.getRangeAt(0),canvas=document.createElement('canvas');canvas.width=canvas.height=1;
 const context=canvas.getContext('2d');if(!context)return;
 context.fillStyle=color;context.fillRect(0,0,1,1);const [r,g,b,alpha]=context.getImageData(0,0,1,1).data;
 const parent=range.startContainer.parentElement;
 const candidates=new Set<HTMLElement>([...editor.querySelectorAll<HTMLElement>('span[style],mark[style]'),...(parent&&parent!==editor?[parent]:[])]);
 for(const element of candidates){
  if(!element.style.backgroundColor||!range.intersectsNode(element))continue;
  element.style.removeProperty('padding');element.style.removeProperty('border-radius');
  if(alpha===0){element.style.removeProperty('background-color');if(element.dataset.noteHighlight==='true'){element.style.removeProperty('color');delete element.dataset.noteHighlight;}}
  else {element.dataset.noteHighlight='true';element.style.color=alpha<220?'inherit':(.2126*r+.7152*g+.0722*b>155?'#192329':'#f1f4f5');}
 }
}
