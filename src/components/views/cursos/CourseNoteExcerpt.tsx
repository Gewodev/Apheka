import {memo,useEffect,useMemo,useRef,useState} from 'react';
import {observePreview} from '../../../lib/previewVisibility';
import {sanitizePastedHtml} from '../../../lib/editorHtml';
/** Keep the stored document intact; the lightweight preview has its own safe markup. */
export default memo(function CourseNoteExcerpt({content}:{content:string}){
 const ref=useRef<HTMLDivElement>(null),[visible,setVisible]=useState(false);
 useEffect(()=>ref.current?observePreview(ref.current,()=>setVisible(true)):undefined,[]);
 const html=useMemo(()=>visible?sanitizePastedHtml(content||'<p>Este apunte está vacío.</p>').replace(/<img\b/gi,'<img loading="lazy" decoding="async"'):null,[content,visible]);
 return <div ref={ref} className="course-note-excerpt" data-ready={visible}>{html===null?<div className="course-note-placeholder" aria-hidden="true"/>:<div dangerouslySetInnerHTML={{__html:html}}/>}</div>;
});
