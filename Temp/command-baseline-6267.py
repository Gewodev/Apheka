from pathlib import Path
import subprocess
old=subprocess.check_output(['git','show','HEAD:src/components/ui/AppCommandsPanel.tsx'],text=True,encoding='utf-8');old=old.replace("'../../","'/src/");Path('Temp/CommandsBaseline6266.tsx').write_text(old,encoding='utf-8')
