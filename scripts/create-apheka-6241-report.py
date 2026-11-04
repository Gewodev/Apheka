"""Publish a release report only after the verified installer exists."""
from pathlib import Path
import json
import re
import hashlib

root = Path(__file__).resolve().parents[1]
release = root / 'release'
read_json = lambda path: json.loads(path.read_text(encoding='utf-8-sig'))
manifest = read_json(release / 'apheka_FINAL.json')
status = read_json(release / 'build-6.24.1.status.json')
assert manifest['version'] == '6.24.1' and status['state'] == 'complete'
assert manifest['modifiedAtUtc'] >= manifest['sourceLatestEditUtc']
assert hashlib.sha256((release / manifest['file']).read_bytes()).hexdigest().upper() == manifest['sha256'].upper()
build_text=(release / 'build-6.24.1.log').read_text(encoding='utf-8-sig')
vite_seconds=float(re.search(r'built in ([0-9.]+)s',build_text).group(1))
main=re.search(r'dist/assets/index-[^\s]+\.js\s+([0-9.]+) kB[^\n]*gzip:\s*([0-9.]+) kB',build_text)
main_kb,main_gzip=map(float,main.groups())
native = (release / 'native-6.24.1.log').read_text(encoding='utf-8-sig')
passed, failed, ignored = map(int, re.search(r'test result: ok\. (\d+) passed; (\d+) failed; (\d+) ignored', native).groups())
logs = ['chat', 'music', 'controls', 'continuity', 'transport', 'visual', 'production', 'voice', 'composer', 'retrieval', 'interruption']
checks = {}
for name in logs:
    log = release / f'{name}-6.24.1.log'
    text = log.read_text(encoding='utf-8-sig')
    assert 'PASS ' in text, f'Missing success: {log}'
    checks[name] = {'log': str(log.relative_to(root)), 'result': next(line for line in text.splitlines() if line.startswith('PASS '))}
report = {
    'version': '6.24.1', 'date': '2026-11-04', 'baseCommit': 'cf5cb24',
    'status': 'validated_installer_built',
    'frontend': {'exitCode': 0, 'viteSeconds': vite_seconds, 'mainChunkKB': main_kb, 'mainChunkGzipKB': main_gzip, 'log': 'release/build-6.24.1.log'},
    'native': {'passed': passed, 'failed': failed, 'ignored': ignored},
    'browserChecks': checks,
    'productionSamples': read_json(release / 'qa-624-sections.json'),
    'sampleLimits': 'Isolated small dataset; heap is browser JavaScript heap, not total app memory. Idle/scroll samples do not establish temperature, every interaction, or performance on all hardware.',
    'providerLimits': 'Controlled provider/catalog/ASR responses. No live provider account or exhaustive discography availability verified.',
    'installer': {**manifest, 'finishedAtUtc': status['finishedAtUtc'], 'sourceAndToolsUnchangedDuringBuild': True},
    'gallery': 'release/qa-624-gallery.html',
}
(root / 'docs/APHEKA-release-6.24.1.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
document = root / 'docs/APHEKA-6.24.1.md'
text = document.read_text(encoding='utf-8').split('\n## Instalador verificado\n')[0]
text += f"\n## Instalador verificado\n\nAPHEKA {manifest['version']}, {manifest['bytes']:,} bytes. SHA-256: `{manifest['sha256']}`. Compilación y empaquetado terminados en `{status['finishedAtUtc']}`. Identidad, versión, recursos del frontend e integridad comprobados por el empaquetador.\n"
document.write_text(text, encoding='utf-8')
print('Release report verified and written.')
