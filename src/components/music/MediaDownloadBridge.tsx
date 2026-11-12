import {youtubeLink} from '../../lib/mediaSource';
import {useEffect,useRef,useLayoutEffect} from 'react';
import {isTauri} from '@tauri-apps/api/core';
import {useAppSlice} from '../../store/AppContext';
import {onDownloadProgress,onDownloadComplete,onDownloadFile,startDownload,getDownloadPath} from '../../lib/musicApi';
import toast from 'react-hot-toast';
export default function MediaDownloadBridge(){
 const a=useAppSlice(['hydrated','downloadQueue','settings','downloadPath','updateDownloadProgress','updateDownloadStatus','tracks','addTrack','updateTrack']),latest=useRef(a),starting=useRef(false);
 useLayoutEffect(()=>{latest.current=a;});
 useEffect(()=>{if(!isTauri())return;let disposed=false;const pending=[
 onDownloadProgress(data=>latest.current.updateDownloadProgress(data.downloadId,data.progress)),
 onDownloadFile(data=>{if(data.type!=='completed')return;const app=latest.current,job=app.downloadQueue.find(j=>j.id===data.downloadId);if(!job||(job.format||app.settings.downloadFormat)==='mp4')return;const existing=app.tracks.find(t=>t.url===job.url);if(existing)void app.updateTrack(existing.id,{localAudioPath:data.file,librarySaved:true},true);else app.addTrack({title:job.title,artist:job.artist,duration:job.duration||0,source:youtubeLink(job.url)?'youtube':'local',url:youtubeLink(job.url)?job.url:data.file,localAudioPath:data.file,coverUrl:job.thumbnail,isFavorite:false,listenedTime:0});}),
 onDownloadComplete(data=>{latest.current.updateDownloadStatus(data.downloadId,data.success?'completed':'error',data.errorMessage);if(data.success)toast.success('Descarga completada');else toast.error(data.errorMessage?.slice(0,160)||'No se pudo completar la descarga.');})];
 pending.forEach(p=>void p.then(stop=>{if(disposed)stop();}));return()=>{disposed=true;pending.forEach(p=>void p.then(stop=>stop()));};},[]);
 useEffect(()=>{if(!a.hydrated||starting.current||a.downloadQueue.some(j=>j.status==='downloading'))return;const job=a.downloadQueue.find(j=>j.status==='queued');if(!job)return;starting.current=true;a.updateDownloadStatus(job.id,'downloading');
 void(async()=>{if(!isTauri())throw Error('Descarga disponible en POUH de escritorio.');const path=a.downloadPath||await getDownloadPath();await startDownload(job.url,job.id,path,job.format||a.settings.downloadFormat||'mp3',a.settings.includeCover!==false,a.settings.audioQuality||'3',job.videoQuality||a.settings.downloadVideoQuality||'1080');})().catch(error=>a.updateDownloadStatus(job.id,'error',String(error).slice(0,300))).finally(()=>{starting.current=false;});
 },[a.hydrated,a.downloadQueue,a.settings,a.downloadPath]);return null;
}
