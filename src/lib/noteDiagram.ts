export type DiagramPosition={x:number;y:number};
export type DiagramData={aphekaDiagram:1;source:string;positions:Record<string,DiagramPosition>};
const xml=(text:string)=>text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
export function diagramGraph(source:string,positions:Record<string,DiagramPosition>={}){
  if(source.length>6000)throw Error('El esquema admite hasta 6.000 caracteres.');
  const nodes:{id:string;label:string;x:number;y:number}[]=[],edges:{from:string;to:string}[]=[],byLabel=new Map<string,string>();
  const node=(label:string)=>{label=label.trim();if(!label||label.length>70)throw Error('Cada concepto debe tener entre 1 y 70 caracteres.');let id=byLabel.get(label);if(!id){if(nodes.length>=32)throw Error('El esquema admite hasta 32 conceptos.');id='n'+nodes.length;byLabel.set(label,id);nodes.push({id,label,x:0,y:0});}return id;};
  for(const line of source.split(/\r?\n/).map(s=>s.trim()).filter(Boolean)){const chain=line.split(/\s*(?:-->|->|→)\s*/).map(node);for(let i=1;i<chain.length;i++)if(chain[i-1]!==chain[i]&&!edges.some(e=>e.from===chain[i-1]&&e.to===chain[i]))edges.push({from:chain[i-1],to:chain[i]});}
  if(edges.length>64)throw Error('El esquema admite hasta 64 conexiones.');if(!nodes.length)throw Error('Escribe al menos un concepto.');
  const incoming=new Map(nodes.map(n=>[n.id,0])),levels=new Map(nodes.map(n=>[n.id,0]));for(const e of edges)incoming.set(e.to,incoming.get(e.to)!+1);
  const queue=nodes.filter(n=>incoming.get(n.id)===0).map(n=>n.id),visited=new Set<string>();
  while(queue.length){const id=queue.shift()!;if(visited.has(id))continue;visited.add(id);for(const edge of edges.filter(e=>e.from===id)){levels.set(edge.to,Math.max(levels.get(edge.to)!,levels.get(id)!+1));incoming.set(edge.to,incoming.get(edge.to)!-1);if(incoming.get(edge.to)===0)queue.push(edge.to);}}
  let fallback=Math.max(0,...levels.values())+1;for(const n of nodes)if(!visited.has(n.id))levels.set(n.id,fallback++);
  const rowCounts=new Map<number,number>();for(const n of nodes){const row=levels.get(n.id)!,column=rowCounts.get(row)||0;rowCounts.set(row,column+1);const p=positions[n.id];n.x=p&&Number.isFinite(p.x)&&p.x>=0&&p.x<=8000?p.x:30+column*240;n.y=p&&Number.isFinite(p.y)&&p.y>=0&&p.y<=8000?p.y:30+row*110;}
  return {nodes,edges,width:Math.max(480,...nodes.map(n=>n.x+240)),height:Math.max(180,...nodes.map(n=>n.y+100))};
}
export function diagramSvg(data:DiagramData,id:string){
  if(!/^[-\w]+$/.test(id))throw Error('Identificador no válido.');const graph=diagramGraph(data.source,data.positions),metadata=xml(JSON.stringify(data));
  const edges=graph.edges.map(e=>{const a=graph.nodes.find(n=>n.id===e.from)!,b=graph.nodes.find(n=>n.id===e.to)!,x1=a.x+100,y1=a.y+58,x2=b.x+100,y2=b.y;return `<path d="M${x1} ${y1}C${x1} ${y1+30} ${x2} ${y2-30} ${x2} ${y2}" fill="none" stroke="currentColor" opacity=".45" stroke-width="1.5" marker-end="url(#${id}-arrow)"/>`;}).join('');
  const nodes=graph.nodes.map(n=>{const words=n.label.split(' '),lines=[''];for(const word of words){if((lines[lines.length-1]+' '+word).length>24&&lines.length<2)lines.push(word);else lines[lines.length-1]+=(lines[lines.length-1]?' ':'')+word;}return `<g data-node-id="${n.id}" transform="translate(${n.x} ${n.y})"><title>${xml(n.label)}</title><rect width="200" height="58" rx="9" fill="none" stroke="currentColor" stroke-width="1.2" opacity=".45"/><text x="100" y="${lines.length===1?34:24}" text-anchor="middle" fill="currentColor" font-family="Inter, sans-serif" font-size="13">${lines.map((line,i)=>`<tspan x="100" dy="${i?19:0}">${xml(line.length>28?line.slice(0,27)+'…':line)}</tspan>`).join('')}</text></g>`;}).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" id="${id}" viewBox="0 0 ${graph.width} ${graph.height}" width="${graph.width}" height="${graph.height}"><title>Esquema de estudio</title><desc>${metadata}</desc><defs><marker id="${id}-arrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M1 1L7 4L1 7" fill="none" stroke="currentColor" stroke-width="1.3"/></marker></defs>${edges}${nodes}</svg>`;
}
export function readDiagram(svg:SVGSVGElement):DiagramData|null{try{const raw=svg.querySelector('desc')?.textContent||'';if(raw.length>20000)return null;const data=JSON.parse(raw);if(data.aphekaDiagram!==1||typeof data.source!=='string'||!data.positions||typeof data.positions!=='object')return null;diagramGraph(data.source,data.positions);return data;}catch{return null;}}
