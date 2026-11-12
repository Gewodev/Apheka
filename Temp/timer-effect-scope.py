from pathlib import Path
p=Path('src/components/FloatingTimer.tsx');s=p.read_text(encoding='utf-8');start=s.index('    let disposed=false;');end=s.index('    const bg = bgColor;',start);block=s[start:end];s=s[:start]+s[end:];target="  useEffect(() => {\n    const unlisten1";s=s.replace(target,"  useEffect(() => {\n"+block+"    const unlisten1",1);p.write_text(s,encoding='utf-8')
