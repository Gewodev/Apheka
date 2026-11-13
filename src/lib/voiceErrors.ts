/** Tauri rejects with strings as well as Error objects. Keep the useful cause. */
export function voiceErrorMessage(cause:unknown,fallback='No se pudo transcribir el audio.'){
 const value=cause as {name?:string;message?:string}|null;
 if(value?.name==='NotAllowedError')return 'Permite el acceso al micrófono en Windows y en APHEKA.';
 if(value?.name==='NotFoundError')return 'No se encontró un micrófono. Comprueba el dispositivo de entrada.';
 if(value?.name==='NotReadableError')return 'No se pudo abrir el micrófono. Comprueba si otra aplicación lo está usando.';
 const text=typeof cause==='string'?cause:typeof value?.message==='string'?value.message:'';
 return text.trim().replace(/^Error:\s*/,'').slice(0,500)||fallback;
}
