from pathlib import Path
p=Path('src/components/views/planificacion/LateralPanel.tsx');s=p.read_text('utf-8');s="import SessionTaskLink from '../../ui/SessionTaskLink';\n"+s;s=s.replace("<div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 'auto', paddingBottom: 8 }}>","<SessionTaskLink taskId={session.taskId}/><div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 'auto', paddingBottom: 8 }}>");p.write_text(s,'utf-8')
p=Path('src/components/views/Planificacion.tsx');s=p.read_text('utf-8').replace('Session de estudio','Sesión de estudio');p.write_text(s,'utf-8')
p=Path('src/components/ui/CommandsSettings.tsx');s=p.read_text('utf-8').replace("['new-note','open-note','new-task'].includes(id)?id:'menu'","id");p.write_text(s,'utf-8')
p=Path('src/components/ui/AppCommandsPanel.tsx');s=p.read_text('utf-8');s=s.replace("const open=(e:Event)=>setAction((e as CustomEvent<string>).detail||'menu')","const open=(e:Event)=>{const id=(e as CustomEvent<string>).detail||'menu';if(['menu','new-note','open-note','new-task'].includes(id))setAction(id);else{setAction(null);if(id==='schedule')window.dispatchEvent(new Event('apheka:toggle-schedule-preview'));else if(id==='event'){sessionStorage.setItem('apheka_create_event','1');p.onNavigate('planificacion');window.dispatchEvent(new Event('apheka:create-event'));}else p.onNavigate(({tasks:'tareas',study:'estudio',planner:'planificacion',courses:'cursos',music:'musica',settings:'ajustes'} as Record<string,WorkspaceView>)[id]||'inicio');}}")
s=s.replace("},[]);return action?<Panel", "},[p.onNavigate]);return action?<Panel");p.write_text(s,'utf-8')
p=Path('src-tauri/src/native_notifications.rs');s=p.read_text('utf-8');s=s.replace('    date: Option<String>,','    date: Option<String>,\n    action: Option<StudyAction>,',1);s=s.replace('    Downloads,','    Downloads,\n    Habits,',1)
s=s.replace('impl NotificationTarget {','#[derive(Clone, Debug, Deserialize, Serialize)]\n#[serde(rename_all = "kebab-case")]\nenum StudyAction { StartBreak, StartSession }\nimpl NotificationTarget {',1)
s=s.replace('        Ok(())\n    }\n    fn label', '''        if self.action.is_some() && (!matches!(self.kind,TargetKind::Study) || self.id.as_deref().is_none_or(|v| v.is_empty() || v.len()>128)) { return Err("Acción de estudio no válida".into()); }
        Ok(())
    }
    fn activated(&self, action: Option<&str>) -> Option<Self> {
        if !matches!(action,None|Some(""|"open"|"execute")){return None;}
        let mut target=self.clone();
        if action != Some("execute") {target.action=None;}
        Some(target)
    }
    fn label''',1)
s=s.replace('            TargetKind::Study => "Ir a Estudio",','            TargetKind::Study => match self.action {Some(StudyAction::StartBreak)=>"Activar descanso",Some(StudyAction::StartSession)=>"Iniciar sesión",None=>"Ir a Estudio"},\n            TargetKind::Habits => "Registrar hábitos",',1)
s=s.replace('.add_button(target.label(), "open")','.add_button(target.label(), if target.action.is_some() {"execute"} else {"open"})')
start=s.index('                    if action\n');end=s.index('                        if let Some(window)',start)
s=s[:start]+'''                    if let Some(destination)=target.activated(action.as_deref()) {
'''+s[end:];s=s.replace('window.emit("apheka:notification-open", &target)','window.emit("apheka:notification-open", &destination)')
s=s.replace('date: None\n','date: None, action: None\n').replace('date: Some("2026-11-05".into())','date: Some("2026-11-05".into()), action: None').replace('date: Some("bad-date".into())','date: Some("bad-date".into()), action: None')
s=s.replace('    #[test]\n    fn rejects', '''    #[test]
    fn explicit_action_only_and_closed_routes() {
        let t:NotificationTarget=serde_json::from_str(r#"{"kind":"study","id":"token","action":"start-break"}"#).unwrap();
        assert!(t.validate().is_ok());
        assert!(t.activated(None).unwrap().action.is_none());
        assert!(t.activated(Some("open")).unwrap().action.is_none());
        assert!(t.activated(Some("execute")).unwrap().action.is_some());
        assert!(t.activated(Some("dismiss")).is_none());
        let bad:NotificationTarget=serde_json::from_str(r#"{"kind":"habits","id":"token","action":"start-break"}"#).unwrap();
        assert!(bad.validate().is_err());
    }
    #[test]
    fn rejects''')
p.write_text(s,'utf-8')
