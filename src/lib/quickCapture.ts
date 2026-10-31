export type CaptureKind='search'|'task'|'note'|'idea'|'reference'|'journal';
const kinds:Record<string,CaptureKind>={tarea:'task',task:'task',nota:'note',note:'note',idea:'idea',referencia:'reference',diario:'journal'};
export function parseCapture(input:string,now=new Date()):{kind:CaptureKind;title:string;dueDate?:string;priority:'none'|'low'|'medium'|'high';courseName?:string}{
  const command=input.match(/^\/(tarea|task|nota|note|idea|referencia|diario)\b\s*/i),kind:CaptureKind=command?kinds[command[1].toLocaleLowerCase()]:'search';
  let title=command?input.slice(command[0].length):input,dueDate:string|undefined,priority:'none'|'low'|'medium'|'high'='none',courseName:string|undefined;
  const date=title.match(/(?:^|\s)(?:fecha|due):(hoy|mañana|\d{4}-\d{2}-\d{2})(?=\s|$)/i);
  if(date){const value=date[1].toLocaleLowerCase();if(value==='hoy'||value==='mañana'){const day=new Date(now);if(value==='mañana')day.setDate(day.getDate()+1);dueDate=day.getFullYear()+'-'+String(day.getMonth()+1).padStart(2,'0')+'-'+String(day.getDate()).padStart(2,'0');}else{const [y,m,d]=value.split('-').map(Number),day=new Date(y,m-1,d,12);if(day.getFullYear()!==y||day.getMonth()!==m-1||day.getDate()!==d)throw Error('La fecha indicada no existe.');dueDate=value;}title=title.replace(date[0],' ');}
  const level=title.match(/(?:^|\s)(?:prioridad|priority):(alta|media|baja|high|medium|low)(?=\s|$)/i);if(level){priority=({alta:'high',media:'medium',baja:'low',high:'high',medium:'medium',low:'low'} as const)[level[1].toLocaleLowerCase() as 'alta'];title=title.replace(level[0],' ');}
  const course=title.match(/(?:^|\s)curso:(?:"([^"]{1,120})"|(\S{1,120}))(?=\s|$)/i);if(course){courseName=course[1]||course[2];title=title.replace(course[0],' ');}
  return {kind,title:title.trim().slice(0,300),dueDate,priority,courseName};
}
