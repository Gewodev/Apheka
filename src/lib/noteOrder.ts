// A filtered view replaces only its existing slots. Hidden notes keep their order.
export function reorderNoteSubset<T extends {id:string;sortOrder?:number}>(notes:T[],requested:string[]):T[] {
 const byId=new Map(notes.map(n=>[n.id,n]));
 const ids=[...new Set(requested)].filter(id=>byId.has(id));
 if(ids.length<2)return notes;
 const ordered=[...notes].sort((a,b)=>(a.sortOrder??notes.indexOf(a))-(b.sortOrder??notes.indexOf(b)));
 const selected=new Set(ids);let index=0;
 return ordered.map((note,position)=>({...byId.get(selected.has(note.id)?ids[index++]:note.id)!,sortOrder:position}));
}
