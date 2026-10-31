/** Pause decorative video while a reading or editing overlay is in use. */
let holds=0;
export function holdAmbientMotion(){holds++;document.documentElement.dataset.workspaceOverlay='true';let released=false;return()=>{if(released)return;released=true;holds=Math.max(0,holds-1);if(!holds)delete document.documentElement.dataset.workspaceOverlay;};}
