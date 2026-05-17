import { useState, useEffect } from 'react';
import { Play, Pause, RotateCcw, X } from 'lucide-react';

export default function FloatingTimer() {
  const [seconds, setSeconds] = useState(25 * 60);
  const [isActive, setIsActive] = useState(false);
  const channel = new BroadcastChannel('owa_studio_sync');

  useEffect(() => {
    channel.onmessage = (event) => {
      if (event.data.type === 'TICK') setSeconds(event.data.seconds);
      if (event.data.type === 'SYNC_STATE') {
        setSeconds(event.data.seconds);
        setIsActive(event.data.isActive);
      }
    };
    return () => channel.close();
  }, []);

  const toggle = () => {
    setIsActive(!isActive);
    channel.postMessage({ type: 'TOGGLE_TIMER' });
  };

  const reset = () => {
    setIsActive(false);
    setSeconds(25 * 60);
    channel.postMessage({ type: 'RESET_TIMER' });
  };

  return (
    <div className="w-full h-full bg-[#0a0a0c] text-white flex flex-col items-center justify-center p-4 overflow-hidden rounded-xl border border-white/10">
      <div className="text-4xl font-semibold tabular-nums mb-4 tracking-tighter">
        {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}
      </div>
      <div className="flex gap-4">
        <button onClick={toggle} className="p-2 hover:bg-white/10 rounded-full transition-colors">
          {isActive ? <Pause size={20} fill="white" /> : <Play size={20} fill="white" />}
        </button>
        <button onClick={reset} className="p-2 hover:bg-white/10 rounded-full transition-colors">
          <RotateCcw size={20} />
        </button>
      </div>
    </div>
  );
}
