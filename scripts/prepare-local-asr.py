from pathlib import Path
import base64,hashlib,json,urllib.request,zipfile,io,subprocess
root=Path(__file__).resolve().parents[1]
(root/'Temp').mkdir(exist_ok=True)
wheel_url='https://files.pythonhosted.org/packages/ea/05/ad3457baa56170a13829c98327598a4d99d6cd4bdff8ae59df4c47ebdd11/moonshine_voice-0.1.5-py3-none-win_amd64.whl'
wheel_sha='7fc9a84e827360ddb85c2735f44a1502c5575c27dcb476a2555646cd20a70e9d'
wheel_cache=root/'Temp/moonshine-win.whl'
archive=wheel_cache.read_bytes() if wheel_cache.exists() else urllib.request.urlopen(wheel_url,timeout=120).read()
if hashlib.sha256(archive).hexdigest()!=wheel_sha:raise ValueError('Moonshine wheel checksum mismatch')
folder=root/'src-tauri/resources/asr';folder.mkdir(parents=True,exist_ok=True)
manifest=[]
def publish(name,data):
 path=folder/name;path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(data)
 manifest.append({'file':name,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()})
with zipfile.ZipFile(io.BytesIO(archive)) as z:
 for name in ['moonshine.dll','onnxruntime.dll']:publish(name,z.read('moonshine_voice/'+name))
 publish('LICENSE.txt',z.read('moonshine_voice-0.1.5.dist-info/licenses/LICENSE'))
entries=[{'name': 'adapter.ort', 'url': 'https://download.moonshine.ai/model/tiny-streaming-es/quantized_26_08_24/adapter.ort', 'size': 1318472, 'checksum': '+JOBGg==', 'checksum_type': 'crc32c'}, {'name': 'cross_kv.ort', 'url': 'https://download.moonshine.ai/model/tiny-streaming-es/quantized_26_08_24/cross_kv.ort', 'size': 1288120, 'checksum': 'lvRCDw==', 'checksum_type': 'crc32c'}, {'name': 'decoder_kv.ort', 'url': 'https://download.moonshine.ai/model/tiny-streaming-es/quantized_26_08_24/decoder_kv.ort', 'size': 19717336, 'checksum': 'KEm/xA==', 'checksum_type': 'crc32c'}, {'name': 'encoder.ort', 'url': 'https://download.moonshine.ai/model/tiny-streaming-es/quantized_26_08_24/encoder.ort', 'size': 7772792, 'checksum': 'AAXCVA==', 'checksum_type': 'crc32c'}, {'name': 'frontend.model.ort', 'url': 'https://download.moonshine.ai/model/tiny-streaming-es/quantized_26_08_24/frontend.model.ort', 'size': 23176, 'checksum': 'v7nfyQ==', 'checksum_type': 'crc32c'}, {'name': 'frontend.weights.ort', 'url': 'https://download.moonshine.ai/model/tiny-streaming-es/quantized_26_08_24/frontend.weights.ort', 'size': 2093280, 'checksum': 'LYbiaA==', 'checksum_type': 'crc32c'}, {'name': 'streaming_config.json', 'url': 'https://download.moonshine.ai/model/tiny-streaming-es/quantized_26_08_24/streaming_config.json', 'size': 509, 'checksum': 'wH/VeA==', 'checksum_type': 'crc32c'}, {'name': 'tokenizer.bin', 'url': 'https://download.moonshine.ai/model/tiny-streaming-es/quantized_26_08_24/tokenizer.bin', 'size': 102888, 'checksum': '/7v8NQ==', 'checksum_type': 'crc32c'}]
table=[]
for n in range(256):
 for _ in range(8):n=(n>>1)^0x82f63b78 if n&1 else n>>1
 table.append(n)
for entry in entries:
 temporary=root/'Temp'/('asr-download-'+entry['name']);subprocess.run(['curl.exe','--fail','--location','--max-time','120','--output',str(temporary),entry['url']],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL);data=temporary.read_bytes()
 if len(data)!=entry['size']:raise ValueError('Model size mismatch: '+entry['name'])
 crc=0xffffffff
 for byte in data:crc=table[(crc^byte)&255]^(crc>>8)
 if ((crc^0xffffffff)&0xffffffff)!=int.from_bytes(base64.b64decode(entry['checksum']),'big'):raise ValueError('Model checksum mismatch: '+entry['name'])
 publish('model/'+entry['name'],data)
 print(entry['name'],len(data),flush=True)
(folder/'NOTICE.txt').write_text('Moonshine Voice 0.1.5 and Spanish Tiny Streaming quantized_26_08_24. Native code and this streaming model: MIT. Legacy non-streaming Community models are not included. Sources: https://github.com/moonshine-ai/moonshine/releases/tag/v0.1.5 and https://download.moonshine.ai/model/tiny-streaming-es/quantized_26_08_24\n',encoding='utf-8')
license_bytes=urllib.request.urlopen('https://raw.githubusercontent.com/microsoft/onnxruntime/main/LICENSE',timeout=30).read()
if hashlib.sha256(license_bytes).hexdigest()!='2f07c72751aed99790b8a4869cf2311df85a860b22ded05fa22803587a48922c':raise ValueError('ONNX Runtime license changed; review required')
publish('ONNX-LICENSE.txt',license_bytes)
expected=json.loads((root/'src-tauri/asr-manifest.json').read_text(encoding='utf-8')) if (root/'src-tauri/asr-manifest.json').exists() else None
if expected and {e['file']:e['sha256'] for e in expected['files']}!={e['file']:e['sha256'] for e in manifest}:raise ValueError('ASR resources differ from the committed manifest')
(root/'src-tauri/asr-manifest.json').write_text(json.dumps({'version':'0.1.5','language':'es','architecture':2,'files':manifest},indent=2),encoding='utf-8')
print('Verified local ASR resources:',sum(row['bytes'] for row in manifest),'bytes')
