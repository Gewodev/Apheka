from pathlib import Path
for name in ['scripts/test-details-6267.cjs','scripts/test-ui-6267.cjs','scripts/profile-pohu-6267.cjs','scripts/test-command-work-6267.cjs']:
 p=Path(name);s=p.read_text(encoding='utf-8-sig').replace('127.0.0.1:1423','127.0.0.1:1426');p.write_text(s.rstrip()+'\n',encoding='utf-8')
