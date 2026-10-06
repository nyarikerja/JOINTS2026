import React, { useEffect, useState } from "react";
import { Play, Pause } from "lucide-react";
import { formatHour } from "../../utils/formatters";

interface TimelinePlayerProps {
  currentHour: number;
  onHourChange: (hour: number) => void;
}

export const TimelinePlayer: React.FC<TimelinePlayerProps> = ({
  currentHour,
  onHourChange
}) => {
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    let interval: any = null;
    if (isPlaying) {
      interval = setInterval(() => {
        onHourChange(currentHour >= 48 ? 0 : currentHour + 1);
      }, 450);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPlaying, currentHour, onHourChange]);

  const quickSteps = [0, 6, 12, 24, 36, 48];

  return (
    <div className="absolute bottom-3.5 left-1/2 -translate-x-1/2 w-[min(720px,calc(100%-28px))] bg-slate-900/90 backdrop-blur-xl border border-slate-700/80 rounded-xl px-4 py-2.5 z-[1000] shadow-2xl text-slate-100">
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="w-6 h-6 rounded-full bg-sky-600 hover:bg-sky-500 text-white flex items-center justify-center transition cursor-pointer"
            title={isPlaying ? "Jeda Animasi" : "Putar Animasi"}
          >
            {isPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3 fill-white" />}
          </button>
          <span className="text-xs font-semibold text-slate-300">Horizon Waktu:</span>
          <span className="bg-slate-950 border border-sky-500/80 text-sky-400 font-mono text-xs font-bold px-2 py-0.5 rounded">
            {formatHour(currentHour)}
          </span>
        </div>

        <div className="flex gap-1">
          {quickSteps.map((step) => (
            <button
              key={step}
              onClick={() => onHourChange(step)}
              className={`text-[10px] px-2 py-0.5 rounded border transition cursor-pointer ${
                currentHour === step
                  ? "bg-sky-600 text-white border-sky-500 font-bold"
                  : "bg-slate-950/60 border-slate-800 text-slate-400 hover:text-white"
              }`}
            >
              T+{step}h
            </button>
          ))}
        </div>
      </div>

      <div>
        <input
          type="range"
          min={0}
          max={48}
          step={1}
          value={currentHour}
          onChange={(e) => onHourChange(parseInt(e.target.value, 10))}
          className="w-full accent-sky-500 cursor-pointer"
        />
        <div className="flex justify-between font-mono text-[9px] text-slate-500 mt-0.5">
          <span>00:00 (Awal)</span>
          <span>12:00</span>
          <span>24:00</span>
          <span>36:00</span>
          <span>48:00 (Akhir)</span>
        </div>
      </div>
    </div>
  );
};
