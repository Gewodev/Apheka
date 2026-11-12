const {spawn}=require('node:child_process');
const base='http://127.0.0.1:1422';
const files=process.argv.slice(2);
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','1422'],{cwd:process.cwd(),stdio:['ignore','pipe','pipe'],windowsHide:true});
let log='';server.stdout.on('data',v=>log+=v);server.stderr.on('data',v=>log+=v);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function run(file){return new Promise((resolve,reject)=>{const child=spawn(process.execPath,[file],{stdio:'inherit',windowsHide:true,env:{...process.env,APHEKA_QA_URL:base}});child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(new Error(`${file}: ${code}`)));});}
(async()=>{try{let ready=false;for(let i=0;i<90;i++){if(server.exitCode!==null)throw new Error(log);try{if((await fetch(base,{signal:AbortSignal.timeout(1000)})).ok){ready=true;break;}}catch{}await sleep(500);}if(!ready)throw new Error('Servidor no disponible: '+log);if(!files.length)await new Promise(()=>{});for(const file of files)await run(file);}finally{server.kill();}})().catch(e=>{console.error(e);process.exitCode=1;});
