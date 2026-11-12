import assert from 'node:assert/strict';
import {externalTarget,localPathFromUrl} from '../src/lib/externalTarget.ts';
import {createPointerRecovery} from '../src/lib/workspacePointer.ts';
for(const path of ['C:\\Mis cursos\\Álgebra #1.pdf','D:/Estudio/Informe 100%.pdf','\\\\servidor\\clase\\Material.pdf']) {
  assert.equal(externalTarget('https://asset.localhost/'+encodeURIComponent(path)),path);
  assert.equal(externalTarget(path),path);
}
assert.equal(localPathFromUrl('file:///C:/Mis%20cursos/%C3%81lgebra%20%231.pdf'),'C:/Mis cursos/Álgebra #1.pdf');
assert.equal(localPathFromUrl('file://servidor/clase/Material.pdf'),'\\\\servidor\\clase\\Material.pdf');
assert.equal(externalTarget('https://example.com/pdf?q=1'),'https://example.com/pdf?q=1');
for(const url of ['javascript:alert(1)','data:application/pdf;base64,AAA','blob:abc','--argument'])assert.throws(()=>externalTarget(url));
let at=1000,calls=0,finish:()=>void=()=>{};
const recover=createPointerRecovery(()=>{calls++;return new Promise<void>(resolve=>{finish=resolve;});},()=>at);
const first=recover();await recover(true);assert.equal(calls,1,'coalesce even forced transitions');finish();await first;
await recover();assert.equal(calls,1,'throttle pointer moves');at+=751;const second=recover();assert.equal(calls,2);finish();await second;
const failed=createPointerRecovery(async()=>{throw Error('native unavailable');});await assert.doesNotReject(failed());
console.log('PASS native path normalization and bounded pointer recovery: Unicode, spaces, UNC, file URLs, forbidden protocols, coalescing and error isolation');
