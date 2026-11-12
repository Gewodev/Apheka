import React from 'react';
import {createRoot} from 'react-dom/client';
import {DeckEditorModal, DeckRunner, DECK_META, type ToolDeckMode} from '../src/components/views/cursos/ToolDecks';
let root: ReturnType<typeof createRoot> | undefined;
export function mountTool(mode:ToolDeckMode,editor=false,content='{}') {
 root?.unmount();document.getElementById('tool-test-root')?.remove();
 const host=document.createElement('div');host.id='tool-test-root';host.style.cssText='position:fixed;inset:40px;z-index:100000;background:var(--bg-base)';document.body.append(host);root=createRoot(host);
 const close=()=>{root?.unmount();host.remove()};
 root.render(editor?<DeckEditorModal mode={mode} accent="#8b5cf6" initialName="Tema de práctica" initialContent={content} onClose={close} onSave={(name,color,value)=>{(window as any).__deckSaved={name,color,value};close()}}/>:<DeckRunner mat={{id:'test-'+mode,toolMode:mode,name:'Práctica',content}} accent="#8b5cf6" onClose={close}/>);
}
export const modes=Object.keys(DECK_META);
