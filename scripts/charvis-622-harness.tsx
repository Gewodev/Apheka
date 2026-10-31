import React,{useLayoutEffect} from 'react';
import {createRoot} from 'react-dom/client';
import {AppProvider,useAppSnapshot} from '../src/store/AppContext';
import CharvisSidebar from '../src/components/ui/CharvisSidebar';
import {type CharvisRequest} from '../src/lib/charvis';
import '../src/fonts.css';import '../src/index.css';import '../src/interface.css';import '../src/workspace-622.css';
const qa=window as any;qa.__charvisRequests=[];qa.__charvisMode='update';let round=0;
const tool=(name:string,args:unknown)=>({choices:[{message:{role:'assistant',content:null,tool_calls:[{id:'call-'+(++round),type:'function',function:{name,arguments:JSON.stringify(args)}}]}}]});
const request:CharvisRequest=async(provider,operation,payload,signal,audio)=>{qa.__charvisRequests.push({provider,operation,payload,audioBytes:audio?.length});if(operation==='transcribe')return {text:'Texto de prueba de la transcripción'};const messages=payload.messages as any[],last=messages[messages.length-1];if(qa.__charvisMode==='wait'){await new Promise((_,reject)=>signal?.addEventListener('abort',()=>reject(new DOMException('Cancelado','AbortError')),{once:true}));}if(last.role==='user')return tool('apheka_get',{entity:'tasks',id:'charvis-task'});if(last.role==='tool'){const response=JSON.parse(last.content);if(messages.slice().reverse().find(m=>m.role==='assistant')?.tool_calls?.[0]?.function.name==='apheka_get')return tool('apheka_update',{entity:'tasks',id:'charvis-task',data:{title:'Tarea organizada por Charvis'}});}return {choices:[{message:{role:'assistant',content:'La herramienta guardó el cambio confirmado.'}}]};};
function Harness(){const snapshot=useAppSnapshot();useLayoutEffect(()=>{qa.__charvisApp=snapshot;},[snapshot]);return <CharvisSidebar request={request}/>;}
createRoot(document.getElementById('root')!).render(<AppProvider><Harness/></AppProvider>);
