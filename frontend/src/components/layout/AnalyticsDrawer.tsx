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
      className={`absolute top-0 right-0 w-[440px] max-w-full h-full backdrop-blur-2xl z-[1050] flex flex-col shadow-2xl transition-transform duration-300 ease-out ${
        isOpen ? "translate-x-0" : "translate-x-full"
      }`}
      style={{
        background: "rgba(245, 239, 227, 0.96)",
        borderLeft: "1px solid rgba(0, 0, 0, 0.1)",
        color: "#140f0e"
      }}
    >
      {/* Header Drawer */}
      <div
        className="h-12 px-4 flex items-center justify-between shrink-0"
        style={{
          borderBottom: "1px solid rgba(0, 0, 0, 0.08)",
          background: "#F5EFE3"
        }}
      >
        <div>
          <span className="font-bold text-xs block" style={{ color: "#140f0e" }}>Proyeksi Dampak &amp; Aksi Dini</span>
          <span className="text-[10px]" style={{ color: "rgba(20, 15, 14, 0.6)" }}>Hasil Ansambel Multi-Bahaya 48 Jam</span>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg transition cursor-pointer hover:bg-black/5"
          style={{ color: "#140f0e" }}
          title="Tutup Panel"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* 5 Tab Navigation */}
      <nav
        className="grid grid-cols-5 shrink-0"
        style={{
          background: "rgba(238, 230, 215, 0.8)",
          borderBottom: "1px solid rgba(0, 0, 0, 0.08)"
        }}
      >
        {tabs.map((t) => {
          const Icon = t.icon;
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className="py-2.5 px-1 text-[10px] font-medium flex flex-col items-center gap-1 border-b-2 transition cursor-pointer hover:bg-black/5"
              style={isActive ? {
                borderColor: "#EB895B",
                color: "#EB895B",
                background: "rgba(235, 137, 91, 0.12)",
                fontWeight: 700
              } : {
                borderColor: "transparent",
                color: "rgba(20, 15, 14, 0.6)"
              }}
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
