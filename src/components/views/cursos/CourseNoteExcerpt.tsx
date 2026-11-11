import {memo,useMemo} from 'react';
import {sanitizePastedHtml} from '../../../lib/editorHtml';
/** Keep the stored document intact; the lightweight preview has its own safe markup. */
export default memo(function CourseNoteExcerpt({content}:{content:string}){
 const html=useMemo(()=>sanitizePastedHtml(content||'<p>Este apunte está vacío.</p>'),[content]);
 return <div className="course-note-excerpt"><div dangerouslySetInnerHTML={{__html:html}}/></div>;
});
