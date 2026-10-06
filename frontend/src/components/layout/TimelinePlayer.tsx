import React, { useEffect, useState } from "react";
import { Play, Pause, ChevronUp, ChevronDown } from "lucide-react";
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
  const [isExpanded, setIsExpanded] = useState(true);

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
    <div 
      className={`absolute left-1/2 -translate-x-1/2 w-[min(720px,calc(100%-28px))] z-[1000] transition-transform duration-500 ease-in-out ${
        isExpanded ? "bottom-3.5 translate-y-0" : "bottom-0 translate-y-full"
      }`}
    >
      {/* Tombol Toggle Slide */}
      <button 
        onClick={() => setIsExpanded(!isExpanded)}
        className="absolute -top-7 left-1/2 -translate-x-1/2 w-12 h-7 rounded-t-lg flex items-center justify-center cursor-pointer transition-colors shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] hover:bg-white/50"
        style={{ background: "rgba(245, 239, 227, 0.95)", border: "1px solid rgba(0,0,0,0.1)", borderBottom: "none" }}
        title={isExpanded ? "Sembunyikan Horizon Waktu" : "Tampilkan Horizon Waktu"}
      >
        {isExpanded ? (
          <ChevronDown className="w-5 h-5 text-[#EB895B]" />
        ) : (
          <ChevronUp className="w-5 h-5 text-[#EB895B]" />
        )}
      </button>

      {/* Main Panel */}
      <div 
        className="w-full backdrop-blur-xl rounded-xl px-4 py-2.5 shadow-2xl text-[#140f0e]"
        style={{ background: "rgba(245, 239, 227, 0.95)", border: "1px solid rgba(0,0,0,0.1)" }}
      >
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="w-6 h-6 rounded-full flex items-center justify-center transition cursor-pointer hover:opacity-80 shadow-sm"
              style={{ background: "#EB895B" }}
              title={isPlaying ? "Jeda Animasi" : "Putar Animasi"}
            >
              {isPlaying ? <Pause className="w-3 h-3 text-white" /> : <Play className="w-3 h-3 fill-white text-white" />}
            </button>
            <span className="text-xs font-bold" style={{ color: "#140f0e" }}>Horizon Waktu:</span>
            <span className="font-mono text-xs font-bold px-2 py-0.5 rounded shadow-sm" style={{ background: "#FFFFFF", border: "1px solid rgba(0,0,0,0.1)", color: "#140f0e" }}>
              {formatHour(currentHour)}
            </span>
          </div>

          <div className="flex gap-1">
            {quickSteps.map((step) => (
              <button
                key={step}
                onClick={() => onHourChange(step)}
                className={`text-[10px] px-2 py-0.5 rounded border transition cursor-pointer shadow-sm ${
                  currentHour === step
                    ? "font-bold"
                    : "hover:bg-black/5"
                }`}
                style={currentHour === step ? {
                  background: "#EB895B", color: "#FFFFFF", borderColor: "#EB895B"
                } : {
                  background: "#FFFFFF", color: "rgba(20, 15, 14, 0.7)", borderColor: "rgba(0,0,0,0.1)"
                }}
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
            className="w-full cursor-pointer"
            style={{ accentColor: "#EB895B" }}
          />
          <div className="flex justify-between font-mono text-[9px] mt-0.5 font-medium" style={{ color: "rgba(20, 15, 14, 0.6)" }}>
            <span>00:00 (Awal)</span>
            <span>12:00</span>
            <span>24:00</span>
            <span>36:00</span>
            <span>48:00 (Akhir)</span>
          </div>
        </div>
      </div>
    </div>
  );
};
