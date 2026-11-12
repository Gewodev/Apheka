from pathlib import Path
p=Path('scripts/capture-pohu-6266.cjs');s=Path('scripts/capture-apheka-6265.cjs').read_text(encoding='utf-8').replace('qa-6265-','qa-6266-');p.write_text(s,encoding='utf-8')
s=Path('scripts/make-gallery-6265.py').read_text(encoding='utf-8').replace('6265','6266').replace('APHEKA 6.26.5','POHU 6.26.6');s=s.replace("cards=[(","cards=[('Horario compacto','qa-6266-horario.png'),(",1);Path('scripts/make-gallery-6266.py').write_text(s,encoding='utf-8')
