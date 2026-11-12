import React from 'react';
import {createRoot} from 'react-dom/client';
import ReleaseNotice from '../src/components/ui/ReleaseNotice';
import '../src/fonts.css';
import '../src/index.css';
import '../src/apheka.css';
import '../src/workspace.css';
import '../src/refinement.css';
// Isolated native-command fixture. Never imported by the application entry point.
(window as any).isTauri=true;
(window as any).__TAURI_INTERNALS__={invoke:async(command:string)=>{
 if(command==='get_release_notice')return {version:'6.7.2',installationId:'qa-only',previousName:'OWA Studio',previousVersion:'6.7.0'};
 if(command==='acknowledge_release'){(window as any).__noticeAcknowledged=true;return;}
 throw new Error(command);
}};
createRoot(document.getElementById('root')!).render(<ReleaseNotice/>);
