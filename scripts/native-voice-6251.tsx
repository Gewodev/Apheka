// Isolated native QA uses its own Tauri identifier, storage and public fake microphone.
import {createRoot} from 'react-dom/client';
import {AppProvider} from '../src/store/AppContext';
import CharvisSidebar from '../src/components/ui/CharvisSidebar';
import IA from '../src/components/views/IA';
import '../src/fonts.css';import '../src/index.css';import '../src/apheka.css';import '../src/workspace.css';import '../src/refinement.css';import '../src/desktop.css';import '../src/studio.css';import '../src/quiet.css';import '../src/interface.css';
createRoot(document.getElementById('root')!).render(<AppProvider><div style={{height:'100dvh'}}><IA/><CharvisSidebar pageActive activeView="ia"/></div></AppProvider>);
