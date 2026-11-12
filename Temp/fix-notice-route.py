from pathlib import Path
p=Path('src/components/NotificationNavigation.tsx');s=p.read_text('utf-8').replace("app.setNavigateTo('planificacion')","app.setNavigateTo('flujo')");p.write_text(s,'utf-8')
