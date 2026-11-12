const {spawnSync}=require('node:child_process');
for(const file of ['scripts/test-apheka-611-music.cjs','scripts/test-apheka-611-production-room.cjs']){
 const result=spawnSync(process.execPath,[file],{stdio:'inherit',windowsHide:true,env:{...process.env,APHEKA_QA_URL:'http://127.0.0.1:1421'}});
 if(result.error)throw result.error;if(result.status!==0)process.exit(result.status||1);
}
console.log('PASS production bundle: unified music, connection settings, cover/lyrics layout, full viewport player and laptop layout.');
