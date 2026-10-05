import React from "react";

export const ActionStrip: React.FC = () => {
  return (
    <div className="h-7 bg-red-950/40 border-b border-red-900/40 px-4 flex items-center gap-2.5 text-[11px] text-red-200 shrink-0">
      <span className="bg-red-600 text-white font-bold text-[9px] px-1.5 py-0.5 rounded tracking-wider shrink-0">
        PROTOKOL AKSI PENCEGAHAN BENCANA
      </span>
      <span className="truncate">
        Sistem Peringatan Dini: Mengotomatisasi <strong>Peralihan KBM ke PJJ Daring</strong> (&ge;40%), mandat <strong>Respirator N95/KN95</strong>, dan rute <strong>Evakuasi Medis ke RS Bebas Abu</strong> sebelum partikel tiba.
      </span>
    </div>
  );
};
