from pathlib import Path
p=Path('scripts/test-ui-6265.cjs');s=p.read_text('utf-8').replace("name:'Mensual'","name:'Vista Mensual'");s=s.replace("console.log('settings nav',await buttons.allTextContents());","await buttons.first().waitFor();assert.equal(await buttons.count(),7);");p.write_text(s,'utf-8')
