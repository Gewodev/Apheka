from pathlib import Path
p=Path('scripts/make-gallery-6266.py');s=p.read_text(encoding='utf-8').replace("cards=[('Horario compacto'","cards=[('Contador flotante · márgenes y capas','qa-6266-floating-timer.png'),('Horario compacto'",1);p.write_text(s,encoding='utf-8')
