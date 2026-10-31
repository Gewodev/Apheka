import React from 'react';
import {Sparkles} from 'lucide-react';
import toast from 'react-hot-toast';
import {buildConnectionPrompt,getMcpClient} from '../../lib/mcpConnection';
export default function ContextAiAction({area}:{area:string}){
  const copy=async()=>{try{const id=getMcpClient(localStorage.getItem('apheka_mcp_client')||'custom').id,name=localStorage.getItem('apheka_mcp_name')||'APHEKA',preferences=localStorage.getItem('apheka_mcp_instructions')||'',custom=localStorage.getItem('apheka_mcp_client_name')||'';const prompt=buildConnectionPrompt(name,preferences,id,custom)+'\n\nCONTEXTO DE TRABAJO\nEstoy en el apartado «'+area+'» de APHEKA. Consulta su estado mediante MCP y ayúdame con mi siguiente petición. Puedes añadir esquemas vectoriales en notas y apuntes con el campo diagram, y explorar el catálogo musical con apheka_search_music. Conserva el contenido existente y verifica lo guardado. Si no tienes la conexión, ayúdame a prepararla desde Ajustes → Sistema → Conecta tu IA con APHEKA.';await navigator.clipboard.writeText(prompt);toast.success('Contexto copiado. Pégalo en tu asistente conectado.');}catch{toast.error('No se pudo copiar el contexto.');}};
  return <button className="btn-secondary context-ai-action" onClick={()=>void copy()} title="Copiar instrucciones de este apartado para tu IA conectada por MCP"><Sparkles size={15}/><span>Preparar con IA</span></button>;
}
