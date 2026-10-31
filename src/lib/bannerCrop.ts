export type BannerCrop={zoom:number;x:number;y:number};
export const BANNER_ASPECT=16/7;
export function normalizeBannerCrop(value?:Partial<BannerCrop>):BannerCrop{
  const bound=(value:unknown,lo:number,hi:number,fallback:number)=>typeof value==='number'&&Number.isFinite(value)?Math.max(lo,Math.min(hi,value)):fallback;
  return {zoom:bound(value?.zoom,1,3,1),x:bound(value?.x,-1,1,0),y:bound(value?.y,-1,1,0)};
}
/** Normalized offsets retain the same frame at every preview and export size. */
export function bannerFrame(width:number,height:number,imageWidth:number,imageHeight:number,crop:BannerCrop){
  const safe=normalizeBannerCrop(crop),scale=Math.max(width/imageWidth,height/imageHeight)*safe.zoom;
  const w=imageWidth*scale,h=imageHeight*scale,limitX=Math.max(0,(w-width)/2),limitY=Math.max(0,(h-height)/2);
  return {width:w,height:h,left:(width-w)/2+safe.x*limitX,top:(height-h)/2+safe.y*limitY,limitX,limitY};
}
