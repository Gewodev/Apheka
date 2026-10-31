import {useLayoutEffect,useRef} from 'react';
/** The persistent Charvis host portals here; navigating never remounts its controller. */
export default function IA(){const ref=useRef<HTMLDivElement>(null);useLayoutEffect(()=>{window.dispatchEvent(new CustomEvent('apheka:charvis-outlet',{detail:ref.current}));return()=>{window.dispatchEvent(new CustomEvent('apheka:charvis-outlet',{detail:null}));};},[]);return <section className="charvis-workspace-page" aria-label="Espacio de IA"><div ref={ref} id="charvis-workspace-outlet"/></section>;}
