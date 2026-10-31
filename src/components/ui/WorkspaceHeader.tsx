import React from 'react';
import WorkspaceClock from './WorkspaceClock';
import NotificationBell from './NotificationBell';


export default function WorkspaceHeader({title, description, children}: {title:string; description?:string; children?:React.ReactNode}) {
 return <header className="workspace-header">
  <div className="workspace-heading"><h1>{title}</h1>{description&&<p>{description}</p>}</div>
  <div className="workspace-header-tools">{children}<NotificationBell/><WorkspaceClock/></div>
 </header>;
}
