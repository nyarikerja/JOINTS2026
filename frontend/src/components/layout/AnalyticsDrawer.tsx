import React, { useState } from "react";
import { X, BarChart3, GraduationCap, Ambulance, ShieldAlert, FlaskConical } from "lucide-react";
import { TabImpact } from "../tabs/TabImpact";
import { TabSchools } from "../tabs/TabSchools";
import { TabEvac } from "../tabs/TabEvac";
import { TabHealth } from "../tabs/TabHealth";
import { TabScience } from "../tabs/TabScience";
import type {
  ImpactResponse,
  FacilitiesImpactResponse,
  ValidationResponse,
  HazardType,
  SchoolItem
} from "../../types/api";

interface AnalyticsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  impact: ImpactResponse | null;
  facilities: FacilitiesImpactResponse | null;
  validation: ValidationResponse | null;
  hazard: HazardType;
  rainMm: number;
  onFlyTo: (lat: number, lng: number) => void;
  onDrawRoute: (s: SchoolItem) => void;
}

type TabType = "impact" | "schools" | "evac" | "health" | "science";

export const AnalyticsDrawer: React.FC<AnalyticsDrawerProps> = ({
  isOpen,
  onClose,
  impact,
  facilities,
  validation,
  hazard,
  rainMm,
  onFlyTo,
  onDrawRoute
}) => {
  const [activeTab, setActiveTab] = useState<TabType>("impact");

  const tabs = [
    { id: "impact", label: "Dampak", icon: BarChart3 },
    { id: "schools", label: "Sekolah", icon: GraduationCap },
    { id: "evac", label: "Evakuasi", icon: Ambulance },
    { id: "health", label: "APD", icon: ShieldAlert },
    { id: "science", label: "Sains", icon: FlaskConical }
  ] as const;

  return (
    <aside
      className={`absolute top-0 right-0 w-[440px] max-w-full h-full bg-slate-950/95 backdrop-blur-2xl border-l border-slate-800 z-[1050] flex flex-col shadow-2xl transition-transform duration-300 ease-out text-slate-100 ${
        isOpen ? "translate-x-0" : "translate-x-full"
      }`}
    >
      {/* Header Drawer */}
      <div className="h-12 px-4 border-b border-slate-800 flex items-center justify-between shrink-0">
        <div>
          <span className="font-bold text-xs text-white block">Laci Analitik &amp; Aksi Dini</span>
          <span className="text-[10px] text-slate-400">Hasil Ansambel Multi-Bahaya 48 Jam</span>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white p-1 rounded transition cursor-pointer"
          title="Tutup Panel"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* 5 Tab Navigation */}
      <nav className="grid grid-cols-5 bg-slate-900 border-b border-slate-800 shrink-0">
        {tabs.map((t) => {
          const Icon = t.icon;
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`py-2 px-1 text-[10px] font-medium flex flex-col items-center gap-1 border-b-2 transition cursor-pointer ${
                isActive
                  ? "border-sky-400 text-sky-400 bg-sky-950/20"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{t.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Content Body */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === "impact" && (
          <TabImpact impact={impact} hazard={hazard} rainMm={rainMm} />
        )}
        {activeTab === "schools" && (
          <TabSchools
            schools={facilities?.schools || []}
            onFlyTo={onFlyTo}
            onDrawRoute={onDrawRoute}
          />
        )}
        {activeTab === "evac" && (
          <TabEvac
            healthcare={facilities?.evacuation_referral_hospitals || facilities?.hospitals || facilities?.healthcare || []}
            onFlyTo={onFlyTo}
          />
        )}
        {activeTab === "health" && <TabHealth hazard={hazard} />}
        {activeTab === "science" && <TabScience validation={validation} hazard={hazard} />}
      </div>
    </aside>
  );
};
