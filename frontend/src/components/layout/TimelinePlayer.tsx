import React, { useEffect, useState } from "react";
import { Play, Pause, CaretUp, CaretDown } from "@phosphor-icons/react";
import { formatHour } from "../../utils/formatters";

interface TimelinePlayerProps {
  currentHour: number;
  onHourChange: (hour: number) => void;
  isDrawerOpen?: boolean;
  autoPlayTrigger?: number;
  simulatedEventName?: string;
}

export const TimelinePlayer: React.FC<TimelinePlayerProps> = ({
  currentHour,
  onHourChange,
  isDrawerOpen: _isDrawerOpen = false,
  autoPlayTrigger,
  simulatedEventName
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);

  // Otomatis putar animasi timeline ketika autoPlayTrigger terpicu (setelah simulasi selesai)
  useEffect(() => {
    if (autoPlayTrigger && autoPlayTrigger > 0) {
      setIsPlaying(true);
      setIsExpanded(true);
    }
  }, [autoPlayTrigger]);

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

  const cleanEventName = simulatedEventName
    ? simulatedEventName.replace(/^(Kejadian Observasi|Skenario Hipotetis|Simulasi)(\s*[:-]\s*)?/i, "").trim()
    : "";

  return (
    <div 
      className={`absolute left-1/2 -translate-x-1/2 transition-all duration-300 ease-out z-[1000] w-[min(660px,calc(100vw-2rem))] ${
        isExpanded ? "bottom-3 translate-y-0" : "bottom-0 translate-y-full"
      }`}
    >
      {/* Tab Puller Toggle Slide */}
      <button 
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="absolute -top-4.5 left-1/2 -translate-x-1/2 w-10 h-4.5 rounded-t-md flex items-center justify-center cursor-pointer transition-colors hover:bg-white shadow-[0_-2px_4px_rgba(0,0,0,0.06)]"
        style={{ 
          background: "rgba(245, 239, 227, 0.97)", 
          border: "1px solid rgba(20, 15, 14, 0.15)", 
          borderBottom: "none" 
        }}
        title={isExpanded ? "Sembunyikan Horizon Waktu" : "Tampilkan Horizon Waktu"}
      >
        {isExpanded ? (
          <CaretDown size={12} weight="bold" className="text-[#EB895B]" />
        ) : (
          <CaretUp size={12} weight="bold" className="text-[#EB895B]" />
        )}
      </button>

      {/* Main Instrument Panel */}
      <div 
        className="w-full backdrop-blur-md rounded-lg px-3 py-2 text-[#140f0e] select-none"
        style={{ 
          background: "rgba(245, 239, 227, 0.97)", 
          border: "1px solid rgba(20, 15, 14, 0.15)",
          boxShadow: "0 8px 24px -4px rgba(20, 15, 14, 0.16)"
        }}
      >
        {/* Row 1: Player Controls & Quick Steps */}
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-2 min-w-0">
            {/* Play/Pause Button */}
            <button
              type="button"
              onClick={() => setIsPlaying(!isPlaying)}
              className="w-6.5 h-6.5 rounded-full flex items-center justify-center transition cursor-pointer bg-[#EB895B] hover:bg-[#d97746] active:scale-95 text-white shadow-xs shrink-0"
              title={isPlaying ? "Jeda Animasi" : "Putar Animasi"}
            >
              {isPlaying ? (
                <Pause size={11} weight="fill" />
              ) : (
                <Play size={11} weight="fill" className="translate-x-[0.5px]" />
              )}
            </button>

            {/* Label Horizon Waktu (Tidak terpotong lagi) */}
            <span className="font-sans text-[10px] font-bold tracking-wider uppercase text-[#140f0e] shrink-0 whitespace-nowrap">
              Horizon Waktu
            </span>

            {/* Readout T+... */}
            <span 
              className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded shadow-2xs tabular-nums bg-white/90 text-[#A14646] border border-black/10 shrink-0"
            >
              {formatHour(currentHour)}
            </span>

            {/* Keterangan Lokasi Kejadian (Langsung nama lokasi tanpa kata 'Simulasi:') */}
            {cleanEventName && (
              <span 
                className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#EB895B]/15 border border-[#EB895B]/30 text-[9.5px] font-bold text-[#140f0e] truncate max-w-[200px] sm:max-w-[280px] shrink-0" 
                title={cleanEventName}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                <span className="truncate font-bold text-[#A14646] font-sans">{cleanEventName}</span>
              </span>
            )}
          </div>

          {/* Segmented Quick Step Buttons */}
          <div className="flex items-center gap-0.5 p-0.5 rounded bg-black/5 border border-black/10 shrink-0">
            {quickSteps.map((step) => {
              const isActive = currentHour === step;
              return (
                <button
                  type="button"
                  key={step}
                  onClick={() => onHourChange(step)}
                  className={`font-mono text-[9px] px-1.5 py-0.5 rounded transition cursor-pointer tabular-nums ${
                    isActive
                      ? "font-bold text-white bg-[#EB895B] shadow-2xs"
                      : "text-[#140f0e]/65 hover:text-[#140f0e] hover:bg-black/5 font-medium"
                  }`}
                >
                  +{step}h
                </button>
              );
            })}
          </div>
        </div>

        {/* Row 2: Range Scrubber & Time Ticks (Exact ControllerDock slider style) */}
        <div className="flex flex-col gap-0.5">
          <input
            type="range"
            min={0}
            max={48}
            step={1}
            value={currentHour}
            onChange={(e) => onHourChange(parseInt(e.target.value, 10))}
            className="w-full h-1.5 rounded bg-black/10 cursor-pointer accent-[#EB895B]"
          />
          <div className="flex justify-between font-mono text-[8.5px] text-[#140f0e]/50 font-medium tracking-tight px-0.5">
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
