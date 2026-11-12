const fs=require('node:fs'),ts=require('typescript');
const views=['Inicio','Estudio','Tareas','Notas','Planificacion','Cursos','CursosHub','Ajustes'];
const report=[];
for(const view of views){const file='src/components/views/'+view+'.tsx',source=fs.readFileSync(file,'utf8'),tree=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),edits=[];
 function visit(node){
  if(ts.isJsxElement(node)&&node.openingElement.tagName.getText(tree)==='button'){
   const attrs=node.openingElement.attributes.properties,style=attrs.find(a=>a.name?.getText(tree)==='style'),existing=attrs.some(a=>a.name?.getText(tree)==='data-app-action');
   const explicit=attrs.some(a=>a.name?.getText(tree)==='data-ui-control');
   const text=node.children.filter(ts.isJsxText).map(n=>n.text.trim()).filter(Boolean).join(' ');
   const object=style?.initializer?.expression;
   if(!existing&&explicit&&text&&object&&ts.isObjectLiteralExpression(object)){
    const values=Object.fromEntries(object.properties.filter(ts.isPropertyAssignment).map(p=>[p.name.getText(tree).replace(/['"]/g,''),p.initializer.getText(tree)]));
    const bg=values.background?.replace(/['"]/g,''),primary=bg==='var(--accent)',secondary=['var(--bg-hover)','var(--bg-elevated)','var(--bg-surface)','transparent','none'].includes(bg);
    if((primary||secondary)&&!values.width&&values.padding&&!values.transform){
     const variant=/^(Eliminar|Borrar|Descartar)/i.test(text)?'danger':/^(Cancelar|Volver|Retroceder)/i.test(text)?'secondary':primary?'primary':'secondary';edits.push({at:node.openingElement.tagName.end,text:' data-app-action="'+variant+'"'});report.push({view,variant,text:text.slice(0,60)});
    }
   }
  }
  ts.forEachChild(node,visit);
 }visit(tree);
 if(process.argv.includes('--write')){let output=source;for(const edit of edits.sort((a,b)=>b.at-a.at))output=output.slice(0,edit.at)+edit.text+output.slice(edit.at);fs.writeFileSync(file,output);}
}
console.log(JSON.stringify(report,null,2));
