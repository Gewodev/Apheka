/** A bad source must never cycle through an auto-refilling queue indefinitely. */
export class PlaybackRecovery {
  private track='';private retries=0;private failed=new Set<string>();
  failure(track:string,code:number,retry=true):{action:'ignore'|'retry'|'advance';delay?:number}{
    if(code===1)return {action:'ignore'};
    if(this.track!==track){this.track=track;this.retries=0;}
    if(code===2&&retry&&this.retries<2)return {action:'retry',delay:500*2**this.retries++};
    this.failed.add(track);return {action:'advance'};
  }
  canAdvance(track:string){return this.failed.size<3&&!this.failed.has(track);}
  played(){this.track='';this.retries=0;this.failed.clear();}
}
