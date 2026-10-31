import React from 'react';
import {useAppSlice} from '../../store/AppContext';
function MusicTimeline({fallbackDuration}: {fallbackDuration: number}) {
  const {musicProgress, musicDuration, setMusicProgress} = useAppSlice(['musicProgress', 'musicDuration', 'setMusicProgress']);
  const duration = Math.max(0, Number.isFinite(musicDuration || fallbackDuration) ? musicDuration || fallbackDuration : 0);
  const progress = Math.max(0, Math.min(1, Number.isFinite(musicProgress) ? musicProgress : 0));
  const time = (value: number) => Math.floor(value / 60) + ':' + String(Math.floor(value % 60)).padStart(2, '0');
  return <div className="music-inline-timeline">
    <input aria-label="Posición de la canción" aria-valuetext={time(progress * duration) + ' de ' + time(duration)} disabled={!duration} type="range" min="0" max="1000" step="1" value={Math.round(progress * 1000)} style={{'--range-fill': progress * 100 + '%'} as React.CSSProperties} onChange={e => setMusicProgress(Number(e.target.value) / 1000)}/>
    <div><span>{time(progress * duration)}</span><span>{time(duration)}</span></div>
  </div>;
}
export default React.memo(MusicTimeline);
