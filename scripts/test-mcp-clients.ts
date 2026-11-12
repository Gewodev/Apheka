import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {MCP_CLIENTS,connectionName,formatConnection,getMcpClient,buildConnectionPrompt,buildSetupPrompt,setupExecutable} from '../src/lib/mcpConnection.ts';
const command='C:\\Users\\Estudiante Á\\APHEKA "prueba"\\owa-studio.exe';
const local={mcpServers:{apheka:{command,args:['--mcp']}}};
const http={mcpServers:{apheka:{url:'http://127.0.0.1:38476/mcp',headers:{Authorization:'Bearer SECRET-QA'}}}};
const name='Mi academia · ÁÉ';
for(const client of MCP_CLIENTS){
  const config=formatConnection(local,name,client.format);
  if(client.format==='toml'){
    const result=spawnSync('python',['-c','import sys,tomllib,json; print(json.dumps(tomllib.loads(sys.stdin.read()),ensure_ascii=False))'],{input:config,encoding:'utf8'});
    assert.equal(result.status,0,result.stderr);const parsed=JSON.parse(result.stdout);
    assert.deepEqual(parsed.mcp_servers[connectionName(name)],{command,args:['--mcp']});
  }else{
    const parsed=JSON.parse(config),server=(parsed.mcpServers||parsed.servers)[connectionName(name)];
    assert.equal(server.command,command);assert.deepEqual(server.args,['--mcp']);
    if(client.format==='vscode')assert.equal(server.type,'stdio');
  }
  const prompt=buildConnectionPrompt(name,'Conserva mis notas.',client.id,'Mi IDE');
  assert.ok(prompt.includes('Conserva mis notas.'));assert.ok(prompt.includes('apheka_describe'));assert.ok(prompt.includes('políticas'));assert.ok(!prompt.includes('SECRET-QA'));
  if(client.id==='chatgpt')assert.ok(prompt.includes('Secure MCP Tunnel'));else assert.ok(!prompt.includes('para ChatGPT utiliza'));
  const handoff=buildSetupPrompt(name,'Conserva mis notas.',client.id,'Mi IDE',setupExecutable(local),client.format);
  assert.ok(handoff.includes(JSON.stringify(command)));assert.ok(handoff.includes('apheka_describe'));assert.ok(handoff.includes('apheka_overview'));assert.ok(handoff.includes(client.destination));assert.ok(!handoff.includes('SECRET-QA'));
}
for(const format of ['json','vscode','toml'] as const){
  const output=formatConnection(http,name,format,'http');assert.ok(output.includes('SECRET-QA'));
  if(format==='toml'){
    const result=spawnSync('python',['-c','import sys,tomllib; d=tomllib.loads(sys.stdin.read()); assert next(iter(d["mcp_servers"].values()))["http_headers"]["Authorization"]=="Bearer SECRET-QA"'],{input:output,encoding:'utf8'});assert.equal(result.status,0,result.stderr);
  }else assert.equal((JSON.parse(output).servers||JSON.parse(output).mcpServers)[connectionName(name)].headers.Authorization,'Bearer SECRET-QA');
}
assert.equal(getMcpClient('deleted-client').id,'custom');assert.equal(connectionName('漢字'),'apheka');
for(const bad of [null,{}, {mcpServers:{}},{mcpServers:{x:{command:12,args:[]}}},{mcpServers:{x:{command:'exe',args:[1]}}}])assert.throws(()=>formatConnection(bad,'name','json'));
assert.throws(()=>formatConnection({mcpServers:{x:{url:'https://asset.localhost/doc.pdf',headers:{Authorization:'bad'}}}},'name','json','http'));
for(const invalid of [http,{mcpServers:{x:{command,args:['--mcp','SECRET-QA']}}},{mcpServers:{x:{command:'https://evil.test/owa-studio.exe',args:['--mcp']}}}])assert.throws(()=>setupExecutable(invalid));
const httpHandoff=buildSetupPrompt(name,'','custom','Mi IDE',setupExecutable(local),'json','http');assert.ok(!httpHandoff.includes('SECRET-QA'));assert.ok(!httpHandoff.includes('Authorization'));assert.ok(!httpHandoff.includes('Bearer'));
console.log('PASS eight client profiles: JSON MCP, VS Code and parsed TOML; Windows Unicode/quotes, HTTP auth, custom names, client-specific prompts and invalid configs');
