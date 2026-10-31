export function mediaLink(value:string):URL|null{
 const text=value.trim();if(!/^(?:https?:\/\/|(?:www\.|music\.|m\.)?youtube\.com\/|youtu\.be\/)/i.test(text))return null;
 const url=new URL(/^https?:\/\//i.test(text)?text:'https://'+text);
 if(url.protocol!=='https:'||url.username||url.password)throw Error('Usa un enlace HTTPS sin credenciales.');
 return url;
}
export const youtubeLink=(value:string)=>{try{return ['youtube.com','www.youtube.com','music.youtube.com','m.youtube.com','youtu.be'].includes(new URL(value).hostname);}catch{return false;}};
