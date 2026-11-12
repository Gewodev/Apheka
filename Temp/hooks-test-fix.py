from pathlib import Path
p=Path('scripts/test-installer-hooks-6266.ps1');s=p.read_text(encoding='utf-8').replace('  Set-ItemProperty -Path "$registryPath\\APHEKA" -Name DisplayName -Value \'POHU\'','''  $null=New-Item -Path "$registryPath\\APHEKA" -Force
  foreach($entry in @{DisplayName='POHU';Publisher='owa';DisplayVersion='6.26.6'}.GetEnumerator()){$null=New-ItemProperty -Path "$registryPath\\APHEKA" -Name $entry.Key -Value $entry.Value -PropertyType String -Force}''');p.write_text(s,encoding='utf-8')
