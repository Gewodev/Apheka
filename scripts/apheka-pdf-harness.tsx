import React from 'react';import {createRoot} from 'react-dom/client';
import {useMaterialMenu} from '../src/components/ui/MaterialContextMenu';
import '../src/index.css';
function Harness(){const {openMenu}=useMaterialMenu(message=>{(window as any).__pdfMessage=message;});const path='C:\\Mis cursos\\Álgebra #1.pdf';return <><button onClick={e=>openMenu(e,{url:path,name:'Álgebra #1.pdf'})}>PDF real</button><button onClick={e=>openMenu(e,{url:'https://asset.localhost/'+encodeURIComponent(path),name:'Álgebra #1.pdf'})}>PDF heredado</button></>;}
createRoot(document.getElementById('root')!).render(<Harness/>);
