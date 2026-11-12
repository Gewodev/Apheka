import React from 'react';
import {createRoot} from 'react-dom/client';
import McpSettings from '../src/components/ui/McpSettings';
import '../src/index.css';
createRoot(document.getElementById('root')!).render(<main style={{maxWidth:900,margin:'32px auto',padding:24}}><McpSettings/></main>);
