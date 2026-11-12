from pathlib import Path
s=Path('scripts/test-tools-wallpaper-6262.cjs').read_text('utf-8').replace('runtime-626.html','runtime-6265.html').replace('6262','6265');Path('scripts/test-tools-wallpaper-6265.cjs').write_text(s,'utf-8')
s=Path('scripts/probe-metadata-626.cjs').read_text('utf-8').replace('qa-626-','qa-6265-');Path('scripts/probe-metadata-6265.cjs').write_text(s,'utf-8')
s=Path('scripts/test-scroll-6261.cjs').read_text('utf-8').replace('runtime-626.html','runtime-6265.html').replace('6261','6265');Path('scripts/test-scroll-6265.cjs').write_text(s,'utf-8')
s=Path('scripts/capture-apheka-6262.cjs').read_text('utf-8').replace('6262','6265').replace('completedDates:[]','completedOn:[]');Path('scripts/capture-apheka-6265.cjs').write_text(s,'utf-8')
