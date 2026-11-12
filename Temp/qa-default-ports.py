from pathlib import Path
p=Path('scripts/test-native-timer-lifecycle-6265.cjs');s=p.read_text('utf-8').replace("APHEKA_QA_PORT||'1422'","APHEKA_QA_PORT||'1423'");p.write_text(s,'utf-8')
p=Path('scripts/test-timer-close-retry-6265.cjs');s=p.read_text('utf-8').replace("'http://127.0.0.1:1422/scripts/apheka-floating-component-preview.html'","(process.env.APHEKA_QA_URL||'http://127.0.0.1:1423')+'/scripts/apheka-floating-component-preview.html'");p.write_text(s,'utf-8')
